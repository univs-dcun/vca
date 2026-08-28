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

	/** 화면 프로필 (My Page·Navbar) — 민감 필드 없음 */
	public record UserProfile(String name, String email, String accountId, String role, String team) {

		static UserProfile of(UserAccountEntity u) {
			return new UserProfile(u.getName(), u.getEmail(), u.getAccountId(), u.getRole(), u.getTeam());
		}
	}
}
