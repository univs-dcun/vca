"use client";

import { useVcaStore } from "@/lib/vcaStore";
import { BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";
import type { DetailTab } from "./ProjectSidebar";
import ProjectCamerasTab from "./ProjectCamerasTab";
import ProjectVipTab from "./ProjectVipTab";
import ProjectLicenseTab from "./ProjectLicenseTab";
import PortalUsersPage from "./PortalUsersPage";

interface PortalProjectDetailPageProps {
  projectId: string;
  tab: DetailTab;
}

export default function PortalProjectDetailPage({ projectId, tab }: PortalProjectDetailPageProps) {
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const cameras = useVcaStore(s => s.cameras);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const persons = useVcaStore(s => s.persons);

  const project = projects.find(p => p.id === projectId);
  if (!project) {
    return <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>Project not found.</p>;
  }

  const meta = TYPE_META[project.type];
  const orgName = organizations.find(o => o.id === project.orgId)?.name ?? project.orgId;
  const projectCameras = cameras.filter(c => c.projectId === projectId);
  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  const userCount = portalUsers.filter(u => u.projectIds.includes(projectId)).length;
  const vipCount = persons.filter(p => p.projectId === projectId).length;

  return (
    <div>
      {tab === "overview" && (
        <>
          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: meta.color, backgroundColor: meta.bg, padding: "3px 8px", borderRadius: "999px" }}>
              {meta.label}
            </span>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "8px" }}>{project.name}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "2px" }}>{orgName}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>TOTAL CAMERAS</p>
              <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{projectCameras.length}</p>
            </div>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>ONLINE</p>
              <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--success-400)", marginTop: "6px" }}>{onlineCount} <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-400)" }}>/ {projectCameras.length}</span></p>
            </div>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>VIPS REGISTERED</p>
              <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{vipCount}</p>
            </div>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>USERS WITH ACCESS</p>
              <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{userCount}</p>
            </div>
          </div>
        </>
      )}
      {tab === "cameras" && <ProjectCamerasTab projectId={projectId} />}
      {tab === "vip" && <ProjectVipTab projectId={projectId} />}
      {tab === "license" && <ProjectLicenseTab projectId={projectId} />}
      {tab === "users" && <PortalUsersPage projectId={projectId} />}
    </div>
  );
}
