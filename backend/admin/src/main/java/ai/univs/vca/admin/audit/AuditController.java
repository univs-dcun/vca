package ai.univs.vca.admin.audit;

import ai.univs.vca.admin.ApiEnvelope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 감사 로그 조회 — Portal Overview "Recent admin activity" / 감사 로그 모달. 읽기라 콘솔 역할 3종 모두 가능 */
@RestController
@RequestMapping("/admin/api/audit")
public class AuditController {

	private final AuditService service;

	public AuditController(AuditService service) {
		this.service = service;
	}

	@GetMapping
	public ApiEnvelope recent(@RequestParam(required = false) String projectId,
			@RequestParam(defaultValue = "50") int limit) {
		return ApiEnvelope.ok(service.recent(projectId, limit));
	}
}
