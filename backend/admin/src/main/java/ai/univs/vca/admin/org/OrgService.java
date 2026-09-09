package ai.univs.vca.admin.org;

import java.security.SecureRandom;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.audit.AuditService;
import ai.univs.vca.admin.auth.UserAccountEntity;
import ai.univs.vca.admin.auth.UserAccountRepository;
import ai.univs.vca.admin.camera.CameraRepository;
import ai.univs.vca.admin.crypto.CredentialCipher;
import ai.univs.vca.admin.org.OrgDtos.LicenseRequest;
import ai.univs.vca.admin.org.OrgDtos.MailRequest;
import ai.univs.vca.admin.org.OrgDtos.ProjectRequest;
import ai.univs.vca.admin.org.OrgDtos.ProjectResponse;
import ai.univs.vca.admin.org.OrgDtos.TeamRequest;
import ai.univs.vca.admin.org.OrgDtos.TeamResponse;
import ai.univs.vca.admin.security.CurrentUser;
import ai.univs.vca.admin.security.ProjectScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 팀·프로젝트 원장 (UV-50). 식별자는 카메라와 같은 슬러그 규칙: team-{슬러그}-{4hex} / proj-{슬러그}-{4hex} */
@Service
public class OrgService {

	public static final String DEFAULT_TIME_ZONE = "Asia/Singapore";

	private final TeamRepository teams;
	private final ProjectRepository projects;
	private final CameraRepository cameras;
	private final UserAccountRepository users;
	private final CredentialCipher cipher;
	private final AuditService audit;
	private final SecureRandom random = new SecureRandom();

	public OrgService(TeamRepository teams, ProjectRepository projects, CameraRepository cameras,
			UserAccountRepository users,
			AdminProperties props, AuditService audit) {
		this.teams = teams;
		this.projects = projects;
		this.cameras = cameras;
		this.users = users;
		this.cipher = new CredentialCipher(props.encKey()); // CameraService와 같은 키 — 카메라 자격증명과 SMTP 비밀번호 동일 체계
		this.audit = audit;
	}

	// ---- teams ----

	@Transactional(readOnly = true)
	public List<TeamResponse> listTeams() {
		ProjectScope scope = ProjectScope.current();
		List<TeamEntity> rows = scope.isUnrestricted() ? teams.findAll()
				: teams.findByIdIn(CurrentUser.get().getTeamId() == null ? List.of() : List.of(CurrentUser.get().getTeamId()));
		return rows.stream().map(TeamResponse::of).toList();
	}

	@Transactional(readOnly = true)
	public TeamResponse getTeam(String teamId) {
		return TeamResponse.of(requireVisibleTeam(teamId));
	}

	@Transactional
	public TeamResponse createTeam(TeamRequest req) {
		requireText(req.name(), "name");
		TeamEntity t = new TeamEntity(newId("team", req.name()), req.name().trim(),
				req.region() == null ? "" : req.region().trim(), null, null, req.accountManagerName(),
				req.accountManagerEmail());
		teams.save(t);
		audit.record(null, "Team " + t.getName() + " created");
		return TeamResponse.of(t);
	}

	@Transactional
	public TeamResponse updateTeam(String teamId, TeamRequest req) {
		requireText(req.name(), "name");
		TeamEntity t = requireVisibleTeam(teamId);
		t.update(req.name().trim(), req.region() == null ? "" : req.region().trim(), req.accountManagerName(),
				req.accountManagerEmail());
		audit.record(null, "Team " + t.getName() + " updated");
		return TeamResponse.of(t);
	}

	@Transactional
	public TeamResponse updateTeamMail(String teamId, MailRequest req) {
		TeamEntity t = requireVisibleTeam(teamId);
		t.updateMail(req.mailDomain(), mailConfig(req, t.getSmtp()));
		audit.record(null, "Team " + t.getName() + " mail settings updated");
		return TeamResponse.of(t);
	}

	// ---- projects ----

	@Transactional(readOnly = true)
	public List<ProjectResponse> listProjects(String teamId) {
		ProjectScope scope = ProjectScope.current();
		List<ProjectEntity> rows;
		if (scope.isUnrestricted()) {
			rows = teamId == null || teamId.isBlank() ? projects.findAll() : projects.findByTeamIdOrderByCreatedAt(teamId);
		}
		else {
			// 범위 제한(UV-58): 배정 프로젝트만. teamId 필터는 그 안에서만 동작
			rows = projects.findByIdInOrderByCreatedAt(scope.allowedIds()).stream()
				.filter(p -> teamId == null || teamId.isBlank() || teamId.equals(p.getTeamId()))
				.toList();
		}
		return rows.stream().map(this::toProject).toList();
	}

	@Transactional(readOnly = true)
	public ProjectResponse getProject(String projectId) {
		return toProject(requireVisibleProject(projectId));
	}

	@Transactional
	public ProjectResponse createProject(ProjectRequest req) {
		requireText(req.name(), "name");
		requireTeam(req.teamId() == null ? "" : req.teamId());
		ProjectScope scope = ProjectScope.current();
		scope.requireTeam(req.teamId()); // 비owner는 자기 팀에만 프로젝트를 만든다
		ProjectEntity p = new ProjectEntity(newId("proj", req.name()), req.teamId(), req.name().trim(),
				parseType(req.type()), validZone(req.timeZone()));
		p.update(p.getName(), p.getType(), req.computeInstance(), req.gpuCount(), req.modelVersion(),
				req.regionName());
		projects.save(p);
		if (!scope.isUnrestricted()) {
			// 만든 사람이 곧바로 볼 수 있도록 배정에 추가 — 아니면 자기가 만든 프로젝트가 403이 된다
			UserAccountEntity creator = users.findById(CurrentUser.actorId()).orElse(null);
			if (creator != null && !creator.getProjectIds().contains(p.getId())) {
				List<String> ids = new java.util.ArrayList<>(creator.getProjectIds());
				ids.add(p.getId());
				creator.setProjectIds(ids);
			}
		}
		audit.record(p.getId(), "Project " + p.getName() + " created");
		return toProject(p);
	}

