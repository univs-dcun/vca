package ai.univs.vca.proxy;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 미디어 서버(MediaMTX) 연결 설정 (application.yml의 vca.media.*, 계약 v0.9.0 streamUrl — UV-43).
 *
 * @param apiBaseUrl 미디어 서버 제어 API — 스트림 path 존재 확인용. 빈 값이면 미디어 서버 미구성으로
 *                   간주하고 모든 카메라의 streamUrl을 null로 내린다 (화면은 bestframe 폴백)
 * @param streamUrlTemplate 브라우저에 내릴 스트림 경로 템플릿 — {cameraId} 치환. 동일 오리진 경로여야
 *                   하며 nginx(운영)/Vite(dev)가 미디어 서버로 프록시한다
 * @param timeout path 목록 조회 타임아웃 — 미디어 서버 다운이 카메라 목록 응답을 지연시키지 않게 짧게
 */
@ConfigurationProperties(prefix = "vca.media")
public record MediaProperties(String apiBaseUrl, String streamUrlTemplate, Duration timeout) {

	public boolean enabled() {
		return apiBaseUrl != null && !apiBaseUrl.isBlank();
	}

	public String streamUrlFor(String cameraId) {
		return streamUrlTemplate.replace("{cameraId}", cameraId);
	}
}
