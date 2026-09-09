package ai.univs.vca.admin.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import ai.univs.vca.admin.camera.CameraEntity;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 카메라 상태의 단일 조회점 (UV-53). MQTT 구독자가 record()로 밀어 넣고, 원장 응답·집계가 여기서 읽는다.
 * 메모리 캐시(현재 상태·마지막 수신)는 기동 시 이력에서 복원한다.
 */
@Service
public class CameraStatusService {

	public static final String ONLINE = "online";
	public static final String OFFLINE = "offline";
	public static final String UNKNOWN = "unknown";

	/** 현재 상태 + 마지막 수신 시각 + 마지막 전이 시각 */
	public record Current(String status, Instant lastSeenAt, Instant lastChangeAt) {
		static final Current NONE = new Current(UNKNOWN, null, null);
	}

	public record ConnectivityRow(String cameraId, String code, String name, String zone, String status,
			Instant lastSeenAt, Instant lastChangeAt) {
	}

	public record Connectivity(int total, int online, int offline, int error, int unknown, List<ConnectivityRow> cameras) {
	}

	public record StabilityRow(String cameraId, String code, String name, int drops, List<Integer> dropsByDay) {
	}

	private final CameraStatusHistoryRepository history;
	private final Map<String, Current> current = new ConcurrentHashMap<>();

	public CameraStatusService(CameraStatusHistoryRepository history) {
		this.history = history;
	}

	@PostConstruct
	void restore() {
		for (CameraStatusHistoryEntity h : history.findLatestPerCamera()) {
			current.put(h.getCameraId(), new Current(h.getStatus(), h.getAt(), h.getAt()));
		}
	}

	/** 수신 — 상태가 바뀌었을 때만 이력 한 줄. 같은 상태의 재발행(retained 재수신·모듈 재기동)은 lastSeenAt만 갱신 */
	@Transactional
	public void record(String cameraId, String status, Instant at) {
		Current prev = current.get(cameraId);
		if (prev == null || !prev.status().equals(status)) {
			Optional<CameraStatusHistoryEntity> last = history.findTopByCameraIdOrderByAtDesc(cameraId);
			if (last.isEmpty() || !last.get().getStatus().equals(status)) {
				history.save(new CameraStatusHistoryEntity(cameraId, status, at));
			}
			current.put(cameraId, new Current(status, at, at));
		}
		else {
			current.put(cameraId, new Current(status, at, prev.lastChangeAt()));
		}
	}

	/** retained 삭제(빈 페이로드) — 원장에서 지워진 카메라. 캐시만 비운다 */
	public void forget(String cameraId) {
		current.remove(cameraId);
	}

	public Current currentOf(String cameraId) {
		return current.getOrDefault(cameraId, Current.NONE);
	}

	public Connectivity connectivity(List<CameraEntity> cameras) {
		int online = 0, offline = 0, error = 0, unknown = 0;
		List<ConnectivityRow> rows = new ArrayList<>();
		for (CameraEntity c : cameras) {
			Current cur = currentOf(c.getCameraId());
			switch (cur.status()) {
				case ONLINE -> online++;
				case OFFLINE -> offline++;
				case "error" -> error++;
				default -> unknown++;
			}
			rows.add(new ConnectivityRow(c.getCameraId(), c.getCode(), c.getName(), c.getZone(), cur.status(),
					cur.lastSeenAt(), cur.lastChangeAt()));
		}
		return new Connectivity(cameras.size(), online, offline, error, unknown, rows);
	}

	/**
	 * 안정도 — 최근 days일의 일별 끊김(online→offline 전이) 수. dropsByDay는 oldest-first(index 0 = days-1일 전,
	 * 마지막 = 오늘), 프로젝트 시간대 달력일. drops>0만, 내림차순, limit. 기획자 README §4-(2)와 동일 형태
	 */
	@Transactional(readOnly = true)
	public List<StabilityRow> stability(List<CameraEntity> cameras, int days, ZoneId zone, int limit) {
		if (cameras.isEmpty()) {
			return List.of();
		}
		LocalDate today = LocalDate.now(zone);
		LocalDate first = today.minusDays(days - 1L);
		Instant since = first.atStartOfDay(zone).toInstant();
		Map<String, int[]> perCamera = new ConcurrentHashMap<>();
		List<String> ids = cameras.stream().map(CameraEntity::getCameraId).toList();
		for (CameraStatusHistoryEntity h : history.findDrops(ids, since)) {
			int idx = (int) (h.getAt().atZone(zone).toLocalDate().toEpochDay() - first.toEpochDay());
			if (idx < 0 || idx >= days) {
				continue;
			}
			perCamera.computeIfAbsent(h.getCameraId(), k -> new int[days])[idx]++;
		}
		List<StabilityRow> rows = new ArrayList<>();
		for (CameraEntity c : cameras) {
			int[] byDay = perCamera.get(c.getCameraId());
			if (byDay == null) {
				continue;
			}
			int total = 0;
			List<Integer> list = new ArrayList<>(days);
			for (int v : byDay) {
				total += v;
				list.add(v);
			}
			if (total > 0) {
				rows.add(new StabilityRow(c.getCameraId(), c.getCode(), c.getName(), total, list));
			}
		}
		rows.sort(Comparator.comparingInt(StabilityRow::drops).reversed());
		return rows.size() > limit ? rows.subList(0, limit) : rows;
	}
}
