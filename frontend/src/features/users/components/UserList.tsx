import type { User } from '../types'

// [기획자 영역] 프레젠테이션 컴포넌트.
// 규칙: 직접 fetch 하지 않고 props로만 데이터를 받는다. → 백엔드 없이 mock으로 화면 확정 가능.
type Props = {
  users: User[]
}

export function UserList({ users }: Props) {
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.name} <small>({u.email})</small>
        </li>
      ))}
    </ul>
  )
}
