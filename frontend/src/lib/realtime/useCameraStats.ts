// 카메라별 당일 감지 수 (cameras/+/stats, retained) — 지도 라벨 숫자 ("Novena 30").
// 색상 구간 판정은 화면 소관, 여기는 숫자만 제공한다.
import { useCallback, useState } from 'react'
import { cameraIdFromTopic, topics } from './topics'
import { useMqttSubscription } from './useMqtt'
import type { CameraStatsMessage } from './types'

export function useCameraStats(): Record<string, CameraStatsMessage> {
  const [stats, setStats] = useState<Record<string, CameraStatsMessage>>({})

  const handler = useCallback((payload: unknown | null, topic: string) => {
    const cameraId = cameraIdFromTopic(topic)
    if (!cameraId) return
    setStats((prev) => {
      if (payload === null) {
        if (!(cameraId in prev)) return prev
        const next = { ...prev }
        delete next[cameraId]
        return next
      }
      return { ...prev, [cameraId]: payload as CameraStatsMessage }
    })
  }, [])

  useMqttSubscription(topics.cameraStatsAll(), handler)
  return stats
}
