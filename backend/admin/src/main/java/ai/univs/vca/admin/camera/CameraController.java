package ai.univs.vca.admin.camera;

import ai.univs.vca.admin.ApiEnvelope;
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
import org.springframework.web.bind.annotation.RestController;

/** 카메라 원장 CRUD — Admin 화면 전용 (openapi/admin-api.json 초안). VCA 대시보드는 이 API를 직접 호출하지 않는다 */
@RestController
@RequestMapping("/admin/api/cameras")
public class CameraController {

	private final CameraService service;

	public CameraController(CameraService service) {
		this.service = service;
	}

	@GetMapping
	public ApiEnvelope list() {
		return ApiEnvelope.ok(service.list());
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
}
