package ai.univs.vca.admin;

/** 플랫폼 공통 응답 envelope — { success, code, message, data } (루트 CLAUDE.md 응답 포맷) */
public record ApiEnvelope(boolean success, String code, String message, Object data) {

	public static ApiEnvelope ok(Object data) {
		return new ApiEnvelope(true, "OK", null, data);
	}

	public static ApiEnvelope error(String code, String message) {
		return new ApiEnvelope(false, code, message, null);
	}
}
