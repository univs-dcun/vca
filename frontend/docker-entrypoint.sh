#!/bin/sh
set -e

# 컨테이너 시작 시 런타임 환경설정(config.js)을 생성한다.
# nginx 공식 이미지가 /docker-entrypoint.d/*.sh 를 nginx 기동 전에 실행한다.
API_BASE_URL="${API_BASE_URL:-/api}"
# MQTT_URL: 비우면 config.ts 기본값(ws://{접속 호스트}:8083/mqtt). 리버스 프록시·wss·다른 포트면 지정 (UV-60)
MQTT_URL="${MQTT_URL:-}"
SITE_ID="${SITE_ID:-sg}"

{
  echo "window.__VCA_CONFIG__ = {"
  echo "  API_BASE_URL: \"${API_BASE_URL}\","
  if [ -n "${MQTT_URL}" ]; then echo "  MQTT_URL: \"${MQTT_URL}\","; fi
  echo "  SITE_ID: \"${SITE_ID}\","
  echo "};"
} > /usr/share/nginx/html/config.js

echo "[vca] config.js generated (API_BASE_URL=${API_BASE_URL} MQTT_URL=${MQTT_URL:-<default>} SITE_ID=${SITE_ID})"
