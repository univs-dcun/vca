// MQTT 계약 페이로드(SPEC.md) → 화면 스토어(vcaStore) 타입 변환.
// 화면 데이터 모델을 바꾸지 않고 실데이터를 주입하기 위한 어댑터 — 데이터 연결 계층(백엔드) 소유.
//
// 행 생성 규칙 (기획자 합의, 2026-08-12):
// - VIP 행: 감지 1건 = 행 1개, 누적 (제거·병합하지 않는다)
// - Tracking 행: 같은 VIP가 "직전과 다른 카메라"로 이동한 순간부터 VIP당 1행 유지(교체).
//   연속된 동일 카메라 재감지는 이동이 아니므로 hop을 만들지 않는다 — collapseHops() 참고.
import type { TrackingHop } from '../../features/vca/lib/mockData'
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

/** 브리지가 VIP별로 누적하는 당일 감지 이력 */
export interface VipTrack {
  /** 시간 오름차순 전체 감지 — Tracking 경로는 매번 여기서 재구축한다 (스냅샷/델타 도착 순서 무관) */
  detections: { cameraId: string; cameraName: string; detectedAt: string }[]
  /** Tracking 행을 스토어에서 식별·교체하는 고정 id (VIP 행은 누적이라 식별이 필요 없다) */
  trackingRowId: string
  /** 가장 최근 감지 — Tracking 행의 표시 내용(시각·카메라)은 이 이벤트 기준 */
  latest: VipDetectionEvent
}

/**
 * Tracking 경로 재구축 — 연속된 동일 카메라 감지를 한 hop으로 접는다:
 * - A→A: 이동 아님. hop을 늘리지 않고 그 자리의 timestamp만 최신으로 갱신 (LAST SEEN)
 * - A→B: 새 동선 → hop 추가
 * - A→B→A: 마지막 A는 직전 B와 다른 카메라이므로 새 동선 → hop 추가 (총 3 hop)
 * Tracking 행은 이 결과가 2 hop 이상일 때만 존재한다 (= 카메라 전환이 최소 1회).
 */
export function collapseHops(detections: VipTrack['detections']): TrackingHop[] {
  const hops: TrackingHop[] = []
  let prevCameraId: string | null = null
  for (const d of detections) {
    if (d.cameraId === prevCameraId) {
      hops[hops.length - 1] = { ...hops[hops.length - 1], timestamp: d.detectedAt }
    } else {
      hops.push({ location: d.cameraName, cameraLabel: d.cameraId, timestamp: d.detectedAt })
      prevCameraId = d.cameraId
    }
  }
  return hops
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

/** VIP당 1개 유지되는 Tracking 행 — collapseHops 결과가 2개 이상일 때만 만든다 */
export function trackToTrackingEvent(track: VipTrack, hops: TrackingHop[], photoUrl?: string): Omit<VcaEvent, 'id'> {
  const e = track.latest
  return {
    ...(photoUrl ? { photoUrl } : {}),
    cameraId: e.cameraId,
    type: 'Tracking Detection',
    severity: 'info',
    timestamp: e.detectedAt,
    personId: track.trackingRowId,
    personName: e.vip.name,
    personType: 'Tracking',
    confidence: 0, // 화면 mock의 Tracking 행과 동일 — 신뢰도 대신 경로(personPath)를 그린다
    location: e.cameraName,
    cameraLabel: e.cameraId,
    personPath: hops,
    lat: e.location.lat,
    lng: e.location.lng,
  }
}
