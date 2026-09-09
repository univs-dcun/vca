package ai.univs.vca.proxy;

import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

/**
 * Admin 백엔드 패스스루 (UV-47 auth → UV-50 Portal 공용).
 *
 * 모듈 중계(ProxyController)와 규칙이 다르다:
 *   1. Admin 응답은 이미 공통 envelope — 재포장 없이 상태·본문 그대로 전달
 *   2. 세션 쿠키(vca_session, httpOnly)가 요청 Cookie / 응답 Set-Cookie로 양방향 통과해야 한다
 *   3. 연결 실패 502 VCA-5021 / 타임아웃 504 VCA-5041 — 모듈 계열(5020/5040)과 구분되는 코드로,
 *      화면이 "Admin 미가동(개발 폴백)"과 "자격증명/권한 오류"를 구분할 수 있게 한다
 */
@Component
public class AdminForwarder {

	private static final Logger log = LoggerFactory.getLogger(AdminForwarder.class);

	private final WebClient adminApi;
	private final AdminApiProperties props;

	public AdminForwarder(WebClient adminApiClient, AdminApiProperties props) {
		this.adminApi = adminApiClient;
		this.props = props;
	}

	/** @param pathWithQuery Admin 측 경로(쿼리 포함 가능, 예 "/admin/api/projects?teamId=x") */
	public Mono<ResponseEntity<String>> forward(HttpMethod method, String pathWithQuery, ServerHttpRequest request,
			String body) {
		WebClient.RequestBodySpec spec = adminApi.method(method)
			.uri(pathWithQuery)
			.headers(h -> {
				// 세션 쿠키 전달 — 그 외 브라우저 헤더는 중계하지 않는다
				String cookie = request.getHeaders().getFirst(HttpHeaders.COOKIE);
				if (cookie != null) {
					h.set(HttpHeaders.COOKIE, cookie);
				}
				// 브라우저 주소 — Admin의 주소 단위 시도 스로틀(등록 코드) 키 (UV-51)
				if (request.getRemoteAddress() != null && request.getRemoteAddress().getAddress() != null) {
					h.set("X-Forwarded-For", request.getRemoteAddress().getAddress().getHostAddress());
				}
			});
		WebClient.RequestHeadersSpec<?> withBody = body != null
				? spec.contentType(MediaType.APPLICATION_JSON).bodyValue(body)
				: spec;
		return withBody.exchangeToMono(res -> res.bodyToMono(String.class)
			.defaultIfEmpty("")
			.map(b -> {
				HttpHeaders headers = new HttpHeaders();
				headers.setContentType(MediaType.APPLICATION_JSON);
				// Set-Cookie(로그인 발급·로그아웃 파기)를 브라우저까지 그대로 전달
				res.headers().header(HttpHeaders.SET_COOKIE)
					.forEach(v -> headers.add(HttpHeaders.SET_COOKIE, v));
				return ResponseEntity.status(res.statusCode()).headers(headers).body(b);
			}))
			.timeout(props.timeout())
			.onErrorResume(WebClientRequestException.class, e -> {
				log.warn("admin upstream unreachable: {}", e.getMessage());
				return Mono.just(ResponseEntity.status(502)
					.contentType(MediaType.APPLICATION_JSON)
					.body("{\"success\":false,\"code\":\"VCA-5021\",\"message\":\"admin server unreachable\",\"data\":null}"));
			})
			.onErrorResume(TimeoutException.class, e -> Mono.just(ResponseEntity.status(504)
				.contentType(MediaType.APPLICATION_JSON)
				.body("{\"success\":false,\"code\":\"VCA-5041\",\"message\":\"admin server timeout\",\"data\":null}")));
	}
}
