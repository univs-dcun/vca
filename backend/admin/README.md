# VCA Admin 백엔드

카메라 원장의 **단일 원천** — 설계·경계는 `docs/design-vca-admin.md` (UV-41), P1 구현은 UV-42.

| 책임 | 상태 |
|---|---|
| 카메라 원장 CRUD (자격증명 AES-GCM 암호화 보관) | P1 완료 |
| 원장 변경 시 모듈 provisioning — `PUT {module}/provision/cameras` (계약 v1.9, 전체 목록 선언적 멱등 교체) | P1 완료 |
| 미디어 서버(MediaMTX) 스트림 경로 동기화 — 카메라당 path 1개(이름 = cameraId, source = rtspUrl, sourceOnDemand) | P2 완료 (UV-43) |
| 동영상·이미지 업로드 수신 → 모듈 ingest | P3 |
| VCA용 카메라 목록 서빙 (모듈 상태 병합, 프록시 라우팅 이관) | P4 |

## 실행

```bash
docker compose up -d          # PostgreSQL(5433) + MediaMTX(8554/8889/9997/8189udp) + 개발 모의 스트림
./gradlew bootRun             # :8082
```

미디어 서버 구성은 [mediamtx.yml](mediamtx.yml) — 개발 편의로 인증을 열어 두었으니 운영 주의사항은
파일 주석 참조. 개발 모의 스트림(test-stream 컨테이너)이 `test` path로 합성 영상을 발행하고,
시드 카메라의 rtspUrl이 그 path를 가리켜 실카메라 없이 BEST FRAME 실영상 E2E가 돈다.

- 기동 시 원장이 비어 있으면 기본 카메라 8대를 시드하고(끄려면 `VCA_ADMIN_SEED=false`),
  기동마다 두 대상(모듈 provisioning + 미디어 서버 path)에 1회 push한다 (재기동 후 수렴 보장).
- 대상이 죽어 있어도 CRUD는 성공한다 — 원장이 원천이고, `POST /admin/api/provision/sync`로 따라잡는다.

## API (Admin 화면 전용 — 계약 초안 `openapi/admin-api.json`, 기획자 협의 대상)

| 메서드·경로 | 설명 |
|---|---|
| `GET /admin/api/cameras` | 원장 목록 (name 오름차순) |
| `GET /admin/api/cameras/{cameraId}` | 단건 |
| `POST /admin/api/cameras` | 등록 — cameraId는 Admin이 발급(`cam-{슬러그}-{4hex}`), locationId 생략 시 name 슬러그 |
| `PUT /admin/api/cameras/{cameraId}` | 수정 — `password` 생략(null) 시 기존 값 유지 |
| `DELETE /admin/api/cameras/{cameraId}` | 삭제 |
| `POST /admin/api/provision/sync` | 수동 재동기화 (모듈 provisioning + 미디어 서버 path) |
| `GET /admin/api/provision/status` | 마지막 동기화 상태 — `{ module, media }` 대상별 |

응답은 플랫폼 공통 envelope `{ success, data, message, code }`. 오류 코드는 `ADM-XXXX`.

**민감정보 경계**: `password`는 쓰기 전용(응답에 없음 — `hasCredential`로 설정 여부만),
`rtspUrl`·`ip`·자격증명은 Admin·모듈 내부 채널 전용으로 VCA 공개 계약(openapi.json)에 노출하지 않는다.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VCA_ADMIN_DB_URL` | `jdbc:postgresql://localhost:5433/vca_admin` | 원장 DB |
| `VCA_ADMIN_DB_USER` / `VCA_ADMIN_DB_PASSWORD` | `vca` / `vca` | DB 계정 |
| `VCA_MODULE_API_BASE_URL` | `http://localhost:8081/v1` | 분석 모듈 API (provisioning 대상) |
| `VCA_MEDIA_API_BASE_URL` | `http://localhost:9997` | 미디어 서버 제어 API (path 동기화 대상) — 빈 값이면 동기화 생략 |
| `VCA_ADMIN_ENC_KEY` | dev 키 | 자격증명 암호화 키 — **운영 필수 주입**, 변경 시 기존 암호문 복호화 불가 |
| `VCA_ADMIN_SEED` | `true` | 빈 원장에 기본 카메라 8대 시드 |

## 인증 (UV-47, admin-api.json 0.3.0)

VCA 로그인의 계정 원장·세션 저장소. 브라우저는 프록시 경유(`/api/auth/**` → 여기 `/auth/**`)로
호출하며, 프록시는 응답(이미 envelope)을 재포장 없이 쿠키까지 패스스루한다.

| 엔드포인트 | 설명 |
|---|---|
| `POST /auth/login` | 로그인 — httpOnly 쿠키 `vca_session` 발급. keepLoggedIn: 세션 12h ↔ 30일 |
| `GET /auth/me` | 현재 사용자 프로필 `{ name, email, accountId, role, team }` |
| `POST /auth/logout` | 세션 파기 + 쿠키 삭제 (멱등) |
| `POST /auth/password/verify` | 현재 비밀번호 확인 (My Page 모달 1단계) |
| `POST /auth/password` | 비밀번호 변경 — 형식 8자+영문+숫자+특수문자, 현재 세션 외 전 세션 무효화 |

- 비밀번호는 BCrypt 해시, 세션 토큰은 SHA-256 해시만 DB 저장 (`user_account`·`user_session`)
- 오류: ADM-4010(자격증명 — 이메일 존재 여부 비노출), ADM-4011(세션 없음/만료), ADM-4012(현재 비밀번호 불일치)
- 계정 원장이 비어 있으면 초기 운영자 시드 (아래 환경변수)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VCA_ADMIN_COOKIE_SECURE` | `false` | 세션 쿠키 Secure 플래그 — TLS 운영에서 `true` |
| `VCA_ADMIN_SEED_EMAIL` | `admin@univs.ai` | 빈 계정 원장에 시드할 초기 운영자 (빈 값이면 생략) |
| `VCA_ADMIN_SEED_PASSWORD` | `VcaAdmin1234!` | 초기 비밀번호 — **운영 필수 주입** 후 첫 로그인 시 변경 |

## 계정 발급 (UV-48, admin-api.json 0.4.0)

기획 확정: 사용자는 직접 가입하지 않는다 — 담당자가 계정 + 임시 비밀번호를 발급해 오프라인
전달(메일 불가 환경 대응). 발급 화면은 Admin(portal) 서비스 소관이고, 아래는 그 화면이 호출할
API다. 프록시에 라우트가 없어 VCA 대시보드(브라우저)에서는 접근 불가.

| 엔드포인트 | 설명 |
|---|---|
| `POST /admin/api/users` | 발급 — 임시 비밀번호를 서버가 생성해 **응답에 단 한 번만 반환** (DB에는 BCrypt 해시만). `mustSetPassword=true`로 시작 |
| `POST /admin/api/users/{userId}/reset-password` | 재발급(분실 대응) — 기존 세션 전부 무효화 + Set Password 강제 복귀 |
| `GET /admin/api/users` | 목록 — 전달 후 상태 확인용 (`mustSetPassword`, `lastLoginAt`) |

첫 로그인 흐름: 임시 비밀번호 로그인 → 화면이 `mustSetPassword`를 보고 Set Password 강제 →
`POST /auth/password/setup`(임시 상태 세션 전용, 현재 비밀번호 불요) → 해제 후 메인 진입.
오류: ADM-4013(이미 설정됨 — 변경 API 몫), ADM-4090(이메일 중복), ADM-4041(사용자 없음).
