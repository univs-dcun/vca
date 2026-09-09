package ai.univs.vca.admin.camera;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 카메라 원장 (docs/design-vca-admin.md §6.1 → design-vca-portal.md §3.2 확장, UV-53).
 * Old VCA Add New Camera 폼 기준 + Portal Input Sources 화면 필드(code·mac·resolution·protocol·zone·
 * location·serverId·aiFeatures). Source Type·Associated Server 제외(2026-08-27 확정)였으나 Portal
 * "Server & API" 화면으로 서버 배정(serverId)이 부활 — 카메라를 처리하는 인프라 노드 참조.
 * 상태(online/offline)는 원장 컬럼이 아니다 — 모듈 MQTT status를 적재한 CameraStatusService가 답한다.
 */
@Entity
@Table(name = "camera")
public class CameraEntity {

	@Id
	@Column(length = 64)
	private String cameraId;

	/** 소속 프로젝트 — 기존 행은 null로 들어오고 시더가 기본 프로젝트에 귀속 */
	@Column(length = 64)
	private String projectId;

	/** 화면 표시 코드 (CAM-BDK-001) — 앱 전체 공용 표시 id, cameraId(내부 키)와 별개 */
	@Column(length = 32)
	private String code;

	@Column(nullable = false)
	private String name;

	private String ip;

	private String mac;

	private String maker;

	private String model;

	private String resolution;

	/** TCP | UDP — 장식용(분기 없음), 기획 화면 표시 */
	@Column(length = 8)
	private String protocol;

	private String username;

	/** AES-GCM 암호문 (CredentialCipher) — 평문은 저장·응답 어디에도 없다 */
	@Column(length = 512)
	private String passwordEnc;

	/** 분석 입력 스트림 — 자격증명이 포함될 수 있어 VCA 공개 계약에는 노출 금지 (Admin·모듈 내부 채널 + Portal 관리자 화면) */
	@Column(nullable = false, length = 512)
	private String rtspUrl;

	@Column(nullable = false, length = 64)
	private String locationId;

	/** 구역명(Bedok, Marina Bay) — 기본 name */
	private String zone;

	/** 설치 위치 설명(Control Room, Singapore) */
	private String location;

	@Column(nullable = false)
	private double lat;

	@Column(nullable = false)
	private double lng;

	/** 이 카메라를 처리하는 서버(server.id) — 없으면 미배정 */
	@Column(length = 64)
	private String serverId;

	/** 매핑된 AI 기능 — 쉼표 구분 ("Re-ID Analysis,License Plate Recognition") */
	@Column(length = 256)
	private String aiFeatures;

	@Column(length = 512)
	private String thumbnail;

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
		this.zone = name;
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

	/** Portal 확장 필드 (UV-53) — null은 "변경 없음"이 아니라 값 그대로 저장(zone만 비면 name 유지) */
	public void applyPortalFields(String projectId, String code, String mac, String resolution, String protocol,
			String zone, String location, String serverId, String aiFeatures, String thumbnail) {
		if (projectId != null) {
			this.projectId = projectId;
		}
		if (code != null) {
			this.code = code;
		}
		this.mac = mac;
		this.resolution = resolution;
		this.protocol = protocol;
		this.zone = zone == null || zone.isBlank() ? this.name : zone;
		this.location = location;
		this.serverId = serverId;
		this.aiFeatures = aiFeatures;
		this.thumbnail = thumbnail;
		this.updatedAt = Instant.now();
	}

	public void setZone(String zone) {
		this.zone = zone;
		this.updatedAt = Instant.now();
	}

	public void setProjectId(String projectId) {
		this.projectId = projectId;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public String getCameraId() {
		return cameraId;
	}

	public String getProjectId() {
		return projectId;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public String getIp() {
		return ip;
	}

	public String getMac() {
		return mac;
	}

	public String getMaker() {
		return maker;
	}

	public String getModel() {
		return model;
	}

	public String getResolution() {
		return resolution;
	}

	public String getProtocol() {
		return protocol;
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

	public String getZone() {
		return zone;
	}

	public String getLocation() {
		return location;
	}

	public double getLat() {
		return lat;
	}

	public double getLng() {
		return lng;
	}

	public String getServerId() {
		return serverId;
	}

	public String getAiFeatures() {
		return aiFeatures;
	}

	public String getThumbnail() {
		return thumbnail;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
