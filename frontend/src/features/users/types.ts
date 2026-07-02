// 예시 feature용 타입.
// 실제로는 백엔드 OpenAPI에서 orval이 생성한 타입(src/api/generated/model)을 import 한다.
export type ApiResponse<T> = {
  success: boolean
  code: string
  message: string | null
  data: T
}

export type User = {
  id: number
  name: string
  email: string
}
