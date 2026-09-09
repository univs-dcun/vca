package ai.univs.vca.admin.org;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * 발신 메일(SMTP) 설정 — VCA는 메일을 호스팅하지 않고 고객사 메일 서버에 sender로 전달한다.
 * 비밀번호는 AES-GCM 암호문(CredentialCipher)만 저장, 응답에는 hasPassword만.
 * 팀 설정을 프로젝트가 오버라이드할 수 있어 Embeddable로 두 곳에 박힌다.
 */
@Embeddable
public class MailConfig {

	@Column(name = "smtp_host")
	private String host;

	@Column(name = "smtp_port")
	private Integer port;

	@Column(name = "smtp_from_address")
	private String fromAddress;

	@Column(name = "smtp_username")
	private String username;

	@Column(name = "smtp_password_enc", length = 512)
	private String passwordEnc;

	@Column(name = "smtp_use_tls")
	private Boolean useTls;

	protected MailConfig() {
	}

	public MailConfig(String host, Integer port, String fromAddress, String username, String passwordEnc,
			Boolean useTls) {
		this.host = host;
		this.port = port;
		this.fromAddress = fromAddress;
		this.username = username;
		this.passwordEnc = passwordEnc;
		this.useTls = useTls;
	}

	public boolean isConfigured() {
		return host != null && !host.isBlank();
	}

	public String getHost() {
		return host;
	}

	public Integer getPort() {
		return port;
	}

	public String getFromAddress() {
		return fromAddress;
	}

	public String getUsername() {
		return username;
	}

	public String getPasswordEnc() {
		return passwordEnc;
	}

	public Boolean getUseTls() {
		return useTls;
	}
}
