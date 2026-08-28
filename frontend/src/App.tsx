import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ClientLayout from './features/vca/components/ClientLayout'
import LoginPage from './features/vca/pages/LoginPage'
import MyPage from './features/vca/pages/MyPage'
import PasswordSetupPage from './features/vca/pages/PasswordSetupPage'
import RequireAuth from './lib/vca-bridge/RequireAuth'

// 라우트 구성 (import/frontend-ui 원본과 동일):
// 메인 4개 화면(DASHBOARD/BEST FRAME/DATA/REDMAP)은 별도 라우트가 아니라
// "/" 안에서 ?tab= 쿼리 + 상태로 전환된다 (ClientLayout 내부).
// 가드(UV-47): 세션이 명시적으로 없을 때만 /login으로 — 인증 서버 미가동이면 통과 (개발 폴백).
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RequireAuth><ClientLayout /></RequireAuth>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
        <Route path="/password-setup" element={<PasswordSetupPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
