// 토픽 빌더 + 매칭 — 계약 원본: vca-mqtt-broker/SPEC.md §2, §4
import { config } from '../config'

const base = () => `vca/v1/${config.SITE_ID}`

export const topics = {
  summary: () => `${base()}/stats/summary`,
  cameraStatusAll: () => `${base()}/cameras/+/status`,
  cameraDetectionsAll: () => `${base()}/cameras/+/detections`,
  cameraStatsAll: () => `${base()}/cameras/+/stats`,
}

/** 토픽 경로에서 {cameraId} 세그먼트를 꺼낸다 (vca/v1/{site}/cameras/{cameraId}/...) */
export function cameraIdFromTopic(topic: string): string | null {
  const seg = topic.split('/')
  return seg[3] === 'cameras' ? (seg[4] ?? null) : null
}

/** MQTT 토픽 필터(+/#) 매칭 — 수신 메시지를 구독 핸들러로 라우팅할 때 사용 */
export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split('/')
  const t = topic.split('/')
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true
    if (i >= t.length) return false
    if (f[i] !== '+' && f[i] !== t[i]) return false
  }
  return f.length === t.length
}
