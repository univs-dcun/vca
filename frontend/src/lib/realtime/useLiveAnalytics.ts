// Live Analytics 목록 = REST 스냅샷 + MQTT 델타 병합 (SPEC.md §5).
// 화면은 이 훅의 rows만 그리면 된다 — 행 타입은 isTrackingRow() 또는 detections.length로 판정.
//
// 병합 정책:
// - 1페이지(page 0)를 보고 있을 때만 델타를 행으로 반영한다.
//   다른 페이지에서는 pendingCount만 올린다 (배지 표시 여부는 화면 소관 — SPEC §5 규칙 5)
// - locationId 필터 활성 시 이벤트의 locationId가 다르면 버린다 (규칙 6)
// - 중복은 eventId로 제거 (규칙 3), 행 타입 승격은 length로 자연 처리 (규칙 4)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGetLiveAnalytics } from '../../api/generated/dashboard/dashboard'
import { GetLiveAnalyticsType } from '../../api/generated/model'
import type { LiveAnalyticsRow } from '../../api/generated/model'
import { applyDetectionEvents, isTrackingRow } from './liveAnalyticsMerge'
import { topics } from './topics'
import { useMqttConnectionStatus, useMqttSubscription } from './useMqtt'
import { isVipDetection, type DetectionEvent, type VipDetectionEvent } from './types'

// 세션이 아주 길어질 때의 메모리 상한. 초과분은 오래된 이벤트부터 버린다
// (이미 rows에 반영된 뒤라 화면 영향 없음 — 이후 스냅샷 refetch와의 dedup 범위만 줄어든다).
const MAX_BUFFERED_EVENTS = 1000

export type UseLiveAnalyticsOptions = {
  page?: number
  size?: number
  locationId?: string
  type?: GetLiveAnalyticsType
}

export function useLiveAnalytics(options: UseLiveAnalyticsOptions = {}) {
  const { page = 0, size = 20, locationId, type = GetLiveAnalyticsType.ALL } = options

  // 구독은 마운트 시점에 바로 시작하고(스냅샷 조회와 병행), 겹침은 eventId dedup으로 해소한다.
  const [events, setEvents] = useState<VipDetectionEvent[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  const query = useGetLiveAnalytics({ page, size, locationId, type })
  const connectionStatus = useMqttConnectionStatus()

  // 필터·페이지가 바뀌면 이전 조건으로 수집한 델타는 무효
  useEffect(() => {
    setEvents([])
    setPendingCount(0)
  }, [page, size, locationId, type])

  const handler = useCallback(
    (payload: unknown | null) => {
      if (payload === null) return
      const e = payload as DetectionEvent
      // v1.1: detections 스트림에 전 카테고리가 흐른다 — Live Analytics는 vip만 반영 (SPEC §3.2)
      if (!isVipDetection(e)) return
      if (locationId && e.locationId !== locationId) return
      if (page !== 0) {
        setPendingCount((n) => n + 1)
        return
      }
      setEvents((prev) => {
        const next = prev.length >= MAX_BUFFERED_EVENTS ? prev.slice(prev.length - MAX_BUFFERED_EVENTS + 1) : prev.slice()
        next.push(e)
        return next
      })
    },
    [locationId, page],
  )

  useMqttSubscription(topics.cameraDetectionsAll(), handler)

  const rows: LiveAnalyticsRow[] = useMemo(() => {
    const snapshot = query.data?.data?.content ?? []
    const merged = applyDetectionEvents(snapshot, events)
    if (type === GetLiveAnalyticsType.VIP) return merged.filter((r) => !isTrackingRow(r))
    if (type === GetLiveAnalyticsType.TRACKING) return merged.filter(isTrackingRow)
    return merged
  }, [query.data, events, type])

  return {
    rows,
    /** 서버 스냅샷 기준 총 행 수 — 델타로 추가된 새 VIP는 다음 refetch 때 반영된다 */
    totalElements: query.data?.data?.totalElements ?? 0,
    page,
    size,
    isLoading: query.isLoading,
    error: query.error,
    /** 다른 페이지를 보는 동안 도착한 새 감지 수 (1페이지로 돌아가면 0으로 리셋) */
    pendingCount,
    /** 'disabled'면 REST 스냅샷만으로 동작 중 */
    connectionStatus,
    refetch: query.refetch,
  }
}
