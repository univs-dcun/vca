package ai.univs.vca.admin.org;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.org.OrgDtos.LicenseRequest;
import ai.univs.vca.admin.org.OrgDtos.MailRequest;
import ai.univs.vca.admin.org.OrgDtos.NetworkIsolationRequest;
import ai.univs.vca.admin.org.OrgDtos.ProjectRequest;
import ai.univs.vca.admin.org.OrgDtos.TeamRequest;
import ai.univs.vca.admin.org.OrgDtos.TimeZoneRequest;
import ai.univs.vca.admin.security.RequiresOwner;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 팀·프로젝트 API (UV-50) — Portal 셸(팀/프로젝트 전환)·새 프로젝트 마법사·License·Mail & Network·My page 타임존 */
@RestController
@RequestMapping("/admin/api")
public class OrgController {

	private final OrgService service;

	public OrgController(OrgService service) {
		this.service = service;
	}

	@GetMapping("/teams")
	public ApiEnvelope listTeams() {
		return ApiEnvelope.ok(service.listTeams());
	}

	@GetMapping("/teams/{teamId}")
	public ApiEnvelope getTeam(@PathVariable String teamId) {
		return ApiEnvelope.ok(service.getTeam(teamId));
	}

	/** 새 팀은 정의상 모든 비owner의 범위 밖 — owner만 만든다 (UV-58) */
	@RequiresOwner
	@PostMapping("/teams")
	public ResponseEntity<ApiEnvelope> createTeam(@RequestBody TeamRequest req) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiEnvelope.ok(service.createTeam(req)));
	}

	@PutMapping("/teams/{teamId}")
	public ApiEnvelope updateTeam(@PathVariable String teamId, @RequestBody TeamRequest req) {
		return ApiEnvelope.ok(service.updateTeam(teamId, req));
	}

	@PutMapping("/teams/{teamId}/mail")
	public ApiEnvelope updateTeamMail(@PathVariable String teamId, @RequestBody MailRequest req) {
		return ApiEnvelope.ok(service.updateTeamMail(teamId, req));
	}

	@GetMapping("/projects")
	public ApiEnvelope listProjects(@RequestParam(required = false) String teamId) {
		return ApiEnvelope.ok(service.listProjects(teamId));
	}

	@GetMapping("/projects/{projectId}")
	public ApiEnvelope getProject(@PathVariable String projectId) {
		return ApiEnvelope.ok(service.getProject(projectId));
	}

	@PostMapping("/projects")
	public ResponseEntity<ApiEnvelope> createProject(@RequestBody ProjectRequest req) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiEnvelope.ok(service.createProject(req)));
	}

	@PutMapping("/projects/{projectId}")
	public ApiEnvelope updateProject(@PathVariable String projectId, @RequestBody ProjectRequest req) {
		return ApiEnvelope.ok(service.updateProject(projectId, req));
	}

	@PutMapping("/projects/{projectId}/license")
	public ApiEnvelope updateLicense(@PathVariable String projectId, @RequestBody LicenseRequest req) {
		return ApiEnvelope.ok(service.updateLicense(projectId, req));
	}

	@PutMapping("/projects/{projectId}/mail")
	public ApiEnvelope updateProjectMail(@PathVariable String projectId, @RequestBody MailRequest req) {
		return ApiEnvelope.ok(service.updateProjectMail(projectId, req));
	}

	@PutMapping("/projects/{projectId}/timezone")
	public ApiEnvelope updateTimeZone(@PathVariable String projectId, @RequestBody TimeZoneRequest req) {
		return ApiEnvelope.ok(service.updateTimeZone(projectId, req.timeZone()));
	}

	@PutMapping("/projects/{projectId}/network-isolation")
	public ApiEnvelope updateNetworkIsolation(@PathVariable String projectId,
			@RequestBody NetworkIsolationRequest req) {
		return ApiEnvelope.ok(service.updateNetworkIsolation(projectId, req.override()));
	}
}
