// 런타임 환경설정 (기본값 = 개발용).
// 운영 컨테이너에서는 docker-entrypoint.sh가 환경변수로 이 파일을 덮어쓴다.
// API_BASE_URL을 '/api'(상대경로)로 두면 dev(vite proxy)/prod(nginx) 모두 동일 오리진으로 동작한다.
window.__VCA_CONFIG__ = {
  API_BASE_URL: '/api',
};
