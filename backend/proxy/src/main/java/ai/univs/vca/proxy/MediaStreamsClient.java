package ai.univs.vca.proxy;

import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

import tools.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

/**
 * 미디어 서버(MediaMTX)의 구성된 스트림 path 목록 조회 (UV-43).
 *
 * 카메라 목록 응답에 streamUrl을 병합하기 위한 가용성 판단 근거 — path는 Admin 백엔드가
 * 원장과 동기화한다(카메라당 path 1개, 이름 = cameraId). 여기서는 존재 여부만 읽는다.
 * 미디어 서버 미구성·미응답이면 빈 집합 → 전 카메라 streamUrl null (bestframe 폴백) —
 * 미디어 서버 장애가 카메라 목록 자체를 깨뜨리지 않는다.
 *
 * P4에서 카메라 목록 서빙이 Admin 백엔드로 이관되면 이 병합도 Admin으로 옮긴다 (설계 §7).
 */
@Component
public class MediaStreamsClient {

	private static final Logger log = LoggerFactory.getLogger(MediaStreamsClient.class);
	/** path 목록 캐시 TTL — 카메라 목록 조회마다 미디어 API를 때리지 않기 위한 최소한의 완충 */
	private static final Duration CACHE_TTL = Duration.ofSeconds(5);

	private final MediaProperties props;
	private final WebClient client;

	private volatile Set<String> cached = Set.of();
	private volatile long cachedAtMs = 0;

	public MediaStreamsClient(MediaProperties props) {
		this.props = props;
		this.client = props.enabled() ? WebClient.builder().baseUrl(props.apiBaseUrl()).build() : null;
	}

	/** 구성된 스트림 path 이름 집합. 실패·미구성 시 빈 집합 (오류를 전파하지 않는다) */
	public Mono<Set<String>> configuredPaths() {
		if (client == null) {
			return Mono.just(Set.of());
		}
		if (System.currentTimeMillis() - cachedAtMs < CACHE_TTL.toMillis()) {
			return Mono.just(cached);
		}
		return client.get()
				.uri("/v3/config/paths/list?itemsPerPage=500")
				.retrieve()
				.bodyToMono(JsonNode.class)
				.timeout(props.timeout())
				.map(body -> {
					Set<String> names = new HashSet<>();
					for (JsonNode item : body.path("items")) {
						if (item.hasNonNull("name")) {
							names.add(item.get("name").asString());
						}
					}
					cached = Set.copyOf(names);
					cachedAtMs = System.currentTimeMillis();
					return cached;
				})
				.onErrorResume(e -> {
					log.debug("미디어 서버 path 목록 조회 실패 — streamUrl 전부 null로 폴백: {}", e.toString());
					return Mono.just(Set.<String>of());
				});
	}
}
