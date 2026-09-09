package ai.univs.vca.admin;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param moduleBaseUrl 분석 모듈 API 베이스 URL (버전 경로 포함) — provisioning 대상 (계약 v1.9)
 * @param moduleTimeout 모듈·미디어 서버 호출 타임아웃
 * @param mediaApiBaseUrl 미디어 서버(MediaMTX) 제어 API — 스트림 path 동기화 대상 (P2, UV-43).
 *                        빈 값이면 미디어 서버 미구성으로 간주하고 동기화를 생략한다
 * @param encKey 자격증명 암호화 키 원문 — SHA-256으로 AES-256 키를 파생한다. 운영에서는 반드시 환경변수로 주입
 * @param seedDefaultCameras 기동 시 원장이 비어 있으면 기존 기본 카메라 8대를 시드 (Old VCA 등록분 이관 자리)
 * @param sessionCookieSecure 세션 쿠키 Secure 플래그 (UV-47) — 로컬 http 개발이라 기본 false, TLS 운영에서는 true로 주입
 * @param seedAdminEmail 계정 원장이 비어 있으면 시드할 초기 운영자 이메일 — 빈 값이면 시드 생략
 * @param seedAdminPassword 초기 운영자 비밀번호 — 개발 기본값. 운영에서는 반드시 환경변수로 주입 후 첫 로그인 시 변경
 * @param selfSignup 조직 자체 생성(/auth/signup) 허용 여부 (UV-51) — 온프레미스는 false(2026-09-02 결정). 프론트
 *                   authConfig.selfSignup의 거울: 화면이 숨겨도 서버가 거절해야 구멍이 닫힌다
 * @param mqttBrokerUrl EMQX 주소 (UV-53) — 카메라 status retained 토픽 구독. 빈 값이면 구독 생략(상태 unknown)
 * @param mqttSiteId 토픽 접두 vca/v1/{siteId}/ 의 siteId (SPEC §2)
 * @param mailDevLog true면 메일을 보내지 않고 로그에 남긴다 (UV-56, 개발 전용 — 운영 false). SMTP 없는 로컬에서
 *                   재설정 코드 흐름을 검증하기 위한 스위치
 * @param searchAuditRetentionDays 인물 검색 감사 기록 보존 일수 (UV-59, 기획 확정 1년=365). 운영 감사 로그는 무기한이지만
 *                   검색 기록은 직원 행동 기록이 되므로 기간을 둔다. 0 이하면 삭제하지 않음(계약상 필요한 설치)
 */
@ConfigurationProperties(prefix = "vca.admin")
public record AdminProperties(String moduleBaseUrl, Duration moduleTimeout, String mediaApiBaseUrl, String encKey,
		boolean seedDefaultCameras, boolean sessionCookieSecure, String seedAdminEmail, String seedAdminPassword,
		boolean selfSignup, String mqttBrokerUrl, String mqttSiteId, boolean mailDevLog,
		int searchAuditRetentionDays) {
}
