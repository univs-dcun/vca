// 앱 전역에서 공유하는 MQTT 클라이언트 싱글턴.
// - 첫 구독 시점에 lazy 연결, 재연결은 mqtt.js가 담당 (reconnectPeriod)
// - 같은 토픽 필터의 구독은 refcount로 합쳐서 브로커에는 1회만 SUBSCRIBE
// - retained 삭제(빈 페이로드)는 payload = null 로 핸들러에 전달
import mqtt, { type MqttClient } from 'mqtt'
import { config } from '../config'
import { topicMatches } from './topics'
import type { MqttConnectionStatus } from './types'

export type MessageHandler = (payload: unknown | null, topic: string) => void

type Subscription = { filter: string; handler: MessageHandler }

let client: MqttClient | null = null
let status: MqttConnectionStatus = config.MQTT_URL ? 'connecting' : 'disabled'

const subscriptions = new Set<Subscription>()
const filterRefCount = new Map<string, number>()
const statusListeners = new Set<(s: MqttConnectionStatus) => void>()

function setStatus(next: MqttConnectionStatus) {
  if (status === next) return
  status = next
  statusListeners.forEach((l) => l(next))
}

function ensureClient(): MqttClient | null {
  if (!config.MQTT_URL) return null
  if (client) return client

  client = mqtt.connect(config.MQTT_URL, {
    clientId: `vca-web-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
  })

  client.on('connect', () => {
    setStatus('connected')
    // 재연결 시 기존 구독 복구 (clean session이므로 브로커 쪽 구독은 사라져 있다)
    for (const filter of filterRefCount.keys()) {
      client?.subscribe(filter, { qos: 1 })
    }
  })
  client.on('reconnect', () => setStatus('reconnecting'))
  client.on('offline', () => setStatus('offline'))
  client.on('error', () => {
    /* 연결 오류는 상태로만 노출 — mqtt.js가 재시도한다 */
  })

  client.on('message', (topic, message) => {
    let payload: unknown | null = null
    if (message.length > 0) {
      try {
        payload = JSON.parse(message.toString('utf-8'))
      } catch {
        return // 계약 위반 페이로드는 버린다 (구독자 쪽 검증)
      }
    }
    for (const sub of subscriptions) {
      if (topicMatches(sub.filter, topic)) sub.handler(payload, topic)
    }
  })

  return client
}

/**
 * 토픽 필터를 구독한다. 반환된 함수를 호출하면 구독 해제.
 * MQTT_URL이 비어 있으면(disabled) no-op — REST 스냅샷만으로 동작한다.
 */
export function subscribe(filter: string, handler: MessageHandler): () => void {
  const c = ensureClient()
  if (!c) return () => {}

  const sub: Subscription = { filter, handler }
  subscriptions.add(sub)

  const count = filterRefCount.get(filter) ?? 0
  filterRefCount.set(filter, count + 1)
  if (count === 0) c.subscribe(filter, { qos: 1 })

  return () => {
    subscriptions.delete(sub)
    const n = (filterRefCount.get(filter) ?? 1) - 1
    if (n <= 0) {
      filterRefCount.delete(filter)
      client?.unsubscribe(filter)
    } else {
      filterRefCount.set(filter, n)
    }
  }
}

export function getConnectionStatus(): MqttConnectionStatus {
  return status
}

export function onConnectionStatusChange(listener: (s: MqttConnectionStatus) => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}
