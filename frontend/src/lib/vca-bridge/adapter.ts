// MQTT 계약 페이로드(SPEC.md) → 화면 스토어(vcaStore) 타입 변환.
// 화면 데이터 모델을 바꾸지 않고 실데이터를 주입하기 위한 어댑터 — 데이터 연결 계층(백엔드) 소유.
import type { TrackingHop } from '../../features/vca/lib/mockData'
import type { Camera, VcaEvent } from '../../features/vca/lib/vcaStore'
import type { CameraStatusMessage, DetectionEvent } from '../realtime/types'

/** cameras/{id}/status (retained) → 스토어 Camera. 계약에 없는 필드는 빈 값으로 채운다. */
export function statusToCamera(msg: CameraStatusMessage): Camera {
  return {
    id: msg.cameraId,
    projectId: '',
    code: msg.cameraId,
    name: msg.name,
    ip: '',
    mac: '',
    rtspUrl: '',
    status: msg.status === 'RUNNING' ? 'online' : 'offline',
    // 화면의 location 필터·경로 해석은 카메라 name 문자열 매칭에 의존한다
    location: msg.name,
    zone: msg.locationId,
    thumbnail: '',
    lat: msg.location.lat,
    lng: msg.location.lng,
  }
}

/** 브리지가 VIP별로 누적하는 당일 이동 이력 */
export interface VipTrack {
  hops: TrackingHop[]
  cameraIds: Set<string>
  /** 스토어에서 이 VIP의 행을 식별하는 고정 id (행 교체용) */
  storeId: string
}

/**
 * cameras/{id}/detections → 스토어 VcaEvent.
 * 화면 모델은 "VIP 1명 = 행 1개"이며, 서로 다른 카메라 2대 이상이면 경로(personPath)를
 * 가진 Tracking 행으로 승격된다 (SPEC §5의 행 타입 규칙을 스토어 모델로 번역).
 */
export function detectionToVcaEvent(e: DetectionEvent, track: VipTrack): Omit<VcaEvent, 'id'> {
  const isTracking = track.cameraIds.size >= 2
  return {
    cameraId: e.cameraId,
    type: isTracking ? 'Tracking Detection' : 'VIP Match',
    severity: isTracking ? 'info' : 'warning',
    timestamp: e.detectedAt,
    personId: track.storeId,
    personName: e.vip.name,
    personType: isTracking ? 'Tracking' : 'VIP',
    confidence: Math.round(e.vip.similarity * 1000) / 10, // 0.726 → 72.6 (화면은 % 숫자 기대)
    location: e.cameraName, // 스토어 카메라 name과 일치해야 필터·경로 좌표 해석이 동작
    cameraLabel: e.cameraId,
    ...(isTracking ? { personPath: [...track.hops] } : {}),
    lat: e.location.lat,
    lng: e.location.lng,
  }
}
