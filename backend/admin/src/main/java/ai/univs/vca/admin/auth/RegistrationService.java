package ai.univs.vca.admin.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.audit.AuditService;
import ai.univs.vca.admin.auth.AuthDtos.CodeLookupResponse;
import ai.univs.vca.admin.auth.AuthDtos.SignupRequest;
import ai.univs.vca.admin.auth.AuthService.LoginResult;
import ai.univs.vca.admin.org.ProjectEntity;
import ai.univs.vca.admin.org.ProjectRepository;
import ai.univs.vca.admin.org.TeamEntity;
import ai.univs.vca.admin.org.TeamRepository;
import ai.univs.vca.admin.roster.RosterEntryEntity;
import ai.univs.vca.admin.roster.RosterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 계정 활성화 경로 3종 (UV-51, design-vca-portal.md §4.2·§4.3·§4.4):
 *   등록 코드 — 명부 코드(신규 계정) 또는 셋업 코드(기존 invited 계정). 단일 조회 엔드포인트가 풀을 판별,
 *              활성화는 코드 소각 + 계정 생성/활성화 + 비밀번호 설정 + 세션 발급이 한 트랜잭션
 *   초대 토큰 — /password-setup?token= (7일, single-use)
 *   self-signup — 온프레미스는 거절. 최상위 관리자가 이미 있으면 플래그와 무관하게 거절
 *
 * 조회/활성화 실패는 주소(IP) 단위로 카운트해 5회 초과 시 throttled(ADM-4023).
 */
@Service
public class RegistrationService {

	public static final Duration SETUP_CODE_TTL = Duration.ofDays(14);
	public static final Duration INVITE_TOKEN_TTL = Duration.ofDays(7);

	private final UserAccountRepository users;
	private final RosterRepository roster;
	private final ProjectRepository projects;
	private final TeamRepository teams;
	private final AuthService authService;
	private final AttemptService attempts;
	private final AuditService audit;
	private final AdminProperties props;

	public RegistrationService(UserAccountRepository users, RosterRepository roster, ProjectRepository projects,
			TeamRepository teams, AuthService authService, AttemptService attempts, AuditService audit,
			AdminProperties props) {
		this.users = users;
		this.roster = roster;
		this.projects = projects;
		this.teams = teams;
		this.authService = authService;
		this.attempts = attempts;
		this.audit = audit;
		this.props = props;
	}

	/** 조회된 코드의 실체 — 둘 중 하나만 non-null */
	private record Resolved(RosterEntryEntity rosterEntry, UserAccountEntity setupUser) {
	}

	@Transactional(readOnly = true)
	public CodeLookupResponse lookup(String rawCode, String ip) {
		Resolved r = resolve(rawCode, ip);
		if (r.rosterEntry() != null) {
			RosterEntryEntity e = r.rosterEntry();
			String projectName = projects.findById(e.getProjectId()).map(ProjectEntity::getName).orElse(null);
			return new CodeLookupResponse("roster", e.getName(), e.getEmployeeId(), e.getPermission().json(),
					e.getProjectId(), projectName);
		}
		UserAccountEntity u = r.setupUser();
		String projectId = u.getProjectIds().isEmpty() ? null : u.getProjectIds().get(0);
		String projectName = projectId == null ? null
				: projects.findById(projectId).map(ProjectEntity::getName).orElse(null);
		return new CodeLookupResponse("setup", u.getName(), u.getEmployeeId(),
				u.getPermission().canEnterPortal() ? "admin" : "operator", projectId, projectName);
	}

	/** 활성화 — 하나의 트랜잭션: 코드 소각 + 계정 생성/활성화 + 비밀번호 + 세션 */
	@Transactional
	public LoginResult register(String rawCode, String password, String ip) {
		Resolved r = resolve(rawCode, ip);
		AuthService.validateFormat(password);
		UserAccountEntity user;
		if (r.rosterEntry() != null) {
			RosterEntryEntity e = r.rosterEntry();
			String email = e.getEmail() == null ? null : e.getEmail().trim().toLowerCase(Locale.ROOT);
			if (email != null && users.findByEmail(email).isPresent()) {
				throw AdminApiException.emailInUse(email);
			}
			if (users.findByEmployeeId(e.getEmployeeId()).isPresent()) {
				throw AdminApiException.employeeIdInUse(e.getEmployeeId());
			}
			// 명부 2값 → 계정 모델: admin → 콘솔 admin(+앱), operator → 콘솔 없음(none) + 앱
			boolean admin = e.getPermission() == RosterEntryEntity.Permission.ADMIN;
			String teamId = projects.findById(e.getProjectId()).map(ProjectEntity::getTeamId).orElse(null);
			user = new UserAccountEntity(email, e.getEmployeeId(), e.getName(), authService.encode(password),
					"VCA-OPS-" + e.getEmployeeId().replaceAll("[^A-Z0-9]", ""), "",
					e.getDepartment() == null ? "" : e.getDepartment(),
					admin ? PortalPermission.ADMIN : PortalPermission.NONE, true, false, AccountStatus.ACTIVE,
					teamId, List.of(e.getProjectId()));
			users.save(user);
			e.markUsed(user.getId());
			audit.recordAs(e.getProjectId(), user.getId(), user.getName(), e.getName() + " activated account with registration code");
		}
		else {
			user = r.setupUser();
			user.activate(authService.encode(password));
			audit.recordAs(null, user.getId(), user.getName(), user.getName() + " activated account with setup code");
		}
		attempts.clear(AttemptService.codeKey(ip));
		return authService.startSession(user, false);
	}

