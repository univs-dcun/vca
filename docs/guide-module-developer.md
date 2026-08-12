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

## 발행해야 할 토픽 4종

`{siteId}`는 현재 `sg` 고정. QoS는 모두 1.

| # | 토픽 | retained | 발행 시점 |
|---|---|---|---|
| 1 | `vca/v1/sg/cameras/{cameraId}/status` | **O** | 상태 변화 시 + **모듈 기동 시 전체 카메라 1회씩** |
| 2 | `vca/v1/sg/cameras/{cameraId}/detections` | X | VIP 감지 발생 시마다 |
| 3 | `vca/v1/sg/cameras/{cameraId}/stats` | **O** | 해당 카메라의 당일 감지 수 변화 시 |
| 4 | `vca/v1/sg/stats/summary` | **O** | 카메라 상태·감지 카운터 등 구성 값 변화 시 |

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

### 2. VIP 감지 이벤트

```json
// vca/v1/sg/cameras/cam-novena-01/detections   (non-retained)
{
  "eventId": "evt-01J8Z3K7Q9",
  "cameraId": "cam-novena-01",
  "cameraName": "Novena",
  "locationId": "loc-novena",
  "vip": {
    "vipId": "vip-042",
    "name": "Alexander Wright",
    "similarity": 0.726
  },
  "location": { "lat": 1.3204, "lng": 103.8439 },
  "detectedAt": "2026-08-10T01:18:23Z"
}
```

- `eventId`: 감지 1건마다 고유. 브라우저가 중복 제거에 사용하므로 **재발행 시에도 같은 감지는 같은 eventId**
- `similarity`: 0~1 실수 (0.726 = 72.6%)
- **등록 VIP 감지만 발행한다.** 미등록(unauthorized) 얼굴 감지는 이벤트로 발행하지 않고 아래 4번 집계(`faceDetections`)에만 반영

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
| `vipDetections.today` | 당일 등록 VIP 감지 건수 (감지 1건 = 1) |
| `faceDetections.today` | 당일 전체 얼굴 감지 건수 = VIP + 미등록 |
| `deltaFromYesterday` | `오늘 총계 - 전일 총계`. 부호가 증감 방향 |
| `deltaRate` | `deltaFromYesterday / 전일 총계`. **전일 총계가 0이면 `null`** |

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

지킬 규칙:

1. **응답은 데이터 그대로** — envelope 없음 (envelope은 프록시가 씌운다). 오류는 HTTP 상태코드 + `{ "code": "MOD-XXXX", "message": "..." }`
2. **MQTT 발행 값과 일관성** — `eventId`는 MQTT 감지 이벤트와 동일한 값 (브라우저가 두 채널을 이 값으로 병합한다). 카메라 status·locationId·좌표도 MQTT 발행분과 같아야 함
3. **날짜 파라미터** 기본값은 사이트 로컬(Asia/Singapore) 오늘, 응답의 시각 필드는 ISO-8601 UTC
4. **성능 분리** — 조회 서빙이 프레임 분석 성능에 영향을 주지 않도록 분리(프로세스 또는 저장소). 프록시는 5초 타임아웃으로 호출하므로 통상 2초 이내 응답 목표
5. **보존 기간** — 최소 당일+전일 데이터는 조회 가능해야 함 (증감 계산·date 파라미터 지원 범위). 장기 보존 정책은 모듈 재량

## 참조 구현 (실행 가능)

`vca-mqtt-broker` 레포의 [`sim/sim.mjs`](https://github.com/univs-dcun/vca-mqtt-broker/blob/main/sim/sim.mjs)가
**두 역할 모두의 참조 구현**이다 — MQTT 발행 4종 토픽과 **모듈 API 8개 엔드포인트 전부**를
계약 그대로 구현한 Node 시뮬레이터. 발행 형식이나 응답 조립(행 = VIP별, `detections` 시간 오름차순,
MQTT와 동일 `eventId`, photoUrl 상대경로, 시간대 버킷)이 헷갈릴 때 이 코드가 정답이다.

```bash
cd sim && npm install && npm start   # MQTT 발행 + :8081 모듈 API 서빙
```

이 참조 구현 + 실제 프록시 + 실제 대시보드 조합으로 **전체 화면 E2E가 검증 완료**된 상태다
(2026-08-12) — 즉 모듈이 이 계약대로만 구현하면 화면 연결에 추가 작업이 없다. 검증 과정에서
확인된 구현 포인트:

- `photoUrl`은 반드시 **모듈 기준 상대경로**(`/vips/{vipId}/photo`)로 반환 — 프록시가 `/api/...`로
  재작성해서 브라우저에 전달한다. 절대 URL이나 `/api` 프리픽스를 모듈이 붙이면 안 된다
- 사진 응답은 `image/png` 또는 `image/jpeg` 바이너리 + `Content-Type` 헤더 (프록시가 그대로 통과시킴)
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
  - [ ] 새 구독자가 붙었을 때 status/stats/summary를 즉시 받는가 (retained 확인)
  - [ ] 감지 이벤트의 eventId가 건마다 고유한가
  - [ ] 자정(SGT) 리셋 후 카운터가 재발행되는가
  - [ ] deltaRate가 전일 0일 때 null인가

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

### 대시보드 E2E

VCA 프록시(`vca/backend/proxy`)를 모듈 API로 향하게 띄우면 화면에서 눈으로 확인된다:

```bash
cd vca/backend/proxy && VCA_MODULE_API_BASE_URL=http://localhost:8081/v1 ./gradlew bootRun
```

대시보드 웹(vca/frontend, `npm run dev`) 접속 후 — MQTT 발행이 실시간으로 목록·지도에 반영되고,
**새로고침하면 모듈 API 스냅샷으로 당일 이력이 복원**되면 두 채널 모두 계약대로 동작하는 것이다.
