// DATA Re-ID Analysis 브리지 (계약 v1.7, UV-39) — Re-ID 검색·VIP Quick Select·최근 검색 대상·
// 팝업 이동 경로를 화면 타입으로 변환해 공급한다.
//
// 다른 브리지와 같은 폴백 규칙: 라이브 검색이 성립하지 않거나(검색 대상 없음) 백엔드가
// 응답하지 않으면 null — 화면은 기존 mock(filterReidData/buildTargetResultRows) 흐름 유지.
// 검색 시점 조회라 MQTT와 무관 (REST 단독).
//
// 계약 요점 (openapi.json /persons/reid-search 참조):
// - 검색 대상: 이미지 업로드(face/body) 또는 vipId 참조 중 하나 필수
// - 필터(기간·유사도·카메라·성별·복장·소지품)는 전부 백엔드 적용 — 프론트 후처리 없음
// - 결과는 유사도 내림차순 상위 최대 20, targetId = 감지 eventId (Track on Map·Analyze Frame 재사용 키)
import { useEffect, useState } from 'react'
import {
  reidSearchPersons,
  trackTargetOnMap as trackTargetOnMapApi,
} from '../../api/generated/search/search'
import { getVips } from '../../api/generated/vips/vips'
import type {
  ReidMatch,
  ReidSearchPersonsParams,
} from '../../api/generated/model'

/** 화면 검색 폼 상태 → 브리지 입력 (라벨은 화면 어휘 그대로 — 슬러그 변환은 여기서) */
export interface ReidSearchInput {
  face?: File | null
  body?: File | null
  vipId?: string | null
  dateRange: { start: Date | null; end: Date | null }
  /** 화면 % 값 (30/50/70/90) */
  threshold: number
  /** CameraSelect 값 — 라이브 모드에서는 cameraId, ''는 전체 */
  camera: string
  gender: string
  apparel: string[]
  props: string[]
}

/** 화면 MatchItem 호환 + 상세 팝업·딥링크 확장 필드 */
export interface ReidMatchCard {
  id: number
  face: string
  body: string
  cam: string
  /** "YYYY-MM-DD" (SGT) — 화면 MatchItem.date와 동일 규칙 */
  date: string
  /** "HH:MM:SS" (SGT) */
  time: string
  similarity: number
  gender: 'M' | 'F'
  age: string
  plate: null
  /** 화면 MatchItem.status — 등록 인물(matchedVip)만 VIP, 그 외 Unknown */
  status: 'VIP' | 'Unknown' | 'RedFace'
  /** 감지 eventId — Track on Map(이동 경로)·추후 RedMap Trace의 대상 참조 키 */
  targetId: string
  cameraId: string
  /** capturedAt epoch ms — Analyze Frame 딥링크의 진입 시각 */
  capturedMs: number
  /** matchedVip 이름 (미등록이면 '') */
  label: string
}

export interface ReidSearchView {
  matches: ReidMatchCard[]
  /** 백엔드가 실제 적용한 검색 구간·임계값 에코 */
  applied: { from: string; to: string; similarity: number }
  /** 결과 정체가 등록 인물이면 그 이름 — 클러스터 제목 보조 */
  targetName: string | null
}

// 화면 칩 라벨 → 계약 enum 슬러그 (openapi 파라미터 설명의 매핑 그대로)
const APPAREL_SLUG: Record<string, 'trousers' | 'shorts' | 'skirts' | 'short_sleeve' | 'long_sleeve'> = {
  Trousers: 'trousers',
  Shorts: 'shorts',
  Skirts: 'skirts',
  'Short Sleeve': 'short_sleeve',
  'Long Sleeve': 'long_sleeve',
}
const PROPS_SLUG: Record<string, 'bag' | 'hat' | 'glasses'> = {
  'Backpack/Bag': 'bag',
  Hat: 'hat',
  'Wearing Glasses': 'glasses',
}

