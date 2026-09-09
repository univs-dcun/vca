package ai.univs.vca.admin.audit;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import ai.univs.vca.admin.AdminApiException;
import ai.univs.vca.admin.AdminProperties;
import ai.univs.vca.admin.auth.UserAccountEntity;
import ai.univs.vca.admin.security.ProjectScope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인물 검색 감사 (UV-59). 기록 주체는 프록시(검색 호출을 전부 지나는 유일한 자리), 행위자는 세션 쿠키로 확정한다.
 * 프로젝트 귀속: 앱 호출에는 프로젝트가 없으므로 행위자 배정이 정확히 1개일 때만 그 프로젝트, 아니면 null(owner만 조회).
 */
@Service
public class SearchAuditService {

	private static final Logger log = LoggerFactory.getLogger(SearchAuditService.class);
	private static final int MAX_LIMIT = 200;
	private static final int CRITERIA_MAX = 4000;
	static final Set<String> FEATURES = Set.of("redmap", "reid", "track", "redface");

	public record SearchAuditRequest(String feature, String endpoint, String criteria, String imageSha256,
			Long imageBytes, Integer imageCount, Integer resultCount, Integer durationMs, String status,
			String errorCode) {
	}

	public record SearchAuditRow(Long id, Instant at, Long userId, String userName, String accountId,
			String projectId, String feature, String endpoint, String criteria, String imageSha256, Long imageBytes,
			int imageCount, Integer resultCount, Integer durationMs, String status, String errorCode, String ip) {

		static SearchAuditRow of(SearchAuditEntity e) {
			return new SearchAuditRow(e.getId(), e.getAt(), e.getUserId(), e.getUserName(), e.getAccountId(),
					e.getProjectId(), e.getFeature(), e.getEndpoint(), e.getCriteria(), e.getImageSha256(),
					e.getImageBytes(), e.getImageCount(), e.getResultCount(), e.getDurationMs(), e.getStatus(),
					e.getErrorCode(), e.getIp());
		}
	}

	private final SearchAuditRepository repository;
	private final AdminProperties props;

	public SearchAuditService(SearchAuditRepository repository, AdminProperties props) {
		this.repository = repository;
		this.props = props;
	}

	@Transactional
	public SearchAuditRow record(UserAccountEntity actor, SearchAuditRequest req, String ip) {
		if (req == null || req.feature() == null || !FEATURES.contains(req.feature())) {
			throw AdminApiException.badRequest("feature must be one of " + FEATURES);
		}
		if (req.endpoint() == null || req.endpoint().isBlank()) {
			throw AdminApiException.badRequest("endpoint is required");
		}
		String status = "error".equals(req.status()) ? "error" : "ok";
		String criteria = req.criteria() == null ? null
				: req.criteria().length() > CRITERIA_MAX ? req.criteria().substring(0, CRITERIA_MAX) : req.criteria();
		String projectId = actor.getProjectIds().size() == 1 ? actor.getProjectIds().get(0) : null;
		SearchAuditEntity e = new SearchAuditEntity(actor.getId(), actor.getName(), actor.getAccountId(), projectId,
				req.feature(), req.endpoint(), criteria, req.imageSha256(), req.imageBytes(),
				req.imageCount() == null ? 0 : req.imageCount(), req.resultCount(), req.durationMs(), status,
				req.errorCode(), ip);
		repository.save(e);
		return SearchAuditRow.of(e);
	}

	/** Portal 조회 — ProjectScope 적용(UV-58). 비owner는 배정 프로젝트에 귀속된 기록만 */
	@Transactional(readOnly = true)
	public List<SearchAuditRow> recent(String projectId, int limit) {
		PageRequest page = PageRequest.of(0, Math.min(Math.max(limit, 1), MAX_LIMIT));
		ProjectScope scope = ProjectScope.current();
		List<SearchAuditEntity> rows;
		if (scope.isUnrestricted()) {
			rows = projectId == null || projectId.isBlank() ? repository.findAllByOrderByAtDesc(page)
					: repository.findByProjectIdOrderByAtDesc(projectId, page);
		}
		else {
			rows = repository.findByProjectIdInOrderByAtDesc(scope.narrow(projectId), page);
		}
		return rows.stream().map(SearchAuditRow::of).toList();
	}

	/** 보존 기간 초과분 삭제 — 매일 03:10(서버 시각). 기본 365일, 0 이하면 삭제하지 않음 */
	@Scheduled(cron = "0 10 3 * * *")
	@Transactional
	public void purge() {
		int days = props.searchAuditRetentionDays();
		if (days <= 0) {
			return;
		}
		long removed = repository.deleteByAtBefore(Instant.now().minus(Duration.ofDays(days)));
		if (removed > 0) {
			log.info("search audit purge: {} record(s) older than {} days removed", removed, days);
		}
	}
}
