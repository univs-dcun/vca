"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

const CARD_BORDER = "1px solid #e2e8f0";

function UserCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10.6669 7.33333L12.0003 8.66667L14.6672 6M10.6669 14V12.6667C10.6669 11.9594 10.3859 11.2811 9.88577 10.781C9.38563 10.281 8.7073 10 8 10H3.99968C3.29238 10 2.61405 10.281 2.11391 10.781C1.61377 11.2811 1.3328 11.9594 1.3328 12.6667V14M8.66672 4.66667C8.66672 6.13943 7.47272 7.33333 5.99984 7.33333C4.52696 7.33333 3.33296 6.13943 3.33296 4.66667C3.33296 3.19391 4.52696 2 5.99984 2C7.47272 2 8.66672 3.19391 8.66672 4.66667Z" stroke="#475469" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8.22664 14.6335C10.9997 13.6668 13.3328 12.0001 13.3328 8.66667V3.99985C13.3328 3.82304 13.2626 3.65346 13.1376 3.52843C13.0125 3.40341 12.843 3.33316 12.6662 3.33316C11.333 3.33316 9.67317 2.53981 8.50662 1.51977C8.36539 1.3991 8.18575 1.3328 8 1.3328C7.81425 1.3328 7.63461 1.3991 7.49338 1.51977C6.3335 2.53314 4.667 3.33316 3.3338 3.33316C3.15701 3.33316 2.98745 3.40341 2.86244 3.52843C2.73743 3.65346 2.6672 3.82304 2.6672 3.99985V8.66667C2.6672 12.0001 5.0003 13.6668 7.78002 14.6269C7.9237 14.6804 8.08143 14.6827 8.22664 14.6335Z" stroke="#475469" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function LockIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4.08333 6.41662V4.0831C4.08333 3.30949 4.39062 2.56757 4.93761 2.02054C5.48459 1.47352 6.22645 1.1662 7 1.1662C7.77355 1.1662 8.51541 1.47352 9.06239 2.02054C9.60938 2.56757 9.91667 3.30949 9.91667 4.0831V6.41662M2.91667 6.41662H11.0833C11.7277 6.41662 12.25 6.939 12.25 7.58338V11.667C12.25 12.3114 11.7277 12.8338 11.0833 12.8338H2.91667C2.27233 12.8338 1.75 12.3114 1.75 11.667V7.58338C1.75 6.939 2.27233 6.41662 2.91667 6.41662Z" stroke="#64748A" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4.66648 12.25H9.33352M7 9.91667V12.25M2.33296 1.75H11.667C12.3114 1.75 12.8338 2.27233 12.8338 2.91667V8.75C12.8338 9.39433 12.3114 9.91667 11.667 9.91667H2.33296C1.68858 9.91667 1.1662 9.39433 1.1662 8.75V2.91667C1.1662 2.27233 1.68858 1.75 2.33296 1.75Z" stroke="#475469" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6.66667 5.33333H9.33333M8 14V8M8 5.33333V2M11.3333 10.6667H14M12.6667 8V2M12.6667 14V10.6667M2 9.33333H4.66667M3.33333 6.66667V2M3.33333 14V9.33333" stroke="#475469" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="#475469" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      {children}
    </div>
  );
}
function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {icon}
      <span style={{ fontSize: "16px", fontWeight: 700, color: "#0e162a", letterSpacing: "-0.32px" }}>{title}</span>
    </div>
  );
}
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748a", letterSpacing: "-0.24px" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", borderRadius: "8px", padding: "10px 12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#324055", letterSpacing: "-0.26px" }}>{value}</span>
        <LockIconSm />
      </div>
    </div>
  );
}
function DropdownBtn({ value }: { value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "#324055", letterSpacing: "-0.24px" }}>{value}</span>
      <ChevronDownIcon />
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar activeTab={null} onTabChange={(tab) => router.push(`/?tab=${encodeURIComponent(tab)}`)} />
      <div style={{ flex: 1, overflowY: "auto", backgroundColor: "#f8fafc", display: "flex", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "1440px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header card */}
          <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748a", letterSpacing: "-0.24px" }}>Settings</span>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>{">"}</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#5a3dfb", letterSpacing: "-0.24px" }}>My Page</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#0e162a" }}>My Page</h1>
            <p style={{ margin: "8px 0 0", fontSize: "13px", fontWeight: 600, color: "#64748a", letterSpacing: "-0.26px" }}>
              Centrally manage your admin profile, security settings, and monitoring preferences.
            </p>
          </div>

          {/* 3-column grid */}
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            {/* Profile Information */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <CardHeader icon={<UserCheckIcon />} title="Profile Information" />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a", letterSpacing: "-0.32px" }}>John Doe</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748a", letterSpacing: "-0.24px" }}>Smart City Operations Manager</span>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", borderRadius: "4px", padding: "4px 8px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#475469", letterSpacing: "-0.2px" }}>VCA-ADMIN-8821</span>
                  </div>
                </div>
                <div style={{ height: "1px", backgroundColor: "#e2e8f0", width: "100%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <ReadOnlyField label="Full Name" value="John Doe" />
                  <ReadOnlyField label="Email Address" value="johndoe@email.com" />
                  <ReadOnlyField label="Department / Team" value="Operational Control Team Alpha" />
                </div>
              </Card>
            </div>

            {/* Security & Access Control */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <CardHeader icon={<ShieldIcon />} title="Security & Access Control" />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#0e162a", letterSpacing: "0.006px" }}>PASSWORD SETTINGS</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#0e162a", letterSpacing: "-0.28px" }}>Password Change</span>
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "#475469", letterSpacing: "-0.2px" }}>Last changed 45 days ago</span>
                    </div>
                    <button
                      onClick={() => router.push("/password-setup")}
                      style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "#324055", letterSpacing: "-0.24px" }}
                    >
                      Change
                    </button>
                  </div>
                </div>
                <div style={{ height: "1px", backgroundColor: "#e2e8f0", width: "100%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <CardHeader icon={<MonitorIcon />} title="Active Login Sessions" />
                    <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "11px", color: "#d91616", textDecoration: "underline" }}>
                      Terminate All Others
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1, minWidth: 0 }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#f0f0ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <MonitorIcon />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#324055", letterSpacing: "-0.26px" }}>MacBook Pro (Chrome)</span>
                        <span style={{ fontSize: "10px", fontWeight: 600, color: "#64748a", letterSpacing: "-0.2px" }}>Singapore · 1.3521, 103.8198</span>
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e", backgroundColor: "#e1f3e7", borderRadius: "4px", padding: "2px 8px", letterSpacing: "-0.24px", flexShrink: 0 }}>
                      Active now
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* System Preferences — hidden for now, not ready to show yet
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <CardHeader icon={<SlidersIcon />} title="System Preferences" />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#324055", letterSpacing: "-0.26px" }}>Interface Language</span>
                    <DropdownBtn value="English" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#324055", letterSpacing: "-0.26px" }}>Timezone</span>
                    <DropdownBtn value="SGT (UTC+8)" />
                  </div>
                </div>
              </Card>
            </div>
            */}
          </div>
        </div>
      </div>
    </div>
  );
}
