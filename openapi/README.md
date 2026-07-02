# openapi/ — 프론트/백 공유 계약

`openapi.json` 은 백엔드가 생성/관리하는 API 명세이며, 프론트/백이 만나는 **유일한 계약 지점**이다.

## 흐름
1. 백엔드(`backend/`)가 API를 구현하고 OpenAPI 스펙을 생성 → 이 파일을 갱신한다.
   (Spring 이라면 springdoc-openapi 로 `/v3/api-docs` 를 내보내 커밋)
2. 프론트에서 `cd frontend && npm run gen:api` 실행 → `frontend/src/api/generated` 에
   타입 + React Query 훅이 자동 생성된다.

## 규칙
- 이 파일이 원본이다. 프론트의 생성물(`src/api/generated`)은 손대지 않는다.
- 응답 포맷은 플랫폼 규약 `{ success, data, message, code }` 를 따른다.
