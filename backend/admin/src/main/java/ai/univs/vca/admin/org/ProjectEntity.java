package ai.univs.vca.admin.org;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 프로젝트(사이트) — 카메라·VIP·서버·업로드의 스코프 (design-vca-portal.md §3.1).
 * 라이선스는 별도 테이블 없이 인라인(기획자 mock과 동일): 채널 사용량은 카메라 수로 파생한다.
 * 시각 규칙: 저장은 UTC, 읽을 때 timeZone으로 해석.
 */
@Entity
@Table(name = "project")
public class ProjectEntity {

	public enum Type {
		SMART_CITY, SMART_SCHOOL;

		public String json() {
			return name().toLowerCase();
		}

		public static Type fromJson(String v) {
			return v == null ? null : valueOf(v.trim().toUpperCase());
		}
	}

	@Id
	@Column(length = 64)
	private String id;

	@Column(nullable = false, length = 64)
	private String teamId;

	@Column(nullable = false)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private Type type;

	/** IANA 존 — 사이트는 위치가 있고 계정은 없다 */
	@Column(nullable = false, length = 64)
	private String timeZone;

	/** Starter | Professional | Enterprise */
	private String licensePlan;

	/** AI/일반 카메라 공용 단일 채널 풀 */
	private Integer licenseChannelLimit;

	/** null = Unlimited */
	private LocalDate licenseExpiresAt;

	/** 팀 설정을 이 프로젝트만 오버라이드 */
	private String mailDomain;

	@Embedded
	private MailConfig smtp;

	/** 서버가 ping으로 감지한 값 (W4) */
	@Column(nullable = false, columnDefinition = "boolean not null default false")
	private boolean networkIsolatedDetected;

	/** 관리자 수동 오버라이드 — null이면 자동 감지값 사용 */
	private Boolean networkIsolatedOverride;

	private String computeInstance;

	private Integer gpuCount;

	private String modelVersion;

	private String regionName;

	@Column(nullable = false)
	private Instant createdAt;

	protected ProjectEntity() {
	}

	public ProjectEntity(String id, String teamId, String name, Type type, String timeZone) {
		this.id = id;
		this.teamId = teamId;
		this.name = name;
		this.type = type;
		this.timeZone = timeZone;
		this.createdAt = Instant.now();
	}

	public void update(String name, Type type, String computeInstance, Integer gpuCount, String modelVersion,
			String regionName) {
		this.name = name;
		this.type = type;
		this.computeInstance = computeInstance;
		this.gpuCount = gpuCount;
		this.modelVersion = modelVersion;
		this.regionName = regionName;
	}

	public void updateLicense(String plan, Integer channelLimit, LocalDate expiresAt) {
		this.licensePlan = plan;
		this.licenseChannelLimit = channelLimit;
		this.licenseExpiresAt = expiresAt;
	}

	public void updateMail(String mailDomain, MailConfig smtp) {
		this.mailDomain = mailDomain;
		this.smtp = smtp;
	}

	public void setTimeZone(String timeZone) {
		this.timeZone = timeZone;
	}

	public void setNetworkIsolatedOverride(Boolean override) {
		this.networkIsolatedOverride = override;
	}

	/** 우선순위 로직 1곳 — 오버라이드가 있으면 그것, 없으면 감지값 */
	public boolean isNetworkIsolated() {
		return networkIsolatedOverride != null ? networkIsolatedOverride : networkIsolatedDetected;
	}

	public String getId() {
		return id;
	}

	public String getTeamId() {
		return teamId;
	}

	public String getName() {
		return name;
	}

	public Type getType() {
		return type;
	}

	public String getTimeZone() {
		return timeZone;
	}

	public String getLicensePlan() {
		return licensePlan;
	}

	public Integer getLicenseChannelLimit() {
		return licenseChannelLimit;
	}

	public LocalDate getLicenseExpiresAt() {
		return licenseExpiresAt;
	}

	public String getMailDomain() {
		return mailDomain;
	}

	public MailConfig getSmtp() {
		return smtp;
	}

	public boolean isNetworkIsolatedDetected() {
		return networkIsolatedDetected;
	}

	public Boolean getNetworkIsolatedOverride() {
		return networkIsolatedOverride;
	}

	public String getComputeInstance() {
		return computeInstance;
	}

	public Integer getGpuCount() {
		return gpuCount;
	}

	public String getModelVersion() {
		return modelVersion;
	}

	public String getRegionName() {
		return regionName;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
