// Live Analytics 병합 규칙의 순수 함수 구현 — 계약 원본: SPEC.md §5
// REST 스냅샷(LiveAnalyticsRow[]) 위에 MQTT 감지 이벤트를 vipId 기준 upsert한다.
import type { Detection, LiveAnalyticsRow } from '../../api/generated/model'
import type { VipDetectionEvent } from './types'

/** MQTT 감지 이벤트 → REST Detection 구조 (vip 정보는 행 컨텍스트로 이동) */
export function detectionFromEvent(e: VipDetectionEvent): Detection {
  return {
    eventId: e.eventId,
    cameraId: e.cameraId,
    cameraName: e.cameraName,
    locationId: e.locationId,
    location: e.location,
    similarity: e.vip.similarity,
    detectedAt: e.detectedAt,
  }
}

/** detectedAt 오름차순을 유지하며 삽입 (거의 항상 맨 뒤 append) */
function insertSorted(detections: Detection[], d: Detection): Detection[] {
  let i = detections.length
  while (i > 0 && detections[i - 1].detectedAt > d.detectedAt) i--
  return [...detections.slice(0, i), d, ...detections.slice(i)]
}

/**
 * 이벤트 1건을 목록에 반영한다.
 * - 이미 반영된 이벤트(eventId 중복)면 원본 배열을 그대로 반환 (참조 동일 → 리렌더 없음)
 * - vipId가 없으면 새 행을 맨 앞에 추가, 있으면 해당 행의 detections에 삽입
 */
export function upsertDetectionEvent(rows: LiveAnalyticsRow[], e: VipDetectionEvent): LiveAnalyticsRow[] {
  const idx = rows.findIndex((r) => r.vipId === e.vip.vipId)

  if (idx === -1) {
    const newRow: LiveAnalyticsRow = {
      vipId: e.vip.vipId,
      name: e.vip.name,
      detections: [detectionFromEvent(e)],
    }
    return [newRow, ...rows]
  }

  const row = rows[idx]
  if (row.detections.some((d) => d.eventId === e.eventId)) return rows

  const next = [...rows]
  next[idx] = { ...row, detections: insertSorted(row.detections, detectionFromEvent(e)) }
  return next
}

/** 여러 이벤트를 순서대로 반영 */
export function applyDetectionEvents(rows: LiveAnalyticsRow[], events: VipDetectionEvent[]): LiveAnalyticsRow[] {
  return events.reduce(upsertDetectionEvent, rows)
}

/** 행 타입 판정 — 계약: detections.length 1 = VIP 행, >= 2 = Tracking 행 */
export function isTrackingRow(row: LiveAnalyticsRow): boolean {
  return row.detections.length >= 2
}
