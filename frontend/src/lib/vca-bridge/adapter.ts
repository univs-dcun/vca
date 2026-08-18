// MQTT 계약 페이로드(SPEC.md) → 화면 스토어(vcaStore) 타입 변환.
// 화면 데이터 모델을 바꾸지 않고 실데이터를 주입하기 위한 어댑터 — 데이터 연결 계층(백엔드) 소유.
//
// 행 생성 규칙(VIP 누적 + Tracking 별개 1행, SPEC §5)의 구현은 vcaStore.addEvent에 있다 —
// UV-31 정렬로 mock/라이브 단일 경로가 되면서, 브리지가 갖고 있던 규칙 구현
// (VipTrack·collapseHops·trackToTrackingEvent)은 addEvent로 이관·제거됨.
import type { Camera, VcaEvent } from '../../features/vca/lib/vcaStore'
import type { CameraStatusMessage, VipDetectionEvent } from '../realtime/types'

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
    lastSeenAt: msg.ts,
  }
}

/** 감지 1건 → 누적 VIP 행. photoUrl은 REST 가용 시에만 전달됨 (미전달 시 화면이 mock 사진 폴백) */
export function detectionToVipEvent(e: VipDetectionEvent, photoUrl?: string): Omit<VcaEvent, 'id'> {
  return {
    ...(photoUrl ? { photoUrl } : {}),
    cameraId: e.cameraId,
    type: 'VIP Match',
    severity: 'warning',
    timestamp: e.detectedAt,
    // 감지 건별로 고유해야 한다 — 화면이 이 값을 목록 행 id(React key)로 쓰므로,
    // 같은 인물의 누적 VIP 행들이 id를 공유하면 렌더가 깨진다
    personId: `live-${e.vip.vipId}-${e.eventId}`,
    personName: e.vip.name,
    personType: 'VIP',
    confidence: Math.round(e.vip.similarity * 1000) / 10, // 0.726 → 72.6 (화면은 % 숫자 기대)
    location: e.cameraName, // 스토어 카메라 name과 일치해야 필터·경로 좌표 해석이 동작
    cameraLabel: e.cameraId,
    lat: e.location.lat,
    lng: e.location.lng,
  }
}

