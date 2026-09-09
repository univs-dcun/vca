package ai.univs.vca.admin.roster;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.audit.AuditService;
import ai.univs.vca.admin.security.ProjectScope;
import ai.univs.vca.admin.auth.RegistrationCodes;
import ai.univs.vca.admin.org.ProjectRepository;
import ai.univs.vca.admin.roster.RosterDtos.BulkResponse;
import ai.univs.vca.admin.roster.RosterDtos.BulkRowResult;
import ai.univs.vca.admin.roster.RosterDtos.IssuedRosterCode;
import ai.univs.vca.admin.roster.RosterDtos.RosterEntryRequest;
import ai.univs.vca.admin.roster.RosterDtos.RosterRow;
import ai.univs.vca.admin.roster.RosterEntryEntity.Permission;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 명부 관리 (UV-51). 기획자 staffRoster.ts HANDOFF 집행 지점:
 *   single-use(활성화 시 소진) · 14일 만료(issuedAt 기준) · 재발급은 이전 코드 즉시 무효 · employeeId 전역 유일.
 * 시도 스로틀은 RegistrationService(조회/활성화 쪽).
 */
@Service
public class RosterService {

	private final RosterRepository roster;
	private final ProjectRepository projects;
	private final AuditService audit;

	public RosterService(RosterRepository roster, ProjectRepository projects, AuditService audit) {
		this.roster = roster;
		this.projects = projects;
		this.audit = audit;
	}

	@Transactional(readOnly = true)
	public List<RosterRow> list(String projectId) {
		Set<String> scope = ProjectScope.current().narrow(projectId);
		List<RosterEntryEntity> rows = scope == null ? roster.findAllByOrderByNameAsc()
				: roster.findByProjectIdInOrderByNameAsc(scope);
		return rows.stream().map(RosterRow::of).toList();
	}

	/** 벌크 추가 — 행별 판정. employeeId는 명부 전역(프로젝트 무관) 유일 */
	@Transactional
	public BulkResponse addAll(String projectId, List<RosterEntryRequest> entries) {
		if (projectId == null || !projects.existsById(projectId)) {
			throw AdminApiException.projectNotFound(projectId == null ? "" : projectId);
		}
		ProjectScope.current().require(projectId);
		if (entries == null || entries.isEmpty()) {
			throw AdminApiException.badRequest("entries is required");
		}
		List<BulkRowResult> results = new ArrayList<>();
		Set<String> seenInBatch = new HashSet<>();
		int added = 0;
		for (RosterEntryRequest r : entries) {
			String employeeId = normalizeEmployeeId(r.employeeId());
			if (employeeId == null) {
				results.add(new BulkRowResult(r.employeeId(), false, "missing-employee-id"));
				continue;
			}
			if (r.name() == null || r.name().isBlank()) {
				results.add(new BulkRowResult(employeeId, false, "missing-name"));
				continue;
			}
			if (!seenInBatch.add(employeeId)) {
				results.add(new BulkRowResult(employeeId, false, "duplicate-in-file"));
				continue;
			}
			if (roster.existsById(employeeId)) {
				results.add(new BulkRowResult(employeeId, false, "duplicate-in-roster"));
				continue;
			}
			Permission permission;
			try {
				permission = Permission.fromJson(r.permission());
			}
			catch (IllegalArgumentException e) {
				results.add(new BulkRowResult(employeeId, false, "bad-permission"));
				continue;
			}
			roster.save(new RosterEntryEntity(employeeId, projectId, r.name().trim(),
					blankToNull(r.department()), blankToNull(r.email()), permission));
			results.add(new BulkRowResult(employeeId, true, null));
			added++;
		}
		if (added > 0) {
			audit.record(projectId, added + " staff added to roster");
		}
		return new BulkResponse(added, results.size() - added, results);
	}

