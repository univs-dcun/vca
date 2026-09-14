"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import VerificationCodeInput from "@/components/VerificationCodeInput";
import { LockFieldIcon, EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";
import { getAuthConfig } from "@/lib/authConfig";
import { REGISTRATION_CODE_LENGTH } from "@/lib/staffRoster";
import { useVcaStore } from "@/lib/vcaStore";
import { useLanguage, type AppLanguage } from "@/lib/i18n";
// 데이터 연결(UV-52 2차): 등록 코드 조회·계정 활성화는 서버(/auth/register/lookup·/auth/register) — 코드 풀 판정·
// 만료·사용 여부·시도 스로틀(ADM-4020~4023) 전부 서버. 화면의 클라이언트 카운터·mock 조회는 기획 지시대로 삭제
import { authRegister, authRegisterLookup } from "../../../lib/vca-bridge/auth";

type Step = "code" | "confirm" | "password" | "done";

// See the per-file pattern note in lib/i18n.ts.
const T = {
  en: {
    throttledTitle: "Too many attempts",
    throttledSub: "Code entry is locked for now",
    throttledBody: "Wait a few minutes and try again, or ask your administrator to issue a new code for you.",
    securityTeam: "Your security operations team",
    backToLogin: "Back to log in",
    serverUnavailable: "The sign-in server is not reachable. Try again in a moment.",
    codeTitle: "Enter your registration code",
    codeSub: (n: number) => `The ${n}-character code your administrator gave you`,
    continue: "Continue",
    haveAccount: "Already have an account?",
    logIn: "Log in",
    confirmTitle: "Is this you?",
    confirmSub: "Check your details before continuing",
    employeeId: "Employee ID",
    department: "Department",
    project: "Project",
    scope: "Scope",
    allTeams: "All teams and projects",
    permission: "Permission",
    permAdmin: "Administrator — Portal + App",
    permOperator: "App only",
    yesContinue: "Yes, continue",
    notMe: "This isn't me — enter a different code",
    passwordTitle: "Set your password",
    passwordSub: (name: string) => `You are setting up the account for ${name}`,
    password: "Password",
    confirmPassword: "Confirm password",
    mismatch: "Passwords don’t match",
    createAccount: "Create account",
    doneTitle: "Account created",
    doneSub: (name: string) => `You can now log in as ${name}`,
  },
  ko: {
    throttledTitle: "시도 횟수를 초과했습니다",
    throttledSub: "코드 입력이 잠시 차단되었습니다",
    throttledBody: "몇 분 뒤에 다시 시도하시거나, 관리자에게 새 코드를 요청해주세요.",
    securityTeam: "보안 관제 담당자",
    backToLogin: "로그인으로 돌아가기",
    serverUnavailable: "인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
    codeTitle: "등록 코드를 입력해주세요",
    codeSub: (n: number) => `관리자에게 받은 ${n}자리 코드입니다`,
    continue: "다음",
    haveAccount: "이미 계정이 있으신가요?",
    logIn: "로그인",
    confirmTitle: "본인이 맞으신가요?",
    confirmSub: "계속하기 전에 정보를 확인해주세요",
    employeeId: "사번",
    department: "부서",
    project: "프로젝트",
    scope: "범위",
    allTeams: "모든 팀과 프로젝트",
    permission: "권한",
    permAdmin: "관리자 — 포털 + 앱",
    permOperator: "앱만",
    yesContinue: "네, 계속하기",
    notMe: "제가 아닙니다 — 다른 코드 입력하기",
    passwordTitle: "비밀번호를 설정해주세요",
    passwordSub: (name: string) => `${name} 님의 계정을 설정하고 있습니다`,
    password: "비밀번호",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다",
    createAccount: "계정 만들기",
    doneTitle: "계정이 만들어졌습니다",
    doneSub: (name: string) => `이제 ${name} 님으로 로그인할 수 있습니다`,
  },
} as const;

/**
 * What a code turned out to belong to. Two pools issue codes and both land here:
 *
 *  - the staff roster, for people an administrator imported ahead of time
 *  - an existing account, for someone who cannot be handed a temporary password — the first
 *    administrator at an on-premise handover above all, who has no roster row because the roster
 *    is something they will create later
 *
 * Normalised so the confirmation screen does not branch: it only ever shows the fields it was
 * given, and a code from either pool reads the same to the person holding it.
 */
interface Activation {
  name: string;
  employeeId?: string;
  department?: string;
  projectId?: string;
  /** 서버가 이름을 함께 준다(UV-51 lookup) — 이 화면은 프로젝트 목록을 갖고 있지 않다 */
  projectName?: string;
  permission: "admin" | "operator";
  /** Which pool it came from — only needed for the handoff notes about what to burn. */
  source: "roster" | "account";
}

/**
 * Three messages, because the next move differs: retype it, ask for a new one, or stop.
 *
 * "Already used" is named rather than folded into "unknown" — decided 2026-09-02, see the auth-flow
 * doc, section 03. Reaching this message at all means guessing 8 correct characters, so what leaks
 * is close to nothing, while the person who has genuinely already registered (or handed their slip
 * to a colleague) learns the one thing that explains what they are seeing.
 */
const CODE_ERRORS: Record<"unknown" | "used" | "expired", Record<AppLanguage, string>> = {
  unknown: {
    en: "Code not recognised. Check the sheet you were given.",
    ko: "확인되지 않는 코드입니다. 받으신 용지를 다시 확인해주세요.",
  },
  used: {
    en: "Code already used. Ask your administrator for a new one.",
    ko: "이미 사용된 코드입니다. 관리자에게 새 코드를 요청해주세요.",
  },
  expired: {
    en: "Code expired. Ask your administrator for a new one.",
    ko: "만료된 코드입니다. 관리자에게 새 코드를 요청해주세요.",
  },
};

/**
 * Wrong codes allowed before entry closes. The code is the only gate on this screen and the space
 * is ~1.1 x 10^12, which is only out of reach with a limit in front of it.
 *
 * HANDOFF NOTE: counted in this component, so it resets on reload — it stops a person mistyping
 * their way through a sheet of codes, and nothing more. The real limit is per account/address/IP
 * and lives on the server; this number has to match whatever that one is.
 */

function fieldBorder(active: boolean) {
  return active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)";
}

