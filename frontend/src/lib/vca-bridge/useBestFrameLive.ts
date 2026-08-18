// BEST FRAME 라이브 브리지 — 계약 데이터(MQTT bestframe + detections, REST 최근 감지)를
// 화면 타입(Camera/CamData/Detection)으로 변환해 공급한다. (SPEC §3.2 v1.1, §3.5 / UV-33)
//
// 다른 라이브 훅과 같은 폴백 규칙: 브로커 미연결이면 cameras=null, dataFor()=null —
// 화면은 기획자 mock(NORMAL_CAMS_INIT/CAM_DATA)을 그대로 쓴다.
//
// 채널 분담:
// - 사이드바 카메라 목록: 스토어 cameras (대시보드 브리지가 status retained로 채움) 재사용
// - 타일 프레임: 선택된 카메라만 bestframe 토픽 개별 구독 (SPEC §3.5 — 와일드카드 금지)
// - 타깃 패널: REST 최근 감지 시딩(카메라 선택 시 1회) + detections 델타를 eventId로 병합
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCameraDetections } from '../../api/generated/cameras/cameras'
import type { DetectionEventRow } from '../../api/generated/model'
import type { CamData, Camera as ScreenCamera, DetType, Detection as ScreenDetection } from '../../features/vca/types/detection'
import { useVcaStore } from '../../features/vca/lib/vcaStore'
import { getConnectionStatus, onConnectionStatusChange, subscribe } from '../realtime/mqttClient'
import { topics } from '../realtime/topics'
import type { BestFrameMessage, DetectionEvent, MqttConnectionStatus } from '../realtime/types'

/** 타깃 패널에 유지할 카메라별 최근 감지 수 */
const RECENT_CAP = 20
/** REST 시딩 페이지 크기 */
const SEED_SIZE = 10

// 계약 카테고리 → 화면 DetType. 화면 모델이 3종이라 인물 매칭(vip·staff)은 VIP로,
// 미등록·미상·오탐은 Unknown으로 접는다. 화면 타입이 세분화되면 이 표만 갱신하면 된다.
const CATEGORY_TO_TYPE: Record<string, DetType> = {
  vip: 'VIP',
  staff: 'VIP',
  vehicle: 'Vehicle',
  unauthorized: 'Unknown',
  unknown: 'Unknown',
  false_positive: 'Unknown',
}

