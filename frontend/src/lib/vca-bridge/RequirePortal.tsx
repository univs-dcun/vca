// Portal 라우트 가드 (UV-52) — 세션은 있는데 콘솔 역할이 none(앱 전용 계정)이면 "/"로 보낸다.
// 세션 자체는 바깥의 RequireAuth가 판정한다(401 → /login). 진짜 문은 서버(SessionInterceptor ADM-4030)이고,
// 이 가드는 없는 문을 화면이 내놓지 않게 하는 UI 교정이다 — 기획자 PortalShell HANDOFF NOTE와 같은 취지.
// 인증 서버 미가동('unavailable')이면 기존 mock 신원으로 렌더한다 (이 레포의 개발 폴백 규칙).
import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAuthMe } from './auth'
import { useSession } from './session'

export default function RequirePortal({ children }: { children: ReactNode }) {
  const session = useSession()
  const navigate = useNavigate()
  useEffect(() => {
    if (session.status === 'unknown') void fetchAuthMe()
  }, [session.status])
  const denied = session.status === 'ok' && session.user?.permission === 'none'
  useEffect(() => {
    if (denied) navigate('/', { replace: true })
  }, [denied, navigate])
  if (denied) return null
  return <>{children}</>
}
