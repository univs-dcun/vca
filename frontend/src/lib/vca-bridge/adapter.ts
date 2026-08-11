// MQTT 계약 페이로드(SPEC.md) → 화면 스토어(vcaStore) 타입 변환.
// 화면 데이터 모델을 바꾸지 않고 실데이터를 주입하기 위한 어댑터 — 데이터 연결 계층(백엔드) 소유.
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

/** cameras/{id}/detections → 스토어 VcaEvent (VIP 감지 행). */
export function detectionToVcaEvent(e: DetectionEvent): Omit<VcaEvent, 'id'> {
  return {
    cameraId: e.cameraId,
    type: 'VIP Match',
    severity: 'warning',
    timestamp: e.detectedAt,
    // personId는 화면에서 행 key·사진 해시로 쓰이므로 감지 건마다 고유해야 한다 → eventId 사용
    personId: e.eventId,
    personName: e.vip.name,
    personType: 'VIP',
    confidence: Math.round(e.vip.similarity * 1000) / 10, // 0.726 → 72.6 (화면은 % 숫자 기대)
    location: e.cameraName,
    cameraLabel: e.cameraId,
    lat: e.location.lat,
    lng: e.location.lng,
  }
}
