package ai.univs.vca.admin.crypto;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 카메라 자격증명(password) 저장용 AES-256-GCM — 원장 스키마의 password(암호화) 항목
 * (docs/design-vca-admin.md §6.1). 저장 형식: Base64(iv 12B || ciphertext+tag).
 * 평문 비밀번호는 API 응답 어디에도 반환하지 않는다 (쓰기 전용 필드).
 */
public class CredentialCipher {

	private static final int IV_BYTES = 12;
	private static final int TAG_BITS = 128;

	private final SecretKeySpec key;
	private final SecureRandom random = new SecureRandom();

	public CredentialCipher(String encKey) {
		try {
			byte[] keyBytes = MessageDigest.getInstance("SHA-256").digest(encKey.getBytes(StandardCharsets.UTF_8));
			this.key = new SecretKeySpec(keyBytes, "AES");
		}
		catch (Exception e) {
			throw new IllegalStateException("암호화 키 파생 실패", e);
		}
	}

	public String encrypt(String plain) {
		try {
			byte[] iv = new byte[IV_BYTES];
			random.nextBytes(iv);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
			byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
			byte[] out = new byte[iv.length + ct.length];
			System.arraycopy(iv, 0, out, 0, iv.length);
			System.arraycopy(ct, 0, out, iv.length, ct.length);
			return Base64.getEncoder().encodeToString(out);
		}
		catch (Exception e) {
			throw new IllegalStateException("자격증명 암호화 실패", e);
		}
	}

	public String decrypt(String encoded) {
		try {
			byte[] in = Base64.getDecoder().decode(encoded);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, in, 0, IV_BYTES));
			byte[] plain = cipher.doFinal(in, IV_BYTES, in.length - IV_BYTES);
			return new String(plain, StandardCharsets.UTF_8);
		}
		catch (Exception e) {
			throw new IllegalStateException("자격증명 복호화 실패 — 암호화 키가 저장 당시와 다를 수 있음", e);
		}
	}
}
