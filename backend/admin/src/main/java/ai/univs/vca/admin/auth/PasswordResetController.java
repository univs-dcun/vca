package ai.univs.vca.admin.auth;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.auth.AuthDtos.ResetCompleteRequest;
import ai.univs.vca.admin.auth.AuthDtos.ResetRequest;
import ai.univs.vca.admin.auth.AuthDtos.ResetVerifyRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 셀프 비밀번호 재설정 — 이메일 코드 (UV-56). 비로그인, 세션 게이트 밖 */
@RestController
@RequestMapping("/auth/password/reset")
public class PasswordResetController {

	private final PasswordResetService service;

	public PasswordResetController(PasswordResetService service) {
		this.service = service;
	}

	/** 코드 발송(재발송 겸용) — 계정 존재 여부와 무관하게 200. SMTP 없으면 409 ADM-4029(adminOnly) */
	@PostMapping("/request")
	public ApiEnvelope request(@RequestBody ResetRequest req) {
		return ApiEnvelope.ok(service.request(req.identifier()));
	}

	/** 코드 검증 → 단기 토큰. wrong ADM-4025 / expired 4026 / throttled 4027 */
	@PostMapping("/verify")
	public ApiEnvelope verify(@RequestBody ResetVerifyRequest req) {
		return ApiEnvelope.ok(service.verify(req.identifier(), req.code()));
	}

	/** 새 비밀번호 — 전 세션 무효화 */
	@PostMapping("/complete")
	public ApiEnvelope complete(@RequestBody ResetCompleteRequest req) {
		service.complete(req.resetToken(), req.newPassword());
		return ApiEnvelope.ok(null);
	}
}
