"use client";

import { useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { BORDER, PANEL_SHADOW } from "./PortalShared";

const PLANS = ["Starter", "Professional", "Enterprise"];

export default function ProjectLicenseTab({ projectId }: { projectId: string }) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const cameras = useVcaStore(s => s.cameras);
  const updateProjectLicense = useVcaStore(s => s.updateProjectLicense);

  const [plan, setPlan] = useState(project?.licensePlan ?? "");
  const [channelLimit, setChannelLimit] = useState(project?.licenseChannelLimit?.toString() ?? "");
  const [expiresAt, setExpiresAt] = useState(project?.licenseExpiresAt ?? "");
  const [saved, setSaved] = useState(false);

  if (!project) return null;

  const cameraCount = cameras.filter(c => c.projectId === projectId).length;
  const limit = Number(channelLimit) || 0;
  const overLimit = limit > 0 && cameraCount > limit;

  const save = () => {
    updateProjectLicense(projectId, {
      licensePlan: plan || undefined,
      licenseChannelLimit: channelLimit.trim() ? Number(channelLimit) : undefined,
      licenseExpiresAt: expiresAt || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

  return (
    <div>
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>License</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "20px" }}>Manage this project&apos;s subscription plan and camera channel allowance.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>PLAN</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{project.licensePlan ?? "—"}</p>
        </div>
        <div style={{ backgroundColor: "white", border: overLimit ? "1px solid var(--danger-400)" : BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>CHANNELS USED</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: overLimit ? "var(--danger-400)" : "var(--gray-900)", marginTop: "6px" }}>
            {cameraCount}{project.licenseChannelLimit ? ` / ${project.licenseChannelLimit}` : ""}
          </p>
          {overLimit && <p style={{ fontSize: "10px", color: "var(--danger-400)", marginTop: "4px" }}>Over licensed limit</p>}
        </div>
        <div style={{ backgroundColor: "white", border: isExpired ? "1px solid var(--danger-400)" : BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>EXPIRES</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: isExpired ? "var(--danger-400)" : "var(--gray-900)", marginTop: "6px" }}>{project.licenseExpiresAt ?? "—"}</p>
          {isExpired && <p style={{ fontSize: "10px", color: "var(--danger-400)", marginTop: "4px" }}>Expired</p>}
        </div>
      </div>

      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px", maxWidth: "480px" }}>
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
