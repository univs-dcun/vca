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
헬퍼(모든 CAM_DATA 접근이 이 함수를 거침) + 이미지 폴백 3곳(패널 행 아바타 `det.snapshotUrl ?? mock`,
HUD LIVE SNAPSHOT, HUD ENROLLED DB `det.enrolledPhotoUrl` 분기).
BestFramePage v1.3 주입(UV-35): useMediaLive·LiveVideoFeed import + media 훅 호출 +
videoCams/imageCams 동기화 effect 2개 + camDataFor 체인에 media.dataFor 추가 +
CameraCard 피드의 `data.videoUrl ? <LiveVideoFeed> : <img>` 분기. CamData에 optional
videoUrl 필드(types/detection.ts). 비디오 타일 컴포넌트(LiveVideoFeed — 재생+bbox 오버레이)는
vca-bridge 소유의 임시 구현 — 기획자가 정식 타일을 디자인하면 대체.
RedmapPage의 주입(UV-34): searchRedmapPersons import + faceFile/bodyFile/liveTrace state 3개 +
업로드 핸들러 2곳의 setXxxFile + handleSearch 앞부분의 실검색 시도 블록(null이면 mock 폴백) +
handleReset·딥링크 블록의 liveTrace 리셋 + 타임라인 originOffset 게이트 + RedmapMap showOrigin prop.
RedmapMap의 주입: showOrigin?: boolean prop(기본 true) — 실검색 경로에서 mock 시작점 미표시,
originOffset 기반 hitIndex 변환, effect deps에 showOrigin. 마커 effect의 stale 가드(UV-36) —
import("leaflet") 완료 전 결과가 바뀌면 이전 실행 마커가 잔상으로 남는 race 수정(cleanup으로 무효화).
Track on Map 주입(UV-36): BestFramePage — onGoRedmapTrace 시그니처에 optional TrackTargetRef 추가 +
HUD Track on Map 버튼이 대상 참조(sourceType은 videoCams/imageCams 소속으로 판별, sourceId=camId,
targetId=det.id)를 실어 보냄. ClientLayout — redmapTrackTarget state + handleGoRedmapTrace 2번째
인자 + RedmapPage initialTrackTarget prop 전달(consumed 시 함께 클리어). RedmapPage —
trackTargetOnMap import + initialTrackTarget prop + consumedTrackRef 기반 실추적 검색 effect
(mock 딥링크가 먼저 그려지고 응답 도착 시 라이브 결과·유사도 90·당일 날짜로 교체, null이면 mock 유지).
Analyze Frame 주입(UV-37, 계약 v1.5): BestFramePage — analyzeSourceFor() 헬퍼(카메라=지금,
비디오=recordedAt+LiveVideoFeed의 getVideoPlaybackTime, 이미지·메타없음=null) + detailView에
analyzeSource 포함(진입 3곳) + BestFrameDetailPage에 prop 전달. BestFrameDetailPage —
useAnalyzeTimeline 훅 호출 + live 분기(프레임 스트립/메인 이미지·타임스탬프/dets/reelData/
카테고리 레인 lane()/커서 위치/날짜 드롭다운 analyzeDates()/재생 1초·감기 ±1s·±10s tl.step) +
AIInspectionDetail(det.analysis ?? mock ATTRS, snapshotUrl/enrolledPhotoUrl 폴백, eventDate prop,
onGoRedmapTrace에 det 전달→Track on Map 대상 참조) + ReelCard·AlsoCapturedCard 이미지·태그 폴백.
types/detection.ts — Detection에 optional analysis/gender, CamData에 optional recordedAt.
main.tsx — MSW 시작 실패를 비치명으로(catch 후 렌더 — SW 등록이 막히는 임베디드 브라우저 대응).
DATA Live Monitoring 주입(UV-38, 계약 v1.6): DataPage — useLiveMonitoring·TrackTargetRef import +
LiveCardExtras/MonitorItem 타입·trackRefOf() 헬퍼 + MonitorCard p 타입·얼굴 인셋 분기(faceCrop
null=인셋 숨김, string=실크롭, undefined=mock 줌 크롭) + LiveMonitoringTab의 lm 훅 호출·mock
인터벌 lm.live 게이트·feedSrc 분기 + CameraDetailView items 타입·RedMap 버튼 대상 참조 동봉 +
reidToMatchItem face 폴백(faceCrop ?? url) + DetailModal RedMap Trace 래핑 + DataPage onGoRedmap
시그니처 (name?, ref?) + All Cameras 병합 정렬(ms 내림차순 — 카메라별 블록이 아닌 단일 최신순
스트림, mock은 ms 없어 안정 정렬로 기존 순서 유지). ClientLayout — DataPage onGoRedmap: ref
있으면 handleGoRedmapTrace(UV-36 딥링크 재사용), 없으면 기존 플레인 이동.
lib/realtime/types.ts — DetectionEvent에 faceUrl/gender/age.

반입 시 규칙 충돌 주의 (원본 레포에 미반영된 백엔드발 변경 — diff 적용 후 반드시 재확인):
- `types/detection.ts` Detection에 optional `snapshotUrl`/`enrolledPhotoUrl` 필드 (라이브 이미지 공급)
- `lib/vcaStore.ts` addEvent — 확정 행 규칙(VIP 누적 + 카메라 전환 기준 Tracking 별개 1행, UV-31)
  구현의 단일 소유자. 라이브 브리지도 이 addEvent를 호출하므로, 반입으로 이전 병합 규칙이
  되돌아오면 mock/라이브 모두 깨진다 — 기획자 원본 레포에 동일 변경 반영을 요청해 둔 상태.
