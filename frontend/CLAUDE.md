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

## 기획자 화면 코드 반입 (원본 프로젝트 → 이 레포)
기획자는 별도 Next.js 프로젝트에서 화면을 개발한다. 반입 시 원본 코드를 **수정 없이** 가져올 수 있도록 어댑터가 설정되어 있다:
- `@/*` → `src/features/vca/*` (tsconfig paths + vite alias)
- `next/navigation` → `src/features/vca/compat/navigation` (react-router 기반 shim)
- `process.env.NEXT_PUBLIC_*` → vite `define`으로 빌드 타임 치환
- `verbatimModuleSyntax` 미사용 (원본이 type-only import를 구분하지 않음)

절차: 기획자가 `import/frontend-ui-YYYYMMDD` 브랜치로 push → 태그로 동결 → 직전 태그와의 diff를
경로 매핑(`src/components→features/vca/components`, `src/app/mypage/page.tsx→pages/MyPage.tsx` 등)해서
3-way 적용 → 데이터 연결 주입 지점(ClientLayout·Navbar·Sidebar·DetectionActivityChart·MapView·
BestFramePage의 `vca-bridge` import 부분) 재확인 → tsc + 시뮬레이터 E2E 검증.
BestFramePage의 주입: useBestFrameLive 훅 호출 + 라이브 카메라 목록 동기화 effect + camDataFor()
헬퍼(모든 CAM_DATA 접근이 이 함수를 거침) — 3곳.
