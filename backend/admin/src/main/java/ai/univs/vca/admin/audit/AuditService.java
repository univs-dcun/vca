package ai.univs.vca.admin.audit;

import java.time.Instant;
import java.util.List;

import ai.univs.vca.admin.security.CurrentUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 변경 엔드포인트가 호출하는 기록 지점 — actor는 세션 사용자, 세션 밖(시더)은 "system" */
@Service
public class AuditService {

	public record AuditRow(Long id, String projectId, String actor, String message, Instant at) {
	}

	private static final int MAX_LIMIT = 200;

	private final AuditEventRepository repository;

	public AuditService(AuditEventRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public void record(String projectId, String message) {
		repository.save(new AuditEventEntity(projectId, CurrentUser.actorId(), CurrentUser.actorName(), message));
	}

	/** 세션 밖의 본인 행위(등록 코드·초대 활성화) — actor는 그 사람 자신 */
	@Transactional
	public void recordAs(String projectId, Long actorId, String actorName, String message) {
		repository.save(new AuditEventEntity(projectId, actorId, actorName, message));
	}

	@Transactional(readOnly = true)
	public List<AuditRow> recent(String projectId, int limit) {
		PageRequest page = PageRequest.of(0, Math.min(Math.max(limit, 1), MAX_LIMIT));
		List<AuditEventEntity> rows = projectId == null || projectId.isBlank()
				? repository.findAllByOrderByAtDesc(page)
				: repository.findByProjectIdOrProjectIdIsNullOrderByAtDesc(projectId, page);
		return rows.stream()
			.map(e -> new AuditRow(e.getId(), e.getProjectId(), e.getActorName(), e.getMessage(), e.getAt()))
			.toList();
	}
}
