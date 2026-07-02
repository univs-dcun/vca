# ── build stage ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ── run stage (nginx 정적 서빙) ───────────────────────────────
FROM nginx:1.27-alpine AS runner
# 정적 산출물
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx 설정 템플릿 + 런타임 진입 스크립트
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.d/40-vca-config.sh
RUN chmod +x /docker-entrypoint.d/40-vca-config.sh

# 앱은 항상 상대경로 /api 를 호출한다. nginx가 API_UPSTREAM 으로 프록시.
ENV API_BASE_URL=/api
ENV API_UPSTREAM=http://backend:8080

EXPOSE 80
# nginx 공식 이미지의 기본 entrypoint가 /docker-entrypoint.d/*.sh 를 실행 후 nginx 를 띄운다.
# (templates/*.template 는 envsubst 로 자동 렌더링된다.)
