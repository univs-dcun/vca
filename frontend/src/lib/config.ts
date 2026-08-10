// index.html에서 로드된 /config.js가 주입한 런타임 설정을 읽는다.
type VcaConfig = {
  API_BASE_URL: string
  /** MQTT 브로커 WebSocket URL. 빈 문자열이면 실시간 연결을 끄고 REST 스냅샷만 사용한다. */
  MQTT_URL: string
  /** MQTT 토픽의 사이트 식별자 (vca/v1/{siteId}/...) */
  SITE_ID: string
}

declare global {
  interface Window {
    __VCA_CONFIG__?: Partial<VcaConfig>
  }
}

export const config: VcaConfig = {
  API_BASE_URL: window.__VCA_CONFIG__?.API_BASE_URL ?? '/api',
  // 기본값: 같은 호스트의 EMQX WebSocket 리스너(8083). 운영은 config.js에서 wss URL로 덮어쓴다.
  MQTT_URL: window.__VCA_CONFIG__?.MQTT_URL ?? `ws://${window.location.hostname}:8083/mqtt`,
  SITE_ID: window.__VCA_CONFIG__?.SITE_ID ?? 'sg',
}
