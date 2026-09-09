package ai.univs.vca.admin.status;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * 카메라 상태 전이 이력 (UV-53) — 모듈 MQTT `cameras/{id}/status`(RUNNING|STOPPED)를 Admin이 구독해
 * 상태가 바뀔 때만 한 줄 적재. Portal Overview의 카메라 안정도("이번 주 N번째 끊김")와 연결 집계의 원천.
 * 모듈 계약은 변경 없음 — 발행분을 적재하는 것뿐 (design-vca-portal.md §1.1 중간 지대).
 */
@Entity
@Table(name = "camera_status_history", indexes = @Index(name = "ix_cam_status_cam_at", columnList = "cameraId, at"))
public class CameraStatusHistoryEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 64)
	private String cameraId;

	/** online | offline | error (error는 예약 — 현 모듈 계약은 RUNNING/STOPPED 2값) */
	@Column(nullable = false, length = 16)
	private String status;

	/** 모듈이 실은 ts (없으면 수신 시각) */
	@Column(nullable = false)
	private Instant at;

	protected CameraStatusHistoryEntity() {
	}

	public CameraStatusHistoryEntity(String cameraId, String status, Instant at) {
		this.cameraId = cameraId;
		this.status = status;
		this.at = at;
	}

	public Long getId() {
		return id;
	}

	public String getCameraId() {
		return cameraId;
	}

	public String getStatus() {
		return status;
	}

	public Instant getAt() {
		return at;
	}
}
