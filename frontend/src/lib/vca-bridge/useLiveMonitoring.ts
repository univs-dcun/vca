// DATA Live Monitoring 브리지 (계약 v1.6, UV-38) — 감지 이벤트 스트림을 화면 카드 피드로 변환한다.
//
// 채널 구성 (SPEC §3.2·§4, BEST FRAME 타깃 패널과 동일 패턴):
// - 진입(마운트) 시 카메라별 REST GET /cameras/{id}/detections로 최근 이력을 시딩하고,
//   MQTT cameras/+/detections 델타를 eventId dedup으로 그 위에 병합한다
// - 인물 카테고리만 카드로 만든다 (vip/staff/unauthorized/unknown — vehicle·false_positive 무시)
//
// 다른 브리지와 같은 폴백 규칙: MQTT 미연결이면 live=false — 화면은 기존 mock 시뮬레이션
// (seedLiveFeed + 4초 인터벌)을 그대로 쓴다. REST 시딩만 실패하면 MQTT 단독 모드(델타만 누적).
//
// 반환 피드의 키는 화면 스토어 Camera.code — 라이브 모드에서는 cameraId와 같다(statusToCamera).
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCameraDetections } from '../../api/generated/cameras/cameras'
import type { DetectionEventRow } from '../../api/generated/model'
import { useVcaStore } from '../../features/vca/lib/vcaStore'
import { getConnectionStatus, onConnectionStatusChange, subscribe } from '../realtime/mqttClient'
import { topics } from '../realtime/topics'
import type { DetectionEvent, MqttConnectionStatus } from '../realtime/types'

/** 카메라당 카드 보관 상한 — 화면 mock 시뮬레이션과 동일 값 */
const CAP = 300
/** 시딩 조회 크기 — 진입 직후 그리드가 비어 보이지 않을 만큼 */
const SEED_SIZE = 60

/** 카드로 렌더할 인물 카테고리 (확정 가정 2026-08-24 — vehicle·false_positive 제외) */
const PERSON_CATEGORIES = new Set(['vip', 'staff', 'unauthorized', 'unknown'])

/**
 * 화면 카드 1장 — DataPage REID_DATA 항목과 구조 호환(초과 필드는 무시됨).
 * eventId/cameraId는 RedMap 딥링크(TrackTargetRef — v1.4 규칙: 카메라 targetId=eventId)용,
 * faceCrop은 실제 얼굴 크롭(null=미검출 → 화면이 얼굴 인셋을 숨김)용 추가 필드다.
 */
export interface LiveMonitorItem {
  id: number
  url: string
  time: string
  badge: number | null
  status: 'VIP' | 'Unknown' | 'RedFace'
  gender: string
  age: string
  score: number | null
  cam: string
  face: string
  apparel: string
  prop: string | null
  date: string
  similarity: number
  plate: string | null
  // (반입 2026-08-27) mock REID_DATA에 추가된 외형 필드 — 계약에 색상/감정 추정이 없어 빈 값.
  // 화면 필터는 빈 값을 "미상"으로 취급해 제외하지 않는다
  topColor: string
  bottomColor: string
  shoesColor: string
  emotion: string
  ethnicGroup: string
  eventId: string
  cameraId: string
  faceCrop: string | null
  /** 계약 label — 인물 이름/외형 요약. RedMap 딥링크의 Tracing 라벨(mock 선행 렌더)용 */
  label: string
  /** detectedAt epoch ms — 피드 정렬 키 (time은 표시 포맷이라 정렬 불가) */
  ms: number
}

/** mock formatCapturedTime과 동일한 "HH:MM:SS"(SGT) — 날짜는 별도 date 필드 (반입 2026-08-27 규칙) */
function timeSgt(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false })
}
const dateSgt = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })

