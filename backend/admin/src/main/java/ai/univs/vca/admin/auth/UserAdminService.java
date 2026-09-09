package ai.univs.vca.admin.auth;

import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.audit.AuditService;
import ai.univs.vca.admin.auth.AuthDtos.CreateUserRequest;
import ai.univs.vca.admin.auth.AuthDtos.IssuedUser;
import ai.univs.vca.admin.auth.AuthDtos.UserRow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 계정 관리 (UV-48 발급 → UV-50 Portal 권한 모델). Portal Users & Permissions 화면이 호출하는 API의 서비스.
 *
 * 규칙 (design-vca-portal.md §3.2):
 * - 계정은 콘솔 역할 또는 앱 접근 중 하나는 있어야 한다 (아무도 못 쓰는 계정 거부)
 * - last-owner 가드: 활성 owner가 0명이 되는 변경(권한 강등·정지·삭제)은 거부
 * - 임시 비밀번호는 서버가 생성해 발급 응답에서 단 한 번만 노출 — DB에는 BCrypt 해시만
 */
@Service
public class UserAdminService {

	/** 형식 규칙(8자+영문+숫자+특수문자)을 항상 만족하도록 그룹별로 뽑는다 */
	private static final String LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
	private static final String DIGITS = "23456789";
	private static final String SPECIALS = "!@#$%^*-_";
	private static final int TEMP_PASSWORD_LENGTH = 12;

	private final UserAccountRepository users;
	private final UserSessionRepository sessions;
	private final AuthService authService;
	private final AuditService audit;
	private final SecureRandom random = new SecureRandom();

	public UserAdminService(UserAccountRepository users, UserSessionRepository sessions, AuthService authService,
			AuditService audit) {
		this.users = users;
		this.sessions = sessions;
		this.authService = authService;
		this.audit = audit;
	}

	@Transactional
	public IssuedUser create(CreateUserRequest request) {
		if (request.name() == null || request.name().isBlank()) {
			throw AdminApiException.badRequest("name is required");
		}
		String email = normalize(request.email());
		String employeeId = normalizeEmployeeId(request.employeeId());
		if (email == null && employeeId == null) {
			throw AdminApiException.badRequest("email or employeeId is required");
		}
		if (email != null && users.findByEmail(email).isPresent()) {
			throw AdminApiException.emailInUse(email);
		}
		if (employeeId != null && users.findByEmployeeId(employeeId).isPresent()) {
			throw AdminApiException.employeeIdInUse(employeeId);
		}
		PortalPermission permission = parsePermission(request.permission(), PortalPermission.NONE);
		boolean appAccess = request.appAccess() == null ? !permission.canEnterPortal() : request.appAccess();
		requireSomeAccess(permission, appAccess);

		String tempPassword = generateTempPassword();
		String tempPasswordHash = authService.encode(tempPassword);
		String accountId = request.accountId() != null && !request.accountId().isBlank()
				? request.accountId().trim()
				: "VCA-OPS-" + (1000 + random.nextInt(9000));
		UserAccountEntity user = new UserAccountEntity(email, employeeId, request.name().trim(), tempPasswordHash,
				accountId, request.role() == null ? "" : request.role().trim(),
				request.team() == null ? "" : request.team().trim(), permission, appAccess,
				Boolean.TRUE.equals(request.appSearch()), AccountStatus.ACTIVE, request.teamId(),
				request.projectIds());
		user.issueTemporaryPassword(tempPasswordHash); // mustSetPassword = true
		users.save(user);
		audit.record(null, "Account " + user.getName() + " created (" + permission.json()
				+ (appAccess ? ", app" : "") + ")");
		return new IssuedUser(user.getId(), user.getEmail(), user.getEmployeeId(), user.getName(),
				user.getAccountId(), tempPassword);
	}

	/** 비밀번호 분실 대응 — 새 임시 비밀번호 발급 + 기존 세션 전부 무효화 + Set Password 강제 복귀 */
	@Transactional
	public IssuedUser resetPassword(Long userId) {
		UserAccountEntity user = require(userId);
		String tempPassword = generateTempPassword();
		user.issueTemporaryPassword(authService.encode(tempPassword));
		sessions.deleteOtherSessions(user.getId(), ""); // keepTokenHash 불일치 → 전 세션 삭제
		audit.record(null, "Temporary password issued for " + user.getName());
		return new IssuedUser(user.getId(), user.getEmail(), user.getEmployeeId(), user.getName(),
				user.getAccountId(), tempPassword);
	}

