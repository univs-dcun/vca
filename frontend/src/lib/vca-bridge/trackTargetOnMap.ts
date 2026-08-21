// Track on Map 브리지 — 계약(POST /targets/track-on-map, v1.4 / UV-36)을 REDMAP 화면 상태로 변환.
//
// BEST FRAME tracked detail에서 대상 참조(source + targetId)만 보내면, 시간 창(track된 SGT
// 당일 00:00 → tracked 시각)과 유사도(0.9)는 백엔드가 결정하고 applied로 에코한다 — 화면의
// 유사도 90%·날짜 표시는 그 에코 값을 그대로 쓴다.
// 폴백 규칙은 다른 브리지와 동일: 백엔드 미응답이면 null — 화면은 기존 mock 딥링크 흐름 유지.
import { trackTargetOnMap as postTrackOnMap } from '../../api/generated/search/search'
import type { DateRange, HitResult, SimilarityLimit } from '../../features/vca/types/redmap'
import { hitsToResults } from './redmapSearch'

/** BEST FRAME HUD가 REDMAP 딥링크에 실어 보내는 대상 참조 */
export interface TrackTargetRef {
  sourceType: 'camera' | 'video' | 'image'
  /** sourceType별 매체 식별자 — cameraId / videoId / imageId */
  sourceId: string
  /** 백엔드가 발급한 대상 ID — camera는 감지 eventId, video/image는 v1.3 targetId */
  targetId: string
}

export interface TrackOnMapView {
  /** 시간 오름차순 — 마지막 항목 = 기준 대상 자신의 감지(경로 종점) */
  results: HitResult[]
  /** "Tracing: …" 라벨 (등록 인물이면 이름) */
  traceName: string
  /** applied 에코 — v1.4 계약이 0.9 고정이라 항상 90 */
  similarity: SimilarityLimit
  /** applied 창의 SGT 당일 (start = end = track된 날) */
  dateRange: DateRange
}

export async function trackTargetOnMap(ref: TrackTargetRef): Promise<TrackOnMapView | null> {
  try {
    const res = await postTrackOnMap({
      source: { type: ref.sourceType, id: ref.sourceId },
      targetId: ref.targetId,
    })
    const r = res.data
    if (!r) return null
    const day = new Date(r.applied.to).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    return {
      results: hitsToResults(r.hits ?? []),
      traceName: r.target.label,
      similarity: Math.round(r.applied.similarity * 100) as SimilarityLimit,
      dateRange: { start: day, end: day },
    }
  } catch {
    console.info('[redmap] Track on Map API 미응답 — mock 딥링크 흐름 유지')
    return null
  }
}
