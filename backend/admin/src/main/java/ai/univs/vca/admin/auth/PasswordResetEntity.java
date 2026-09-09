package ai.univs.vca.admin.auth;

import java.time.Duration;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 이메일 코드 비밀번호 재설정 세션 (UV-56, 기획자 forgot-password 화면 — 링크가 아니라 코드인 이유: 메일함을 여는
 * 기계가 VCA에 도달할 수 없는 환경, 그리고 토큰을 URL 밖에 두기 위해).
 * 코드 8자리 숫자, 10분, 시도 5회, 재발송 3회·30초 쿨다운. 검증 통과 시 단기 토큰(해시)로 완료 단계에 넘긴다.
 * 사용자당 1개 활성 — 새 요청은 이전 것을 대체(관리자 발송 코드와 셀프 요청 코드 상호 무효화: 기획 확인 항목).
 */
@Entity
@Table(name = "password_reset")
public class PasswordResetEntity {

	public static final Duration CODE_TTL = Duration.ofMinutes(10);
	public static final Duration RESEND_COOLDOWN = Duration.ofSeconds(30);
	public static final int MAX_ATTEMPTS = 5;
	public static final int MAX_RESENDS = 3;
	public static final Duration VERIFIED_TOKEN_TTL = Duration.ofMinutes(10);

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private Long userId;

	@Column(nullable = false, length = 64)
	private String codeHash;

	@Column(nullable = false)
	private Instant expiresAt;

	@Column(nullable = false)
	private int attempts;

	@Column(nullable = false)
	private int resends;

	@Column(nullable = false)
	private Instant lastSentAt;

	@Column(length = 64)
	private String verifiedTokenHash;

	private Instant verifiedAt;

	@Column(nullable = false)
	private Instant createdAt;

	protected PasswordResetEntity() {
	}

	public PasswordResetEntity(Long userId, String codeHash) {
		this.userId = userId;
		this.codeHash = codeHash;
		this.createdAt = Instant.now();
		this.lastSentAt = this.createdAt;
		this.expiresAt = this.createdAt.plus(CODE_TTL);
	}

	/** 재발송 — 새 코드, 시계 재시작, 시도 카운트 리셋 */
	public void resend(String codeHash) {
		this.codeHash = codeHash;
		this.resends++;
		this.attempts = 0;
		this.lastSentAt = Instant.now();
		this.expiresAt = this.lastSentAt.plus(CODE_TTL);
	}

	public void recordAttempt() {
		this.attempts++;
	}

	public void markVerified(String tokenHash) {
		this.verifiedTokenHash = tokenHash;
		this.verifiedAt = Instant.now();
	}

	public boolean isExpired() {
		return expiresAt.isBefore(Instant.now());
	}

	public boolean isThrottled() {
		return attempts >= MAX_ATTEMPTS;
	}

	public boolean canResend() {
		return resends < MAX_RESENDS;
	}

	public boolean inCooldown() {
		return lastSentAt.plus(RESEND_COOLDOWN).isAfter(Instant.now());
	}

	public boolean verifiedTokenValid() {
		return verifiedAt != null && verifiedAt.plus(VERIFIED_TOKEN_TTL).isAfter(Instant.now());
	}

	public Long getUserId() {
		return userId;
	}

	public String getCodeHash() {
		return codeHash;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public int getAttempts() {
		return attempts;
	}

	public int getResends() {
		return resends;
	}

	public Instant getLastSentAt() {
		return lastSentAt;
	}

	public String getVerifiedTokenHash() {
		return verifiedTokenHash;
	}
}
