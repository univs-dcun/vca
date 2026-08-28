package ai.univs.vca.proxy;

import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

/**
 * /api/auth/** → Admin 백엔드 /auth/** 패스스루 (UV-47).
 *
 * 모듈 중계(ProxyController)와 규칙이 다르다:
 *   1. Admin 응답은 이미 공통 envelope — 재포장 없이 상태·본문 그대로 전달
 *   2. 세션 쿠키(vca_session, httpOnly)가 요청 Cookie / 응답 Set-Cookie로 양방향 통과해야 한다
 *   3. 연결 실패 502 VCA-5021 / 타임아웃 504 VCA-5041 — 모듈 계열(5020/5040)과 구분되는 코드로,
 *      화면이 "인증 서버 미가동(개발 폴백)"과 "자격증명 오류"를 구분할 수 있게 한다
 */
@RestController
public class AuthProxyController {

	private static final Logger log = LoggerFactory.getLogger(AuthProxyController.class);

	private final WebClient adminApi;
	private final AdminApiProperties props;

	public AuthProxyController(WebClient adminApiClient, AdminApiProperties props) {
		this.adminApi = adminApiClient;
		this.props = props;
	}

	@PostMapping("/api/auth/login")
	public Mono<ResponseEntity<String>> login(ServerHttpRequest request, @RequestBody String body) {
		return forward(HttpMethod.POST, "/auth/login", request, body);
	}

	@PostMapping("/api/auth/logout")
	public Mono<ResponseEntity<String>> logout(ServerHttpRequest request) {
		return forward(HttpMethod.POST, "/auth/logout", request, null);
	}

	@GetMapping("/api/auth/me")
	public Mono<ResponseEntity<String>> me(ServerHttpRequest request) {
		return forward(HttpMethod.GET, "/auth/me", request, null);
	}

	@PostMapping("/api/auth/password/verify")
	public Mono<ResponseEntity<String>> verifyPassword(ServerHttpRequest request, @RequestBody String body) {
		return forward(HttpMethod.POST, "/auth/password/verify", request, body);
	}

	@PostMapping("/api/auth/password")
	public Mono<ResponseEntity<String>> changePassword(ServerHttpRequest request, @RequestBody String body) {
		return forward(HttpMethod.POST, "/auth/password", request, body);
	}

	private Mono<ResponseEntity<String>> forward(HttpMethod method, String path, ServerHttpRequest request,
			String body) {
		WebClient.RequestBodySpec spec = adminApi.method(method)
			.uri(path)
			.headers(h -> {
				// 세션 쿠키 전달 — 그 외 브라우저 헤더는 중계하지 않는다
				String cookie = request.getHeaders().getFirst(HttpHeaders.COOKIE);
				if (cookie != null) {
					h.set(HttpHeaders.COOKIE, cookie);
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
				log.warn("auth upstream unreachable: {}", e.getMessage());
				return Mono.just(ResponseEntity.status(502)
					.contentType(MediaType.APPLICATION_JSON)
					.body("{\"success\":false,\"code\":\"VCA-5021\",\"message\":\"auth server unreachable\",\"data\":null}"));
			})
			.onErrorResume(TimeoutException.class, e -> Mono.just(ResponseEntity.status(504)
				.contentType(MediaType.APPLICATION_JSON)
				.body("{\"success\":false,\"code\":\"VCA-5041\",\"message\":\"auth server timeout\",\"data\":null}")));
	}
}
