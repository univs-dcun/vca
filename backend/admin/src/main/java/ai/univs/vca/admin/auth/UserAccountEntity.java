package ai.univs.vca.admin.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * VCA 운영자 계정 원장 (UV-47). 프로필 필드(accountId/role/team)는 My Page 화면 표시 항목 —
 * 계정 관리 화면이 생기기 전까지는 시드/DB 직접 수정으로 관리한다.
 */
@Entity
@Table(name = "user_account")
public class UserAccountEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** 로그인 식별자 — 소문자 정규화 저장 */
	@Column(nullable = false, unique = true)
	private String email;

	@Column(nullable = false)
	private String name;

	/** BCrypt 해시 — 평문은 저장·응답 어디에도 없다 */
	@Column(nullable = false, length = 128)
	private String passwordHash;

	/** 화면 표시용 계정 ID (예: VCA-ADMIN-8821) */
	@Column(nullable = false, unique = true, length = 64)
	private String accountId;

	@Column(nullable = false)
	private String role;

	@Column(nullable = false)
	private String team;

	/**
	 * 임시 비밀번호 상태 (UV-48) — 담당자가 발급한 계정은 true로 시작하고, 사용자가 첫 로그인 후
	 * Set Password를 마치면 false. true인 세션은 화면 가드가 /password-setup으로 강제한다.
	 * columnDefinition의 default는 기존 행(UV-47 시드)에 대한 ddl-auto update 대비.
	 */
	@Column(nullable = false, columnDefinition = "boolean not null default false")
	private boolean mustSetPassword;

	@Column(nullable = false)
	private Instant createdAt;

	private Instant lastLoginAt;

	protected UserAccountEntity() {
	}

	public UserAccountEntity(String email, String name, String passwordHash, String accountId, String role,
			String team) {
		this.email = email;
		this.name = name;
		this.passwordHash = passwordHash;
		this.accountId = accountId;
		this.role = role;
		this.team = team;
		this.createdAt = Instant.now();
	}

	public void changePassword(String passwordHash) {
		this.passwordHash = passwordHash;
		this.mustSetPassword = false;
	}

	/** 담당자 발급/재발급 — 임시 비밀번호로 교체하고 Set Password 강제 상태로 되돌린다 */
	public void issueTemporaryPassword(String passwordHash) {
		this.passwordHash = passwordHash;
		this.mustSetPassword = true;
	}

	public void markLogin(Instant at) {
		this.lastLoginAt = at;
	}

	public Long getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getName() {
		return name;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public String getAccountId() {
		return accountId;
	}

	public String getRole() {
		return role;
	}

	public String getTeam() {
		return team;
	}

	public boolean isMustSetPassword() {
		return mustSetPassword;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getLastLoginAt() {
		return lastLoginAt;
	}
}