	@Transactional
	public ProjectResponse updateProject(String projectId, ProjectRequest req) {
		requireText(req.name(), "name");
		ProjectEntity p = requireVisibleProject(projectId);
		p.update(req.name().trim(), req.type() == null ? p.getType() : parseType(req.type()), req.computeInstance(),
				req.gpuCount(), req.modelVersion(), req.regionName());
		if (req.timeZone() != null) {
			p.setTimeZone(validZone(req.timeZone()));
		}
		audit.record(p.getId(), "Project " + p.getName() + " updated");
		return toProject(p);
	}

	@Transactional
	public ProjectResponse updateLicense(String projectId, LicenseRequest req) {
		ProjectEntity p = requireVisibleProject(projectId);
		if (req.channelLimit() != null && req.channelLimit() < 0) {
			throw AdminApiException.badRequest("channelLimit must be >= 0");
		}
		p.updateLicense(req.plan(), req.channelLimit(), req.expiresAt());
		audit.record(p.getId(), "License updated: " + (req.plan() == null ? "-" : req.plan()) + " / "
				+ (req.channelLimit() == null ? "-" : req.channelLimit()) + " channels / "
				+ (req.expiresAt() == null ? "Unlimited" : req.expiresAt()));
		return toProject(p);
	}

	@Transactional
	public ProjectResponse updateProjectMail(String projectId, MailRequest req) {
		ProjectEntity p = requireVisibleProject(projectId);
		p.updateMail(req.mailDomain(), mailConfig(req, p.getSmtp()));
		audit.record(p.getId(), "Project mail settings updated");
		return toProject(p);
	}

	@Transactional
	public ProjectResponse updateTimeZone(String projectId, String timeZone) {
		ProjectEntity p = requireVisibleProject(projectId);
		p.setTimeZone(validZone(timeZone));
		audit.record(p.getId(), "Project time zone set to " + p.getTimeZone());
		return toProject(p);
	}

	@Transactional
	public ProjectResponse updateNetworkIsolation(String projectId, Boolean override) {
		ProjectEntity p = requireVisibleProject(projectId);
		p.setNetworkIsolatedOverride(override);
		audit.record(p.getId(), override == null ? "Network isolation set to auto-detect"
				: "Network isolation manually set to " + (override ? "isolated" : "reachable"));
		return toProject(p);
	}

	// ---- helpers ----

	private ProjectResponse toProject(ProjectEntity p) {
		return ProjectResponse.of(p, cameras.countByProjectId(p.getId()));
	}

	public TeamEntity requireTeam(String teamId) {
		return teams.findById(teamId).orElseThrow(() -> AdminApiException.teamNotFound(teamId));
	}

	/** 존재 검사만 — 세션 밖(메일 발송·시더)과 내부 참조용. 사용자 요청 경로는 requireVisible*를 쓴다 */
	public ProjectEntity requireProject(String projectId) {
		return projects.findById(projectId).orElseThrow(() -> AdminApiException.projectNotFound(projectId));
	}

	/** 범위 검사 먼저(403 ADM-4033) — 범위 밖 프로젝트는 존재 여부(404)를 알려주지 않는다 (UV-58) */
	public ProjectEntity requireVisibleProject(String projectId) {
		ProjectScope.current().require(projectId);
		return requireProject(projectId);
	}

	public TeamEntity requireVisibleTeam(String teamId) {
		ProjectScope.current().requireTeam(teamId);
		return requireTeam(teamId);
	}

	/** password 생략 시 기존 암호문 유지 (쓰기 전용 필드). host가 비면 설정 해제 */
	private MailConfig mailConfig(MailRequest req, MailConfig existing) {
		if (req.host() == null || req.host().isBlank()) {
			return null;
		}
		String passwordEnc = req.password() != null && !req.password().isEmpty() ? cipher.encrypt(req.password())
				: existing == null ? null : existing.getPasswordEnc();
		return new MailConfig(req.host().trim(), req.port(), req.fromAddress(), req.username(), passwordEnc,
				req.useTls());
	}

	private static ProjectEntity.Type parseType(String type) {
		try {
			return ProjectEntity.Type.fromJson(type == null ? "smart_city" : type);
		}
		catch (IllegalArgumentException e) {
			throw AdminApiException.badRequest("type must be smart_city or smart_school");
		}
	}

	private static String validZone(String zone) {
		if (zone == null || zone.isBlank()) {
			return DEFAULT_TIME_ZONE;
		}
		try {
			return ZoneId.of(zone.trim()).getId();
		}
		catch (Exception e) {
			throw AdminApiException.badRequest("unknown timeZone: " + zone);
		}
	}

	private static void requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw AdminApiException.badRequest(field + " is required");
		}
	}

	private String newId(String prefix, String name) {
		String slug = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
		if (slug.length() > 24) {
			slug = slug.substring(0, 24).replaceAll("-$", "");
		}
		byte[] b = new byte[2];
		random.nextBytes(b);
		return prefix + "-" + (slug.isEmpty() ? "site" : slug) + "-" + HexFormat.of().formatHex(b);
	}
}
