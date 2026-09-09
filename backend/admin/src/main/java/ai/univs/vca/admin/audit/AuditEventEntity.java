package ai.univs.vca.admin.audit;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * 감사 이벤트 (UV-50) — Portal Overview "Recent admin activity" 피드 + 변경 추적.
 * 기획자 mock은 12개 액션의 기록이 누락돼 있지만 서버는 모든 변경 엔드포인트를 기록한다.
 * projectId가 null이면 프로젝트에 묶이지 않는 변경(계정 권한 등).
 */
@Entity
@Table(name = "audit_event", indexes = @Index(name = "ix_audit_project_at", columnList = "projectId, at"))
public class AuditEventEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(length = 64)
	private String projectId;

	/** 행위자 계정 — 시더 등 시스템 작업이면 null */
	private Long actorUserId;

	@Column(nullable = false)
	private String actorName;

	@Column(nullable = false, length = 512)
	private String message;

	@Column(nullable = false)
	private Instant at;

	protected AuditEventEntity() {
	}

	public AuditEventEntity(String projectId, Long actorUserId, String actorName, String message) {
		this.projectId = projectId;
		this.actorUserId = actorUserId;
		this.actorName = actorName;
		this.message = message;
		this.at = Instant.now();
	}

	public Long getId() {
		return id;
	}

	public String getProjectId() {
		return projectId;
	}

	public Long getActorUserId() {
		return actorUserId;
	}

	public String getActorName() {
		return actorName;
	}

	public String getMessage() {
		return message;
	}

	public Instant getAt() {
		return at;
	}
}
