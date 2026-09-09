package ai.univs.vca.admin.auth;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.audit.AuditService;
import ai.univs.vca.admin.auth.AuthDtos.ResetRequestResponse;
import ai.univs.vca.admin.auth.AuthDtos.ResetVerifyResponse;
import ai.univs.vca.admin.mail.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 셀프 비밀번호 재설정 — 이메일 코드 (UV-56, 기획자 forgot-password 9 상태 이행).
 *
 *   request  → 계정 존재 여부와 무관하게 200 (열거 방지). SMTP 없으면 409 ADM-4029(adminOnly — 관리자 수교 경로)
 *   verify   → wrong(ADM-4025, 5회 후 throttled ADM-4027) / expired(ADM-4026) / 성공 시 단기 토큰
 *   complete → 토큰 + 새 비밀번호 → 변경, 전 세션 무효화
 *   resend   → 3회 한도(ADM-4028), 30초 쿨다운(ADM-4027)
 *
 * 숫자(10분·5회·3회·30초·8자리)는 프론트 화면 인쇄값과 동일 (design-vca-portal.md §4.5).
 */
@Service
public class PasswordResetService {

	private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

	private final UserAccountRepository users;
	private final PasswordResetRepository resets;
	private final UserSessionRepository sessions;
	private final AuthService authService;
	private final MailService mail;
	private final AuditService audit;
	private final SecureRandom random = new SecureRandom();

	public PasswordResetService(UserAccountRepository users, PasswordResetRepository resets,
			UserSessionRepository sessions, AuthService authService, MailService mail, AuditService audit) {
		this.users = users;
		this.resets = resets;
		this.sessions = sessions;
		this.authService = authService;
		this.mail = mail;
		this.audit = audit;
	}

	@Transactional
	public ResetRequestResponse request(String identifier) {
		Optional<UserAccountEntity> found = identifier == null ? Optional.empty()
				: authService.findByIdentifier(identifier);
		ResetRequestResponse generic = new ResetRequestResponse("email", PasswordResetEntity.MAX_RESENDS,
				(int) PasswordResetEntity.CODE_TTL.toMinutes(), (int) PasswordResetEntity.RESEND_COOLDOWN.toSeconds());
		if (found.isEmpty()) {
			return generic; // 존재 비노출
		}
		UserAccountEntity user = found.get();
		if (!mail.canSendTo(user)) {
			throw new AdminApiException(HttpStatus.CONFLICT, "ADM-4029",
					"email reset unavailable — ask an administrator for a temporary password");
		}
		Optional<PasswordResetEntity> existing = resets.findByUserId(user.getId());
		String code = newCode();
		if (existing.isPresent() && !existing.get().isExpired()) {
			PasswordResetEntity r = existing.get();
			if (!r.canResend()) {
				throw new AdminApiException(HttpStatus.TOO_MANY_REQUESTS, "ADM-4028", "resend limit reached");
			}
			if (r.inCooldown()) {
				throw new AdminApiException(HttpStatus.TOO_MANY_REQUESTS, "ADM-4027", "please wait before resending");
			}
			r.resend(Hashes.sha256("reset:" + code));
		}
		else {
			existing.ifPresent(resets::delete);
			resets.save(new PasswordResetEntity(user.getId(), Hashes.sha256("reset:" + code)));
		}
		try {
			mail.send(user, "VCA password reset code",
					"Your VCA password reset code is " + code + ".\nIt expires in "
							+ PasswordResetEntity.CODE_TTL.toMinutes() + " minutes. If you did not request this, ignore this mail.");
		}
		catch (Exception e) {
			log.warn("재설정 코드 메일 발송 실패 user={}: {}", user.getId(), e.getMessage());
			throw new AdminApiException(HttpStatus.BAD_GATEWAY, "ADM-5021", "mail delivery failed");
		}
		audit.recordAs(null, user.getId(), user.getName(), "Password reset code requested by " + user.getName());
		return generic;
	}

	/** noRollbackFor — 오답 예외로 롤백되면 attempts가 저장되지 않아 스로틀이 무력화된다 */
	@Transactional(noRollbackFor = AdminApiException.class)
	public ResetVerifyResponse verify(String identifier, String code) {
		UserAccountEntity user = identifier == null ? null : authService.findByIdentifier(identifier).orElse(null);
		PasswordResetEntity r = user == null ? null : resets.findByUserId(user.getId()).orElse(null);
		if (r == null) {
			throw new AdminApiException(HttpStatus.BAD_REQUEST, "ADM-4025", "wrong code");
		}
		if (r.isThrottled()) {
			throw new AdminApiException(HttpStatus.TOO_MANY_REQUESTS, "ADM-4027", "too many attempts — request a new code");
		}
		if (r.isExpired()) {
			throw new AdminApiException(HttpStatus.GONE, "ADM-4026", "code expired");
		}
		String normalized = code == null ? "" : code.replaceAll("[^0-9]", "");
		if (!Hashes.sha256("reset:" + normalized).equals(r.getCodeHash())) {
			r.recordAttempt();
			if (r.isThrottled()) {
				throw new AdminApiException(HttpStatus.TOO_MANY_REQUESTS, "ADM-4027", "too many attempts — request a new code");
			}
			throw new AdminApiException(HttpStatus.BAD_REQUEST, "ADM-4025", "wrong code");
		}
		byte[] raw = new byte[24];
		random.nextBytes(raw);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
		r.markVerified(Hashes.sha256("reset-token:" + token));
		return new ResetVerifyResponse(token, (int) PasswordResetEntity.VERIFIED_TOKEN_TTL.toMinutes());
	}

	@Transactional
	public void complete(String resetToken, String newPassword) {
		PasswordResetEntity r = resetToken == null ? null
				: resets.findByVerifiedTokenHash(Hashes.sha256("reset-token:" + resetToken.trim())).orElse(null);
		if (r == null || !r.verifiedTokenValid()) {
			throw new AdminApiException(HttpStatus.GONE, "ADM-4026", "reset session expired — start again");
		}
		AuthService.validateFormat(newPassword);
		UserAccountEntity user = users.findById(r.getUserId()).orElseThrow(() -> AdminApiException.userNotFound(r.getUserId()));
		user.changePassword(authService.encode(newPassword));
		sessions.deleteOtherSessions(user.getId(), "");
		resets.delete(r);
		audit.recordAs(null, user.getId(), user.getName(), user.getName() + " reset password via email code");
	}

	private String newCode() {
		return String.format("%08d", random.nextInt(100_000_000));
	}
}