	@Transactional
	public RosterRow update(String employeeId, RosterEntryRequest r) {
		RosterEntryEntity e = requireInScope(employeeId);
		if (r.name() == null || r.name().isBlank()) {
			throw AdminApiException.badRequest("name is required");
		}
		Permission permission;
		try {
			permission = r.permission() == null ? e.getPermission() : Permission.fromJson(r.permission());
		}
		catch (IllegalArgumentException ex) {
			throw AdminApiException.badRequest("permission must be admin or operator");
		}
		e.update(r.name().trim(), blankToNull(r.department()), blankToNull(r.email()), permission);
		audit.record(e.getProjectId(), "Roster entry " + e.getName() + " (" + e.getEmployeeId() + ") updated");
		return RosterRow.of(e);
	}

	/** 행 삭제 = 미사용 코드를 죽이는 유일한 수단 (별도 revoke 없음 — 기획자 모델과 동일) */
	@Transactional
	public void delete(String employeeId) {
		RosterEntryEntity e = requireInScope(employeeId);
		roster.delete(e);
		audit.record(e.getProjectId(), "Roster entry " + e.getName() + " (" + e.getEmployeeId() + ") removed"
				+ (e.effectiveStatus().equals("unused") ? " — unused code revoked" : ""));
	}

	/** 일괄 발급 — 이미 유효한 코드가 있는 행은 건드리지 않는다(재발급은 별도). 사용 완료 행도 건너뛴다 */
	@Transactional
	public List<IssuedRosterCode> issueCodes(List<String> employeeIds) {
		if (employeeIds == null || employeeIds.isEmpty()) {
			throw AdminApiException.badRequest("employeeIds is required");
		}
		List<IssuedRosterCode> issued = new ArrayList<>();
		for (String raw : employeeIds) {
			RosterEntryEntity e = requireInScope(normalizeEmployeeId(raw));
			String status = e.effectiveStatus();
			if (status.equals("unused") || status.equals("used")) {
				continue;
			}
			issued.add(issue(e));
		}
		if (!issued.isEmpty()) {
			audit.record(issued.size() == 1 ? require(issued.get(0).employeeId()).getProjectId() : null,
					issued.size() + " registration code(s) issued");
		}
		return issued;
	}

	/** 재발급 — 이전 코드 즉시 무효, 시계 재시작 */
	@Transactional
	public IssuedRosterCode reissueCode(String employeeId) {
		RosterEntryEntity e = requireInScope(employeeId);
		if (e.getStatus() == RosterEntryEntity.Status.USED) {
			throw AdminApiException.badRequest("entry already activated — manage the account instead");
		}
		IssuedRosterCode code = issue(e);
		audit.record(e.getProjectId(), "Registration code reissued for " + e.getName() + " (" + e.getEmployeeId() + ")");
		return code;
	}

	private IssuedRosterCode issue(RosterEntryEntity e) {
		String code;
		do {
			code = RegistrationCodes.generate();
		}
		while (roster.findByCodeHash(RegistrationCodes.hash(code)).isPresent());
		e.issueCode(RegistrationCodes.hash(code));
		return new IssuedRosterCode(e.getEmployeeId(), e.getName(), code, RegistrationCodes.format(code),
				e.getCodeIssuedAt(), e.getCodeIssuedAt().plus(RosterEntryEntity.CODE_TTL));
	}

	/** 범위 밖 명부 행은 403 (UV-58) */
	private RosterEntryEntity requireInScope(String employeeId) {
		RosterEntryEntity e = require(employeeId);
		ProjectScope.current().require(e.getProjectId());
		return e;
	}

	private RosterEntryEntity require(String employeeId) {
		if (employeeId == null) {
			throw AdminApiException.badRequest("employeeId is required");
		}
		return roster.findById(employeeId)
			.orElseThrow(() -> new AdminApiException(org.springframework.http.HttpStatus.NOT_FOUND, "ADM-4044",
					"unknown roster employeeId: " + employeeId));
	}

	static String normalizeEmployeeId(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim().toUpperCase(Locale.ROOT);
	}

	private static String blankToNull(String v) {
		return v == null || v.isBlank() ? null : v.trim();
	}
}
