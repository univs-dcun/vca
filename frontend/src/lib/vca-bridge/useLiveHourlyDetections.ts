// Detection Topology(REST) → 차트의 HourlyDetection 형태 변환 훅.
// 계약(SPEC §5 경계표)대로 실시간이 아닌 "REST 주기적 재조회" — 60초 간격 refetch.
// 프록시/모듈 API 미기동이면 null — 차트는 기존 mock 데이터로 폴백.
import { useMemo } from 'react'
import { useGetDetectionTopology } from '../../api/generated/stats/stats'
import type { HourlyDetection } from '../../features/vca/lib/mockData'

const REFETCH_MS = 60_000

export function useLiveHourlyDetections(): HourlyDetection[] | null {
  const query = useGetDetectionTopology(undefined, {
    query: {
      refetchInterval: REFETCH_MS,
      // 관제 화면은 백그라운드 탭에서도 갱신을 멈추면 안 된다 — 기본값(false)이면
      // 탭이 숨겨진 동안 refetchInterval이 일시정지되어 복귀 시 오래된 차트가 보인다.
      refetchIntervalInBackground: true,
      retry: false,
      refetchOnWindowFocus: false,
    },
  })
  const points = query.data?.data?.points
  return useMemo(() => {
    if (!points) return null
    // 차트는 vipCount를 그린다 — 계약의 count(당일 등록 VIP 감지 수)가 그 값이다
    return points.map((p) => ({ hour: p.hour, count: p.count, vipCount: p.count }))
  }, [points])
}
