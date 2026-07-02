import { UsersPage } from './features/users/UsersPage'

function App() {
  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>VCA</h1>
      <p>스캐폴드 예시 화면입니다. (features/users)</p>
      <UsersPage />
    </main>
  )
}

export default App
