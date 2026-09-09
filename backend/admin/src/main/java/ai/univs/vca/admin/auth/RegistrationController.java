package ai.univs.vca.admin.auth;

import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.auth.AuthDtos.CodeLookupRequest;
import ai.univs.vca.admin.auth.AuthDtos.InviteRedeemRequest;
import ai.univs.vca.admin.auth.AuthDtos.RegisterRequest;
import ai.univs.vca.admin.auth.AuthDtos.SignupRequest;
import ai.univs.vca.admin.auth.AuthService.LoginResult;
import ai.univs.vca.admin.security.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 비로그인 활성화 경로 (UV-51) — /auth 아래, 세션 게이트 밖. 성공 시 로그인과 같은 세션 쿠키 발급 */
@RestController
@RequestMapping("/auth")
public class RegistrationController {

	private final RegistrationService service;
	private final AdminProperties props;

	public RegistrationController(RegistrationService service, AdminProperties props) {
		this.service = service;
		this.props = props;
	}

	/** 코드 조회 — 누구의 코드인지 확인 화면용. 실패는 IP 카운트(5회 → throttled) */
	@PostMapping("/register/lookup")
	public ApiEnvelope lookup(@RequestBody CodeLookupRequest req, HttpServletRequest http) {
		return ApiEnvelope.ok(service.lookup(req.code(), ClientIp.from(http)));
	}

	/** 활성화 — 코드 소각 + 계정 + 비밀번호 + 세션, 단일 트랜잭션 */
	@PostMapping("/register")
	public ResponseEntity<ApiEnvelope> register(@RequestBody RegisterRequest req, HttpServletRequest http) {
		return withSession(service.register(req.code(), req.password(), ClientIp.from(http)));
	}

	/** 초대 링크(/password-setup?token=) 완료 */
	@PostMapping("/invite/redeem")
	public ResponseEntity<ApiEnvelope> redeemInvite(@RequestBody InviteRedeemRequest req) {
		return withSession(service.redeemInvite(req.token(), req.password()));
	}

	/** 조직 자체 생성 — 온프레미스는 항상 403 ADM-4032 (화면이 숨겨도 서버가 닫는다) */
	@PostMapping("/signup")
	public ResponseEntity<ApiEnvelope> signup(@RequestBody SignupRequest req) {
		return withSession(service.signup(req));
	}

	private ResponseEntity<ApiEnvelope> withSession(LoginResult result) {
		ResponseCookie cookie = ResponseCookie.from(AuthController.SESSION_COOKIE, result.token())
			.httpOnly(true)
			.secure(props.sessionCookieSecure())
			.sameSite("Lax")
			.path("/")
			.build();
		return ResponseEntity.ok()
			.header(HttpHeaders.SET_COOKIE, cookie.toString())
			.body(ApiEnvelope.ok(result.profile()));
	}
}
