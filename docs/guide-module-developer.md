# 모듈 개발자 가이드 — VCA MQTT 발행 계약

> 대상 독자: 분석 모듈(카메라 프레임 처리·집계) 개발자.
> **이 문서와 [MQTT SPEC](https://github.com/univs-dcun/vca-mqtt-broker/blob/main/SPEC.md)을 클로드 세션에 그대로 전달하면 구현에 필요한 계약 정보가 모두 포함되어 있다.**
> 계약의 원본은 SPEC.md이며, 이 문서는 모듈 관점의 실무 요약이다. 충돌 시 SPEC.md가 우선한다.

## 당신(모듈)의 역할

카메라 프레임을 처리해서 나온 결과를 **EMQX 브로커에 MQTT로 발행**한다. 구독자는 웹 브라우저(대시보드)다.
브라우저는 구독만 하므로, 화면에 실시간으로 보이는 모든 값은 모듈이 발행한 그대로다.

```
[모듈] --MQTT(TCP 1883, QoS 1)--> [EMQX] --WebSocket--> [브라우저]
```

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

## REST용 데이터 (참고)

대시보드의 페이징 목록·이력·그래프는 백엔드 API 서버가 REST로 제공한다 ([openapi.json](../openapi/openapi.json)).
이 데이터의 원천도 모듈이므로, **모듈 → 백엔드 데이터 적재 경로**(DB 직접 적재 vs EMQX 규칙 엔진 라우팅)는 추후 브로커 담당과 별도 설계한다. 현재 계약 범위는 MQTT 발행까지.

## 구현 검증 방법

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
