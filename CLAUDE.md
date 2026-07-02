# CLAUDE.md — VCA 플랫폼 (모노레포)

프론트엔드 전담 인원이 없어, 기획자와 백엔드 개발자가 프론트 코드를 **계층별로 나눠** 담당한다.
이 문서는 두 사람의 Claude 세션이 지켜야 할 소유권 경계를 정의한다.

## 저장소 구조
```
vca/
  frontend/   # Vite + React + TS SPA
  backend/    # Spring Boot (예정)
  openapi/    # 프론트/백 공유 계약 (openapi.json)
```

## 소유권 경계 (중요)
| 영역 | 경로 | 담당 |
|---|---|---|
| 화면(프레젠테이션) | `frontend/src/features`, `frontend/src/components`, `frontend/public` | 기획자 |
| 데이터/연결 | `frontend/src/api`, `frontend/src/lib` | 백엔드 |
| 배포 | `frontend/Dockerfile`, `nginx.conf.template`, `docker-entrypoint.sh`, `backend/` | 백엔드 |
| 공유 계약 | `openapi/openapi.json` | 둘 다 (합의) |

**규칙**
- 프레젠테이션 컴포넌트는 직접 `fetch`/`axios` 호출 금지 — 데이터는 props로만 받는다.
- API 응답 타입은 `openapi.json`에서 orval로 **자동 생성**한다. `frontend/src/api/generated`는 손대지 않는다.
- 자기 담당 영역 밖의 파일은 상대방 확인 없이 수정하지 않는다.

## 계약 흐름
백엔드가 `openapi.json` 갱신 → 프론트에서 `npm run gen:api` → 타입/훅 자동 동기화.
기획자는 그동안 MSW 목(`frontend/src/mocks`)으로 백엔드 없이 화면을 완성한다.

## 응답 포맷
`{ success, data, message, code }` — 페이징은 `{ content, page, size, totalElements }`.

## 브랜치
- 화면 단위 브랜치 권장 (예: `feat/login-ui`, `feat/login-api`).
