// Analyze Frame 타임라인 브리지 — 계약(카메라/비디오 bestframes, v1.5 / UV-37)을
// BestFrameDetailPage의 화면 상태(프레임 스트립·재생·프레임별 대상)로 변환한다.
//
// 다른 브리지와 같은 폴백 규칙: 최초 분 조회가 실패하면 live=false 유지 — 화면은 기존
// mock(FRAMES/CAM_DATA) 흐름을 그대로 쓴다.
//
// 시간 모델 (2026-08-24 확정, UV-37):
// - 창은 사이트 로컬(SGT) 분(minute) 단위 — 진입 시 클릭 시점(entryMs)이 속한 분을 연다
// - 프레임은 초당 1장·최대 60장 (모듈이 내부 보관 주기와 무관하게 대표 1장 제공)
// - 재생(1초/프레임)·되감기 1초/10초·앞으로 1초/10초 = step(±초). 분 경계를 넘으면
//   해당 분을 새로 조회해 목표 시각에 가장 가까운 프레임을 선택한다
// - 업로드 비디오는 recordedAt(촬영 메타) 기준 절대 시각 축 — 창이 클립 밖이면 빈 스트립
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCameraBestframes,
  getCameraBestframeTargets,
  getVideoBestframes,
  getVideoBestframeTargets,
} from '../../api/generated/analyze/analyze'
import type { BestFrameTarget } from '../../api/generated/model'
import type { DetType, Detection as ScreenDetection } from '../../features/vca/types/detection'

/** Analyze Frame 진입 컨텍스트 — BestFramePage가 클릭 시점에 만들어 detail 화면에 넘긴다 */
export interface AnalyzeSource {
  type: 'camera' | 'video'
  /** cameraId 또는 videoId */
  id: string
  /** 진입 기준 시각(epoch ms) — 카메라는 클릭 시점, 비디오는 recordedAt + 재생 위치 */
  entryMs: number
}

/** 프레임 스트립 1칸 — 화면 렌더에 필요한 파생값까지 계산해 둔다 */
export interface AnalyzeFrameItem {
  id: string
  ms: number
  /** SGT "12:14:03" */
  time: string
  imageUrl: string
  count: number
}

export interface AnalyzeWindow { date: string; hour: number; minute: number }

