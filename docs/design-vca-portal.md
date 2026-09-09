# VCA Portal(관리 콘솔) 백엔드 설계 — 원장·인증·집계

| | |
|---|---|
| 상태 | **초안 (합의 대기)** — §9 기획 확인 항목 회신 후 확정. 단, §7 W1은 확인 항목에 의존하지 않아 선행 착수 |
| 작성일 | 2026-09-09 |
| 티켓 | UV-49 (설계) · UV-50~56 (W1~W7) |
| 작성 | 박상훈 (백엔드) |
| 입력물 | 기획자 전달 패키지 `/platform/portal` (2026-09-09): 화면 16장, 프론트 전체 스냅샷, `README.md`/`HANDOFF.md`, HANDOFF 주석 42곳, 인증 플로우 문서(아티팩트) |
| 선행 문서 | [design-vca-admin.md](design-vca-admin.md) (UV-41 — 카메라 원장 이관·미디어·업로드), [ARCHITECTURE.md](ARCHITECTURE.md) |

## 1. 배경

Portal은 VCA의 관리 콘솔이다: 조직(팀) › 프로젝트 계층 아래에서 카메라·업로드·VIP·계정·서버·라이선스를
관리하고, 운영 현황(연결 상태, 일별 감지, 감사 로그)을 본다. 기획자가 화면 전부를 시드(mock) 데이터로
동작하는 상태까지 완성해 전달했고, **서버 연동은 0건**이다 — 스냅샷에는 HTTP 클라이언트 의존성 자체가
없다. 대신 코드의 `HANDOFF NOTE` 42곳이 "프론트가 지금 무엇으로 때우고 있는지 / 서버가 무엇을 해야
하는지"를 지점별로 명시하고, 화면에 인쇄되는 숫자(TTL·한도)를 상수로 고정해 두었다. 이 문서는 그
전달물을 우리 스택(Admin 백엔드 · 프록시 · 모듈 계약)으로 옮기는 설계다.

### 1.1 "모듈이 모든 정보를 반환한다"는 약속의 재정의

초기 VCA는 모듈(분석 엔진)이 모든 데이터의 원천이었다. UV-41에서 카메라 원장을 Admin으로 이관(v1.9
provisioning)하면서 이미 재편이 시작되었고, Portal은 그 재편을 전 원장으로 확장한다. 원칙을 명문화한다:

| 데이터 종류 | 단일 원천 | 예 |
|---|---|---|
| **원장(마스터)** — 사람(관리자)의 행위로 생기는 것 | **Admin DB** | 팀·프로젝트·카메라·VIP 등록·계정·로스터·서버·업로드 원본·라이선스·감사 로그 |
| **분석 파생** — 전수 데이터를 가진 엔진만 만들 수 있는 것 | **모듈** | 감지 이벤트·best frame·검색/Re-ID/동반 분석·임베딩 상태·일별 감지 집계 |
| **중간 지대** | Admin이 모듈 발행분을 **적재** | 카메라 online/offline **이력**(모듈이 MQTT retained로 발행 → Admin 구독·저장 → 연결/안정도 집계) |

브라우저(대시보드)는 여전히 프록시→모듈로 파생 데이터를 받는다. 전환은 Admin↔모듈 내부에서 일어난다.
모듈 개발자에게는 W5·W6 계약 초안 시점에 이 표를 "약속 범위 재정의"로 함께 전달한다.

## 2. 아키텍처 결정

