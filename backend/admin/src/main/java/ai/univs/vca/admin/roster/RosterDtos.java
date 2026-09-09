package ai.univs.vca.admin.roster;

import java.time.Instant;
import java.util.List;

/** 명부 계약 DTO (admin-api.json roster 그룹, UV-51) */
public final class RosterDtos {

	private RosterDtos() {
	}

	public record RosterEntryRequest(String employeeId, String name, String department, String email,
			String permission) {
	}

	/** 벌크 import — 프론트가 CSV를 파싱해 정규화된 행을 보낸다. 행별 결과로 부분 성공을 알린다 */
	public record BulkRequest(String projectId, List<RosterEntryRequest> entries) {
	}

	public record BulkRowResult(String employeeId, boolean ok, String reason) {
	}

	public record BulkResponse(int added, int rejected, List<BulkRowResult> rows) {
	}

	public record IssueCodesRequest(List<String> employeeIds) {
	}

	/** 발급 응답 — code는 이 응답에서 단 한 번만 노출된다(해시만 저장). 인쇄용 슬립은 이 시점에 만든다 */
	public record IssuedRosterCode(String employeeId, String name, String code, String codeFormatted,
			Instant issuedAt, Instant expiresAt) {
	}

	public record RosterRow(String employeeId, String projectId, String name, String department, String email,
			String permission, String status, Instant codeIssuedAt, Instant codeExpiresAt, Instant usedAt,
			Long userId, Instant createdAt) {

		static RosterRow of(RosterEntryEntity e) {
			return new RosterRow(e.getEmployeeId(), e.getProjectId(), e.getName(), e.getDepartment(), e.getEmail(),
					e.getPermission().json(), e.effectiveStatus(), e.getCodeIssuedAt(),
					e.getCodeIssuedAt() == null ? null : e.getCodeIssuedAt().plus(RosterEntryEntity.CODE_TTL),
					e.getUsedAt(), e.getUserId(), e.getCreatedAt());
		}
	}
}
