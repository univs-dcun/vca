# openapi/ — API 계약

REST 계약 2종의 원본. 구조는 `[브라우저] → [프록시 백엔드] → [모듈 API]` (docs/ARCHITECTURE.md 참고).

| 파일 | 구간 | envelope | 소비자 |
|---|---|---|---|
| `openapi.json` | 브라우저 ↔ 프록시 백엔드 (공개 계약) | O — `{ success, data, message, code }` | 프론트 (orval 생성) |
| `module-api.json` | 프록시 백엔드 ↔ 분석 모듈 (내부 계약) | X — 데이터 그대로, 오류는 `{ code, message }` | 모듈 개발자 |

두 계약은 경로·파라미터·데이터 스키마가 동일하며 envelope 유무만 다르다.
(프록시는 모듈 응답을 envelope으로 감싸기만 하는 얇은 계층)

## 흐름
1. 백엔드가 두 계약을 함께 갱신한다 (스키마 변경은 항상 동시 반영).
2. 프론트에서 `cd frontend && npm run gen:api` 실행 → `frontend/src/api/generated` 에
   타입 + React Query 훅이 자동 생성된다.
3. 모듈 개발자에게는 `module-api.json` + `docs/guide-module-developer.md` 를 전달한다.

## 규칙
- 이 파일들이 원본이다. 프론트의 생성물(`src/api/generated`)은 손대지 않는다.
- 공개 계약 응답 포맷은 플랫폼 규약 `{ success, data, message, code }` 를 따른다.
- 실시간 데이터는 REST가 아닌 MQTT — 계약은 vca-mqtt-broker 레포의 SPEC.md.
