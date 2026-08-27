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
DATA Re-ID Analysis 주입(UV-39, 계약 v1.7): DataPage — reidAnalysis 브리지 import(searchReid·
useReidRecentTargets·useReidVips·reidTrajectory) + ReIDContent(liveVips/liveRecent 훅,
faceFile/bodyFile state, recentList/vipList/cameraOptions 결정, runSearch — 라이브 우선 mock 폴백,
liveCluster — applied 에코 메타·유사도 내림차순 매치) + SearchFilterState 옵셔널 확장
(faceFile·bodyFile·recentList·vipList·cameraOptions) + SearchPanel(목록 소스 교체, 드롭존 파일
업로드 배선+미리보기, 빈 최근 대상 문구) + VipQuickSelectRow·CameraSelect에 옵션 prop +
DetailModal(라이브 이동 경로 reidTrajectory — targetId 있으면 mock TRAJECTORY 대체, Analyze
Frame 버튼에 capturedMs 동봉) + reidToMatchItem에 targetId/cameraId/capturedMs 통과(Live
Monitoring 팝업도 라이브 경로·시각 딥링크 동작). types/reid.ts — MatchItem 옵셔널 확장.
ClientLayout — bestFrameAnalyzeMs state + handleGoAnalyzeFrame(location, entryMs?) +
BestFramePage analyzeFrameEntryMs prop. BestFramePage — Analyze Frame 딥링크를 렌더 단계
블록에서 effect로 교체(UV-39 버그 수정 2건: prev 초기값=prop이라 첫 마운트 미발화, 라이브
카메라 목록 반영 전 mock 매칭 레이스) + 라이브 카메라 이름 폴백 매칭 + 시딩 전 카메라
플레이스홀더 감지로 진입 보장(autoOpenDetail은 실감지 있을 때만) + prevFocusLocation 초기값
undefined 센티널(동일 잠재 버그).
Re-ID 팝업 RedMap Trace 배선(UV-39 확장): DataPage — matchTrackRefOf() 헬퍼(MatchItem →
TrackTargetRef, targetId=감지 eventId·sourceType camera — 라이브 매치만, mock은 undefined로
플레인 이동) + ReIDContent onGoRedmap 시그니처 (name?, ref?) + DetailModal 호출부 래핑
(detailItem.label || undefined, matchTrackRefOf) — Live Monitoring 팝업(UV-38)과 동일 딥링크.
types/reid.ts — MatchItem에 optional label(matchedVip 이름, Tracing 라벨용).
DATA RedFace 주입(UV-40, 계약 v1.8): DataPage — redfaceAssociates 브리지 import
(fetchRedfaceAssociates·fetchRedfaceEvidence) + RedfaceCandidate/RedfaceNode 옵셔널 확장
(targetId/cameraId/label, associateId/label/topCameraLabel/firstSeen/lastSeen) +
PrimaryTargetPickerModal(후보 검색 = v1.7 reid-search 재사용 — useReidVips/useReidRecentTargets
훅 호출로 Re-ID 탭과 VIP·최근 검색 공유, faceFile/bodyFile state, liveCands state, handleSearch
라이브 우선 mock 폴백, recentList/vipList/cameraOptions 소스 교체, onConfirm에 dateRange 동봉) +
RedFaceContent(primaryTarget에 ref: RedfacePrimaryRef — 라이브 후보·LM 카드에서만, 팝업 기간이
집계 구간, seedCard 딥링크는 LiveCardExtras 캐스트로 eventId/cameraId 사용·기간 기본 7일) +
AssociateGraphView(liveRef effect로 동료 목록 조회 → allTier1/2/3을 count로 분류해 mock 티어
대체, 필터·정렬은 기존 로컬 로직 그대로, 선택 노드 리셋) + DataGridView(topCameraLabel/
firstSeen/lastSeen/label 실값 폴백) + JointEvidencePanel(liveRef+associateId effect로 집계
요약 조회 → view 정규화 객체로 라이브·mock 동일 렌더, 배지 totalEvents, associateId 표시).
Live Monitoring hover RedFace 버튼 = 위 seedCard 딥링크로 라이브 배선 완료 (UV-38 주입의
onNavigateTab 경로 재사용 — 별도 변경 없음).

