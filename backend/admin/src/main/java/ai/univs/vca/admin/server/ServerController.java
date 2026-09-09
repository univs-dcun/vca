package ai.univs.vca.admin.server;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.server.ServerDtos.ServerRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 서버 레지스트리 API (UV-53) — Portal Server & API › Infrastructure. owner|admin(변경) / 콘솔 역할(조회) */
@RestController
@RequestMapping("/admin/api/servers")
public class ServerController {

	private final ServerService service;

	public ServerController(ServerService service) {
		this.service = service;
	}

	@GetMapping
	public ApiEnvelope list(@RequestParam(required = false) String projectId) {
		return ApiEnvelope.ok(service.list(projectId));
	}

	@PostMapping
	public ResponseEntity<ApiEnvelope> create(@RequestBody ServerRequest req) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiEnvelope.ok(service.create(req)));
	}

	@PutMapping("/{serverId}")
	public ApiEnvelope update(@PathVariable String serverId, @RequestBody ServerRequest req) {
		return ApiEnvelope.ok(service.update(serverId, req));
	}

	@DeleteMapping("/{serverId}")
	public ApiEnvelope delete(@PathVariable String serverId) {
		service.delete(serverId);
		return ApiEnvelope.ok(null);
	}

	/** 즉시 도달성 검사 */
	@PostMapping("/{serverId}/check")
	public ApiEnvelope check(@PathVariable String serverId) {
		return ApiEnvelope.ok(service.check(serverId));
	}
}
