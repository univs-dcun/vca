package ai.univs.vca.admin;

import org.springframework.http.HttpStatus;

/**
 * 오류 코드 체계 — 프록시의 VCA-XXXX와 구분되는 Admin 대역:
 * ADM-4001(본문 검증), ADM-4040(카메라 없음),
 * ADM-4010(자격증명 불일치), ADM-4011(세션 없음/만료), ADM-4012(현재 비밀번호 불일치)
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
		return new AdminApiException(HttpStatus.UNAUTHORIZED, "ADM-4010", "invalid email or password");
	}

	public static AdminApiException sessionRequired() {
		return new AdminApiException(HttpStatus.UNAUTHORIZED, "ADM-4011", "session missing or expired");
	}

	public static AdminApiException wrongCurrentPassword() {
		return new AdminApiException(HttpStatus.BAD_REQUEST, "ADM-4012", "current password does not match");
	}

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}
}
