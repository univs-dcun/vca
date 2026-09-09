package ai.univs.vca.admin.audit;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SearchAuditRepository extends JpaRepository<SearchAuditEntity, Long> {

	List<SearchAuditEntity> findAllByOrderByAtDesc(Pageable pageable);

	List<SearchAuditEntity> findByProjectIdOrderByAtDesc(String projectId, Pageable pageable);

	List<SearchAuditEntity> findByProjectIdInOrderByAtDesc(Collection<String> projectIds, Pageable pageable);

	long deleteByAtBefore(Instant cutoff);
}
