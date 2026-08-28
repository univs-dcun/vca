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

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getLastLoginAt() {
		return lastLoginAt;
	}
}
