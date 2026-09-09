package ai.univs.vca.admin.org;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 조직(고객사) — Portal 최상위 스코프 (design-vca-portal.md §3.1). 프로젝트·계정·로스터가 이 아래에 속한다 */
@Entity
@Table(name = "team")
public class TeamEntity {

	@Id
	@Column(length = 64)
	private String id;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String region;

	/** 계정이 사는 메일 도메인 (예: company.local) — 메일 없는 회사는 null */
	private String mailDomain;

	@Embedded
	private MailConfig smtp;

	/** 공급사(우리) 측 계약 담당자 — 고객이 편집하는 값이 아니다 (License 화면이 "Change plan" 대신 내놓는 사람) */
	private String accountManagerName;

	private String accountManagerEmail;

	@Column(nullable = false)
	private Instant createdAt;

	protected TeamEntity() {
	}

	public TeamEntity(String id, String name, String region, String mailDomain, MailConfig smtp,
			String accountManagerName, String accountManagerEmail) {
		this.id = id;
		this.name = name;
		this.region = region;
		this.mailDomain = mailDomain;
		this.smtp = smtp;
		this.accountManagerName = accountManagerName;
		this.accountManagerEmail = accountManagerEmail;
		this.createdAt = Instant.now();
	}

	public void update(String name, String region, String accountManagerName, String accountManagerEmail) {
		this.name = name;
		this.region = region;
		this.accountManagerName = accountManagerName;
		this.accountManagerEmail = accountManagerEmail;
	}

	public void updateMail(String mailDomain, MailConfig smtp) {
		this.mailDomain = mailDomain;
		this.smtp = smtp;
	}

	public String getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public String getRegion() {
		return region;
	}

	public String getMailDomain() {
		return mailDomain;
	}

	public MailConfig getSmtp() {
		return smtp;
	}

	public String getAccountManagerName() {
		return accountManagerName;
	}

	public String getAccountManagerEmail() {
		return accountManagerEmail;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
