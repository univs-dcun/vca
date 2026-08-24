// 업로드 비디오 타일 (계약 v1.3, UV-35) — MP4 재생 + 프레임별 대상 bbox 오버레이.
//
// 타사 VCA 리뷰 화면 표준 방식: video 태그가 /api/videos/{id}/content(Range 지원)를 직접
// 재생하고, /videos/{id}/frames의 시간 인덱스 대상을 currentTime에 동기화해 박스를 그린다.
// - 구간 조회: 재생 위치의 60초 창 + 다음 창을 선조회 (계약 규칙 — 전체 인덱스 일괄 요청 금지)
// - 해석 규칙: currentTime 이하 '가장 최근 t' 항목 (retained bestframe과 동일). 단 그 항목이
//   1.5초보다 오래됐으면 대상이 화면에서 사라진 구간으로 보고 박스를 지운다
//
// 데이터 연결 계층(백엔드) 소유 — 기획자가 비디오 타일을 정식 디자인하면 이 컴포넌트를 대체한다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getVideoFrames } from '../../api/generated/videos/videos'
import type { VideoFrameEntry, VideoFrameObject } from '../../api/generated/model'

const WINDOW_SEC = 60
/** 마지막 프레임 항목이 이보다 오래되면 대상이 사라진 것 — 박스 미표시 */
const STALE_SEC = 1.5

// 비디오별 마지막 재생 위치(초) — Analyze Frame 진입 시각(recordedAt + 재생 위치) 계산용 (UV-37).
// 컴포넌트 밖 모듈 상태인 이유: 진입 버튼은 이 컴포넌트 밖(타일 오버레이·HUD)에 있다
const playbackTimes = new Map<string, number>()
export const getVideoPlaybackTime = (videoId: string): number => playbackTimes.get(videoId) ?? 0

const BOX_COLOR: Record<string, string> = {
  vip: '#5A3DFB',
  staff: '#3B82F6',
  vehicle: '#F59E0B',
  unauthorized: '#F43F5E',
  unknown: '#94A3B8',
  false_positive: '#94A3B8',
}

export function LiveVideoFeed({ videoId, src, poster }: { videoId: string; src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const windows = useRef<Map<number, VideoFrameEntry[]>>(new Map())
  const fetching = useRef<Set<number>>(new Set())
  const [objects, setObjects] = useState<VideoFrameObject[]>([])
  // objectFit: contain의 레터박스 보정 — bbox(0~1)는 영상 콘텐츠 기준이라, 오버레이 레이어를
  // 컨테이너가 아닌 실제 영상 표시 영역에 맞춰야 타일 비율이 달라도 박스가 어긋나지 않는다
  const [videoRect, setVideoRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const updateRect = useCallback(() => {
    const video = videoRef.current
    const box = containerRef.current
    if (!video || !box || !video.videoWidth || !video.videoHeight) return
    const cw = box.clientWidth
    const ch = box.clientHeight
    const scale = Math.min(cw / video.videoWidth, ch / video.videoHeight)
    const width = video.videoWidth * scale
    const height = video.videoHeight * scale
    setVideoRect({ left: (cw - width) / 2, top: (ch - height) / 2, width, height })
  }, [])

  useEffect(() => {
    const box = containerRef.current
    if (!box) return
    const ro = new ResizeObserver(updateRect)
    ro.observe(box)
    return () => ro.disconnect()
  }, [updateRect])

  const ensureWindow = useCallback((w: number) => {
    if (w < 0 || windows.current.has(w) || fetching.current.has(w)) return
    fetching.current.add(w)
    getVideoFrames(videoId, { from: w * WINDOW_SEC, to: (w + 1) * WINDOW_SEC })
      .then((res) => windows.current.set(w, res.data?.frames ?? []))
      .catch(() => fetching.current.delete(w)) // 실패 시 다음 timeupdate에서 재시도
  }, [videoId])

  // timeupdate(브라우저 기본 ~4Hz)로 충분 — 분석 프레임 간격(0.5초)보다 촘촘하다
  const onTimeUpdate = useCallback(() => {
    const t = videoRef.current?.currentTime ?? 0
    playbackTimes.set(videoId, t)
    const w = Math.floor(t / WINDOW_SEC)
    ensureWindow(w)
    ensureWindow(w + 1) // 창 경계에서 끊기지 않게 다음 창 선조회
    const entries = windows.current.get(w) ?? []
    let cur: VideoFrameEntry | null = null
    for (const e of entries) {
      if (e.t <= t + 0.05) cur = e
      else break
    }
    setObjects(cur && t - cur.t <= STALE_SEC ? cur.objects : [])
  }, [videoId, ensureWindow])

  // 비디오 교체 시 캐시 초기화
  useEffect(() => {
    windows.current = new Map()
    fetching.current = new Set()
    setObjects([])
    ensureWindow(0)
  }, [videoId, ensureWindow])

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, backgroundColor: '#0e162a' }}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        muted
        loop
        playsInline
        onTimeUpdate={onTimeUpdate}
        onSeeked={onTimeUpdate}
        onLoadedMetadata={updateRect}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      {/* bbox 오버레이 — 실제 영상 표시 영역(레터박스 제외)에 0~1 좌표를 %로 적용. controls를 가리지 않도록 클릭 통과 */}
      <div style={videoRect
        ? { position: 'absolute', left: videoRect.left, top: videoRect.top, width: videoRect.width, height: videoRect.height, pointerEvents: 'none' }
        : { position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {objects.map((o) => {
          const color = BOX_COLOR[o.category] ?? '#94A3B8'
          return (
            <div
              key={o.targetId}
              style={{
                position: 'absolute',
                left: `${o.bbox.x * 100}%`,
                top: `${o.bbox.y * 100}%`,
                width: `${o.bbox.w * 100}%`,
                height: `${o.bbox.h * 100}%`,
                border: `2px solid ${color}`,
                borderRadius: '2px',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '-18px',
                  left: '-2px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'white',
                  backgroundColor: color,
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
