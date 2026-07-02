# VCA

기획자 + 백엔드 개발자가 함께 개발하는 플랫폼 (프론트 전담 없음). 모노레포.

```
vca/
  frontend/   # Vite + React + TS SPA  → nginx 정적 배포
  backend/    # Spring Boot (예정)
  openapi/    # 프론트/백 공유 계약 (openapi.json)
```

## 협업 모델
- **기획자**: Figma 디자인 → 화면 계층(`frontend/src/features`, `components`) + MSW 목으로 화면 완성
- **백엔드**: API 구현 + `openapi.json` 발행 + 화면에 실제 데이터 연결 + 배포
- **계약**: `openapi/openapi.json` 한 곳 → orval로 프론트 타입/훅 자동생성

소유권 경계·규칙은 [`CLAUDE.md`](./CLAUDE.md), 리뷰어 지정은 [`CODEOWNERS`](./CODEOWNERS) 참고.

## 시작하기 (frontend)
```bash
cd frontend
npm install
npm run msw:init     # 최초 1회
npm run dev          # http://localhost:5173
```

## 배포 (frontend)
`frontend/Dockerfile` → nginx 이미지로 빌드. `API_UPSTREAM` 환경변수로 백엔드 주소 지정.
```bash
docker build -t vca-frontend ./frontend
docker run -p 80:80 -e API_UPSTREAM=http://gateway:8080 vca-frontend
```
