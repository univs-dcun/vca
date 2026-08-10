# 프론트(화면) 개발자 가이드 — DASHBOARD 데이터 계약

> 대상 독자: 화면 계층(`frontend/src/features`, `components`) 담당 기획자.
> **이 문서를 클로드 세션에 그대로 전달하면 DASHBOARD 화면 개발에 필요한 데이터 계약 정보가 모두 포함되어 있다.**
> REST 계약 원본은 [`openapi/openapi.json`](../openapi/openapi.json), 실시간(MQTT) 계약 원본은 [MQTT SPEC](../backend/vca-mqtt-broker/SPEC.md). 전체 그림은 [ARCHITECTURE.md](ARCHITECTURE.md).

## 한 줄 요약

화면에 필요한 데이터는 두 종류다 — **클릭·페이징으로 조회하는 것(REST 훅, 지금 사용 가능)**과 **보고 있는 동안 저절로 바뀌는 것(실시간 훅, 백엔드가 `src/lib`에 구현 예정)**. 화면 컴포넌트는 둘 다 props/훅으로만 받고, 직접 fetch/axios/MQTT 호출은 하지 않는다.

## 1. REST — 생성된 훅 (지금 사용 가능)

`openapi.json` v0.1.0 기준으로 `npm run gen:api` 실행 완료 상태다. `src/api/generated/` 아래에 태그별로 React Query 훅이 생성되어 있다:

| 훅 | 용도 | 주요 파라미터 |
|---|---|---|
| `useGetLiveAnalytics` | Live Analytics 목록 (페이징) | `page`, `size`, `locationId?`, `type?` (ALL/VIP/TRACKING) |
| `useGetVips` | Registered VIP Targets 모달 목록 | `page`, `size` |
| `useGetVipDetectedCameras` | VIP 모달 행 클릭 → 지도에 감지 카메라 점 | `vipId`, `date?` |
| `useGetVipDetections` | Live Analytics 행 클릭 → 이동 경로 좌표 | `vipId`, `date?` |
| `useGetLocations` | Select Location 모달 목록 | — |
| `useGetCameras` | SYSTEM 탭 카메라 목록 (페이징) | `page`, `size`, `status?` |
| `useGetDetectionTopology` | 하단 그래프 — **60초 주기 재조회 권장** (`refetchInterval: 60000`) | `date?` |

- 모든 응답은 `{ success, code, message, data }` envelope. 실제 내용은 `data`에
- 페이징 응답의 `data`는 `{ content, page, size, totalElements }` (page 0부터)
- `date` 미지정 시 사이트 로컬(싱가포르) 기준 오늘
- `src/api/generated`는 자동 생성물 — **직접 수정 금지.** 계약이 갱신되면 `npm run gen:api`로 재생성

## 2. 실시간 — `src/lib/realtime` 훅 (구현 완료)

카메라 상태 변화, 새 감지 이벤트, 상단 카운터는 MQTT로 들어온다. MQTT 연결·구독·REST와의 병합은 `src/lib/realtime`이 전부 처리하므로, **화면은 아래 훅만 import해서 결과를 그리면 된다.** REST 스냅샷과 실시간 델타가 이미 병합된 상태로 온다 — §1의 REST 훅을 직접 쓸 필요가 있는 건 실시간 병합이 없는 조회(useGetVips, useGetLocations, useGetDetectionTopology)뿐이다.

```ts
import { useLiveAnalytics, useStatsSummary, ... } from '@/lib/realtime' // src/lib/realtime
```

| 훅 | 반환 | 화면 영역 |
|---|---|---|
| `useStatsSummary()` | `StatsSummary \| null` — `cameras.running/stopped`, `vipDetections`, `faceDetections` (각 `{today, deltaFromYesterday, deltaRate}`) | 상단 42/34 카운트, EVENTS 탭 카운터 2종. `null`이면 아직 미수신(스켈레톤) |
| `useLiveAnalytics({page, size, locationId?, type?})` | `{rows, totalElements, isLoading, pendingCount, connectionStatus, refetch}` | Live Analytics 목록. `rows`는 병합 완료 상태 — 새 감지가 오면 자동 갱신. 행 타입은 `isTrackingRow(row)` 또는 `detections.length`로 판정 |
| `useVipDetections(vipId \| null, date?)` | `{detections, isLoading}` — 시간 오름차순 | 행 클릭 → 지도 이동 경로. 보고 있는 동안 실시간 연장 |
| `useVipDetectedCameras(vipId \| null, date?)` | `{cameras, isLoading}` | VIP 모달 행 클릭 → 지도 감지 카메라 점. `cameras: []`면 지도 유지 |
| `useCameraList({page, size, status?})` | `{cameras, totalElements, isLoading}` | SYSTEM 탭 목록 — 각 행의 status가 실시간 반영된 상태 |
| `useCameraStats()` | `Record<cameraId, {detectionsToday}>` | 지도 카메라 라벨 숫자 (Novena 30) |
| `useCameraStatuses()` | `Record<cameraId, CameraStatusMessage>` | 지도 마커(좌표·상태) 직접 조합이 필요할 때 |
| `useMqttConnectionStatus()` | `'disabled' \| 'connecting' \| 'connected' \| 'reconnecting' \| 'offline'` | 오프라인 배지 등 |

