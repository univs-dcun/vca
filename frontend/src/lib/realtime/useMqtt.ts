// MQTT 구독을 React 생명주기에 묶는 저수준 훅들.
// 화면에서는 이걸 직접 쓰기보다 use*(StatsSummary/CameraStatuses/...) 훅을 쓴다.
import { useEffect, useSyncExternalStore } from 'react'
import { getConnectionStatus, onConnectionStatusChange, subscribe, type MessageHandler } from './mqttClient'
import type { MqttConnectionStatus } from './types'

/** 브로커 연결 상태. 화면에서 오프라인 배지 등을 띄울 때 사용 */
export function useMqttConnectionStatus(): MqttConnectionStatus {
  return useSyncExternalStore(onConnectionStatusChange, getConnectionStatus)
}

/**
 * 토픽 필터 구독. handler는 ref로 고정하지 않으므로 호출부에서 useCallback으로 안정화할 것.
 * enabled=false면 구독하지 않는다.
 */
export function useMqttSubscription(filter: string, handler: MessageHandler, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    return subscribe(filter, handler)
  }, [filter, handler, enabled])
}
