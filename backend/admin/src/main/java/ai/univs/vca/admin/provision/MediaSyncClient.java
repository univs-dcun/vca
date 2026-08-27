package ai.univs.vca.admin.provision;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.camera.CameraEntity;
import ai.univs.vca.admin.provision.ProvisionClient.SyncState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 미디어 서버(MediaMTX) 스트림 path 동기화 (P2, UV-43 — 설계 §4.1-②).
 *
 * 원장 변경 시 카메라당 path 1개(이름 = cameraId, source = rtspUrl)를 제어 API로 수렴시킨다 —
 * 새 카메라는 add, 기존은 patch, 원장에서 빠진 관리 대상(cam- 프리픽스)은 delete.
 * sourceOnDemand: 시청자(WHEP)가 붙을 때만 미디어 서버가 RTSP를 당긴다 — 미시청 카메라의
 * 원본 스트림 부하가 없다. rtspUrl(민감정보)은 Admin→미디어 서버 내부 채널에만 흐른다.
 *
 * ProvisionClient와 같은 규칙: 실패해도 CRUD는 성공 — 수동 재동기화로 따라잡는다.
 */
@Component
public class MediaSyncClient {

	private static final Logger log = LoggerFactory.getLogger(MediaSyncClient.class);
	/** 우리가 관리하는 path 이름 — Admin 발급 cameraId는 전부 cam- 프리픽스라 그 외(dev 테스트 소스 등)는 건드리지 않는다 */
	private static final String MANAGED_PREFIX = "cam-";

	private final RestClient restClient;

	private volatile SyncState state = new SyncState(null, null, null, null, false);

	public MediaSyncClient(AdminProperties props) {
		if (props.mediaApiBaseUrl() == null || props.mediaApiBaseUrl().isBlank()) {
			this.restClient = null; // 미디어 서버 미구성 — 동기화 생략 (P2 이전 환경 호환)
			return;
		}
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
				java.net.http.HttpClient.newBuilder().connectTimeout(props.moduleTimeout()).build());
		factory.setReadTimeout(props.moduleTimeout());
		this.restClient = RestClient.builder()
			.baseUrl(props.mediaApiBaseUrl())
			.requestFactory(factory)
			.build();
	}

	/** @return 동기화 성공 여부 — 미구성이면 true(동기화 대상 없음), 실패해도 예외를 던지지 않는다 */
	public boolean syncAll(List<CameraEntity> cameras) {
		if (restClient == null) {
			return true;
		}
		Instant attemptedAt = Instant.now();
		try {
			Set<String> existing = listConfiguredPaths();
			for (CameraEntity cam : cameras) {
				Map<String, Object> body = Map.of("source", cam.getRtspUrl(), "sourceOnDemand", true);
				if (existing.contains(cam.getCameraId())) {
					restClient.patch().uri("/v3/config/paths/patch/{name}", cam.getCameraId())
						.body(body).retrieve().toBodilessEntity();
				}
				else {
					restClient.post().uri("/v3/config/paths/add/{name}", cam.getCameraId())
						.body(body).retrieve().toBodilessEntity();
				}
			}
			Set<String> ledgerIds = new HashSet<>(cameras.stream().map(CameraEntity::getCameraId).toList());
			for (String name : existing) {
				if (name.startsWith(MANAGED_PREFIX) && !ledgerIds.contains(name)) {
					restClient.delete().uri("/v3/config/paths/delete/{name}", name).retrieve().toBodilessEntity();
				}
			}
			state = new SyncState(attemptedAt, attemptedAt, cameras.size(), null, true);
			log.info("미디어 서버 path 동기화 완료 — cameras={}", cameras.size());
			return true;
		}
		catch (Exception e) {
			state = new SyncState(attemptedAt, state.lastSuccessAt(), state.moduleAccepted(), e.getMessage(), false);
			log.warn("미디어 서버 path 동기화 실패 (원장은 저장됨 — 수동 재동기화 가능): {}", e.getMessage());
			return false;
		}
	}

	private Set<String> listConfiguredPaths() {
		PathList list = restClient.get().uri("/v3/config/paths/list?itemsPerPage=500")
			.retrieve().body(PathList.class);
		Set<String> names = new HashSet<>();
		if (list != null && list.items() != null) {
			for (PathItem item : list.items()) {
				if (item.name() != null) {
					names.add(item.name());
				}
			}
		}
		return names;
	}

	public SyncState state() {
		return state;
	}

	public record PathItem(String name) {
	}

	public record PathList(List<PathItem> items) {
	}
}
