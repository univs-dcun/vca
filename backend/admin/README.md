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

## Portal 원장 1차 + API 게이트 (UV-50, admin-api.json 0.5.0)

Portal(관리 콘솔)의 백엔드 — 설계는 [docs/design-vca-portal.md](../../docs/design-vca-portal.md). 브라우저는
프록시 `/api/portal/**` → 여기 `/admin/api/**` 패스스루로 호출한다.

**게이트 (`security/SessionInterceptor`)** — `/admin/api/**` 전체에 세션 필수. 콘솔 역할 없음(`none`) 403
ADM-4030, 변경(GET/HEAD 외)은 owner|admin, 접근 권한 관리(`@RequiresOwner`: 계정 발급·권한·상태·삭제·임시
비밀번호)는 owner. `/auth/**`는 게이트 밖. curl로 직접 호출할 때도 `vca_session` 쿠키가 필요하다.

| 그룹 | 엔드포인트 |
|---|---|
| teams | `GET/POST /admin/api/teams`, `GET/PUT /{teamId}`, `PUT /{teamId}/mail`(SMTP — password 쓰기 전용) |
| projects | `GET/POST /admin/api/projects?teamId=`, `GET/PUT /{projectId}`, `PUT /license`·`/mail`·`/timezone`·`/network-isolation` |
| users | 기존 발급/재발급/목록 + `PUT /{id}/access`·`/app-search`·`/projects`·`/status`, `DELETE /{id}` |
| audit | `GET /admin/api/audit?projectId=&limit=` — 모든 변경 엔드포인트가 기록(actor = 세션 사용자) |

**계정 모델**: `permission`(owner/admin/auditor/none) + `appAccess` + `appSearch` 독립 축, `status`
(active/invited/suspended — suspended는 기존 세션 즉시 차단), `employeeId`(사번 로그인, 대문자 저장),
`email` nullable(메일 없는 환경 — 이메일 또는 사번 중 하나 필수), 팀·프로젝트 배정. **last-owner 가드**:
활성 owner가 0명이 되는 강등·정지·삭제는 409 ADM-4031.

**로그인 응답 코드** (기획자 authErrors.ts 7종 중 W1 구현분): ADM-4010 badCredentials · ADM-4011 sessionExpired ·
ADM-4016 suspended · ADM-4017 notActivated. 잠금(4015)·승인 대기(4018)는 W2.

**기동 시드/마이그레이션**: 팀·프로젝트가 없으면 `team-default`/`proj-default` 생성, 계정이 없으면 초기 owner
시드, 활성 owner가 0명이면 `seed-admin-email` 계정을 owner로 승격, teamId 없는 계정은 기본 팀 귀속.
개발 DB에서 UV-47 스키마로 만든 `user_account.email`은 NOT NULL이라 한 번 풀어야 한다
(`alter table user_account alter column email drop not null;` — 운영 이관 전 Flyway 도입 예정).

## 인증 v3 — 잠금·등록 코드·초대·임시 비밀번호 TTL (UV-51, admin-api.json 0.6.0)

기획자 인증 플로우 문서 §02/03/06/07 이행 (design-vca-portal.md §4).

| 경로 | 설명 |
|---|---|
| `POST /auth/register/lookup` | 등록 코드 조회 — 명부 코드/셋업 코드 풀을 서버가 판별. unknown 404 ADM-4020 · used 409 4021 · expired 410 4022 · throttled 429 4023 |
| `POST /auth/register` | 활성화 — **코드 소각 + 계정 생성/활성화 + 비밀번호 + 세션이 한 트랜잭션**. 명부 admin → 콘솔 admin+앱, operator → none+앱 |
| `POST /auth/invite/redeem` | 초대 링크(`/password-setup?token=`) 완료 — 7일·single-use, 무효 410 ADM-4024 |
| `POST /auth/signup` | 조직 자체 생성 — `vca.admin.self-signup=false`(기본) 또는 owner 존재 시 항상 403 ADM-4032 |
| `POST /admin/api/users/{id}/setup-code` | 기존 계정 셋업 코드(14일) — owner 전용, 계정 invited 전환 |
| `POST /admin/api/users/{id}/invite-token` | 초대 토큰(7일) — owner 전용 |
| `/admin/api/roster` | 명부 CRUD(벌크 추가 행별 결과), `codes/issue`(일괄), `{id}/codes/reissue` |

