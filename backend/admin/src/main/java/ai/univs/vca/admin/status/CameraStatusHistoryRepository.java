package ai.univs.vca.admin.status;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CameraStatusHistoryRepository extends JpaRepository<CameraStatusHistoryEntity, Long> {

	Optional<CameraStatusHistoryEntity> findTopByCameraIdOrderByAtDesc(String cameraId);

	/** 기동 시 마지막 상태 복원 — 카메라별 최신 1건 */
	@Query("select h from CameraStatusHistoryEntity h where h.id in (select max(h2.id) from CameraStatusHistoryEntity h2 group by h2.cameraId)")
	List<CameraStatusHistoryEntity> findLatestPerCamera();

	List<CameraStatusHistoryEntity> findByCameraIdInAndAtGreaterThanEqualOrderByAtAsc(Collection<String> cameraIds,
			Instant since);

	@Query("select h from CameraStatusHistoryEntity h where h.cameraId in :ids and h.at >= :since and h.status = 'offline' order by h.at asc")
	List<CameraStatusHistoryEntity> findDrops(@Param("ids") Collection<String> cameraIds, @Param("since") Instant since);
}
