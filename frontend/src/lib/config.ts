// index.html에서 로드된 /config.js가 주입한 런타임 설정을 읽는다.
type VcaConfig = {
  API_BASE_URL: string
}

declare global {
  interface Window {
    __VCA_CONFIG__?: Partial<VcaConfig>
  }
}

export const config: VcaConfig = {
  API_BASE_URL: window.__VCA_CONFIG__?.API_BASE_URL ?? '/api',
}