	@Transactional
	public UserRow updateAccess(Long userId, String permissionJson, Boolean appAccess) {
		UserAccountEntity user = require(userId);
		PortalPermission permission = parsePermission(permissionJson, user.getPermission());
		boolean access = appAccess == null ? user.isAppAccess() : appAccess;
		requireSomeAccess(permission, access);
		if (user.getPermission() == PortalPermission.OWNER && permission != PortalPermission.OWNER) {
			guardLastOwner(user);
		}
		user.updateAccess(permission, access);
		audit.record(null, "Access for " + user.getName() + " set to " + permission.json()
				+ (access ? " + app" : ", no app"));
		return UserRow.of(user);
	}

	@Transactional
	public UserRow setAppSearch(Long userId, boolean allowed) {
		UserAccountEntity user = require(userId);
		user.setAppSearch(allowed);
		audit.record(null, "App search " + (allowed ? "granted to " : "revoked from ") + user.getName());
		return UserRow.of(user);
	}

	@Transactional
	public UserRow updateProjects(Long userId, List<String> projectIds) {
		UserAccountEntity user = require(userId);
		user.setProjectIds(projectIds == null ? List.of() : projectIds);
		audit.record(null, "Project scope for " + user.getName() + " set to " + user.getProjectIds().size()
				+ " project(s)");
		return UserRow.of(user);
	}

	@Transactional
	public UserRow updateStatus(Long userId, String statusJson) {
		UserAccountEntity user = require(userId);
		AccountStatus status;
		try {
			status = AccountStatus.fromJson(statusJson);
		}
		catch (IllegalArgumentException e) {
			throw AdminApiException.badRequest("status must be active, invited or suspended");
		}
		if (status == null) {
			throw AdminApiException.badRequest("status is required");
		}
		if (status != AccountStatus.ACTIVE && user.getPermission() == PortalPermission.OWNER) {
			guardLastOwner(user);
		}
		user.setStatus(status);
		if (status == AccountStatus.SUSPENDED) {
			sessions.deleteOtherSessions(user.getId(), ""); // 정지 즉시 로그아웃
		}
		audit.record(null, user.getName() + "'s account " + status.json());
		return UserRow.of(user);
	}

	@Transactional
	public void delete(Long userId) {
		UserAccountEntity user = require(userId);
		if (user.getPermission() == PortalPermission.OWNER) {
			guardLastOwner(user);
		}
		sessions.deleteOtherSessions(user.getId(), "");
		users.delete(user);
		audit.record(null, "Account " + user.getName() + " removed");
	}

	@Transactional(readOnly = true)
	public List<UserRow> list() {
		return users.findAll().stream().map(UserRow::of).toList();
	}

	private UserAccountEntity require(Long userId) {
		return users.findById(userId).orElseThrow(() -> AdminApiException.userNotFound(userId));
	}

	/** 이 계정이 마지막 활성 owner이면 강등·정지·삭제를 거부 */
	private void guardLastOwner(UserAccountEntity user) {
		if (user.getStatus() == AccountStatus.ACTIVE
				&& users.countByPermissionAndStatus(PortalPermission.OWNER, AccountStatus.ACTIVE) <= 1) {
			throw AdminApiException.lastOwner();
		}
	}

	private static void requireSomeAccess(PortalPermission permission, boolean appAccess) {
		if (!permission.canEnterPortal() && !appAccess) {
			throw AdminApiException.badRequest("account needs a console role or app access");
		}
	}

	private static PortalPermission parsePermission(String json, PortalPermission fallback) {
		if (json == null || json.isBlank()) {
			return fallback;
		}
		try {
			return PortalPermission.fromJson(json);
		}
		catch (IllegalArgumentException e) {
			throw AdminApiException.badRequest("permission must be owner, admin, auditor or none");
		}
	}

	private static String normalize(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim().toLowerCase(Locale.ROOT);
	}

	/** 사번은 대문자 정규화 — 로스터/화면 표기(EMP-3004)와 같은 형태로 저장, 로그인은 대소문자 무관 */
	static String normalizeEmployeeId(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim().toUpperCase(Locale.ROOT);
	}

	private String generateTempPassword() {
		StringBuilder sb = new StringBuilder(TEMP_PASSWORD_LENGTH);
		sb.append(pick(LETTERS)).append(pick(DIGITS)).append(pick(SPECIALS));
		String all = LETTERS + DIGITS + SPECIALS;
		while (sb.length() < TEMP_PASSWORD_LENGTH) {
			sb.append(pick(all));
		}
		// 그룹 보장 3자가 항상 앞에 오지 않도록 섞는다
		char[] chars = sb.toString().toCharArray();
		for (int i = chars.length - 1; i > 0; i--) {
			int j = random.nextInt(i + 1);
			char tmp = chars[i];
			chars[i] = chars[j];
			chars[j] = tmp;
		}
		return new String(chars);
	}

	private char pick(String pool) {
		return pool.charAt(random.nextInt(pool.length()));
	}
}
