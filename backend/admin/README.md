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
