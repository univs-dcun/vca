package ai.univs.vca.admin.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 서버 세션 (UV-47 → UV-56 목록/종료용 메타). 쿠키에는 불투명 토큰만 나가고, DB에는 그 SHA-256 해시만 저장한다 —
 * DB가 유출돼도 세션을 위조할 수 없다. 서버가 세션을 state로 들고 있어서 "다른 기기 종료"가 거짓말이 아니다
 * (기획자 mypage 주석: stateless 토큰만으로는 revoke할 것이 없다).
 */
@Entity
@Table(name = "user_session")
public class UserSessionEntity {

	@Id
	@Column(length = 64)
	private String tokenHash;

	@Column(nullable = false)
	private Long userId;

	@Column(nullable = false)
	private boolean keepLoggedIn;

	@Column(nullable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant expiresAt;

	/** 마지막 활동 — 1분 간격으로만 갱신(요청마다 쓰지 않는다) */
	private Instant lastSeenAt;

	@Column(length = 256)
	private String userAgent;

	@Column(length = 64)
	private String ip;

	protected UserSessionEntity() {
	}

	public UserSessionEntity(String tokenHash, Long userId, boolean keepLoggedIn, Instant expiresAt) {
		this.tokenHash = tokenHash;
		this.userId = userId;
		this.keepLoggedIn = keepLoggedIn;
		this.createdAt = Instant.now();
		this.expiresAt = expiresAt;
		this.lastSeenAt = this.createdAt;
	}

	public void setClient(String userAgent, String ip) {
		this.userAgent = userAgent == null ? null : userAgent.substring(0, Math.min(256, userAgent.length()));
		this.ip = ip;
	}

	public boolean touch(Instant now) {
		if (lastSeenAt == null || lastSeenAt.plusSeconds(60).isBefore(now)) {
			lastSeenAt = now;
			return true;
		}
		return false;
	}

	public String getTokenHash() {
		return tokenHash;
	}

	public Long getUserId() {
		return userId;
	}

	public boolean isKeepLoggedIn() {
		return keepLoggedIn;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getLastSeenAt() {
		return lastSeenAt;
	}

	public String getUserAgent() {
		return userAgent;
	}

	public String getIp() {
		return ip;
	}
}
