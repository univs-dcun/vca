import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './features/vca/globals.css'
import App from './App.tsx'

const queryClient = new QueryClient()

// 개발 환경에서 VITE_ENABLE_MSW=true 일 때만 목 서버를 켠다.
async function enableMocking() {
  if (!import.meta.env.DEV) return
  if (import.meta.env.VITE_ENABLE_MSW !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

// MSW 실패는 비치명 — 서비스 워커 등록이 막히는 환경(임베디드 브라우저 등)에서도 앱은
// 렌더되어야 한다. 이 경우 요청이 실 API(vite proxy → 백엔드)로 그대로 나간다.
enableMocking().catch((e) => {
  console.warn('[msw] 목 서버 시작 실패 — 실 API로 동작합니다', e)
}).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})
