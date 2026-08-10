package ai.univs.vca.proxy;

import tools.jackson.databind.JsonNode;

/** 공개 계약(openapi.json)의 응답 envelope — { success, code, message, data } */
public record ApiEnvelope(boolean success, String code, String message, JsonNode data) {

	public static ApiEnvelope ok(JsonNode data) {
		return new ApiEnvelope(true, "OK", null, data);
	}

	public static ApiEnvelope error(String code, String message) {
		return new ApiEnvelope(false, code, message, null);
	}
}
