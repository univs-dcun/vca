// 카메라별 상태 (cameras/+/status, retained) — 지도 마커·SYSTEM 탭 상태 배지.
// retained 삭제(카메라 제거)는 null 페이로드로 오므로 맵에서 제거한다.
import { useCallback, useState } from 'react'
import { cameraIdFromTopic, topics } from './topics'
import { useMqttSubscription } from './useMqtt'
import type { CameraStatusMessage } from './types'

export function useCameraStatuses(): Record<string, CameraStatusMessage> {
  const [statuses, setStatuses] = useState<Record<string, CameraStatusMessage>>({})

  const handler = useCallback((payload: unknown | null, topic: string) => {
    const cameraId = cameraIdFromTopic(topic)
    if (!cameraId) return
    setStatuses((prev) => {
      if (payload === null) {
        if (!(cameraId in prev)) return prev
        const next = { ...prev }
        delete next[cameraId]
        return next
      }
      return { ...prev, [cameraId]: payload as CameraStatusMessage }
    })
  }, [])

  useMqttSubscription(topics.cameraStatusAll(), handler)
  return statuses
}
