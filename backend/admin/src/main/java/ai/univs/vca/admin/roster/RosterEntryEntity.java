package ai.univs.vca.admin.roster;

import java.time.Duration;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 직원 명부 (UV-51, 기획자 staffRoster.ts) — 관리자가 사전 등록한 직원에게 1인 1코드를 종이/대면으로
 * 수교하고, 직원은 /register에서 코드로 계정을 활성화한다. 코드가 조회 키이자 신원 증명이고 발급 자체가
 * 승인이다. 코드는 해시만 저장 — 원문은 발급 응답에서 1회.
 *
 * employeeId는 명부 전역 유일(대문자 정규화) — 한 코드가 두 사람으로 해석되면 안 된다.
 * 스코프는 프로젝트 단위(기획자 ASSUMPTION — 조직 전체 공용 여부는 기획 확인 대기).
 */
@Entity
@Table(name = "staff_roster")
public class RosterEntryEntity {

	public static final Duration CODE_TTL = Duration.ofDays(14);

	public enum Permission {
		ADMIN, OPERATOR;

		public String json() {
			return name().toLowerCase();
		}

		public static Permission fromJson(String v) {
			return v == null ? OPERATOR : valueOf(v.trim().toUpperCase());
		}
	}

	/** 저장 상태 — expired는 저장하지 않고 issuedAt + TTL로 판정한다 (effectiveStatus) */
	public enum Status {
		NOT_ISSUED, UNUSED, USED;
	}

	@Id
	@Column(length = 64)
	private String employeeId;

	@Column(nullable = false, length = 64)
	private String projectId;

	@Column(nullable = false)
	private String name;

	private String department;

	/** 메일 없는 회사는 null */
	private String email;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private Permission permission;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private Status status;

	@Column(length = 64)
	private String codeHash;

	private Instant codeIssuedAt;

	private Instant usedAt;

	/** 활성화로 생긴 계정 */
	private Long userId;

	@Column(nullable = false)
	private Instant createdAt;

	protected RosterEntryEntity() {
	}

	public RosterEntryEntity(String employeeId, String projectId, String name, String department, String email,
			Permission permission) {
		this.employeeId = employeeId;
		this.projectId = projectId;
		this.name = name;
		this.department = department;
		this.email = email;
		this.permission = permission;
		this.status = Status.NOT_ISSUED;
		this.createdAt = Instant.now();
	}

	public void update(String name, String department, String email, Permission permission) {
		this.name = name;
		this.department = department;
		this.email = email;
		this.permission = permission;
	}

	/** 발급/재발급 — 이전 코드는 덮어써 즉시 무효, 시계 재시작 */
	public void issueCode(String codeHash) {
		this.codeHash = codeHash;
		this.codeIssuedAt = Instant.now();
		this.status = Status.UNUSED;
	}

	/** 해시는 남긴다 — 소진된 코드를 다시 입력한 사람에게 unknown이 아니라 used를 알리기 위해 (기획 결정 2026-09-02) */
	public void markUsed(Long userId) {
		this.status = Status.USED;
		this.usedAt = Instant.now();
		this.userId = userId;
	}

	public boolean isCodeExpired() {
		return status == Status.UNUSED && codeIssuedAt != null && codeIssuedAt.plus(CODE_TTL).isBefore(Instant.now());
	}

	/** not-issued | unused | used | expired — 모든 화면이 이 값으로 읽는다 */
	public String effectiveStatus() {
		if (isCodeExpired()) {
			return "expired";
		}
		return switch (status) {
			case NOT_ISSUED -> "not-issued";
			case UNUSED -> "unused";
			case USED -> "used";
		};
	}

	public String getEmployeeId() {
		return employeeId;
	}

	public String getProjectId() {
		return projectId;
	}

	public String getName() {
		return name;
	}

	public String getDepartment() {
		return department;
	}

	public String getEmail() {
		return email;
	}

	public Permission getPermission() {
		return permission;
	}

	public Status getStatus() {
		return status;
	}

	public String getCodeHash() {
		return codeHash;
	}

	public Instant getCodeIssuedAt() {
		return codeIssuedAt;
	}

	public Instant getUsedAt() {
		return usedAt;
	}

	public Long getUserId() {
		return userId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
