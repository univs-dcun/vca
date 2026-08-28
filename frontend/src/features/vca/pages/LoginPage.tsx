
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { PersonFieldIcon, LockFieldIcon, EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { useVcaStore } from "@/lib/vcaStore";
import { authLogin } from "../../../lib/vca-bridge/auth";

const FIELD_BORDER = "1px solid var(--gray-300)";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 기획 확정(UV-48): 비밀번호 재설정은 담당자 임시 비밀번호 재발급으로 처리 예정 —
  // 셀프 재설정 흐름이 생기기 전까지 안내 문구만 띄운다
  const [forgotNotice, setForgotNotice] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  // 데이터 연결(UV-47/48): 실로그인 — 성공 시 httpOnly 세션 쿠키가 발급되고, 담당자 발급
  // 임시 비밀번호 상태(mustSetPassword)면 Set Password 화면으로, 아니면 "/"로 이동.
  // 인증 서버 미가동('unavailable')이면 기존 mock 흐름(portalUsers 이메일 분기) 폴백 —
  // 다른 화면의 라이브 우선 + mock 폴백과 같은 규칙. permission별 /portal 분기는 실로그인
  // 경로에서는 제거됨(라우트 부재, 기획 확인 대기) — mock 폴백에서만 기존 동작 유지.
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await authLogin(email.trim(), password, keepLoggedIn);
    setSubmitting(false);
    if (result.status === "ok") {
      router.push(result.user?.mustSetPassword ? "/password-setup" : "/");
      return;
    }
    if (result.status === "rejected") {
      setError(result.message);
      return;
    }
    const matchedUser = useVcaStore.getState().portalUsers.find(
      u => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    router.push(matchedUser?.permission === "admin" ? "/portal" : "/");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: "480px", maxWidth: "480px", backgroundColor: "white",
          borderRadius: "28px", padding: "36px", margin: "40px 0",
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>Log in</h1>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Welcome to VCA</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "32px", width: "100%" }}>
              {/* Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Email</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: FIELD_BORDER, borderRadius: "8px" }}>
                  <PersonFieldIcon />
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="user@email.com"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                  />
                </div>
              </div>
              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Password</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: FIELD_BORDER, borderRadius: "8px" }}>
                  <LockFieldIcon />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Please enter your password"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                  />
                  <button onClick={() => setShowPassword(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "52px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={keepLoggedIn}
                    onChange={e => setKeepLoggedIn(e.target.checked)}
                    style={{ width: "20px", height: "20px", accentColor: "var(--primary-400)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>Keep me logged in</span>
                </label>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                  <button
                    onClick={() => setForgotNotice(true)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}
                  >
                    Forgot password?
                  </button>
                  {forgotNotice && (
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.22px" }}>
                      준비 중입니다
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                {error && (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <ErrorCircleIcon />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.26px" }}>
                      {error}
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
                  {submitting ? "Logging in…" : "Log in"}
                </button>
              </div>
              <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                New organization?{" "}
                <button
                  onClick={() => router.push("/signup")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                >
                  Sign up for Portal
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
