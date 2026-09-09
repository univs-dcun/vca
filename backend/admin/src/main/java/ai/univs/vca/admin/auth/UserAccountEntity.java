package ai.univs.vca.admin.auth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

/**
 * VCA 운영자 계정 원장 (UV-47 → UV-50 Portal 권한 모델로 확장, design-vca-portal.md §3.2).
 *
 * 콘솔 역할(permission)과 앱 접근(appAccess)은 독립 축이다 — 앱을 안 여는 관리자와, 콘솔은
 * 못 보는 앱 사용자가 둘 다 실재한다. 이메일은 nullable(메일 없는 회사) — 이메일 또는 사번 중
 * 하나는 있어야 하며 둘 다 로그인 식별자가 된다.
 */
@Entity
@Table(name = "user_account")
public class UserAccountEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** 로그인 식별자 — 소문자 정규화 저장. 메일 없는 환경이면 null (사번으로 로그인) */
	@Column(unique = true)
	private String email;

	/** 사번 — 로그인 식별자 겸용. 대문자 정규화 저장(EMP-3004) */
	@Column(unique = true, length = 64)
	private String employeeId;

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

	/** 콘솔 역할 — 기존 행(UV-47)은 default NONE으로 들어오고 시더가 초기 운영자를 OWNER로 승격 */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16, columnDefinition = "varchar(16) not null default 'NONE'")
	private PortalPermission permission = PortalPermission.NONE;

	/** 모니터링 앱 로그인 가능 여부 — 역할에서 파생하지 않는 독립 플래그 */
	@Column(nullable = false, columnDefinition = "boolean not null default true")
	private boolean appAccess = true;

	/** 앱 내 인물 검색 권한 */
	@Column(nullable = false, columnDefinition = "boolean not null default false")
	private boolean appSearch;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16, columnDefinition = "varchar(16) not null default 'ACTIVE'")
	private AccountStatus status = AccountStatus.ACTIVE;

	/** 소속 팀(조직) — 기존 행은 null, 시더가 기본 팀으로 채운다 */
	@Column(length = 64)
	private String teamId;

	/** 앱에서 볼 수 있는 프로젝트 — 비어 있으면 팀의 전 프로젝트 */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "user_project", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "project_id", length = 64)
	private List<String> projectIds = new ArrayList<>();

	/**
	 * 임시 비밀번호 상태 (UV-48) — 담당자가 발급한 계정은 true로 시작하고, 사용자가 첫 로그인 후
	 * Set Password를 마치면 false. true인 세션은 화면 가드가 /password-setup으로 강제한다.
	 * columnDefinition의 default는 기존 행(UV-47 시드)에 대한 ddl-auto update 대비.
	 */
	@Column(nullable = false, columnDefinition = "boolean not null default false")
	private boolean mustSetPassword;

	/** 임시 비밀번호 발급 시각 — TEMP_PASSWORD_TTL(24h) 지나면 로그인 거부(ADM-4019), 재발급 필요 (UV-51) */
	private Instant tempPasswordIssuedAt;

	/** 기존 계정용 등록(셋업) 코드 — 해시만, 14일 (UV-51). 원문은 발급 응답에서 1회 */
	@Column(length = 64)
	private String setupCodeHash;

	private Instant setupCodeIssuedAt;

	/** 초대 토큰(/password-setup?token=) — 해시만, 7일, single-use (UV-51) */
	@Column(length = 64)
	private String inviteTokenHash;

	private Instant inviteTokenIssuedAt;

	@Column(nullable = false)
	private Instant createdAt;

	private Instant lastLoginAt;

	protected UserAccountEntity() {
	}

	public UserAccountEntity(String email, String employeeId, String name, String passwordHash, String accountId,
			String role, String team, PortalPermission permission, boolean appAccess, boolean appSearch,
			AccountStatus status, String teamId, List<String> projectIds) {
		this.email = email;
		this.employeeId = employeeId;
		this.name = name;
		this.passwordHash = passwordHash;
		this.accountId = accountId;
		this.role = role;
		this.team = team;
		this.permission = permission;
		this.appAccess = appAccess;
		this.appSearch = appSearch;
		this.status = status;
		this.teamId = teamId;
		this.projectIds = new ArrayList<>(projectIds == null ? List.of() : projectIds);
		this.createdAt = Instant.now();
	}

	public void changePassword(String passwordHash) {
		this.passwordHash = passwordHash;
		this.mustSetPassword = false;
		this.tempPasswordIssuedAt = null;
	}

	/** 담당자 발급/재발급 — 임시 비밀번호로 교체하고 Set Password 강제 상태로 되돌린다 (24h 시계 시작) */
	public void issueTemporaryPassword(String passwordHash) {
		this.passwordHash = passwordHash;
		this.mustSetPassword = true;
		this.tempPasswordIssuedAt = Instant.now();
	}

	public void issueSetupCode(String codeHash) {
		this.setupCodeHash = codeHash;
		this.setupCodeIssuedAt = Instant.now();
		this.status = AccountStatus.INVITED;
	}

	public void issueInviteToken(String tokenHash) {
		this.inviteTokenHash = tokenHash;
		this.inviteTokenIssuedAt = Instant.now();
		this.status = AccountStatus.INVITED;
	}

	/** 코드/토큰 활성화 — 비밀번호 설정 + 코드·토큰 동시 소진 + active (단일 트랜잭션에서 호출) */
	public void activate(String passwordHash) {
		this.passwordHash = passwordHash;
		this.mustSetPassword = false;
		this.tempPasswordIssuedAt = null;
		this.setupCodeHash = null;
		this.setupCodeIssuedAt = null;
		this.inviteTokenHash = null;
		this.inviteTokenIssuedAt = null;
		this.status = AccountStatus.ACTIVE;
	}

	public void markLogin(Instant at) {
		this.lastLoginAt = at;
	}

	public void updateAccess(PortalPermission permission, boolean appAccess) {
		this.permission = permission;
		this.appAccess = appAccess;
	}

	public void setAppSearch(boolean appSearch) {
		this.appSearch = appSearch;
	}

	public void setStatus(AccountStatus status) {
		this.status = status;
	}

	public void setProjectIds(List<String> projectIds) {
		this.projectIds = new ArrayList<>(projectIds);
	}

	public void setTeamId(String teamId) {
		this.teamId = teamId;
	}

	public Long getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getEmployeeId() {
		return employeeId;
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

	public PortalPermission getPermission() {
		return permission;
	}

	public boolean isAppAccess() {
		return appAccess;
	}

	public boolean isAppSearch() {
		return appSearch;
	}

	public AccountStatus getStatus() {
		return status;
	}

	public String getTeamId() {
		return teamId;
	}

	public List<String> getProjectIds() {
		return projectIds;
	}

	public boolean isMustSetPassword() {
		return mustSetPassword;
	}

	public Instant getTempPasswordIssuedAt() {
		return tempPasswordIssuedAt;
	}

	public String getSetupCodeHash() {
		return setupCodeHash;
	}

	public Instant getSetupCodeIssuedAt() {
		return setupCodeIssuedAt;
	}

	public String getInviteTokenHash() {
		return inviteTokenHash;
	}

	public Instant getInviteTokenIssuedAt() {
		return inviteTokenIssuedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getLastLoginAt() {
		return lastLoginAt;
	}
}
