// REDMAP 인물 검색 브리지 — 계약(POST /persons/search, v1.2 / UV-34)을 화면 타입(HitResult)으로 변환.
//
// 다른 브리지와 같은 폴백 규칙: 검색 이미지가 없거나 백엔드가 응답하지 않으면 null을 반환하고,
// 화면은 기존 mock 해시 결과 세트를 그대로 쓴다 (기획자 개발 흐름 보존).
// REDMAP은 검색 시점 조회라 MQTT와 무관 — REST 단독 경로이며 훅이 아닌 함수인 이유다.
//
// 계약이 주지 않는 파생 값은 여기서 계산한다 (openapi.json PersonSearchResult 설명 참조):
// - elapsed: 연속 hit 간 capturedAt 차이 (hits는 시간 오름차순 보장) — duration 문자열만,
//   경고 표시·"Elapsed" 라벨은 화면 소유 (반입 2026-08-27 규칙)
// - personId/personLabel: 검색 응답은 단일 정체의 목격들이라 1개 그룹으로 귀속
import { searchPersons } from '../../api/generated/search/search'
import type { PersonSearchHit } from '../../api/generated/model'
import type { DateRange, HitResult, SimilarityLimit } from '../../features/vca/types/redmap'

const dateSgt = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
const timeSgt = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false })
// 화면은 "99.7%" 문자열을 기대 — 해당 이미지 미제공(점수 null)이면 대시 표기
const pct = (v: number | null | undefined) => (v == null ? '–' : `${(v * 100).toFixed(1)}%`)

// 화면 타입 규칙과 동일: duration만("30m 32s", "1h 40m", "1d 2h") — "Elapsed" 라벨은 UI 소유
function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return h > 0 ? `${d}d ${h}h` : `${d}d ${Math.floor((s % 86400) / 60)}m`
}

function toHitResult(h: PersonSearchHit, prev: PersonSearchHit | undefined): HitResult {
  const gap = prev ? Date.parse(h.capturedAt) - Date.parse(prev.capturedAt) : null
  return {
    id: h.hitId,
    camera: h.cameraName,
    location: h.cameraName,
    date: dateSgt(h.capturedAt),
    time: timeSgt(h.capturedAt),
    score: pct(h.faceScore),
    bodyScore: pct(h.bodyScore),
    isUnregistered: h.matchedVip == null,
    // 크롭이 한쪽만 있으면(미검출 null) 있는 쪽으로 대체 — 화면 <img>가 빈 src를 받지 않게
    faceUrl: h.faceUrl ?? h.bodyUrl ?? '',
    bodyUrl: h.bodyUrl ?? h.faceUrl ?? '',
    mapLabel: h.cameraName,
    lat: h.location.lat,
    lng: h.location.lng,
    // 계약(v1.2/1.4/1.7)의 검색 응답은 단일 정체의 목격들 — person 그룹은 1개로 귀속한다.
    // (다인물 검색이 계약에 생기면 응답의 인물 키로 분리)
    personId: 'p1',
    personLabel: h.matchedVip?.name ?? 'Person 1',
    ...(gap != null ? { elapsed: formatElapsed(gap) } : {}),
  }
}

/** 계약 hits(시간 오름차순) → 화면 HitResult 배열 — 인물 검색과 Track on Map(UV-36)이 공유 */
export function hitsToResults(hits: PersonSearchHit[]): HitResult[] {
  return hits.map((h, i) => toHitResult(h, hits[i - 1]))
}

/**
 * 인물 검색 실행. 성공 시 화면 HitResult 배열(시간 오름차순, 빈 배열 = 결과 없음),
 * 라이브 검색 불가(이미지 없음/백엔드 미응답) 시 null — 호출측이 mock 흐름으로 폴백한다.
 * 검색은 동기 계약(프록시 60초 타임아웃) — axios 기본은 무제한이라 별도 설정 불필요.
 */
export async function searchRedmapPersons(args: {
  face: File | null
  body: File | null
  dateRange: DateRange
  similarity: SimilarityLimit
}): Promise<HitResult[] | null> {
  const { face, body, dateRange, similarity } = args
  if (!face && !body) return null
  try {
    const res = await searchPersons(
      { ...(face ? { face } : {}), ...(body ? { body } : {}) },
      {
        similarity: similarity / 100, // 화면 30/50/70/90 → 계약 0~1
        // 날짜 범위는 사이트 로컬(Asia/Singapore) 하루 경계로 해석해 UTC로 전달
        ...(dateRange.start ? { from: new Date(`${dateRange.start}T00:00:00+08:00`).toISOString() } : {}),
        ...(dateRange.end ? { to: new Date(`${dateRange.end}T23:59:59.999+08:00`).toISOString() } : {}),
      },
    )
    const result = res.data
    if (!result) return null
    if (result.truncated) console.info(`[redmap] 검색 결과가 maxResults 상한에서 잘렸습니다 (searchId=${result.searchId})`)
    return hitsToResults(result.hits ?? [])
  } catch {
    console.info('[redmap] 인물 검색 API 미응답 — mock 결과로 폴백')
    return null
  }
}
