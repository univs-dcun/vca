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
 * 인물 검색 감사 기록 (UV-59) — 앱의 RedMap·Re-ID·Track on Map·RedFace 호출을 프록시가 보고, Admin이 적재한다.
 * 이 제품에서 가장 침습적인 동작이라 "누가·언제·무엇으로 찾았나"를 남긴다. 대상 이미지는 해시만(원본 미보관),
 * 보관은 기본 1년(SearchAuditService.purge). 운영 감사 로그(audit_event)와는 성격이 달라 테이블을 분리했다.
 */
@Entity
@Table(name = "search_audit", indexes = { @Index(name = "ix_search_audit_project_at", columnList = "projectId, at"),
		@Index(name = "ix_search_audit_at", columnList = "at") })
public class SearchAuditEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Instant at;

	@Column(nullable = false)
	private Long userId;

	@Column(nullable = false)
	private String userName;

	@Column(nullable = false, length = 64)
	private String accountId;

	@Column(length = 64)
	private String projectId;

	@Column(nullable = false, length = 32)
	private String feature;

	@Column(nullable = false, length = 128)
	private String endpoint;

	@Column(length = 4000)
	private String criteria;

	@Column(length = 64)
	private String imageSha256;

	private Long imageBytes;

	@Column(nullable = false)
	private int imageCount;

	private Integer resultCount;

	private Integer durationMs;

	@Column(nullable = false, length = 16)
	private String status;

	@Column(length = 32)
	private String errorCode;

	@Column(length = 64)
	private String ip;

	protected SearchAuditEntity() {
	}

	public SearchAuditEntity(Long userId, String userName, String accountId, String projectId, String feature,
			String endpoint, String criteria, String imageSha256, Long imageBytes, int imageCount, Integer resultCount,
			Integer durationMs, String status, String errorCode, String ip) {
		this.at = Instant.now();
		this.userId = userId;
		this.userName = userName;
		this.accountId = accountId;
		this.projectId = projectId;
		this.feature = feature;
		this.endpoint = endpoint;
		this.criteria = criteria;
		this.imageSha256 = imageSha256;
		this.imageBytes = imageBytes;
		this.imageCount = imageCount;
		this.resultCount = resultCount;
		this.durationMs = durationMs;
		this.status = status;
		this.errorCode = errorCode;
		this.ip = ip;
	}

	public Long getId() { return id; }
	public Instant getAt() { return at; }
	public Long getUserId() { return userId; }
	public String getUserName() { return userName; }
	public String getAccountId() { return accountId; }
	public String getProjectId() { return projectId; }
	public String getFeature() { return feature; }
	public String getEndpoint() { return endpoint; }
	public String getCriteria() { return criteria; }
	public String getImageSha256() { return imageSha256; }
	public Long getImageBytes() { return imageBytes; }
	public int getImageCount() { return imageCount; }
	public Integer getResultCount() { return resultCount; }
	public Integer getDurationMs() { return durationMs; }
	public String getStatus() { return status; }
	public String getErrorCode() { return errorCode; }
	public String getIp() { return ip; }
}
