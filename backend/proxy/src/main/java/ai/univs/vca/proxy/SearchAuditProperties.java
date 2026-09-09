package ai.univs.vca.proxy;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * 인물 검색 감사 (UV-59, application.yml의 vca.search-audit.*).
 *
 * @param enabled false면 기록을 보내지 않는다 (검색 중계는 그대로)
 * @param maxBody 검색 요청 본문 상한 — 감사 기록을 위해 multipart를 한 번 메모리에 모으므로 상한이 필요하다.
 *                초과 시 413 VCA-4130. 얼굴·바디 이미지 몇 장 규모라 기본 32MB
 */
@ConfigurationProperties(prefix = "vca.search-audit")
public record SearchAuditProperties(boolean enabled, DataSize maxBody) {
}