동작 특성:
- `useLiveAnalytics`는 **1페이지(page 0)에서만** 델타를 행으로 반영하고, 다른 페이지에서는 `pendingCount`만 올린다 (배지 표시 여부는 화면에서 결정)
- `vipId`에 `null`을 주면 조회하지 않는다 (선택 해제 상태)
- 브로커에 연결이 안 되면 REST 스냅샷만으로 동작한다 — MSW 목으로 화면 개발할 때 브로커가 없어도 문제없음. 콘솔의 재연결 로그가 거슬리면 `public/config.js`에서 `MQTT_URL: ''`로 끄면 된다
- 브로커 URL 기본값은 `ws://{현재호스트}:8083/mqtt` — 로컬에서 `vca/backend/vca-mqtt-broker`의 `docker compose up -d`로 실물 브로커를 띄우면 실시간 동작을 직접 볼 수 있다

## 3. 화면 로직 규칙 (계약에서 확정된 것)

화면을 구현할 때 아래 규칙은 계약이므로 그대로 따른다:

1. **행 타입 판정**: Live Analytics 행은 `detections.length === 1`이면 VIP 행, `>= 2`이면 Tracking 행. 별도 타입 필드 없음. 실시간으로 두 번째 감지가 도착하면 VIP 행이 Tracking 행으로 자연 승격된다
2. **경로 그리기**: `detections`는 시간 오름차순 — 순서대로 좌표를 이으면 이동 경로
3. **VIP 모달 지도 점**: `useGetVipDetectedCameras` 결과 `cameras: []`이면 **지도를 기존 상태로 유지** (점 제거도, 이동도 하지 않음)
4. **숫자 포맷은 화면 책임**: `similarity: 0.726` → `72.6%`, `deltaRate: -0.015` → `▼ 1.5%` (부호가 방향, 화살표는 부호로 판정). **`deltaRate`가 `null`이면 퍼센티지 미표시** (전일 데이터 없음)
5. **지도 라벨 색상** (흰/검/파랑/빨강)은 숫자 구간 기반으로 화면에서 결정 — 서버는 숫자만 준다
6. **그래프**: `points`는 0~23시 24개 버킷(사이트 로컬 기준). 미래 시간대는 `count: 0`. `average`는 최근 7일 동일 시간대 평균, `null` 가능

## 4. MSW 목 작성 가이드

백엔드/모듈이 준비되기 전까지 `src/mocks/handlers.ts`에 위 7개 엔드포인트의 목을 추가해서 화면을 완성한다. 목 데이터 작성 시 계약과 어긋나지 않게 주의할 점:

- envelope 포함: `{ success: true, code: "OK", message: null, data: ... }`
- `eventId`는 목에서도 고유하게 (실시간 병합 로직이 이 값으로 중복 제거하므로, 나중에 실데이터로 바꿔도 화면 로직이 동일)
- Tracking 행 목은 `detections`를 2개 이상, 시간 오름차순으로
- ID 형식 준수: `cam-novena-01`, `loc-novena`, `vip-042` 같은 소문자-하이픈
- 시각은 ISO-8601 UTC 문자열

예시 (Live Analytics 1행):

```json
{
  "success": true, "code": "OK", "message": null,
  "data": {
    "content": [
      {
        "vipId": "vip-042",
        "name": "Alexander Wright",
        "detections": [
          { "eventId": "evt-0001", "cameraId": "cam-orchard-01", "cameraName": "Orchard MRT",
            "locationId": "loc-orchard", "location": { "lat": 1.3040, "lng": 103.8320 },
            "similarity": 0.712, "detectedAt": "2026-08-10T00:41:00Z" },
          { "eventId": "evt-0002", "cameraId": "cam-bugis-01", "cameraName": "Bugis MRT",
            "locationId": "loc-bugis", "location": { "lat": 1.3009, "lng": 103.8559 },
            "similarity": 0.726, "detectedAt": "2026-08-10T00:56:00Z" }
        ]
      }
    ],
    "page": 0, "size": 20, "totalElements": 6
  }
}
```

## 5. 자주 하는 질문

- **왜 목록 API에 카메라 상태나 카운터가 없나요?** — 그 값들은 MQTT(실시간 훅)로 온다. REST는 스냅샷·이력·페이징 전용. 채널 경계는 [ARCHITECTURE.md](ARCHITECTURE.md)의 표 참고
- **증감 화살표 값은 어디서?** — 실시간 훅(`stats/summary` 기반)에서 `deltaFromYesterday`/`deltaRate`로 온다. 화면은 계산하지 않고 표시만
- **계약이 바뀌면?** — 백엔드가 `openapi.json` 갱신을 공지하면 `npm run gen:api` 재실행. 생성 타입이 바뀌면 tsc가 어긋난 부분을 알려준다
