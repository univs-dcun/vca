package ai.univs.vca.admin.server;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 인프라 노드 레지스트리 (UV-53, Portal "Server & API › Infrastructure"). Old VCA의 Associated Server가
 * 화면으로 부활한 것 — 등록 + 도달성(헬스체크) 표시. 카메라의 serverId가 여기를 가리킨다.
 * type은 기획 화면의 5값 문자열 그대로 저장.
 */
@Entity
@Table(name = "server")
public class ServerEntity {

	@Id
	@Column(length = 64)
	private String id;

	@Column(nullable = false, length = 64)
	private String projectId;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String ip;

	/** 헬스체크용 TCP 포트 — 없으면 ICMP/echo 도달성(InetAddress.isReachable) */
	private Integer port;

	/** AI Camera | Normal Camera | Face Recognition | Image Store | Database */
	@Column(nullable = false, length = 32)
	private String type;

	private String specification;

	/** success | error | unknown(미검사) */
	@Column(nullable = false, length = 16)
	private String status = "unknown";

	private Instant lastCheckedAt;

	private String lastError;

	@Column(nullable = false)
	private Instant createdAt;

	protected ServerEntity() {
	}

	public ServerEntity(String id, String projectId, String name, String ip, Integer port, String type,
			String specification) {
		this.id = id;
		this.projectId = projectId;
		this.name = name;
		this.ip = ip;
		this.port = port;
		this.type = type;
		this.specification = specification;
		this.createdAt = Instant.now();
	}

	public void update(String name, String ip, Integer port, String type, String specification) {
		this.name = name;
		this.ip = ip;
		this.port = port;
		this.type = type;
		this.specification = specification;
	}

	public void markCheck(boolean reachable, String error) {
		this.status = reachable ? "success" : "error";
		this.lastCheckedAt = Instant.now();
		this.lastError = reachable ? null : error;
	}

	public String getId() {
		return id;
	}

	public String getProjectId() {
		return projectId;
	}

	public String getName() {
		return name;
	}

	public String getIp() {
		return ip;
	}

	public Integer getPort() {
		return port;
	}

	public String getType() {
		return type;
	}

	public String getSpecification() {
		return specification;
	}

	public String getStatus() {
		return status;
	}

	public Instant getLastCheckedAt() {
		return lastCheckedAt;
	}

	public String getLastError() {
		return lastError;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
