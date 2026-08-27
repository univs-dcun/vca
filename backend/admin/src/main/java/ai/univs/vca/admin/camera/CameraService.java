package ai.univs.vca.admin.camera;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.camera.CameraDtos.CameraRequest;
import ai.univs.vca.admin.camera.CameraDtos.CameraResponse;
import ai.univs.vca.admin.crypto.CredentialCipher;
import ai.univs.vca.admin.provision.MediaSyncClient;
import ai.univs.vca.admin.provision.ProvisionClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CameraService {

	private final CameraRepository repository;
	private final ProvisionClient provisionClient;
	private final MediaSyncClient mediaSyncClient;
	private final CredentialCipher cipher;
	private final SecureRandom random = new SecureRandom();

	public CameraService(CameraRepository repository, ProvisionClient provisionClient,
			MediaSyncClient mediaSyncClient, AdminProperties props) {
		this.repository = repository;
		this.provisionClient = provisionClient;
		this.mediaSyncClient = mediaSyncClient;
		this.cipher = new CredentialCipher(props.encKey());
	}

	@Transactional(readOnly = true)
	public List<CameraResponse> list() {
		return repository.findAllByOrderByNameAsc().stream().map(CameraResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public CameraResponse get(String cameraId) {
		return CameraResponse.from(find(cameraId));
	}

	@Transactional
	public CameraResponse create(CameraRequest req) {
		validate(req);
		String locationId = req.locationId() != null && !req.locationId().isBlank() ? req.locationId()
				: "loc-" + slug(req.name());
		String cameraId = newCameraId(req.name());
		CameraEntity entity = new CameraEntity(cameraId, req.name(), req.ip(), req.maker(), req.model(),
				req.username(), encryptOrNull(req.password()), req.rtspUrl(), locationId, req.location().lat(),
				req.location().lng());
		repository.save(entity);
		syncModule();
		return CameraResponse.from(entity);
	}

	@Transactional
	public CameraResponse update(String cameraId, CameraRequest req) {
		validate(req);
		CameraEntity entity = find(cameraId);
		String locationId = req.locationId() != null && !req.locationId().isBlank() ? req.locationId()
				: entity.getLocationId();
		entity.update(req.name(), req.ip(), req.maker(), req.model(), req.username(), encryptOrNull(req.password()),
				req.rtspUrl(), locationId, req.location().lat(), req.location().lng());
		syncModule();
		return CameraResponse.from(entity);
	}

	@Transactional
	public void delete(String cameraId) {
		repository.delete(find(cameraId));
		syncModule();
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

	private CameraEntity find(String cameraId) {
		return repository.findById(cameraId).orElseThrow(() -> AdminApiException.cameraNotFound(cameraId));
	}

	private void validate(CameraRequest req) {
		if (req == null || isBlank(req.name()) || isBlank(req.rtspUrl()) || req.location() == null) {
			throw AdminApiException.badRequest("name·rtspUrl·location{lat,lng}은 필수입니다");
		}
		if (!req.rtspUrl().startsWith("rtsp://") && !req.rtspUrl().startsWith("rtsps://")) {
			throw AdminApiException.badRequest("rtspUrl은 rtsp:// 또는 rtsps:// 로 시작해야 합니다");
		}
		if (req.locationId() != null && !req.locationId().isBlank()
				&& !req.locationId().matches("^[a-z0-9-]{1,64}$")) {
			throw AdminApiException.badRequest("locationId는 ^[a-z0-9-]{1,64}$ 형식이어야 합니다 (공유 계약 공통 규약)");
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

	private static String slug(String name) {
		String ascii = Normalizer.normalize(name, Normalizer.Form.NFKD).replaceAll("\\p{M}", "");
		String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
		if (slug.isEmpty()) {
			slug = "camera";
		}
		return slug.length() > 40 ? slug.substring(0, 40) : slug;
	}
}