**집행 규칙**: 코드·토큰은 **해시만 저장**(원문은 발급 응답 1회 — "다시 보기" 없음, 인쇄 슬립은 발급 시점에) ·
single-use · 만료(코드 14일 / 초대 7일 / 임시 비밀번호 24h — 로그인 시 ADM-4019) · 재발급은 이전 코드 즉시 무효 ·
**시도 스로틀** `auth_attempt`: 로그인은 계정(식별자) 단위 5회/15분 → 15분 잠금(ADM-4015), 코드 조회/활성화는
주소(IP, 프록시 X-Forwarded-For) 단위 5회/15분 → throttled. 숫자는 프론트 화면에 인쇄되는 값과 동일(§4.5).

로그인 판정 순서: 잠금 → 자격증명(실패 카운트) → suspended(4016) → invited(4017) → 임시 비밀번호 만료(4019) → 세션.

## 카메라 확장·상태 이력·서버 레지스트리·라이선스 (UV-53, admin-api.json 0.7.0)

Portal Input Sources / Overview / Server & API / License 화면의 백엔드 (design-vca-portal.md §3.1·§5.1).

**카메라 원장 확장**: `projectId`(생략 시 기본 프로젝트), `code`(CAM-{ZONE3}-{NNN} 자동 — 화면 표시 코드, cameraId와
별개), `mac`·`resolution`·`protocol`(TCP|UDP)·`zone`(구역, 기본 name)·`location`(설치 위치 설명)·`serverId`·
`aiFeatures[]`·`thumbnail`. **좌표 필드명이 `location{lat,lng}` → `coordinates`로 바뀜**(0.7.0 비호환 —
Portal mock의 `location: string`과 충돌). 일괄 `PUT /cameras/bulk/zone`·`POST /cameras/bulk/delete`(감사 1줄).
응답의 `status/lastSeenAt/lastChangeAt`은 원장이 아니라 아래 적재값.

**카메라 상태 적재** (`status/`): `MqttStatusSubscriber`가 EMQX `vca/v1/{siteId}/cameras/+/status`(SPEC §3.1,
retained)를 구독 — RUNNING→online, STOPPED→offline, 빈 페이로드→캐시 해제. 상태가 **바뀔 때만**
`camera_status_history`에 한 줄. 기동 시 마지막 상태 복원, EMQX 미접속이면 unknown(치명 아님, 자동 재접속).
**모듈 계약 무변경** — 발행분을 적재하는 것뿐.
- `GET /admin/api/projects/{id}/camera-connectivity` — online/offline/error/unknown + 카메라별 현재 상태
- `GET /admin/api/projects/{id}/camera-stability?days=7&limit=4` — 일별 끊김(online→offline) `dropsByDay[days]`
  oldest-first, 프로젝트 시간대 달력일, drops>0만 내림차순 (기획자 README §4-(2) 형태)

**서버 레지스트리** (`server/`): 타입 5값(AI Camera / Normal Camera / Face Recognition / Image Store / Database),
도달성 검사 = `port` 있으면 TCP connect 2초, 없으면 `InetAddress.isReachable`(ICMP/echo — 권한·방화벽에 따라
false일 수 있어 **port 지정 권장**). 등록·수정 즉시 + 60초마다 자동 검사(`@Scheduled`). `POST /{id}/check` 즉시 검사.

**라이선스**: `ProjectResponse.channelsUsed` = 프로젝트 카메라 수(파생). 업로드는 채널 비소모.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VCA_MQTT_URL` | `tcp://localhost:1883` | EMQX — 빈 값이면 구독 생략(상태 unknown) |
| `VCA_SITE_ID` | `sg` | 토픽 접두 `vca/v1/{siteId}/` |
