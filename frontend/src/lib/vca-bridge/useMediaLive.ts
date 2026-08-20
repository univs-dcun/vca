// BEST FRAME Video/Image list 브리지 — 계약 v1.3(UV-35)의 업로드 미디어 조회를
// 화면 타입(Camera/CamData/Detection)으로 변환해 공급한다.
//
// 다른 브리지와 같은 폴백 규칙: REST 미응답이면 videos/images가 null — 화면은 기획자
// mock(VIDEO_CAMS_INIT/IMAGE_CAMS_INIT)을 그대로 쓴다. 목록·대상은 검색 시점 데이터라
// MQTT와 무관 (30초 주기 재조회 — analysisStatus 변화 반영).
//
// 채널 분담:
// - 사이드바 Video/Image 목록: getVideos/getImages (ready 외 상태는 alert=선택 불가로 매핑)
// - 타일·타깃 패널: 목록 로드 시 대상까지 선조회 (미디어 수가 적어 lazy 불필요)
// - 비디오 재생·오버레이: LiveVideoFeed 컴포넌트 (frames 구간 조회는 재생 중에만)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getImages, getImageTargets } from '../../api/generated/images/images'
import { getVideos, getVideoTargets } from '../../api/generated/videos/videos'
import type { ImageTarget, UploadedImage, VideoItem, VideoTarget } from '../../api/generated/model'
import type { CamData, Camera as ScreenCamera, DetType, Detection as ScreenDetection } from '../../features/vca/types/detection'

/** 목록 재조회 주기 — 업로드/분석 완료(analysisStatus 변화)를 이 주기로 반영 */
const REFRESH_MS = 30_000
const LIST_SIZE = 50

// useBestFrameLive와 동일한 카테고리 → 화면 타입 접기
const CATEGORY_TO_TYPE: Record<string, DetType> = {
  vip: 'VIP',
  staff: 'VIP',
  vehicle: 'Vehicle',
  unauthorized: 'Unknown',
  unknown: 'Unknown',
  false_positive: 'Unknown',
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`
const mmss = (sec: number) => {
  const s = Math.round(sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function imageTargetToDetection(t: ImageTarget): ScreenDetection {
  return {
    id: t.targetId,
    type: CATEGORY_TO_TYPE[t.category] ?? 'Unknown',
    name: t.label,
    group: t.groupLabel ?? t.category,
    confidence: t.confidence != null ? Math.round(t.confidence * 1000) / 10 : 0,
    time: '', // 정지 이미지 — 시각 개념 없음
    top: pct(t.bbox.y),
    left: pct(t.bbox.x),
    width: pct(t.bbox.w),
    height: pct(t.bbox.h),
    snapshotUrl: t.cropUrl,
    enrolledPhotoUrl: t.matchedVip ? `/api/vips/${t.matchedVip.vipId}/photo` : undefined,
  }
}

function videoTargetToDetection(t: VideoTarget): ScreenDetection {
  return {
    id: t.targetId,
    type: CATEGORY_TO_TYPE[t.category] ?? 'Unknown',
    name: t.label,
    group: t.groupLabel ?? t.category,
    confidence: t.confidence != null ? Math.round(t.confidence * 1000) / 10 : 0,
    // 등장 구간 표시 — 카메라의 감지 시각 자리를 재생 오프셋이 대신한다
    time: `${mmss(t.firstSeenSec)}–${mmss(t.lastSeenSec)}`,
    top: '0%',
    left: '0%',
    width: '0%',
    height: '0%',
    snapshotUrl: t.cropUrl,
    enrolledPhotoUrl: t.matchedVip ? `/api/vips/${t.matchedVip.vipId}/photo` : undefined,
  }
}

export function useMediaLive(): {
  /** 라이브 비디오 목록 (사이드바 Video list 대체) — REST 미응답이면 null */
  videos: ScreenCamera[] | null
  /** 라이브 이미지 목록 (사이드바 Image list 대체) — REST 미응답이면 null */
  images: ScreenCamera[] | null
  /** 선택된 미디어의 CamData — 해당 없으면 null (화면이 다음 폴백으로 넘어감) */
  dataFor: (camId: string) => CamData | null
} {
  const [videos, setVideos] = useState<VideoItem[] | null>(null)
  const [images, setImages] = useState<UploadedImage[] | null>(null)
  const dataRef = useRef<Map<string, CamData>>(new Map())
  const [, bump] = useState(0) // dataRef 갱신을 렌더에 반영

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [vres, ires] = await Promise.all([
          getVideos({ size: LIST_SIZE }),
          getImages({ size: LIST_SIZE }),
        ])
        if (!alive) return
        const vids = vres.data?.content ?? []
        const imgs = ires.data?.content ?? []
        setVideos(vids)
        setImages(imgs)

        // 타일·패널 데이터 선조회 — ready 비디오와 전체 이미지의 대상 목록
        for (const v of vids) {
          if (v.analysisStatus !== 'ready') continue
          getVideoTargets(v.videoId, { size: LIST_SIZE })
            .then((tres) => {
              if (!alive) return
              dataRef.current.set(v.videoId, {
                camLabel: v.name,
                location: v.name,
                bgUrl: v.thumbnailUrl ?? undefined,
                videoUrl: v.contentUrl,
                detections: (tres.data?.content ?? []).map(videoTargetToDetection),
              })
              bump((n) => n + 1)
            })
            .catch(() => {})
        }
        for (const img of imgs) {
          getImageTargets(img.imageId)
            .then((tres) => {
              if (!alive) return
              dataRef.current.set(img.imageId, {
                camLabel: img.name,
                location: img.name,
                bgUrl: img.imageUrl,
                detections: (tres.data?.targets ?? []).map(imageTargetToDetection),
              })
              bump((n) => n + 1)
            })
            .catch(() => {})
        }
      } catch {
        // REST 미기동 — null 유지, 화면이 mock 목록으로 폴백 (재시도는 다음 주기)
      }
    }
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  const toScreenCamera = (id: string, name: string, ready: boolean): ScreenCamera => ({
    id,
    name,
    checked: false,
    // 카메라 STOPPED과 같은 문법 — ready가 아니면 선택 불가(alert)
    monitor: ready ? ('normal' as const) : ('alert' as const),
  })

  const dataFor = useCallback((camId: string): CamData | null => dataRef.current.get(camId) ?? null, [])

  // 반환 배열은 반드시 메모 — 렌더마다 새 identity면 화면의 목록 동기화 effect가 무한 루프를 돈다
  const screenVideos = useMemo<ScreenCamera[] | null>(
    () => videos?.map((v) => toScreenCamera(v.videoId, v.name, v.analysisStatus === 'ready')) ?? null,
    [videos],
  )
  const screenImages = useMemo<ScreenCamera[] | null>(
    () => images?.map((i) => toScreenCamera(i.imageId, i.name, true)) ?? null,
    [images],
  )

  return { videos: screenVideos, images: screenImages, dataFor }
}
