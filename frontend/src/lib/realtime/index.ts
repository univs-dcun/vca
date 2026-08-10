// 실시간 연결 계층 공개 API — 화면(features)은 여기서만 import한다.
// REST 스냅샷 + MQTT 델타 병합은 이 계층이 처리하며, 화면은 결과를 그리기만 한다.
// 계약 문서: docs/guide-frontend-developer.md · vca-mqtt-broker/SPEC.md
export { useStatsSummary } from './useStatsSummary'
export { useCameraStatuses } from './useCameraStatuses'
export { useCameraStats } from './useCameraStats'
export { useLiveAnalytics, type UseLiveAnalyticsOptions } from './useLiveAnalytics'
export { useVipDetections } from './useVipDetections'
export { useVipDetectedCameras } from './useVipDetectedCameras'
export { useCameraList, type UseCameraListOptions } from './useCameraList'
export { useMqttConnectionStatus } from './useMqtt'
export { isTrackingRow } from './liveAnalyticsMerge'
export type {
  CameraStatusMessage,
  CameraStatsMessage,
  DetectionEvent,
  DetectionEventVip,
  CounterStat,
  StatsSummary,
  MqttConnectionStatus,
} from './types'