// 화면의 date/time 분리 규칙(반입 2026-08-27)에 맞춰 별도 필드로 공급 — 표시 조합(cardTimestamp)은 화면 소유
const dateSgt = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
const timeSgt = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false })

let nextCardId = 900001 // mock id 대역(0~70만)과 겹치지 않게

function toMatchCard(m: ReidMatch): ReidMatchCard {
  return {
    id: nextCardId++,
    face: m.faceUrl ?? m.snapshotUrl, // 얼굴 미검출이면 전신으로 대체 — 팝업 <img>가 빈 src를 받지 않게
    body: m.snapshotUrl,
    cam: m.cameraName,
    date: dateSgt(m.capturedAt),
    time: timeSgt(m.capturedAt),
    similarity: Math.round(m.similarity * 1000) / 10,
    gender: m.gender === 'female' ? 'F' : 'M',
    age: m.age != null ? `${m.age}` : '--',
    plate: null,
    status: m.matchedVip ? 'VIP' : 'Unknown',
    targetId: m.targetId,
    cameraId: m.cameraId,
    capturedMs: Date.parse(m.capturedAt),
    label: m.matchedVip?.name ?? '',
  }
}

/**
 * Re-ID 검색 실행. 성공 시 화면 매치 배열(유사도 내림차순, 빈 배열 = 결과 없음),
 * 라이브 검색 불가(대상 없음/백엔드 미응답) 시 null — 호출측이 mock 흐름으로 폴백한다.
 */
export async function searchReid(input: ReidSearchInput): Promise<ReidSearchView | null> {
  if (!input.vipId && !input.face && !input.body) return null
  const to = input.dateRange.end ?? new Date()
  const from = input.dateRange.start ?? new Date(to.getTime() - 7 * 24 * 3600e3) // 화면 기본 'Last 7 days'
  const params: ReidSearchPersonsParams = {
    similarity: input.threshold / 100,
    from: from.toISOString(),
    to: to.toISOString(),
    ...(input.vipId ? { vipId: input.vipId } : {}),
    ...(input.camera ? { cameraId: input.camera } : {}),
    ...(input.gender === 'Male' ? { gender: 'male' as const } : input.gender === 'Female' ? { gender: 'female' as const } : {}),
    ...(input.apparel.length ? { apparel: input.apparel.map((a) => APPAREL_SLUG[a]).filter(Boolean) } : {}),
    ...(input.props.length ? { props: input.props.map((p) => PROPS_SLUG[p]).filter(Boolean) } : {}),
  }
  try {
    const res = await reidSearchPersons(
      params,
      input.vipId ? {} : { ...(input.face ? { face: input.face } : {}), ...(input.body ? { body: input.body } : {}) },
    )
    const data = res.data
    if (!data) return null
    const matches = (data.results ?? []).map(toMatchCard)
    rememberReidTarget(input, matches)
    return {
      matches,
      applied: { from: data.applied.from, to: data.applied.to, similarity: data.applied.similarity },
      targetName: matches.find((m) => m.label)?.label ?? null,
    }
  } catch {
    console.info('[reid] Re-ID 검색 API 미응답 — mock 흐름 유지')
    return null
  }
}

// ── 최근 검색 대상 (확정 가정: 프론트 로컬 보관 — 모듈에 '최근 검색' 개념 없음) ──
// 검색이 성공할 때마다 입력을 세션(메모리)에 남기고, 클릭하면 같은 입력으로 재검색한다.
// File 참조는 세션 동안만 유효하므로 localStorage가 아닌 모듈 상태로 보관한다.
export interface ReidRecentTarget {
  label: string
  time: string
  face: string
  body: string
  gender: string
  apparel: string
  props: string[]
  /** 재검색용 원본 입력 (face/body File 또는 vipId) */
  input: Pick<ReidSearchInput, 'face' | 'body' | 'vipId'>
}

const recentTargets: ReidRecentTarget[] = []
const recentListeners = new Set<() => void>()

