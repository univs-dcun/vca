// MQTT → vcaStore 브리지 (SPEC.md 계약 → 화면 스토어 주입).
//
// 동작 모드:
// - 브로커 연결 성공 시: mock 시드(events/cameras)를 비우고 실데이터 모드로 전환.
//   retained 카메라 status가 즉시 흘러들고, REST 스냅샷으로 당일 감지 이력을 복원한 뒤
//   MQTT 델타를 그 위에 병합한다 (SPEC §5: 구독 먼저 → 스냅샷 → eventId dedup).
//   스냅샷 API(프록시/모듈)가 안 떠 있으면 MQTT 단독 모드 — 새로고침 전까지의 이력만 쌓인다.
// - 브로커 미설정/미연결: 스토어를 건드리지 않음 — 기존 mock + 시뮬레이션 흐름 유지 (기획자 개발 흐름 보존).
//
// 구독은 마운트 즉시 건다 — mqtt 연결 자체가 첫 subscribe에서 lazy하게 시작되므로,
// 연결 여부로 구독을 게이트하면 연결이 영영 시작되지 않는다. 대신 스토어 쓰기만 isLive로 게이트.
// 반환값 isLive는 ClientLayout이 가짜 감지 시뮬레이션(VipAlertTicker)을 끄는 데 쓴다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVcaStore, type VcaEvent } from '../../features/vca/lib/vcaStore'
import { getConnectionStatus, onConnectionStatusChange, subscribe } from '../realtime/mqttClient'
import { cameraIdFromTopic, topics } from '../realtime/topics'
import type { CameraStatusMessage, DetectionEvent, MqttConnectionStatus } from '../realtime/types'
import { collapseHops, detectionToVipEvent, statusToCamera, trackToTrackingEvent, type VipTrack } from './adapter'
import { fetchLiveAnalyticsSnapshot, fetchVipPersons, isRestAvailable, rowToDetectionEvents } from './snapshot'

export function useVcaLiveBridge(): boolean {
  const [isLive, setIsLive] = useState(false)
  const isLiveRef = useRef(false)
  const seenEventIds = useRef<Set<string>>(new Set())
  const tracks = useRef<Map<string, VipTrack>>(new Map())

  // 감지 1건 반영 (행 생성 규칙은 adapter.ts 상단 주석 참고):
  // ① VIP 행 누적 — 감지 1건 = 행 1개, 제거하지 않는다
  // ② Tracking 행 — 카메라 전환(직전과 다른 카메라)이 1회 이상이면 VIP당 1행 유지(교체)
  // MQTT 델타와 REST 스냅샷이 같은 경로를 지나므로 도착 순서와 무관하게 결과가 같다:
  // - eventId 멱등 (스냅샷과 델타가 같은 감지를 담을 수 있음)
  // - detections는 detectedAt 오름차순 삽입 후 경로를 재구축 (스냅샷=과거, 델타=현재가 섞여 도착)
  // - Tracking 행 표시 내용은 track.latest(가장 최근 감지) 기준
  const applyDetection = useCallback((e: DetectionEvent) => {
    if (seenEventIds.current.has(e.eventId)) return
    seenEventIds.current.add(e.eventId)

    const track = tracks.current.get(e.vip.vipId) ?? {
      detections: [],
      trackingRowId: `live-track-${e.vip.vipId}`,
      latest: e,
    }
    const d = { cameraId: e.cameraId, cameraName: e.cameraName, detectedAt: e.detectedAt }
    let i = track.detections.length
    while (i > 0 && track.detections[i - 1].detectedAt > d.detectedAt) i--
    track.detections.splice(i, 0, d)
    if (e.detectedAt >= track.latest.detectedAt) track.latest = e
    tracks.current.set(e.vip.vipId, track)

    // REST가 살아있을 때만 실제 등록 사진 URL 부여 — 없으면 undefined로 두어 화면이 mock 사진 폴백
    const photoUrl = isRestAvailable() ? `/api/vips/${e.vip.vipId}/photo` : undefined

    // 스토어에 직접 삽입한다 — addEvent()를 쓰지 않는 것이 의도다.
    // 화면의 addEvent는 mock 시뮬레이션용 인물 병합(2대 이상 감지 시 VIP 행들을 Tracking
    // 1행으로 collapse)을 수행하는데, 확정된 라이브 행 규칙은 "VIP 행 누적 + Tracking 별개
    // 1행"이라 충돌한다. 라이브 행 규칙의 소유자는 이 브리지이며 병합은 위 collapseHops가 한다.
    // id는 eventId 기반이라 store 내 유일성이 보장된다.
    const insert = (row: Omit<VcaEvent, 'id'>, id: string) => {
      const { events } = useVcaStore.getState()
      useVcaStore.setState({ events: [{ ...row, id }, ...events].slice(0, 500) })
    }
    insert(detectionToVipEvent(e, photoUrl), `live-evt-${e.eventId}`)

    const hops = collapseHops(track.detections)
    if (hops.length >= 2) {
      const { events } = useVcaStore.getState()
      useVcaStore.setState({ events: events.filter((ev) => ev.personId !== track.trackingRowId) })
      insert(trackToTrackingEvent(track, hops, photoUrl), track.trackingRowId)
    }
  }, [])

  // 최초 연결 시 한 번만 mock 시드를 비운다 (재연결 시 쌓인 실데이터는 유지).
  // 상태 리스너에서 동기 처리 — React 렌더 사이클을 거치면 retained 메시지가
  // 시드 클리어보다 먼저 도착해 지워지는 레이스가 생길 수 있다.
  useEffect(() => {
    const seedFromSnapshot = async () => {
      const rows = await fetchLiveAnalyticsSnapshot()
      if (!rows) {
        console.info('[vca-bridge] 스냅샷 API 미응답 — MQTT 단독 모드로 동작')
        return
      }
      for (const row of rows) for (const e of rowToDetectionEvents(row)) applyDetection(e)
      // 등록 VIP 목록(Registered VIP Targets 카운트·모달)도 실데이터로 교체
      const persons = await fetchVipPersons()
      if (persons) useVcaStore.setState({ persons })
    }
    const goLive = (s: MqttConnectionStatus) => {
      if (s !== 'connected' || isLiveRef.current) return
      useVcaStore.setState({ events: [], cameras: [] })
      isLiveRef.current = true
      setIsLive(true)
      // 구독은 이미 걸려 있으므로(마운트 시) 이 시점의 스냅샷 조회로 틈새 유실이 없다
      void seedFromSnapshot()
    }
    goLive(getConnectionStatus())
    return onConnectionStatusChange(goLive)
  }, [applyDetection])

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

  // VIP 감지 이벤트 (MQTT 델타) — 스냅샷과 동일한 applyDetection 경로로 병합.
  // 같은 VIP가 서로 다른 카메라 2대 이상에서 감지되면 경로를 가진 Tracking 행으로 승격.
  useEffect(() => {
    return subscribe(topics.cameraDetectionsAll(), (payload) => {
      if (!isLiveRef.current || payload === null) return
      applyDetection(payload as DetectionEvent)
    })
  }, [applyDetection])

  return isLive
}
