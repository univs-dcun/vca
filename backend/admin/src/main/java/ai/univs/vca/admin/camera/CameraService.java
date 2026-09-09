package ai.univs.vca.admin.camera;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.audit.AuditService;
import ai.univs.vca.admin.camera.CameraDtos.BulkResult;
import ai.univs.vca.admin.camera.CameraDtos.CameraRequest;
import ai.univs.vca.admin.camera.CameraDtos.CameraResponse;
import ai.univs.vca.admin.crypto.CredentialCipher;
import ai.univs.vca.admin.org.ProjectRepository;
import ai.univs.vca.admin.provision.MediaSyncClient;
import ai.univs.vca.admin.provision.ProvisionClient;
import ai.univs.vca.admin.security.ProjectScope;
import ai.univs.vca.admin.status.CameraStatusService;
import ai.univs.vca.admin.status.CameraStatusService.Current;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 카메라 원장 (UV-42 → UV-53 Portal 확장). 응답의 status/lastSeenAt은 원장이 아니라 모듈 MQTT status 적재값.
 * provisioning·미디어 동기화는 프로젝트 무관하게 원장 전체를 수렴한다(모듈은 사이트 단일).
 */
@Service
public class CameraService {

	private final CameraRepository repository;
	private final ProjectRepository projects;
	private final ProvisionClient provisionClient;
	private final MediaSyncClient mediaSyncClient;
	private final CameraStatusService statuses;
	private final CredentialCipher cipher;
	private final AuditService audit;
	private final SecureRandom random = new SecureRandom();

