// 런타임 환경설정 (기본값 = 개발용).
// 운영 컨테이너에서는 docker-entrypoint.sh가 환경변수로 이 파일을 덮어쓴다.
// API_BASE_URL을 '/api'(상대경로)로 두면 dev(vite proxy)/prod(nginx) 모두 동일 오리진으로 동작한다.
window.__VCA_CONFIG__ = {
  API_BASE_URL: '/api',
  // MQTT 브로커 WebSocket URL. 생략 시 ws://{현재호스트}:8083/mqtt (로컬 EMQX).
  // 빈 문자열('')로 두면 실시간 연결을 끄고 REST 스냅샷만 사용한다.
  // 운영에서는 entrypoint가 wss://... 로 덮어쓴다.
  // MQTT_URL: 'ws://localhost:8083/mqtt',
  // SITE_ID: 'sg',
};
