package ai.univs.vca.proxy;

import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * /api/auth/** → Admin 백엔드 /auth/** 패스스루 (UV-47). 명시 라우트만 연다 — 인증 계약(openapi.json
 * auth 그룹)에 있는 5+1종. 전달 규칙은 AdminForwarder 참조.
 */
@RestController
public class AuthProxyController {

	private final AdminForwarder forwarder;

	public AuthProxyController(AdminForwarder forwarder) {
		this.forwarder = forwarder;
	}

	@PostMapping("/api/auth/login")
	public Mono<ResponseEntity<String>> login(ServerHttpRequest request, @RequestBody String body) {
		return forwarder.forward(HttpMethod.POST, "/auth/login", request, body);
	}

	@PostMapping("/api/auth/logout")
	public Mono<ResponseEntity<String>> logout(ServerHttpRequest request) {
		return forwarder.forward(HttpMethod.POST, "/auth/logout", request, null);
	}

	@GetMapping("/api/auth/me")
	public Mono<ResponseEntity<String>> me(ServerHttpRequest request) {
		return forwarder.forward(HttpMethod.GET, "/auth/me", request, null);
	}

	@PostMapping("/api/auth/password/setup")
	public Mono<ResponseEntity<String>> setupPassword(ServerHttpRequest request, @RequestBody String body) {
		return forwarder.forward(HttpMethod.POST, "/auth/password/setup", request, body);
	}

	@PostMapping("/api/auth/password/verify")
	public Mono<ResponseEntity<String>> verifyPassword(ServerHttpRequest request, @RequestBody String body) {
		return forwarder.forward(HttpMethod.POST, "/auth/password/verify", request, body);
	}

	@PostMapping("/api/auth/password")
	public Mono<ResponseEntity<String>> changePassword(ServerHttpRequest request, @RequestBody String body) {
		return forwarder.forward(HttpMethod.POST, "/auth/password", request, body);
	}
}