| 결정 | 내용 | 근거 |
|---|---|---|
| **화면 서빙** | 기존 반입 체계(import 브랜치 → 경로 매핑 3-way → vca `frontend/`)에 **portal 디렉토리 포함**. 별도 앱 없음 | 스냅샷이 단일 Next.js 앱(모니터링+Portal+인증)이라 UV-41 "frontend-admin 별도?" 질문이 단일 SPA로 귀결. `@/*`·`next/navigation` 어댑터 이미 존재 |
| **API 서버** | **Admin 백엔드(:8082)** 가 Portal의 API. 브라우저는 프록시 경유 `/api/portal/**` → Admin `/admin/api/**` 패스스루(UV-47 auth 패턴: envelope 재포장 없음, 쿠키 양방향) | 원장 소유자가 Admin. 동일 오리진 유지 |
| **인증 게이트** | Admin API 전 엔드포인트에 **세션 + 역할 재검사**. 프론트 게이트는 UI 교정일 뿐 | 기획자 코드 주석 3곳: "진짜 문은 서버가 role `none`에게 Portal 엔드포인트를 거절하는 것" |
| **세션** | UV-47 결정 유지 — httpOnly 쿠키 `vca_session` + 서버 세션 저장소 | 기획 문서의 "미결정 질문 #1(토큰 vs 쿠키·만료·재발급·타 기기 종료)"은 이미 답이 있음. 세션 저장소가 있어 세션 목록/종료(W7)도 가능 |
| **인증 설정** | `authConfig` 7 플래그는 **배포 시점 env**(온프레미스 전용 결정 2026-09-02). 호스트명별 조회·비인증 설정 엔드포인트 **만들지 않음** | 기획자 HANDOFF `authConfig.ts:67` |
| **민감정보 경계 갱신** | `rtspUrl`·`ip`는 **대시보드 공개 계약 금지 유지**, **Portal(관리자 세션)에는 표시**. 카메라 `password`·계정 자격증명·코드/토큰 원문은 어디에도 응답하지 않음(해시 저장) | 화면이 rtsp URL을 표시. Portal은 관리자 인증 하의 화면 |
| **시각** | 저장은 UTC, 읽을 때 `project.timeZone`으로 해석 | 기획자 README §5, `lib/time.ts` |

### 2.1 프록시 라우팅

```
브라우저 ──/api/auth/**────▶ 프록시 ──▶ Admin /auth/**          (UV-47, 기존)
브라우저 ──/api/portal/**──▶ 프록시 ──▶ Admin /admin/api/**     (W1 신규, 범용 패스스루)
브라우저 ──/api/**─────────▶ 프록시 ──▶ 모듈 /v1/** (envelope 포장, 기존)
Admin ──PUT /v1/provision/**──▶ 모듈  /  Admin ──MQTT 구독──▶ EMQX (W4)
```

`/api/portal/**`는 메서드·경로·쿼리·JSON 본문·Cookie를 그대로 전달하고 상태·본문·Set-Cookie를 그대로
돌려준다(멀티파트 업로드는 W6에서 추가). 업스트림 미가동은 `VCA-5021/5041`(UV-47 정의)로 구분.

## 3. 도메인 모델 (Admin DB)

식별자는 기존 규칙(`cam-{슬러그}-{4hex}`)을 따라 문자열 슬러그를 서버가 발급한다. 기획자 mock의
`team-univs`/`proj-sg`와 같은 형태다.

### 3.1 신규

