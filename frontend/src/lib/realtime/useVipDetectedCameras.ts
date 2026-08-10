// VIP가 감지된 카메라 목록 = REST 스냅샷 + MQTT 델타 (SPEC.md §5 규칙 7).
// Registered VIP Targets 모달에서 행 클릭 시 지도에 점을 찍는 데이터 소스.
// cameras가 빈 배열이면 화면은 지도를 기존 상태로 유지한다 (계약).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGetVipDetectedCameras } from '../../api/generated/vips/vips'
import type { DetectedCamera } from '../../api/generated/model'
import { topics } from './topics'
import { useMqttSubscription } from './useMqtt'
import type { DetectionEvent } from './types'

export function useVipDetectedCameras(vipId: string | null, date?: string) {
  const [events, setEvents] = useState<DetectionEvent[]>([])

  // 과거 날짜 조회에는 실시간 델타를 붙이지 않는다
  const live = !date

  const query = useGetVipDetectedCameras(vipId ?? '', { date }, { query: { enabled: vipId !== null } })

  useEffect(() => setEvents([]), [vipId, date])

  const handler = useCallback(
    (payload: unknown | null) => {
      if (payload === null || !vipId) return
      const e = payload as DetectionEvent
      if (e.vip.vipId !== vipId) return
      setEvents((prev) => [...prev, e])
    },
    [vipId],
  )

  useMqttSubscription(topics.cameraDetectionsAll(), handler, live && vipId !== null)

  const cameras: DetectedCamera[] = useMemo(() => {
    const snapshot = query.data?.data?.cameras ?? []
    if (!live || events.length === 0) return snapshot
    // cameraId 기준 중복 제거 — 이미 있는 카메라는 lastDetectedAt만 최신으로 (계약)
    const byId = new Map<string, DetectedCamera>(snapshot.map((c) => [c.cameraId, c]))
    for (const e of events) {
      const existing = byId.get(e.cameraId)
      if (existing) {
        if (e.detectedAt > existing.lastDetectedAt) {
          byId.set(e.cameraId, { ...existing, lastDetectedAt: e.detectedAt })
        }
      } else {
        byId.set(e.cameraId, {
          cameraId: e.cameraId,
          locationId: e.locationId,
          location: e.location,
          lastDetectedAt: e.detectedAt,
        })
      }
    }
    return [...byId.values()]
  }, [query.data, events, live])

  return {
    cameras,
    isLoading: vipId !== null && query.isLoading,
    error: query.error,
  }
}
