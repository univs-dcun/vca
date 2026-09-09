package ai.univs.vca.admin;

import org.springframework.http.HttpStatus;

/**
 * 오류 코드 체계 — 프록시의 VCA-XXXX와 구분되는 Admin 대역:
 * ADM-4001(본문 검증), ADM-4040(카메라 없음), ADM-4041(사용자 없음), ADM-4042(팀 없음), ADM-4043(프로젝트 없음),
 * ADM-4010(자격증명 불일치), ADM-4011(세션 없음/만료), ADM-4012(현재 비밀번호 불일치),
 * ADM-4013(이미 본인 비밀번호 설정됨), ADM-4015(잠금), ADM-4016(정지 계정), ADM-4017(미활성 계정),
 * ADM-4018(승인 대기), ADM-4019(임시 비밀번호 만료),
 * ADM-4020~4023(등록 코드 unknown/used/expired/throttled), ADM-4024(초대 토큰 무효),
 * ADM-4030(역할 부족), ADM-4031(last-owner 가드), ADM-4032(self-signup 불가),
 * ADM-4090(이메일 중복), ADM-4091(사번 중복)
 *
 * 로그인 실패 7종은 기획자 프론트 authErrors.ts의 상태와 1:1 (design-vca-portal.md §4.1).
 */
public class AdminApiException extends RuntimeException {

	private final HttpStatus status;
	private final String code;

	public AdminApiException(HttpStatus status, String code, String message) {
		super(message);
		this.status = status;
		this.code = code;
	}

	public static AdminApiException badRequest(String message) {
		return new AdminApiException(HttpStatus.BAD_REQUEST, "ADM-4001", message);
	}

	public static AdminApiException cameraNotFound(String cameraId) {
		return new AdminApiException(HttpStatus.NOT_FOUND, "ADM-4040", "unknown cameraId: " + cameraId);
	}

	/** 이메일 없음/비밀번호 불일치를 구분하지 않는다 — 계정 존재 여부를 노출하지 않기 위해 */
	public static AdminApiException invalidCredentials() {
		return new AdminApiException(HttpStatus.UNAUTHORIZED, "ADM-4010", "invalid credentials");
	}

	public static AdminApiException sessionRequired() {
		return new AdminApiException(HttpStatus.UNAUTHORIZED, "ADM-4011", "session missing or expired");
	}

	public static AdminApiException wrongCurrentPassword() {
		return new AdminApiException(HttpStatus.BAD_REQUEST, "ADM-4012", "current password does not match");
	}

	/** Set Password는 임시 비밀번호 상태에서만 — 이미 본인 비밀번호가 있으면 변경(/auth/password)을 쓴다 */
	public static AdminApiException passwordAlreadySet() {
		return new AdminApiException(HttpStatus.BAD_REQUEST, "ADM-4013", "password already set — use password change");
	}

	public static AdminApiException accountLocked() {
		return new AdminApiException(HttpStatus.LOCKED, "ADM-4015", "account locked after repeated failures");
	}

	public static AdminApiException accountSuspended() {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4016", "account suspended");
	}

	public static AdminApiException accountNotActivated() {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4017", "account not activated — set a password first");
	}

	public static AdminApiException pendingApproval() {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4018", "access request pending approval");
	}

	/** 임시 비밀번호 24h 초과 — 담당자 재발급 필요 */
	public static AdminApiException tempPasswordExpired() {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4019", "temporary password expired — ask for a new one");
	}

	// ---- 등록 코드 (프론트 CODE_ERRORS unknown/used/expired + throttled) ----

	public static AdminApiException codeUnknown() {
		return new AdminApiException(HttpStatus.NOT_FOUND, "ADM-4020", "unknown registration code");
	}

	public static AdminApiException codeUsed() {
		return new AdminApiException(HttpStatus.CONFLICT, "ADM-4021", "registration code already used");
	}

	public static AdminApiException codeExpired() {
		return new AdminApiException(HttpStatus.GONE, "ADM-4022", "registration code expired");
	}

	public static AdminApiException codeThrottled() {
		return new AdminApiException(HttpStatus.TOO_MANY_REQUESTS, "ADM-4023", "too many attempts — try again later");
	}

	public static AdminApiException inviteInvalid() {
		return new AdminApiException(HttpStatus.GONE, "ADM-4024", "invite link is invalid or expired");
	}

	/** 온프레미스: 조직 자체 생성 없음. 최상위 관리자가 이미 있으면 플래그와 무관하게 거절 */
	public static AdminApiException selfSignupDisabled() {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4032", "self-signup is not available on this installation");
	}

	public static AdminApiException forbidden(String message) {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4030", message);
	}

	/** 활성 owner가 0명이 되는 변경 — 아무도 권한을 줄 수 없는 설치가 된다 */
	/** 프로젝트 범위 밖 (UV-58) — 역할 없음(4030)과 구분. 존재 여부를 흘리지 않기 위해 404가 아니라 403 */
	public static AdminApiException projectForbidden(String projectId) {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4033",
				"project is outside your scope" + (projectId == null ? "" : ": " + projectId));
	}

	public static AdminApiException teamForbidden(String teamId) {
		return new AdminApiException(HttpStatus.FORBIDDEN, "ADM-4033",
				"team is outside your scope" + (teamId == null ? "" : ": " + teamId));
	}

	public static AdminApiException lastOwner() {
		return new AdminApiException(HttpStatus.CONFLICT, "ADM-4031", "cannot remove the last active owner");
	}

	public static AdminApiException userNotFound(Long userId) {
		return new AdminApiException(HttpStatus.NOT_FOUND, "ADM-4041", "unknown userId: " + userId);
	}

	public static AdminApiException teamNotFound(String teamId) {
		return new AdminApiException(HttpStatus.NOT_FOUND, "ADM-4042", "unknown teamId: " + teamId);
	}

	public static AdminApiException projectNotFound(String projectId) {
		return new AdminApiException(HttpStatus.NOT_FOUND, "ADM-4043", "unknown projectId: " + projectId);
	}

	public static AdminApiException emailInUse(String email) {
		return new AdminApiException(HttpStatus.CONFLICT, "ADM-4090", "email already in use: " + email);
	}

	public static AdminApiException employeeIdInUse(String employeeId) {
		return new AdminApiException(HttpStatus.CONFLICT, "ADM-4091", "employeeId already in use: " + employeeId);
	}

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}
}
