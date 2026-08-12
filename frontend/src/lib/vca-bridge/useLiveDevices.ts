// 스토어 cameras(MQTT status retained로 채워짐) → SYSTEM 탭 Device 목록 변환 훅.
// 실데이터 카메라는 lastSeenAt이 있고 mock 시드에는 없으므로, 이 존재 여부가 라이브 판별 기준.
// 라이브 카메라가 없으면 null — SYSTEM 탭은 기존 mock devices로 폴백 (기획자 개발 흐름 보존).
import { useMemo } from 'react'
import { formatTimeAgo, type Device } from '../../features/vca/lib/mockData'
import { useVcaStore } from '../../features/vca/lib/vcaStore'

export function useLiveDevices(): Device[] | null {
  const cameras = useVcaStore((s) => s.cameras)
  return useMemo(() => {
    const live = cameras.filter((c) => c.lastSeenAt)
    if (live.length === 0) return null
    return live.map((c) => ({
      id: c.id,
      status: c.status === 'online' ? ('Live' as const) : ('Off' as const),
      name: c.name,
      type: 'Normal', // 계약에 장비 유형이 없어 화면 기본값 유지
      ip: c.ip, // 계약에 없음 — 모듈 API /cameras 확장 전까지 빈 값
      lat: c.lat,
      lng: c.lng,
      lastSeen: formatTimeAgo(c.lastSeenAt!),
    }))
  }, [cameras])
}
