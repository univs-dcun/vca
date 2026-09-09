package ai.univs.vca.admin.security;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.auth.AuthController;
import ai.univs.vca.admin.auth.AuthService;
import ai.univs.vca.admin.auth.UserAccountEntity;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Admin API(/admin/api/**) 게이트 (UV-50) — "진짜 문은 서버가 role none에게 Portal 엔드포인트를
 * 거절하는 것" (기획자 코드 주석, design-vca-portal.md §2).
 *
 *   세션 없음/만료           → 401 ADM-4011
 *   콘솔 역할 없음(none)     → 403 ADM-4030 (읽기 포함)
 *   변경(GET/HEAD/OPTIONS 외) → owner|admin 필요
 *   @RequiresOwner           → owner 필요 (접근 권한 관리)
 *
 * /auth/** 는 이 게이트 밖(로그인 자체가 거기). 통과 시 CurrentUser에 사용자를 심어 감사 actor로 쓴다.
 */
@Component
public class SessionInterceptor implements HandlerInterceptor {

	private final AuthService authService;

	public SessionInterceptor(AuthService authService) {
		this.authService = authService;
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
			return true;
		}
		UserAccountEntity user = authService.resolveSession(sessionToken(request));
		if (!user.getPermission().canEnterPortal()) {
			throw AdminApiException.forbidden("portal access requires a console role");
		}
		boolean read = "GET".equalsIgnoreCase(request.getMethod()) || "HEAD".equalsIgnoreCase(request.getMethod());
		if (!read && !user.getPermission().canEditPortal()) {
			throw AdminApiException.forbidden("read-only role cannot modify");
		}
		if (handler instanceof HandlerMethod hm && hm.hasMethodAnnotation(RequiresOwner.class)
				&& !user.getPermission().canManageAccess()) {
			throw AdminApiException.forbidden("access management requires owner");
		}
		CurrentUser.set(user);
		return true;
	}

	@Override
	public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
			Exception ex) {
		CurrentUser.clear();
	}

	private static String sessionToken(HttpServletRequest request) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return null;
		}
		for (Cookie c : cookies) {
			if (AuthController.SESSION_COOKIE.equals(c.getName())) {
				return c.getValue();
			}
		}
		return null;
	}
}
