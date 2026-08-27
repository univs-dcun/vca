"use client";

import { useEffect, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { BORDER, PANEL_SHADOW } from "./PortalShared";

const PLANS = ["Starter", "Professional", "Enterprise"];

// Cumulative — each tier includes everything the tier before it unlocks. Mirrors how the
// legacy License Management screen grouped features under a single plan-tier checklist.
const PLAN_FEATURES: Record<string, string[]> = {
  Starter: ["Face Recognition", "License Plate Recognition"],
  Professional: ["Face Recognition", "License Plate Recognition", "Crowd Analysis", "Fire Detection"],
  Enterprise: ["Face Recognition", "License Plate Recognition", "Crowd Analysis", "Fire Detection", "RedMap City Tracking", "Advanced Crowd Behavior"],
};
const ALL_FEATURES = PLAN_FEATURES.Enterprise;

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M4 5.5V3.8a2 2 0 0 1 4 0V5.5" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.3L4.8 8.6L9.5 3.5" stroke="var(--success-400)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ProjectLicenseTab({ projectId }: { projectId: string }) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const cameras = useVcaStore(s => s.cameras);
  const updateProjectLicense = useVcaStore(s => s.updateProjectLicense);

  const [plan, setPlan] = useState(project?.licensePlan ?? "");
  const [channelLimit, setChannelLimit] = useState(project?.licenseChannelLimit?.toString() ?? "");
  const [expiresAt, setExpiresAt] = useState(project?.licenseExpiresAt ?? "");
  const [saved, setSaved] = useState(false);
  // Read after mount, not during render: the clock is not a pure input, and this is the only thing
  // here that needs it. queueMicrotask keeps the setState out of the effect body — same pattern
  // ClientLayout uses for its localStorage read. Reads as not-expired for the first frame.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  if (!project) return null;

  const cameraCount = cameras.filter(c => c.projectId === projectId).length;
  const limit = Number(channelLimit) || 0;
  const overLimit = limit > 0 && cameraCount > limit;
  const isExpired = !!expiresAt && nowMs !== null && new Date(expiresAt).getTime() < nowMs;

  const save = () => {
    updateProjectLicense(projectId, {
      licensePlan: plan || undefined,
      licenseChannelLimit: channelLimit.trim() ? Number(channelLimit) : undefined,
      licenseExpiresAt: expiresAt || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };


  return (
    <div>
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>License</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "20px" }}>Manage this project&apos;s subscription plan and camera channel allowance.</p>

      <div style={{ backgroundColor: "white", border: (overLimit || isExpired) ? "1px solid var(--danger-400)" : BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "20px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>PLAN</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{project.licensePlan ?? "—"}</p>
          </div>
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>CHANNELS USED</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: overLimit ? "var(--danger-400)" : "var(--gray-900)", marginTop: "6px" }}>
              {cameraCount}{project.licenseChannelLimit ? ` / ${project.licenseChannelLimit}` : ""}
            </p>
            {project.licenseChannelLimit ? (
              <div style={{ height: "4px", backgroundColor: "var(--gray-100)", borderRadius: "2px", marginTop: "8px" }}>
                <div style={{ height: "4px", width: `${Math.min(100, (cameraCount / project.licenseChannelLimit) * 100)}%`, backgroundColor: overLimit ? "var(--danger-400)" : "var(--primary-400)", borderRadius: "2px" }} />
              </div>
            ) : <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px" }}>No limit set</p>}
            {overLimit && <p style={{ fontSize: "10px", color: "var(--danger-400)", marginTop: "4px" }}>Over licensed limit</p>}
          </div>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>EXPIRES</p>
              {project.licenseExpiresAt && nowMs !== null && (
                <span style={{
                  fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "999px", textTransform: "uppercase",
                  backgroundColor: isExpired ? "var(--danger-100)" : "var(--success-100)",
                  color: isExpired ? "var(--danger-500)" : "var(--success-400)",
                }}>
                  {isExpired ? "Expired" : "Valid"}
                </span>
              )}
            </div>
            <p style={{ fontSize: "20px", fontWeight: 800, color: isExpired ? "var(--danger-400)" : "var(--gray-900)", marginTop: "6px" }}>{project.licenseExpiresAt ?? "—"}</p>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px", marginBottom: "20px", maxWidth: "480px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>Included Features</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {ALL_FEATURES.map(f => {
            const included = project.licensePlan ? (PLAN_FEATURES[project.licensePlan] ?? []).includes(f) : false;
            return (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: included ? "var(--success-100)" : "var(--gray-50)" }}>
                <span style={{ display: "flex", color: included ? "var(--success-400)" : "var(--gray-400)" }}>
                  {included ? <CheckIcon /> : <LockIcon />}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: included ? "var(--gray-900)" : "var(--gray-400)" }}>{f}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px", maxWidth: "480px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit", backgroundColor: "white", cursor: "pointer" }}>
            <option value="">Select a plan</option>
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Camera channel limit</label>
          <input value={channelLimit} onChange={e => setChannelLimit(e.target.value)} placeholder="e.g. 50"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Expires on</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
        </div>
        <button onClick={save}
          style={{ width: "100%", padding: "12px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          {saved ? "✓ Saved" : "Save license"}
        </button>
      </div>
    </div>
  );
}
