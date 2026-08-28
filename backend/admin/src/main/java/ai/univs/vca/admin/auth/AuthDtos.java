package ai.univs.vca.admin.auth;

/** 인증 계약 DTO (openapi/admin-api.json auth 그룹, UV-47) */
public final class AuthDtos {

	private AuthDtos() {
	}

	public record LoginRequest(String email, String password, Boolean keepLoggedIn) {
	}

	public record PasswordVerifyRequest(String currentPassword) {
	}

	public record PasswordChangeRequest(String currentPassword, String newPassword) {
	}

	/** 첫 로그인 Set Password (UV-48) — 임시 비밀번호 상태의 세션만 허용, 현재 비밀번호 불요 */
	public record PasswordSetupRequest(String newPassword) {
	}

	/** 화면 프로필 (My Page·Navbar) — 민감 필드 없음. mustSetPassword=true면 화면이 Set Password를 강제 */
	public record UserProfile(String name, String email, String accountId, String role, String team,
			boolean mustSetPassword) {

		static UserProfile of(UserAccountEntity u) {
			return new UserProfile(u.getName(), u.getEmail(), u.getAccountId(), u.getRole(), u.getTeam(),
					u.isMustSetPassword());
		}
	}

	/** 담당자용 계정 생성 (UV-48) — accountId 생략 시 자동 발급, role/team 생략 시 빈 값 */
	public record CreateUserRequest(String email, String name, String accountId, String role, String team) {
	}

	/** 생성/재발급 응답 — tempPassword는 이 응답에서 단 한 번만 노출된다 (DB에는 해시만) */
	public record IssuedUser(Long id, String email, String name, String accountId, String tempPassword) {
	}

	/** 담당자용 목록 행 — 전달 후 상태 확인용 */
	public record UserRow(Long id, String email, String name, String accountId, String role, String team,
			boolean mustSetPassword, java.time.Instant lastLoginAt) {

		static UserRow of(UserAccountEntity u) {
			return new UserRow(u.getId(), u.getEmail(), u.getName(), u.getAccountId(), u.getRole(), u.getTeam(),
					u.isMustSetPassword(), u.getLastLoginAt());
		}
	}
}
