// stats/summary (retained) → 화면 카운터 형태(DeltaBadge props) 변환 훅.
// 브로커 미연결/미발행 동안 null — 화면은 기존 mock 파생값으로 폴백해 기획자 개발 흐름을 보존한다.
import { useStatsSummary } from '../realtime'
import type { CounterStat } from '../realtime/types'

/** Sidebar StatCol/DeltaBadge가 기대하는 카운터 형태 (mockData.dashboardStats와 동일 구조) */
export interface LiveCounter {
  count: number
  delta: number
  deltaPct: number
  down: boolean
}

export interface LiveDashboardStats {
  /** Navbar 상단 "N Running / N Stopped" */
  aiRunning: number
  aiStopped: number
  /** EVENTS 탭 "VIP Detections" — 당일 등록 VIP 감지 누적 */
  watchlistMatch: LiveCounter
  /** EVENTS 탭 "Today's detections" — 당일 전체 얼굴 감지(VIP + 미등록) 누적 */
  eventsToday: LiveCounter
}

// DeltaBadge는 방향을 down 플래그로, 수치를 부호 없는 숫자로 그린다.
// deltaRate는 SPEC상 전일 0건이면 null — 이때 퍼센트는 0으로 표기한다.
function toCounter(c: CounterStat): LiveCounter {
  return {
    count: c.today,
    delta: Math.abs(c.deltaFromYesterday),
    deltaPct: c.deltaRate === null ? 0 : Math.abs(Math.round(c.deltaRate * 1000) / 10),
    down: c.deltaFromYesterday < 0,
  }
}

export function useLiveDashboardStats(): LiveDashboardStats | null {
  const summary = useStatsSummary()
  if (!summary) return null
  return {
    aiRunning: summary.cameras.running,
    aiStopped: summary.cameras.stopped,
    watchlistMatch: toCounter(summary.vipDetections),
    eventsToday: toCounter(summary.faceDetections),
  }
}
