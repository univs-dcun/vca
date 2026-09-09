package ai.univs.vca.admin.camera;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/** Admin/Portal 카메라 계약 DTO (openapi/admin-api.json cameras 그룹, UV-42 → UV-53 확장) */
public final class CameraDtos {

	private CameraDtos() {
	}

	public record LatLng(double lat, double lng) {
	}

	/**
	 * 등록·수정 공용 본문. password는 쓰기 전용 — 수정 시 null이면 기존 값 유지.
	 * locationId 생략 시 name 슬러그로, code 생략 시 CAM-{ZONE3}-{NNN}으로, projectId 생략 시 기본 프로젝트.
	 */
	public record CameraRequest(String projectId, String code, String name, String ip, String mac, String maker,
			String model, String resolution, String protocol, String username, String password, String rtspUrl,
			String locationId, String zone, String location, LatLng coordinates, String serverId,
			List<String> aiFeatures, String thumbnail) {

		/** UV-42 계약 필드명 `location{lat,lng}`과 Portal 필드명 `coordinates` 둘 다 받는다 */
		public LatLng latLng() {
			return coordinates;
		}
	}

	/**
	 * password는 어떤 응답에도 없다 — hasCredential로 설정 여부만.
	 * status/lastSeenAt/lastChangeAt은 원장이 아니라 모듈 MQTT status 적재값(CameraStatusService) — unknown이면 미수신.
	 */
	public record CameraResponse(String cameraId, String projectId, String code, String name, String ip, String mac,
			String maker, String model, String resolution, String protocol, String username, boolean hasCredential,
			String rtspUrl, String locationId, String zone, String location, LatLng coordinates, String serverId,
			List<String> aiFeatures, String thumbnail, String status, Instant lastSeenAt, Instant lastChangeAt,
			Instant createdAt, Instant updatedAt) {

		static CameraResponse from(CameraEntity e, String status, Instant lastSeenAt, Instant lastChangeAt) {
			return new CameraResponse(e.getCameraId(), e.getProjectId(), e.getCode(), e.getName(), e.getIp(),
					e.getMac(), e.getMaker(), e.getModel(), e.getResolution(), e.getProtocol(), e.getUsername(),
					e.getPasswordEnc() != null, e.getRtspUrl(), e.getLocationId(), e.getZone(), e.getLocation(),
					new LatLng(e.getLat(), e.getLng()), e.getServerId(), splitFeatures(e.getAiFeatures()),
					e.getThumbnail(), status, lastSeenAt, lastChangeAt, e.getCreatedAt(), e.getUpdatedAt());
		}
	}

	public record BulkZoneRequest(List<String> cameraIds, String zone) {
	}

	public record BulkDeleteRequest(List<String> cameraIds) {
	}

	public record BulkResult(int affected, List<String> cameraIds) {
	}

	static List<String> splitFeatures(String csv) {
		if (csv == null || csv.isBlank()) {
			return List.of();
		}
		return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
	}

	static String joinFeatures(List<String> features) {
		if (features == null || features.isEmpty()) {
			return null;
		}
		return String.join(",", features.stream().map(String::trim).filter(s -> !s.isEmpty()).toList());
	}
}
