package ai.univs.vca.admin.camera;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.camera.CameraDtos.BulkDeleteRequest;
import ai.univs.vca.admin.camera.CameraDtos.BulkZoneRequest;
import ai.univs.vca.admin.camera.CameraDtos.CameraRequest;
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

/** 카메라 원장 CRUD (UV-42 → UV-53) — Portal Input Sources 카메라 탭. VCA 대시보드는 이 API를 직접 호출하지 않는다 */
@RestController
@RequestMapping("/admin/api/cameras")
public class CameraController {

	private final CameraService service;

	public CameraController(CameraService service) {
		this.service = service;
	}

	@GetMapping
	public ApiEnvelope list(@RequestParam(required = false) String projectId) {
		return ApiEnvelope.ok(service.list(projectId));
	}

	@GetMapping("/{cameraId}")
	public ApiEnvelope get(@PathVariable String cameraId) {
		return ApiEnvelope.ok(service.get(cameraId));
	}

	@PostMapping
	public ResponseEntity<ApiEnvelope> create(@RequestBody CameraRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiEnvelope.ok(service.create(request)));
	}

	@PutMapping("/{cameraId}")
	public ApiEnvelope update(@PathVariable String cameraId, @RequestBody CameraRequest request) {
		return ApiEnvelope.ok(service.update(cameraId, request));
	}

	@DeleteMapping("/{cameraId}")
	public ApiEnvelope delete(@PathVariable String cameraId) {
		service.delete(cameraId);
		return ApiEnvelope.ok(null);
	}

	/** 일괄 존 변경 — 감사 1줄 */
	@PutMapping("/bulk/zone")
	public ApiEnvelope setZone(@RequestBody BulkZoneRequest req) {
		return ApiEnvelope.ok(service.setZone(req.cameraIds(), req.zone()));
	}

	/** 일괄 삭제 — 감사 1줄. DELETE 본문 호환성 때문에 POST */
	@PostMapping("/bulk/delete")
	public ApiEnvelope deleteAll(@RequestBody BulkDeleteRequest req) {
		return ApiEnvelope.ok(service.deleteAll(req.cameraIds()));
	}
}
