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
	/** 앱 헤더의 현장 전환용 최소 정보 (UV-52 2차) — 앱 전용 계정은 Portal API(403)로 이름을 못 받는다 */
	public record ProjectRef(String id, String name) {
	}

	public record UserProfile(Long id, String name, String email, String employeeId, String accountId, String role,
			String team, boolean mustSetPassword, String permission, boolean appAccess, boolean appSearch,
			String status, String teamId, List<String> projectIds, List<ProjectRef> projects) {

		/** projects = 앱에서 볼 수 있는 프로젝트(owner는 전체, 그 외 배정) — 이름 포함. UV-58 ProjectScope 규칙과 동일 */
		static UserProfile of(UserAccountEntity u, List<ProjectRef> projects) {
			return new UserProfile(u.getId(), u.getName(), u.getEmail(), u.getEmployeeId(), u.getAccountId(),
					u.getRole(), u.getTeam(), u.isMustSetPassword(), u.getPermission().json(), u.isAppAccess(),
					u.isAppSearch(), u.getStatus().json(), u.getTeamId(), List.copyOf(u.getProjectIds()), projects);
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

	// ---- 등록 코드 / 초대 / self-signup (UV-51) ----

	public record CodeLookupRequest(String code) {
	}

	/**
	 * 코드 조회 결과 — 누구의 코드인지 화면이 확인시킨다. kind: roster(명부 → 신규 계정) | setup(기존 계정 활성화).
	 * permission은 명부의 2값 언어(admin|operator)로 붕괴 — 프론트 register 화면과 동일
	 */
	public record CodeLookupResponse(String kind, String name, String employeeId, String permission,
			String projectId, String projectName) {
	}

	public record RegisterRequest(String code, String password) {
	}

	public record InviteRedeemRequest(String token, String password) {
	}

	/** 조직 자체 생성 마법사(account → team) — selfSignup=true이고 owner가 없을 때만 */
	public record SignupRequest(String name, String email, String password, String teamName, String region) {
	}

	/** 셋업 코드 발급 응답 — code는 이 응답에서 단 한 번만 노출 (표시 XXXX-XXXX, 14일) */
	public record IssuedCode(Long userId, String code, String codeFormatted, java.time.Instant issuedAt,
			java.time.Instant expiresAt) {
	}

	/** 초대 토큰 발급 응답 — token은 이 응답에서 단 한 번만 노출 (/password-setup?token=, 7일, single-use) */
	public record IssuedInvite(Long userId, String token, java.time.Instant issuedAt, java.time.Instant expiresAt) {
	}

	// ---- 셀프 재설정 (이메일 코드) / 세션 (UV-56) ----

	public record ResetRequest(String identifier) {
	}

	/** 존재 여부와 무관하게 같은 응답 — 화면이 인쇄하는 숫자(재발송 3회·10분·쿨다운 30초)를 서버 값으로 */
	public record ResetRequestResponse(String delivery, int resendLimit, int ttlMinutes, int resendCooldownSec) {
	}

	public record ResetVerifyRequest(String identifier, String code) {
	}

	/** 검증 통과 — 단기 토큰(10분)을 완료 단계로. URL에 실리지 않는다 */
	public record ResetVerifyResponse(String resetToken, int ttlMinutes) {
	}

	public record ResetCompleteRequest(String resetToken, String newPassword) {
	}

	/** My Page "Active login sessions" 행 — id는 세션 해시(토큰을 역산할 수 없다) */
	public record SessionRow(String id, boolean current, java.time.Instant createdAt, java.time.Instant lastSeenAt,
			java.time.Instant expiresAt, boolean keepLoggedIn, String userAgent, String ip) {
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
