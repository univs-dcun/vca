package ai.univs.vca.admin.roster;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.roster.RosterDtos.BulkRequest;
import ai.univs.vca.admin.roster.RosterDtos.IssueCodesRequest;
import ai.univs.vca.admin.roster.RosterDtos.RosterEntryRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 명부 API (UV-51) — Portal Users & Permissions › On the roster. 명부는 설치 설정이라 owner|admin
 * (SessionInterceptor 기본 규칙). 코드 원문은 발급/재발급 응답에서만 — 저장은 해시라 "다시 보기"는 없다
 * (기획 확인: 화면의 코드 눈 아이콘은 발급 직후 표시로 조정 필요).
 */
@RestController
@RequestMapping("/admin/api/roster")
public class RosterController {

	private final RosterService service;

	public RosterController(RosterService service) {
		this.service = service;
	}

	@GetMapping
	public ApiEnvelope list(@RequestParam(required = false) String projectId) {
		return ApiEnvelope.ok(service.list(projectId));
	}

	/** 벌크 추가(CSV import 결과 커밋) — 행별 결과 */
	@PostMapping
	public ApiEnvelope addAll(@RequestBody BulkRequest req) {
		return ApiEnvelope.ok(service.addAll(req.projectId(), req.entries()));
	}

	@PutMapping("/{employeeId}")
	public ApiEnvelope update(@PathVariable String employeeId, @RequestBody RosterEntryRequest req) {
		return ApiEnvelope.ok(service.update(RosterService.normalizeEmployeeId(employeeId), req));
	}

	@DeleteMapping("/{employeeId}")
	public ApiEnvelope delete(@PathVariable String employeeId) {
		service.delete(RosterService.normalizeEmployeeId(employeeId));
		return ApiEnvelope.ok(null);
	}

	/** 일괄 발급 — 응답의 code는 1회만 노출 */
	@PostMapping("/codes/issue")
	public ApiEnvelope issueCodes(@RequestBody IssueCodesRequest req) {
		return ApiEnvelope.ok(service.issueCodes(req.employeeIds()));
	}

	@PostMapping("/{employeeId}/codes/reissue")
	public ApiEnvelope reissueCode(@PathVariable String employeeId) {
		return ApiEnvelope.ok(service.reissueCode(RosterService.normalizeEmployeeId(employeeId)));
	}
}
