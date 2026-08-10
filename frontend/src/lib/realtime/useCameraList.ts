// SYSTEM 탭 카메라 목록 = REST 페이지 + MQTT 상태 오버레이.
// 목록 자체(페이징)는 REST가 원본이고, 각 행의 status만 실시간 값으로 덮어쓴다.
// 참고: status 필터로 조회한 페이지에서 실시간 상태가 바뀌어도 행을 제거하지 않는다
// (행이 갑자기 사라지는 UX 방지 — 다음 refetch/페이지 이동 때 반영).
import { useMemo } from 'react'
import { useGetCameras } from '../../api/generated/cameras/cameras'
import type { Camera, CameraStatus } from '../../api/generated/model'
import { useCameraStatuses } from './useCameraStatuses'

export type UseCameraListOptions = {
  page?: number
  size?: number
  status?: CameraStatus
}

export function useCameraList(options: UseCameraListOptions = {}) {
  const { page = 0, size = 20, status } = options

  const query = useGetCameras({ page, size, status })
  const liveStatuses = useCameraStatuses()

  const cameras: Camera[] = useMemo(() => {
    const content = query.data?.data?.content ?? []
    return content.map((c) => {
      const live = liveStatuses[c.cameraId]
      return live ? { ...c, status: live.status, name: live.name, location: live.location } : c
    })
  }, [query.data, liveStatuses])

  return {
    cameras,
    totalElements: query.data?.data?.totalElements ?? 0,
    page,
    size,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
