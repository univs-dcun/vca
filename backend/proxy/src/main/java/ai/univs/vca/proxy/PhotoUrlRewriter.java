package ai.univs.vca.proxy;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 모듈 API 응답의 photoUrl(모듈 기준 상대경로 /vips/{id}/photo)을
 * 브라우저 기준 경로(/api/vips/{id}/photo)로 재작성한다. — module-api.json Vip.photoUrl 계약
 */
final class PhotoUrlRewriter {

	private static final String FIELD = "photoUrl";

	private PhotoUrlRewriter() {}

	static JsonNode rewrite(JsonNode node) {
		if (node instanceof ObjectNode obj) {
			JsonNode url = obj.get(FIELD);
			if (url != null && url.isString() && url.asString().startsWith("/") && !url.asString().startsWith("/api/")) {
				obj.put(FIELD, "/api" + url.asString());
			}
		}
		for (JsonNode child : node) {
			rewrite(child);
		}
		return node;
	}
}
