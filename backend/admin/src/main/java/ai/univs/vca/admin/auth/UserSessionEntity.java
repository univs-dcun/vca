package ai.univs.vca.admin.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 서버 세션 (UV-47). 쿠키에는 불투명 토큰만 나가고, DB에는 그 SHA-256 해시만 저장한다 —
 * DB가 유출돼도 세션을 위조할 수 없다.
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

	protected UserSessionEntity() {
	}

	public UserSessionEntity(String tokenHash, Long userId, boolean keepLoggedIn, Instant expiresAt) {
		this.tokenHash = tokenHash;
		this.userId = userId;
		this.keepLoggedIn = keepLoggedIn;
		this.createdAt = Instant.now();
		this.expiresAt = expiresAt;
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
}
