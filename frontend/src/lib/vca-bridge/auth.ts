// 인증 브리지 (UV-47) — 로그인/세션을 화면 타입으로 공급한다.
//
// 세션은 httpOnly 쿠키(vca_session)라 JS가 토큰을 다루지 않는다 — 이 모듈은 호출과
// 결과 해석만 담당한다. 다른 브리지와 같은 폴백 규칙: 인증 서버가 응답하지 않으면
// (기동 안 됨 — 프록시가 502 VCA-5021/504 VCA-5041로 구분해 준다) 'unavailable'을
// 반환하고, 화면은 기존 mock 흐름을 유지한다. 자격증명 오류(ADM-4010 등)는 실패다.
import { useEffect } from 'react'
import {
  changePassword, getMe, login, logout, redeemInvite, register, registerLookup, resetPasswordComplete, resetPasswordRequest,
  resetPasswordVerify, setupPassword, verifyPassword,
} from '../../api/generated/auth/auth'
import type { AuthCodeLookupResponseData, AuthResetRequestResponseData, AuthResetVerifyResponseData } from '../../api/generated/model'
import type { LoginFailure } from '../../features/vca/lib/authErrors'
import { setSession, useSession } from './session'
import type { AuthUserProfile } from '../../api/generated/model'

export type { AuthUserProfile }

export type AuthResult =
  | { status: 'ok'; user?: AuthUserProfile }
  /** 서버가 거절 — message는 화면에 그대로 띄울 수 있는 문구 */
  | { status: 'rejected'; code: string; message: string }
  /** 인증 서버 미가동/미응답 — mock 폴백 대상 */
  | { status: 'unavailable' }

/** 세션 확인 — 'ok'(user 동봉) / 'rejected'(미로그인) / 'unavailable'(서버 없음) */
let meInflight: Promise<AuthResult> | null = null
export function fetchAuthMe(): Promise<AuthResult> {
  // 동시 호출은 한 번만 — 가드·Navbar·PortalShell이 첫 렌더에 함께 묻는다 (UV-52)
  if (meInflight) return meInflight
  meInflight = (async () => {
    try {
      const res = await getMe()
      setSession('ok', res.data)
      return { status: 'ok' as const, user: res.data }
    } catch (e) {
      const r = interpret(e)
      setSession(r.status === 'rejected' ? 'rejected' : 'unavailable')
      return r
    } finally {
      meInflight = null
    }
  })()
  return meInflight
}

export async function authLogin(email: string, password: string, keepLoggedIn: boolean): Promise<AuthResult> {
  try {
    const res = await login({ identifier: email, password, keepLoggedIn })
    setSession('ok', res.data)
    return { status: 'ok', user: res.data }
  } catch (e) {
    return interpret(e)
  }
}

/** 로그아웃 — 실패해도 화면 전환을 막지 않는다 (멱등, 서버 없으면 지울 세션도 없음) */
export async function authLogout(): Promise<void> {
  setSession('rejected')
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
  // 세션 스냅샷(session.ts)을 구독 — 화면 여러 곳이 각자 /auth/me를 부르지 않고 한 결과를 공유한다 (UV-52)
  const session = useSession()
  useEffect(() => {
    if (session.status === 'unknown') void fetchAuthMe()
  }, [session.status])
  return session.status === 'ok' ? session.user : null
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

/** 초대 링크 활성화 (UV-51) — 토큰 검증·만료·소진은 서버. 무효/만료는 'rejected' ADM-4024 */
export async function authRedeemInvite(token: string, password: string): Promise<AuthResult> {
  try {
    await redeemInvite({ token, password })
    return { status: 'ok' }
  } catch (e) {
    return interpret(e)
  }
}

/**
 * 서버 로그인 거절 코드 → 기획 authErrors 7종 (설계 §4.1 계약). 매핑 밖(검증 오류 등)은 null —
 * 화면이 서버 문구를 그대로 띄운다.
 */
export function loginFailureFromCode(code: string | undefined): LoginFailure | null {
  switch (code) {
    case 'ADM-4010': return 'badCredentials'
    case 'ADM-4011': return 'sessionExpired'
    case 'ADM-4015': return 'locked'
    case 'ADM-4016': return 'suspended'
    case 'ADM-4017': return 'notActivated'
    case 'ADM-4018': return 'pendingApproval'
    case 'ADM-4019': return 'notActivated' // 임시 비밀번호 만료 — 담당자 재발급이 필요하다는 점에서 같은 안내
    default: return null
  }
}

/** 데이터가 실리는 호출의 공통 결과 (UV-52 2차) — 해석 규칙은 AuthResult와 같다 */
export type ApiOutcome<T> =
  | { status: 'ok'; data: T }
  | { status: 'rejected'; code: string; message: string }
  | { status: 'unavailable' }

async function outcome<T>(call: () => Promise<{ data?: T | null }>): Promise<ApiOutcome<T>> {
  try {
    const res = await call()
    return { status: 'ok', data: res.data as T }
  } catch (e) {
    return interpret(e) as ApiOutcome<T>
  }
}

// ── 등록 코드 (UV-51 /auth/register) — 명부 코드·셋업 코드 모두 서버가 판정, 시도 스로틀도 서버(ADM-4023)
export function authRegisterLookup(code: string): Promise<ApiOutcome<AuthCodeLookupResponseData>> {
  return outcome(() => registerLookup({ code }))
}
export function authRegister(code: string, password: string): Promise<ApiOutcome<unknown>> {
  return outcome(() => register({ code, password }))
}

// ── 이메일 코드 재설정 (UV-56 /auth/password/reset/*) — 존재 여부 비노출, 재발송·시도 한도는 서버 값
export function authResetRequest(identifier: string): Promise<ApiOutcome<AuthResetRequestResponseData>> {
  return outcome(() => resetPasswordRequest({ identifier }))
}
export function authResetVerify(identifier: string, code: string): Promise<ApiOutcome<AuthResetVerifyResponseData>> {
  return outcome(() => resetPasswordVerify({ identifier, code }))
}
export function authResetComplete(resetToken: string, newPassword: string): Promise<ApiOutcome<unknown>> {
  return outcome(() => resetPasswordComplete({ resetToken, newPassword }))
}
