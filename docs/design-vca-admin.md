# VCA Admin 분리 설계 — 카메라 등록·미디어 업로드·실시간 스트리밍

| | |
|---|---|
| 상태 | **초안 (합의 대기)** — 기획자·모듈 담당자 확인 후 확정 |
| 작성일 | 2026-08-26 |
| 티켓 | UV-41 |
| 작성 | 박상훈 (백엔드) |

## 1. 배경과 요구

1. **BEST FRAME Normal network의 실영상**: 카메라 클릭 시 현재의 초당 1프레임(bestframe
   MQTT + REST 이미지)이 아니라 **실제 영상 스트리밍**을 제공해야 한다.
   - Video list 클릭 → 비디오 파일 재생: 현행(v1.3) 그대로.
   - 재생 화면 hover → **Analyze Frame** 클릭 → 그 화면에서 1분 60프레임(초당 1): 현행(v1.5)
     그대로. **실영상 도입 후에도 분 단위 프레임 이력 계약은 변경 없이 유효** — 모듈이 보관한
     분석 프레임 이력이라 스트리밍과 별개 채널이다.
2. **VCA Admin 서비스 분리**: Old VCA에 있던 카메라 등록(Add New Camera — Source Type
   Normal/AI, Camera Name, IP, Maker/Model, User ID/Password, RTSP URL, Associated Server,
   좌표)과 BEST FRAME Video/Image list의 동영상·이미지 업로드를 **VCA Admin**이라는 별개
   서비스로 관리한다. Admin 화면은 기획자가 기획·개발 중.
3. **VCA(대시보드)는 소비만**: Admin에서 등록/업로드한 카메라·동영상·이미지가 VCA 목록에
   보이고, 클릭하면 실시간 영상 / 파일 재생 / 이미지 표시.

v1.3 계약이 이미 "업로드는 타 서비스 책임 — 모듈은 저장·분석·조회 서빙만"으로 명시해 두었고,
VCA Admin이 그 "타 서비스"가 되는 것이므로 계약 철학의 방향 전환은 아니다.

## 2. 확정된 설계 방향 (2026-08-26)

| 결정 | 내용 |
|---|---|
| 스트리밍 | **별도 미디어 서버**(RTSP→WebRTC/HLS 게이트웨이, MediaMTX 후보)가 중계. 분석 모듈은 스트리밍 책임 없음 |
| 카메라 원장 | **Admin DB가 단일 원천**. 모듈은 Admin이 내려준 목록만 분석하고 상태(RUNNING/STOPPED)를 MQTT로 보고. VCA의 카메라 목록은 **Admin 백엔드가 상태를 병합해 서빙** |
| 업로드 전달 | Admin이 저장 후 **모듈 ingest API(신규 계약)** 로 전달. 분석 진행 상태는 기존 v1.3 `analysisStatus`(processing→ready) 재사용 |
| 착수 순서 | 이 설계 문서 + 계약 초안 합의 → 단계별 구현 (§7) |

## 3. 컴포넌트 구성

```
[VCA Admin 화면] ──┐ (기획자)
                   ▼
            [VCA Admin 백엔드]  ←— 카메라 원장 DB·미디어 메타 (우리, backend/admin 신설)
              │        │  │
              │        │  └─ ② provisioning ──→ [분석 모듈] ── MQTT(detections·status·bestframe) ──→ [EMQX]
              │        │  └─ ③ ingest(영상·이미지) ─┘   │                                              │
              │        └─ ① 스트림 경로 동기화 ──→ [미디어 서버(MediaMTX)]                             │
              ▼                                        │                                              ▼
        [VCA 프록시] ←— 카메라 목록(+streamUrl)        └── WebRTC/HLS ──→ [VCA 대시보드] ←── 실시간 구독
```

| 컴포넌트 | 책임 | 담당 |
|---|---|---|
| **VCA Admin 백엔드** (신설, Spring Boot — `backend/admin`) | 카메라 원장 CRUD·자격증명 보관, 동영상/이미지 업로드 수신·저장, 모듈 provisioning·ingest 호출, 미디어 서버 경로 동기화, VCA용 카메라 목록 서빙(모듈 상태 병합) | 백엔드 |
| **VCA Admin 화면** | 카메라 등록/수정/삭제, 업로드 UI | 기획자 |
| **미디어 서버** (신설, MediaMTX 후보) | 카메라 RTSP → 브라우저 재생 가능(WebRTC/HLS) 중계. Admin이 등록/삭제 시 REST로 path 동기화 | 백엔드 (운영 구성) |
| **분석 모듈** | (불변) 프레임 분석·감지 발행·조회 API 서빙. **+ 신규**: provisioning 수신, 미디어 ingest 수신 | 모듈 개발자 |
| **VCA 프록시** | (불변) envelope·중계. **변경**: 카메라 목록 라우팅 대상을 모듈→Admin으로 전환 | 백엔드 |
| **VCA 대시보드** | (불변) 소비. **변경**: BEST FRAME 선택 타일을 실영상 플레이어로 교체 | 기획자(타일 UI)+백엔드(브리지) |

