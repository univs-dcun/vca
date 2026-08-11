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
