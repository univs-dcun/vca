// 전역 집계 (stats/summary, retained) — 상단 Running/Stopped 카운트와 EVENTS 탭 카운터 2종.
// retained라 구독 직후 현재 값이 즉시 온다. 브로커 미연결 동안은 null (화면은 스켈레톤 등으로 처리).
import { useCallback, useState } from 'react'
import { topics } from './topics'
import { useMqttSubscription } from './useMqtt'
import type { StatsSummary } from './types'

export function useStatsSummary(): StatsSummary | null {
  const [summary, setSummary] = useState<StatsSummary | null>(null)

  const handler = useCallback((payload: unknown | null) => {
    setSummary(payload as StatsSummary | null)
  }, [])

  useMqttSubscription(topics.summary(), handler)
  return summary
}
