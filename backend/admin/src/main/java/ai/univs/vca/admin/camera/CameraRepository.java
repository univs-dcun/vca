package ai.univs.vca.admin.camera;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CameraRepository extends JpaRepository<CameraEntity, String> {

	List<CameraEntity> findAllByOrderByNameAsc();

	List<CameraEntity> findByProjectIdOrderByNameAsc(String projectId);

	List<CameraEntity> findByProjectIdInOrderByNameAsc(Collection<String> projectIds);

	List<CameraEntity> findByCameraIdIn(Collection<String> cameraIds);

	/** 라이선스 채널 사용량 = 프로젝트 카메라 수 (업로드는 채널 비소모) */
	long countByProjectId(String projectId);

	boolean existsByCode(String code);
}
