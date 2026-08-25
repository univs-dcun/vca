"use client";

import { useState } from "react";
import { useVcaStore, type PortalPermission } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { BORDER, PANEL_SHADOW } from "./PortalShared";

function InviteUserModal({ defaultProjectId, onClose }: { defaultProjectId: string; onClose: () => void }) {
  useEscapeKey(onClose);
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const addPortalUser = useVcaStore(s => s.addPortalUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? "");
  const [permission, setPermission] = useState<PortalPermission>("operator");
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);

  const toggleProject = (id: string) =>
    setProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const submit = () => {
    if (!name.trim() || !email.trim() || !orgId) return;
    addPortalUser({ name: name.trim(), email: email.trim(), orgId, projectIds, permission, status: "invited" });
    onClose();
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a" }}>Invite User</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "60vh", overflowY: "auto" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469", display: "block", marginBottom: "6px" }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469", display: "block", marginBottom: "6px" }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@univs.ai" type="email"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469", display: "block", marginBottom: "6px" }}>Organization</label>
            <select value={orgId} onChange={e => setOrgId(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit", backgroundColor: "white" }}>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469", display: "block", marginBottom: "6px" }}>Permission level</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["admin", "operator"] as PortalPermission[]).map(perm => (
                <button key={perm} onClick={() => setPermission(perm)}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer", textTransform: "capitalize",
                    border: permission === perm ? "1px solid #5a3dfb" : BORDER,
                    backgroundColor: permission === perm ? "#f0f0ff" : "white",
                    color: permission === perm ? "#5a3dfb" : "#475469",
                    fontSize: "13px", fontWeight: 700,
                  }}>
                  {perm}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469", display: "block", marginBottom: "6px" }}>Projects</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {projects.map(p => {
                const active = projectIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleProject(p.id)}
                    style={{
                      padding: "6px 10px", borderRadius: "999px", cursor: "pointer",
                      border: active ? "1px solid #5a3dfb" : BORDER,
                      backgroundColor: active ? "#f0f0ff" : "white",
                      color: active ? "#5a3dfb" : "#475469",
                      fontSize: "12px", fontWeight: 700,
                    }}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "#475469", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!name.trim() || !email.trim()}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "#5a3dfb", color: "white", fontSize: "13px", fontWeight: 700, cursor: (name.trim() && email.trim()) ? "pointer" : "not-allowed", opacity: (name.trim() && email.trim()) ? 1 : 0.5 }}>
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "invited" }) {
  const isActive = status === "active";
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", textTransform: "capitalize",
      backgroundColor: isActive ? "#f1f5f9" : "#fef3c7",
      color: isActive ? "#16a34a" : "#ea580c",
    }}>
      {status}
    </span>
  );
}

interface PortalUsersPageProps {
  /** Scopes the table to users who have access to this project — mirrors Clerk's per-application Users tab. */
  projectId: string;
}

export default function PortalUsersPage({ projectId }: PortalUsersPageProps) {
  const portalUsers = useVcaStore(s => s.portalUsers);
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const updatePortalUserPermission = useVcaStore(s => s.updatePortalUserPermission);
  const removePortalUser = useVcaStore(s => s.removePortalUser);
  const [showInvite, setShowInvite] = useState(false);

  const orgName = (orgId: string) => organizations.find(o => o.id === orgId)?.name ?? orgId;
  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  const currentProject = projects.find(p => p.id === projectId);
  const scopedUsers = portalUsers.filter(u => u.projectIds.includes(projectId));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#0e162a" }}>Users &amp; Permissions</p>
          <p style={{ fontSize: "13px", color: "#64748a", marginTop: "4px" }}>
            {currentProject ? <>Showing users with access to <strong style={{ color: "#475469" }}>{currentProject.name}</strong>.</> : "Grant Portal (admin) or app (operator) access and scope users to projects."}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "#5a3dfb", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Invite User
        </button>
      </div>

      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1.6fr 1fr 0.8fr 40px", padding: "10px 16px", backgroundColor: "#f8fafc", borderBottom: BORDER }}>
          {["User", "Organization", "Projects", "Permission", "Status", ""].map(h => (
            <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
          ))}
        </div>
        {scopedUsers.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#94a3b8" }}>No users have access to this project yet.</p>
          </div>
        )}
        {scopedUsers.map(u => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1.6fr 1fr 0.8fr 40px", padding: "12px 16px", alignItems: "center", borderBottom: BORDER }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#0e162a" }}>{u.name}</p>
              <p style={{ fontSize: "10px", color: "#94a3b8" }}>{u.email}</p>
            </div>
            <span style={{ fontSize: "12px", color: "#475469" }}>{orgName(u.orgId)}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {u.projectIds.length === 0
                ? <span style={{ fontSize: "10px", color: "#ccd5e1" }}>—</span>
                : u.projectIds.map(pid => (
                  <span key={pid} style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "999px",
                    color: pid === projectId ? "#5a3dfb" : "#475469",
                    backgroundColor: pid === projectId ? "#f0f0ff" : "#f1f5f9",
                  }}>
                    {projectName(pid)}
                  </span>
                ))}
            </div>
            <select
              value={u.permission}
              onChange={e => updatePortalUserPermission(u.id, e.target.value as PortalPermission)}
              style={{
                width: "fit-content", padding: "5px 8px", borderRadius: "8px", border: BORDER,
                fontSize: "12px", fontWeight: 700, fontFamily: "inherit", backgroundColor: "white",
                color: u.permission === "admin" ? "#5a3dfb" : "#475469", textTransform: "capitalize", cursor: "pointer",
              }}>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
            </select>
            <StatusBadge status={u.status} />
            <button
              onClick={() => removePortalUser(u.id)}
              title="Remove user"
              style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: "4px", justifySelf: "end" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M2.91663 4.08333H11.0833M5.83329 6.41667V9.33333M8.16663 6.41667V9.33333M3.49996 4.08333L4.08329 10.9167C4.08329 11.2261 4.20621 11.5228 4.42501 11.7416C4.6438 11.9604 4.9405 12.0833 5.24996 12.0833H8.74996C9.05942 12.0833 9.35612 11.9604 9.57491 11.7416C9.79371 11.5228 9.91663 11.2261 9.91663 10.9167L10.5 4.08333M5.24996 4.08333V2.33333C5.24996 2.17862 5.31142 2.03025 5.42082 1.92085C5.53022 1.81146 5.67858 1.75 5.83329 1.75H8.16663C8.32134 1.75 8.4697 1.81146 8.5791 1.92085C8.68849 2.03025 8.74996 2.17862 8.74996 2.33333V4.08333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showInvite && <InviteUserModal defaultProjectId={projectId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
