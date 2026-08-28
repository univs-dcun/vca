package ai.univs.vca.admin.auth;

import ai.univs.vca.admin.AdminProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 계정 원장이 비어 있으면 초기 운영자 1명을 시드한다 (UV-47) — 계정 관리 화면/초대 흐름이
 * 생기기 전까지 로그인 가능한 계정을 보장하는 자리. 프로필 필드는 화면의 기존 mock
 * (vcaStore SIGNED_IN_USER)과 동일 값이라 시드 계정으로 로그인해도 화면 표시가 달라지지 않는다.
 */
@Component
public class DefaultAdminSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DefaultAdminSeeder.class);

	private final UserAccountRepository users;
	private final AuthService authService;
	private final AdminProperties props;

	public DefaultAdminSeeder(UserAccountRepository users, AuthService authService, AdminProperties props) {
		this.users = users;
		this.authService = authService;
		this.props = props;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (users.count() > 0) {
			return;
		}
		if (props.seedAdminEmail() == null || props.seedAdminEmail().isBlank()) {
			log.warn("user_account 비어 있음 + seed-admin-email 미설정 — 로그인 가능한 계정이 없다");
			return;
		}
		AuthService.validateFormat(props.seedAdminPassword());
		users.save(new UserAccountEntity(props.seedAdminEmail().trim().toLowerCase(), "John Doe",
				authService.encode(props.seedAdminPassword()), "VCA-ADMIN-8821", "Smart City Operations Manager",
				"Operational Control Team Alpha"));
		log.info("초기 운영자 계정 시드: {}", props.seedAdminEmail());
	}
}
