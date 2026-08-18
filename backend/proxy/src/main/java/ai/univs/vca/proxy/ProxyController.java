package ai.univs.vca.proxy;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.concurrent.TimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

/**
 * /api/** → 모듈 API 중계. 변환 규칙(docs/ARCHITECTURE.md):
 *   1. 경로·쿼리 그대로 전달 (두 계약은 envelope 유무만 다르다)
 *   2. 2xx JSON → { success: true, code: "OK", data: ... } 로 포장
 *   3. 모듈 오류({code, message} + 상태코드) → 같은 상태코드의 envelope 오류
 *   4. 연결 실패 502 VCA-5020 / 타임아웃 504 VCA-5040 / 그 외 500 VCA-5000
 *   5. 예외: 이미지 리소스(VIP 사진, best frame, 감지 스냅샷)는 바이너리를 envelope 없이 스트리밍
 */
@RestController
public class ProxyController {

	private final WebClient moduleApi;
	private final ModuleApiProperties props;
	private final ObjectMapper mapper;

	public ProxyController(WebClient moduleApiClient, ModuleApiProperties props, ObjectMapper mapper) {
		this.moduleApi = moduleApiClient;
		this.props = props;
		this.mapper = mapper;
	}

	@GetMapping("/api/vips/{vipId}/photo")
	public Mono<ResponseEntity<byte[]>> vipPhoto(@PathVariable String vipId) {
		return binary("/vips/{vipId}/photo", vipId);
	}

	@GetMapping("/api/cameras/{cameraId}/frames/{frameId}")
	public Mono<ResponseEntity<byte[]>> cameraFrame(@PathVariable String cameraId, @PathVariable String frameId) {
		return binary("/cameras/{cameraId}/frames/{frameId}", cameraId, frameId);
	}

	@GetMapping("/api/detections/{eventId}/snapshot")
	public Mono<ResponseEntity<byte[]>> detectionSnapshot(@PathVariable String eventId) {
		return binary("/detections/{eventId}/snapshot", eventId);
	}

	/** 이미지 리소스 패스스루 — 모듈 응답의 상태코드·Content-Type을 유지한 채 envelope 없이 전달 */
	private Mono<ResponseEntity<byte[]>> binary(String uriTemplate, Object... uriVars) {
		return moduleApi.get()
				.uri(uriTemplate, uriVars)
				.retrieve()
				.toEntity(byte[].class)
				.timeout(props.timeout())
				.map(res -> ResponseEntity.status(res.getStatusCode())
						.contentType(res.getHeaders().getContentType() != null
								? res.getHeaders().getContentType()
								: MediaType.APPLICATION_OCTET_STREAM)
						.body(res.getBody()))
				.onErrorResume(WebClientResponseException.class,
						e -> Mono.just(ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsByteArray())))
				.onErrorResume(this::isConnectionError,
						e -> Mono.just(ResponseEntity.status(HttpStatus.BAD_GATEWAY).build()))
				.onErrorResume(TimeoutException.class,
						e -> Mono.just(ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).build()));
	}

	@GetMapping("/api/{*path}")
	public Mono<ResponseEntity<ApiEnvelope>> proxy(@PathVariable String path, ServerHttpRequest request) {
		String query = request.getURI().getRawQuery();
		String uri = query == null ? path : path + "?" + query;

		return moduleApi.get()
				.uri(uri)
				.retrieve()
				.bodyToMono(JsonNode.class)
				.timeout(props.timeout())
				.map(body -> ResponseEntity.ok(ApiEnvelope.ok(ModuleUrlRewriter.rewrite(body))))
				.onErrorResume(WebClientResponseException.class, e -> Mono.just(moduleError(e)))
				.onErrorResume(this::isConnectionError, e -> Mono.just(
						ResponseEntity.status(HttpStatus.BAD_GATEWAY)
								.body(ApiEnvelope.error("VCA-5020", "모듈 API에 연결할 수 없습니다"))))
				.onErrorResume(TimeoutException.class, e -> Mono.just(
						ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
								.body(ApiEnvelope.error("VCA-5040", "모듈 API 응답 시간 초과"))))
				.onErrorResume(e -> Mono.just(
						ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
								.body(ApiEnvelope.error("VCA-5000", "프록시 내부 오류"))));
	}

	/** 모듈 오류 본문 { code, message } 를 같은 상태코드의 envelope 오류로 변환 */
	private ResponseEntity<ApiEnvelope> moduleError(WebClientResponseException e) {
		String code = "VCA-5000";
		String message = null;
		try {
			JsonNode body = mapper.readTree(e.getResponseBodyAsByteArray());
			if (body.hasNonNull("code")) code = body.get("code").asText();
			if (body.hasNonNull("message")) message = body.get("message").asText();
		} catch (Exception ignored) {
			// 모듈이 계약 외 오류 본문을 보낸 경우 — 상태코드만 전달
		}
		return ResponseEntity.status(e.getStatusCode()).body(ApiEnvelope.error(code, message));
	}

	private boolean isConnectionError(Throwable e) {
		return e instanceof WebClientRequestException;
	}
}
