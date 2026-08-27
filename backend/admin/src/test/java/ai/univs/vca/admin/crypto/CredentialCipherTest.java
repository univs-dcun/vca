package ai.univs.vca.admin.crypto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CredentialCipherTest {

	@Test
	void 암복호화_왕복() {
		CredentialCipher cipher = new CredentialCipher("test-key");
		String encrypted = cipher.encrypt("cam-password-1!");
		assertThat(encrypted).isNotEqualTo("cam-password-1!");
		assertThat(cipher.decrypt(encrypted)).isEqualTo("cam-password-1!");
	}

	@Test
	void 같은_평문도_iv가_달라_암호문이_다르다() {
		CredentialCipher cipher = new CredentialCipher("test-key");
		assertThat(cipher.encrypt("same")).isNotEqualTo(cipher.encrypt("same"));
	}

	@Test
	void 다른_키로는_복호화_실패() {
		String encrypted = new CredentialCipher("key-a").encrypt("secret");
		assertThatThrownBy(() -> new CredentialCipher("key-b").decrypt(encrypted))
			.isInstanceOf(IllegalStateException.class);
	}
}
