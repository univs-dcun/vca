import { useUsers } from './api'
import { UserList } from './components/UserList'

// 화면 조립 + 데이터 연결이 만나는 지점.
// 기획자가 화면을 배치하고, 백엔드가 useUsers() 한 줄로 실제 데이터를 연결한다.
export function UsersPage() {
  const { data: users, isLoading, isError } = useUsers()

  if (isLoading) return <p>불러오는 중…</p>
  if (isError) return <p>사용자를 불러오지 못했습니다.</p>

  return (
    <section>
      <h2>사용자</h2>
      <UserList users={users ?? []} />
    </section>
  )
}
