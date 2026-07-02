import { useQuery } from '@tanstack/react-query'
import { axiosInstance } from '../../api/axios-instance'
import type { ApiResponse, User } from './types'

// [백엔드 개발자 영역] 데이터 계층.
// 이 예시는 손으로 작성했지만, 실제로는 orval이 OpenAPI에서 동일한 훅을 생성한다.
// (npm run gen:api 후 이 파일을 지우고 생성된 useGetUsers 등을 사용)
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await axiosInstance.get<ApiResponse<User[]>>('/users')
      return res.data.data
    },
  })
}
