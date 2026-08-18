// VIP 이동 경로 = REST 감지 이력 + MQTT 델타 연장 (SPEC.md §5 규칙 7과 동일 패턴).
// Live Analytics 행 클릭 시 지도에 선을 긋는 데이터 소스. detections는 시간 오름차순.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGetVipDetections } from '../../api/generated/vips/vips'
import type { Detection } from '../../api/generated/model'
import { detectionFromEvent } from './liveAnalyticsMerge'
import { topics } from './topics'
import { useMqttSubscription } from './useMqtt'
import { isVipDetection, type DetectionEvent, type VipDetectionEvent } from './types'

export function useVipDetections(vipId: string | null, date?: string) {
  const [events, setEvents] = useState<VipDetectionEvent[]>([])

  // 과거 날짜 조회에는 실시간 델타를 붙이지 않는다 (이벤트는 항상 "지금" 발생분이므로)
  const live = !date

  const query = useGetVipDetections(vipId ?? '', { date }, { query: { enabled: vipId !== null } })

  useEffect(() => setEvents([]), [vipId, date])

  const handler = useCallback(
    (payload: unknown | null) => {
      if (payload === null || !vipId) return
      const e = payload as DetectionEvent
      // v1.1: detections 스트림에 전 카테고리가 흐른다 — vip 매칭 이벤트만 반영 (SPEC §3.2)
      if (!isVipDetection(e) || e.vip.vipId !== vipId) return
      setEvents((prev) => [...prev, e])
    },
    [vipId],
  )

  useMqttSubscription(topics.cameraDetectionsAll(), handler, live && vipId !== null)

  const detections: Detection[] = useMemo(() => {
    const snapshot = query.data?.data?.detections ?? []
    if (!live || events.length === 0) return snapshot
    const seen = new Set(snapshot.map((d) => d.eventId))
    const appended = [...snapshot]
    for (const e of events) {
      if (seen.has(e.eventId)) continue
      seen.add(e.eventId)
      appended.push(detectionFromEvent(e))
    }
    return appended.sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))
  }, [query.data, events, live])

  return {
    detections,
    isLoading: vipId !== null && query.isLoading,
    error: query.error,
  }
}