function rememberReidTarget(input: ReidSearchInput, matches: ReidMatchCard[]) {
  const key = input.vipId ?? input.face?.name ?? input.body?.name ?? ''
  const label = matches.find((m) => m.label)?.label
    ?? (input.vipId ? input.vipId : input.face?.name ?? input.body?.name ?? 'Uploaded target')
  const face = input.vipId
    ? `/api/vips/${input.vipId}/photo`
    : input.face ? URL.createObjectURL(input.face) : matches[0]?.face ?? ''
  const body = input.body ? URL.createObjectURL(input.body) : matches[0]?.body ?? face
  const time = `today ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' })}`
  const entry: ReidRecentTarget = {
    label, time, face, body,
    gender: '', apparel: '', props: [],
    input: { face: input.face ?? null, body: input.body ?? null, vipId: input.vipId ?? null },
  }
  const dup = recentTargets.findIndex((t) => (t.input.vipId ?? t.input.face?.name ?? t.input.body?.name ?? '') === key)
  if (dup >= 0) recentTargets.splice(dup, 1)
  recentTargets.unshift(entry)
  if (recentTargets.length > 3) recentTargets.pop()
  recentListeners.forEach((fn) => fn())
}

/** 최근 검색 대상 (세션 보관, 최대 3) — 검색 성공 시 갱신되는 구독형 목록 */
export function useReidRecentTargets(): ReidRecentTarget[] {
  const [list, setList] = useState<ReidRecentTarget[]>([...recentTargets])
  useEffect(() => {
    const fn = () => setList([...recentTargets])
    recentListeners.add(fn)
    return () => { recentListeners.delete(fn) }
  }, [])
  return list
}

// ── VIP Quick Select 라이브 (GET /vips — 등록 VIP 목록) ──
export interface ReidVipOption {
  vipId: string
  name: string
  face: string
  body: string
  gender: string
}

/** 등록 VIP 목록 — REST 미응답이면 null (화면이 mock VIP_QUICK 유지) */
export function useReidVips(): ReidVipOption[] | null {
  const [vips, setVips] = useState<ReidVipOption[] | null>(null)
  useEffect(() => {
    let alive = true
    getVips({ size: 50 })
      .then((res) => {
        if (!alive) return
        const list = res.data?.content ?? []
        setVips(list.map((v) => ({
          vipId: v.vipId,
          name: v.name,
          face: v.photoUrl,
          body: v.photoUrl,
          gender: '', // 계약 Vip에 성별 없음 — mock 생성기 전용 필드라 라이브 경로에서는 미사용
        })))
      })
      .catch(() => { /* 미응답 — mock 유지 */ })
    return () => { alive = false }
  }, [])
  return vips
}

// ── 팝업 이동 경로 — v1.4 Track on Map 재사용 (확정 가정: 감지 당일 경로) ──
export interface ReidTrajectoryRow {
  cam: string
  time: string
  score: number
}

/**
 * 매치 1건의 감지 당일 이동 경로. targetId(=감지 eventId)로 Track on Map을 호출해
 * 팝업 타임라인 행으로 변환한다 (시간 오름차순 — 마지막 행이 이 매치 자신).
 * 미응답이면 null — 팝업은 mock 타임라인 유지.
 */
export async function reidTrajectory(cameraId: string, targetId: string): Promise<ReidTrajectoryRow[] | null> {
  try {
    const res = await trackTargetOnMapApi({ source: { type: 'camera', id: cameraId }, targetId })
    const hits = res.data?.hits
    if (!hits) return null
    return hits.map((h) => ({
      cam: h.cameraName,
      time: `${new Date(h.capturedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })} ${new Date(h.capturedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false })}`,
      score: Math.round((h.faceScore ?? h.bodyScore ?? 0) * 1000) / 10,
    }))
  } catch {
    console.info('[reid] 이동 경로 API 미응답 — mock 타임라인 유지')
    return null
  }
}