BEST FRAME 실영상 타일 주입(UV-43, 계약 v0.9.0 Camera.streamUrl): types/detection.ts CamData에
optional streamUrl + BestFramePage CameraCard 피드 분기 확장(videoUrl → streamUrl(CameraStreamFeed,
WHEP 재생·실패 시 bestframe img 폴백) → img). 데이터 공급은 useBestFrameLive(getCameras 1회 조회로
streamUrl 맵 구성 → dataFor에 동봉). 플레이어는 lib/vca-bridge/CameraStreamFeed.tsx(백엔드 소유,
기획자 정식 타일이 대체할 임시 구현) — 시작 400ms 지연(그리드 전환·StrictMode의 순간 마운트가
WHEP 유령 세션을 만들지 않게), requestVideoFrameCallback 첫 프레임 감지, connectionState 워치독,
15초 재시도. vite.config.ts에 /streams 프록시(:8889 MediaMTX) 추가.
DataPage 타입 수정(UV-40 잔여): recentList/vipList 라이브·mock 유니언에서 `in` 내로잉이 TS
미선언 속성 규칙으로 깨지던 것을 isLiveRecentTarget/isLiveVipOption 타입 프레디킷으로 교체
(tsc -b 0 errors — npm run build 전제).

반입 20260827 (UV-44, import-snapshot-20260827 — 100커밋 대규모): DATA 탭 4→3(Smart Search 탭
제거 → Live Monitoring·Re-ID 내 SlidingSearchPanel/LiveSearchSidebar로 내장), RedFace Joint
Evidence → "Co-capture evidence"(Relationship analytics + Shared frames 프레임 그리드) 재설계,
vcaStore 행 분류 규칙 재설계(UV-31 폐기 — 2분 세션 병합 + 24h 활동 창 + 분류 창, BACKEND
HANDOFF 주석 참조), REDMAP Route history 재구축, CSS 변수 토큰화. 주입 병합 결과:
- 유지·재배치: LM 라이브 피드(useLiveMonitoring — LiveMonitorItem에 topColor 등 신필드 빈 값),
  Re-ID 라이브 검색(runSearch가 LiveSearchSidebar onSearch로, derivedApparel/Props 사용,
  recentList/vipList/cameraOptions는 SearchFilterState 경유 — 사이드바 VIP 탭 vips={state.vipList}),
  RedFace 동료 목록 라이브(AssociateGraphView liveRef — 라이브 노드 status는 label 유무로
  VIP/Unknown 매핑, Data grid 이름·Peak location(topCameraLabel)·Span(first/lastSeen) 라이브
  오버라이드), 피커 라이브 후보(클릭 검색 → **디바운스 500ms effect**로 전환 — theirs의 즉시
  반영 모델, pickedTargetObj에 liveCands[0] 참조 부착), RedMap Trace/Track on Map·Analyze Frame
  딥링크(onGoAnalyzeFrame 시그니처 `at?: number | {date; time}` 유니언으로 통일), Navbar 알림
  (Tracking 행 포함 — 새 규칙에서 라이브 VIP는 대부분 Tracking으로 접힘, confidence 0 미표시),
  BestFramePage 실영상 3단 분기·BestFrameDetailPage 초 단위 스크럽 모델에 UV-37 재배치(에이전트
  보고 참조), 차트 라이브 시간대 집계(라이브 모드에선 dot 레이어 억제).
- 소멸(기획 결정 수용): 상세 팝업 이동 경로 타임라인(reidTrajectory 배선 — RedMap Trace가 대체),
  RedFace Joint Evidence 라이브 집계(fetchRedfaceEvidence — **Shared frames 계약 확장 후 재주입
  예정**, 브리지 함수는 유지), ReelCard 분석 태그 행, redmap showOrigin/originOffset(mock 시작점
  자체가 제거됨), SearchPanel·CameraSelect·SmartSearchContent(컴포넌트 삭제).
- 브리지 정합: redmapSearch HitResult에 personId/personLabel(단일 정체 'p1'), elapsed duration-only
  포맷, elapsedAlert 제거. reidAnalysis ReidMatchCard에 date/status(field 분리). in-내로잉 이슈는
  isLiveRecentTarget/isLiveVipOption 프레디킷 유지.

반입 시 규칙 충돌 주의 (원본 레포에 미반영된 백엔드발 변경 — diff 적용 후 반드시 재확인):
- `types/detection.ts` Detection에 optional `snapshotUrl`/`enrolledPhotoUrl` 필드 (라이브 이미지 공급)
- `lib/vcaStore.ts` addEvent — 확정 행 규칙(VIP 누적 + 카메라 전환 기준 Tracking 별개 1행, UV-31)
  구현의 단일 소유자. 라이브 브리지도 이 addEvent를 호출하므로, 반입으로 이전 병합 규칙이
  되돌아오면 mock/라이브 모두 깨진다 — 기획자 원본 레포에 동일 변경 반영을 요청해 둔 상태.
