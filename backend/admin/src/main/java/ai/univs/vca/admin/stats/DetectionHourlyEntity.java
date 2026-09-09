package ai.univs.vca.admin.stats;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 감지 시간별 집계 (UV-56) — 모듈 MQTT `cameras/{id}/detections`를 Admin이 구독해 카메라×UTC 시각(hour) 버킷으로
 * 카운트. Portal Overview "Detections · last 7 days"의 원천 — 모듈 계약 무변경(발행분 적재, 설계 §5.1 (b)안).
 * 일 단위는 조회 시 프로젝트 시간대로 접는다 (시간 경계 존은 정확, 30분 경계 존은 ±30분 오차 — 허용).
 */
@Entity
@Table(name = "detection_hourly", uniqueConstraints = @UniqueConstraint(columnNames = { "cameraId", "hourUtc" }))
public class DetectionHourlyEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 64)
	private String cameraId;

	@Column(nullable = false)
	private Instant hourUtc;

	@Column(nullable = false)
	private int total;

	@Column(nullable = false)
	private int vip;

	@Column(nullable = false)
	private int vehicle;

	/** total - vip - vehicle (staff/unauthorized/unknown/false_positive) */
	@Column(nullable = false)
	private int unknown;

	protected DetectionHourlyEntity() {
	}

	public DetectionHourlyEntity(String cameraId, Instant hourUtc) {
		this.cameraId = cameraId;
		this.hourUtc = hourUtc;
	}

	public void add(int total, int vip, int vehicle, int unknown) {
		this.total += total;
		this.vip += vip;
		this.vehicle += vehicle;
		this.unknown += unknown;
	}

	public String getCameraId() {
		return cameraId;
	}

	public Instant getHourUtc() {
		return hourUtc;
	}

	public int getTotal() {
		return total;
	}

	public int getVip() {
		return vip;
	}

	public int getVehicle() {
		return vehicle;
	}

	public int getUnknown() {
		return unknown;
	}
}
