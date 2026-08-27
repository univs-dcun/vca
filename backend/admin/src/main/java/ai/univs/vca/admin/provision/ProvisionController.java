package ai.univs.vca.admin.provision;

import java.util.Map;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.camera.CameraService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 모듈 provisioning 수동 재동기화·상태 — 모듈이 내려가 있던 동안의 원장 변경을 따라잡는 용도 */
@RestController
@RequestMapping("/admin/api/provision")
public class ProvisionController {

	private final CameraService cameraService;
	private final ProvisionClient provisionClient;

	public ProvisionController(CameraService cameraService, ProvisionClient provisionClient) {
		this.cameraService = cameraService;
		this.provisionClient = provisionClient;
	}

	@PostMapping("/sync")
	public ApiEnvelope sync() {
		boolean synced = cameraService.syncModule();
		return ApiEnvelope.ok(Map.of("synced", synced, "state", provisionClient.state()));
	}

	@GetMapping("/status")
	public ApiEnvelope status() {
		return ApiEnvelope.ok(provisionClient.state());
	}
}
