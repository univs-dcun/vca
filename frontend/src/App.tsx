import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ClientLayout from './features/vca/components/ClientLayout'
import LoginPage from './features/vca/pages/LoginPage'
import MyPage from './features/vca/pages/MyPage'
import PasswordSetupPage from './features/vca/pages/PasswordSetupPage'

// 라우트 구성 (import/frontend-ui 원본과 동일):
// 메인 4개 화면(DASHBOARD/BEST FRAME/DATA/REDMAP)은 별도 라우트가 아니라
// "/" 안에서 ?tab= 쿼리 + 상태로 전환된다 (ClientLayout 내부).
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientLayout />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/password-setup" element={<PasswordSetupPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