/** REST 행과 MQTT 페이로드는 동일 구조(계약) — 카드 변환도 단일 경로를 쓴다 */
function toCard(e: DetectionEvent | DetectionEventRow, id: number): LiveMonitorItem | null {
  const category = e.category ?? 'vip'
  if (!PERSON_CATEGORIES.has(category) || !e.snapshotUrl) return null
  const isVip = (category === 'vip' || category === 'staff') && e.vip != null
  const faceCrop = e.faceUrl ?? null
  return {
    id,
    url: e.snapshotUrl,
    time: timeSgt(e.detectedAt),
    badge: null,
    status: isVip ? 'VIP' : 'Unknown',
    gender: e.gender === 'male' ? 'M' : e.gender === 'female' ? 'F' : '',
    age: e.age != null ? `${e.age}yo` : '',
    score: isVip && e.confidence != null ? Math.round(e.confidence * 1000) / 10 : null,
    cam: e.cameraId,
    face: faceCrop ?? e.snapshotUrl, // DetailModal 얼굴 크롭 슬롯 — 미검출이면 전신으로 대체
    apparel: e.attributes?.top ?? '',
    prop: e.attributes?.item ?? null,
    date: dateSgt(e.detectedAt),
    similarity: e.confidence != null ? Math.round(e.confidence * 1000) / 10 : 0,
    plate: null,
    topColor: '', bottomColor: '', shoesColor: '', emotion: '', ethnicGroup: '',
    eventId: e.eventId,
    cameraId: e.cameraId,
    faceCrop,
    label: e.label ?? '',
    ms: Date.parse(e.detectedAt),
  }
}

export function useLiveMonitoring(): {
  /** 라이브 데이터 사용 중 — false면 화면이 mock 시뮬레이션 흐름을 그대로 유지 */
  live: boolean
  /** 카메라 code(=라이브에서는 cameraId)별 카드 피드, 최신순 */
  feed: Record<string, LiveMonitorItem[]>
} {
  const [live, setLive] = useState(false)
  const [feed, setFeed] = useState<Record<string, LiveMonitorItem[]>>({})
  const liveRef = useRef(false)
  const seenEventIds = useRef<Set<string>>(new Set())
  const seededCameras = useRef<Set<string>>(new Set())
  const nextId = useRef(1)
  const cameras = useVcaStore((s) => s.cameras)

  // 신규 카드 병합 — 시딩(과거)과 델타(현재)가 같은 경로를 지난다. 카메라별 시간 내림차순 유지
  const apply = useCallback((events: (DetectionEvent | DetectionEventRow)[]) => {
    const cards: LiveMonitorItem[] = []
    for (const e of events) {
      if (seenEventIds.current.has(e.eventId)) continue
      const card = toCard(e, nextId.current)
      if (!card) continue
      seenEventIds.current.add(e.eventId)
      nextId.current += 1
      cards.push(card)
    }
    if (!cards.length) return
    setFeed((prev) => {
      const next = { ...prev }
      for (const card of cards) {
        const list = [card, ...(next[card.cam] ?? [])]
        list.sort((a, b) => b.ms - a.ms)
        next[card.cam] = list.slice(0, CAP)
      }
      return next
    })
  }, [])

  // MQTT 연결 = 라이브 전환 (구독은 마운트 즉시 — 연결이 첫 subscribe에서 lazy 시작되므로)
  useEffect(() => {
    const goLive = (s: MqttConnectionStatus) => {
      if (s !== 'connected' || liveRef.current) return
      liveRef.current = true
      setLive(true)
    }
    goLive(getConnectionStatus())
    return onConnectionStatusChange(goLive)
  }, [])

  // 델타 구독 — DATA 탭 마운트 동안 수신하는 감지를 즉시 카드로
  useEffect(() => {
    return subscribe(topics.cameraDetectionsAll(), (payload) => {
      if (!liveRef.current || payload === null) return
      apply([payload as DetectionEvent])
    })
  }, [apply])

  // REST 시딩 — 라이브 전환 후 알려진 카메라마다 1회 (실패해도 MQTT 단독 모드로 동작)
  useEffect(() => {
    if (!live) return
    for (const cam of cameras) {
      if (seededCameras.current.has(cam.id)) continue
      seededCameras.current.add(cam.id)
      getCameraDetections(cam.id, { size: SEED_SIZE })
        .then((res) => apply(res.data?.content ?? []))
        .catch(() => {
          seededCameras.current.delete(cam.id) // 다음 카메라 목록 갱신에서 재시도
          console.info('[live-monitoring] 최근 감지 시딩 미응답 — MQTT 단독 모드', cam.id)
        })
    }
  }, [live, cameras, apply])

  return { live, feed }
}
