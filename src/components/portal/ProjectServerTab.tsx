"use client";

import { useState } from "react";
import { useVcaStore, type Server, type ServerType } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { BORDER, PANEL_SHADOW, RowActionsMenu } from "./PortalShared";

const SERVER_TYPES: ServerType[] = ["AI Camera", "Normal Camera", "Face Recognition", "Image Store", "Database"];

interface ServerFormValues {
  name: string;
  ip: string;
  type: ServerType;
  specification: string;
  status: "success" | "error";
}

const EMPTY_FORM: ServerFormValues = { name: "", ip: "", type: SERVER_TYPES[0], specification: "", status: "success" };

function ServerFormModal({
  title, initial, onClose, onSubmit,
}: {
  title: string;
  initial: ServerFormValues;
  onClose: () => void;
  onSubmit: (values: ServerFormValues) => void;
}) {
  useEscapeKey(onClose);
  const [form, setForm] = useState<ServerFormValues>(initial);
  const valid = form.name.trim().length > 0 && form.ip.trim().length > 0;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Server Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. FR 2"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Server IP *</label>
            <input value={form.ip} onChange={e => setForm(f => ({ ...f, ip: e.target.value }))} placeholder="e.g. 192.168.0.36"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Server Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ServerType }))}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit", backgroundColor: "white", cursor: "pointer" }}>
                {SERVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as "success" | "error" }))}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit", backgroundColor: "white", cursor: "pointer" }}>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Specification</label>
            <input value={form.specification} onChange={e => setForm(f => ({ ...f, specification: e.target.value }))} placeholder="e.g. 8 vCPU · 32GB RAM"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => valid && onSubmit(form)} disabled={!valid}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const API_ENDPOINTS = [
  { method: "GET", path: "/v1/cameras", desc: "List cameras registered to this project." },
  { method: "GET", path: "/v1/persons", desc: "List VIP/watchlist registrations." },
  { method: "POST", path: "/v1/events", desc: "Push a detection event from an edge server." },
  { method: "GET", path: "/v1/servers", desc: "List infrastructure nodes and their health." },
];

function ApiDocumentation({ projectId }: { projectId: string }) {
  return (
    <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px", maxWidth: "640px" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>API Base URL</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", marginTop: "6px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "8px", padding: "8px 10px" }}>
        https://api.univs.ai/portal/{projectId}
      </p>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "20px", marginBottom: "10px" }}>Endpoints</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {API_ENDPOINTS.map(ep => (
          <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "var(--gray-50)" }}>
            <span style={{
              fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px", flexShrink: 0,
              backgroundColor: ep.method === "GET" ? "var(--primary-100)" : "var(--success-100)",
              color: ep.method === "GET" ? "var(--primary-400)" : "var(--success-400)",
            }}>
              {ep.method}
            </span>
            <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--gray-900)" }}>{ep.path}</span>
            <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{ep.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectServerTab({ projectId }: { projectId: string }) {
  const servers = useVcaStore(s => s.servers);
  const addServer = useVcaStore(s => s.addServer);
  const updateServer = useVcaStore(s => s.updateServer);
  const removeServer = useVcaStore(s => s.removeServer);
  const { showToast } = useToast();

  const [subTab, setSubTab] = useState<"infra" | "api">("infra");
  const [showAdd, setShowAdd] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ServerType>("ALL");

  const projectServers = servers.filter(s => s.projectId === projectId);
  const q = search.trim().toLowerCase();
  const visibleServers = projectServers.filter(s => {
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.ip.includes(q);
    const matchesType = typeFilter === "ALL" || s.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const createServer = (values: ServerFormValues) => {
    addServer({
      projectId, name: values.name.trim(), ip: values.ip.trim(),
      type: values.type, specification: values.specification.trim() || undefined, status: values.status,
    });
    setShowAdd(false);
    showToast({ variant: "success", title: "Server added", desc: values.name.trim() });
  };

  const saveEdit = (values: ServerFormValues) => {
    if (!editingServer) return;
    updateServer(editingServer.id, {
      name: values.name.trim(), ip: values.ip.trim(),
      type: values.type, specification: values.specification.trim() || undefined, status: values.status,
    });
    setEditingServer(null);
    showToast({ variant: "success", title: "Server updated", desc: values.name.trim() });
  };

  const handleDelete = (server: Server) => {
    removeServer(server.id);
    showToast({ variant: "warning", title: "Server removed", desc: server.name });
  };

  return (
    <div>
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Server &amp; API Management</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "16px" }}>Configure core infrastructure nodes and view API documentation.</p>

      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {(["infra", "api"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0 2px 10px", fontSize: "13px", fontWeight: 700,
              color: subTab === t ? "var(--primary-400)" : "var(--gray-400)",
              borderBottom: subTab === t ? "2px solid var(--primary-400)" : "2px solid transparent",
            }}>
            {t === "infra" ? "Infrastructure" : "API Documentation"}
          </button>
        ))}
      </div>

      {subTab === "api" ? <ApiDocumentation projectId={projectId} /> : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search server name or IP…"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: "10px", border: BORDER, fontSize: "12px", fontFamily: "inherit", backgroundColor: "white" }}
              />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              style={{ padding: "9px 10px", borderRadius: "10px", border: BORDER, fontSize: "12px", fontFamily: "inherit", backgroundColor: "white", color: "var(--gray-600)", cursor: "pointer" }}>
              <option value="ALL">All types</option>
              {SERVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setShowAdd(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Add server
            </button>
          </div>

          {visibleServers.length === 0 ? (
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
                {projectServers.length === 0 ? "No servers configured for this project yet." : "No servers match these filters."}
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.1fr 1.1fr 1.2fr 70px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER }}>
                {["Status", "Server Name", "Server IP", "Server Type", "Specification", ""].map(h => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
                ))}
              </div>
              {visibleServers.map(server => {
                const ok = server.status === "success";
                return (
                  <div key={server.id} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.1fr 1.1fr 1.2fr 70px", padding: "12px 16px", alignItems: "center", borderBottom: BORDER }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ok ? "var(--success-400)" : "var(--danger-400)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: ok ? "var(--success-400)" : "var(--danger-400)" }}>{ok ? "Success" : "Error"}</span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{server.name}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace" }}>{server.ip}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{server.type}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{server.specification ?? "—"}</span>
                    <RowActionsMenu actions={[
                      { label: "Edit", onClick: () => setEditingServer(server) },
                      { label: "Remove", onClick: () => handleDelete(server), danger: true },
                    ]} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <ServerFormModal title="Add server" initial={EMPTY_FORM} onClose={() => setShowAdd(false)} onSubmit={createServer} />
      )}
      {editingServer && (
        <ServerFormModal
          title="Edit server"
          initial={{
            name: editingServer.name, ip: editingServer.ip, type: editingServer.type,
            specification: editingServer.specification ?? "", status: editingServer.status,
          }}
          onClose={() => setEditingServer(null)}
          onSubmit={saveEdit}
        />
      )}
    </div>
  );
}
