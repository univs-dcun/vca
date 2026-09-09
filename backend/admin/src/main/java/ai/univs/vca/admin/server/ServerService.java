package ai.univs.vca.admin.server;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.audit.AuditService;
import ai.univs.vca.admin.security.ProjectScope;
import ai.univs.vca.admin.org.ProjectRepository;
import ai.univs.vca.admin.server.ServerDtos.ServerRequest;
import ai.univs.vca.admin.server.ServerDtos.ServerResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 서버 레지스트리 + 도달성 검사 (UV-53). 검사는 port가 있으면 TCP connect(2초), 없으면 InetAddress.isReachable
 * (ICMP 또는 echo 7 — 권한/방화벽에 따라 false일 수 있어 port 지정을 권장). 60초마다 전 서버 자동 검사.
 */
@Service
public class ServerService {

	private static final Logger log = LoggerFactory.getLogger(ServerService.class);
	private static final int TIMEOUT_MS = 2000;

	private final ServerRepository servers;
	private final ProjectRepository projects;
	private final AuditService audit;
	private final SecureRandom random = new SecureRandom();

	public ServerService(ServerRepository servers, ProjectRepository projects, AuditService audit) {
		this.servers = servers;
		this.projects = projects;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public List<ServerResponse> list(String projectId) {
		java.util.Set<String> scope = ProjectScope.current().narrow(projectId);
		List<ServerEntity> rows = scope == null ? servers.findAllByOrderByNameAsc()
				: servers.findByProjectIdInOrderByNameAsc(scope);
		return rows.stream().map(ServerResponse::of).toList();
	}

	@Transactional
	public ServerResponse create(ServerRequest req) {
		validate(req, true);
		ProjectScope.current().require(req.projectId());
		byte[] suffix = new byte[2];
		random.nextBytes(suffix);
		String id = "srv-" + req.name().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "")
				+ "-" + HexFormat.of().formatHex(suffix);
		ServerEntity s = new ServerEntity(id, req.projectId(), req.name().trim(), req.ip().trim(), req.port(),
				req.type(), req.specification());
		String err = probe(s.getIp(), s.getPort());
		s.markCheck(err == null, err);
		servers.save(s);
		audit.record(s.getProjectId(), "Server " + s.getName() + " (" + s.getType() + ", " + s.getIp() + ") registered");
		return ServerResponse.of(s);
	}

	@Transactional
	public ServerResponse update(String id, ServerRequest req) {
		ServerEntity s = requireInScope(id);
		validate(req, false);
		s.update(req.name().trim(), req.ip().trim(), req.port(), req.type(), req.specification());
		String err = probe(s.getIp(), s.getPort());
		s.markCheck(err == null, err);
		audit.record(s.getProjectId(), "Server " + s.getName() + " updated");
		return ServerResponse.of(s);
	}

	@Transactional
	public void delete(String id) {
		ServerEntity s = requireInScope(id);
		servers.delete(s);
		audit.record(s.getProjectId(), "Server " + s.getName() + " removed");
	}

	@Transactional
	public ServerResponse check(String id) {
		ServerEntity s = requireInScope(id);
		String err = probe(s.getIp(), s.getPort());
		s.markCheck(err == null, err);
		return ServerResponse.of(s);
	}

	@Scheduled(fixedDelay = 60_000, initialDelay = 15_000)
	@Transactional
	public void checkAll() {
		for (ServerEntity s : servers.findAll()) {
			String err = probe(s.getIp(), s.getPort());
			s.markCheck(err == null, err);
		}
	}

	/** null = 도달 / 문자열 = 실패 사유 */
	static String probe(String ip, Integer port) {
		try {
			if (port != null && port > 0) {
				try (Socket socket = new Socket()) {
					socket.connect(new InetSocketAddress(ip, port), TIMEOUT_MS);
					return null;
				}
			}
			return InetAddress.getByName(ip).isReachable(TIMEOUT_MS) ? null : "host not reachable";
		}
		catch (IOException e) {
			return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
		}
	}

	/** 범위 밖 서버는 403 (UV-58) */
	private ServerEntity requireInScope(String id) {
		ServerEntity s = require(id);
		ProjectScope.current().require(s.getProjectId());
		return s;
	}

	private ServerEntity require(String id) {
		return servers.findById(id)
			.orElseThrow(() -> new AdminApiException(HttpStatus.NOT_FOUND, "ADM-4045", "unknown serverId: " + id));
	}

	private void validate(ServerRequest req, boolean creating) {
		if (req == null || req.name() == null || req.name().isBlank() || req.ip() == null || req.ip().isBlank()) {
			throw AdminApiException.badRequest("name and ip are required");
		}
		if (req.type() == null || !ServerDtos.TYPES.contains(req.type())) {
			throw AdminApiException.badRequest("type must be one of " + ServerDtos.TYPES);
		}
		if (creating && (req.projectId() == null || !projects.existsById(req.projectId()))) {
			throw AdminApiException.projectNotFound(req.projectId() == null ? "" : req.projectId());
		}
		if (req.port() != null && (req.port() < 1 || req.port() > 65535)) {
			throw AdminApiException.badRequest("port must be 1..65535");
		}
	}
}
