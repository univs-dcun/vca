package ai.univs.vca.admin.stats;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DetectionHourlyRepository extends JpaRepository<DetectionHourlyEntity, Long> {

	Optional<DetectionHourlyEntity> findByCameraIdAndHourUtc(String cameraId, Instant hourUtc);

	List<DetectionHourlyEntity> findByCameraIdInAndHourUtcGreaterThanEqual(Collection<String> cameraIds, Instant since);
}
