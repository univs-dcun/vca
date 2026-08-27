package ai.univs.vca.admin.provision;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.camera.CameraEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 모듈 provisioning 클라이언트 (계약 v1.9) — 원장 변경 시마다 전체 목록을 PUT /provision/cameras로
 * 내려보낸다 (선언적 멱등 교체). 모듈이 죽어 있어도 CRUD는 성공시킨다 — 원장이 단일 원천이고
 * 수렴은 다음 push 또는 수동 재동기화(POST /admin/api/provision/sync)로 따라잡는다.
 */
@Component
public class ProvisionClient {

	private static final Logger log = LoggerFactory.getLogger(ProvisionClient.class);

	private final RestClient restClient;

	private volatile SyncState state = new SyncState(null, null, null, null, false);

	public ProvisionClient(AdminProperties props) {
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
				java.net.http.HttpClient.newBuilder().connectTimeout(props.moduleTimeout()).build());
		factory.setReadTimeout(props.moduleTimeout());
		this.restClient = RestClient.builder()
			.baseUrl(props.moduleBaseUrl())
			.requestFactory(factory)
			.build();
	}

	/** @return 동기화 성공 여부 — 실패해도 예외를 던지지 않는다 (호출측 CRUD는 항상 성공) */
	public boolean pushAll(List<CameraEntity> cameras) {
		Instant attemptedAt = Instant.now();
		List<Map<String, Object>> items = cameras.stream()
			.<Map<String, Object>>map(c -> Map.of(
				"cameraId", c.getCameraId(),
				"name", c.getName(),
				"rtspUrl", c.getRtspUrl(),
				"locationId", c.getLocationId(),
				"location", Map.of("lat", c.getLat(), "lng", c.getLng())))
			.toList();
		try {
			ProvisionResult result = restClient.put()
				.uri("/provision/cameras")
				.body(Map.of("cameras", items))
				.retrieve()
				.body(ProvisionResult.class);
			Integer accepted = result == null ? null : result.accepted();
			state = new SyncState(attemptedAt, attemptedAt, accepted, null, true);
			log.info("provisioning 동기화 완료 — cameras={}, accepted={}", items.size(), accepted);
			return true;
		}
		catch (Exception e) {
			state = new SyncState(attemptedAt, state.lastSuccessAt(), state.moduleAccepted(), e.getMessage(), false);
			log.warn("provisioning 동기화 실패 (원장은 저장됨 — 수동 재동기화 가능): {}", e.getMessage());
			return false;
		}
	}

	public SyncState state() {
		return state;
	}

	public record ProvisionResult(Integer accepted) {
	}

	public record SyncState(Instant lastAttemptAt, Instant lastSuccessAt, Integer moduleAccepted, String lastError,
			boolean synced) {
	}
}
