package ai.univs.vca.proxy;

import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * /api/portal/** → Admin /admin/api/** 범용 패스스루 (UV-50, design-vca-portal.md §2.1).
 * 메서드·하위 경로·쿼리·JSON 본문·Cookie를 그대로 전달한다. 인증·역할 판정은 Admin의
 * SessionInterceptor 몫 — 프록시는 게이트가 아니다. 멀티파트(업로드)는 W6에서 별도 라우트.
 */
@RestController
public class PortalProxyController {

	private static final String PREFIX = "/api/portal";

	private final AdminForwarder forwarder;

	public PortalProxyController(AdminForwarder forwarder) {
		this.forwarder = forwarder;
	}

	@RequestMapping(PREFIX + "/**")
	public Mono<ResponseEntity<String>> forward(ServerHttpRequest request,
			@RequestBody(required = false) String body) {
		String path = request.getPath().pathWithinApplication().value();
		String suffix = path.startsWith(PREFIX) ? path.substring(PREFIX.length()) : path;
		String query = request.getURI().getRawQuery();
		String target = "/admin/api" + suffix + (query == null || query.isEmpty() ? "" : "?" + query);
		HttpMethod method = request.getMethod();
		return forwarder.forward(method, target, request, body);
	}
}
