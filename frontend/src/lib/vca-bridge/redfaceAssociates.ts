// DATA RedFace 브리지 (계약 v1.8, UV-40) — 동반 감지 동료 목록·Joint Evidence 집계 요약을
// 화면 타입으로 변환해 공급한다.
//
// 다른 브리지와 같은 폴백 규칙: primary target 참조가 없거나(mock 후보 선택) 백엔드가
// 응답하지 않으면 null — 화면은 기존 mock(REDFACE_TIER*/buildCooccurEvents) 흐름 유지.
//
// 계약 요점 (openapi.json /targets/associates·/targets/associate-evidence 참조):
// - primary target 참조 = source(camera) + targetId(감지 eventId) — reid-search 매치·
//   Live Monitoring 카드가 가진 값 그대로. 기간 생략 시 최근 7일 (applied 에코)
// - 동료는 coCaptures 내림차순 상위 최대 30 — Zone 분류(>100/10~99/<10)·필터는 화면 책임
// - 상세는 집계 요약 — 'Mostly seen together…' 문구 조립은 화면 (pattern 값 사용)
import { getAssociateEvidence, listAssociateFrames, listTargetAssociates } from '../../api/generated/search/search'

export interface RedfacePrimaryRef {
  cameraId: string
  /** primary target의 감지 eventId */
  targetId: string
  /** 팝업 Search Period — 없으면 계약 기본(최근 7일) */
  from?: Date | null
  to?: Date | null
}

/** 화면 RedfaceNode 호환({id,face,count}) + Data Grid·인스펙터 확장 필드 */
export interface RedfaceLiveNode {
  id: number
  face: string
  count: number
  /** Joint Evidence 조회 키 — 인스펙터 표시 ID로도 사용 */
  associateId: string
  /** 등록 인물이면 이름, 미등록이면 '' */
  label: string
  /** Data Grid의 Top camera node — "Orchard (352x)" */
  topCameraLabel: string
  /** "2026-08-20 19:34" (SGT) */
  firstSeen: string
  lastSeen: string
  /** (v1.10) 기간 내 동반 감지가 발생한 고유 장소 수 — Data grid Locations 컬럼 */
  locationsCount: number
  /** (v1.10) 최다 동반 시간대 — Data grid Peak time 컬럼 ("morning" 등 + 건수) */
  peakBucket: string
  peakCount: number
}

export interface RedfaceAssociatesView {
  /** coCaptures 내림차순 — Zone 분류는 화면이 count로 나눈다 */
  nodes: RedfaceLiveNode[]
  applied: { from: string; to: string }
  targetLabel: string
}

const dtSgt = (iso: string) =>
  `${new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })} ${new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' })}`

let nextNodeId = 700001 // mock 노드 id 대역(0~30)과 겹치지 않게

/**
 * 동료 목록 조회. 성공 시 화면 노드 배열(내림차순, 빈 배열 = 동반 인물 없음),
 * 미응답이면 null — 호출측이 mock 티어로 폴백한다.
 */
export async function fetchRedfaceAssociates(ref: RedfacePrimaryRef): Promise<RedfaceAssociatesView | null> {
  try {
    const res = await listTargetAssociates({
      source: { type: 'camera', id: ref.cameraId },
      targetId: ref.targetId,
      ...(ref.from ? { from: ref.from.toISOString() } : {}),
      ...(ref.to ? { to: ref.to.toISOString() } : {}),
    })
    const data = res.data
    if (!data) return null
    return {
      nodes: (data.associates ?? []).map((a) => ({
        id: nextNodeId++,
        face: a.faceUrl,
        count: a.coCaptures,
        associateId: a.associateId,
        label: a.matchedVip?.name ?? '',
        topCameraLabel: `${a.topCamera.cameraName} · ${a.topCamera.count}`,
        firstSeen: dtSgt(a.firstSeenAt),
        lastSeen: dtSgt(a.lastSeenAt),
        locationsCount: a.locations,
        peakBucket: a.peakPeriod.bucket,
        peakCount: a.peakPeriod.count,
      })),
      applied: { from: data.applied.from, to: data.applied.to },
      targetLabel: data.target.label,
    }
  } catch {
    console.info('[redface] 동료 목록 API 미응답 — mock 흐름 유지')
    return null
  }
}