const CATEGORY_TO_TYPE: Record<string, DetType> = {
  vip: 'VIP',
  staff: 'VIP',
  vehicle: 'Vehicle',
  unauthorized: 'Unknown',
  unknown: 'Unknown',
  false_positive: 'Unknown',
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`
const timeSgt = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false })
const dateSgt = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
/** epoch ms → SGT 분 창 좌표. SGT는 정시 오프셋(+08:00)이라 분은 UTC 분과 같다 */
const sgtWindow = (ms: number): AnalyzeWindow => ({
  date: dateSgt(ms),
  hour: Number(new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', hour12: false })) % 24,
  minute: new Date(ms).getUTCMinutes(),
})
const windowStartMs = (w: AnalyzeWindow) =>
  Date.parse(`${w.date}T${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}:00+08:00`)

/** 이력 보존 규칙(당일+전일)에 맞는 날짜 선택지 — 화면 날짜 드롭다운용 */
export function analyzeDates(): string[] {
  const now = Date.now()
  return [dateSgt(now), dateSgt(now - 24 * 3600e3)]
}

function targetToDetection(t: BestFrameTarget, time: string): ScreenDetection {
  return {
    id: t.targetId,
    type: CATEGORY_TO_TYPE[t.category] ?? 'Unknown',
    name: t.label,
    group: t.groupLabel ?? t.category,
    confidence: t.confidence != null ? Math.round(t.confidence * 1000) / 10 : 0,
    time,
    top: pct(t.bbox.y),
    left: pct(t.bbox.x),
    width: pct(t.bbox.w),
    height: pct(t.bbox.h),
    snapshotUrl: t.cropUrl,
    enrolledPhotoUrl: t.matchedVip ? `/api/vips/${t.matchedVip.vipId}/photo` : undefined,
    gender: t.gender ?? undefined,
    analysis: t.analysis
      ? {
          basic: t.analysis.basic ?? [],
          top: t.analysis.top ?? [],
          bottom: t.analysis.bottom ?? [],
          addons: t.analysis.addons ?? [],
        }
      : undefined,
  }
}

const nearestIdx = (items: AnalyzeFrameItem[], ms: number) =>
  items.reduce((best, f, i) => (Math.abs(f.ms - ms) < Math.abs(items[best].ms - ms) ? i : best), 0)

export function useAnalyzeTimeline(source: AnalyzeSource | null): {
  /** 라이브 데이터 사용 중 — false면 화면이 mock 흐름을 그대로 유지 */
  live: boolean
  frames: AnalyzeFrameItem[]
  selectedIdx: number
  select: (i: number) => void
  /** ±1초/±10초 이동. 분 경계를 넘으면 그 분을 새로 조회 (재생도 step(1)로 진행) */
  step: (deltaSec: number) => void
  /** 현재 열려 있는 분 창 — 날짜/시/분 표시·선택 박스 연결 지점 */
  window: AnalyzeWindow | null
  /** 날짜/시/분 선택 조회 (기획자 선택 박스 UI가 이 함수에 연결된다) */
  setMinute: (date: string, hour: number, minute: number) => void
  /** 선택 프레임의 대상 목록 — 조회 중엔 null (화면은 직전 상태 유지 권장) */
  detections: ScreenDetection[] | null
} {
  const [live, setLive] = useState(false)
  const [frames, setFrames] = useState<AnalyzeFrameItem[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [window, setWindow] = useState<AnalyzeWindow | null>(null)
  const [detections, setDetections] = useState<ScreenDetection[] | null>(null)
  const targetsCache = useRef(new Map<string, ScreenDetection[]>())
  const seq = useRef(0) // 늦게 도착한 이전 분 응답이 최신 상태를 덮지 않게
  const framesRef = useRef(frames)
  const idxRef = useRef(selectedIdx)
  const windowRef = useRef(window)
  framesRef.current = frames
  idxRef.current = selectedIdx
  windowRef.current = window

  const fetchMinute = useCallback(
    async (w: AnalyzeWindow, selectMs: number | null) => {
      if (!source) return
      const my = ++seq.current
      try {
        const res =
          source.type === 'camera'
            ? await getCameraBestframes(source.id, { date: w.date, hour: w.hour, minute: w.minute })
            : await getVideoBestframes(source.id, { date: w.date, hour: w.hour, minute: w.minute })
        const data = res.data
        if (!data || seq.current !== my) return
        const items: AnalyzeFrameItem[] = (data.frames ?? []).map((f) => {
          const ms = Date.parse(f.capturedAt)
          return {
            id: f.frameId,
            ms,
            time: timeSgt(ms),
            imageUrl: f.imageUrl,
            count: f.targetCount,
          }
        })
        setLive(true)
        setWindow(w)
        setFrames(items)
        setSelectedIdx(items.length ? (selectMs != null ? nearestIdx(items, selectMs) : items.length - 1) : 0)
      } catch {
        // 미응답 — live 상태를 바꾸지 않는다 (최초면 mock 유지, 이후면 기존 분 유지)
        console.info('[analyze] 베스트 프레임 이력 API 미응답')
      }
    },
    [source],
  )

  // 진입: 클릭 시점이 속한 SGT 분을 연다
  useEffect(() => {
    targetsCache.current = new Map()
    setLive(false)
    setFrames([])
    setSelectedIdx(0)
    setWindow(null)
    setDetections(null)
    if (source) void fetchMinute(sgtWindow(source.entryMs), source.entryMs)
  }, [source, fetchMinute])

  // 선택 프레임의 대상 조회 (프레임 클릭·재생 이동 시마다 — frameId 단위 캐시)
  useEffect(() => {
    if (!live || !source) return
    const frame = frames[selectedIdx]
    if (!frame) { setDetections([]); return }
    const cached = targetsCache.current.get(frame.id)
    if (cached) { setDetections(cached); return }
    setDetections(null)
    let stale = false
    const load = source.type === 'camera'
      ? getCameraBestframeTargets(source.id, frame.id)
      : getVideoBestframeTargets(source.id, frame.id)
    load
      .then((res) => {
        const targets = (res.data?.targets ?? []).map((t) => targetToDetection(t, frame.time))
        targetsCache.current.set(frame.id, targets)
        if (!stale) setDetections(targets)
      })
      .catch(() => { if (!stale) setDetections([]) })
    return () => { stale = true }
  }, [live, source, frames, selectedIdx])

  const step = useCallback(
    (deltaSec: number) => {
      const w = windowRef.current
      if (!w) return
      const fr = framesRef.current
      const curMs = fr[idxRef.current]?.ms ?? windowStartMs(w)
      const targetMs = curMs + deltaSec * 1000
      if (targetMs > Date.now()) return // 미래로는 이동하지 않는다
      const start = windowStartMs(w)
      if (targetMs >= start && targetMs < start + 60e3 && fr.length) {
        setSelectedIdx(nearestIdx(fr, targetMs))
        return
      }
      void fetchMinute(sgtWindow(targetMs), targetMs)
    },
    [fetchMinute],
  )

  const select = useCallback((i: number) => setSelectedIdx(i), [])
  const setMinute = useCallback(
    (date: string, hour: number, minute: number) => { void fetchMinute({ date, hour, minute }, null) },
    [fetchMinute],
  )

  return { live, frames, selectedIdx, select, step, window, setMinute, detections }
}
