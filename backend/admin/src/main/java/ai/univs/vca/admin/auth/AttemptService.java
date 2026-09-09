package ai.univs.vca.admin.auth;

import java.time.Duration;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 시도 제한 (UV-51, design-vca-portal.md §4.5 숫자 계약):
 *   로그인 — 계정(식별자) 단위 5회 실패 / 15분 창 → 15분 잠금 (ADM-4015 locked)
 *   등록 코드 — 주소(IP) 단위 5회 실패 / 15분 창 → 15분 차단 (throttled). 코드 공간 32^8은 이 스로틀 앞에서만 안전
 *
 * 실패 기록은 REQUIRES_NEW — 호출 트랜잭션이 예외로 롤백돼도 카운트는 남아야 한다.
 */
@Service
public class AttemptService {

	public static final int MAX_FAILURES = 5;
	public static final Duration WINDOW = Duration.ofMinutes(15);
	public static final Duration LOCK = Duration.ofMinutes(15);

	private final AttemptRepository repository;

	public AttemptService(AttemptRepository repository) {
		this.repository = repository;
	}

	public static String loginKey(String identifier) {
		return "login:" + identifier.trim().toLowerCase(Locale.ROOT);
	}

	public static String codeKey(String ip) {
		return "code:" + (ip == null || ip.isBlank() ? "unknown" : ip.trim());
	}

	@Transactional(readOnly = true)
	public boolean isLocked(String key) {
		return repository.findById(key).map(AttemptEntity::isLocked).orElse(false);
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void recordFailure(String key) {
		AttemptEntity a = repository.findById(key).orElseGet(() -> new AttemptEntity(key));
		a.fail(MAX_FAILURES, WINDOW, LOCK);
		repository.save(a);
	}

	@Transactional
	public void clear(String key) {
		repository.findById(key).ifPresent(repository::delete);
	}
}
