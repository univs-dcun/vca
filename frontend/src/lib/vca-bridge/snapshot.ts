// REST 스냅샷 조회 — SPEC §5 병합 규칙(구독 먼저 → 스냅샷 → eventId dedup)의 스냅샷 쪽 절반.
// 프록시/모듈 API가 아직 안 떠 있으면 null을 반환하고, 브리지는 MQTT 단독 모드로 동작한다.
import { getLiveAnalytics } from '../../api/generated/dashboard/dashboard'
import { getVips } from '../../api/generated/vips/vips'
import { GetLiveAnalyticsType } from '../../api/generated/model'
import type { LiveAnalyticsRow } from '../../api/generated/model'
import type { Person } from '../../features/vca/lib/vcaStore'
import type { DetectionEvent } from '../realtime/types'

// 스냅샷은 시딩 용도라 1페이지로 넉넉히 받는다. 행 수 = 당일 감지된 VIP 수라 실측 규모가 작다.
const SNAPSHOT_SIZE = 200

// REST(프록시→모듈)가 살아있는지 — 스냅샷 성공 시 true. 브리지가 사진 URL 부여 여부를 이 값으로 결정한다
// (REST가 없으면 /api/vips/{id}/photo가 404라 깨진 이미지가 되므로 mock 사진 폴백을 유지해야 한다).
let restAvailable = false
export const isRestAvailable = () => restAvailable

export async function fetchLiveAnalyticsSnapshot(): Promise<LiveAnalyticsRow[] | null> {
  try {
    const res = await getLiveAnalytics({ page: 0, size: SNAPSHOT_SIZE, type: GetLiveAnalyticsType.ALL })
    restAvailable = true
    return res.data?.content ?? []
  } catch {
    return null
  }
}

/** 등록 VIP 목록 → 스토어 Person 목록. photoUrl은 프록시가 /api 경로로 재작성해 준 값 그대로. */
export async function fetchVipPersons(): Promise<Person[] | null> {
  try {
    const res = await getVips({ page: 0, size: SNAPSHOT_SIZE })
    return (res.data?.content ?? []).map((v) => ({
      id: v.vipId,
      name: v.name,
      type: 'VIP' as const,
      photoUrl: v.photoUrl,
      registeredAt: v.registeredAt,
      description: v.description ?? undefined,
    }))
  } catch {
    return null
  }
}

/** 스냅샷 행을 MQTT 이벤트와 같은 형태로 풀어낸다 — 브리지가 한 코드 경로로 병합하기 위함 */
export function rowToDetectionEvents(row: LiveAnalyticsRow): DetectionEvent[] {
  return row.detections.map((d) => ({
    eventId: d.eventId,
    cameraId: d.cameraId,
    cameraName: d.cameraName,
    locationId: d.locationId,
    vip: { vipId: row.vipId, name: row.name, similarity: d.similarity },
    location: d.location,
    detectedAt: d.detectedAt,
  }))
}
