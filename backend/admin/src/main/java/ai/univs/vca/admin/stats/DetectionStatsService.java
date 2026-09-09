package ai.univs.vca.admin.stats;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import ai.univs.vca.admin.camera.CameraEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 감지 집계 (UV-56). MQTT 구독자가 record()로 밀어 넣으면 메모리 버퍼에 쌓고 10초마다 시간 버킷에 upsert —
 * 감지 1건마다 DB를 치지 않는다. 조회는 DB + 미플러시 버퍼를 합쳐 최신값을 준다.
 *
 * 카테고리 → 열: vip → vip, vehicle → vehicle, 그 외(staff·unauthorized·unknown·false_positive) → unknown.
 * total은 전부 — 기획자 README §4-(1)의 {total, vip, vehicle, unknown = total - vip - vehicle} 정합.
 */
@Service
public class DetectionStatsService {

	public record Daily(int daysAgo, int total, int vip, int vehicle, int unknown) {
	}

	private record Key(String cameraId, Instant hourUtc) {
	}

	private final DetectionHourlyRepository repository;
	private final Map<Key, int[]> pending = new ConcurrentHashMap<>();

	public DetectionStatsService(DetectionHourlyRepository repository) {
		this.repository = repository;
	}

	public void record(String cameraId, String category, Instant detectedAt) {
		Instant hour = detectedAt.truncatedTo(ChronoUnit.HOURS);
		int[] counts = pending.computeIfAbsent(new Key(cameraId, hour), k -> new int[4]);
		synchronized (counts) {
			counts[0]++;
			if ("vip".equals(category)) {
				counts[1]++;
			}
			else if ("vehicle".equals(category)) {
				counts[2]++;
			}
			else {
				counts[3]++;
			}
		}
	}

	@Scheduled(fixedDelay = 10_000, initialDelay = 10_000)
	@Transactional
	public void flush() {
		if (pending.isEmpty()) {
			return;
		}
		List<Key> keys = new ArrayList<>(pending.keySet());
		for (Key k : keys) {
			int[] counts = pending.remove(k);
			if (counts == null) {
				continue;
			}
			int[] snapshot;
			synchronized (counts) {
				snapshot = counts.clone();
			}
			DetectionHourlyEntity row = repository.findByCameraIdAndHourUtc(k.cameraId(), k.hourUtc())
				.orElseGet(() -> new DetectionHourlyEntity(k.cameraId(), k.hourUtc()));
			row.add(snapshot[0], snapshot[1], snapshot[2], snapshot[3]);
			repository.save(row);
		}
	}

	/**
	 * 일별 — daysAgo 0 = 오늘(진행 중), newest last. 프로젝트 시간대 달력일. daysAgo 기준이라 7일/14일 요청이
	 * 같은 날에 같은 값을 준다(기획자 요구: 이번 주 합계 vs 지난주 비교가 한 시리즈에서).
	 */
	@Transactional(readOnly = true)
	public List<Daily> daily(List<CameraEntity> cameras, int days, ZoneId zone) {
		LocalDate today = LocalDate.now(zone);
		LocalDate first = today.minusDays(days - 1L);
		Instant since = first.atStartOfDay(zone).toInstant();
		int[][] acc = new int[days][4];
		List<String> ids = cameras.stream().map(CameraEntity::getCameraId).toList();
		if (!ids.isEmpty()) {
			for (DetectionHourlyEntity h : repository.findByCameraIdInAndHourUtcGreaterThanEqual(ids, since)) {
				addTo(acc, first, days, zone, h.getHourUtc(), h.getTotal(), h.getVip(), h.getVehicle(), h.getUnknown());
			}
		}
		Map<Key, int[]> snapshot = new HashMap<>(pending);
		for (Map.Entry<Key, int[]> e : snapshot.entrySet()) {
			if (!ids.contains(e.getKey().cameraId()) || e.getKey().hourUtc().isBefore(since)) {
				continue;
			}
			int[] c;
			synchronized (e.getValue()) {
				c = e.getValue().clone();
			}
			addTo(acc, first, days, zone, e.getKey().hourUtc(), c[0], c[1], c[2], c[3]);
		}
		List<Daily> out = new ArrayList<>(days);
		for (int i = 0; i < days; i++) {
			int daysAgo = days - 1 - i;
			out.add(new Daily(daysAgo, acc[i][0], acc[i][1], acc[i][2], acc[i][3]));
		}
		return out;
	}

	private static void addTo(int[][] acc, LocalDate first, int days, ZoneId zone, Instant hour, int total, int vip,
			int vehicle, int unknown) {
		int idx = (int) (hour.atZone(zone).toLocalDate().toEpochDay() - first.toEpochDay());
		if (idx < 0 || idx >= days) {
			return;
		}
		acc[idx][0] += total;
		acc[idx][1] += vip;
		acc[idx][2] += vehicle;
		acc[idx][3] += unknown;
	}
}
