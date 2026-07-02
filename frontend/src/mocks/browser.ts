import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// 브라우저용 MSW 워커.
// 최초 1회 `npm run msw:init` 으로 public/mockServiceWorker.js 를 생성해야 한다.
export const worker = setupWorker(...handlers)
