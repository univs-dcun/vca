package ai.univs.vca.admin.auth;

import java.time.Duration;

import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.auth.AuthDtos.LoginRequest;
import ai.univs.vca.admin.auth.AuthDtos.PasswordChangeRequest;
import ai.univs.vca.admin.auth.AuthDtos.PasswordVerifyRequest;
import ai.univs.vca.admin.auth.AuthService.LoginResult;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 API (UV-47) — 브라우저는 프록시 경유(/api/auth/** → 여기 /auth/**)로 호출한다.
 * 세션은 httpOnly 쿠키(vca_session) — JS에서 읽을 수 없고, 동일 오리진 프록시 체인을
 * 그대로 오간다. 응답은 Admin 공통 envelope.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

	public static final String SESSION_COOKIE = "vca_session";

	private final AuthService service;
	private final AdminProperties props;

	public AuthController(AuthService service, AdminProperties props) {
		this.service = service;
		this.props = props;
	}

	@PostMapping("/login")
	public ResponseEntity<ApiEnvelope> login(@RequestBody LoginRequest request) {
		boolean keep = Boolean.TRUE.equals(request.keepLoggedIn());
		LoginResult result = service.login(request.email(), request.password(), keep);
		// keepLoggedIn 미체크 시 Max-Age 없는 브라우저 세션 쿠키 (서버 만료 12h는 별도로 걸려 있다)
		ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from(SESSION_COOKIE, result.token())
			.httpOnly(true)
			.secure(props.sessionCookieSecure())
			.sameSite("Lax")
			.path("/");
		if (keep) {
			cookie.maxAge(AuthService.SESSION_TTL_KEEP);
		}
		return ResponseEntity.ok()
			.header(HttpHeaders.SET_COOKIE, cookie.build().toString())
			.body(ApiEnvelope.ok(result.profile()));
	}

	@GetMapping("/me")
	public ApiEnvelope me(@CookieValue(name = SESSION_COOKIE, required = false) String token) {
		return ApiEnvelope.ok(service.me(token));
	}

	@PostMapping("/logout")
	public ResponseEntity<ApiEnvelope> logout(@CookieValue(name = SESSION_COOKIE, required = false) String token) {
		service.logout(token);
		ResponseCookie expired = ResponseCookie.from(SESSION_COOKIE, "")
			.httpOnly(true)
			.secure(props.sessionCookieSecure())
			.sameSite("Lax")
			.path("/")
			.maxAge(Duration.ZERO)
			.build();
		return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, expired.toString()).body(ApiEnvelope.ok(null));
	}

	/** My Page 비밀번호 변경 모달의 1단계(현재 비밀번호 확인) — 변경 없이 검증만 */
	@PostMapping("/password/verify")
	public ApiEnvelope verifyPassword(@CookieValue(name = SESSION_COOKIE, required = false) String token,
			@RequestBody PasswordVerifyRequest request) {
		service.verifyPassword(token, request.currentPassword());
		return ApiEnvelope.ok(null);
	}

	@PostMapping("/password")
	public ApiEnvelope changePassword(@CookieValue(name = SESSION_COOKIE, required = false) String token,
			@RequestBody PasswordChangeRequest request) {
		service.changePassword(token, request.currentPassword(), request.newPassword());
		return ApiEnvelope.ok(null);
	}
}
