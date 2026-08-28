// 인증 브리지 (UV-47) — 로그인/세션을 화면 타입으로 공급한다.
//
// 세션은 httpOnly 쿠키(vca_session)라 JS가 토큰을 다루지 않는다 — 이 모듈은 호출과
// 결과 해석만 담당한다. 다른 브리지와 같은 폴백 규칙: 인증 서버가 응답하지 않으면
// (기동 안 됨 — 프록시가 502 VCA-5021/504 VCA-5041로 구분해 준다) 'unavailable'을
// 반환하고, 화면은 기존 mock 흐름을 유지한다. 자격증명 오류(ADM-4010 등)는 실패다.
import { useEffect, useState } from 'react'
import { changePassword, getMe, login, logout, setupPassword, verifyPassword } from '../../api/generated/auth/auth'
import type { AuthUserProfile } from '../../api/generated/model'

export type { AuthUserProfile }

export type AuthResult =
  | { status: 'ok'; user?: AuthUserProfile }
  /** 서버가 거절 — message는 화면에 그대로 띄울 수 있는 문구 */
  | { status: 'rejected'; code: string; message: string }
  /** 인증 서버 미가동/미응답 — mock 폴백 대상 */
  | { status: 'unavailable' }

/** 세션 확인 — 'ok'(user 동봉) / 'rejected'(미로그인) / 'unavailable'(서버 없음) */
export async function fetchAuthMe(): Promise<AuthResult> {
  try {
    const res = await getMe()
    return { status: 'ok', user: res.data }
  } catch (e) {
    return interpret(e)
  }
}

export async function authLogin(email: string, password: string, keepLoggedIn: boolean): Promise<AuthResult> {
  try {
    const res = await login({ email, password, keepLoggedIn })
    return { status: 'ok', user: res.data }
  } catch (e) {
    return interpret(e)
  }
}

/** 로그아웃 — 실패해도 화면 전환을 막지 않는다 (멱등, 서버 없으면 지울 세션도 없음) */
export async function authLogout(): Promise<void> {
  try {
    await logout()
  } catch {
    console.info('[auth] 로그아웃 API 미응답 — 무시')
  }
}

export async function authVerifyPassword(currentPassword: string): Promise<AuthResult> {
  try {
    await verifyPassword({ currentPassword })
    return { status: 'ok' }
  } catch (e) {
    return interpret(e)
  }
}

/** 첫 로그인 Set Password (UV-48) — 임시 비밀번호 상태의 세션 전용, 현재 비밀번호 불요 */
export async function authSetupPassword(newPassword: string): Promise<AuthResult> {
  try {
    await setupPassword({ newPassword })
    return { status: 'ok' }
  } catch (e) {
    return interpret(e)
  }
}

export async function authChangePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  try {
    await changePassword({ currentPassword, newPassword })
    return { status: 'ok' }
  } catch (e) {
    return interpret(e)
  }
}

/**
 * 로그인 프로필 1회 조회 훅 — Navbar·My Page의 SIGNED_IN_USER(mock) 자리에
 * `useAuthProfile() ?? SIGNED_IN_USER`로 꽂는다. 미로그인/서버 미가동이면 null (mock 유지).
 */
export function useAuthProfile(): AuthUserProfile | null {
  const [profile, setProfile] = useState<AuthUserProfile | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchAuthMe().then((res) => {
      if (!cancelled && res.status === 'ok' && res.user) setProfile(res.user)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return profile
}

/** ADM-* = 서버가 실제로 거절 / VCA-5021·5041·네트워크 오류 = 인증 서버 미가동 */
function interpret(e: unknown): AuthResult {
  const err = e as { response?: { data?: { code?: string; message?: string } } }
  const code = err.response?.data?.code
  if (code && code.startsWith('ADM-')) {
    return { status: 'rejected', code, message: messageFor(code, err.response?.data?.message) }
  }
  return { status: 'unavailable' }
}

function messageFor(code: string, serverMessage: string | undefined): string {
  switch (code) {
    case 'ADM-4010':
      return 'Invalid email or password. Please try again.'
    case 'ADM-4011':
      return 'Your session has expired. Please log in again.'
    case 'ADM-4012':
      return 'Current password does not match.'
    case 'ADM-4001':
      return 'Password must be at least 8 characters with letters, numbers, and special characters.'
    case 'ADM-4013':
      return 'Your password is already set. Use password change in My Page.'
    default:
      return serverMessage ?? 'Request failed. Please try again.'
  }
}
