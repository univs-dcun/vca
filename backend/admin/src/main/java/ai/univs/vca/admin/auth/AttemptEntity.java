package ai.univs.vca.admin.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 실패 시도 카운터 (UV-51) — 로그인 잠금(계정 단위)과 등록 코드 스로틀(IP 단위).
 * 프론트의 카운터는 새로고침에 리셋되므로 여기가 유일한 집행 지점 (기획자 HANDOFF register/page.tsx:134).
 * key = "login:{identifier}" | "code:{ip}"
 */
@Entity
@Table(name = "auth_attempt")
public class AttemptEntity {

	@Id
	@Column(length = 200)
	private String key;

	@Column(nullable = false)
	private int failures;

	@Column(nullable = false)
	private Instant windowStart;

	private Instant lockedUntil;

	protected AttemptEntity() {
	}

	public AttemptEntity(String key) {
		this.key = key;
		this.failures = 0;
		this.windowStart = Instant.now();
	}

	public String getKey() {
		return key;
	}

	public int getFailures() {
		return failures;
	}

	public Instant getWindowStart() {
		return windowStart;
	}

	public Instant getLockedUntil() {
		return lockedUntil;
	}

	public void reset() {
		this.failures = 0;
		this.windowStart = Instant.now();
		this.lockedUntil = null;
	}

	public void fail(int max, java.time.Duration window, java.time.Duration lock) {
		Instant now = Instant.now();
		if (windowStart.plus(window).isBefore(now)) {
			failures = 0;
			windowStart = now;
		}
		failures++;
		if (failures >= max) {
			lockedUntil = now.plus(lock);
		}
	}

	public boolean isLocked() {
		return lockedUntil != null && lockedUntil.isAfter(Instant.now());
	}
}
