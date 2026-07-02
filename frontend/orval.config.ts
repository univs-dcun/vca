import { defineConfig } from 'orval'

// OpenAPI 스펙(백엔드 산출물)에서 타입 + React Query 훅을 생성한다.
// 생성물은 src/api/generated 아래에 놓이며 손으로 수정하지 않는다(계약).
//   실행:  npm run gen:api
export default defineConfig({
  vca: {
    input: {
      target: '../openapi/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      prettier: false,
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
})
