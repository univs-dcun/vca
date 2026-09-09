
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { LockFieldIcon, EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { canEnterPortal, type PortalPermission } from "@/lib/vcaStore";
import { INVITE_TOKEN_TTL_DAYS, isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";
import { getAuthConfig } from "@/lib/authConfig";
import { useLanguage } from "@/lib/i18n";
// 데이터 연결(UV-48/51/52): 임시 비밀번호 세션의 Set Password(POST /auth/password/setup)와
// 초대 링크 활성화(POST /auth/invite/redeem) — 토큰 검증·만료·소진은 전부 서버가 판정한다
import { authRedeemInvite, authSetupPassword, fetchAuthMe } from "../../../lib/vca-bridge/auth";
// See the per-file pattern note in lib/i18n.ts.
const T = {
  en: {
    deadTitle: "This link no longer works",
    deadBody: (days: number) => `Invitation links expire after ${days} days or once used. Ask for a new one.`,
    whoToContact: "WHO TO CONTACT",
    securityTeam: "Your security operations team",
    backToLogin: "Back to log in",
    paperCodeInstead: "Given a code on paper instead?",
    activateAccount: "Activate your account",
    titleTemp: "Choose your own password",
    titleInvite: "Set your password",
    bodyTemp: "Your temporary password can’t be kept — replace it to continue.",
    bodyInvite: "Choose a password for your account.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    mismatch: "Passwords don’t match",
    submit: "Set Password",
    submitting: "Saving…",
    unavailable: "The sign-in server is not reachable. Try again in a moment.",
  },
  ko: {
    deadTitle: "더 이상 사용할 수 없는 링크입니다",
    deadBody: (days: number) => `초대 링크는 ${days}일이 지나거나 한 번 사용하면 만료됩니다. 새 링크를 요청해주세요.`,
    whoToContact: "문의할 곳",
    securityTeam: "보안 관제 담당자",
    backToLogin: "로그인으로 돌아가기",
    paperCodeInstead: "종이로 코드를 받으셨나요?",
    activateAccount: "계정 활성화하기",
    titleTemp: "직접 쓸 비밀번호를 정해주세요",
    titleInvite: "비밀번호를 설정해주세요",
    bodyTemp: "임시 비밀번호는 계속 쓸 수 없습니다. 새 비밀번호로 바꿔주세요.",
    bodyInvite: "계정에 사용할 비밀번호를 정해주세요.",
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다",
    submit: "비밀번호 설정",
    submitting: "저장 중…",
    unavailable: "인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
  },
} as const;

function fieldBorder(active: boolean) {
  return active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)";
}

export default function PasswordSetupPage() {
  return (
    <Suspense fallback={null}>
      <PasswordSetupForm />
    </Suspense>
  );
}

function PasswordSetupForm() {
  const router = useRouter();
  const [lang] = useLanguage();
  const t = T[lang];
  // 진입 경로 둘: 초대 링크(?token=, 서버가 발급한 불투명 토큰 — 검증·만료·소진 전부 서버)와,
  // 담당자 발급 임시 비밀번호로 로그인한 세션(토큰 없음 또는 ?reason=temp — UV-48 기획 확정 흐름).
  const params = useSearchParams();
  const token = params.get("token");
  const inviteMode = !!token && params.get("reason") !== "temp";
  const forcedByTempPassword = !inviteMode;
  const authConfig = getAuthConfig();
  // 초대 토큰이 무효·만료·이미 사용됨(ADM-4024)이라고 서버가 답한 뒤에만 "링크 만료" 화면 — 존재 여부를
  // 클라이언트가 추측하지 않는다
  const [linkDead, setLinkDead] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<"new" | "confirm" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // 데이터 연결(UV-48): 이 화면은 담당자 발급 임시 비밀번호로 로그인한 세션 전용 —
  // 비로그인이면 /login, 이미 본인 비밀번호가 있으면 메인으로 돌려보낸다.
  // 인증 서버 미가동이면 판정 불가 — 그대로 두고 제출 시 mock 폴백(/login 복귀)을 따른다.
  useEffect(() => {
    if (inviteMode) return;
    let cancelled = false;
    fetchAuthMe().then(res => {
      if (cancelled) return;
      if (res.status === "rejected") router.push("/login");
      else if (res.status === "ok" && !res.user?.mustSetPassword) router.push("/");
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteMode]);

  const formatValid = isPasswordFormatValid(newPassword);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  // Enabled only when the form would actually succeed — handleSubmit used to bail out silently on a
  // mismatch or a bad format, so the lit button did nothing.
  const canSubmit = formatValid && confirmPassword.length > 0 && !mismatch && !submitting;
  const formatBroken = newPassword.length > 0 && !formatValid;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    if (inviteMode) {
      // 초대 링크: 서버가 토큰을 해시로 대조하고 소진한다 — 무효/만료(ADM-4024)면 아래 "링크 만료" 화면
      const result = await authRedeemInvite(token!, newPassword);
      setSubmitting(false);
      if (result.status === "ok") { router.push("/login"); return; }
      if (result.status === "rejected") {
        if (result.code === "ADM-4024") setLinkDead(true); else setServerError(result.message);
        return;
      }
      setServerError(t.unavailable);
      return;
    }
    // 임시 비밀번호 세션: 성공 시 재로그인 없이 바로 진입 — 콘솔 역할이면 Portal, 아니면 관제 앱
    const result = await authSetupPassword(newPassword);
    setSubmitting(false);
    if (result.status === "ok") {
      const me = await fetchAuthMe();
      const u = me.status === "ok" ? me.user : undefined;
      router.push(u && canEnterPortal(u.permission as PortalPermission) ? "/portal" : "/");
      return;
    }
    if (result.status === "rejected") { setServerError(result.message); return; }
    router.push("/login");
  };

  /**
   * A link that no longer resolves — expired, already used, or mistyped. This used to bounce
   * silently to /login, which from the outside looks like a button that did nothing: the person is
   * left clicking the same mail again. It does not distinguish expired from unknown, since the way
   * out is identical and naming which one would confirm to a stranger that the account exists.
   */
  if (linkDead) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
        <AuthHeader />
        <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "200px", overflowY: "auto" }}>
          <div style={{
            width: "480px", maxWidth: "480px", backgroundColor: "white",
            borderRadius: "28px", padding: "36px",
            display: "flex", flexDirection: "column", gap: "32px", alignItems: "center",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
              <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px", textAlign: "center" }}>
                {t.deadTitle}
              </h1>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.7 }}>
                {t.deadBody(INVITE_TOKEN_TTL_DAYS)}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", padding: "20px", borderRadius: "12px", backgroundColor: "var(--gray-50)" }}>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{t.whoToContact}</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>
                {authConfig.supportContact ?? t.securityTeam}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              <button
                onClick={() => router.push("/login")}
                style={{
                  height: "48px", width: "100%", border: "none", borderRadius: "8px",
                  backgroundColor: "var(--primary-400)", color: "white",
                  fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px", cursor: "pointer",
                }}
              >
                {t.backToLogin}
              </button>
              {authConfig.registrationCode && (
                <p style={{ margin: 0, textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                  {t.paperCodeInstead}{" "}
                  <button
                    onClick={() => router.push("/register")}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                  >
                    {t.activateAccount}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "200px", overflowY: "auto" }}>
        <div style={{
          width: "480px", maxWidth: "480px", backgroundColor: "white",
          borderRadius: "28px", padding: "36px",
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>
              {forcedByTempPassword ? t.titleTemp : t.titleInvite}
            </h1>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.32px", textAlign: "center", lineHeight: 1.6 }}>
              {forcedByTempPassword
                ? t.bodyTemp
                : t.bodyInvite}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
              {/* New password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.newPassword}</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: fieldBorder(focusedField === "new"), borderRadius: "8px" }}>
                  <LockFieldIcon />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onFocus={() => setFocusedField("new")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
                  />
                  <button onClick={() => setShowNew(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showNew ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>
              {/* Confirm password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.confirmPassword}</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: fieldBorder(focusedField === "confirm"), borderRadius: "8px" }}>
                  <LockFieldIcon />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocusedField("confirm")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
                  />
                  <button onClick={() => setShowConfirm(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>
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

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                height: "48px", width: "100%", border: "none", borderRadius: "8px",
                backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-100)",
                color: canSubmit ? "white" : "var(--gray-400)",
                fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px",
                cursor: canSubmit ? "pointer" : "default",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