/**
 * Sign-up for a company's own staff, as opposed to /signup, which is the Portal wizard a master uses
 * to create an team.
 *
 * Built for deployments with no outbound mail, so there is no emailed link and no emailed code. An
 * administrator loads the staff roster into Portal and hands each person a registration code on
 * paper; the code resolves to exactly one roster row, which is what proves identity here. Because
 * that row already carries the person's name, project and permission, the only things asked for are
 * the code and a password — asking again for what the roster knows would add typos and no security.
 *
 * Issuing the code is the approval, so nothing here waits for a second review.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterFlow />
    </Suspense>
  );
}

function RegisterFlow() {
  const router = useRouter();
  const [lang] = useLanguage();
  const t = T[lang];
  const authConfig = getAuthConfig();
  const projects = useVcaStore(s => s.projects);
  const [step, setStep] = useState<Step>("code");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [digits, setDigits] = useState<string[]>(() => Array(REGISTRATION_CODE_LENGTH).fill(""));
  const [codeError, setCodeError] = useState("");
  // Separate from codeError because it is not an inline message — it replaces the entry step. See
  // the panel below for why.
  const [throttled, setThrottled] = useState(false);
  const [entry, setEntry] = useState<Activation | null>(null);
  const code = digits.join("");
  const codeComplete = code.length === REGISTRATION_CODE_LENGTH;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const formatValid = isPasswordFormatValid(password);
  const formatBroken = password.length > 0 && !formatValid;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const canSetPassword = formatValid && confirmPassword.length > 0 && !mismatch && !busy;

  const restart = () => {
    setDigits(Array(REGISTRATION_CODE_LENGTH).fill(""));
    setCodeError("");
    setThrottled(false);
    setEntry(null);
    setStep("code");
  };

  // 서버 판정 → 화면 상태. 시도 횟수 제한은 서버(ADM-4023, IP당 15분 5회)라 클라이언트 카운터가 없다
  const rejectCode = (code: string, message: string) => {
    if (code === "ADM-4023") { setCodeError(""); setThrottled(true); return; }
    const reason = code === "ADM-4021" ? "used" : code === "ADM-4022" ? "expired" : code === "ADM-4020" ? "unknown" : null;
    setCodeError(reason ? CODE_ERRORS[reason][lang] : message);
  };

  const submitCode = async () => {
    if (!codeComplete || busy) return;
    setBusy(true);
    const r = await authRegisterLookup(code);
    setBusy(false);
    if (r.status === "ok") {
      const d = r.data;
      setCodeError("");
      setEntry({
        name: d.name, employeeId: d.employeeId ?? undefined,
        projectId: d.projectId ?? undefined, projectName: d.projectName ?? undefined,
        permission: d.permission, source: d.kind === "roster" ? "roster" : "account",
      });
      setStep("confirm");
      return;
    }
    if (r.status === "rejected") { rejectCode(r.code, r.message); return; }
    setCodeError(t.serverUnavailable);
  };

  // 코드 소진 + 계정 생성/활성화 + 비밀번호 설정은 서버 한 트랜잭션(/auth/register) — 기획 HANDOFF 그대로
  const savePassword = async () => {
    if (!canSetPassword || !entry) return;
    setBusy(true);
    setServerError(null);
    const r = await authRegister(code, password);
    setBusy(false);
    if (r.status === "ok") { setStep("done"); return; }
    if (r.status === "rejected") {
      if (r.code === "ADM-4021" || r.code === "ADM-4022" || r.code === "ADM-4020") {
        // 확인 단계 사이에 코드가 무효가 됨 — 코드 입력으로 되돌리고 사유를 보여준다
        restart();
        rejectCode(r.code, r.message);
        return;
      }
      setServerError(r.message);
      return;
    }
    setServerError(t.serverUnavailable);
  };

  const heading = (title: string, lines: string[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
      <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px", textAlign: "center" }}>{title}</h1>
      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.6 }}>
        {lines.map((line, i) => (
          <span key={i}>{line}{i < lines.length - 1 && <br />}</span>
        ))}
      </p>
    </div>
  );

  const primaryButton = (label: string, enabled: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        height: "48px", width: "100%", border: "none", borderRadius: "8px",
        backgroundColor: enabled ? "var(--primary-400)" : "var(--gray-100)",
        color: enabled ? "white" : "var(--gray-400)",
        fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px",
        cursor: enabled ? "pointer" : "default",
        transition: "background-color 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );

  const passwordField = (
    label: string, key: string, value: string, setValue: (v: string) => void,
    shown: boolean, toggle: () => void, onEnter?: () => void,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
      <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: fieldBorder(focusedField === key), borderRadius: "8px" }}>
        <LockFieldIcon />
        <input
          type={shown ? "text" : "password"}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocusedField(key)}
          onBlur={() => setFocusedField(null)}
          onKeyDown={e => { if (e.key === "Enter") onEnter?.(); }}
          placeholder="••••••••"
          autoFocus={key === "password"}
          style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
        />
        <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
          {shown ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
    </div>
  );

  const detailRow = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-800)", letterSpacing: "-0.26px", textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: "480px", maxWidth: "480px", backgroundColor: "white",
          borderRadius: "28px", padding: "36px", margin: "40px 0",
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>

          {/* A wall, not an inline hint. Leaving the boxes usable invites a tenth attempt that
              cannot succeed, and this code is the only thing standing in front of an account, so
              the attempt limit is the security control rather than an annoyance to soften. */}
          {step === "code" && throttled && (
            <>
              {heading(t.throttledTitle, [t.throttledSub])}
              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{
                  display: "flex", flexDirection: "column", gap: "10px",
                  padding: "20px", borderRadius: "12px", backgroundColor: "var(--danger-100)",
                }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", letterSpacing: "-0.26px", lineHeight: 1.7 }}>
                    {t.throttledBody}
                  </p>
                  <div style={{ height: "1px", backgroundColor: "var(--danger-200)", margin: "2px 0" }} />
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {authConfig.supportContact ?? t.securityTeam}
                  </p>
                </div>
                {primaryButton(t.backToLogin, true, () => router.push("/login"))}
              </div>
            </>
          )}

          {step === "code" && !throttled && (
            <>
              {heading(t.codeTitle, [t.codeSub(REGISTRATION_CODE_LENGTH)])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", alignItems: "center" }}>
                  <VerificationCodeInput
                    value={digits}
                    onChange={next => { setDigits(next); setCodeError(""); }}
                    error={!!codeError}
                    onSubmit={submitCode}
                    charset="alnum"
                    groupAfter={4}
                    autoFocus
                  />
                  {codeError && (
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px", textAlign: "center" }}>
                      <ErrorCircleIcon /> {codeError}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton(t.continue, codeComplete, submitCode)}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {t.haveAccount}{" "}
                    <button
                      onClick={() => router.push("/login")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                    >
                      {t.logIn}
                    </button>
                  </p>
                </div>
              </div>
            </>
          )}

          {step === "confirm" && entry && (
            <>
              {heading(t.confirmTitle, [t.confirmSub])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                {/* Showing what the code resolved to, before a password exists. Someone handed the
                    wrong sheet finds out here instead of after creating an account in another
                    person's name — and there is no way back once the code is burned. */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: "10px",
                  padding: "20px", borderRadius: "12px", backgroundColor: "var(--gray-50)",
                }}>
                  <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.36px" }}>{entry.name}</p>
                  <div style={{ height: "1px", backgroundColor: "var(--gray-200)" }} />
                  {entry.employeeId && detailRow(t.employeeId, entry.employeeId)}
                  {entry.department && detailRow(t.department, entry.department)}
                  {entry.projectId
                    ? detailRow(t.project, entry.projectName ?? projects.find(p => p.id === entry.projectId)?.name ?? entry.projectId)
                    : detailRow(t.scope, t.allTeams)}
                  {detailRow(t.permission, entry.permission === "admin" ? t.permAdmin : t.permOperator)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton(t.yesContinue, true, () => setStep("password"))}
                  <button
                    onClick={restart}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}
                  >
                    {t.notMe}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "password" && entry && (
            <>
              {heading(t.passwordTitle, [t.passwordSub(entry.name)])}

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
                  {passwordField(t.password, "password", password, setPassword, showPassword, () => setShowPassword(s => !s))}
                  {passwordField(t.confirmPassword, "confirm", confirmPassword, setConfirmPassword, showConfirm, () => setShowConfirm(s => !s), savePassword)}
                </div>

                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: formatBroken ? "var(--danger-400)" : "var(--gray-600)", letterSpacing: "-0.24px" }}>
                  {formatBroken && <ErrorCircleIcon />}
                  {PASSWORD_RULE_TEXT[lang]}
                </p>

                {(mismatch || serverError) && (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <ErrorCircleIcon />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.26px" }}>
                      {mismatch ? t.mismatch : serverError}
                    </span>
                  </div>
                )}

                {primaryButton(t.createAccount, canSetPassword, savePassword)}
              </div>
            </>
          )}

          {step === "done" && entry && (
            <>
              {heading(t.doneTitle, [t.doneSub(entry.name)])}
              {primaryButton(t.logIn, true, () => router.push("/login"))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
