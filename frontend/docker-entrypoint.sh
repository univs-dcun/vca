#!/bin/sh
set -e

# 컨테이너 시작 시 런타임 환경설정(config.js)을 생성한다.
# nginx 공식 이미지가 /docker-entrypoint.d/*.sh 를 nginx 기동 전에 실행한다.
API_BASE_URL="${API_BASE_URL:-/api}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__VCA_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL}",
};
EOF

echo "[vca] config.js generated (API_BASE_URL=${API_BASE_URL})"