**책임 경계 원칙** (기존 논의의 확장):
- 모듈은 "분석"과 그 부산물(분석 상태·분석 프레임·감지)만 소유한다. **장비 원장·자격증명·
  스트리밍·업로드 수신은 모듈 책임이 아니다.**
- RTSP URL·카메라 자격증명은 **민감정보** — Admin DB와 Admin→모듈/미디어 서버 내부 채널에만
  존재하고, VCA 공개 계약(브라우저)에는 절대 노출하지 않는다.

## 4. 데이터 흐름

### 4.1 카메라 등록 → 실시간 영상
1. Admin 화면에서 카메라 등록(§6.1 스키마) → Admin DB 저장
2. Admin 백엔드가 **미디어 서버에 스트림 path 생성**(cameraId ↔ RTSP URL) — 삭제/수정 시 동기화
3. Admin 백엔드가 **모듈에 provisioning**(§6.3-A) — 모듈은 이 목록의 스트림만 분석 시작,
   상태를 MQTT `cameras/{id}/status`로 보고 (SPEC v1 그대로)
4. VCA 카메라 목록: 프록시 `GET /api/cameras` → **Admin 백엔드**가 원장 + 모듈 상태(MQTT 구독
   캐시)를 병합해 기존 계약 형태 그대로 응답. **additive로 `streamUrl` 추가** (§6.2)
5. BEST FRAME 타일: `streamUrl` 재생(WebRTC/HLS 플레이어). 감지·타깃 패널은 기존
   detections(MQTT+REST) 채널 그대로

### 4.2 업로드 → 목록/재생
1. Admin 화면 업로드 → Admin 백엔드 저장(원본 보관) → **모듈 ingest API**(§6.3-B) 전달
2. 모듈: `analysisStatus=processing` → 분석 완료 시 `ready` (v1.3 계약 그대로)
3. VCA Video/Image list·재생·이미지 표시: **변경 없음** — 기존 v1.3 조회 계약 그대로, 원천만
   실제 업로드분으로 바뀐다

### 4.3 실영상 도입 후 기존 채널의 역할
| 채널 | 도입 후 |
|---|---|
| MQTT `detections` | 불변 — 대시보드·DATA·타깃 패널의 감지 원천 |
| MQTT `status` | 불변 — 모듈의 분석 상태 보고 (소비자에 Admin 추가) |
| MQTT `bestframe` (초당 1장) | **선택 타일 프레임 용도는 실영상으로 대체.** 존치 여부는 open question(§8-③) — 권고: 1단계에서는 실영상 타일에 bbox 오버레이를 얹지 않고(동기화 지연 문제), bestframe 발행은 유지하되 화면 소비만 중단 |
| Analyze Frame 분 단위 이력 (v1.5 REST) | 불변 — 모듈 보관 프레임 이력. 실영상과 별개 |

## 5. VCA 화면 영향 (변경 최소)

- **BEST FRAME 선택 타일만 교체**: bestframe `<img>` → 실영상 플레이어(LiveVideoFeed처럼
  vca-bridge 소유 임시 구현 가능, 정식 타일은 기획자). `streamUrl` 없으면 기존 bestframe
  폴백 — 단계 전환 중에도 화면이 깨지지 않게
- Video/Image list, Analyze Frame, DATA 탭, REDMAP: **변경 없음**
- 카메라 목록 계약 형태 불변(additive streamUrl)이라 orval 재생성 외 화면 수정 없음

## 6. 계약 초안 (합의 후 정식 버전으로 반영)

### 6.1 Admin 카메라 원장 스키마 (Admin DB — Old VCA 폼 기준)
```
Camera(원장): cameraId, sourceType(normal|ai), name, ip, maker, model,
              username, password(암호화), rtspUrl, associatedServer,
              locationId, lat, lng, createdAt, updatedAt
```
- Admin 화면↔백엔드 계약은 기획자와 별도 협의 (이 문서 범위는 경계 정의까지)

