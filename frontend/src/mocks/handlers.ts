import { http, HttpResponse } from 'msw'

// 기획자가 백엔드 없이 화면을 완성하기 위한 목 핸들러.
// 실제 API가 준비되면 해당 핸들러를 지우면 자동으로 실제 호출로 넘어간다.
// 응답 포맷은 백엔드 규약 { success, data, message, code }를 따른다.
export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json({
      success: true,
      code: 'OK',
      message: null,
      data: [
        { id: 1, name: '홍길동', email: 'hong@univs.ai' },
        { id: 2, name: '김철수', email: 'kim@univs.ai' },
      ],
    })
  }),
]
