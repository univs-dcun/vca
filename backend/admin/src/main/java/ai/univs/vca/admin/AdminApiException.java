package ai.univs.vca.admin;

import org.springframework.http.HttpStatus;

/** 오류 코드 체계: ADM-4001(본문 검증), ADM-4040(카메라 없음) — 프록시의 VCA-XXXX와 구분되는 Admin 대역 */
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

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}
}