| 테이블 | 주요 필드 | 비고 |
|---|---|---|
| `team` | id, name, region, mailDomain?, smtp(host, port, fromAddress, username, passwordEnc, useTls)?, accountManager(name, email)? | 조직. accountManager는 공급사(우리) 기록 — 고객 편집 불가 |
| `project` | id, teamId, name, type(smart_city/smart_school), timeZone(기본 Asia/Singapore), licensePlan, licenseChannelLimit, licenseExpiresAt(null=Unlimited), mailDomain?, smtp?(팀 오버라이드), networkIsolatedDetected, networkIsolatedOverride?, computeInstance?, gpuCount?, modelVersion?, regionName? | 라이선스는 별도 테이블 없이 인라인(기획 mock과 동일). 채널 사용량 = 카메라 수(파생) |
| `person` | id, projectId, name, type(VIP/Tracking), photo(저장 경로)?, registeredAt, description?, priority(normal/high/very_high), groupId? | VIP 원장(W5). 그룹은 최대 1. 사진 없음 = 매칭 불가 상태 |
| `person_group` | id, projectId, name, description?, priority(멤버 기본값), registeredAt | 멤버 수는 파생 |
| `server` | id, projectId, name, ip, type(AI Camera/Normal Camera/Face Recognition/Image Store/Database), specification?, status(success/error), lastCheckedAt | 도달성 헬스체크(W4). Old VCA "Associated Server" 부활분 |
| `uploaded_media` | id, projectId, fileName, kind(video/image), durationSec?, sizeBytes?, resolution?, uploadedAt, uploadedBy, status(pending/analyzing/done/failed), detectionCount? | W6. 라이선스 채널 비소모. id = Best Frame이 조회하는 videoId/imageId |
| `staff_roster` | employeeId(전역 유일), projectId, name, department?, email?, permission(admin/operator), codeHash?, codeIssuedAt?, status(not-issued/unused/used/expired) | W2. 코드 원문은 저장하지 않음 |
| `audit_event` | id, projectId?, actorUserId, actorName, message, at | W1. Overview "Recent activity" 피드 + 감사 |
| `camera_status_history` | cameraId, status(online/offline/error), at | W4. EMQX status 구독 적재 → 연결/안정도 집계 |
| `login_attempt` | key(계정 또는 IP), count, windowStart, lockedUntil? | W2. 잠금·rate limit |
| `password_reset_code` | userId, codeHash, expiresAt, attempts, resendCount, verifiedToken? | W7. 이메일 코드 재설정 |

### 3.2 확장

**`camera`** (W4): `projectId`, `code`(CAM-XXX-000 — 앱 전체 공용 표시 id), `mac?`, `thumbnail?`, `resolution?`,
`protocol?(TCP/UDP)`, `serverId?`, `aiFeatures?`(Re-ID Analysis / License Plate Recognition), `zone`, `location`.
기존 `name/ip/maker/model/username/passwordEnc/rtspUrl/locationId/lat/lng` 유지. 기존 8대는 기본
프로젝트에 귀속(시드).

**`user_account`** (W1) — UV-47/48 원장을 Portal 권한 모델로 확장:

| 필드 | 값 | 비고 |
|---|---|---|
| `permission` | owner / admin / auditor / none | 콘솔 역할. `none` = 콘솔 접근 없음(앱 전용). 기존 시드 admin → owner |
| `appAccess` | boolean | 모니터링 앱 로그인 가능 여부 — 역할에서 파생하지 않는 독립 플래그 |
| `appSearch` | boolean | 앱 내 인물 검색 권한 — 별개 |
| `status` | active / invited / suspended | invited = 코드/초대 받고 아직 비밀번호 미설정. 기존 `mustSetPassword`(임시 비밀번호 상태)는 별개 축으로 유지 |
| `employeeId?` | 사번 | 로그인 식별자 겸용(unique, nullable) |
| `email` | **nullable로 변경**(unique) | 메일 없는 회사 대응. email 또는 employeeId 중 하나는 필수 |
| `teamId`, 프로젝트 배정(`user_project`) | | 앱 프로젝트 가시 범위 |
| `setupCodeHash?`, `setupCodeIssuedAt?` | | W2. 기존 계정에 발급하는 등록 코드(14일) |
| `inviteTokenHash?`, `inviteTokenIssuedAt?` | | W2. `/password-setup?token=`(7일, single-use) |
| `tempPasswordIssuedAt?` | | W2. 임시 비밀번호 24h 만료 |
| `failedLoginCount`, `lockedUntil?` | | W2. 잠금 |

역할 헬퍼(서버 집행): `canEnterPortal` = owner|admin|auditor · `canEditPortal` = owner|admin ·
`canManageAccess`(권한·상태 변경, 계정 삭제) = **owner만** · `hasSomeAccess` = 콘솔 역할 또는 appAccess 중
하나는 있어야 계정 생성/변경 허용 · **last-owner 가드** = 활성 owner가 0명이 되는 변경 거부.

## 4. 인증 v3 (W2) — UV-47/48 대비 갭

