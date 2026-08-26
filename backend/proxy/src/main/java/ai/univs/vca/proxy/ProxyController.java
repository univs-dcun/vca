package ai.univs.vca.proxy;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * /api/** → 모듈 API 중계. 변환 규칙(docs/ARCHITECTURE.md):
 *   1. 경로·쿼리 그대로 전달 (두 계약은 envelope 유무만 다르다)
 *   2. 2xx JSON → { success: true, code: "OK", data: ... } 로 포장
 *   3. 모듈 오류({code, message} + 상태코드) → 같은 상태코드의 envelope 오류
 *   4. 연결 실패 502 VCA-5020 / 타임아웃 504 VCA-5040 / 그 외 500 VCA-5000
 *   5. 예외: 이미지 리소스(VIP 사진, best frame, 감지 스냅샷, 검색 hit 크롭)는 바이너리를 envelope 없이 스트리밍
 *   6. 예외: 인물 검색(POST /persons/search)은 multipart 본문을 파싱 없이 그대로 중계하고
 *      전용 타임아웃(search-timeout)을 쓴다 — 영상 검색은 통상 조회보다 오래 걸린다 (계약 v1.2, UV-34)
 *   7. 예외: 비디오 콘텐츠(/videos/{id}/content)는 Range 헤더를 전달하고 상태(200/206)·관련 헤더와
 *      함께 본문을 버퍼링 없이 스트리밍한다 — 수백 MB MP4가 메모리 한도(max-response-size)를
 *      지나지 않아야 하고, 시킹은 Range 패스스루가 전제다 (계약 v1.3, UV-35)
 */
@RestController
public class ProxyController {

	private static final Logger log = LoggerFactory.getLogger(ProxyController.class);

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

	// 감지 얼굴 크롭 (계약 v1.6, UV-38) — DATA Live Monitoring 카드의 얼굴 인셋
	@GetMapping("/api/detections/{eventId}/face")
	public Mono<ResponseEntity<byte[]>> detectionFace(@PathVariable String eventId) {
		return binary("/detections/{eventId}/face", eventId);
	}

	@GetMapping("/api/search-hits/{hitId}/face")
	public Mono<ResponseEntity<byte[]>> searchHitFace(@PathVariable String hitId) {
		return binary("/search-hits/{hitId}/face", hitId);
	}

	@GetMapping("/api/search-hits/{hitId}/body")
	public Mono<ResponseEntity<byte[]>> searchHitBody(@PathVariable String hitId) {
		return binary("/search-hits/{hitId}/body", hitId);
	}

	@GetMapping("/api/images/{imageId}/content")
	public Mono<ResponseEntity<byte[]>> imageContent(@PathVariable String imageId) {
		return binary("/images/{imageId}/content", imageId);
	}

	@GetMapping("/api/images/{imageId}/targets/{targetId}/crop")
	public Mono<ResponseEntity<byte[]>> imageTargetCrop(@PathVariable String imageId, @PathVariable String targetId) {
		return binary("/images/{imageId}/targets/{targetId}/crop", imageId, targetId);
	}

	@GetMapping("/api/videos/{videoId}/thumbnail")
	public Mono<ResponseEntity<byte[]>> videoThumbnail(@PathVariable String videoId) {
		return binary("/videos/{videoId}/thumbnail", videoId);
	}

	@GetMapping("/api/videos/{videoId}/targets/{targetId}/crop")
	public Mono<ResponseEntity<byte[]>> videoTargetCrop(@PathVariable String videoId, @PathVariable String targetId) {
		return binary("/videos/{videoId}/targets/{targetId}/crop", videoId, targetId);
	}

	// 비디오 베스트 프레임 이미지 (계약 v1.5, UV-37). 카메라 프레임은 v1.1 라우트를 재사용하므로
	// Analyze Frame에서 신규 바이너리 중계는 이것 하나다 — JSON 2종(bestframes, targets)은 범용 라우트가 처리
	@GetMapping("/api/videos/{videoId}/bestframes/{frameId}/image")
	public Mono<ResponseEntity<byte[]>> videoBestframeImage(@PathVariable String videoId, @PathVariable String frameId) {
		return binary("/videos/{videoId}/bestframes/{frameId}/image", videoId, frameId);
	}

