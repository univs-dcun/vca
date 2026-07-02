# CLAUDE.md — frontend

Vite + React 19 + TypeScript SPA. 상위 `../CLAUDE.md`의 소유권 경계를 따른다.

## 명령
```bash
npm install          # 최초 1회
npm run msw:init     # 최초 1회 — public/mockServiceWorker.js 생성
npm run gen:api      # OpenAPI(../openapi/openapi.json) → 타입/훅 생성
npm run dev          # 개발 서버 (포트 5173)
npm run build        # 프로덕션 빌드 (tsc + vite build → dist/)
npm run lint         # oxlint
```

## 스택
- 서버 상태: React Query (`@tanstack/react-query`)
- 클라이언트 상태: Zustand
- HTTP: Axios (`src/api/axios-instance.ts` 인스턴스 공유)
- API 훅: orval 자동생성 (`src/api/generated`)
- 목: MSW (`src/mocks`) — `.env.development`의 `VITE_ENABLE_MSW=true`일 때 활성

## 폴더
```
src/
  features/<name>/         # 화면 단위 [기획자]
    <Name>Page.tsx         #   화면 조립 + 데이터 연결 지점
    components/            #   프레젠테이션 (props만)
    api.ts / types.ts      #   (실제로는 generated로 대체)
  components/              # 공유 프레젠테이션 [기획자]
  api/                     # axios 인스턴스 + generated 훅 [백엔드]
  lib/                     # config 등 [백엔드]
  mocks/                   # MSW 핸들러 [기획자→백엔드 다리]
```

## API 호출 규칙
- 모든 호출은 상대경로 `/api/...`. dev는 vite proxy, prod는 nginx가 백엔드로 전달(동일 오리진).
- 프레젠테이션 컴포넌트에서 직접 호출 금지 — 훅으로 받아 props로 내려준다.
