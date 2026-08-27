package ai.univs.vca.admin.camera;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 카메라 원장 (docs/design-vca-admin.md §6.1) — Old VCA Add New Camera 폼 기준, Source Type·Associated Server 제외(확정 2026-08-27) */
@Entity
@Table(name = "camera")
public class CameraEntity {

	@Id
	@Column(length = 64)
	private String cameraId;

	@Column(nullable = false)
	private String name;

	private String ip;

	private String maker;

	private String model;

	private String username;

	/** AES-GCM 암호문 (CredentialCipher) — 평문은 저장·응답 어디에도 없다 */
	@Column(length = 512)
	private String passwordEnc;

	/** 분석 입력 스트림 — 자격증명이 포함될 수 있어 VCA 공개 계약에는 노출 금지 (Admin·모듈 내부 채널 전용) */
	@Column(nullable = false, length = 512)
	private String rtspUrl;

	@Column(nullable = false, length = 64)
	private String locationId;

	@Column(nullable = false)
	private double lat;

	@Column(nullable = false)
	private double lng;

	@Column(nullable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	protected CameraEntity() {
	}

	public CameraEntity(String cameraId, String name, String ip, String maker, String model, String username,
			String passwordEnc, String rtspUrl, String locationId, double lat, double lng) {
		this.cameraId = cameraId;
		this.name = name;
		this.ip = ip;
		this.maker = maker;
		this.model = model;
		this.username = username;
		this.passwordEnc = passwordEnc;
		this.rtspUrl = rtspUrl;
		this.locationId = locationId;
		this.lat = lat;
		this.lng = lng;
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	public void update(String name, String ip, String maker, String model, String username, String passwordEnc,
			String rtspUrl, String locationId, double lat, double lng) {
		this.name = name;
		this.ip = ip;
		this.maker = maker;
		this.model = model;
		this.username = username;
		if (passwordEnc != null) { // password 생략 시 기존 값 유지 (쓰기 전용 필드)
			this.passwordEnc = passwordEnc;
		}
		this.rtspUrl = rtspUrl;
		this.locationId = locationId;
		this.lat = lat;
		this.lng = lng;
		this.updatedAt = Instant.now();
	}

	public String getCameraId() {
		return cameraId;
	}

	public String getName() {
		return name;
	}

	public String getIp() {
		return ip;
	}

	public String getMaker() {
		return maker;
	}

	public String getModel() {
		return model;
	}

	public String getUsername() {
		return username;
	}

	public String getPasswordEnc() {
		return passwordEnc;
	}

	public String getRtspUrl() {
		return rtspUrl;
	}

	public String getLocationId() {
		return locationId;
	}

	public double getLat() {
		return lat;
	}

	public double getLng() {
		return lng;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
