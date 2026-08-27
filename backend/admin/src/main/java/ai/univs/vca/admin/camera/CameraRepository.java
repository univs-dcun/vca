package ai.univs.vca.admin.camera;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CameraRepository extends JpaRepository<CameraEntity, String> {

	List<CameraEntity> findAllByOrderByNameAsc();
}
