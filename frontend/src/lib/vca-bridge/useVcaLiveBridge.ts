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
import { useVcaStore } from '../../features/vca/lib/vcaStore'
import { getConnectionStatus, onConnectionStatusChange, subscribe } from '../realtime/mqttClient'
import { cameraIdFromTopic, topics } from '../realtime/topics'
import { isVipDetection, type CameraStatusMessage, type DetectionEvent, type MqttConnectionStatus } from '../realtime/types'
import { detectionToVipEvent, statusToCamera } from './adapter'
import { fetchLiveAnalyticsSnapshot, fetchVipPersons, isRestAvailable, rowToDetectionEvents } from './snapshot'

export function useVcaLiveBridge(): boolean {
  const [isLive, setIsLive] = useState(false)
  const isLiveRef = useRef(false)
  const seenEventIds = useRef<Set<string>>(new Set())

  // 감지 1건 반영 — 계약 이벤트를 화면 행으로 변환해 addEvent에 넘긴다.
  // 행 생성 규칙(VIP 누적 + 카메라 전환 기준 Tracking 별개 1행, SPEC §5)의 구현 소유자는
  // vcaStore.addEvent — mock 시뮬레이션과 라이브가 같은 규칙을 단일 경로로 지난다 (UV-31 정렬 완료,
  // 이전의 스토어 직접 삽입 우회는 제거됨). addEvent의 이력 재구축이 timestamp 정렬 기반이라
  // REST 스냅샷(과거)과 MQTT 델타(현재)가 섞여 도착해도 결과가 같고, 중복은 eventId로 여기서 거른다.
  const applyDetection = useCallback((e: DetectionEvent) => {
    // v1.1부터 detections 스트림에 전 카테고리가 흐른다 — DASHBOARD는 vip만 반영 (SPEC §3.2).
    // v1 발행자는 category가 없으므로 vip로 간주. BEST FRAME 쪽 소비는 useBestFrameLive 담당.
    if (!isVipDetection(e)) return
    if (seenEventIds.current.has(e.eventId)) return
    seenEventIds.current.add(e.eventId)

    // REST가 살아있을 때만 실제 등록 사진 URL 부여 — 없으면 undefined로 두어 화면이 mock 사진 폴백
    const photoUrl = isRestAvailable() ? `/api/vips/${e.vip.vipId}/photo` : undefined
    useVcaStore.getState().addEvent(detectionToVipEvent(e, photoUrl))
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
