// BEST FRAME 실시간 영상 타일 (P2, UV-43 — 계약 v0.9.0 Camera.streamUrl).
//
// streamUrl(동일 오리진 WHEP 엔드포인트)을 WebRTC로 재생한다 — 외부 라이브러리 없이
// 표준 WHEP 흐름(offer POST → answer)만 사용. 미디어 서버(MediaMTX)가 응답 상대다.
//
// 폴백 규칙(설계 §5 — 전환 중에도 화면이 깨지지 않게): 연결 전·실패 시 fallback(기존
// bestframe 이미지)을 그대로 보여주고, 실패하면 15초 간격으로 재시도한다. bestframe MQTT
// 발행은 계약 불변이라 폴백 이미지는 항상 살아 있다. 오버레이(bbox)는 확정(2026-08-27)대로 없음.
//
// 수명주기 주의: 그리드 분할 전환·StrictMode에서 타일이 짧은 간격으로 여러 번 마운트된다 —
// 시작을 지연시켜 순간 마운트는 WHEP 요청 없이 사라지게 하고(미디어 서버에 유령 세션을
// 만들지 않게), 살아남은 마운트 하나만 연결한다.
//
// 데이터 연결 계층(백엔드) 소유 — 기획자가 실영상 타일을 정식 디자인하면 이 컴포넌트를 대체한다.
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** 마운트 후 이 시간을 살아남아야 연결을 시작한다 — 전환 중 순간 마운트의 요청 낭비 방지 */
const START_DELAY_MS = 400
/** 워치독 점검 주기 — ICE 미성립이면 실패, 성립인데 첫 프레임이 없으면 한도까지 연장 */
const WATCHDOG_MS = 4000
const WATCHDOG_MAX_CHECKS = 3
/** 실패 후 재시도 간격 — 미디어 서버 복구·스트림 재개를 자동으로 따라잡는다 */
const RETRY_MS = 15000

/** ICE 후보 수집 완료(또는 상한 시간)까지 대기 — non-trickle WHEP로 offer 1회에 후보를 실어 보낸다 */
function waitIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs)
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer)
        resolve()
      }
    })
  })
}

export function CameraStreamFeed({ src, fallback }: { src: string; fallback: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let closed = false
    let pc: RTCPeerConnection | null = null
    const abort = new AbortController()
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))

    const fail = () => {
      if (closed) return
      setPlaying(false)
      pc?.close()
      pc = null
      after(RETRY_MS, () => setAttempt((a) => a + 1))
    }

    // 첫 프레임이 실제로 렌더된 순간에만 영상으로 전환 — 'playing' 이벤트는 프레임 없이도
    // 발화할 수 있어(MediaStream) 프레임 콜백을 1차 신호로 쓴다
    const markPlaying = () => {
      if (!closed) setPlaying(true)
    }

    const watchdog = (checksLeft: number) =>
      after(WATCHDOG_MS, () => {
        if (closed || !pc) return
        if (videoRef.current && videoRef.current.currentTime > 0) return markPlaying()
        // ICE가 성립돼 있으면 프레임 대기를 한도까지 연장 (온디맨드 소스의 기동 지연 흡수)
        if (pc.connectionState === 'connected' && checksLeft > 0) return watchdog(checksLeft - 1)
        fail()
      })

    const start = async () => {
      try {
        pc = new RTCPeerConnection()
        pc.addTransceiver('video', { direction: 'recvonly' })
        pc.ontrack = (e) => {
          const video = videoRef.current
          if (!video || closed) return
          video.srcObject = e.streams[0]
          if ('requestVideoFrameCallback' in video) {
            video.requestVideoFrameCallback(markPlaying)
          } else {
            ;(video as HTMLVideoElement).addEventListener('playing', markPlaying, { once: true })
          }
        }
        pc.onconnectionstatechange = () => {
          const st = pc?.connectionState
          if (st === 'failed' || st === 'disconnected' || st === 'closed') fail()
        }
        watchdog(WATCHDOG_MAX_CHECKS)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitIceGathering(pc, 1000)
        if (closed || !pc) return
        const res = await fetch(src, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription!.sdp,
          signal: abort.signal,
        })
        if (!res.ok) throw new Error(`WHEP ${res.status}`)
        const answer = await res.text()
        if (closed || !pc) return
        await pc.setRemoteDescription({ type: 'answer', sdp: answer })
      } catch {
        fail()
      }
    }

    after(START_DELAY_MS, () => void start())
    return () => {
      closed = true
      abort.abort()
      timers.forEach((t) => window.clearTimeout(t))
      pc?.close()
    }
  }, [src, attempt])

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0e162a' }}>
      {/* 연결 전·실패 시 기존 bestframe 폴백이 그대로 보인다 — 첫 프레임 렌더 후에만 영상으로 교체 */}
      {!playing && <div style={{ position: 'absolute', inset: 0 }}>{fallback}</div>}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: playing ? 'block' : 'none',
        }}
      />
    </div>
  )
}
