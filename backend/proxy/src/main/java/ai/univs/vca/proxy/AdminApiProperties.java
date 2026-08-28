package ai.univs.vca.proxy;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * VCA Admin 백엔드 (UV-47) — 인증(/api/auth/**)의 업스트림. 모듈 API와 달리 Admin 응답은
 * 이미 공통 envelope이라 프록시는 재포장 없이 패스스루한다.
 */
@ConfigurationProperties(prefix = "vca.admin-api")
public record AdminApiProperties(String baseUrl, Duration timeout) {
}
