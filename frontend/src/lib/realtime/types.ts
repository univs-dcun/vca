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

/** 감지 카테고리 (SPEC §3.2 v1.1) — v1 발행자는 category 미포함(=vip로 간주) */
export type DetectionCategory = 'vip' | 'staff' | 'unauthorized' | 'vehicle' | 'unknown' | 'false_positive'

/**
 * vca/v1/{site}/cameras/{cameraId}/detections (non-retained, 감지 1건 = 대상 등장 1회)
 * v1.1(BEST FRAME)에서 전 카테고리로 확장 — category 이하 필드는 v1 발행자에게는 없다(optional).
 * vip는 등록 인물(vip·staff) 매칭 시에만 채워진다. DASHBOARD 소비자는 category=vip만 반영.
 */
export type DetectionEvent = {
  eventId: string
  cameraId: string
  cameraName: string
  locationId: string
  category?: DetectionCategory
  /** 타깃 패널 행 제목 — 인물 이름 / "Vehicle SGX411" / 외형 요약 */
  label?: string
  /** 행 부제 — "VIP group", "Staff (Finance)", 차량 색상 등. null이면 화면이 카테고리명 표시 */
  groupLabel?: string | null
  /** 등록 인물 매칭 유사도 0~1 (vip.similarity와 동일 값). 미매칭 카테고리는 null */
  confidence?: number | null
  vip: DetectionEventVip | null
  vehicle?: { plate: string; color?: string | null } | null
  attributes?: { top?: string | null; bottom?: string | null; item?: string | null } | null
  /** 감지 시점 크롭 이미지 (브라우저 기준 /api 경로로 발행됨 — SPEC §3.2) */
  snapshotUrl?: string
  location: LatLng
  detectedAt: string
}

/** vip 매칭이 확정된 감지 이벤트 — DASHBOARD 소비 경로의 내로잉 타입 (isVipDetection 가드 이후) */
export type VipDetectionEvent = DetectionEvent & { vip: DetectionEventVip }

/** DASHBOARD가 반영할 이벤트인지 판정 (SPEC §3.2 v1.1 — category=vip만, v1 발행자는 category 없음) */
export function isVipDetection(e: DetectionEvent): e is VipDetectionEvent {
  return (e.category ?? 'vip') === 'vip' && e.vip != null
}

/** vca/v1/{site}/cameras/{cameraId}/bestframe 의 objects[] 원소 (SPEC §3.5) */
export type BestFrameObject = {
  /** detections 이벤트와 동일 ID — 오버레이 박스와 타깃 패널 행을 잇는 키 */
  eventId: string
  category: DetectionCategory
  label: string
  /** 프레임 크기 대비 0~1 정규화. x,y = 좌상단, w,h = 폭·높이 */
  bbox: { x: number; y: number; w: number; h: number }
}

/** vca/v1/{site}/cameras/{cameraId}/bestframe (retained, 초당 best shot 1장 — SPEC §3.5) */
export type BestFrameMessage = {
  frameId: string
  cameraId: string
  cameraName: string
  locationId: string
  capturedAt: string
  /** 불변 URL — frameId 포함, 브라우저 기준 /api 경로 */
  imageUrl: string
  objects: BestFrameObject[]
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
