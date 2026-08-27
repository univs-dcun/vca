package ai.univs.vca.admin.camera;

import java.util.List;

import ai.univs.vca.admin.AdminProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 기동 시드 + 초기 provisioning push.
 *
 * 원장이 비어 있으면 기존 사이트의 기본 카메라 8대(sim 내장 프로필과 동일 ID·좌표)를 시드한다 —
 * Old VCA 등록분 이관(설계 open question 3)이 확정되기 전까지의 자리이며, 시드 직후 대시보드가
 * 기존과 동일하게 보이는 것을 보장한다. rtspUrl은 P2(미디어 서버)에서 실주소로 교체될 자리표시자.
 *
 * 시드 여부와 무관하게 기동마다 provisioning을 1회 push한다 — 모듈이 재기동으로 목록을 잃었어도
 * Admin 기동 시점에 수렴한다 (실패는 로그만 — 수동 재동기화 POST /admin/api/provision/sync).
 */
@Component
public class DefaultCameraSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DefaultCameraSeeder.class);

	private record Seed(String cameraId, String name, String locationId, double lat, double lng) {
	}

	private static final List<Seed> DEFAULT_CAMERAS = List.of(
			new Seed("cam-novena-01", "Novena", "loc-novena", 1.3204, 103.8439),
			new Seed("cam-bugis-01", "Bugis", "loc-bugis", 1.3009, 103.8559),
			new Seed("cam-bedok-01", "Bedok", "loc-bedok", 1.3240, 103.9300),
			new Seed("cam-orchard-01", "Orchard", "loc-orchard", 1.3040, 103.8320),
			new Seed("cam-kallang-01", "Kallang", "loc-kallang", 1.3100, 103.8710),
			new Seed("cam-marine-01", "Marine", "loc-marine", 1.3020, 103.9060),
			new Seed("cam-tampines-01", "Tampines", "loc-tampines", 1.3530, 103.9450),
			new Seed("cam-geylang-01", "Geylang", "loc-geylang", 1.3180, 103.8820));

	private final CameraRepository repository;
	private final CameraService service;
	private final AdminProperties props;

	public DefaultCameraSeeder(CameraRepository repository, CameraService service, AdminProperties props) {
		this.repository = repository;
		this.service = service;
		this.props = props;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (props.seedDefaultCameras() && repository.count() == 0) {
			repository.saveAll(DEFAULT_CAMERAS.stream()
				.map(s -> new CameraEntity(s.cameraId(), s.name(), null, null, null, null, null,
						"rtsp://media.local:8554/" + s.cameraId(), s.locationId(), s.lat(), s.lng()))
				.toList());
			log.info("기본 카메라 {}대 시드 완료 (원장 비어 있음)", DEFAULT_CAMERAS.size());
		}
		service.syncModule();
	}
}
