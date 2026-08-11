// MQTT → vcaStore 브리지 (SPEC.md 계약 → 화면 스토어 주입).
//
// 동작 모드:
// - 브로커 연결 성공 시: mock 시드(events/cameras)를 비우고 실데이터 모드로 전환.
//   retained 카메라 status가 즉시 흘러들어 지도·목록이 실데이터로 채워진다.
// - 브로커 미설정/미연결: 스토어를 건드리지 않음 — 기존 mock + 시뮬레이션 흐름 유지 (기획자 개발 흐름 보존).
//
// 구독은 마운트 즉시 건다 — mqtt 연결 자체가 첫 subscribe에서 lazy하게 시작되므로,
// 연결 여부로 구독을 게이트하면 연결이 영영 시작되지 않는다. 대신 스토어 쓰기만 isLive로 게이트.
// 반환값 isLive는 ClientLayout이 가짜 감지 시뮬레이션(VipAlertTicker)을 끄는 데 쓴다.
import { useEffect, useRef, useState } from 'react'
import { useVcaStore } from '../../features/vca/lib/vcaStore'
import { getConnectionStatus, onConnectionStatusChange, subscribe } from '../realtime/mqttClient'
import { cameraIdFromTopic, topics } from '../realtime/topics'
import type { CameraStatusMessage, DetectionEvent, MqttConnectionStatus } from '../realtime/types'
import { detectionToVcaEvent, statusToCamera, type VipTrack } from './adapter'

export function useVcaLiveBridge(): boolean {
  const [isLive, setIsLive] = useState(false)
  const isLiveRef = useRef(false)
  const seenEventIds = useRef<Set<string>>(new Set())

  // 최초 연결 시 한 번만 mock 시드를 비운다 (재연결 시 쌓인 실데이터는 유지).
  // 상태 리스너에서 동기 처리 — React 렌더 사이클을 거치면 retained 메시지가
  // 시드 클리어보다 먼저 도착해 지워지는 레이스가 생길 수 있다.
  useEffect(() => {
    const goLive = (s: MqttConnectionStatus) => {
      if (s !== 'connected' || isLiveRef.current) return
      useVcaStore.setState({ events: [], cameras: [] })
      isLiveRef.current = true
      setIsLive(true)
    }
    goLive(getConnectionStatus())
    return onConnectionStatusChange(goLive)
  }, [])

  // 카메라 상태 (retained) — 스토어 cameras를 cameraId 기준 upsert
  useEffect(() => {
    return subscribe(topics.cameraStatusAll(), (payload, topic) => {
      if (!isLiveRef.current) return
      const cameraId = cameraIdFromTopic(topic)
      if (!cameraId) return
      const { cameras } = useVcaStore.getState()
      if (payload === null) {
        // retained 삭제 = 카메라 제거
        useVcaStore.setState({ cameras: cameras.filter((c) => c.id !== cameraId) })
        return
      }
      const next = statusToCamera(payload as CameraStatusMessage)
      const idx = cameras.findIndex((c) => c.id === cameraId)
      useVcaStore.setState({
        cameras: idx === -1 ? [...cameras, next] : cameras.map((c) => (c.id === cameraId ? next : c)),
      })
    })
  }, [])

  // VIP 감지 이벤트 — eventId 멱등 처리 후 vipId 기준 단일 행 유지 (upsert).
  // 같은 VIP가 서로 다른 카메라 2대 이상에서 감지되면 경로를 가진 Tracking 행으로 승격.
  const tracks = useRef<Map<string, VipTrack>>(new Map())
  useEffect(() => {
    return subscribe(topics.cameraDetectionsAll(), (payload) => {
      if (!isLiveRef.current || payload === null) return
      const e = payload as DetectionEvent
      if (seenEventIds.current.has(e.eventId)) return
      seenEventIds.current.add(e.eventId)

      const track = tracks.current.get(e.vip.vipId) ?? {
        hops: [],
        cameraIds: new Set<string>(),
        storeId: `live-${e.vip.vipId}`,
      }
      track.hops.push({ location: e.cameraName, cameraLabel: e.cameraId, timestamp: e.detectedAt })
      track.cameraIds.add(e.cameraId)
      tracks.current.set(e.vip.vipId, track)

      // 이 VIP의 기존 행을 제거하고 최신 상태(VIP 또는 Tracking)로 교체
      const { events } = useVcaStore.getState()
      useVcaStore.setState({ events: events.filter((ev) => ev.personId !== track.storeId) })
      useVcaStore.getState().addEvent(detectionToVcaEvent(e, track))
    })
  }, [])

  return isLive
}
