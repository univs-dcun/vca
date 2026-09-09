package ai.univs.vca.admin.auth;

import java.time.Instant;
import java.util.List;

/** 인증·계정 계약 DTO (openapi/admin-api.json auth·users 그룹, UV-47/48/50) */
public final class AuthDtos {

	private AuthDtos() {
	}

	/**
	 * identifier = 이메일 또는 사번 (기획자 로그인 화면). email은 UV-47 호환 필드 — identifier가 없으면 사용.
	 * keepLoggedIn은 계약에 남기되 화면은 보내지 않는다(공유 워크스테이션 — 식별자 기억으로 의미 변경).
	 */
	public record LoginRequest(String identifier, String email, String password, Boolean keepLoggedIn) {

		public String resolvedIdentifier() {
			return identifier != null && !identifier.isBlank() ? identifier : email;
		}
	}

	public record PasswordVerifyRequest(String currentPassword) {
	}

	public record PasswordChangeRequest(String currentPassword, String newPassword) {
	}

	/** 첫 로그인 Set Password (UV-48) — 임시 비밀번호 상태의 세션만 허용, 현재 비밀번호 불요 */
	public record PasswordSetupRequest(String newPassword) {
	}

	/**
	 * 화면 프로필 (My Page·Navbar·Portal 셸) — 민감 필드 없음.
	 * permission/appAccess/appSearch/status/teamId/projectIds는 기획자 스탠드인(currentPortalRole,
	 * projectsVisibleInApp, canSearchInApp)이 세션에서 읽어야 하는 값 — 이 응답 하나로 답한다.
	 */
	public record UserProfile(Long id, String name, String email, String employeeId, String accountId, String role,
			String team, boolean mustSetPassword, String permission, boolean appAccess, boolean appSearch,
			String status, String teamId, List<String> projectIds) {

		static UserProfile of(UserAccountEntity u) {
			return new UserProfile(u.getId(), u.getName(), u.getEmail(), u.getEmployeeId(), u.getAccountId(),
					u.getRole(), u.getTeam(), u.isMustSetPassword(), u.getPermission().json(), u.isAppAccess(),
					u.isAppSearch(), u.getStatus().json(), u.getTeamId(), List.copyOf(u.getProjectIds()));
		}
	}

	/**
	 * 담당자용 계정 생성 (UV-48 → UV-50) — email 또는 employeeId 중 하나 필수. permission 기본 none,
	 * appAccess 기본 true(콘솔 역할 없으면 앱 사용자). 콘솔 역할도 앱 접근도 없는 계정은 거부.
	 */
	public record CreateUserRequest(String email, String employeeId, String name, String accountId, String role,
			String team, String permission, Boolean appAccess, Boolean appSearch, String teamId,
			List<String> projectIds) {
	}

	public record AccessUpdateRequest(String permission, Boolean appAccess) {
	}

	public record AppSearchRequest(Boolean allowed) {
	}

	public record ProjectsUpdateRequest(List<String> projectIds) {
	}

	public record StatusUpdateRequest(String status) {
	}

	/** 생성/재발급 응답 — tempPassword는 이 응답에서 단 한 번만 노출된다 (DB에는 해시만) */
	public record IssuedUser(Long id, String email, String employeeId, String name, String accountId,
			String tempPassword) {
	}

	/** 담당자용 목록 행 — Portal Users & Permissions 계정 탭 */
	public record UserRow(Long id, String email, String employeeId, String name, String accountId, String role,
			String team, String permission, boolean appAccess, boolean appSearch, String status, String teamId,
			List<String> projectIds, boolean mustSetPassword, Instant lastLoginAt, Instant createdAt) {

		static UserRow of(UserAccountEntity u) {
			return new UserRow(u.getId(), u.getEmail(), u.getEmployeeId(), u.getName(), u.getAccountId(),
					u.getRole(), u.getTeam(), u.getPermission().json(), u.isAppAccess(), u.isAppSearch(),
					u.getStatus().json(), u.getTeamId(), List.copyOf(u.getProjectIds()), u.isMustSetPassword(),
					u.getLastLoginAt(), u.getCreatedAt());
		}
	}
}
