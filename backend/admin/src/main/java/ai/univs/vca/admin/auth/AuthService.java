package ai.univs.vca.admin.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.auth.AuthDtos.UserProfile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인/세션 (UV-47 → UV-50). 쿠키에는 불투명 토큰, DB에는 토큰의 SHA-256 해시만 저장.
 * 세션 수명: 기본 12시간, Keep me logged in 시 30일.
 *
 * 로그인 판정 순서 (design-vca-portal.md §4.1): 식별자(이메일|사번) 조회 → 비밀번호 → status
 * (suspended ADM-4016 / invited ADM-4017 — 임시 비밀번호 상태보다 먼저: 정지된 계정이 임시 비밀번호를
 * 들고 있어도 거부) → 세션 발급. 존재하지 않는 식별자와 비밀번호 불일치는 구분하지 않는다(ADM-4010).
 */
@Service
public class AuthService {

	public static final Duration SESSION_TTL = Duration.ofHours(12);
	public static final Duration SESSION_TTL_KEEP = Duration.ofDays(30);

	/** 화면(PasswordSetupPage·MyPage 모달)과 동일 규칙: 8자 이상 + 영문 + 숫자 + 특수문자 */
	private static final Pattern HAS_LETTER = Pattern.compile("[a-zA-Z]");
	private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");
	private static final Pattern HAS_SPECIAL = Pattern.compile("[^a-zA-Z0-9]");

	/** 임시 비밀번호 유효 기간 — 관리자가 화면에서 읽어 전화로 전달하므로 실제 만료가 이 숫자여야 한다 (UV-51) */
	public static final Duration TEMP_PASSWORD_TTL = Duration.ofHours(24);

	private final UserAccountRepository users;
	private final UserSessionRepository sessions;
	private final AttemptService attempts;
	private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
	private final SecureRandom random = new SecureRandom();

	private final ai.univs.vca.admin.org.ProjectRepository projects;

	public AuthService(UserAccountRepository users, UserSessionRepository sessions, AttemptService attempts,
			ai.univs.vca.admin.org.ProjectRepository projects) {
		this.projects = projects;
		this.users = users;
		this.sessions = sessions;
		this.attempts = attempts;
	}

	public record LoginResult(String token, boolean keepLoggedIn, UserProfile profile) {
	}

	/**
	 * 판정 순서: 잠금(ADM-4015) → 식별자·비밀번호(ADM-4010, 실패 카운트) → 정지(4016) → 미활성(4017)
	 * → 임시 비밀번호 만료(4019) → 세션. 잠금은 계정(식별자) 단위 5회/15분 (AttemptService).
	 */
	@Transactional
	public LoginResult login(String identifier, String password, boolean keepLoggedIn) {
		return login(identifier, password, keepLoggedIn, null, null);
	}

	@Transactional
	public LoginResult login(String identifier, String password, boolean keepLoggedIn, String userAgent, String ip) {
		if (identifier == null || identifier.isBlank() || password == null || password.isEmpty()) {
			throw AdminApiException.badRequest("identifier and password are required");
		}
		String attemptKey = AttemptService.loginKey(identifier);
		if (attempts.isLocked(attemptKey)) {
			throw AdminApiException.accountLocked();
		}
		Optional<UserAccountEntity> found = findByIdentifier(identifier);
		if (found.isEmpty() || !encoder.matches(password, found.get().getPasswordHash())) {
			attempts.recordFailure(attemptKey);
			throw AdminApiException.invalidCredentials();
		}
		UserAccountEntity user = found.get();
		if (user.getStatus() == AccountStatus.SUSPENDED) {
			throw AdminApiException.accountSuspended();
		}
		if (user.getStatus() == AccountStatus.INVITED) {
			throw AdminApiException.accountNotActivated();
		}
		if (user.isMustSetPassword() && user.getTempPasswordIssuedAt() != null
				&& user.getTempPasswordIssuedAt().plus(TEMP_PASSWORD_TTL).isBefore(Instant.now())) {
			throw AdminApiException.tempPasswordExpired();
		}
		attempts.clear(attemptKey);
		return startSession(user, keepLoggedIn, userAgent, ip);
	}

	/** 세션 발급 — 로그인과 활성화 경로(등록 코드·초대·self-signup)가 공유 */
	@Transactional
	public LoginResult startSession(UserAccountEntity user, boolean keepLoggedIn) {
		return startSession(user, keepLoggedIn, null, null);
	}

	/** 세션 발급 + 기기 메타(My Page 세션 목록용, UV-56) */
	@Transactional
	public LoginResult startSession(UserAccountEntity user, boolean keepLoggedIn, String userAgent, String ip) {
		byte[] raw = new byte[32];
		random.nextBytes(raw);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
		Duration ttl = keepLoggedIn ? SESSION_TTL_KEEP : SESSION_TTL;
		UserSessionEntity session = new UserSessionEntity(hash(token), user.getId(), keepLoggedIn,
				Instant.now().plus(ttl));
		session.setClient(userAgent, ip);
		sessions.save(session);
		user.markLogin(Instant.now());
		return new LoginResult(token, keepLoggedIn, profileOf(user));
	}

	/** 내 세션 목록 — 현재 세션 표시. id는 해시(토큰 역산 불가) */
	@Transactional(readOnly = true)
	public java.util.List<AuthDtos.SessionRow> sessions(String token) {
		UserAccountEntity user = requireUser(token);
		String mine = hash(token);
		Instant now = Instant.now();
		return sessions.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
			.filter(s -> s.getExpiresAt().isAfter(now))
			.map(s -> new AuthDtos.SessionRow(s.getTokenHash(), s.getTokenHash().equals(mine), s.getCreatedAt(),
					s.getLastSeenAt(), s.getExpiresAt(), s.isKeepLoggedIn(), s.getUserAgent(), s.getIp()))
			.toList();
	}

