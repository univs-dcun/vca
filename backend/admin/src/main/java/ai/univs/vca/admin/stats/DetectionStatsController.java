package ai.univs.vca.admin.stats;

import java.time.ZoneId;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.ApiEnvelope;
import ai.univs.vca.admin.camera.CameraRepository;
import ai.univs.vca.admin.org.ProjectEntity;
import ai.univs.vca.admin.org.ProjectRepository;
import ai.univs.vca.admin.security.ProjectScope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 일별 감지 (UV-56) — Portal Overview "Detections · last 7 days" (기획자 README §4-(1) 형태) */
@RestController
@RequestMapping("/admin/api/projects/{projectId}")
public class DetectionStatsController {

	private final DetectionStatsService stats;
	private final CameraRepository cameras;
	private final ProjectRepository projects;

	public DetectionStatsController(DetectionStatsService stats, CameraRepository cameras, ProjectRepository projects) {
		this.stats = stats;
		this.cameras = cameras;
		this.projects = projects;
	}

	/** [{daysAgo, total, vip, vehicle, unknown}] newest last. 14일 = 이번 주 vs 지난주 비교용 */
	@GetMapping("/detections")
	public ApiEnvelope daily(@PathVariable String projectId, @RequestParam(defaultValue = "14") int days) {
		ProjectScope.current().require(projectId); // 범위 밖은 403 (UV-58)
		ProjectEntity p = projects.findById(projectId).orElseThrow(() -> AdminApiException.projectNotFound(projectId));
		if (days < 1 || days > 90) {
			throw AdminApiException.badRequest("days must be 1..90");
		}
		return ApiEnvelope.ok(stats.daily(cameras.findByProjectIdOrderByNameAsc(projectId), days,
				ZoneId.of(p.getTimeZone())));
	}
}
