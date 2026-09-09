package ai.univs.vca.admin.status;

import java.time.ZoneId;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.camera.CameraRepository;
import ai.univs.vca.admin.org.ProjectEntity;
import ai.univs.vca.admin.org.ProjectRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프로젝트 카메라 집계 (UV-53) — Portal Overview "Camera connectivity" 카드·"불안정 카메라" 작업목록,
 * Input Sources "Stream health". 원천은 모듈 MQTT status 적재(CameraStatusService) — 모듈 계약 무변경.
 */
@RestController
@RequestMapping("/admin/api/projects/{projectId}")
public class CameraStatsController {

	private final CameraRepository cameras;
	private final ProjectRepository projects;
	private final CameraStatusService statuses;

	public CameraStatsController(CameraRepository cameras, ProjectRepository projects, CameraStatusService statuses) {
		this.cameras = cameras;
		this.projects = projects;
		this.statuses = statuses;
	}

	/** online/offline/error/unknown 카운트 + 카메라별 현재 상태 */
	@GetMapping("/camera-connectivity")
	public ApiEnvelope connectivity(@PathVariable String projectId) {
		requireProject(projectId);
		return ApiEnvelope.ok(statuses.connectivity(cameras.findByProjectIdOrderByNameAsc(projectId)));
	}

	/**
	 * 최근 days일 일별 끊김 — [{cameraId, code, name, drops, dropsByDay[days]}] oldest-first, drops>0만,
	 * 내림차순, limit(기본 4 — 최악 포인터. 전 대수가 필요하면 큰 limit)
	 */
	@GetMapping("/camera-stability")
	public ApiEnvelope stability(@PathVariable String projectId, @RequestParam(defaultValue = "7") int days,
			@RequestParam(defaultValue = "4") int limit) {
		ProjectEntity p = requireProject(projectId);
		if (days < 1 || days > 90) {
			throw AdminApiException.badRequest("days must be 1..90");
		}
		return ApiEnvelope.ok(statuses.stability(cameras.findByProjectIdOrderByNameAsc(projectId), days,
				ZoneId.of(p.getTimeZone()), Math.max(1, limit)));
	}

	private ProjectEntity requireProject(String projectId) {
		return projects.findById(projectId).orElseThrow(() -> AdminApiException.projectNotFound(projectId));
	}
}