	/**
	 * 비디오 콘텐츠 스트리밍 중계 (계약 v1.3). binary()와 달리 본문을 메모리에 모으지 않는다 —
	 * MP4는 max-response-size를 넘는 것이 정상이다. Range 요청 헤더를 모듈에 그대로 전달하고,
	 * 응답 상태(200/206)와 재생·시킹에 필요한 헤더(Content-Type/Length/Range, Accept-Ranges)를
	 * 유지한 채 DataBuffer 흐름으로 통과시킨다. 타임아웃은 헤더 수신까지만 적용 — 본문 전송은
	 * 재생 시간만큼 이어지는 것이 정상이라 스트림에는 걸지 않는다.
	 */
	@GetMapping("/api/videos/{videoId}/content")
	public Mono<ResponseEntity<Flux<DataBuffer>>> videoContent(@PathVariable String videoId, ServerHttpRequest request) {
		String range = request.getHeaders().getFirst(HttpHeaders.RANGE);
		return moduleApi.get()
				.uri("/videos/{videoId}/content", videoId)
				.headers(h -> { if (range != null) h.set(HttpHeaders.RANGE, range); })
				.retrieve()
				// exchangeToMono는 Mono 완료 시점에 커넥션을 해제해 밖으로 넘긴 body Flux가
				// 빈 스트림이 된다 — 헤더만 먼저 완료되고 본문은 이후에 흐르는 toEntityFlux를 써야 한다
				.toEntityFlux(DataBuffer.class)
				.timeout(props.timeout()) // 헤더 수신까지만 — 본문 전송은 재생 시간만큼 이어지는 것이 정상
				.map(res -> {
					HttpHeaders headers = new HttpHeaders();
					for (String name : new String[] {
							HttpHeaders.CONTENT_TYPE, HttpHeaders.CONTENT_LENGTH,
							HttpHeaders.CONTENT_RANGE, HttpHeaders.ACCEPT_RANGES, HttpHeaders.CACHE_CONTROL }) {
						String v = res.getHeaders().getFirst(name);
						if (v != null) headers.set(name, v);
					}
					return ResponseEntity.status(res.getStatusCode()).headers(headers).body(res.getBody());
				})
				.onErrorResume(WebClientResponseException.class, e -> Mono.just(
						ResponseEntity.status(e.getStatusCode())
								.headers(h -> h.setContentType(MediaType.APPLICATION_JSON))
								.body(Flux.just(DefaultDataBufferFactory.sharedInstance.wrap(e.getResponseBodyAsByteArray())))))
				.onErrorResume(this::isConnectionError,
						e -> Mono.just(ResponseEntity.status(HttpStatus.BAD_GATEWAY).build()))
				.onErrorResume(TimeoutException.class,
						e -> Mono.just(ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).build()));
	}

	/**
	 * 인물 검색 중계 (계약 v1.2). multipart 본문(얼굴/바디 이미지)을 파싱하지 않고 Content-Type
	 * 헤더(boundary 포함)와 함께 그대로 스트리밍한다 — 프록시가 이미지를 메모리에 모으지 않는다.
	 * 응답은 일반 조회와 동일하게 envelope 포장 + URL 재작성(faceUrl/bodyUrl → /api).
	 */
	@PostMapping("/api/persons/search")
	public Mono<ResponseEntity<ApiEnvelope>> searchPersons(ServerHttpRequest request) {
		String query = request.getURI().getRawQuery();
		String uri = query == null ? "/persons/search" : "/persons/search?" + query;
		MediaType contentType = request.getHeaders().getContentType();

		return moduleApi.post()
				.uri(uri)
				.headers(h -> {
					if (contentType != null) h.setContentType(contentType);
					long len = request.getHeaders().getContentLength();
					if (len >= 0) h.set(HttpHeaders.CONTENT_LENGTH, Long.toString(len));
				})
				.body(BodyInserters.fromDataBuffers(request.getBody()))
				.retrieve()
				.bodyToMono(JsonNode.class)
				.timeout(props.searchTimeout())
				.map(body -> ResponseEntity.ok(ApiEnvelope.ok(ModuleUrlRewriter.rewrite(body))))
				.onErrorResume(WebClientResponseException.class, e -> Mono.just(moduleError(e)))
				.onErrorResume(this::isConnectionError, e -> Mono.just(
						ResponseEntity.status(HttpStatus.BAD_GATEWAY)
								.body(ApiEnvelope.error("VCA-5020", "모듈 API에 연결할 수 없습니다"))))
				.onErrorResume(TimeoutException.class, e -> Mono.just(
						ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
								.body(ApiEnvelope.error("VCA-5040", "인물 검색 응답 시간 초과 — 기간을 줄여 다시 시도하세요"))))
				.onErrorResume(e -> {
					log.error("프록시 내부 오류: POST /persons/search", e);
					return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
							.body(ApiEnvelope.error("VCA-5000", "프록시 내부 오류")));
				});
	}

	/**
	 * Re-ID 인물 검색 중계 (계약 v1.7, UV-39). 중계 방식은 /persons/search와 동일 — 쿼리 파라미터
	 * (vipId·필터)와 multipart 본문을 파싱 없이 그대로 스트리밍하고 searchTimeout(60초)을 쓴다.
	 * vipId 참조 검색은 본문이 없을 수 있다(Content-Type null 허용).
	 */
	@PostMapping("/api/persons/reid-search")
	public Mono<ResponseEntity<ApiEnvelope>> reidSearchPersons(ServerHttpRequest request) {
		String query = request.getURI().getRawQuery();
		String uri = query == null ? "/persons/reid-search" : "/persons/reid-search?" + query;
		MediaType contentType = request.getHeaders().getContentType();

		return moduleApi.post()
				.uri(uri)
				.headers(h -> {
					if (contentType != null) h.setContentType(contentType);
					long len = request.getHeaders().getContentLength();
					if (len >= 0) h.set(HttpHeaders.CONTENT_LENGTH, Long.toString(len));
				})
				.body(BodyInserters.fromDataBuffers(request.getBody()))
				.retrieve()
				.bodyToMono(JsonNode.class)
				.timeout(props.searchTimeout())
				.map(body -> ResponseEntity.ok(ApiEnvelope.ok(ModuleUrlRewriter.rewrite(body))))
				.onErrorResume(WebClientResponseException.class, e -> Mono.just(moduleError(e)))
				.onErrorResume(this::isConnectionError, e -> Mono.just(
						ResponseEntity.status(HttpStatus.BAD_GATEWAY)
								.body(ApiEnvelope.error("VCA-5020", "모듈 API에 연결할 수 없습니다"))))
				.onErrorResume(TimeoutException.class, e -> Mono.just(
						ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
								.body(ApiEnvelope.error("VCA-5040", "Re-ID 검색 응답 시간 초과 — 기간을 줄여 다시 시도하세요"))))
				.onErrorResume(e -> {
					log.error("프록시 내부 오류: POST /persons/reid-search", e);
					return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
							.body(ApiEnvelope.error("VCA-5000", "프록시 내부 오류")));
				});
	}

	/**
	 * Track on Map 중계 (계약 v1.4). JSON 본문(대상 참조)을 그대로 전달한다 — 시간 창·유사도는
	 * 모듈 소유 정책이라 파라미터가 없다. 검색 계열이므로 searchTimeout(60초) 적용, 응답은
	 * envelope 포장 + URL 재작성(faceUrl/bodyUrl/cropUrl → /api).
	 */
	@PostMapping("/api/targets/track-on-map")
	public Mono<ResponseEntity<ApiEnvelope>> trackTargetOnMap(ServerHttpRequest request) {
		return moduleApi.post()
				.uri("/targets/track-on-map")
				.headers(h -> h.setContentType(MediaType.APPLICATION_JSON))
				.body(BodyInserters.fromDataBuffers(request.getBody()))
				.retrieve()
				.bodyToMono(JsonNode.class)
				.timeout(props.searchTimeout())
				.map(body -> ResponseEntity.ok(ApiEnvelope.ok(ModuleUrlRewriter.rewrite(body))))
				.onErrorResume(WebClientResponseException.class, e -> Mono.just(moduleError(e)))
				.onErrorResume(this::isConnectionError, e -> Mono.just(
						ResponseEntity.status(HttpStatus.BAD_GATEWAY)
								.body(ApiEnvelope.error("VCA-5020", "모듈 API에 연결할 수 없습니다"))))
				.onErrorResume(TimeoutException.class, e -> Mono.just(
						ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
								.body(ApiEnvelope.error("VCA-5040", "추적 검색 응답 시간 초과"))))
				.onErrorResume(e -> {
					log.error("프록시 내부 오류: POST /targets/track-on-map", e);
					return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
							.body(ApiEnvelope.error("VCA-5000", "프록시 내부 오류")));
				});
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
				.onErrorResume(e -> {
					// 분류 밖 예외가 원인 기록 없이 VCA-5000으로만 나가면 장애 원인을 찾을 수 없다
					log.error("프록시 내부 오류: GET /{}", path, e);
					return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
							.body(ApiEnvelope.error("VCA-5000", "프록시 내부 오류")));
				});
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