	/** 초대 링크 — 토큰 해시 조회, 7일, 사용 시 소진 */
	@Transactional
	public LoginResult redeemInvite(String token, String password) {
		if (token == null || token.isBlank()) {
			throw AdminApiException.inviteInvalid();
		}
		UserAccountEntity user = users.findByInviteTokenHash(Hashes.sha256("invite:" + token.trim()))
			.orElseThrow(AdminApiException::inviteInvalid);
		if (user.getInviteTokenIssuedAt() == null
				|| user.getInviteTokenIssuedAt().plus(INVITE_TOKEN_TTL).isBefore(Instant.now())) {
			throw AdminApiException.inviteInvalid();
		}
		if (user.getStatus() == AccountStatus.SUSPENDED) {
			throw AdminApiException.accountSuspended();
		}
		AuthService.validateFormat(password);
		user.activate(authService.encode(password));
		audit.recordAs(null, user.getId(), user.getName(), user.getName() + " activated account via invite link");
		return authService.startSession(user, false);
	}

	/** 조직 자체 생성 — 플래그 off 또는 owner 존재 시 거절. 허용 시 팀 + owner 계정 + 세션 */
	@Transactional
	public LoginResult signup(SignupRequest req) {
		if (!props.selfSignup() || users.countByPermission(PortalPermission.OWNER) > 0) {
			throw AdminApiException.selfSignupDisabled();
		}
		if (req.name() == null || req.name().isBlank() || req.email() == null || req.email().isBlank()
				|| req.teamName() == null || req.teamName().isBlank()) {
			throw AdminApiException.badRequest("name, email and teamName are required");
		}
		AuthService.validateFormat(req.password());
		String email = req.email().trim().toLowerCase(Locale.ROOT);
		if (users.findByEmail(email).isPresent()) {
			throw AdminApiException.emailInUse(email);
		}
		TeamEntity team = new TeamEntity("team-" + req.teamName().toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", ""), req.teamName().trim(),
				req.region() == null ? "" : req.region().trim(), null, null, null, null);
		teams.save(team);
		UserAccountEntity owner = new UserAccountEntity(email, null, req.name().trim(),
				authService.encode(req.password()), "VCA-ADMIN-" + (1000 + (int) (Math.random() * 9000)), "", "",
				PortalPermission.OWNER, true, true, AccountStatus.ACTIVE, team.getId(), List.of());
		users.save(owner);
		audit.recordAs(null, owner.getId(), owner.getName(), "Organization " + team.getName() + " created by self-signup");
		return authService.startSession(owner, false);
	}

	/** 두 풀을 순서대로 조회 — 실패는 IP 카운트, 잠기면 throttled. 사용됨/만료는 구분해 알린다(8자를 맞춘 사람에게만) */
	private Resolved resolve(String rawCode, String ip) {
		String key = AttemptService.codeKey(ip);
		if (attempts.isLocked(key)) {
			throw AdminApiException.codeThrottled();
		}
		String code = RegistrationCodes.normalize(rawCode);
		if (code == null) {
			attempts.recordFailure(key);
			throw AdminApiException.codeUnknown();
		}
		String hash = RegistrationCodes.hash(code);
		Optional<RosterEntryEntity> entry = roster.findByCodeHash(hash);
		if (entry.isPresent()) {
			RosterEntryEntity e = entry.get();
			if (e.getStatus() == RosterEntryEntity.Status.USED) {
				throw AdminApiException.codeUsed();
			}
			if (e.isCodeExpired()) {
				throw AdminApiException.codeExpired();
			}
			return new Resolved(e, null);
		}
		Optional<UserAccountEntity> setup = users.findBySetupCodeHash(hash);
		if (setup.isPresent()) {
			UserAccountEntity u = setup.get();
			if (u.getStatus() != AccountStatus.INVITED) {
				throw AdminApiException.codeUsed();
			}
			if (u.getSetupCodeIssuedAt() == null || u.getSetupCodeIssuedAt().plus(SETUP_CODE_TTL).isBefore(Instant.now())) {
				throw AdminApiException.codeExpired();
			}
			return new Resolved(null, u);
		}
		attempts.recordFailure(key);
		throw AdminApiException.codeUnknown();
	}
}