const timeSgt = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false })

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`

// REST 행(DetectionEventRow)과 MQTT 델타(DetectionEvent)는 동일 구조(계약) — 한 타입으로 취급
type AnyDetection = DetectionEvent | DetectionEventRow

function toScreenDetection(e: AnyDetection, frame: BestFrameMessage | undefined): ScreenDetection {
  const obj = frame?.objects.find((o) => o.eventId === e.eventId)
  return {
    id: e.eventId,
    type: CATEGORY_TO_TYPE[e.category ?? 'vip'] ?? 'Unknown',
    name: e.label ?? e.vip?.name ?? 'Unknown',
    group: e.groupLabel ?? e.category ?? 'Unknown',
    // 화면은 % 정수(98.4)로 표시 — 계약은 0~1 실수
    confidence: e.confidence != null ? Math.round(e.confidence * 1000) / 10 : 0,
    time: timeSgt(e.detectedAt),
    // 현재 프레임에 보이는 대상만 박스 좌표를 가진다 — 지나간 감지는 0% (그리지 않음과 동일)
    top: obj ? pct(obj.bbox.y) : '0%',
    left: obj ? pct(obj.bbox.x) : '0%',
    width: obj ? pct(obj.bbox.w) : '0%',
    height: obj ? pct(obj.bbox.h) : '0%',
    // 패널 썸네일·팝오버 LIVE SNAPSHOT / ENROLLED DB — 없으면 화면이 mock으로 폴백
    snapshotUrl: e.snapshotUrl,
    enrolledPhotoUrl: e.vip ? `/api/vips/${e.vip.vipId}/photo` : undefined,
  }
}

export function useBestFrameLive(selectedIds: string[]): {
  /** 라이브 카메라 목록 (사이드바 Normal network 대체) — 미연결이면 null */
  cameras: ScreenCamera[] | null
  /** 선택된 카메라의 라이브 CamData — 프레임 미수신/미연결이면 null (화면이 mock 폴백) */
  dataFor: (camId: string) => CamData | null
} {
  const [conn, setConn] = useState<MqttConnectionStatus>(getConnectionStatus())
  const [frames, setFrames] = useState<Map<string, BestFrameMessage>>(new Map())
  const [recent, setRecent] = useState<Map<string, AnyDetection[]>>(new Map())
  const seededIds = useRef<Set<string>>(new Set())
  const storeCameras = useVcaStore((s) => s.cameras)

  useEffect(() => onConnectionStatusChange(setConn), [])
  const isLive = conn === 'connected'

  // 구독 effect의 의존성으로 쓸 안정 키 — 배열 리터럴은 렌더마다 identity가 바뀐다
  const idsKey = [...selectedIds].sort().join(',')
  // 라이브 카메라 ID 집합 — 화면 mock 선택이 라이브 목록으로 교체되기 전의 짧은 창에서
  // mock ID(bs1a 등)로 REST 시딩(404)이 나가는 것을 막는다
  const liveIdsKey = useMemo(() => storeCameras.map((c) => c.id).sort().join(','), [storeCameras])

  // 선택된 카메라의 bestframe 개별 구독 (retained라 구독 즉시 최신 프레임 수신)
  useEffect(() => {
    if (!idsKey) return
    const ids = idsKey.split(',')
    const unsubs = ids.map((id) =>
      subscribe(topics.cameraBestFrame(id), (payload) => {
        if (payload === null) {
          setFrames((prev) => { const next = new Map(prev); next.delete(id); return next })
          return
        }
        const msg = payload as BestFrameMessage
        setFrames((prev) => new Map(prev).set(msg.cameraId, msg))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [idsKey])

  // 타깃 패널 REST 시딩 — 카메라를 처음 선택했을 때 1회 (openapi getCameraDetections)
  useEffect(() => {
    if (!isLive || !idsKey) return
    const liveIds = new Set(liveIdsKey.split(','))
    for (const id of idsKey.split(',')) {
      if (!liveIds.has(id) || seededIds.current.has(id)) continue
      seededIds.current.add(id)
      getCameraDetections(id, { size: SEED_SIZE })
        .then((res) => {
          const rows = res.data?.content
          if (!rows?.length) return
          setRecent((prev) => {
            const next = new Map(prev)
            const existing = next.get(id) ?? []
            const seen = new Set(existing.map((e) => e.eventId))
            // 델타가 먼저 도착했을 수 있다 — eventId 병합 후 최신순 유지 (SPEC §5와 동일 규칙)
            const merged = [...existing, ...rows.filter((r) => !seen.has(r.eventId))]
            merged.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
            next.set(id, merged.slice(0, RECENT_CAP))
            return next
          })
        })
        .catch(() => {
          // REST 미기동 — MQTT 델타 단독 모드로 동작 (시딩 재시도는 재선택 시)
          seededIds.current.delete(id)
        })
    }
  }, [isLive, idsKey, liveIdsKey])

  // detections 델타 — 전 카테고리를 카메라별 최근 목록에 누적 (선택 여부와 무관하게 수신되지만
  // 저장은 선택된 카메라만 — 미선택 카메라는 선택 시점에 REST 시딩이 이력을 채운다)
  useEffect(() => {
    return subscribe(topics.cameraDetectionsAll(), (payload) => {
      if (payload === null || !idsKey) return
      const e = payload as DetectionEvent
      if (!idsKey.split(',').includes(e.cameraId)) return
      setRecent((prev) => {
        const existing = prev.get(e.cameraId) ?? []
        if (existing.some((x) => x.eventId === e.eventId)) return prev
        const next = new Map(prev)
        next.set(e.cameraId, [e, ...existing].slice(0, RECENT_CAP))
        return next
      })
    })
  }, [idsKey])

  // 사이드바 카메라 목록 — 스토어 cameras(라이브 모드에서 MQTT status로 채워짐) → 화면 Camera.
  // STOPPED는 화면 규칙상 선택 불가(alert)로 매핑된다.
  const cameras = useMemo<ScreenCamera[] | null>(() => {
    if (!isLive || storeCameras.length === 0) return null
    return storeCameras.map((c) => ({
      id: c.id,
      name: c.name,
      checked: false,
      monitor: c.status === 'online' ? ('normal' as const) : ('alert' as const),
    }))
  }, [isLive, storeCameras])

  const dataFor = useCallback(
    (camId: string): CamData | null => {
      if (!isLive) return null
      const frame = frames.get(camId)
      if (!frame) return null // 첫 프레임 수신 전 — 화면이 mock/기본 배경으로 폴백
      const events = recent.get(camId) ?? []
      return {
        camLabel: frame.cameraName,
        location: storeCameras.find((c) => c.id === camId)?.location ?? frame.cameraName,
        bgUrl: frame.imageUrl,
        detections: events.map((e) => toScreenDetection(e, frame)),
      }
    },
    [isLive, frames, recent, storeCameras],
  )

  return { cameras, dataFor }
}
