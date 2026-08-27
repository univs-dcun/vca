package ai.univs.vca.admin;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param moduleBaseUrl 분석 모듈 API 베이스 URL (버전 경로 포함) — provisioning 대상 (계약 v1.9)
 * @param moduleTimeout 모듈 호출 타임아웃
 * @param encKey 자격증명 암호화 키 원문 — SHA-256으로 AES-256 키를 파생한다. 운영에서는 반드시 환경변수로 주입
 * @param seedDefaultCameras 기동 시 원장이 비어 있으면 기존 기본 카메라 8대를 시드 (Old VCA 등록분 이관 자리)
 */
@ConfigurationProperties(prefix = "vca.admin")
public record AdminProperties(String moduleBaseUrl, Duration moduleTimeout, String encKey, boolean seedDefaultCameras) {
}
