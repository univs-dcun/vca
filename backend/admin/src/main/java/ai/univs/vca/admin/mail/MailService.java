package ai.univs.vca.admin.mail;

import java.util.Optional;
import java.util.Properties;

import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.auth.UserAccountEntity;
import ai.univs.vca.admin.crypto.CredentialCipher;
import ai.univs.vca.admin.org.MailConfig;
import ai.univs.vca.admin.org.ProjectEntity;
import ai.univs.vca.admin.org.ProjectRepository;
import ai.univs.vca.admin.org.TeamEntity;
import ai.univs.vca.admin.org.TeamRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

/**
 * 발신 메일 (UV-56). VCA는 메일을 호스팅하지 않는다 — 팀(또는 프로젝트 오버라이드)에 설정된 고객사 SMTP로
 * sender 역할만. 설정이 없으면 "메일 불가" — 재설정은 관리자 수교(adminOnly) 경로로.
 * mail-dev-log=true면 보내지 않고 로그(개발 전용).
 */
@Service
public class MailService {

	private static final Logger log = LoggerFactory.getLogger(MailService.class);

	private final TeamRepository teams;
	private final ProjectRepository projects;
	private final AdminProperties props;
	private final CredentialCipher cipher;

	public MailService(TeamRepository teams, ProjectRepository projects, AdminProperties props) {
		this.teams = teams;
		this.projects = projects;
		this.props = props;
		this.cipher = new CredentialCipher(props.encKey());
	}

	/** 사용자 기준 SMTP 해석: 배정 프로젝트 오버라이드 → 팀. 없으면 empty */
	public Optional<MailConfig> resolveFor(UserAccountEntity user) {
		for (String projectId : user.getProjectIds()) {
			Optional<MailConfig> p = projects.findById(projectId).map(ProjectEntity::getSmtp)
				.filter(c -> c != null && c.isConfigured());
			if (p.isPresent()) {
				return p;
			}
		}
		if (user.getTeamId() != null) {
			return teams.findById(user.getTeamId()).map(TeamEntity::getSmtp).filter(c -> c != null && c.isConfigured());
		}
		return Optional.empty();
	}

	public boolean canSendTo(UserAccountEntity user) {
		return user.getEmail() != null && (props.mailDevLog() || resolveFor(user).isPresent());
	}

	/** 동기 발송 — 실패는 예외로 (호출자가 사용자에게 알린다) */
	public void send(UserAccountEntity to, String subject, String body) {
		if (props.mailDevLog()) {
			log.info("[mail-dev-log] to={} subject={}\n{}", to.getEmail(), subject, body);
			return;
		}
		MailConfig cfg = resolveFor(to).orElseThrow(() -> new IllegalStateException("no SMTP configured"));
		JavaMailSenderImpl sender = new JavaMailSenderImpl();
		sender.setHost(cfg.getHost());
		sender.setPort(cfg.getPort() == null ? 587 : cfg.getPort());
		if (cfg.getUsername() != null && !cfg.getUsername().isBlank()) {
			sender.setUsername(cfg.getUsername());
			sender.setPassword(cfg.getPasswordEnc() == null ? null : cipher.decrypt(cfg.getPasswordEnc()));
		}
		Properties p = sender.getJavaMailProperties();
		p.put("mail.smtp.auth", String.valueOf(cfg.getUsername() != null && !cfg.getUsername().isBlank()));
		p.put("mail.smtp.starttls.enable", String.valueOf(Boolean.TRUE.equals(cfg.getUseTls())));
		p.put("mail.smtp.connectiontimeout", "5000");
		p.put("mail.smtp.timeout", "5000");
		SimpleMailMessage msg = new SimpleMailMessage();
		msg.setFrom(cfg.getFromAddress() == null ? "vca-noreply@localhost" : cfg.getFromAddress());
		msg.setTo(to.getEmail());
		msg.setSubject(subject);
		msg.setText(body);
		sender.send(msg);
	}
}
