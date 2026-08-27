package ai.univs.vca.admin.provision;

import java.util.Map;

import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.camera.CameraService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 수동 재동기화·상태 — 모듈·미디어 서버가 내려가 있던 동안의 원장 변경을 따라잡는 용도 */
@RestController
@RequestMapping("/admin/api/provision")
public class ProvisionController {

	private final CameraService cameraService;
	private final ProvisionClient provisionClient;
	private final MediaSyncClient mediaSyncClient;

	public ProvisionController(CameraService cameraService, ProvisionClient provisionClient,
			MediaSyncClient mediaSyncClient) {
		this.cameraService = cameraService;
		this.provisionClient = provisionClient;
		this.mediaSyncClient = mediaSyncClient;
	}

	@PostMapping("/sync")
	public ApiEnvelope sync() {
		boolean synced = cameraService.syncModule();
		return ApiEnvelope.ok(Map.of("synced", synced,
				"module", provisionClient.state(), "media", mediaSyncClient.state()));
	}

	@GetMapping("/status")
	public ApiEnvelope status() {
		return ApiEnvelope.ok(Map.of("module", provisionClient.state(), "media", mediaSyncClient.state()));
	}
}
