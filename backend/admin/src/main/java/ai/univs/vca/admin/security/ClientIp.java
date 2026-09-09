package ai.univs.vca.admin.security;

import jakarta.servlet.http.HttpServletRequest;

/** 프록시(:8080)가 X-Forwarded-For에 브라우저 주소를 실어 보낸다 — 없으면 직접 연결 주소 */
public final class ClientIp {

	private ClientIp() {
	}

	public static String from(HttpServletRequest request) {
		String xff = request.getHeader("X-Forwarded-For");
		if (xff != null && !xff.isBlank()) {
			return xff.split(",")[0].trim();
		}
		return request.getRemoteAddr();
	}
}
