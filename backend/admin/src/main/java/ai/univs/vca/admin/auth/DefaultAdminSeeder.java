package ai.univs.vca.admin.auth;

import java.util.List;

import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.org.OrgService;
import ai.univs.vca.admin.org.ProjectEntity;
import ai.univs.vca.admin.org.ProjectRepository;
import ai.univs.vca.admin.org.TeamEntity;
import ai.univs.vca.admin.org.TeamRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 기동 시드 (UV-47 → UV-50).
 *
 * 1. 팀·프로젝트가 비어 있으면 기본 팀 1 + 프로젝트 1을 만든다 — Portal 셸은 팀/프로젝트가 있어야 뜨고,
 *    기존 카메라·계정은 이 기본 스코프에 귀속된다 (Old VCA 이관 확정 전 자리).
 * 2. 계정 원장이 비어 있으면 초기 운영자(owner) 1명을 시드한다 — 계정 발급은 Portal owner의 몫이므로
 *    첫 owner만 설치 시점에 존재하면 된다.
 * 3. 활성 owner가 0명이면(UV-47 시드 계정이 default NONE으로 마이그레이션된 경우) seed-admin-email
 *    계정을 owner로 승격한다 — 그렇지 않으면 아무도 권한을 줄 수 없는 설치가 된다.
 * 4. teamId가 비어 있는 계정은 기본 팀에 귀속.
 */
/** 팀·프로젝트·초기 owner가 먼저 — 카메라 시더가 기본 프로젝트를 참조한다 (UV-60에서 빈 DB 첫 기동 시 카메라 projectId null 버그 수정) */
@Order(1)
@Component
public class DefaultAdminSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DefaultAdminSeeder.class);

	static final String DEFAULT_TEAM_ID = "team-default";
	static final String DEFAULT_PROJECT_ID = "proj-default";

	private final UserAccountRepository users;
	private final TeamRepository teams;
	private final ProjectRepository projects;
	private final AuthService authService;
	private final AdminProperties props;

	public DefaultAdminSeeder(UserAccountRepository users, TeamRepository teams, ProjectRepository projects,
			AuthService authService, AdminProperties props) {
		this.users = users;
		this.teams = teams;
		this.projects = projects;
		this.authService = authService;
		this.props = props;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (teams.count() == 0) {
			teams.save(new TeamEntity(DEFAULT_TEAM_ID, "Default Organization", "", null, null, null, null));
			log.info("기본 팀 시드: {}", DEFAULT_TEAM_ID);
		}
		if (projects.count() == 0) {
			String teamId = teams.findAll().get(0).getId();
			projects.save(new ProjectEntity(DEFAULT_PROJECT_ID, teamId, "Default Project",
					ProjectEntity.Type.SMART_CITY, OrgService.DEFAULT_TIME_ZONE));
			log.info("기본 프로젝트 시드: {}", DEFAULT_PROJECT_ID);
		}
		String defaultTeamId = teams.findAll().get(0).getId();

		if (users.count() == 0) {
			if (props.seedAdminEmail() == null || props.seedAdminEmail().isBlank()) {
				log.warn("user_account 비어 있음 + seed-admin-email 미설정 — 로그인 가능한 계정이 없다");
				return;
			}
			AuthService.validateFormat(props.seedAdminPassword());
			users.save(new UserAccountEntity(props.seedAdminEmail().trim().toLowerCase(), null, "John Doe",
					authService.encode(props.seedAdminPassword()), "VCA-ADMIN-8821", "Smart City Operations Manager",
					"Operational Control Team Alpha", PortalPermission.OWNER, true, true, AccountStatus.ACTIVE,
					defaultTeamId, List.of()));
			log.info("초기 운영자(owner) 계정 시드: {}", props.seedAdminEmail());
			return;
		}

		if (users.countByPermissionAndStatus(PortalPermission.OWNER, AccountStatus.ACTIVE) == 0
				&& props.seedAdminEmail() != null) {
			users.findByEmail(props.seedAdminEmail().trim().toLowerCase()).ifPresent(u -> {
				u.updateAccess(PortalPermission.OWNER, true);
				log.warn("활성 owner 없음 — {} 를 owner로 승격 (UV-50 마이그레이션)", u.getEmail());
			});
		}
		users.findAll().stream().filter(u -> u.getTeamId() == null).forEach(u -> u.setTeamId(defaultTeamId));
	}
}
