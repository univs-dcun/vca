# 모듈 개발자 가이드 — VCA MQTT 발행 계약

> 대상 독자: 분석 모듈(카메라 프레임 처리·집계) 개발자.
> **이 문서 + [MQTT SPEC](https://github.com/univs-dcun/vca-mqtt-broker/blob/main/SPEC.md) + [module-api.json](../openapi/module-api.json)을 클로드 세션에 그대로 전달하면 구현에 필요한 계약 정보가 모두 포함되어 있다.**
> 계약 원본은 두 개 — 실시간은 SPEC.md, 조회 API는 module-api.json. 이 문서는 모듈 관점의 실무 요약이며, 충돌 시 계약 원본이 우선한다.

## 당신(모듈)의 역할 — 두 가지

1. **MQTT 발행** — 감지·상태·집계의 변화분을 EMQX 브로커에 발행한다. 구독자는 웹 브라우저(대시보드)
2. **모듈 API 서빙** — 페이징 목록·이력·그래프 조회 HTTP API를 제공한다. 호출자는 VCA 프록시 백엔드

```
[모듈] --MQTT(TCP 1883, QoS 1)--> [EMQX] --WebSocket--> [브라우저]      (실시간 변화분)
[모듈 API :8081] <--HTTP-- [VCA 프록시] <--/api-- [브라우저]             (스냅샷·이력 조회)
```

감지 데이터의 저장·집계는 모듈 책임이다 (VCA 쪽에는 DB가 없다). 두 채널이 내보내는 값은 서로 일관되어야 한다.

## 접속 정보

| 환경 | 주소 | 인증 |
|---|---|---|
| 개발 | `tcp://<브로커 호스트>:1883` (로컬 기동 시 localhost) | 없음 (익명) |
| 운영 | 추후 공지 | JWT 예정 (별도 안내) |

- 클라이언트 라이브러리: Java면 Eclipse Paho 또는 HiveMQ MQTT Client 권장
- 브로커 로컬 기동: `vca/backend/vca-mqtt-broker`에서 `docker compose up -d`

## 발행해야 할 토픽 5종

`{siteId}`는 현재 `sg` 고정. QoS는 모두 1.

| # | 토픽 | retained | 발행 시점 |
|---|---|---|---|
| 1 | `vca/v1/sg/cameras/{cameraId}/status` | **O** | 상태 변화 시 + **모듈 기동 시 전체 카메라 1회씩** |
| 2 | `vca/v1/sg/cameras/{cameraId}/detections` | X | 감지(대상 등장) 발생 시마다 — **v1.1에서 전 카테고리로 확장** |
| 3 | `vca/v1/sg/cameras/{cameraId}/stats` | **O** | 해당 카메라의 당일 감지 수 변화 시 |
| 4 | `vca/v1/sg/stats/summary` | **O** | 카메라 상태·감지 카운터 등 구성 값 변화 시 |
| 5 | `vca/v1/sg/cameras/{cameraId}/bestframe` | **O** | **초당 1회** — 해당 초의 best shot 메타 (v1.1, BEST FRAME 화면) |

### 1. 카메라 상태

```json
// vca/v1/sg/cameras/cam-novena-01/status   (retained)
{
  "cameraId": "cam-novena-01",
  "name": "Novena",
  "status": "RUNNING",
  "locationId": "loc-novena",
  "location": { "lat": 1.3204, "lng": 103.8439 },
  "ts": "2026-08-10T01:18:23Z"
}
```

- `status`: `RUNNING` | `STOPPED` (두 값뿐)
- 카메라가 시스템에서 제거되면 **빈 페이로드를 retained로 발행**해서 지운다

### 2. 감지 이벤트 (v1.1: 전 카테고리)

```json
// vca/v1/sg/cameras/cam-westgate-bs1/detections   (non-retained)
{
  "eventId": "evt-01J8Z3K7Q9",
  "cameraId": "cam-westgate-bs1",
  "cameraName": "CAM_WestGate_BS1",
  "locationId": "loc-main-intake",
  "category": "vip",
  "label": "Dr. Alex Wong",
  "groupLabel": "VIP group",
  "confidence": 0.984,
  "vip": { "vipId": "vip-042", "name": "Dr. Alex Wong", "similarity": 0.984 },
  "vehicle": null,
  "attributes": { "top": "White top", "bottom": "Brown bottom", "item": "No backpack" },
  "snapshotUrl": "/api/detections/evt-01J8Z3K7Q9/snapshot",
  "location": { "lat": 1.3204, "lng": 103.8439 },
  "detectedAt": "2026-08-10T01:18:23Z"
}
```

- `eventId`: 감지 1건마다 고유. 브라우저가 중복 제거에 사용하므로 **재발행 시에도 같은 감지는 같은 eventId**
- **감지 1건 = 대상의 "등장" 1회.** 같은 대상이 프레임에 연속으로 보이는 동안 재발행하지 않고, 사라졌다 다시 나타나면 새 이벤트 (매 프레임 발행 아님 — 프레임 단위 현황은 5번 bestframe)
- `category`: `vip` | `staff` | `unauthorized` | `vehicle` | `unknown` | `false_positive`(모듈 자체 판정 오탐)
- `vip` 객체는 **등록 인물 매칭 시에만** (category vip·staff) — 그 외 `null`. `vehicle`은 `{ plate, color }`, 인물 외형은 `attributes`
- `label`은 화면 행 제목(인물 이름 / `"Vehicle SGX411"` / 외형 요약), `groupLabel`은 부제(`"Staff (Finance)"`, 차량 색상 등)
- `similarity`/`confidence`: 0~1 실수 (0.726 = 72.6%). 미매칭 카테고리는 `confidence: null`
- `snapshotUrl`: **MQTT 발행 시에는 `/api` 프리픽스를 모듈이 직접 붙인다** (MQTT는 프록시를 거치지 않으므로). REST 응답에서는 반대로 모듈 상대경로 — 아래 모듈 API 절 참고

### 5. Best Frame (v1.1 — BEST FRAME 화면)

```json
// vca/v1/sg/cameras/cam-westgate-bs1/bestframe   (retained, 초당 1회)
{
  "frameId": "bf-cam-westgate-bs1-1754990655123",
  "cameraId": "cam-westgate-bs1",
  "cameraName": "CAM_WestGate_BS1",
  "locationId": "loc-main-intake",
  "capturedAt": "2026-08-18T07:04:10Z",
  "imageUrl": "/api/cameras/cam-westgate-bs1/frames/bf-cam-westgate-bs1-1754990655123",
  "objects": [
    { "eventId": "evt-01J8Z3K7Q9", "category": "vip", "label": "Dr. Alex Wong",
      "bbox": { "x": 0.42, "y": 0.31, "w": 0.08, "h": 0.22 } }
  ]
}
```

- **초당 프레임 중 best shot 1장을 선별**해 메타만 발행 — **이미지 본체는 MQTT에 싣지 않는다.** 브라우저가 `imageUrl`(REST)로 가져간다
- `frameId`가 포함된 `imageUrl`은 **불변 URL** — 같은 프레임이면(변화 없으면) 재발행 생략 가능
- `objects` = 이 프레임에 보이는 대상들. `eventId`는 2번 감지 이벤트와 **같은 값** (화면이 박스와 목록 행을 연결하는 키)
- `bbox`: 프레임 크기 대비 **0~1 정규화** (`x`,`y` = 좌상단, `w`,`h` = 폭·높이)
- `imageUrl`도 `/api` 프리픽스 포함해 발행 (snapshotUrl과 동일 규칙)

### 3. 카메라별 당일 감지 수

```json
// vca/v1/sg/cameras/cam-novena-01/stats   (retained)
{
  "cameraId": "cam-novena-01",
  "detectionsToday": 30,
  "ts": "2026-08-10T01:18:23Z"
}
```

- `detectionsToday`: **등록 VIP 감지 건수** 기준 (지도 라벨에 표시되는 숫자)

### 4. 전역 집계

```json
// vca/v1/sg/stats/summary   (retained)
{
  "cameras": { "running": 42, "stopped": 34 },
  "vipDetections":  { "today": 3, "deltaFromYesterday": -4, "deltaRate": -0.015 },
  "faceDetections": { "today": 6, "deltaFromYesterday": -4, "deltaRate": -0.015 },
  "ts": "2026-08-10T01:18:23Z"
}
```

| 필드 | 정의 |
|---|---|
| `vipDetections.today` | 당일 category=`vip` 감지 건수 (감지 1건 = 1) |
| `faceDetections.today` | 당일 인물 감지 건수 = category `vip`+`staff`+`unauthorized` 합 (`vehicle`·`unknown`·`false_positive`는 어느 카운터에도 미포함) |
| `deltaFromYesterday` | `오늘 총계 - 전일 총계`. 부호가 증감 방향 |
| `deltaRate` | `deltaFromYesterday / 전일 총계`. **전일 총계가 0이면 `null`** |

3번 `detectionsToday`도 category=`vip` 기준이다.

## 반드시 지킬 규칙

1. **ID 형식**: `cameraId`, `locationId`는 `^[a-z0-9-]{1,64}$` — 토픽 경로에 들어가므로 `/`, `+`, `#`, 공백 금지. 한번 부여하면 불변 (이름 변경은 `name` 필드로만). 권장: `cam-{위치}-{순번}`, `loc-{지역}`
2. **로케이션**: 모든 카메라는 정확히 하나의 `locationId`에 속한다. status와 detections 페이로드 양쪽에 항상 포함
3. **시각은 항상 ISO-8601 UTC** (`2026-08-10T01:18:23Z`)
4. **"오늘"의 기준은 사이트 로컬(Asia/Singapore) 자정.** 자정에 당일 카운터를 리셋하고, 리셋된 값을 retained로 재발행
5. **retained 규칙**: 상태성 토픽(1·3·4번)은 retained로 발행 — 브라우저가 새로 접속했을 때 마지막 값을 즉시 받는 초기 동기화 수단이다
6. **envelope 금지**: `{ success, data, ... }` 같은 포장 없이 위 JSON 그대로 발행
7. **필드 추가는 자유** (구독자는 모르는 필드를 무시), 필드 삭제·의미 변경은 계약 위반 — 브로커 담당(박상훈)과 협의

## 두 번째 책임: 모듈 API 서빙

대시보드의 페이징 목록·이력·그래프는 VCA 프록시 백엔드가 **모듈 API를 호출해서** 브라우저에 전달한다. 감지 데이터의 저장·집계·조회는 원천인 모듈의 책임이다 (VCA 쪽에는 DB가 없다).

**계약: [`openapi/module-api.json`](../openapi/module-api.json)** — 이 OpenAPI 스펙이 원본이며, 클로드 세션에 그대로 전달하면 서버 구현이 가능하다. 요약:

| 엔드포인트 | 내용 |
|---|---|
| `GET /v1/dashboard/live-analytics` | 당일 감지 VIP 목록 (페이징, `locationId`·`type` 필터, 행마다 감지 이력 시간 오름차순) |
| `GET /v1/vips` | 등록 VIP 목록 (페이징) |
| `GET /v1/vips/{vipId}/detected-cameras` | VIP가 감지된 카메라 (일 단위, 카메라 중복 제거, 없으면 `cameras: []`) |
| `GET /v1/vips/{vipId}/detections` | VIP 감지 이력 = 이동 경로 (일 단위, 시간 오름차순) |
| `GET /v1/vips/{vipId}/photo` | VIP 등록 사진 바이너리 (image/jpeg 또는 png) |
| `GET /v1/locations` | 로케이션 목록 |
| `GET /v1/cameras` | 카메라 목록 (페이징, `status` 필터) |
| `GET /v1/stats/detection-topology` | 시간대별 감지 수 (0~23시 24버킷 + 7일 평균) |
| `GET /v1/cameras/{cameraId}/detections` | **(v1.1)** 카메라별 최근 감지 (페이징, 전 카테고리, `category` 필터, 최신순) — BEST FRAME 타깃 패널 시딩 |
| `GET /v1/cameras/{cameraId}/frames/{frameId}` | **(v1.1)** best frame 이미지 바이너리 — bestframe 발행의 `imageUrl` 대상 |
| `GET /v1/detections/{eventId}/snapshot` | **(v1.1)** 감지 스냅샷 크롭 바이너리 (썸네일·LIVE SNAPSHOT). 최소 당일+전일 서빙 |
| `POST /v1/persons/search` | **(v1.2)** REDMAP 인물 검색 — multipart 얼굴/바디 이미지 + 기간 + 유사도 임계값 → hit 목록 (capturedAt 오름차순, maxResults 상한) |
| `GET /v1/search-hits/{hitId}/face` | **(v1.2)** 검색 hit 얼굴 크롭 바이너리 — 검색 응답 후 최소 1시간 서빙 |
| `GET /v1/search-hits/{hitId}/body` | **(v1.2)** 검색 hit 바디 크롭 바이너리 — 서빙 규칙 동일 |
| `GET /v1/images` | **(v1.3)** 업로드 이미지 목록 (페이징, 최신순) — BEST FRAME Image list |
| `GET /v1/images/{imageId}/targets` | **(v1.3)** 이미지 검출 대상 전체 (정적, 페이징 없음, bbox 0~1) |
| `GET /v1/images/{imageId}/content` · `.../targets/{targetId}/crop` | **(v1.3)** 이미지 원본·대상 크롭 바이너리 |
| `GET /v1/videos` | **(v1.3)** 업로드 비디오 목록 (페이징, analysisStatus: processing/ready/failed) |
| `GET /v1/videos/{videoId}/content` | **(v1.3)** MP4 바이너리 — **HTTP Range(206) 필수**, 브라우저 재생 가능 코덱(H.264) 책임 |
| `GET /v1/videos/{videoId}/thumbnail` | **(v1.3)** 비디오 썸네일 바이너리 |
| `GET /v1/videos/{videoId}/frames?from&to` | **(v1.3)** 시간 구간의 프레임별 대상 (t 오름차순, 대상 있는 프레임만) — 재생 오버레이 동기화 |
| `GET /v1/videos/{videoId}/targets` · `.../targets/{targetId}/crop` | **(v1.3)** 비디오 내 고유 대상 목록(페이징) + 대표 크롭 |

지킬 규칙:

1. **응답은 데이터 그대로** — envelope 없음 (envelope은 프록시가 씌운다). 오류는 HTTP 상태코드 + `{ "code": "MOD-XXXX", "message": "..." }`
2. **MQTT 발행 값과 일관성** — `eventId`는 MQTT 감지 이벤트와 동일한 값 (브라우저가 두 채널을 이 값으로 병합한다). 카메라 status·locationId·좌표도 MQTT 발행분과 같아야 함
3. **날짜 파라미터** 기본값은 사이트 로컬(Asia/Singapore) 오늘, 응답의 시각 필드는 ISO-8601 UTC
4. **성능 분리** — 조회 서빙이 프레임 분석 성능에 영향을 주지 않도록 분리(프로세스 또는 저장소). 프록시는 5초 타임아웃으로 호출하므로 통상 2초 이내 응답 목표 (예외: v1.2 인물 검색은 60초)
5. **보존 기간** — 최소 당일+전일 데이터는 조회 가능해야 함 (증감 계산·date 파라미터 지원 범위). 장기 보존 정책은 모듈 재량

### (v1.2) REDMAP 인물 검색 — 구현 전 알아둘 것

- **동기 처리 가정** — 검색은 단일 요청/응답이고 프록시가 60초 타임아웃으로 기다린다.
  구현상 60초를 넘길 수 있다면(전체 보존 구간 영상 검색 등) **비동기 job 방식(요청→jobId→폴링)으로
  계약을 바꿔야 하니 구현 착수 전에 계약 담당에게 알려 달라** — v1.2의 유일한 open question이다
- `similarity` 임계값은 face·body 점수에 **공통 적용** — 제공된 이미지 종류별 점수가 임계값 이상인 hit만 반환
- hit 간 경과시간(elapsed) 계산·표시는 프론트 몫 — 모듈은 `capturedAt`만 정확히 주면 된다
- `faceUrl`/`bodyUrl`도 모듈 상대경로 규칙(아래 URL 경로 규칙)을 따른다 — hit 크롭은 검색 응답 후 최소 1시간 서빙
- **차량 번호 검색(REDMAP VEHICLE 모드)은 구현 방식 미확정으로 v1.2 범위에서 제외** — 확정 시 별도 계약으로 추가된다 (UV-34 메모)

### (v1.3) BEST FRAME Video/Image list — 구현 전 알아둘 것

- **업로드는 타 서비스 책임** — 모듈은 업로드된 미디어를 저장·분석하고 이 조회 API로 서빙만 한다.
  업로드 경로/프로토콜은 이 계약 범위 밖 (별도 협의)
- **비디오 재생 방식 = MP4 + 오버레이** — 브라우저 video 태그가 `/videos/{id}/content`를 직접
  재생하고, `/videos/{id}/frames`의 시간 인덱스 대상(bbox)을 currentTime에 동기화해 화면이
  오버레이한다. 따라서:
  - **HTTP Range(206 Partial Content) 지원 필수** — 없으면 시킹·배속이 동작하지 않는다
  - **브라우저 재생 가능한 H.264 MP4 서빙은 모듈 책임** — 원본 코덱이 다르면 분석 시
    트랜스코딩해 보관할 것 (협의 필요 시 계약 담당에게)
- `frames`는 화면이 재생 진행에 따라 구간 단위(기본 60초, 최대 300초)로 나눠 조회한다 —
  전체 영상 인덱스를 한 번에 반환할 필요 없음. 대상이 검출된 분석 프레임만 포함
- `frames.objects[].targetId` = `/videos/{id}/targets`의 targetId — 화면이 오버레이와
  타깃 패널을 이 값으로 연결하므로 반드시 같은 추적 ID를 써야 한다
- analysisStatus가 `ready`가 되기 전에는 content/frames/targets가 조회되지 않아도 된다
  (화면이 processing 항목을 선택 불가로 막는다)

## 참조 구현 (실행 가능)

`vca-mqtt-broker` 레포의 [`sim/sim.mjs`](https://github.com/univs-dcun/vca-mqtt-broker/blob/main/sim/sim.mjs)가
**두 역할 모두의 참조 구현**이다 — MQTT 발행 5종 토픽과 **모듈 API 24개 엔드포인트 전부**를
계약 그대로 구현한 Node 시뮬레이터. v1.3 비디오는 `sim/assets/`의 실제 H.264 MP4를 Range로
서빙하며, **frames의 bbox 수식이 MP4 속 박스 움직임과 동일**해 재생 오버레이가 영상 속 박스를
따라가는지 눈으로 검증할 수 있다 (수식·재생성 ffmpeg 명령은 sim.mjs 주석 참조). v1.2 인물 검색은 두 경로로 응답한다:
등록 VIP 사진(`/vips/{id}/photo`로 서빙되는 바이트)을 그대로 face로 업로드하면 **그 VIP의
실제 당일 감지 이력**을 반환하고(대시보드와 동일 원본 — 화면 간 교차 검증용), 그 외 이미지는
업로드 바이트 해시 기반 결정적 합성 경로를 반환한다 (같은 이미지 → 같은 결과). 발행 형식이나 응답 조립(행 = VIP별, `detections` 시간 오름차순,
MQTT와 동일 `eventId`, photoUrl 상대경로, 시간대 버킷, bestframe 메타+bbox)이 헷갈릴 때 이 코드가 정답이다.

```bash
cd sim && npm install && npm start   # MQTT 발행 + :8081 모듈 API 서빙
# 테스트 편의 환경변수: INTERVAL_MS(감지 주기), BESTFRAME_MS(bestframe 주기),
#   TOGGLE_P(카메라 상태 토글 확률, 0=고정), STOPPED_EVERY(초기 정지 간격, 0=전부 RUNNING)
```

이 참조 구현 + 실제 프록시 + 실제 대시보드 조합으로 **DASHBOARD(2026-08-12)와
BEST FRAME(2026-08-18) 전체 화면 E2E가 검증 완료**된 상태다 — 즉 모듈이 이 계약대로만
구현하면 화면 연결에 추가 작업이 없다. 검증 과정에서 확인된 구현 포인트:

- **URL 경로 규칙 (혼동 주의)** — REST 응답의 리소스 URL(`photoUrl`, `snapshotUrl`)은
  **모듈 기준 상대경로**(`/vips/{vipId}/photo`, `/detections/{eventId}/snapshot`)로 반환한다.
  프록시가 `/api/...`로 재작성해서 브라우저에 전달하므로 모듈이 `/api`를 붙이면 안 된다.
  반대로 **MQTT 발행 페이로드**(`snapshotUrl`, bestframe `imageUrl`)는 프록시를 거치지 않으므로
  **모듈이 `/api` 프리픽스를 직접 붙여** 발행한다 (SPEC §3.2·§3.5)
- 이미지 응답(사진·프레임·스냅샷)은 `image/png` 또는 `image/jpeg` 바이너리 + `Content-Type` 헤더
  (프록시가 그대로 통과시킴). 프레임은 불변 URL이라 장기 Cache-Control 안전
- **Staff도 등록 인물 사진을 서빙**해야 한다 — 화면 팝오버의 ENROLLED DB가 category=staff의
  `vip.vipId`로도 `GET /vips/{vipId}/photo`를 호출한다 (`/vips` 목록 포함 여부와 무관)
- `bbox`는 0~1 정규화 (픽셀 좌표 아님) — 화면이 어떤 크기로 렌더하든 그대로 비율 적용된다
- bestframe은 **retained** — 화면이 카메라를 선택하는 순간 마지막 프레임을 즉시 받는 초기화 수단
- `detection-topology`의 `average`는 7일 데이터가 없으면 `null` 허용 (계약의 nullable — 프론트는 null 안전)
- 시간 버킷(`hour`)은 **사이트 로컬(Asia/Singapore) 기준** — UTC로 버킷하면 그래프가 8시간 밀린다

## 구현 검증 방법

### MQTT 발행

브로커를 로컬 기동한 뒤, 발행이 규약대로 나가는지 CLI로 확인할 수 있다:

```bash
# 전체 토픽 구독해서 모듈 발행 내용 확인
docker run --rm --network vca-mqtt-broker_default eclipse-mosquitto:2 \
  mosquitto_sub -h emqx -t 'vca/v1/sg/#' -v
```

- EMQX 대시보드(http://localhost:18083, admin/public)에서 접속 클라이언트·토픽별 트래픽 확인 가능
- 체크리스트:
  - [ ] 기동 직후 전체 카메라 status가 retained로 발행되는가
  - [ ] 새 구독자가 붙었을 때 status/stats/summary/bestframe을 즉시 받는가 (retained 확인)
  - [ ] 감지 이벤트의 eventId가 건마다 고유한가
  - [ ] 자정(SGT) 리셋 후 카운터가 재발행되는가
  - [ ] deltaRate가 전일 0일 때 null인가
  - [ ] (v1.1) bestframe이 초당 1회 발행되고, objects의 eventId가 detections 발행분과 일치하는가
  - [ ] (v1.1) MQTT의 snapshotUrl/imageUrl에 `/api` 프리픽스가 붙어 있는가
  - [ ] (v1.1) category=vip 외 이벤트에서 vip 필드가 null인가 (vehicle/attributes도 카테고리에 맞게)

### 모듈 API

```bash
# 응답이 module-api.json 계약대로 나오는지 직접 확인 (envelope 없어야 정상)
curl "http://localhost:8081/v1/dashboard/live-analytics?page=0&size=20&type=ALL"
```

- 체크리스트:
  - [ ] 응답에 `{success, data}` 포장이 **없는가** (envelope은 프록시 몫)
  - [ ] 행의 `detections[].eventId`가 MQTT 발행분과 같은 값인가
  - [ ] `detections`가 시간 오름차순인가
  - [ ] 미지원 경로가 `{ "code": "MOD-XXXX", "message": ... }` 형태로 오류를 주는가
  - [ ] (v1.1) `/v1/cameras/{id}/detections`가 최신순이고 REST 응답의 snapshotUrl은 모듈 상대경로인가
  - [ ] (v1.1) bestframe `imageUrl`의 frameId로 `/v1/cameras/{id}/frames/{frameId}`가 이미지를 주는가
  - [ ] (v1.1) staff의 `vip.vipId`로도 `/v1/vips/{vipId}/photo`가 사진을 주는가
  - [ ] (v1.2) `/v1/persons/search`에 face·body 둘 다 없으면 400 `MOD-XXXX`를 주는가
  - [ ] (v1.2) hits가 capturedAt 오름차순이고 faceUrl/bodyUrl이 모듈 상대경로인가
  - [ ] (v1.2) 검색 응답 후 1시간 내 hit 크롭 이미지가 조회되는가 (만료 시 404)
  - [ ] (v1.3) `/v1/videos/{id}/content`가 Range 요청에 206 + Content-Range·Accept-Ranges를 주는가
  - [ ] (v1.3) frames가 t 오름차순·대상 있는 프레임만이고, objects[].targetId가 targets와 일치하는가
  - [ ] (v1.3) 목록 URL 필드(imageUrl/contentUrl/thumbnailUrl/cropUrl)가 전부 모듈 상대경로인가
  - [ ] (v1.3) processing 상태 비디오가 목록에 나오되 durationSec/thumbnailUrl이 null인가

### 대시보드 E2E

VCA 프록시(`vca/backend/proxy`)를 모듈 API로 향하게 띄우면 화면에서 눈으로 확인된다:

```bash
cd vca/backend/proxy && VCA_MODULE_API_BASE_URL=http://localhost:8081/v1 ./gradlew bootRun
```

대시보드 웹(vca/frontend, `npm run dev`) 접속 후 — MQTT 발행이 실시간으로 목록·지도에 반영되고,
**새로고침하면 모듈 API 스냅샷으로 당일 이력이 복원**되면 두 채널 모두 계약대로 동작하는 것이다.
