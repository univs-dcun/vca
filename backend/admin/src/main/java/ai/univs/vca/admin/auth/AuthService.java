package ai.univs.vca.admin.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.auth.AuthDtos.UserProfile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인/세션 (UV-47). 쿠키에는 불투명 토큰, DB에는 토큰의 SHA-256 해시만 저장.
 * 세션 수명: 기본 12시간, Keep me logged in 시 30일 (쿠키 Max-Age도 동일하게 —
 * 미체크 시에는 브라우저 세션 쿠키라 창을 닫으면 사라진다).
 */
@Service
public class AuthService {

	public static final Duration SESSION_TTL = Duration.ofHours(12);
	public static final Duration SESSION_TTL_KEEP = Duration.ofDays(30);

	/** 화면(PasswordSetupPage·MyPage 모달)과 동일 규칙: 8자 이상 + 영문 + 숫자 + 특수문자 */
	private static final Pattern HAS_LETTER = Pattern.compile("[a-zA-Z]");
	private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");
	private static final Pattern HAS_SPECIAL = Pattern.compile("[^a-zA-Z0-9]");

	private final UserAccountRepository users;
	private final UserSessionRepository sessions;
	private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
	private final SecureRandom random = new SecureRandom();

	public AuthService(UserAccountRepository users, UserSessionRepository sessions) {
		this.users = users;
		this.sessions = sessions;
	}

	public record LoginResult(String token, boolean keepLoggedIn, UserProfile profile) {
	}

	@Transactional
	public LoginResult login(String email, String password, boolean keepLoggedIn) {
		if (email == null || email.isBlank() || password == null || password.isEmpty()) {
			throw AdminApiException.badRequest("email and password are required");
		}
		UserAccountEntity user = users.findByEmail(email.trim().toLowerCase())
			.orElseThrow(AdminApiException::invalidCredentials);
		if (!encoder.matches(password, user.getPasswordHash())) {
			throw AdminApiException.invalidCredentials();
		}
		byte[] raw = new byte[32];
		random.nextBytes(raw);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
		Duration ttl = keepLoggedIn ? SESSION_TTL_KEEP : SESSION_TTL;
		sessions.save(new UserSessionEntity(hash(token), user.getId(), keepLoggedIn, Instant.now().plus(ttl)));
		user.markLogin(Instant.now());
		return new LoginResult(token, keepLoggedIn, UserProfile.of(user));
	}

	@Transactional
	public UserProfile me(String token) {
		return UserProfile.of(requireUser(token));
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
		return users.findById(session.getUserId()).orElseThrow(AdminApiException::sessionRequired);
	}

	String encode(String password) {
		return encoder.encode(password);
	}

	private static String hash(String token) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
		}
		catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
