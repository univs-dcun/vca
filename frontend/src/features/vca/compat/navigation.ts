// next/navigation 호환 심(shim) — react-router 위에 동일한 시그니처를 제공한다.
// 화면 코드(import/frontend-ui에서 이식)는 Next.js에서 next/navigation을 사용했는데,
// 본문을 고치지 않고 import 경로만 이 파일로 바꿔서 Vite SPA로 이식하기 위한 어댑터.
import { useMemo } from 'react'
import {
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
} from 'react-router-dom'

export function useRouter() {
  const navigate = useNavigate()
  return useMemo(
    () => ({
      push: (url: string) => navigate(url),
      // next/navigation의 replace 옵션({ scroll })은 SPA에서 의미 없어 무시한다
      replace: (url: string, _options?: { scroll?: boolean }) => navigate(url, { replace: true }),
      back: () => navigate(-1),
    }),
    [navigate],
  )
}

export function usePathname(): string {
  return useLocation().pathname
}

/** next/navigation처럼 읽기 전용 URLSearchParams 하나만 반환한다 */
export function useSearchParams(): URLSearchParams {
  const [params] = useRouterSearchParams()
  return params
}

/**
 * next/navigation의 redirect() — 서버 컴포넌트/렌더 중 호출용 API라 SPA에는 대응물이 없다.
 * 반입 화면(signup: selfSignup=false면 /login)이 렌더 중 호출하므로 전체 페이지 이동으로 흉내낸다.
 * 현재 렌더는 계속 진행되지만 곧 떠나므로 잔상은 한 프레임 이내.
 */
export function redirect(url: string): void {
  if (typeof window !== 'undefined' && window.location.pathname !== url) {
    window.location.replace(url)
  }
}
