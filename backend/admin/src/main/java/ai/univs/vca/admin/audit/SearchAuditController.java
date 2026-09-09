package ai.univs.vca.admin.audit;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.audit.SearchAuditService.SearchAuditRequest;
import ai.univs.vca.admin.auth.AuthController;
import ai.univs.vca.admin.auth.AuthService;
import ai.univs.vca.admin.security.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인물 검색 감사 (UV-59).
 *
 *   POST /audit/search          — 프록시 전용 기록 엔드포인트. /admin/api 게이트 밖이라 콘솔 역할이 없는 앱 전용 계정도
 *                                 행위자가 될 수 있다(세션 쿠키 필수, 없으면 401). 프록시는 이 경로를 브라우저에 열지 않는다
 *                                 (PortalProxyController는 /api/portal/** → /admin/api/** 만) — 배포에서 Admin 포트는 내부망 전용.
 *   GET  /admin/api/search-audit — Portal 조회. 세션 게이트 + ProjectScope.
 */
@RestController
public class SearchAuditController {

	private final SearchAuditService service;
	private final AuthService auth;

	public SearchAuditController(SearchAuditService service, AuthService auth) {
		this.service = service;
		this.auth = auth;
	}

	@PostMapping("/audit/search")
	public ApiEnvelope record(@CookieValue(name = AuthController.SESSION_COOKIE, required = false) String token,
			@RequestBody SearchAuditRequest body, HttpServletRequest request) {
		return ApiEnvelope.ok(service.record(auth.resolveSession(token), body, ClientIp.from(request)));
	}

	@GetMapping("/admin/api/search-audit")
	public ApiEnvelope recent(@RequestParam(required = false) String projectId,
			@RequestParam(defaultValue = "50") int limit) {
		return ApiEnvelope.ok(service.recent(projectId, limit));
	}
}
