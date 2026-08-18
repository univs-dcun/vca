package ai.univs.vca.proxy;

import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 모듈 API 응답의 리소스 URL(모듈 기준 상대경로)을 브라우저 기준 경로(/api/...)로 재작성한다.
 *   - photoUrl    /vips/{id}/photo               — module-api.json Vip.photoUrl 계약
 *   - snapshotUrl /detections/{eventId}/snapshot — openapi DetectionEventRow 계약 (BEST FRAME, UV-33)
 *   - imageUrl    /cameras/{id}/frames/{frameId} — REST 응답에 실릴 경우 대비 (bestframe 메타는 MQTT라
 *                                                   모듈이 /api/ 경로로 직접 발행한다, SPEC §3.5)
 */
final class ModuleUrlRewriter {

	private static final Set<String> FIELDS = Set.of("photoUrl", "snapshotUrl", "imageUrl");

	private ModuleUrlRewriter() {}

	static JsonNode rewrite(JsonNode node) {
		if (node instanceof ObjectNode obj) {
			for (String field : FIELDS) {
				JsonNode url = obj.get(field);
				if (url != null && url.isString() && url.asString().startsWith("/") && !url.asString().startsWith("/api/")) {
					obj.put(field, "/api" + url.asString());
				}
			}
		}
		for (JsonNode child : node) {
			rewrite(child);
		}
		return node;
	}
}