	/** 세션 1개 종료 — 내 것만. 현재 세션을 지우면 로그아웃과 같다 */
	@Transactional
	public void terminateSession(String token, String sessionId) {
		UserAccountEntity user = requireUser(token);
		sessions.findById(sessionId).filter(s -> s.getUserId().equals(user.getId())).ifPresent(sessions::delete);
	}

	/** 다른 기기 전부 종료 */
	@Transactional
	public int terminateOtherSessions(String token) {
		UserAccountEntity user = requireUser(token);
		String mine = hash(token);
		int before = (int) sessions.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
			.filter(s -> !s.getTokenHash().equals(mine)).count();
		sessions.deleteOtherSessions(user.getId(), mine);
		return before;
	}

	/** 이메일(소문자 저장) 또는 사번(대문자 저장) — 입력은 대소문자 무관 */
	Optional<UserAccountEntity> findByIdentifier(String identifier) {
		Optional<UserAccountEntity> byEmail = users.findByEmail(identifier.trim().toLowerCase(Locale.ROOT));
		return byEmail.isPresent() ? byEmail
				: users.findByEmployeeId(UserAdminService.normalizeEmployeeId(identifier));
	}

	@Transactional
	public UserProfile me(String token) {
		return profileOf(requireUser(token));
	}

	/** owner는 설치 전체, 그 외는 배정 프로젝트 — 앱 헤더 현장 전환의 이름 원천 (UV-52 2차, UV-58 규칙 동일) */
	public UserProfile profileOf(UserAccountEntity u) {
		java.util.List<ai.univs.vca.admin.org.ProjectEntity> rows = u.getPermission() == PortalPermission.OWNER
				? projects.findAll()
				: projects.findByIdInOrderByCreatedAt(u.getProjectIds());
		return UserProfile.of(u, rows.stream().map(p -> new AuthDtos.ProjectRef(p.getId(), p.getName())).toList());
	}

	/** SessionInterceptor용 — 세션 → 사용자 (없거나 만료면 ADM-4011) */
	@Transactional
	public UserAccountEntity resolveSession(String token) {
		return requireUser(token);
	}

	@Transactional
	public void logout(String token) {
		if (token != null && !token.isBlank()) {
			sessions.deleteById(hash(token)); // 없는 토큰이어도 성공 — 로그아웃은 멱등
		}
	}

	@Transactional
	public void verifyPassword(String token, String currentPassword) {
		UserAccountEntity user = requireUser(token);
		if (currentPassword == null || !encoder.matches(currentPassword, user.getPasswordHash())) {
			throw AdminApiException.wrongCurrentPassword();
		}
	}

	/**
	 * 첫 로그인 Set Password (UV-48) — 임시 비밀번호로 이미 로그인한 세션이 전제라 현재 비밀번호를
	 * 다시 받지 않는다. 임시 상태가 아니면 거부(ADM-4013 — 그 경우는 변경 API 몫).
	 */
	@Transactional
	public void setupPassword(String token, String newPassword) {
		UserAccountEntity user = requireUser(token);
		if (!user.isMustSetPassword()) {
			throw AdminApiException.passwordAlreadySet();
		}
		validateFormat(newPassword);
		user.changePassword(encoder.encode(newPassword)); // mustSetPassword 해제 포함
		sessions.deleteOtherSessions(user.getId(), hash(token)); // 임시 비밀번호로 만든 다른 세션 무효화
	}

	@Transactional
	public void changePassword(String token, String currentPassword, String newPassword) {
		UserAccountEntity user = requireUser(token);
		if (currentPassword == null || !encoder.matches(currentPassword, user.getPasswordHash())) {
			throw AdminApiException.wrongCurrentPassword();
		}
		validateFormat(newPassword);
		user.changePassword(encoder.encode(newPassword));
		sessions.deleteOtherSessions(user.getId(), hash(token)); // 현재 세션만 유지
	}

	static void validateFormat(String password) {
		if (password == null || password.length() < 8 || !HAS_LETTER.matcher(password).find()
				|| !HAS_DIGIT.matcher(password).find() || !HAS_SPECIAL.matcher(password).find()) {
			throw AdminApiException
				.badRequest("password must be at least 8 characters with letters, numbers and special characters");
		}
	}

	private UserAccountEntity requireUser(String token) {
		if (token == null || token.isBlank()) {
			throw AdminApiException.sessionRequired();
		}
		UserSessionEntity session = sessions.findById(hash(token))
			.orElseThrow(AdminApiException::sessionRequired);
		if (session.getExpiresAt().isBefore(Instant.now())) {
			sessions.delete(session);
			throw AdminApiException.sessionRequired();
		}
		session.touch(Instant.now()); // dirty면 트랜잭션 커밋 시 lastSeenAt 갱신(1분 간격)
		UserAccountEntity user = users.findById(session.getUserId()).orElseThrow(AdminApiException::sessionRequired);
		if (user.getStatus() == AccountStatus.SUSPENDED) {
			sessions.delete(session); // 정지 즉시 기존 세션도 끊는다
			throw AdminApiException.accountSuspended();
		}
		return user;
	}

	String encode(String password) {
		return encoder.encode(password);
	}

	private static String hash(String token) {
		return Hashes.sha256(token);
	}
}
