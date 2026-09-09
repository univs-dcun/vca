package ai.univs.vca.admin.auth;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * 등록/셋업 코드 (UV-51, 기획자 staffRoster.ts와 동일 규격): 8자, 알파벳 ABCDEFGHJKLMNPQRSTUVWXYZ23456789
 * (I/O/0/1 제외 — 출력물 오독 방지), 표시는 XXXX-XXXX. 입력은 대소문자·대시·공백 무관하게 정규화한다.
 * 코드 공간 32^8 ≈ 1.1×10^12 — AttemptService 스로틀이 앞에 있을 때만 안전.
 */
public final class RegistrationCodes {

	public static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	public static final int LENGTH = 8;

	private static final SecureRandom RANDOM = new SecureRandom();

	private RegistrationCodes() {
	}

	public static String generate() {
		StringBuilder sb = new StringBuilder(LENGTH);
		for (int i = 0; i < LENGTH; i++) {
			sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
		}
		return sb.toString();
	}

	/** 대문자화 + 알파벳 외 문자 제거 → 8자가 아니면 null (형식 불량은 unknown으로 처리) */
	public static String normalize(String input) {
		if (input == null) {
			return null;
		}
		String n = input.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
		return n.length() == LENGTH ? n : null;
	}

	public static String format(String code) {
		return code.substring(0, 4) + "-" + code.substring(4);
	}

	public static String hash(String normalizedCode) {
		return Hashes.sha256("code:" + normalizedCode);
	}
}
