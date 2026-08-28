// 라우트 가드 (UV-47) — 세션 없으면 /login으로 보낸다.
//
// 판정 전에도 children을 그대로 렌더한다: 확인은 백그라운드 1회 호출이고, 명시적 거절
// (401 ADM-4011)일 때만 리다이렉트한다. 인증 서버 미가동('unavailable')이면 통과 —
// 다른 브리지의 mock 폴백과 같은 규칙이라, 백엔드 없이 화면만 띄우는 개발 흐름이 유지된다.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAuthMe } from './auth'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  useEffect(() => {
    let cancelled = false
    fetchAuthMe().then((res) => {
      if (!cancelled && res.status === 'rejected') {
        navigate('/login', { replace: true })
      }
    })
    return () => {
      cancelled = true
    }
  }, [navigate])
  return children
}
