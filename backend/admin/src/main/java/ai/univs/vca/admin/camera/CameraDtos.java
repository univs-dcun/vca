package ai.univs.vca.admin.camera;

import java.time.Instant;

/** Admin 화면↔백엔드 계약 DTO (openapi/admin-api.json 초안 — 기획자 협의 대상) */
public final class CameraDtos {

	private CameraDtos() {
	}

	public record LatLng(double lat, double lng) {
	}

	/**
	 * 등록·수정 공용 본문. password는 쓰기 전용 — 수정 시 null이면 기존 값 유지.
	 * locationId 생략 시 name 슬러그로 발급한다.
	 */
	public record CameraRequest(String name, String ip, String maker, String model, String username, String password,
			String rtspUrl, String locationId, LatLng location) {
	}

	/** password는 어떤 응답에도 없다 — hasCredential로 설정 여부만 알린다 */
	public record CameraResponse(String cameraId, String name, String ip, String maker, String model, String username,
			boolean hasCredential, String rtspUrl, String locationId, LatLng location, Instant createdAt,
			Instant updatedAt) {

		static CameraResponse from(CameraEntity e) {
			return new CameraResponse(e.getCameraId(), e.getName(), e.getIp(), e.getMaker(), e.getModel(),
					e.getUsername(), e.getPasswordEnc() != null, e.getRtspUrl(), e.getLocationId(),
					new LatLng(e.getLat(), e.getLng()), e.getCreatedAt(), e.getUpdatedAt());
		}
	}
}