이미 일치하는 것: 세션 모델, 임시 비밀번호(서버 생성·1회 노출·해시 저장 — 기획자 `password.ts:74`
요구와 UV-48 구현이 동일), 비밀번호 규칙(8자+영문+숫자+특수문자), Set Password 강제.

### 4.1 로그인 에러 계약 (7종 — 프론트 `authErrors.ts`)

| 프론트 상태 | 코드 | HTTP | 서버 판정 |
|---|---|---|---|
| badCredentials | ADM-4010 | 401 | 식별자 없음/비밀번호 불일치 (구분 없음 — 계정 존재 비노출) |
| locked | ADM-4015 | 423 | 실패 N회 초과 잠금(lockedUntil) |
| suspended | ADM-4016 | 403 | status=suspended — 임시 비밀번호 분기보다 **먼저** 검사 |
| notActivated | ADM-4017 | 403 | status=invited (코드/초대 받고 비밀번호 미설정) |
| pendingApproval | ADM-4018 | 403 | access request 승인 대기 — `accessRequest` 플래그 off라 v3에서는 발생 경로 없음(코드만 예약) |
| sessionExpired | ADM-4011 | 401 | 세션 없음/만료 (기존) |
| signedOut | — | — | 클라이언트 상태(로그아웃 직후 안내) — 서버 응답 아님 |

식별자는 이메일 또는 사번(`employeeIdLogin`). "Keep me logged in"은 기획자 로그인 화면에서 **식별자
기억**으로 의미가 바뀌었다(공유 워크스테이션 — 세션 유지 안 함). UV-47의 30일 쿠키는 계약에 남기되
화면이 보내지 않으면 12h 세션이 기본.

### 4.2 등록 코드 (로스터) — 프론트 `staffRoster.ts` HANDOFF 이행

