package ai.univs.vca.admin.security;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.auth.PortalPermission;
import ai.univs.vca.admin.auth.UserAccountEntity;

/**
 * 세션 사용자의 프로젝트 가시 범위 (UV-58, 기획 확정 2026-09-09 "기획이 정한 6건" 4번).
 *
 *   owner            → 무제한 (설치 전체)
 *   admin · auditor  → 배정된 프로젝트(user_project)만. auditor는 읽기 전용이어도 범위는 배정까지
 *   세션 밖(시더·스케줄러·메일 발송) → 무제한 (사람이 아닌 서버 자신의 행위)
 *
 * 프론트 필터는 화면 편의일 뿐 요청을 막지 못한다 — 실제 차단은 여기서 한다. 범위 밖 프로젝트는
 * 존재 여부를 알려주지 않기 위해 404가 아니라 403 ADM-4033으로 응답한다(4030은 "역할 없음"과 구분).
 * 팀 범위는 자기 teamId 하나 — 한 설치에 팀이 여럿인 이유가 서로의 현장을 안 보는 것이므로.
 */
public final class ProjectScope {

	private static final ProjectScope UNRESTRICTED = new ProjectScope(true, Set.of(), null);

	private final boolean unrestricted;
	private final Set<String> allowed;
	private final String teamId;

	private ProjectScope(boolean unrestricted, Set<String> allowed, String teamId) {
		this.unrestricted = unrestricted;
		this.allowed = allowed;
		this.teamId = teamId;
	}

	/** 요청 스레드의 범위. SessionInterceptor가 심은 사용자가 없으면(세션 밖) 무제한 */
	public static ProjectScope current() {
		UserAccountEntity u = CurrentUser.get();
		if (u == null || u.getPermission() == PortalPermission.OWNER) {
			return UNRESTRICTED;
		}
		return new ProjectScope(false, new LinkedHashSet<>(u.getProjectIds()), u.getTeamId());
	}

	public boolean isUnrestricted() {
		return unrestricted;
	}

	/** null projectId(프로젝트 무관 데이터)는 owner에게만 보인다 */
	public boolean allows(String projectId) {
		return unrestricted || (projectId != null && allowed.contains(projectId));
	}

	public String require(String projectId) {
		if (!allows(projectId)) {
			throw AdminApiException.projectForbidden(projectId);
		}
		return projectId;
	}

	/** 요청에 projectId가 없을 때 조회할 프로젝트 집합 — 무제한이면 null(전체), 아니면 허용 목록(비어 있을 수 있음) */
	public Set<String> allowedIds() {
		return unrestricted ? null : allowed;
	}

	/** 요청 projectId를 범위에 맞춰 해석 — 지정되면 검사 후 그 하나, 생략이면 allowedIds() */
	public Set<String> narrow(String projectId) {
		if (projectId != null && !projectId.isBlank()) {
			return Set.of(require(projectId));
		}
		return allowedIds();
	}

	public boolean allowsAny(Collection<String> projectIds) {
		if (unrestricted) {
			return true;
		}
		return projectIds != null && projectIds.stream().anyMatch(allowed::contains);
	}

	public boolean allowsTeam(String teamId) {
		return unrestricted || (teamId != null && teamId.equals(this.teamId));
	}

	public String requireTeam(String teamId) {
		if (!allowsTeam(teamId)) {
			throw AdminApiException.teamForbidden(teamId);
		}
		return teamId;
	}

	/** 비owner의 기본 프로젝트 — 배정이 정확히 하나일 때만 생략을 허용한다 */
	public String soleProjectOrNull() {
		return !unrestricted && allowed.size() == 1 ? allowed.iterator().next() : null;
	}
}
