package ai.univs.vca.admin.server;

import java.time.Instant;
import java.util.Set;

public final class ServerDtos {

	private ServerDtos() {
	}

	public static final Set<String> TYPES = Set.of("AI Camera", "Normal Camera", "Face Recognition", "Image Store",
			"Database");

	public record ServerRequest(String projectId, String name, String ip, Integer port, String type,
			String specification) {
	}

	public record ServerResponse(String id, String projectId, String name, String ip, Integer port, String type,
			String specification, String status, Instant lastCheckedAt, String lastError, Instant createdAt) {

		static ServerResponse of(ServerEntity s) {
			return new ServerResponse(s.getId(), s.getProjectId(), s.getName(), s.getIp(), s.getPort(), s.getType(),
					s.getSpecification(), s.getStatus(), s.getLastCheckedAt(), s.getLastError(), s.getCreatedAt());
		}
	}
}
