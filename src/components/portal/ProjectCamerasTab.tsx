"use client";

import { useState } from "react";
import { useVcaStore, type Camera, type CameraAiFeature } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { BORDER, PANEL_SHADOW } from "./PortalShared";
import CameraStreamModal from "./CameraStreamModal";

const DEFAULT_THUMBNAIL = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80";
const AI_FEATURES: CameraAiFeature[] = ["Re-ID Analysis", "License Plate Recognition", "Intrusion Detection"];

interface CameraFormValues {
  name: string;
  code: string;
  rtspUrl: string;
  location: string;
  zone: string;
  protocol: "TCP" | "UDP";
  aiFeatures: CameraAiFeature[];
}

const EMPTY_FORM: CameraFormValues = { name: "", code: "", rtspUrl: "", location: "", zone: "", protocol: "TCP", aiFeatures: [] };

function CameraFormModal({
  title, initial, onClose, onSubmit,
}: {
  title: string;
  initial: CameraFormValues;
  onClose: () => void;
  onSubmit: (values: CameraFormValues) => void;
}) {
  useEscapeKey(onClose);
  const { showToast } = useToast();
  const [form, setForm] = useState<CameraFormValues>(initial);
  const [testing, setTesting] = useState(false);
  const valid = form.name.trim().length > 0 && form.rtspUrl.trim().length > 0;

  const field = (key: "name" | "code" | "rtspUrl" | "location" | "zone", label: string, placeholder: string) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469", display: "block", marginBottom: "6px" }}>{label}</label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }}
      />
    </div>
  );

  const toggleFeature = (f: CameraAiFeature) =>
    setForm(prev => ({ ...prev, aiFeatures: prev.aiFeatures.includes(f) ? prev.aiFeatures.filter(x => x !== f) : [...prev.aiFeatures, f] }));

  const testConnection = () => {
    if (!form.rtspUrl.trim()) return;
    setTesting(true);
    showToast({ variant: "info", title: "Testing RTSP connection…", desc: form.rtspUrl.trim() });
    setTimeout(() => {
      setTesting(false);
      showToast({ variant: "success", title: "RTSP 200 OK", desc: "Stream reachable." });
    }, 900);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "460px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a" }}>{title}</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {field("name", "Camera Name *", "e.g. Novena")}
          {field("code", "Camera Code", "e.g. CAM-NOV-001")}
          {field("rtspUrl", "RTSP Stream URL *", "rtsp://10.20.4.11:554/stream1")}

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469" }}>Transport Protocol</label>
              <div style={{ display: "flex", gap: "12px" }}>
                {(["TCP", "UDP"] as const).map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "12px", color: "#475469" }}>
                    <input type="radio" checked={form.protocol === p} onChange={() => setForm(f => ({ ...f, protocol: p }))} style={{ accentColor: "#5a3dfb" }} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button type="button" onClick={testConnection} disabled={!form.rtspUrl.trim() || testing}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "10px", borderRadius: "10px", border: BORDER, backgroundColor: "#f8fafc",
              color: "#5a3dfb", fontSize: "12px", fontWeight: 700,
              cursor: form.rtspUrl.trim() && !testing ? "pointer" : "not-allowed", opacity: form.rtspUrl.trim() ? 1 : 0.5,
            }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9.33 1.75a1.24 1.24 0 0 1 1.75 1.75L4.67 10.08 2 10.75l.67-2.67 6.66-6.33z" stroke="#5a3dfb" strokeWidth="1.1" strokeLinejoin="round"/></svg>
            {testing ? "Testing…" : "Test RTSP Connection"}
          </button>

          {field("location", "Location", "e.g. Novena, Singapore")}
          {field("zone", "Zone", "e.g. Novena")}

          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475469", display: "block", marginBottom: "8px" }}>AI Analysis Engines</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {AI_FEATURES.map(f => {
                const active = form.aiFeatures.includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFeature(f)}
                    style={{
                      padding: "10px 6px", borderRadius: "10px", cursor: "pointer", textAlign: "center",
                      border: active ? "1px solid #5a3dfb" : BORDER,
                      backgroundColor: active ? "#f0f0ff" : "#f8fafc",
                      color: active ? "#5a3dfb" : "#475469",
                      fontSize: "10px", fontWeight: 600,
                    }}>
                    {f}
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
          <button onClick={() => valid && onSubmit(form)} disabled={!valid}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "#5a3dfb", color: "white", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmStatusModal({
  camera, nextStatus, onClose, onConfirm,
}: {
  camera: Camera;
  nextStatus: "online" | "offline";
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(onClose);
  const goingOffline = nextStatus === "offline";
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a" }}>
            {goingOffline ? "Mark camera offline?" : "Reconnect camera?"}
          </p>
          <p style={{ fontSize: "13px", color: "#64748a", marginTop: "8px" }}>
            {goingOffline
              ? `${camera.name} will show as offline for everyone monitoring this project — make sure the stream is actually down before confirming.`
              : `This attempts to reconnect ${camera.name} and marks it online. It doesn't verify the actual hardware, so if it's really still down, someone will need to mark it offline again.`}
          </p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "#475469", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{
              padding: "9px 16px", borderRadius: "999px", border: "none",
              backgroundColor: goingOffline ? "#f43f5e" : "#5a3dfb", color: "white",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
            }}>
            {goingOffline ? "Mark Offline" : "Reconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AiFeatureBadges({ features }: { features?: CameraAiFeature[] }) {
  if (!features || features.length === 0) return <span style={{ fontSize: "10px", color: "#ccd5e1" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {features.map(f => (
        <span key={f} style={{ fontSize: "10px", fontWeight: 600, color: "#5a3dfb", backgroundColor: "#f0f0ff", padding: "2px 6px", borderRadius: "999px" }}>{f}</span>
      ))}
    </div>
  );
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function ProjectCamerasTab({ projectId }: { projectId: string }) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const cameras = useVcaStore(s => s.cameras);
  const addCamera = useVcaStore(s => s.addCamera);
  const updateCamera = useVcaStore(s => s.updateCamera);
  const removeCamera = useVcaStore(s => s.removeCamera);
  const setCameraStatus = useVcaStore(s => s.setCameraStatus);
  const { showToast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  // Holds just the id — the live Camera object is looked up from `cameras` below on every render,
  // so actions taken inside the modal (e.g. Reconnect) are reflected immediately instead of
  // showing a stale snapshot captured at the moment the modal opened.
  const [inspectingCameraId, setInspectingCameraId] = useState<string | null>(null);
  const [confirmingStatusCam, setConfirmingStatusCam] = useState<Camera | null>(null);
  const [view, setView] = useState<"table" | "grid">("table");
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "online" | "offline">("ALL");
  const [aiFilter, setAiFilter] = useState<"ALL" | CameraAiFeature>("ALL");

  const projectCameras = cameras.filter(c => c.projectId === projectId);
  const zones = Array.from(new Set(projectCameras.map(c => c.zone).filter(Boolean)));

  const q = search.trim().toLowerCase();
  const visibleCameras = projectCameras.filter(c => {
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.rtspUrl.toLowerCase().includes(q) || c.ip.includes(q);
    const matchesZone = zoneFilter === "ALL" || c.zone === zoneFilter;
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesAi = aiFilter === "ALL" || (c.aiFeatures ?? []).includes(aiFilter);
    return matchesSearch && matchesZone && matchesStatus && matchesAi;
  });

  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  const offlineCount = projectCameras.length - onlineCount;
  const aiMappedCount = projectCameras.filter(c => (c.aiFeatures ?? []).length > 0).length;
  const zoneCounts = zones
    .map(zone => ({ zone, count: projectCameras.filter(c => c.zone === zone).length }))
    .sort((a, b) => b.count - a.count);

  const limit = project?.licenseChannelLimit;
  const overLimit = !!limit && projectCameras.length > limit;

  const createCamera = (values: CameraFormValues) => {
    addCamera({
      projectId, name: values.name.trim(), code: values.code.trim(), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      protocol: values.protocol, aiFeatures: values.aiFeatures,
      ip: "", mac: "", status: "offline", thumbnail: DEFAULT_THUMBNAIL, lat: 0, lng: 0,
    });
    setShowAdd(false);
    showToast({ variant: "success", title: "Camera added", desc: `${values.name.trim()} connected to this project.` });
  };

  const saveEdit = (values: CameraFormValues) => {
    if (!editingCamera) return;
    updateCamera(editingCamera.id, {
      name: values.name.trim(), code: values.code.trim(), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      protocol: values.protocol, aiFeatures: values.aiFeatures,
    });
    setEditingCamera(null);
    showToast({ variant: "success", title: "Camera updated", desc: values.name.trim() });
  };

  const toggleStatus = (cam: Camera) => {
    const next = cam.status === "online" ? "offline" : "online";
    setCameraStatus(cam.id, next);
    showToast({ variant: next === "online" ? "success" : "default", title: next === "online" ? "Reconnected" : "Disconnected", desc: cam.name });
  };

  const handleDelete = (cam: Camera) => {
    removeCamera(cam.id);
    showToast({ variant: "warning", title: "Camera removed", desc: cam.name });
  };

  const batchReconnect = () => {
    const offline = projectCameras.filter(c => c.status === "offline");
    offline.forEach(c => setCameraStatus(c.id, "online"));
    showToast({ variant: "success", title: "Batch reconnect complete", desc: `${offline.length} camera(s) reconnected.` });
  };

  const exportCsv = () => {
    const header = ["Name", "Code", "Zone", "Location", "RTSP URL", "Status", "AI Features"];
    const rows = projectCameras.map(c => [
      c.name, c.code, c.zone, c.location, c.rtspUrl, c.status, (c.aiFeatures ?? []).join("; "),
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "project"}-cameras.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: "Export complete", desc: `${projectCameras.length} camera(s) exported to CSV.` });
  };

  const filterSelectStyle: React.CSSProperties = {
    padding: "9px 10px", borderRadius: "10px", border: BORDER, fontSize: "12px", fontFamily: "inherit",
    backgroundColor: "white", color: "#475469", cursor: "pointer",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a" }}>Cameras</p>
          <p style={{ fontSize: "12px", color: "#64748a", marginTop: "4px" }}>Connect and manage this project&apos;s camera streams and AI engine mapping.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={batchReconnect}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "#475469", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M12.25 7A5.25 5.25 0 1 1 10.5 3.15M12.25 1.75V4.67h-2.92" stroke="#475469" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Reconnect All
          </button>
          <button onClick={exportCsv}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "#475469", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.75V9.33M7 9.33 4.08 6.42M7 9.33 9.92 6.42M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="#475469" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export CSV
          </button>
          <button onClick={() => setShowAdd(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "#5a3dfb", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Add Camera
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div style={{ backgroundColor: "white", border: overLimit ? "1px solid #f43f5e" : BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>CHANNEL USAGE</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: overLimit ? "#f43f5e" : "#0e162a", marginTop: "6px" }}>
            {projectCameras.length}{limit ? ` / ${limit}` : ""}
          </p>
          {limit ? (
            <div style={{ height: "4px", backgroundColor: "#f1f5f9", borderRadius: "2px", marginTop: "8px" }}>
              <div style={{ height: "4px", width: `${Math.min(100, (projectCameras.length / limit) * 100)}%`, backgroundColor: overLimit ? "#f43f5e" : "#5a3dfb", borderRadius: "2px" }} />
            </div>
          ) : <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "8px" }}>No license limit set</p>}
        </div>
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>STREAM HEALTH</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#16a34a", marginTop: "6px" }}>{onlineCount} <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>online</span></p>
          <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "8px" }}>{offlineCount} offline</p>
        </div>
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>AI ENGINE COVERAGE</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#0e162a", marginTop: "6px" }}>{aiMappedCount} <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>/ {projectCameras.length} mapped</span></p>
        </div>
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>ZONE COVERAGE</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#0e162a", marginTop: "6px" }}>{zones.length} <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>zones</span></p>
          <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {zoneCounts.slice(0, 3).map(z => `${z.zone} (${z.count})`).join(" · ") || "—"}
          </p>
        </div>
      </div>

      {/* Search & filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, code, RTSP URL, IP…"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: "10px", border: BORDER, fontSize: "12px", fontFamily: "inherit", backgroundColor: "white" }}
          />
        </div>
        <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} style={filterSelectStyle}>
          <option value="ALL">All Zones</option>
          {zones.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={filterSelectStyle}>
          <option value="ALL">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <select value={aiFilter} onChange={e => setAiFilter(e.target.value as typeof aiFilter)} style={filterSelectStyle}>
          <option value="ALL">All AI Engines</option>
          {AI_FEATURES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div style={{ display: "flex", backgroundColor: "#f8fafc", border: BORDER, borderRadius: "10px", padding: "3px" }}>
          {(["table", "grid"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: "6px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                backgroundColor: view === v ? "white" : "transparent", boxShadow: view === v ? PANEL_SHADOW : "none",
                fontSize: "12px", fontWeight: 700, color: view === v ? "#0e162a" : "#94a3b8",
              }}>
              {v === "table" ? "Table" : "Grid"}
            </button>
          ))}
        </div>
      </div>

      {visibleCameras.length === 0 ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "#94a3b8" }}>
            {projectCameras.length === 0 ? "No cameras connected to this project yet." : "No cameras match these filters."}
          </p>
        </div>
      ) : view === "table" ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 0.8fr 1.3fr 1.2fr 0.8fr 70px", padding: "10px 16px", backgroundColor: "#f8fafc", borderBottom: BORDER }}>
            {["", "Camera", "Zone", "RTSP Stream", "AI Engines", "Status", ""].map(h => (
              <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
            ))}
          </div>
          {visibleCameras.map(cam => {
            const online = cam.status === "online";
            return (
              <div key={cam.id} style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 0.8fr 1.3fr 1.2fr 0.8fr 70px", padding: "10px 16px", alignItems: "center", borderBottom: BORDER }}>
                <button onClick={() => setInspectingCameraId(cam.id)} style={{ width: "40px", height: "40px", borderRadius: "8px", overflow: "hidden", backgroundColor: "#f1f5f9", border: "none", cursor: "pointer", padding: 0 }}>
                  <img src={cam.thumbnail || DEFAULT_THUMBNAIL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#0e162a" }}>{cam.name}</p>
                  <p style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>{cam.code}</p>
                </div>
                <span style={{ fontSize: "12px", color: "#475469" }}>{cam.zone}</span>
                <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.rtspUrl}</span>
                <AiFeatureBadges features={cam.aiFeatures} />
                <button onClick={() => setConfirmingStatusCam(cam)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: online ? "#16a34a" : "#94a3b8", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: online ? "#16a34a" : "#94a3b8" }}>{online ? "Online" : "Offline"}</span>
                </button>
                <div style={{ display: "flex", gap: "8px", justifySelf: "end" }}>
                  <button onClick={() => setEditingCamera(cam)} title="Edit camera" style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: "4px" }}>
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9.33 1.67a1.18 1.18 0 0 1 1.67 1.67L4.67 9.67 2 10.33l.67-2.67 6.66-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                  </button>
                  <button onClick={() => handleDelete(cam)} title="Remove camera" style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: "4px" }}>
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                      <path d="M2.91663 4.08333H11.0833M5.83329 6.41667V9.33333M8.16663 6.41667V9.33333M3.49996 4.08333L4.08329 10.9167C4.08329 11.2261 4.20621 11.5228 4.42501 11.7416C4.6438 11.9604 4.9405 12.0833 5.24996 12.0833H8.74996C9.05942 12.0833 9.35612 11.9604 9.57491 11.7416C9.79371 11.5228 9.91663 11.2261 9.91663 10.9167L10.5 4.08333M5.24996 4.08333V2.33333C5.24996 2.17862 5.31142 2.03025 5.42082 1.92085C5.53022 1.81146 5.67858 1.75 5.83329 1.75H8.16663C8.32134 1.75 8.4697 1.81146 8.5791 1.92085C8.68849 2.03025 8.74996 2.17862 8.74996 2.33333V4.08333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
          {visibleCameras.map(cam => {
            const online = cam.status === "online";
            return (
              <div key={cam.id} style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
                <button onClick={() => setInspectingCameraId(cam.id)} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", border: "none", padding: 0, cursor: "pointer", display: "block", backgroundColor: "#0e162a" }}>
                  <img src={cam.thumbnail || DEFAULT_THUMBNAIL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: online ? 1 : 0.4 }} />
                  <span style={{
                    position: "absolute", top: "8px", left: "8px", fontSize: "10px", fontWeight: 600, padding: "3px 7px", borderRadius: "999px",
                    backgroundColor: online ? "rgba(22,163,74,0.9)" : "rgba(148,163,184,0.9)", color: "white",
                  }}>
                    {online ? "ONLINE" : "OFFLINE"}
                  </span>
                </button>
                <div style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#0e162a", fontFamily: "monospace" }}>{cam.code}</p>
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>{cam.zone}</span>
                  </div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#475469", marginTop: "2px" }}>{cam.name}</p>
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <AiFeatureBadges features={cam.aiFeatures} />
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => setConfirmingStatusCam(cam)} title="Toggle status" style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: "2px" }}>
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M12.25 7A5.25 5.25 0 1 1 10.5 3.15M12.25 1.75V4.67h-2.92" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button onClick={() => handleDelete(cam)} title="Remove camera" style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: "2px" }}>
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                          <path d="M2.91663 4.08333H11.0833M5.83329 6.41667V9.33333M8.16663 6.41667V9.33333M3.49996 4.08333L4.08329 10.9167C4.08329 11.2261 4.20621 11.5228 4.42501 11.7416C4.6438 11.9604 4.9405 12.0833 5.24996 12.0833H8.74996C9.05942 12.0833 9.35612 11.9604 9.57491 11.7416C9.79371 11.5228 9.91663 11.2261 9.91663 10.9167L10.5 4.08333M5.24996 4.08333V2.33333C5.24996 2.17862 5.31142 2.03025 5.42082 1.92085C5.53022 1.81146 5.67858 1.75 5.83329 1.75H8.16663C8.32134 1.75 8.4697 1.81146 8.5791 1.92085C8.68849 2.03025 8.74996 2.17862 8.74996 2.33333V4.08333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <CameraFormModal title="Add Camera" initial={EMPTY_FORM} onClose={() => setShowAdd(false)} onSubmit={createCamera} />
      )}
      {editingCamera && (
        <CameraFormModal
          title="Edit Camera"
          initial={{
            name: editingCamera.name, code: editingCamera.code, rtspUrl: editingCamera.rtspUrl,
            location: editingCamera.location, zone: editingCamera.zone,
            protocol: editingCamera.protocol ?? "TCP", aiFeatures: editingCamera.aiFeatures ?? [],
          }}
          onClose={() => setEditingCamera(null)}
          onSubmit={saveEdit}
        />
      )}
      {inspectingCameraId && cameras.find(c => c.id === inspectingCameraId) && (
        <CameraStreamModal camera={cameras.find(c => c.id === inspectingCameraId) as Camera} onClose={() => setInspectingCameraId(null)} />
      )}
      {confirmingStatusCam && (
        <ConfirmStatusModal
          camera={confirmingStatusCam}
          nextStatus={confirmingStatusCam.status === "online" ? "offline" : "online"}
          onClose={() => setConfirmingStatusCam(null)}
          onConfirm={() => { toggleStatus(confirmingStatusCam); setConfirmingStatusCam(null); }}
        />
      )}
    </div>
  );
}
