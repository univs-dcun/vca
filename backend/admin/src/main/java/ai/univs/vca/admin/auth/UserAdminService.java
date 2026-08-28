package ai.univs.vca.admin.auth;

import java.security.SecureRandom;
import java.util.List;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.auth.AuthDtos.CreateUserRequest;
import ai.univs.vca.admin.auth.AuthDtos.IssuedUser;
import ai.univs.vca.admin.auth.AuthDtos.UserRow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 담당자용 계정 발급 (UV-48). 기획 확정: 사용자는 직접 가입하지 않고, 담당자가 계정 + 임시
 * 비밀번호를 발급해 오프라인으로 전달한다 (메일 발송이 불가한 환경 대응). 발급 화면은
 * Admin(portal) 서비스 소관 — 여기는 그 화면이 호출할 API.
 *
 * 임시 비밀번호는 서버가 생성해 발급 응답에서 단 한 번만 노출된다 — DB에는 BCrypt 해시만
 * 남으므로 이후에는 재발급 외에 복구 수단이 없다.
 */
@Service
public class UserAdminService {

	/** 형식 규칙(8자+영문+숫자+특수문자)을 항상 만족하도록 그룹별로 뽑는다 */
	private static final String LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
	private static final String DIGITS = "23456789";
	private static final String SPECIALS = "!@#$%^*-_";
	private static final int TEMP_PASSWORD_LENGTH = 12;

	private final UserAccountRepository users;
	private final UserSessionRepository sessions;
	private final AuthService authService;
	private final SecureRandom random = new SecureRandom();

	public UserAdminService(UserAccountRepository users, UserSessionRepository sessions, AuthService authService) {
		this.users = users;
		this.sessions = sessions;
		this.authService = authService;
	}

	@Transactional
	public IssuedUser create(CreateUserRequest request) {
		if (request.email() == null || request.email().isBlank() || request.name() == null
				|| request.name().isBlank()) {
			throw AdminApiException.badRequest("email and name are required");
		}
		String email = request.email().trim().toLowerCase();
		if (users.findByEmail(email).isPresent()) {
			throw AdminApiException.emailInUse(email);
		}
		String tempPassword = generateTempPassword();
		String tempPasswordHash = authService.encode(tempPassword);
		String accountId = request.accountId() != null && !request.accountId().isBlank()
				? request.accountId().trim()
				: "VCA-OPS-" + (1000 + random.nextInt(9000));
		UserAccountEntity user = new UserAccountEntity(email, request.name().trim(), tempPasswordHash, accountId,
				request.role() == null ? "" : request.role().trim(),
				request.team() == null ? "" : request.team().trim());
		user.issueTemporaryPassword(tempPasswordHash); // mustSetPassword = true
		users.save(user);
		return new IssuedUser(user.getId(), user.getEmail(), user.getName(), user.getAccountId(), tempPassword);
	}

	/** 비밀번호 분실 대응 — 새 임시 비밀번호 발급 + 기존 세션 전부 무효화 + Set Password 강제 복귀 */
	@Transactional
	public IssuedUser resetPassword(Long userId) {
		UserAccountEntity user = users.findById(userId)
			.orElseThrow(() -> AdminApiException.userNotFound(userId));
		String tempPassword = generateTempPassword();
		user.issueTemporaryPassword(authService.encode(tempPassword));
		sessions.deleteOtherSessions(user.getId(), ""); // keepTokenHash 불일치 → 전 세션 삭제
		return new IssuedUser(user.getId(), user.getEmail(), user.getName(), user.getAccountId(), tempPassword);
	}

	@Transactional(readOnly = true)
	public List<UserRow> list() {
		return users.findAll().stream().map(UserRow::of).toList();
	}

	private String generateTempPassword() {
		StringBuilder sb = new StringBuilder(TEMP_PASSWORD_LENGTH);
		sb.append(pick(LETTERS)).append(pick(DIGITS)).append(pick(SPECIALS));
		String all = LETTERS + DIGITS + SPECIALS;
		while (sb.length() < TEMP_PASSWORD_LENGTH) {
			sb.append(pick(all));
		}
		// 그룹 보장 3자가 항상 앞에 오지 않도록 섞는다
		char[] chars = sb.toString().toCharArray();
		for (int i = chars.length - 1; i > 0; i--) {
			int j = random.nextInt(i + 1);
			char tmp = chars[i];
			chars[i] = chars[j];
			chars[j] = tmp;
		}
		return new String(chars);
	}

	private char pick(String pool) {
		return pool.charAt(random.nextInt(pool.length()));
	}
}