### 6.2 VCA 공개 계약 변경 (openapi.json — additive)
- `Camera`에 `streamUrl: string | null` 추가 — 브라우저가 재생할 스트림 경로
  (동일 오리진 `/streams/{cameraId}/...`, nginx가 미디어 서버로 프록시). 미디어 서버 미구성·
  스트림 미가용이면 null → 화면은 bestframe 폴백
- `GET /cameras` 형태·의미 불변, **서빙 주체만 모듈 → Admin 백엔드로 이관** (프록시 라우팅 변경)
- 민감 필드(ip·자격증명·rtspUrl)는 공개 계약에 포함하지 않음

### 6.3 모듈 API 변경 (module-api.json — 신규 2군)
**A. 카메라 provisioning** — Admin → 모듈
```
PUT /v1/provision/cameras
body: { cameras: [{ cameraId, name, rtspUrl, locationId, location{lat,lng}, sourceType }] }
→ 200 { accepted: n }
```
- 전체 목록 멱등 교체(선언적) — 모듈은 이 목록과 자기 분석 상태를 수렴시킨다
  (추가된 카메라는 분석 시작, 빠진 카메라는 중단). 부분 patch보다 동기화 사고가 적다
- 모듈의 기존 `GET /v1/cameras`는 "분석 중 카메라 뷰"로 의미 축소(내부 검증용 유지) —
  VCA가 참조하는 원천은 Admin 서빙본

**B. 미디어 ingest** — Admin → 모듈
```
POST /v1/videos  (multipart: file + name + recordedAt?)  → { videoId, analysisStatus:"processing" }
POST /v1/images  (multipart: file + name)                → { imageId }
DELETE /v1/videos/{videoId} · /v1/images/{imageId}       (Admin에서 삭제 시)
```
- 이후 조회·재생·분석 상태는 기존 v1.3 계약 그대로 (`analysisStatus` processing→ready)

### 6.4 MQTT SPEC 변경
- 페이로드 변경 없음. §5 경계에 "카메라 원장은 Admin 소유, 모듈은 provisioning 수신 후
  상태 보고" 명시, bestframe 소비 주체 변경(§8-③ 결론 반영)

## 7. 단계 계획

| 단계 | 내용 | 산출 |
|---|---|---|
| **P0 (이번)** | 이 설계 합의 — 기획자(Admin 화면·타일 UI)·모듈 담당(provisioning/ingest 수용) 확인 | 본 문서 |
| **P1** | Admin 백엔드 골격: `backend/admin`(Spring Boot+DB), 카메라 CRUD, 모듈 provisioning 계약 확정·sim 반영 | Admin API + 계약 vNext |
| **P2** | 미디어 서버 도입(MediaMTX), streamUrl 공급, BEST FRAME 타일 실영상 교체(+bestframe 폴백) | 실영상 E2E |
| **P3** | 업로드 API + 모듈 ingest, Video/Image list 실업로드 연동 | 업로드 E2E |
| **P4** | 카메라 목록 서빙 이관(프록시 라우팅 전환), 전체 E2E·가이드/패키지 갱신 | 전환 완료 |

각 단계는 기존 패턴(계약 초안 PR → 합의 → 프록시/sim/브리지/주입 → E2E → PR)을 따른다.
sim은 P1부터 provisioning·ingest를 수용하는 참조 구현으로 확장하고, P2의 개발용 모의
스트림(테스트 소스 → MediaMTX)을 docker-compose에 추가한다.

## 8. Open Questions (합의 필요)

1. **Normal Camera vs AI Camera**(Old VCA Source Type): AI Camera는 자체 분석 내장 장비로
   모듈 분석 대상에서 제외되는가? 그렇다면 AI Camera의 감지 결과는 어떤 경로로 들어오는가
   (모듈이 수집 대행? 별도 채널?) — **기획자·모듈 담당 확인 필요**
2. **Associated Server**의 의미: 모듈 인스턴스(분석 서버) 지정인가, 녹화/스토리지 서버인가 —
   provisioning 라우팅에 영향
3. **bestframe 토픽 존치**: 실영상 타일에 bbox 오버레이가 필요한가? 필요하면 오버레이
   동기화 방식(지연 허용치) 논의, 불필요하면 발행 중단 시점 결정
4. **Admin 저장소·배포**: DB 선정(PostgreSQL 권고), 업로드 원본 보관 위치(로컬 볼륨/객체
   스토리지), Admin 레포 위치(모노레포 `backend/admin` + `frontend-admin`? 별도 레포?)
5. **Admin 인증**: 관리자 서비스라 로그인/권한이 필요할 것 — 범위·방식(기존 계정 체계 유무)
6. **기존 등록분 이관**: Old VCA에 등록된 카메라 데이터의 마이그레이션 필요 여부
