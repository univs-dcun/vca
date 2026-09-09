package ai.univs.vca.admin.audit;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEventEntity, Long> {

	List<AuditEventEntity> findAllByOrderByAtDesc(Pageable pageable);

	/** 프로젝트 피드 — 프로젝트 귀속 이벤트 + 프로젝트 무관(null) 이벤트를 함께 */
	List<AuditEventEntity> findByProjectIdOrProjectIdIsNullOrderByAtDesc(String projectId, Pageable pageable);
}