	public CameraService(CameraRepository repository, ProjectRepository projects, ProvisionClient provisionClient,
			MediaSyncClient mediaSyncClient, CameraStatusService statuses, AdminProperties props, AuditService audit) {
		this.repository = repository;
		this.projects = projects;
		this.provisionClient = provisionClient;
		this.mediaSyncClient = mediaSyncClient;
		this.statuses = statuses;
		this.cipher = new CredentialCipher(props.encKey());
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public List<CameraResponse> list(String projectId) {
		Set<String> scope = ProjectScope.current().narrow(projectId);
		List<CameraEntity> rows = scope == null ? repository.findAllByOrderByNameAsc()
				: repository.findByProjectIdInOrderByNameAsc(scope);
		return rows.stream().map(this::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public CameraResponse get(String cameraId) {
		return toResponse(findInScope(cameraId));
	}

	@Transactional
	public CameraResponse create(CameraRequest req) {
		validate(req);
		String projectId = ProjectScope.current().require(resolveProject(req.projectId()));
		String locationId = req.locationId() != null && !req.locationId().isBlank() ? req.locationId()
				: "loc-" + slug(req.name());
		String cameraId = newCameraId(req.name());
		CameraEntity entity = new CameraEntity(cameraId, req.name(), req.ip(), req.maker(), req.model(),
				req.username(), encryptOrNull(req.password()), req.rtspUrl(), locationId, req.latLng().lat(),
				req.latLng().lng());
		String zone = req.zone() == null || req.zone().isBlank() ? req.name() : req.zone();
		String code = req.code() != null && !req.code().isBlank() ? req.code().trim() : newCode(zone);
		entity.applyPortalFields(projectId, code, req.mac(), req.resolution(), req.protocol(), zone,
				req.location(), req.serverId(), CameraDtos.joinFeatures(req.aiFeatures()), req.thumbnail());
		repository.save(entity);
		audit.record(projectId, "Camera " + entity.getName() + " (" + code + ") registered");
		syncModule();
		return toResponse(entity);
	}

	@Transactional
	public CameraResponse update(String cameraId, CameraRequest req) {
		validate(req);
		CameraEntity entity = findInScope(cameraId);
		if (req.projectId() != null && !req.projectId().isBlank() && !req.projectId().equals(entity.getProjectId())) {
			ProjectScope.current().require(req.projectId()); // 다른 프로젝트로 옮기는 것도 그 프로젝트가 범위 안일 때만
		}
		String locationId = req.locationId() != null && !req.locationId().isBlank() ? req.locationId()
				: entity.getLocationId();
		boolean rtspChanged = !req.rtspUrl().equals(entity.getRtspUrl());
		entity.update(req.name(), req.ip(), req.maker(), req.model(), req.username(), encryptOrNull(req.password()),
				req.rtspUrl(), locationId, req.latLng().lat(), req.latLng().lng());
		entity.applyPortalFields(req.projectId(), req.code() == null || req.code().isBlank() ? null : req.code().trim(),
				req.mac(), req.resolution(), req.protocol(), req.zone(), req.location(), req.serverId(),
				CameraDtos.joinFeatures(req.aiFeatures()), req.thumbnail());
		audit.record(entity.getProjectId(), "Camera " + entity.getName() + " (" + entity.getCode() + ")"
				+ (rtspChanged ? " RTSP URL updated" : " updated"));
		syncModule();
		return toResponse(entity);
	}

	@Transactional
	public void delete(String cameraId) {
		CameraEntity entity = findInScope(cameraId);
		repository.delete(entity);
		statuses.forget(cameraId);
		audit.record(entity.getProjectId(), "Camera " + entity.getName() + " (" + entity.getCode() + ") removed");
		syncModule();
	}

	/** 일괄 삭제 — 감사는 N줄이 아니라 1줄(하나의 결정) */
	@Transactional
	public BulkResult deleteAll(List<String> cameraIds) {
		List<CameraEntity> rows = requireAll(cameraIds);
		repository.deleteAll(rows);
		rows.forEach(c -> statuses.forget(c.getCameraId()));
		audit.record(rows.get(0).getProjectId(), rows.size() + " cameras removed");
		syncModule();
		return new BulkResult(rows.size(), rows.stream().map(CameraEntity::getCameraId).toList());
	}

	@Transactional
	public BulkResult setZone(List<String> cameraIds, String zone) {
		if (zone == null || zone.isBlank()) {
			throw AdminApiException.badRequest("zone is required");
		}
		List<CameraEntity> rows = requireAll(cameraIds);
		rows.forEach(c -> c.setZone(zone.trim()));
		audit.record(rows.get(0).getProjectId(), rows.size() + " cameras moved to zone " + zone.trim());
		return new BulkResult(rows.size(), rows.stream().map(CameraEntity::getCameraId).toList());
	}

	/**
	 * 원장 전체를 두 대상에 수렴 — 모듈 provisioning(계약 v1.9)과 미디어 서버 스트림 path(P2, UV-43).
	 * 어느 쪽이 실패해도 CRUD는 성공 — 상태는 provision/status로 확인, 수동 재동기화로 따라잡는다
	 */
	@Transactional(readOnly = true)
	public boolean syncModule() {
		List<CameraEntity> ledger = repository.findAllByOrderByNameAsc();
		boolean module = provisionClient.pushAll(ledger);
		boolean media = mediaSyncClient.syncAll(ledger);
		return module && media;
	}

	private CameraResponse toResponse(CameraEntity e) {
		Current cur = statuses.currentOf(e.getCameraId());
		return CameraResponse.from(e, cur.status(), cur.lastSeenAt(), cur.lastChangeAt());
	}

	private CameraEntity find(String cameraId) {
		return repository.findById(cameraId).orElseThrow(() -> AdminApiException.cameraNotFound(cameraId));
	}

	/** 범위 밖 카메라는 403 (UV-58) — 존재 여부를 흘리지 않는다 */
	private CameraEntity findInScope(String cameraId) {
		CameraEntity e = find(cameraId);
		ProjectScope.current().require(e.getProjectId());
		return e;
	}

	private List<CameraEntity> requireAll(List<String> cameraIds) {
		if (cameraIds == null || cameraIds.isEmpty()) {
			throw AdminApiException.badRequest("cameraIds is required");
		}
		List<CameraEntity> rows = repository.findByCameraIdIn(cameraIds);
		if (rows.size() != cameraIds.stream().distinct().count()) {
			throw AdminApiException.badRequest("some cameraIds are unknown");
		}
		ProjectScope scope = ProjectScope.current();
		rows.forEach(c -> scope.require(c.getProjectId()));
		return rows;
	}

	/** projectId 생략 시 — 범위 제한 사용자는 배정이 하나일 때 그것, owner는 첫 프로젝트(UV-42 계약 호출부 호환) */
	private String resolveProject(String projectId) {
		if (projectId != null && !projectId.isBlank()) {
			if (!projects.existsById(projectId)) {
				throw AdminApiException.projectNotFound(projectId);
			}
			return projectId;
		}
		String sole = ProjectScope.current().soleProjectOrNull();
		if (sole != null) {
			return sole;
		}
		return projects.findAll().stream().findFirst().map(p -> p.getId())
			.orElseThrow(() -> AdminApiException.badRequest("no project exists — create one first"));
	}

	private void validate(CameraRequest req) {
		if (req == null || isBlank(req.name()) || isBlank(req.rtspUrl()) || req.latLng() == null) {
			throw AdminApiException.badRequest("name·rtspUrl·coordinates{lat,lng}은 필수입니다");
		}
		if (!req.rtspUrl().startsWith("rtsp://") && !req.rtspUrl().startsWith("rtsps://")) {
			throw AdminApiException.badRequest("rtspUrl은 rtsp:// 또는 rtsps:// 로 시작해야 합니다");
		}
		if (req.locationId() != null && !req.locationId().isBlank()
				&& !req.locationId().matches("^[a-z0-9-]{1,64}$")) {
			throw AdminApiException.badRequest("locationId는 ^[a-z0-9-]{1,64}$ 형식이어야 합니다 (공유 계약 공통 규약)");
		}
		if (req.protocol() != null && !req.protocol().isBlank() && !req.protocol().equals("TCP")
				&& !req.protocol().equals("UDP")) {
			throw AdminApiException.badRequest("protocol must be TCP or UDP");
		}
	}

	private static boolean isBlank(String s) {
		return s == null || s.isBlank();
	}

	private String encryptOrNull(String password) {
		return isBlank(password) ? null : cipher.encrypt(password);
	}

	/** cam-{name 슬러그}-{4 hex} — cameraId 발급 주체는 Admin (계약 v1.9). ^[a-z0-9-]{1,64}$ 보장 */
	private String newCameraId(String name) {
		String base = slug(name);
		for (int i = 0; i < 20; i++) {
			byte[] suffix = new byte[2];
			random.nextBytes(suffix);
			String id = "cam-" + base + "-" + HexFormat.of().formatHex(suffix);
			if (!repository.existsById(id)) {
				return id;
			}
		}
		throw new IllegalStateException("cameraId 발급 실패: " + name);
	}

	/** CAM-{ZONE 앞 3자}-{NNN} — 화면 표시 코드(기획 mock: CAM-BDK-001). 유일할 때까지 번호 증가 */
	String newCode(String zone) {
		String ascii = Normalizer.normalize(zone, Normalizer.Form.NFKD).replaceAll("\\p{M}", "")
			.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
		String prefix = "CAM-" + (ascii.length() >= 3 ? ascii.substring(0, 3) : (ascii + "XXX").substring(0, 3)) + "-";
		for (int n = 1; n < 1000; n++) {
			String code = prefix + String.format("%03d", n);
			if (!repository.existsByCode(code)) {
				return code;
			}
		}
		throw new IllegalStateException("code 발급 실패: " + zone);
	}

	static String slug(String name) {
		String ascii = Normalizer.normalize(name, Normalizer.Form.NFKD).replaceAll("\\p{M}", "");
		String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
		if (slug.isEmpty()) {
			slug = "cam";
		}
		return slug.length() > 32 ? slug.substring(0, 32).replaceAll("-$", "") : slug;
	}
}
