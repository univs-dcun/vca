"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { sgtDateKey } from "@/lib/time";
import { BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";
import type { DetailTab } from "./ProjectSidebar";
import ProjectCamerasTab from "./ProjectCamerasTab";
import ProjectVipTab from "./ProjectVipTab";
import ProjectLicenseTab from "./ProjectLicenseTab";
import ProjectServerTab from "./ProjectServerTab";
import PortalUsersPage from "./PortalUsersPage";

function StatusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="8" r="2" fill="currentColor"/>
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8L9.8 5.6L14 6.15L11 9.1L11.75 13.3L8 11.3L4.25 13.3L5 9.1L2 6.15L6.2 5.6L8 1.8Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L9.3 6.7L14 8L9.3 9.3L8 14L6.7 9.3L2 8L6.7 6.7L8 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.5" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 6.5H14M5 2V4.5M11 2V4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 14S13 9.5 13 6A5 5 0 1 0 3 6C3 9.5 8 14 8 14Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5.3 8.2L7.2 10.1L10.7 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8L14.6 13.4H1.4L8 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="8" cy="11.5" r="0.9" fill="currentColor"/>
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5.25 2.9L9.63 7L5.25 11.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const TREND_DAYS = 14;
const TREND_HEIGHT = 140;

function dayLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function DetectionTrendChart({ daily }: { daily: { date: string; count: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const yMax = Math.max(2, Math.ceil(Math.max(...daily.map(d => d.count), 1) * 1.2));
  const yForCount = (count: number) => TREND_HEIGHT - (count / yMax) * TREND_HEIGHT;
  const xForIndex = (i: number) => (daily.length > 1 ? (i / (daily.length - 1)) * width : 0);
  const points = daily.map((d, i) => ({ x: xForIndex(i), y: yForCount(d.count) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const areaPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x},${TREND_HEIGHT} L ${points[0].x},${TREND_HEIGHT} Z` : "";
  const yTicks = [0, 0.5, 1].map(f => Math.round(yMax * f));

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${TREND_HEIGHT}px`, paddingBottom: "1px" }}>
        {[...yTicks].reverse().map((tick, i) => (
          <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", lineHeight: 1 }}>{tick}</span>
        ))}
      </div>
      <div ref={containerRef} style={{ flex: 1, minWidth: 0 }}>
        <svg viewBox={`0 0 ${width} ${TREND_HEIGHT}`} width="100%" height={TREND_HEIGHT} style={{ overflow: "visible", display: "block" }}>
          <defs>
            <linearGradient id="portalTrendWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-400)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--primary-400)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((tick, i) => (
            <line key={i} x1={0} y1={yForCount(tick)} x2={width} y2={yForCount(tick)} stroke="var(--gray-200)" strokeWidth={1} />
          ))}
          <path d={areaPath} fill="url(#portalTrendWash)" />
          <path d={linePath} fill="none" stroke="var(--primary-400)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--primary-400)" />
          ))}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
          {daily.map((d, i) => (
            <span key={d.date} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", visibility: i % 3 === 0 ? "visible" : "hidden" }}>
              {dayLabel(d.date)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface PortalProjectDetailPageProps {
  projectId: string;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
}

export default function PortalProjectDetailPage({ projectId, tab, onTabChange }: PortalProjectDetailPageProps) {
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const cameras = useVcaStore(s => s.cameras);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const persons = useVcaStore(s => s.persons);
  const events = useVcaStore(s => s.events);

  // Every hook has to run before the "project not found" guard below. They used to sit after it,
  // so a render where the project is missing called seven fewer hooks than a render where it
  // exists — and React does not tolerate that: navigating from a real project to a deleted or
  // not-yet-loaded one throws "Rendered fewer hooks than expected" and takes the page down. None
  // of these depend on `project`, only on projectId/cameras/events, so hoisting them costs
  // nothing but the reordering.
  const projectCameras = useMemo(
    () => cameras.filter(c => c.projectId === projectId),
    [cameras, projectId]
  );
  const projectCameraIds = useMemo(() => new Set(projectCameras.map(c => c.id)), [projectCameras]);
  const vipEvents = useMemo(
    () => events.filter(e => projectCameraIds.has(e.cameraId) && e.personType === "VIP"),
    [events, projectCameraIds]
  );
  const dailyCounts = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.set(sgtDateKey(d), 0);
    }
    vipEvents.forEach(e => {
      const key = sgtDateKey(new Date(e.timestamp));
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
  }, [vipEvents]);
  // Read after mount, not during render: the clock is not a pure input, and license expiry is
  // the only thing here that needs it — same pattern ProjectLicenseTab uses. Reads as not-expired
  // for the first frame, then corrects itself once mounted (no server/client mismatch).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
  const zoneBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    projectCameras.forEach(c => { if (c.zone) counts.set(c.zone, (counts.get(c.zone) ?? 0) + 1); });
    return Array.from(counts.entries()).map(([zone, count]) => ({ label: zone, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [projectCameras]);
  const makerBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    projectCameras.forEach(c => { const m = c.maker ?? "Unspecified"; counts.set(m, (counts.get(m) ?? 0) + 1); });
    return Array.from(counts.entries()).map(([maker, count]) => ({ label: maker, count })).sort((a, b) => b.count - a.count);
  }, [projectCameras]);

  const project = projects.find(p => p.id === projectId);
  if (!project) {
    return <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>Project not found.</p>;
  }

  const meta = TYPE_META[project.type];
  const orgName = organizations.find(o => o.id === project.orgId)?.name ?? project.orgId;
  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  const offlineCount = projectCameras.length - onlineCount;
  const projectUsers = portalUsers.filter(u => u.projectIds.includes(projectId));
  const userCount = projectUsers.length;
  const pendingInviteCount = projectUsers.filter(u => u.status === "invited").length;
  const suspendedUserCount = projectUsers.filter(u => u.status === "suspended").length;
  const vipCount = persons.filter(p => p.projectId === projectId).length;
  const zoneCount = new Set(projectCameras.map(c => c.zone).filter(Boolean)).size;
  const aiEngineCount = new Set(projectCameras.flatMap(c => c.aiFeatures ?? [])).size;

  const totalDetections = dailyCounts.reduce((sum, d) => sum + d.count, 0);
  const uniqueVipsDetected = new Set(vipEvents.map(e => e.personName)).size;
  const peakDay = dailyCounts.reduce((max, d) => (d.count > max.count ? d : max), dailyCounts[0] ?? { date: "", count: 0 });

  const daysUntilExpiry = project.licenseExpiresAt && nowMs !== null
    ? Math.ceil((new Date(project.licenseExpiresAt).getTime() - nowMs) / (24 * 60 * 60 * 1000))
    : null;
  const licenseExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const licenseExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  const overChannelLimit = !!project.licenseChannelLimit && projectCameras.length > project.licenseChannelLimit;

  // What a project manager actually needs to act on, surfaced above everything else — see the
  // "20-year PM" discussion this was built from: exception-based, not buried under analytics.
  const attentionItems: { message: string; severity: "danger" | "warning"; onClick: () => void }[] = [];
  if (offlineCount > 0) {
    attentionItems.push({ message: `${offlineCount} camera${offlineCount > 1 ? "s" : ""} offline`, severity: "danger", onClick: () => onTabChange("cameras") });
  }
  if (overChannelLimit) {
    attentionItems.push({ message: `Over camera channel limit (${projectCameras.length} / ${project.licenseChannelLimit})`, severity: "danger", onClick: () => onTabChange("license") });
  }
  if (licenseExpired) {
    attentionItems.push({ message: `License expired ${project.licenseExpiresAt}`, severity: "danger", onClick: () => onTabChange("license") });
  } else if (licenseExpiringSoon) {
    attentionItems.push({ message: `License expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`, severity: "warning", onClick: () => onTabChange("license") });
  }
  if (pendingInviteCount > 0) {
    attentionItems.push({ message: `${pendingInviteCount} user invite${pendingInviteCount > 1 ? "s" : ""} pending`, severity: "warning", onClick: () => onTabChange("users") });
  }
  if (suspendedUserCount > 0) {
    attentionItems.push({ message: `${suspendedUserCount} user${suspendedUserCount > 1 ? "s" : ""} suspended`, severity: "warning", onClick: () => onTabChange("users") });
  }

  const maxBreakdownCount = Math.max(1, ...zoneBreakdown.map(z => z.count), ...makerBreakdown.map(m => m.count));

  const INFO_CARDS: { label: string; value: string; icon: () => React.ReactElement; color: string; onClick?: () => void }[] = [
    { label: "STATUS", value: offlineCount === 0 ? "All Cameras Live" : `${offlineCount} Offline`, icon: StatusIcon, color: offlineCount === 0 ? "var(--success-400)" : "var(--danger-400)" },
    { label: "PLAN", value: project.licensePlan ?? "Not set", icon: TagIcon, color: "var(--gray-500)", onClick: () => onTabChange("license") },
    { label: "CHANNELS", value: `${projectCameras.length} / ${project.licenseChannelLimit ?? "∞"}`, icon: GridIcon, color: "var(--gray-500)" },
    { label: "AI ENGINES", value: `${aiEngineCount} Active`, icon: SparkleIcon, color: "var(--gray-500)" },
    { label: "LICENSE EXPIRES", value: project.licenseExpiresAt ?? "Not set", icon: CalendarIcon, color: "var(--gray-500)" },
    { label: "ZONES", value: `${zoneCount} Zones`, icon: PinIcon, color: "var(--gray-500)" },
  ];

  return (
    <div>
      {tab === "overview" && (
        <>
          <div style={{ marginBottom: "16px" }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: meta.color, backgroundColor: meta.bg, padding: "3px 8px", borderRadius: "999px", boxShadow: PANEL_SHADOW }}>
              {meta.label}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginTop: "8px" }}>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>{project.name}</p>
              <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace", flexShrink: 0 }}>
                {project.id}
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "2px" }}>{orgName}</p>
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "stretch" }}>
            <div style={{ width: "260px", flexShrink: 0, backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>To-do</p>
              {attentionItems.length === 0 ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{ display: "flex", color: "var(--success-400)", flexShrink: 0 }}><CheckCircleIcon /></span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>All systems operational — no action needed.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {attentionItems.map((item, i) => {
                    const color = item.severity === "danger" ? "var(--danger-400)" : "var(--warning-500)";
                    return (
                      <button
                        key={item.message}
                        onClick={item.onClick}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "8px", width: "100%", padding: "10px 6px",
                          border: "none", borderTop: i > 0 ? BORDER : "none", borderRadius: 0, backgroundColor: "transparent",
                          textAlign: "left", cursor: "pointer", font: "inherit",
                        }}
                      >
                        <span style={{ display: "flex", color, flexShrink: 0, marginTop: "1px" }}><WarningIcon /></span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)" }}>{item.message}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Total Cameras</p>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{projectCameras.length}</p>
              </div>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Online</p>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--success-400)", marginTop: "6px" }}>{onlineCount} <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-400)" }}>/ {projectCameras.length}</span></p>
              </div>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>VIPs Registered</p>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{vipCount}</p>
              </div>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Users with Access</p>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{userCount}</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px", marginBottom: "16px" }}>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "2px" }}>Detection Activity</p>
            <p style={{ fontSize: "10px", color: "var(--gray-400)", marginBottom: "16px" }}>Last {TREND_DAYS} days</p>
            <div style={{ display: "flex", gap: "24px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DetectionTrendChart daily={dailyCounts} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "140px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>TOTAL DETECTIONS</p>
                  <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "2px" }}>{totalDetections}</p>
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>UNIQUE VIPS</p>
                  <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "2px" }}>{uniqueVipsDetected}</p>
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>PEAK DAY</p>
                  <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "2px" }}>{peakDay.count} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>{peakDay.date ? dayLabel(peakDay.date) : ""}</span></p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "16px" }}>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "14px" }}>Cameras by Zone</p>
              {zoneBreakdown.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No zones set yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {zoneBreakdown.map(z => (
                    <div key={z.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "var(--gray-600)", width: "90px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.label}</span>
                      <div style={{ flex: 1, height: "6px", backgroundColor: "var(--gray-100)", borderRadius: "3px" }}>
                        <div style={{ height: "6px", width: `${(z.count / maxBreakdownCount) * 100}%`, backgroundColor: "var(--primary-400)", borderRadius: "3px" }} />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", width: "20px", textAlign: "right", flexShrink: 0 }}>{z.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "14px" }}>Cameras by Maker</p>
              {makerBreakdown.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No cameras yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {makerBreakdown.map(m => (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "var(--gray-600)", width: "90px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
                      <div style={{ flex: 1, height: "6px", backgroundColor: "var(--gray-100)", borderRadius: "3px" }}>
                        <div style={{ height: "6px", width: `${(m.count / maxBreakdownCount) * 100}%`, backgroundColor: "var(--primary-400)", borderRadius: "3px" }} />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", width: "20px", textAlign: "right", flexShrink: 0 }}>{m.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              {INFO_CARDS.map((c, i) => {
                const Icon = c.icon;
                const rightBorder = i % 3 !== 2;
                const bottomBorder = i < 3;
                const Tag = c.onClick ? "button" : "div";
                return (
                  <Tag key={c.label} onClick={c.onClick} style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px",
                    borderTop: "none", borderLeft: "none",
                    borderRight: rightBorder ? "1px solid var(--gray-300)" : "none",
                    borderBottom: bottomBorder ? "1px solid var(--gray-300)" : "none",
                    backgroundColor: "transparent", textAlign: "left", width: "100%",
                    cursor: c.onClick ? "pointer" : "default", font: "inherit",
                  }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "var(--gray-50)", color: c.color, flexShrink: 0 }}>
                      <Icon />
                    </span>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>{c.label}</p>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.value}</p>
                    </div>
                    {c.onClick && (
                      <span style={{ display: "flex", color: "var(--gray-300)", flexShrink: 0 }}>
                        <ChevronRightIcon />
                      </span>
                    )}
                  </Tag>
                );
              })}
            </div>
          </div>
        </>
      )}
      {tab === "cameras" && <ProjectCamerasTab projectId={projectId} />}
      {tab === "vip" && <ProjectVipTab projectId={projectId} />}
      {tab === "license" && <ProjectLicenseTab projectId={projectId} />}
      {tab === "server" && <ProjectServerTab projectId={projectId} />}
      {tab === "users" && <PortalUsersPage projectId={projectId} />}
    </div>
  );
}
