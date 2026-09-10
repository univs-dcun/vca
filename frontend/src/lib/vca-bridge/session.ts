// 세션 스냅샷 (UV-52) — 로그인 응답(/auth/me)을 한 곳에 들고, 화면 계층의 스탠드인 4곳
// (vcaStore.currentPortalUser·currentPortalRole·projectsVisibleInApp·canSearchInApp)이 여기서 읽는다.
//
// 세 상태를 구분한다 — 'ok'(세션 있음), 'rejected'(명시적 미로그인 401), 'unavailable'(인증 서버 미가동).
// 기획 지시(스탠드인은 fail-closed)와 이 레포의 개발 폴백(서버 없으면 mock 유지)을 함께 만족시키기 위해
// 'unavailable'만 mock을 허용하고, 그 외에 세션이 없으면 거부가 기본값이다.
import { useSyncExternalStore } from 'react'
import type { AuthUserProfile } from '../../api/generated/model'

export type SessionStatus = 'unknown' | 'ok' | 'rejected' | 'unavailable'
export interface SessionSnapshot {
  status: SessionStatus
  user: AuthUserProfile | null
}

let snapshot: SessionSnapshot = { status: 'unknown', user: null }
const listeners = new Set<() => void>()

export function setSession(status: SessionStatus, user: AuthUserProfile | null = null): void {
  if (snapshot.status === status && snapshot.user === user) return
  snapshot = { status, user: status === 'ok' ? user : null }
  listeners.forEach((l) => l())
}

export function getSession(): SessionSnapshot {
  return snapshot
}

/** 세션이 확정된 사용자 — 없으면 null (unavailable·rejected·unknown 모두) */
export function getSessionUser(): AuthUserProfile | null {
  return snapshot.status === 'ok' ? snapshot.user : null
}

/** 인증 서버 미가동 — 이 경우에만 화면이 mock 신원으로 동작한다 (개발 폴백) */
export function isAuthUnavailable(): boolean {
  return snapshot.status === 'unavailable'
}

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getSession,
    getSession,
  )
}
