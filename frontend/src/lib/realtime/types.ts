// MQTT 페이로드 타입 — 계약 원본: vca-mqtt-broker/SPEC.md §3
// REST 쪽 공용 타입(LatLng, CameraStatus, Detection)은 orval 생성물을 재사용한다.
import type { CameraStatus, LatLng } from '../../api/generated/model'

/** vca/v1/{site}/cameras/{cameraId}/status (retained) */
export type CameraStatusMessage = {
  cameraId: string
  name: string
  status: CameraStatus
  locationId: string
  location: LatLng
  ts: string
}

/** vca/v1/{site}/cameras/{cameraId}/detections 의 vip 객체 */
export type DetectionEventVip = {
  vipId: string
  name: string
  /** 0~1 */
  similarity: number
}

/** vca/v1/{site}/cameras/{cameraId}/detections (non-retained, 감지 1건 = 좌표 1개) */
export type DetectionEvent = {
  eventId: string
  cameraId: string
  cameraName: string
  locationId: string
  vip: DetectionEventVip
  location: LatLng
  detectedAt: string
}

/** vca/v1/{site}/cameras/{cameraId}/stats (retained) */
export type CameraStatsMessage = {
  cameraId: string
  detectionsToday: number
  ts: string
}

/** stats/summary 의 카운터 공통 구조 */
export type CounterStat = {
  today: number
  deltaFromYesterday: number
  /** 전일 총계가 0이면 null */
  deltaRate: number | null
}

/** vca/v1/{site}/stats/summary (retained) */
export type StatsSummary = {
  cameras: { running: number; stopped: number }
  /** 당일 등록 VIP 감지 (EVENTS 탭 "VIP Detections") */
  vipDetections: CounterStat
  /** 당일 전체 얼굴 감지 = VIP + 미등록 (EVENTS 탭 "Today's detections") */
  faceDetections: CounterStat
  ts: string
}

export type MqttConnectionStatus =
  | 'disabled' // MQTT_URL 미설정 — REST 스냅샷만 사용
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
