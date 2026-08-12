import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 개발 서버에서 /api 요청을 백엔드(게이트웨이)로 프록시한다.
  // 운영에서는 nginx가 동일한 역할을 하므로, 앱 코드는 항상 같은 오리진('/api')만 바라본다.
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    // 기획자 원본 코드(Next.js 관용구 process.env.NEXT_PUBLIC_*)를 수정 없이 반입하기 위한 치환.
    // Vite에는 process가 없어 빌드 타임에 문자열로 대체된다 — lib/api/client.ts가 사용.
    define: {
      'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify(env.NEXT_PUBLIC_API_BASE_URL ?? ''),
    },
    // 기획자 원본 코드를 수정 없이 반입하기 위한 별칭 — tsconfig.app.json paths와 세트
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src/features/vca', import.meta.url)),
        'next/navigation': fileURLToPath(new URL('./src/features/vca/compat/navigation.ts', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