- 코드: 8자, 알파벳 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`(I/O/0/1 제외), 표시 `XXXX-XXXX`. 서버는 **해시만 저장**
- 두 풀: 로스터 코드(신규 계정 생성) / 계정 셋업 코드(기존 invited 계정 활성화). **단일 조회 엔드포인트**가 풀을
  스스로 판별 — `POST /auth/register/lookup {code}` → `{ ok, name, role, scope }` 또는 `unknown|used|expired|throttled`
- 활성화 `POST /auth/register {code, password}` = **코드 소각 + 계정 생성(또는 활성화) + 비밀번호 설정 단일 트랜잭션**
  → 성공 시 세션 발급
- 집행 4종: single-use · 14일 만료(`issuedAt` 기준) · 재발급 시 이전 코드 즉시 무효 · **주소/IP 단위 5회 rate limit**
  (코드 공간 32^8은 스로틀 앞에서만 안전)
- 로스터 CRUD(`/admin/api/roster`): employeeId 전역 유일(대소문자 무시), CSV import는 프론트가 파싱해 행 단위 커밋 →
  서버는 **벌크 엔드포인트 + 행별 결과**를 제공(부분 성공 리포트)

### 4.3 초대 토큰·임시 비밀번호·셋업 코드

| 수단 | TTL | 저장 | 전달 |
|---|---|---|---|
| 초대 토큰 (`/password-setup?token=`) | 7일 | 해시, single-use | 메일(SMTP 있을 때) |
| 임시 비밀번호 (UV-48 재발급) | **24h** (신규) | 해시 + mustSetPassword | 관리자 수교 |
| 셋업 코드 | 14일 | 해시 | 관리자 수교(종이) |
| 이메일 재설정 코드 (W7) | 10분, 8자리 숫자, 재발송 3회·30초 쿨다운, 시도 5회 | 해시 | 메일 |

### 4.4 서버 전용 통제 (기획 문서 §07)

시도 스로틀 · 코드 single-use · 상태 검사(suspended/invited) · must-change 강제 · last-owner 보호 ·
self-signup 서버 거부(`selfSignup=false`, 최상위 관리자 존재 시 무조건) · **모든 변경 엔드포인트 역할 재검사** ·
**모든 변경 감사 기록**(스냅샷 store는 서버·프로젝트 생성·계정 상태 변경 등 12개 액션의 감사가 누락 — 서버는
전부 기록).

### 4.5 숫자 계약 (화면에 인쇄되므로 불일치 금지)

등록/셋업 코드 14일 · 초대 토큰 7일 · 재설정 코드 10분 · 임시 비밀번호 24h · 코드/재설정 시도 5회 ·
재발송 3회 · 재발송 쿨다운 30초. 기획 확인 대상(§9)이나 확정 전까지 이 값을 구현한다.

## 5. Portal API 그룹 (admin-api.json 0.5.0 →)

| 그룹 | 엔드포인트 | 단계 |
|---|---|---|
| teams | `GET/POST /admin/api/teams`, `PUT /{id}`, `PUT /{id}/mail` | W1 |
| projects | `GET/POST /admin/api/projects?teamId=`, `PUT /{id}`, `PUT /{id}/license`, `PUT /{id}/mail`, `PUT /{id}/timezone`, `PUT /{id}/network-isolation` | W1 (license/mail/timezone/isolation는 W4·W7에서 채움) |
| users | 기존 UV-48 + `PUT /{id}/access {permission, appAccess}`, `PUT /{id}/app-search`, `PUT /{id}/projects`, `PUT /{id}/status`, `POST /{id}/invite-token`, `POST /{id}/setup-code`, `DELETE /{id}` | W1(스키마·역할) / W2(코드·토큰) |
| audit | `GET /admin/api/audit?projectId=&limit=` | W1 |
| roster | `GET/POST(벌크) /admin/api/roster?projectId=`, `PUT/DELETE /{employeeId}`, `POST /codes/issue {employeeIds}`, `POST /{employeeId}/codes/reissue`, `POST /{employeeId}/codes/viewed` | W2 |
| auth | `POST /auth/register/lookup`, `POST /auth/register`, `POST /auth/password/reset/request|verify|complete`, `GET /auth/sessions`, `DELETE /auth/sessions/{id}|/others` | W2 / W7 |
| cameras | 기존 CRUD + `PUT /bulk/zone`, `DELETE /bulk`, `GET /projects/{id}/camera-connectivity`, `GET /projects/{id}/camera-stability?days=7` | W4 |
| servers | `GET/POST /admin/api/servers?projectId=`, `PUT/DELETE /{id}`, `POST /{id}/check` | W4 |
| persons | `GET/POST /admin/api/persons?projectId=`, `PUT/DELETE /{id}`, `POST /{id}/photo`, `POST /bulk`, groups CRUD, `GET /projects/{id}/registry-health` | W5 |
| uploads | `POST /admin/api/uploads`(multipart), `GET ?projectId=`, `DELETE /{id}` | W6 |
| stats | `GET /projects/{id}/detections?days=14` | W7 |

브라우저 계약(openapi.json)에는 `/portal/**` 경로로 대칭 기록(모듈 계약 ↔ 공개 계약과 같은 관계). 응답은
Admin envelope 그대로.

### 5.1 신규 집계 3종 (기획자 README §4 — "요청을 데이터 모양으로 적어둔 것")

| API | 응답 | 원천 | 비고 |
|---|---|---|---|
| `GET /projects/:id/detections?days=14` | `[{daysAgo, total, vip, vehicle, unknown}]` newest last | **모듈** — (a) 모듈 집계 API 신설 vs (b) Admin이 stats/detections 발행분 적재 중 택1 (W7에서 결정, (b) 권고: 모듈 계약 무변경) | 프로젝트 타임존 달력일. `daysAgo` 기준으로 7일/14일 요청이 같은 날 같은 값 |
| `GET /projects/:id/camera-stability?days=7` | `[{cameraId, dropsByDay: number[7]}]` oldest first | **Admin** `camera_status_history` | 합계가 아닌 일별 — "한 오후 4번"과 "나흘간 하루 1번"은 다른 일 |
| `GET /projects/:id/registry-health` | `{missingPhoto[], embeddingFailed[], duplicates[[a,b]], detectedLast7d[]}` | missingPhoto = Admin(사진 부재) / 나머지 3종 = **모듈**(임베딩 상태·중복·최근 목격) | embeddingFailed와 detectedLast7d는 상호 배타 |

## 6. 모듈 계약 영향 (모듈 개발자 협의 필요분)

| 항목 | 내용 | 단계 | 상태 |
|---|---|---|---|
| VIP provisioning | `PUT /v1/provision/vips`(v1.9 패턴, photoUrl pull·photoUpdatedAt 재임베딩) + `GET /provision/vips/status`(임베딩 상태·중복 쌍) + `GET /vips/activity`(최근 목격) → 대시보드 `GET /vips`는 provisioned 뷰. `Vip` additive(type/priority/groupId/groupName/projectId/embeddingStatus) | W5 | **v1.11 초안 작성 (module-api 0.12.0, 2026-09-09) — 협의 대기** |
| 업로드 ingest | `PUT /v1/ingest/videos/{id}`·`/images/{id}`(multipart, Admin 발급 id, 재전송=교체) · `DELETE` · `GET /ingest/status`. 재생 서빙은 v1.3대로 모듈 책임 유지(사본 보관, 저장 중복 v1 수용). VideoItem/UploadedImage에 targetCount·analysisStatus·failedReason additive | W6 (P3) | **v1.11 초안 작성 — 협의 대기** |
| 일별 감지 집계 | (b)안 확정 — Admin이 MQTT detections 적재 (UV-56) | W7 | **완료, 모듈 무관** |
| 감지 분류 이관 | VIP/Tracking 분류·다중 카메라 path를 모듈이 결정해 detections에 additive(`personType`·`trackingPath`)로 발행 → vcaStore `addEvent` 분류 블록 삭제 | W7→협의 | 협의 질문 6번으로 v1.11 패키지에 동봉 — 답에 따라 MQTT SPEC v1.7 초안 |

### 6.1 v1.11 초안의 결정 사항 (2026-09-09)

| 결정 | 선택 | 근거 |
|---|---|---|
| 식별자 발급 주체 | **Admin** — vipId `vip-{슬러그}-{4hex}`, videoId `vid-…`, imageId `img-…` | 카메라(v1.9)와 동일. 화면·MQTT·모듈이 같은 키 |
| VIP 사진 전달 | 초안 A안: Admin 내부 URL을 provisioning에 실어 **모듈이 pull** | provisioning 본문이 가볍고 재임베딩 판정(photoUpdatedAt)이 자연스럽다. B안(공유 스토리지)은 협의 질문 1 |
| 업로드 전달 | 초안 A안: **multipart push**, Admin이 원본 원장 보관 + 모듈이 분석용 사본 | v1.3 서빙 책임(MP4 Range·썸네일·frames)을 모듈에 그대로 두어 브라우저 계약 불변. 저장 중복은 v1 수용 |
| 임베딩·분석 진행 | 비동기 허용 — 상태 API(`/provision/vips/status`, `/ingest/status`)를 Admin이 폴링 | 콜백은 모듈→Admin 방향 의존을 하나 더 만든다. 폴링 주기는 화면 진입 시 + 처리 중 항목 있을 때만 |
| registry-health 원천 분리 | missingPhoto = Admin(사진 부재) / embeddingFailed·duplicates = `/provision/vips/status` / detectedLast7d = `/vips/activity` | 원장이 아는 것과 분석이 아는 것을 섞지 않는다 |
| 기존 조회 계약 | **전부 불변** — 원천만 바뀐다. additive 필드는 v1.11 미구현 모듈이 생략 가능 | 전방 호환 규칙(구독자는 없는 필드를 null로) |

카메라 상태 이력·연결 집계·Portal CRUD 전반은 모듈 무관.

## 7. 작업 패키지

| 단계 | 티켓 | 내용 | 의존 |
|---|---|---|---|
| W0 | UV-49 | 이 문서 + 티켓 분할 + 기획 확인 회신 | — |
| **W1** | UV-50 | 팀/프로젝트 · 계정 확장 · **Admin API 세션·역할 게이트** · 감사 로그 · 프록시 `/api/portal` 패스스루 · 로그인 status 검사 | 없음 — 선행 착수 |
| W2 | UV-51 | 인증 v3: 에러 계약 7종·사번 로그인·잠금·로스터/등록 코드·초대 토큰·임시 비밀번호 TTL·self-signup 거부 | W1 |
| W3 | UV-52 | 화면 반입(portal 포함) + 인증·Portal API 배선 + 스탠드인 4곳 세션 교체(fail-closed) | W1·W2 |
| W4 | UV-53 | 카메라 확장 · 상태 이력(EMQX 구독) · 연결/안정도 집계 · 서버 레지스트리+헬스체크 · 라이선스 | W1 |
| W5 | UV-54 | VIP 원장 이관 + provisioning + registry-health | 모듈 협의 |
| W6 | UV-55 | 업로드/ingest (P3) | 모듈 협의 |
| W7 | UV-56 | 일별 감지 집계 · SMTP 재설정 · 세션 목록/종료 · 타임존 · 감지 분류 이관 | W1·W4 |

각 단계는 기존 패턴(계약 초안 → 구현 → sim/curl → E2E → PR)을 따른다. W3부터 Portal 화면이 실데이터로 뜬다.

## 8. 스냅샷 반입 시 유의 (W3)

- 기획자 프론트 **전체** 스냅샷이라 앱 쪽 8/27 반입 이후 드리프트 포함(CommandPalette 제거, VerificationCodeInput 추가 등) — 반입 diff에서 함께 처리
- 서버 컴포넌트 2곳(`signup/page.tsx` redirect 등)은 Vite용 클라이언트 shim으로
- 스탠드인 4곳(`SIGNED_IN_USER`, `currentPortalRole`, `projectsVisibleInApp`, `canSearchInApp`)은 기획자 지시대로
  **호출부 유지·본문만 세션 응답으로 교체**, 기본값은 거부(fail-closed)
- `demo=` 쿼리 파라미터·`generateTemporaryPassword()`·`issueInviteToken()` 등 목업 전용 코드는 배선 시 삭제(fallback으로 남기지 말 것 — 기획자 지시)
- `authConfig`는 `NEXT_PUBLIC_*` → Vite `define` 치환으로 배선

## 9. 기획 확인 항목

1. **권한 매트릭스 문서 재공유** — HANDOFF.md §2의 아티팩트(`228dc3d3…`)가 접근 불가(삭제 또는 미공유). 코드에서 모델을 복원해 §3.2에 반영했으나 규범 문서 확인 필요
2. **로스터 스코프** — 프로젝트 단위(현 mock) vs 조직 전체 공용 (기획자 ASSUMPTION 표기)
3. **숫자 확정** — 코드 14일 / 초대 7일 / 임시 비밀번호 24h (기획자 OPEN QUESTION 표기). 확정 전까지 §4.5 값으로 구현
4. **재설정 코드 이중 발급** — 관리자가 메일로 보낸 코드와 사용자가 "Forgot password?"로 요청한 코드의 상호 무효화 정책 (기획자 OPEN QUESTION)
5. **문서 불일치 확인** — HANDOFF.md §7 "Portal 일부 화면 제외"(실제는 6탭 전부 구현), grace.tan 역할(문서 admin / 시드 owner), Excel import "미구축" 주석(CSV import 구현됨), FEATURES.md §8 무동작 목록 vs §4 배선 완료
6. **Input Sources "AI engines"·"server assigned" 칩** — 카메라별 AI 기능 배정·서버 배정의 실사용 의미(모듈 분석 옵션과의 관계)

## 10. 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-09-09 | 초안 — 기획자 전달 패키지 분석, 아키텍처 결정·도메인·인증 v3·작업 패키지 W0~W7 |
| 2026-09-09 | W1·W2·W4·W7 구현 완료(UV-50/51/53/56). §6 모듈 계약 v1.11 초안(VIP provisioning·ingest) 작성·§6.1 결정 사항 — 모듈 협의 대기 |
