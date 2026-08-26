"use client";

import { BORDER } from "./PortalShared";

// Drop matching image files into public/portal/gallery/ using these exact filenames — each
// card wires up automatically once the file exists. Until then the card just shows its label on
// a plain placeholder background (the <img> hides itself via onError, no broken-image icon).
const GALLERY_ITEMS: { label: string; file: string; height: number }[] = [
  { label: "VIP / watchlist detection", file: "vip-detection.jpg", height: 150 },
  { label: "Cross-camera tracking", file: "cross-camera-tracking.jpg", height: 190 },
  { label: "Vehicle recognition", file: "vehicle-recognition.jpg", height: 170 },
  { label: "Campus attendance (face recognition)", file: "campus-attendance.jpg", height: 210 },
  { label: "Blind-spot monitoring", file: "blind-spot-monitoring.jpg", height: 150 },
  { label: "Public area crowd monitoring", file: "crowd-monitoring.jpg", height: 180 },
];

function GalleryCard({ label, file, height }: { label: string; file: string; height: number }) {
  return (
    <div style={{
      backgroundColor: "white", border: BORDER, borderRadius: "14px", overflow: "hidden",
      breakInside: "avoid", marginBottom: "16px",
    }}>
      <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", textAlign: "center", padding: "10px 12px 8px" }}>{label}</p>
      <div style={{ height: `${height}px`, backgroundColor: "var(--gray-100)" }}>
        <img
          src={`/portal/gallery/${file}`}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
      </div>
    </div>
  );
}

interface PortalEmptyStateProps {
  onNewProject: () => void;
}

export default function PortalEmptyState({ onNewProject }: PortalEmptyStateProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center" }}>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", marginBottom: "12px" }}>Projects</p>
        <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--gray-900)", lineHeight: "40px" }}>
          Deploy AI Monitoring for Any Environment
        </p>
        <p style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "12px", lineHeight: "22px" }}>
          Create your first project, connect a camera stream, and start monitoring in minutes.
        </p>
        <button onClick={onNewProject}
          style={{
            display: "flex", alignItems: "center", gap: "6px", marginTop: "24px",
            padding: "12px 20px", borderRadius: "999px", border: "none",
            backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer",
          }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
          New Project
        </button>
      </div>

      <div style={{ columnCount: 2, columnGap: "16px" }}>
        {GALLERY_ITEMS.map(item => <GalleryCard key={item.file} {...item} />)}
      </div>
    </div>
  );
}