export interface RedfaceEvidenceView {
  totalEvents: number
  /** "2026-08-20 19:34" (SGT) */
  firstSeen: string
  lastSeen: string
  topLocation: { locationId: string; label: string; count: number }
  /** morning | afternoon | evening | night */
  bucket: string
  /** 0~100 (%) */
  pct: number
  /** (v1.10) 주 시간대의 동반 감지 건수 — "Morning · 192" 표기용 */
  peakCount: number
  /** 장소 그룹 count 내림차순 — events는 최신순 최대 5건 표본 */
  groups: Array<{ location: string; count: number; events: Array<{ camCode: string; date: string; time: string }> }>
}

/**
 * Joint Evidence 집계 요약. 목록과 같은 참조·기간에 associateId를 더해 조회한다.
 * 미응답이면 null — 인스펙터는 mock 합성 이벤트 흐름 유지.
 */
export async function fetchRedfaceEvidence(ref: RedfacePrimaryRef, associateId: string): Promise<RedfaceEvidenceView | null> {
  try {
    const res = await getAssociateEvidence({
      source: { type: 'camera', id: ref.cameraId },
      targetId: ref.targetId,
      associateId,
      ...(ref.from ? { from: ref.from.toISOString() } : {}),
      ...(ref.to ? { to: ref.to.toISOString() } : {}),
    })
    const data = res.data
    if (!data) return null
    return {
      totalEvents: data.totalEvents,
      firstSeen: dtSgt(data.firstSeenAt),
      lastSeen: dtSgt(data.lastSeenAt),
      topLocation: { locationId: data.pattern.topLocation.locationId, label: data.pattern.topLocation.label, count: data.pattern.topLocation.count },
      bucket: data.pattern.peakPeriod.bucket,
      pct: Math.round(data.pattern.peakPeriod.ratio * 100),
      peakCount: data.pattern.peakPeriod.count,
      groups: (data.locations ?? []).map((l) => ({
        location: l.label,
        count: l.count,
        events: (l.events ?? []).map((e) => ({
          camCode: e.cameraId,
          date: new Date(e.capturedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }),
          time: new Date(e.capturedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' }),
        })),
      })),
    }
  } catch {
    console.info('[redface] Joint Evidence API 미응답 — mock 흐름 유지')
    return null
  }
}

/** Shared frames 1페이지 — 화면 렌더 형태로 정규화 (계약 v1.10) */
export interface RedfaceFrameRow {
  cameraId: string
  /** 카메라(장소) 표시명 */
  location: string
  /** "YYYY-MM-DD" / "HH:mm" (SGT) — 패널 캡션·Analyze Frame 딥링크 인자 */
  date: string
  time: string
  imageUrl: string
  /** 0~1 정규화 bbox — 검출 실패면 null (박스 없이 렌더) */
  targetBox: { x: number; y: number; w: number; h: number } | null
  associateBox: { x: number; y: number; w: number; h: number } | null
}

export interface RedfaceFramesPage {
  rows: RedfaceFrameRow[]
  page: number
  totalElements: number
}

/**
 * 동시 포착 프레임 페이지 조회 (최신순). 목록과 같은 참조·기간에 associateId를 더해 조회한다.
 * 미응답이면 null — 패널은 mock 합성 프레임 흐름 유지.
 */
export async function fetchRedfaceFrames(
  ref: RedfacePrimaryRef, associateId: string, page: number, size: number,
  /** Peak 카드 필터 — 서버가 적용하고 totalElements도 필터 기준 (계약 v1.10) */
  filter?: { locationId?: string; bucket?: string },
): Promise<RedfaceFramesPage | null> {
  try {
    const res = await listAssociateFrames({
      source: { type: 'camera', id: ref.cameraId },
      targetId: ref.targetId,
      associateId,
      ...(ref.from ? { from: ref.from.toISOString() } : {}),
      ...(ref.to ? { to: ref.to.toISOString() } : {}),
    }, { page, size, ...(filter?.locationId ? { locationId: filter.locationId } : {}), ...(filter?.bucket ? { bucket: filter.bucket as 'morning' | 'afternoon' | 'evening' | 'night' } : {}) })
    const data = res.data
    if (!data) return null
    return {
      rows: (data.content ?? []).map((f) => ({
        cameraId: f.cameraId,
        location: f.cameraName,
        date: new Date(f.capturedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }),
        time: new Date(f.capturedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' }),
        imageUrl: f.imageUrl,
        targetBox: f.targetBox ?? null,
        associateBox: f.associateBox ?? null,
      })),
      page: data.page,
      totalElements: data.totalElements,
    }
  } catch {
    console.info('[redface] 동시 포착 프레임 API 미응답 — mock 흐름 유지')
    return null
  }
}
