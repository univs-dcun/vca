import React, { useEffect, useRef, useState } from "react";
import type { MatchItem, ReIDStatus } from "@/types/reid";
import { useVcaStore, type Camera } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
// 데이터 연결(UV-38): Live Monitoring 라이브 피드(REST 시딩 + MQTT 델타) — lib/vca-bridge 소유
import { useLiveMonitoring } from "../../../lib/vca-bridge/useLiveMonitoring";
import type { TrackTargetRef } from "../../../lib/vca-bridge/trackTargetOnMap";

const BORDER = "1px solid #E2E8F0";
type DataTab = "Live Monitoring" | "Re-ID Analysis" | "Smart Search" | "RedFace";

export const MATCH_DATA: MatchItem[] = [
  { id:1, face:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=200&q=80", cam:"NC-1", time:"13:40:43", similarity:96, gender:"F", age:"28" },
  { id:2, face:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80", cam:"NC-1", time:"13:40:45", similarity:94, gender:"M", age:"35" },
  { id:3, face:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80", cam:"NC-2", time:"13:41:02", similarity:89, gender:"F", age:"24" },
  { id:4, face:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80", cam:"NC-1", time:"13:41:15", similarity:88, gender:"M", age:"42" },
  { id:5, face:"https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80", cam:"NC-3", time:"13:41:30", similarity:85, gender:"F", age:"31" },
  { id:6, face:"https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=200&q=80", cam:"NC-2", time:"13:42:01", similarity:83, gender:"M", age:"29" },
  { id:7, face:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=200&q=80", cam:"NC-4", time:"13:42:19", similarity:81, gender:"F", age:"37" },
  { id:8, face:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80", cam:"NC-1", time:"13:42:45", similarity:80, gender:"M", age:"33" },
];

const RECENT_TARGETS = [
  { face:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=200&q=80", label:"Suspect A (Female/20s)", time:"Today 13:40" },
  { face:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80", label:"Target #4012 (Male)",    time:"Today 11:15" },
  { face:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80", label:"Unidentified Trace #092",    time:"Yesterday 18:30" },
];

const TRAJECTORY = [
  { cam:"NC-1 Main Entrance",     time:"2026-07-23 13:40:43", score:96 },
  { cam:"NC-3 Central Corridor B", time:"2026-07-23 13:42:10", score:92 },
  { cam:"NC-5 South Exit",        time:"2026-07-23 13:45:01", score:84 },
];

// ── Re-ID grid data ────────────────────────────────────────────
const PHOTO_POOL = [
  "1507003211169-0a1dd7228f2d","1494790108377-be9c29b29330","1519085360753-af0119f7cbe7",
  "1534528741775-53994a69daeb","1544005313-94ddf0286df2","1531746020798-e6953c6e8e04",
  "1552374196-1ab2a1c593e8","1472099645785-5658abf4ff4e","1573497019236-17f8177b81e8",
  "1548142813-c348350df52b","1524504388940-b1c1722653e1","1529626455594-4ff0802cfb7e",
  "1487222477894-8943e31ef7b2","1578632767115-351597cf2477","1500648767791-00dcc994a43e",
  "1517841905240-472988babdf9","1506794778202-cad84cf45f1d","1438761681033-6461ffad8d80",
];
const TIMES_P = ["9:38 AM","9:38 AM","9:38 AM","12:35","12:35","8:22 AM","10:14 AM","11:03 AM"];
const BADGES_P: (number|null)[] = [null,null,7,null,null,4,null,11,null,null,null,3,null,null,8,null,null,5];
const PERSONS = Array.from({length:72},(_,i) => ({
  id: i,
  url: `https://images.unsplash.com/photo-${PHOTO_POOL[i%PHOTO_POOL.length]}?auto=format&fit=crop&w=160&q=80`,
  time: TIMES_P[i%TIMES_P.length],
  badge: BADGES_P[i%BADGES_P.length],
}));

// ── Score Badge ────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const high = score >= 90, mid = score >= 85;
  return (
    <span style={{ fontSize:"9px", fontWeight:800, fontFamily:"monospace",
      color: high?"#16a34a":mid?"#475469":"#64748a",
      backgroundColor: high?"#dcfce7":"#f1f5f9",
      padding:"2px 6px", borderRadius:"999px" }}>
      {score}%
    </span>
  );
}



// ── Person Detail Modal ────────────────────────────────────────
function DetailModal({ item, onClose, onGoRedmap, onGoAnalyzeFrame }: { item:MatchItem; onClose:()=>void; onGoRedmap?:()=>void; onGoAnalyzeFrame?:(location:string)=>void }) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, backgroundColor:"rgba(14,22,42,0.4)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"560px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"90vh", overflow:"hidden", boxShadow:"0 20px 60px rgba(14,22,42,0.18)" }}>

        {/* Header */}
        <div style={{ padding:"14px 16px", borderBottom:BORDER, backgroundColor:"#f8fafc", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"10px", height:"10px", borderRadius:"50%", backgroundColor:"#34d399", flexShrink:0 }} />
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <p style={{ fontSize:"13px", fontWeight:800, color:"#0e162a" }}>Re-ID Object #REC-{String(item.id).padStart(4,"0")}</p>
                <ScoreBadge score={item.similarity} />
              </div>
              <p style={{ fontSize:"10px", color:"#94a3b8", marginTop:"1px" }}>Movement Trace & Camera Match Timeline</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding:"4px", border:"none", background:"none", cursor:"pointer", color:"#94a3b8", display:"flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:"16px" }}>

          {/* Face/Body */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
            <div style={{ border:BORDER, borderRadius:"12px", padding:"10px", backgroundColor:"#f8fafc", display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
              <p style={{ fontSize:"9px", fontWeight:800, color:"#94a3b8", letterSpacing:"0.5px" }}>Face Detection Crop</p>
              <img src={item.face} alt="" style={{ width:"80px", height:"80px", objectFit:"cover", borderRadius:"12px", border:"2px solid #5a3dfb" }} />
            </div>
            <div style={{ border:BORDER, borderRadius:"12px", padding:"10px", backgroundColor:"#f8fafc", display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
              <p style={{ fontSize:"9px", fontWeight:800, color:"#94a3b8", letterSpacing:"0.5px" }}>Full-Body Object Crop</p>
              <img src={item.body} alt="" style={{ width:"64px", height:"96px", objectFit:"cover", borderRadius:"12px", border:"2px solid #22d3ee" }} />
            </div>
          </div>

          {/* AI attrs */}
          <div>
            <p style={{ fontSize:"11px", fontWeight:800, color:"#0e162a", marginBottom:"8px" }}>AI Attribute Classification</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px" }}>
              {([
                ["Gender/Age", item.gender==="F"?`Female | ${item.age}`:`Male | ${item.age}`, item.gender==="F"?"#ec4899":"#5a3dfb"],
                ["Top Color", "White Jacket", "#334155"],
                ["Bottom Color", "Dark Accent", "#334155"],
                ["Belongings", "Black Handbag", "#334155"],
              ] as [string,string,string][]).map(([label,val,color]) => (
                <div key={label} style={{ padding:"8px 10px", borderRadius:"10px", backgroundColor:"#f8fafc", border:BORDER }}>
                  <p style={{ fontSize:"9px", color:"#94a3b8", fontWeight:500, marginBottom:"2px" }}>{label}</p>
                  <p style={{ fontSize:"10px", fontWeight:700, color }}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Trajectory */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
              <p style={{ fontSize:"11px", fontWeight:800, color:"#0e162a" }}>Camera Detection Movement Timeline</p>
              <span style={{ fontSize:"9px", fontWeight:700, color:"#5a3dfb", backgroundColor:"#ece9ff", padding:"2px 7px", borderRadius:"999px" }}>{TRAJECTORY.length} Detections Total</span>
            </div>
            <div style={{ position:"relative", paddingLeft:"20px" }}>
              <div style={{ position:"absolute", left:"6px", top:"8px", bottom:"8px", width:"2px", backgroundColor:"#c4b5fd" }} />
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {TRAJECTORY.map((t,i) => (
                  <div key={i} style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", backgroundColor:"white", padding:"8px 12px", borderRadius:"10px", border:BORDER }}>
                    <div style={{ position:"absolute", left:"-17px", width:"10px", height:"10px", borderRadius:"50%", backgroundColor:"#5a3dfb", border:"3px solid #ece9ff" }} />
                    <div>
                      <p style={{ fontSize:"11px", fontWeight:700, color:"#0e162a" }}>{t.cam}</p>
                      <p style={{ fontSize:"9px", color:"#94a3b8", fontFamily:"monospace" }}>{t.time}</p>
                    </div>
                    <ScoreBadge score={t.score} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — Watchlist registration is a Portal(admin) function, not a VCA operator
            screen action, so it doesn't live here; Analyze Frame (same wording as Best Frame's
            own popup button) deep-links to that camera's Inspection Detail instead. */}
        <div style={{ padding:"12px 16px", borderTop:BORDER, backgroundColor:"#f8fafc", display:"flex", justifyContent:"flex-end", gap:"8px", flexShrink:0 }}>
          <button
            onClick={() => onGoAnalyzeFrame?.(item.cam)}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px", border:BORDER, backgroundColor:"white", fontSize:"11px", fontWeight:600, color:"#64748a", cursor:"pointer" }}
          >
            Analyze Frame
          </button>
          <button onClick={onGoRedmap} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px", backgroundColor:"#0e162a", border:"none", color:"white", fontSize:"11px", fontWeight:700, cursor:"pointer" }}>
            RedMap Trace
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Monitor Card (Live Monitoring landing / detail) ─────────────
function RedFaceIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M13.5609 4.32275C14.2801 5.40986 14.6649 6.68395 14.6676 7.98743C14.6703 9.2909 14.2908 10.5666 13.5761 11.6566C12.8613 12.7467 11.8427 13.6033 10.6463 14.1206C9.4498 14.6378 8.12795 14.7929 6.84424 14.5668" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.43921 11.6774C1.72001 10.59 1.33541 9.31562 1.33302 8.01191C1.33063 6.7082 1.71054 5.4324 2.42575 4.34238C3.14096 3.25236 4.16008 2.39597 5.35698 1.87917C6.55389 1.36237 7.87606 1.20786 9.15988 1.43474" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6668 4.66667C13.4032 4.66667 14.0002 4.06971 14.0002 3.33333C14.0002 2.59695 13.4032 2 12.6668 2C11.9304 2 11.3335 2.59695 11.3335 3.33333C11.3335 4.06971 11.9304 4.66667 12.6668 4.66667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 14.0002C4.06971 14.0002 4.66667 13.4032 4.66667 12.6668C4.66667 11.9304 4.06971 11.3335 3.33333 11.3335C2.59695 11.3335 2 11.9304 2 12.6668C2 13.4032 2.59695 14.0002 3.33333 14.0002Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function RedMapIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="9.5" cy="2.5" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9.5" cy="9.5" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.9 5.2L8.1 3.3M3.9 6.8L8.1 8.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function SearchIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M13.9998 13.9998L11.1064 11.1064" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ReidIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.6665 4H10.6665C11.0201 4 11.3593 4.14048 11.6093 4.39052C11.8594 4.64057 11.9998 4.97971 11.9998 5.33333V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12H5.33333C4.97971 12 4.64057 11.8595 4.39052 11.6095C4.14048 11.3594 4 11.0203 4 10.6667V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function HoverActionBtn({ label, icon, color, onClick }:
  { label:string; icon:React.ReactNode; color:string; onClick:(e:React.MouseEvent)=>void }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
      width:"108px", height:"28px", borderRadius:"999px", cursor:"pointer",
      backgroundColor:"white", border:`1.5px solid ${color}`, color,
      fontSize:"11px", fontWeight:700, letterSpacing:"-0.22px",
      boxShadow:"0 2px 6px rgba(14,22,42,0.18)",
    }}>
      {icon}{label}
    </button>
  );
}

// 데이터 연결(UV-38): 라이브 카드의 추가 필드 — mock 항목에는 없어 전부 옵셔널.
// faceCrop은 실제 얼굴 크롭(null = 얼굴 미검출 → 인셋 숨김), eventId/cameraId는 RedMap
// 대상 참조(v1.4 규칙: 카메라 targetId = 감지 eventId), label은 딥링크 Tracing 라벨.
type LiveCardExtras = { faceCrop?: string | null; eventId?: string; cameraId?: string; label?: string };
type MonitorItem = (typeof REID_DATA)[number] & LiveCardExtras;
const trackRefOf = (p: MonitorItem): TrackTargetRef | undefined =>
  p.eventId && p.cameraId ? { sourceType: "camera", sourceId: p.cameraId, targetId: p.eventId } : undefined;

function MonitorCard({ p, onClick, showCam = false, fill = false, onNavigateTab, onGoRedmap }: { p: MonitorItem; onClick: () => void; showCam?: boolean; fill?: boolean; onNavigateTab?: (tab: DataTab, card: (typeof REID_DATA)[number]) => void; onGoRedmap?: () => void }) {
  const status = REID_STATUS_STYLE[p.status];
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      position:"relative", height:"254px",
      // Capped flex-grow — absorbs the common case (a trailing row that's nearly full) without
      // letting a row with only 1-2 leftover cards balloon into an oversized full-width photo.
      ...(fill ? { flex:"1 1 136px", maxWidth:"160px" } : { width:"136px", flexShrink:0 }),
      borderRadius:"8px", overflow:"hidden", backgroundColor:"white", cursor:"pointer",
      border:"none", borderBottom:0,
      boxShadow:"0 3px 8px -2px rgba(15, 23, 42, 0.12)",
      transform:"translateZ(0)",
    }}>
      <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      <div style={{ position:"absolute", left:0, right:0, bottom:"46px", height:"72px",
        background:"linear-gradient(to top, rgba(14,22,42,0.72), rgba(14,22,42,0))", pointerEvents:"none" }} />
      {/* Only shown in the flat "All Cameras" view — grouped-by-camera carousels already
          show the camera name in their section header, so this would be a duplicate there. */}
      {showCam && (
        <div style={{ position:"absolute", top:7, left:8, fontSize:"10px", fontWeight:800, color:"white",
          backgroundColor:"rgba(14,22,42,0.7)", padding:"4px 6px", borderRadius:"12px", letterSpacing:"-0.2px" }}>
          {p.cam}
        </div>
      )}
      {p.status === "RedFace" && (
        <div style={{ position:"absolute", bottom:"52px", left:8, fontSize:"8px", fontWeight:800, color:"white",
          backgroundColor:"#ef4444", padding:"1px 5px", borderRadius:"2px", letterSpacing:"0.3px" }}>
          REDFACE
        </div>
      )}
      {hovered && (
        <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(14,22,42,0.6)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", zIndex:20 }}>
          <HoverActionBtn label="Re-ID" icon={<ReidIconSm />} color="#5a3dfb" onClick={e => { e.stopPropagation(); onNavigateTab?.("Re-ID Analysis", p); }} />
          <HoverActionBtn label="RedFace" icon={<RedFaceIconSm />} color="#f97316" onClick={e => { e.stopPropagation(); onNavigateTab?.("RedFace", p); }} />
          <HoverActionBtn label="RedMap" icon={<RedMapIconSm />} color="#16a34a" onClick={e => { e.stopPropagation(); onGoRedmap?.(); }} />
          <HoverActionBtn label="Search" icon={<SearchIconSm />} color="#0e162a" onClick={e => { e.stopPropagation(); onNavigateTab?.("Smart Search", p); }} />
        </div>
      )}
      <div style={{ position:"absolute", left:"-1px", right:"-1px", bottom:"-2px", height:"72px", backgroundColor:"white",
        border:"none", borderTop:"none", boxShadow:"none", margin:0, marginBottom:0,
        padding:"7px 11px 24px", boxSizing:"border-box", display:"flex", flexDirection:"column", gap:"2px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:"6px" }}>
          <span style={{ fontSize:"11px", fontWeight:800, color:status.text, letterSpacing:"-0.2px" }}>{p.status}</span>
          {p.status === "VIP" && p.score !== null && <span style={{ fontSize:"10px", fontWeight:600, color:"#475469" }}>{p.score}%</span>}
        </div>
        <div style={{ display:"flex", gap:"4px", fontSize:"12px", fontWeight:600, color:"#0e162a" }}>
          <span>{p.gender}</span><span>{p.age}</span>
        </div>
        <span style={{ fontSize:"10px", fontWeight:600, color:"#475469", letterSpacing:"-0.2px", marginBottom:"6px" }}>{p.time}</span>
      </div>
      {/* 데이터 연결(UV-38): 라이브 카드가 얼굴 미검출(faceCrop === null)이면 인셋 자체를 숨긴다 —
          mock 카드(faceCrop === undefined)는 기존 줌 크롭 그대로 */}
      {p.faceCrop !== null && (
      <div style={{ position:"absolute", right:"6px", bottom:"40px", width:"60px", height:"60px",
        borderRadius:"8px", overflow:"hidden", transform:"translateZ(0)",
        // Same white ring SearchResultCard's face crop always has, for the same separation from
        // the photo behind it. RedFace already gets its own dedicated "REDFACE" badge on this card
        // (below), so it doesn't need a second, redundant signal here too.
        boxShadow:"0 0 0 2px white" }}>
        {p.faceCrop ? (
          // 라이브 얼굴 크롭 (계약 v1.6 faceUrl) — 실제 크롭 이미지라 줌 보정 불필요
          <img src={p.faceCrop} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        ) : (
        // Zoomed-in crop of the same big photo's face area, not a separate unrelated image —
        // anchored a bit below the very top edge (most head-and-shoulders stock photos frame
        // the face around 15-25% down, not flush at 0%) and zoomed less aggressively than a
        // tight face-only crop so a slightly-off guess still leaves the face in frame.
        <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 20%", display:"block", transform:"scale(1.8)", transformOrigin:"50% 20%" }} />
        )}
      </div>
      )}
    </div>
  );
}

function CameraGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M13.9585 10H16.9851C17.1271 10.0001 17.2667 10.0364 17.3907 10.1056C17.5147 10.1748 17.619 10.2745 17.6936 10.3953C17.7683 10.5161 17.8108 10.654 17.8172 10.7958C17.8236 10.9377 17.7936 11.0788 17.7301 11.2058L16.0351 14.5967C15.9709 14.7252 15.8745 14.8348 15.7553 14.9151C15.6361 14.9953 15.4982 15.0434 15.355 15.0546C15.2118 15.0659 15.0681 15.0399 14.9379 14.9792C14.8076 14.9185 14.6953 14.8252 14.6118 14.7083L12.8418 12.2333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.2553 7.54373C14.4528 7.6426 14.603 7.81584 14.6728 8.02539C14.7427 8.23493 14.7265 8.46363 14.6278 8.66123L12.0394 13.8371C11.9905 13.935 11.9227 14.0223 11.84 14.094C11.7573 14.1657 11.6613 14.2204 11.5574 14.255C11.4536 14.2896 11.3439 14.3034 11.2348 14.2956C11.1256 14.2878 11.019 14.2586 10.9211 14.2096L3.0086 10.2496C2.43388 9.96007 1.99723 9.45471 1.7942 8.84407C1.59118 8.23342 1.6383 7.56722 1.92527 6.99123L3.07527 4.66623C3.21861 4.38058 3.41681 4.12597 3.65855 3.91693C3.9003 3.70788 4.18086 3.54851 4.48421 3.44791C4.78755 3.34731 5.10775 3.30746 5.4265 3.33062C5.74525 3.35378 6.05632 3.4395 6.34194 3.5829L14.2553 7.54373Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.6665 15.8333H4.79984C5.11045 15.8355 5.41548 15.7508 5.68052 15.5888C5.94556 15.4269 6.16007 15.1941 6.29984 14.9167L7.49984 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66699 17.4993V14.166" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.8335 7.5H5.84079" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
// ── Live Monitoring Landing (Figma: "Live monitoring landing") ──
function CameraStatusHoverTag({ label, color, cameras }: { label:string; color:string; cameras:Camera[] }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position:"relative", display:"inline-flex" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ color, cursor:"default" }}>{label} {cameras.length}</span>
      {hover && cameras.length > 0 && (
        <div style={{ position:"absolute", top:"calc(100% + 10px)", left:0, minWidth:"180px", zIndex:50 }}>
          {/* Pure CSS triangle (not a rotated square) — a rotated-square diamond has four
              points, and its downward-facing point showed through as a stray second arrow
              overlapping the box below it. A triangle has only the one point we want. */}
          <div style={{ position:"absolute", top:"-6px", left:"16px", width:0, height:0,
            borderLeft:"6px solid transparent", borderRight:"6px solid transparent",
            borderBottom:"6px solid rgba(0,0,0,0.75)" }} />
          <div style={{ position:"relative", backgroundColor:"rgba(0,0,0,0.75)", borderRadius:"8px", padding:"10px 12px",
            boxShadow:"0 4px 6px rgba(0,0,0,0.1)", display:"flex", flexDirection:"column", gap:"6px" }}>
            {cameras.map(cam => (
              <span key={cam.id} style={{ fontSize:"11px", fontWeight:600, color:"white", whiteSpace:"nowrap" }}>{cam.code} {cam.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Landing always shows the by-camera carousel stack — the old By Camera/All Cameras toggle was
// redundant with the camera-select dropdown inside CameraDetailView, which now offers
// "All Cameras" as one of its own options (see ALL_CAMERAS_ID) instead of a separate top-level
// switch.
// Sentinel camId meaning "no single camera — the flattened feed of every online camera."
// Lets the camera-select dropdown itself offer "All Cameras" as one of its options instead of
// a separate top-level By Camera/All Cameras toggle (the two were redundant) and a separate
// horizontal-scrolling per-camera carousel landing (removed — replaced by this one screen).
const ALL_CAMERAS_ID = "__ALL__";

// ── Camera Detail View (Figma: "Live monitoring detail") — now the ONLY Live Monitoring
// screen; the camera-select dropdown's "All Cameras" option covers what the old separate
// landing page (horizontal per-camera carousels) used to show. ───────────
function CameraDetailView({ camId, items, onSwitchCam, onCardClick, onNavigateTab, onGoRedmap }:
  { camId:string; items:MonitorItem[]; onSwitchCam:(camId:string)=>void; onCardClick:(id:number)=>void; onNavigateTab?:(tab:DataTab, card:(typeof REID_DATA)[number])=>void; onGoRedmap?:(name?:string, ref?:TrackTargetRef)=>void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const cameras = useVcaStore(s => s.cameras);
  const camera = cameras.find(c => c.code === camId);
  const isAll = camId === ALL_CAMERAS_ID;
  const pickerLabel = isAll ? "All Cameras" : camId;
  const onlineCameras = cameras.filter(c => c.status === "online");
  const offlineCameras = cameras.filter(c => c.status !== "online");

  return (
    <div className="vca-hide-scrollbar" style={{ flex:1, overflowY:"auto", padding:"20px 24px", backgroundColor:"#f8fafc" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"16px", fontSize:"12px", fontWeight:700, color:"#475469", marginBottom:"20px" }}>
        <span>Total Cameras {cameras.length}</span>
        <CameraStatusHoverTag label="Online" color="#16a34a" cameras={onlineCameras} />
        <CameraStatusHoverTag label="Offline" color="#94a3b8" cameras={offlineCameras} />
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"12px" }}>
        <div style={{ position:"relative", width:"152px" }}>
          <button onClick={() => setPickerOpen(o => !o)} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
            padding:"8px 12px", borderRadius:"8px", backgroundColor:"white", border:"1px solid #5a3dfb",
            cursor:"pointer",
          }}>
            <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"14px", fontWeight:700, color:"#5a3dfb",
              minWidth:0, overflow:"hidden" }}>
              <CameraGlyph />
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pickerLabel}</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, transform: pickerOpen?"rotate(180deg)":"none", transition:"transform 0.15s" }}>
              <path d="M4 6l4 4 4-4" stroke="#5a3dfb" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {pickerOpen && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, width:"100%", backgroundColor:"white",
              border:BORDER, borderRadius:"8px", boxShadow:"0 8px 20px rgba(14,22,42,0.12)", zIndex:10, overflow:"hidden" }}>
              <button onClick={() => { onSwitchCam(ALL_CAMERAS_ID); setPickerOpen(false); }} style={{
                display:"flex", alignItems:"center", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", cursor:"pointer",
                backgroundColor: isAll ? "#f0f0ff" : "white",
                fontSize:"13px", fontWeight: isAll ? 700:500, color: isAll ? "#5a3dfb":"#334155",
              }}>
                All Cameras
              </button>
              <div style={{ height:"1px", backgroundColor:"#e2e8f0" }} />
              {cameras.map(cam => (
                <button key={cam.id} onClick={() => { onSwitchCam(cam.code); setPickerOpen(false); }} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", cursor:"pointer",
                  backgroundColor: cam.code===camId ? "#f0f0ff" : "white",
                  fontSize:"13px", fontWeight: cam.code===camId ? 700:500, color: cam.code===camId ? "#5a3dfb":"#334155",
                }}>
                  {cam.code}
                  <span style={{ fontSize:"9px", fontWeight:800, color: cam.status==="online" ? "#16a34a" : "#94a3b8" }}>
                    {cam.status==="online" ? "ON" : "OFF"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {camera && (
          <>
            <span style={{ fontSize:"11px", fontWeight:800, color: camera.status==="online" ? "#16a34a" : "#94a3b8",
              backgroundColor: camera.status==="online" ? "#f0fdf4" : "#f1f5f9", padding:"4px 10px", borderRadius:"999px" }}>
              {camera.status==="online" ? "ONLINE" : "OFFLINE"}
            </span>
            <span style={{ fontSize:"12px", color:"#94a3b8" }}>IP {camera.ip} · RTSP Connected</span>
          </>
        )}
      </div>

      {/* flex-wrap + flex-grow (not CSS grid) — see the "All Cameras" grid above for why. */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:"12px" }}>
        {/* 데이터 연결(UV-38): RedMap 버튼에 카드의 대상 참조를 실어 보낸다 — mock 카드는 참조 없이(플레인 이동) */}
        {items.map(p => <MonitorCard key={p.id} p={p} onClick={() => onCardClick(p.id)} showCam={isAll} fill onNavigateTab={onNavigateTab} onGoRedmap={() => onGoRedmap?.(p.label, trackRefOf(p))} />)}
      </div>
    </div>
  );
}

function reidToMatchItem(p: MonitorItem): MatchItem {
  // face:p.url (not p.face) — p.face cycles through an unrelated stock-photo pool independent of
  // the person's own photo, so DetailModal's "Face Detection Crop" would show a different
  // person's face than the "Full-Body Object Crop" (body:p.url) right next to it.
  // 데이터 연결(UV-38): 라이브 카드는 실제 얼굴 크롭(faceCrop)이 있으면 그걸 쓴다.
  return { id:p.id, face:p.faceCrop ?? p.url, body:p.url, cam:p.cam, time:p.time, similarity:p.score ?? 0, gender:p.gender as "M"|"F", age:p.age, plate:p.plate };
}

const LIVE_FEED_STATUS_CYCLE: ReIDStatus[] = ["VIP","Unknown","Unknown"];

const CAPTURE_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatCapturedTime(d: Date): string {
  const mm = CAPTURE_MONTHS[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${mm} ${dd},${hh}:${mi}:${ss}`;
}
const LIVE_FEED_CAPTURE_INTERVAL_MS = 45_000;

function makeLiveItem(seed: number, camId: string, index: number): (typeof REID_DATA)[number] {
  const person = PERSONS[seed % PERSONS.length];
  const status = LIVE_FEED_STATUS_CYCLE[seed % LIVE_FEED_STATUS_CYCLE.length];
  return {
    ...person,
    id: 100000 + seed,
    // Leftmost card in the feed is the most recent capture — later positions step
    // further back in time.
    time: formatCapturedTime(new Date(Date.now() - index * LIVE_FEED_CAPTURE_INTERVAL_MS)),
    status,
    gender: REID_GENDER_CYCLE[seed % REID_GENDER_CYCLE.length],
    age: REID_AGE_CYCLE[seed % REID_AGE_CYCLE.length],
    score: status === "VIP" ? 87.8 : null,
    cam: camId,
    face: REID_FACE_POOL[seed % REID_FACE_POOL.length],
    apparel: REID_APPAREL_CYCLE[seed % REID_APPAREL_CYCLE.length],
    prop: REID_PROP_CYCLE[seed % REID_PROP_CYCLE.length],
    date: REID_DATE_CYCLE[seed % REID_DATE_CYCLE.length],
    similarity: REID_SIMILARITY_CYCLE[seed % REID_SIMILARITY_CYCLE.length],
    plate: null as string | null,
  };
}

function seedLiveFeed(): Record<string, (typeof REID_DATA)> {
  const feed: Record<string, (typeof REID_DATA)> = {};
  useVcaStore.getState().cameras.forEach((cam, camIndex) => {
    feed[cam.code] = Array.from({ length: 120 }, (_, i) => makeLiveItem(500000 + camIndex * 1000 + i, cam.code, i));
  });
  return feed;
}

// ── Live Monitoring Tab (wrapper: landing ↔ per-camera detail) ──
function LiveMonitoringTab({ onNavigateTab, onGoRedmap, onGoAnalyzeFrame }: { onNavigateTab?: (tab: DataTab, card: (typeof REID_DATA)[number]) => void; onGoRedmap?: (name?: string, ref?: TrackTargetRef) => void; onGoAnalyzeFrame?: (location: string) => void } = {}) {
  const [openCam, setOpenCam]   = useState<string>(ALL_CAMERAS_ID);
  const [detailId, setDetailId] = useState<number|null>(null);
  const [feed, setFeed]         = useState(seedLiveFeed);
  const seedRef = useRef(1);
  // 데이터 연결(UV-38): 라이브 피드 — MQTT 연결 시 아래 mock 시뮬레이션 대신 이 피드를 쓴다
  const lm = useLiveMonitoring();

  useEffect(() => {
    if (lm.live) return; // 라이브 모드 — mock 유입 정지 (실 감지 유입·addEvent는 vca-bridge가 담당)
    const interval = setInterval(() => {
      // Compute the new items first (pure), then hand setFeed a pure updater — React may
      // invoke a state updater more than once (e.g. Strict Mode), so calling addEvent (a side
      // effect on a different store) from inside one risked firing it twice per tick and
      // triggering a "setState during render" warning. addEvent runs once, after, instead.
      const newItems = useVcaStore.getState().cameras
        .filter(cam => cam.status === "online")
        .map(cam => ({ cam, item: makeLiveItem(seedRef.current++, cam.code, 0) }));

      setFeed(prev => {
        const next = { ...prev };
        newItems.forEach(({ cam, item }) => {
          next[cam.code] = [item, ...(prev[cam.code] ?? [])].slice(0, 300);
        });
        return next;
      });

      newItems.forEach(({ cam, item }) => {
        useVcaStore.getState().addEvent({
          cameraId: cam.id,
          type: item.status === "VIP" ? "VIP Match" : item.status === "RedFace" ? "RedFace Match" : "Re-ID Detection",
          severity: item.status === "RedFace" ? "critical" : item.status === "VIP" ? "warning" : "info",
          timestamp: new Date().toISOString(),
        });
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [lm.live]);

  // 데이터 연결(UV-38): 라이브면 브리지 피드(키 = 스토어 Camera.code — 라이브에서는 cameraId와 동일)
  const feedSrc: Record<string, MonitorItem[]> = lm.live ? lm.feed : feed;
  const allItems = Object.values(feedSrc).flat();
  const detailItem = detailId !== null ? allItems.find(p => p.id===detailId) ?? null : null;
  const onlineCameraCodes = useVcaStore(s => s.cameras).filter(c => c.status === "online").map(c => c.code);
  const camDetailItems = openCam === ALL_CAMERAS_ID
    ? onlineCameraCodes.flatMap(code => feedSrc[code] ?? [])
    : feedSrc[openCam] ?? [];

  return (
    <>
      <CameraDetailView camId={openCam} items={camDetailItems} onSwitchCam={setOpenCam} onCardClick={setDetailId} onNavigateTab={onNavigateTab} onGoRedmap={onGoRedmap} />
      {detailItem && <DetailModal item={reidToMatchItem(detailItem)} onClose={() => setDetailId(null)} onGoRedmap={() => onGoRedmap?.(detailItem.label, trackRefOf(detailItem))} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
    </>
  );
}

// ── Smart Search Tab ─────────────────────────────────────────────
const GENDER_CHIPS = ["Male","Female"];
const APPAREL_CHIPS = ["Trousers","Shorts","Skirts","Short Sleeve","Long Sleeve"];
const PROPS_CHIPS = ["Backpack/Bag","Hat","Wearing Glasses"];

function RefreshIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13.5 3.5v3.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Shared Date Range Picker ─────────────────────────────────────
type DateRangeValue = { start: Date | null; end: Date | null };

function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const numDays = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= numDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const QUICK_RANGES: { label: string; range: () => DateRangeValue }[] = [
  { label: "Today", range: () => { const t = new Date(); t.setHours(0,0,0,0); return { start: t, end: t }; } },
  { label: "Last 7 days", range: () => { const t = new Date(); t.setHours(0,0,0,0); const s = new Date(t); s.setDate(s.getDate() - 6); return { start: s, end: t }; } },
  { label: "This month", range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: "Last 3 months", range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth() - 3, 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: "Last 6 months", range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth() - 6, 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: "This year", range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), 0, 1), end: new Date(t.getFullYear(), 11, 31) }; } },
  { label: "All time", range: () => ({ start: null, end: null }) },
];

const WEEKDAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DateMonthCalendar({ year, month, tempStart, tempEnd, onPick, onPrev, onNext, showPrev, showNext }: {
  year: number; month: number; tempStart: Date|null; tempEnd: Date|null;
  onPick: (d: Date) => void; onPrev?: () => void; onNext?: () => void; showPrev: boolean; showNext: boolean;
}) {
  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"224px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:"24px" }}>
        <button onClick={onPrev} disabled={!showPrev} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center",
          background:"none", border:"none", cursor: showPrev ? "pointer" : "default", visibility: showPrev ? "visible" : "hidden", color:"#324055" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontSize:"13px", fontWeight:800, color:"#0e162a" }}>{monthLabel}</span>
        <button onClick={onNext} disabled={!showNext} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center",
          background:"none", border:"none", cursor: showNext ? "pointer" : "default", visibility: showNext ? "visible" : "hidden", color:"#324055" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center" }}>
        {WEEKDAY_LABELS.map(w => <span key={w} style={{ fontSize:"11px", color:"#94a3b8", height:"24px", display:"flex", alignItems:"center" }}>{w}</span>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center", rowGap:"2px" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ width:"28px", height:"28px" }} />;
          const isStart = !!tempStart && isSameDay(d, tempStart);
          const isEnd = !!tempEnd && isSameDay(d, tempEnd);
          const inRange = !!tempStart && !!tempEnd && d > tempStart && d < tempEnd;
          const today = isSameDay(d, new Date());
          return (
            <button key={i} onClick={() => onPick(d)} style={{
              width:"28px", height:"28px", borderRadius:"50%", border: today && !isStart && !isEnd ? "1px solid #5a3dfb" : "none",
              backgroundColor: isStart || isEnd ? "#5a3dfb" : inRange ? "#f0f0ff" : "transparent",
              color: isStart || isEnd ? "white" : "#0e162a",
              fontSize:"12px", fontWeight: isStart || isEnd ? 700 : 500, cursor:"pointer",
            }}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePopover({ anchorRef, value, onApply, onClose }: {
  anchorRef: React.RefObject<HTMLElement | null>; value: DateRangeValue;
  onApply: (v: DateRangeValue) => void; onClose: () => void;
}) {
  const base = value.start ?? new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [tempStart, setTempStart] = useState<Date|null>(value.start);
  const [tempEnd, setTempEnd] = useState<Date|null>(value.end);
  const [pos, setPos] = useState<{ top:number; left:number } | null>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left });
  }, [anchorRef]);

  const pick = (d: Date) => {
    if (!tempStart || tempEnd) { setTempStart(d); setTempEnd(null); }
    else if (d < tempStart) { setTempStart(d); setTempEnd(null); }
    else { setTempEnd(d); }
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); } else setViewMonth(viewMonth + 1); };
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  if (!pos) return null;

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:999 }} />
      <div style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:1000, backgroundColor:"white",
        border:BORDER, borderRadius:"12px", boxShadow:"0 8px 24px rgba(14,22,42,0.16)",
        padding:"12px", display:"flex", gap:"16px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"4px", width:"140px", borderRight:BORDER, paddingRight:"12px" }}>
          {QUICK_RANGES.map(q => (
            <button key={q.label} onClick={() => {
              const r = q.range();
              setTempStart(r.start); setTempEnd(r.end);
              if (r.start) { setViewYear(r.start.getFullYear()); setViewMonth(r.start.getMonth()); }
            }} style={{ textAlign:"left", padding:"8px", borderRadius:"8px", border:"none", backgroundColor:"transparent", cursor:"pointer",
              fontSize:"13px", color:"#0e162a", fontWeight:500 }}>
              {q.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <div style={{ display:"flex", gap:"24px" }}>
            <DateMonthCalendar year={viewYear} month={viewMonth} tempStart={tempStart} tempEnd={tempEnd} onPick={pick}
              showPrev={true} showNext={false} onPrev={prevMonth} />
            <DateMonthCalendar year={secondYear} month={secondMonth} tempStart={tempStart} tempEnd={tempEnd} onPick={pick}
              showPrev={false} showNext={true} onNext={nextMonth} />
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:"8px" }}>
            <button onClick={onClose} style={{ padding:"8px 16px", borderRadius:"8px", border:BORDER,
              backgroundColor:"white", color:"#0e162a", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>Cancel</button>
            <button onClick={() => onApply({ start: tempStart, end: tempEnd })} style={{ padding:"8px 16px", borderRadius:"8px", border:"none",
              backgroundColor:"#5a3dfb", color:"white", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>Apply</button>
          </div>
        </div>
      </div>
    </>
  );
}

function DateRangeTrigger({ value, onApply, mode = "merged", size = "md", emptyText }: {
  value: DateRangeValue; onApply: (v: DateRangeValue) => void; mode?: "split"|"merged"; size?: "md"|"sm"; emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const compact = size === "sm";
  const isEmpty = !value.start && !value.end;

  const boxStyle: React.CSSProperties = compact
    ? { flex:1, display:"flex", alignItems:"center", gap:"6px", padding:"8px", border: open ? "1px solid #8c85ff" : BORDER, borderRadius:"6px", backgroundColor:"white", cursor:"pointer" }
    : { flex:1, display:"flex", alignItems:"center", gap:"8px", padding:"12px 20px", border: open ? "1px solid #8c85ff" : "1px solid transparent", borderRadius:"8px", backgroundColor:"#f8fafc", cursor:"pointer" };
  const textStyle = (has: boolean): React.CSSProperties => ({
    fontSize: compact ? "10px" : "13px", fontWeight:600, color: has ? "#5a3dfb" : "#94a3b8",
  });

  const startLabel = value.start ? fmtDate(value.start) : "Start date";
  const endLabel = value.end ? fmtDate(value.end) : "End date";
  const toggle = () => setOpen(o => !o);

  return (
    <div ref={ref} style={{ position:"relative", display:"flex", gap:"8px", width:"100%" }}>
      {isEmpty && emptyText ? (
        <div onClick={toggle} style={{ ...boxStyle, justifyContent: mode === "merged" ? "space-between" : "flex-start" }}>
          <span style={{ display:"flex", alignItems:"center", gap: compact ? "6px" : "8px" }}>
            <CalendarIconSm />
            <span style={textStyle(false)}>{emptyText}</span>
          </span>
          {mode === "merged" && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="#475469" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      ) : mode === "split" ? (
        <>
          <div onClick={toggle} style={boxStyle}><CalendarIconSm /><span style={textStyle(!!value.start)}>{startLabel}</span></div>
          <div onClick={toggle} style={boxStyle}><CalendarIconSm /><span style={textStyle(!!value.end)}>{endLabel}</span></div>
        </>
      ) : (
        <div onClick={toggle} style={{ ...boxStyle, justifyContent:"space-between" }}>
          <span style={{ display:"flex", alignItems:"center", gap: compact ? "6px" : "8px" }}>
            <CalendarIconSm />
            <span style={textStyle(!!value.start)}>{startLabel}</span>
            <span style={{ color:"#94a3b8", fontSize: compact ? "10px" : "13px" }}>–</span>
            <span style={textStyle(!!value.end)}>{endLabel}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="#475469" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {open && <DateRangePopover anchorRef={ref} value={value} onApply={(v) => { onApply(v); setOpen(false); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

function VipQuickSelectRow({ activeVIP, onSelect, compact = false }: { activeVIP:number; onSelect:(i:number)=>void; compact?:boolean }) {
  const avatarSize = compact ? 28 : 32;
  const fontSize = compact ? "11px" : "12px";

  // A horizontal scroll (same pattern as the Recent Targets row above/beside it) instead of
  // clipping to whatever fits and stashing the rest behind a "+N" chip — every VIP stays one
  // scroll away instead of an extra click into a flyout.
  return (
    <div className="vca-hide-scrollbar" style={{ display:"flex", gap:"8px", overflowX:"auto", width:"100%" }}>
      {VIP_QUICK.map((v, i) => {
        const active = activeVIP === i;
        return (
          <button key={v.name} onClick={() => onSelect(i)} style={{
            display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px 4px 4px", borderRadius:"999px",
            backgroundColor: active ? "#f0f0ff" : "white",
            border: active ? "1px solid #5a3dfb" : "1px solid #e2e8f0", cursor:"pointer", flexShrink:0,
          }}>
            <img src={v.face} alt="" style={{ width:avatarSize, height:avatarSize, borderRadius:"50%", objectFit:"cover" }} />
            <span style={{ fontSize, fontWeight:600, color:"#0e162a", whiteSpace:"nowrap" }}>{v.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function AttrChip({ label, active, onClick, size = "md" }: { label:string; active:boolean; onClick:()=>void; size?:"md"|"sm" }) {
  const compact = size === "sm";
  return (
    <button onClick={onClick} style={{
      padding: compact ? "4px 10px" : "6px 16px", borderRadius:"100px", cursor:"pointer",
      fontSize: compact ? "10px" : "13px", whiteSpace:"nowrap",
      fontWeight: active ? 700 : 600,
      color: active ? "#5a3dfb" : "#324055",
      backgroundColor: active ? "#f0f0ff" : "white",
      border: active ? "1px solid #5a3dfb" : "1px solid #e2e8f0",
    }}>{label}</button>
  );
}

// One shape for "this is a criterion currently shaping the results below" — whether that's a
// picked target (photo + remove) or a plain attribute chip. Two different-looking chips for the
// same kind of information (what's actually driving these results) read as two different things.
function FilterChip({ children, icon, avatar, onRemove }: { children:React.ReactNode; icon?:React.ReactNode; avatar?:string; onRemove?:()=>void }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px", padding: avatar ? "4px 8px 4px 4px" : "6px 16px", borderRadius:"100px",
      backgroundColor:"#f0f0ff", border:"1px solid #5a3dfb", fontSize:"12px", fontWeight:700, color:"#5a3dfb", whiteSpace:"nowrap", flexShrink:0 }}>
      {avatar && <img src={avatar} alt="" style={{ width:22, height:22, borderRadius:"50%", objectFit:"cover" }} />}
      {icon}{children}
      {onRemove && (
        <button onClick={onRemove} style={{ background:"none", border:"none", cursor:"pointer", padding:"2px", display:"flex", color:"#5a3dfb" }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      )}
    </div>
  );
}

// Shared by Re-ID Analysis, Smart Search, and RedFace's picker — lets a search start from
// "who/what was captured on this specific camera" instead of only attribute/image matching.
function CameraSelect({ value, onChange, size = "md" }: { value:string; onChange:(v:string)=>void; size?:"md"|"sm" }) {
  const compact = size === "sm";
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width:"100%", height: compact ? "34px" : "36px", padding: compact ? "0 8px" : "0 12px",
        borderRadius:"8px", border:BORDER, backgroundColor:"white", cursor:"pointer",
        fontSize: compact ? "11px" : "13px", fontWeight:600, color: value ? "#0e162a" : "#94a3b8",
      }}
    >
      <option value="">All Cameras</option>
      {CAMERA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function SmartSearchForm({ state, onSearch }: { state: SearchFilterState; onSearch:()=>void }) {
  const {
    searchType, setSearchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP,
    threshold, setThreshold, gender, setGender, apparel, toggleApparel, props, toggleProps,
    dateRange, setDateRange, licensePlate, setLicensePlate, camera, setCamera, reset,
  } = state;
  const target = selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : activeVIP >= 0 ? VIP_QUICK[activeVIP] : null;
  const isVehicle = searchType === "VEHICLE";
  return (
    <div className="vca-hide-scrollbar" style={{ flex:1, overflowY:"auto", backgroundColor:"#f8fafc" }}>
      <div style={{ backgroundColor:"white", padding:"40px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <SmartSearchTitleIconSm />
          <span style={{ fontSize:"18px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.36px" }}>Smart Search</span>
        </div>
        <span style={{ fontSize:"13px", fontWeight:600, color:"#475469", letterSpacing:"-0.26px" }}>
          Enter images or search conditions for the target person or vehicle
        </span>
      </div>

      <div style={{ maxWidth:"1440px", margin:"0 auto", padding:"48px 24px 40px", display:"flex", flexDirection:"column", gap:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", backgroundColor:"#e2e8f0", border:"1px solid #ccd5e1", borderRadius:"12px", padding:"1px", height:"42px", width:"288px" }}>
            {(["PERSON","VEHICLE"] as const).map(t => {
              const active = searchType === t;
              return (
                <button key={t} onClick={() => setSearchType(t)} style={{
                  flex:1, borderRadius:"10px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "white" : "transparent",
                  color: active ? "#5a3dfb" : "#64748a", fontWeight: active ? 700 : 600,
                  fontSize:"13px", letterSpacing:"-0.26px",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
                }}>
                  {t === "PERSON" ? <PersonIconSm/> : <VehicleIconSm/>} {t}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:"12px" }}>
            <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 20px", height:"42px", boxSizing:"border-box",
              borderRadius:"8px", border:"1px solid #ccd5e1", backgroundColor:"white", cursor:"pointer",
              fontSize:"13px", fontWeight:700, color:"#475469" }}>
              <ResetIconSm /> Reset
            </button>
            <button onClick={onSearch} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 16px", height:"42px", boxSizing:"border-box",
              borderRadius:"8px", border:"none", backgroundColor:"#5a3dfb", cursor:"pointer",
              fontSize:"13px", fontWeight:700, color:"white" }}>
              <SearchIconSm /> {isVehicle ? "Search Vehicle" : "Search"}
            </button>
          </div>
        </div>

        {!isVehicle && (
          <div style={{ backgroundColor:"white", border:BORDER, borderRadius:"12px", padding:"24px", display:"flex", flexDirection:"column", gap:"20px" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <HistoryIconSm />
                <span style={{ fontSize:"13px", fontWeight:700, color:"#324055" }}>Recent Targets</span>
              </div>
              <div className="vca-hide-scrollbar" style={{ display:"flex", gap:"8px", overflowX:"auto" }}>
                {RECENT_TARGETS_EN.map((t, i) => (
                  <button key={i} onClick={() => selectRecentTarget(i)} style={{
                    display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"8px",
                    backgroundColor:"white",
                    border: selectedTarget === i ? "1px solid #5a3dfb" : "1px solid #e2e8f0",
                    boxShadow: selectedTarget === i ? "0 2px 2px rgba(90,61,251,0.1)" : "none",
                    cursor:"pointer", flexShrink:0,
                  }}>
                    <img src={t.face} alt="" style={{ width:"44px", height:"35px", borderRadius:"8px", objectFit:"cover" }} />
                    <div style={{ textAlign:"left" }}>
                      <p style={{ fontSize:"12px", fontWeight:600, color:"#0e162a", margin:0, whiteSpace:"nowrap" }}>{t.label}</p>
                      <p style={{ fontSize:"10px", color:"#64748a", margin:0, whiteSpace:"nowrap" }}>{t.time}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <StarIconSm />
                <span style={{ fontSize:"13px", fontWeight:700, color:"#324055" }}>VIP Quick Select</span>
              </div>
              <VipQuickSelectRow activeVIP={activeVIP} onSelect={selectVIP} />
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:"16px", alignItems:"flex-start" }}>
          <div style={{ flex:1, backgroundColor:"white", border:BORDER, borderRadius:"12px", padding:"24px", display:"flex", flexDirection:"column", gap:"20px" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              <span style={{ fontSize:"13px", fontWeight:600, color:"#324055" }}>Search Period</span>
              <DateRangeTrigger value={dateRange} onApply={setDateRange} mode="split" emptyText="Last 7 days" />
            </div>
            {isVehicle ? (
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                <span style={{ fontSize:"13px", fontWeight:600, color:"#324055" }}>License Plate</span>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", height:"42px", padding:"0 16px",
                  borderRadius:"8px", border:BORDER, backgroundColor:"#f8fafc" }}>
                  <LicensePlateIconSm />
                  <input
                    value={licensePlate}
                    onChange={e => setLicensePlate(e.target.value)}
                    placeholder="SGA 1234 X"
                    style={{ flex:1, border:"none", outline:"none", background:"none", fontFamily:"monospace", fontSize:"13px",
                      fontWeight:500, color:"#0e162a", letterSpacing:"-0.26px" }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                <span style={{ fontSize:"13px", fontWeight:600, color:"#324055" }}>Search by Image</span>
                <div style={{ display:"flex", gap:"12px", height:"179px" }}>
                  <div style={{ flex:1, borderRadius:"12px", border:"1px dashed #94a3b8", backgroundColor:"#f8fafc",
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", overflow:"hidden", position:"relative" }}>
                    {target && <img src={target.face} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.15 }} />}
                    <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                      <SmartSearchFaceIconSm />
                      <span style={{ fontSize:"13px", fontWeight:700, color:"#324055" }}>Face</span>
                    </div>
                    <span style={{ position:"relative", fontSize:"12px", color:"#94a3b8", textAlign:"center" }}>Click or drop image<br/>to upload</span>
                  </div>
                  <div style={{ flex:1, borderRadius:"12px", border:"1px dashed #94a3b8", backgroundColor:"#f8fafc",
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", overflow:"hidden", position:"relative" }}>
                    {target && <img src={target.body} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.15 }} />}
                    <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                      <SmartSearchBodyIconSm />
                      <span style={{ fontSize:"13px", fontWeight:700, color:"#324055" }}>Body</span>
                    </div>
                    <span style={{ position:"relative", fontSize:"12px", color:"#94a3b8", textAlign:"center" }}>Click or drop image<br/>to upload</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex:1, backgroundColor:"white", border:BORDER, borderRadius:"12px", padding:"24px", display:"flex", flexDirection:"column", gap:"20px" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              <span style={{ fontSize:"13px", fontWeight:600, color:"#324055" }}>Similarity</span>
              <div style={{ display:"flex", gap:"2px", backgroundColor:"#f1f5f9", borderRadius:"999px", padding:"2px", height:"36px" }}>
                {[30,50,70,90].map(v => {
                  const active = threshold === v;
                  return (
                    <button key={v} onClick={() => setThreshold(v)} style={{
                      flex:1, borderRadius:"999px", border:"none", cursor:"pointer",
                      backgroundColor: active ? "white" : "transparent",
                      color: active ? "#5a3dfb" : "#94a3b8", fontWeight: active ? 700 : 600, fontSize:"12px",
                    }}>{v}%</button>
                  );
                })}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              <span style={{ fontSize:"13px", fontWeight:600, color:"#324055" }}>Camera</span>
              <CameraSelect value={camera} onChange={setCamera} />
            </div>
            {!isVehicle && (
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                <span style={{ fontSize:"13px", fontWeight:600, color:"#475469" }}>Quick Attribute Filters</span>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                  <span style={{ fontSize:"13px", fontWeight:600, color:"#64748a", width:"46px" }}>Gender</span>
                  {GENDER_CHIPS.map(g => <AttrChip key={g} label={g} active={gender===g} onClick={() => setGender(gender===g ? "" : g)} />)}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                  <span style={{ fontSize:"13px", fontWeight:600, color:"#64748a", width:"46px" }}>Apparel</span>
                  {APPAREL_CHIPS.map(a => <AttrChip key={a} label={a} active={apparel.includes(a)} onClick={() => toggleApparel(a)} />)}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                  <span style={{ fontSize:"13px", fontWeight:600, color:"#64748a", width:"46px" }}>Props</span>
                  {PROPS_CHIPS.map(p => <AttrChip key={p} label={p} active={props.includes(p)} onClick={() => toggleProps(p)} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchResultCard({ p, onClick, matchReasons = [] }: { p: (typeof REID_DATA)[number]; onClick: () => void; matchReasons?: string[] }) {
  const status = REID_STATUS_STYLE[p.status];
  return (
    <div onClick={onClick} style={{
      position:"relative", width:"100%", height:"259px",
      borderRadius:"8px", overflow:"hidden", backgroundColor:"#0e162a", cursor:"pointer",
      transform:"translateZ(0)",
    }}>
      <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      <div style={{ position:"absolute", left:0, right:0, bottom:"64px", height:"80px",
        background:"linear-gradient(to top, rgba(14,22,42,0.72), rgba(14,22,42,0))", pointerEvents:"none" }} />
      <div style={{ position:"absolute", top:8, left:8, fontSize:"10px", fontWeight:800, color:"white",
        backgroundColor:"rgba(14,22,42,0.7)", padding:"4px 8px", borderRadius:"12px", letterSpacing:"-0.2px" }}>
        {p.cam}
      </div>
      {/* Similarity is a property of the match itself (how well this result answers the search),
          not of the identity label next to it — a precise-looking % right beside "Unknown" read as
          if there were some specific certainty about an unidentified person. Off the status line,
          onto the photo, matching the badge ClusterMatchCard/CandidateCard already use for this
          same number. */}
      <div style={{ position:"absolute", top:8, right:8, fontSize:"10px", fontWeight:800, color:"white",
        backgroundColor:"rgba(14,22,42,0.7)", padding:"4px 8px", borderRadius:"12px", letterSpacing:"-0.2px" }}>
        {p.similarity}%
      </div>
      {/* Same REDFACE badge Live Monitoring's MonitorCard uses — a search shouldn't quietly hide
          that one of its hits is already flagged. */}
      {p.status === "RedFace" && (
        <div style={{ position:"absolute", bottom:"60px", left:8, fontSize:"8px", fontWeight:800, color:"white",
          backgroundColor:"#ef4444", padding:"1px 5px", borderRadius:"2px", letterSpacing:"0.3px" }}>
          REDFACE
        </div>
      )}
      <div style={{ position:"absolute", left:"-1px", right:"-1px", bottom:"-2px", height:"66px", backgroundColor:"white",
        padding:"10px 11px 7px", boxSizing:"border-box", display:"flex", flexDirection:"column", gap:"2px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:"6px" }}>
          {p.plate
            ? <span style={{ fontSize:"12px", fontWeight:800, color:"#0e162a", fontFamily:"monospace", letterSpacing:"-0.24px" }}>{p.plate}</span>
            : <span style={{ fontSize:"12px", fontWeight:800, color:status.text, letterSpacing:"-0.24px" }}>{p.status}</span>}
          {matchReasons.length > 0 && (
            <span title={`Matched on: ${matchReasons.join(", ")}`} style={{ fontSize:"10px", fontWeight:800, color:"#16a34a", cursor:"help" }}>
              ✓{matchReasons.length}
            </span>
          )}
        </div>
        <span style={{ fontSize:"10px", color:"#94a3b8", fontFamily:"monospace" }}>2026-10-21 {p.time}</span>
      </div>
      {/* Crop of the same big photo (p.url), not p.face — that field cycles through an unrelated
          stock-photo pool, which would show a different person's face here than the body photo
          filling the rest of the card. objectPosition "top" favors the head/shoulders area. */}
      {!p.plate && <img src={p.url} alt="" style={{ position:"absolute", right:"10px", bottom:"38px", width:"56px", height:"56px",
        borderRadius:"8px", boxShadow:"0 0 0 2px white", transform:"translateZ(0)",
        objectFit:"cover", objectPosition:"top", display:"block", backgroundColor:"white" }} />}
    </div>
  );
}

function SmartSearchResults({ state, results, onCardClick, onRefine, onReset }:
  { state: SearchFilterState; results:(typeof REID_DATA); onCardClick:(id:number)=>void; onRefine:()=>void; onReset:()=>void }) {
  const { searchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP, threshold, gender, apparel, props, dateRange, licensePlate, camera } = state;
  // Captured once when results first land, not read live on every render — otherwise "as of"
  // would silently keep advancing on any unrelated re-render, making the Refresh button's job
  // (bump this to "now") indistinguishable from doing nothing.
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  // A named target (VIP Quick Select / Recent Targets) shouldn't disappear once you're looking at
  // results — otherwise there's no way to tell "who am I even looking for" without going back to
  // the form. Reuse the same toggle-off logic the picker rows use, so clearing it here is
  // identical to clicking it again in the form.
  const target = selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : activeVIP >= 0 ? VIP_QUICK[activeVIP] : null;
  const clearTarget = () => { if (selectedTarget >= 0) selectRecentTarget(selectedTarget); else if (activeVIP >= 0) selectVIP(activeVIP); };
  // What each card in the grid actually satisfied to be included — filterReidData() already hard-
  // filters on these, so every result matches all of them; surfacing that here turns the bare
  // similarity % into "matched because of X, Y, Z" instead of an unexplained number. None of this
  // applies once a target is picked, though: those results come from buildTargetResultRows (the
  // target re-appearing), which never looks at gender/apparel/props/camera/date at all — showing
  // them as if they're "active filters" on results they don't actually filter is exactly the kind
  // of disconnect between the filter bar and the results that shouldn't happen.
  const matchReasons = target ? [] : [
    ...(gender ? [gender] : []),
    ...(apparel.length ? [apparel.join("/")] : []),
    ...(props.length ? [props.join("/")] : []),
    ...(camera ? [camera] : []),
  ];
  const activeChips = target
    ? [searchType === "PERSON" ? "Person" : "Vehicle", `≥ ${threshold}% similarity`]
    : [
        searchType === "PERSON" ? "Person" : "Vehicle",
        ...(dateRange.start || dateRange.end
          ? [`${dateRange.start ? fmtDate(dateRange.start) : "…"} ~ ${dateRange.end ? fmtDate(dateRange.end) : "…"}`]
          : ["Last 7 days"]),
        ...(camera ? [camera] : []),
        ...(searchType === "VEHICLE"
          ? (licensePlate ? [licensePlate] : [])
          : [...(gender ? [gender] : []), ...apparel, ...props]),
      ];

  return (
    <div className="vca-hide-scrollbar" style={{ flex:1, overflowY:"auto", backgroundColor:"#f8fafc" }}>
      <div style={{ padding:"16px 24px", backgroundColor:"white", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <div className="vca-hide-scrollbar" style={{ display:"flex", alignItems:"center", gap:"8px", overflowX:"auto" }}>
          {target && (
            <FilterChip avatar={target.face} onRemove={clearTarget}>
              Similar to {"label" in target ? target.label : target.name}
            </FilterChip>
          )}
          {activeChips.map((c, i) => <FilterChip key={i}>{c}</FilterChip>)}
          <button onClick={onReset} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer",
            fontSize:"13px", fontWeight:600, color:"#475469", flexShrink:0, padding:"0 4px" }}>
            <ResetIconSm /> Reset Filters
          </button>
        </div>
        <button onClick={onRefine} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer",
          fontSize:"13px", fontWeight:700, color:"#0e162a", flexShrink:0 }}>
          <SlidersIconSm size={14} /> Refine search
        </button>
      </div>

      <div style={{ padding:"16px 24px 0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap:"wrap", gap:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <span style={{ fontSize:"14px", fontWeight:800, color:"#0e162a" }}>Search Results</span>
            <span style={{ fontSize:"13px", fontWeight:600, color:"#64748a" }}>{results.length} matches</span>
            <div style={{ width:"1px", height:"12px", backgroundColor:"#e2e8f0" }} />
            <span style={{ fontSize:"13px", color:"#94a3b8" }}>
              Showing targets above <span style={{ fontWeight:700, color:"#475469" }}>{threshold}%</span> Similarity
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
            <span style={{ fontSize:"12px", color:"#94a3b8" }}>Results updated as of {refreshedAt.toLocaleTimeString("en-US", { hour12:false })}</span>
            <button onClick={() => setRefreshedAt(new Date())} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, color:"#475469" }}>
              <RefreshIconSm /> Refresh
            </button>
          </div>
        </div>
        {results.length === 0 ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"64px 0", color:"#94a3b8", fontSize:"13px", fontWeight:600 }}>
            No matches for the current filters.
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(133px, 1fr))", gap:"16px", paddingBottom:"24px" }}>
            {results.map(p => <SearchResultCard key={p.id} p={p} onClick={() => onCardClick(p.id)} matchReasons={matchReasons} />)}
          </div>
        )}
      </div>
    </div>
  );
}

interface SearchFilterState {
  searchType: "PERSON"|"VEHICLE"; setSearchType:(v:"PERSON"|"VEHICLE")=>void;
  // selectedTarget/activeVIP are read-only here (for active-state styling) — selection always
  // goes through selectRecentTarget/selectVIP so the gender/apparel/props cascade and the
  // mutual-exclusivity between the two pickers stay consistent everywhere they're used.
  selectedTarget: number; selectRecentTarget:(i:number)=>void;
  activeVIP: number; selectVIP:(i:number)=>void;
  threshold: number; setThreshold:(v:number)=>void;
  gender: string; setGender:(v:string)=>void;
  apparel: string[]; toggleApparel:(v:string)=>void;
  props: string[]; toggleProps:(v:string)=>void;
  dateRange: DateRangeValue; setDateRange:(v:DateRangeValue)=>void;
  licensePlate: string; setLicensePlate:(v:string)=>void;
  camera: string; setCamera:(v:string)=>void;
  reset: () => void;
}

function SmartSearchContent({ seedCard, onSeedConsumed, onGoRedmap, onGoAnalyzeFrame }: { seedCard?: (typeof REID_DATA)[number] | null; onSeedConsumed?: () => void; onGoRedmap?: () => void; onGoAnalyzeFrame?: (location: string) => void } = {}) {
  const [searched, setSearched]         = useState(false);
  const [detailId, setDetailId]         = useState<number|null>(null);
  const [searchType, setSearchType]     = useState<"PERSON"|"VEHICLE">("PERSON");
  const [selectedTarget, setSelectedTarget] = useState(-1);
  const [activeVIP, setActiveVIP]       = useState(-1);
  const [threshold, setThreshold]       = useState(30);
  const [gender, setGender]             = useState("");
  const [apparel, setApparel]           = useState<string[]>([]);
  const [props, setProps]               = useState<string[]>([]);
  const [dateRange, setDateRange]       = useState<DateRangeValue>({ start:null, end:null });
  const [licensePlate, setLicensePlate] = useState("");
  const [camera, setCamera]             = useState("");
  // "UNSET" (not seedCard's own initial value) so the block below still fires on this
  // component's very first render even when seedCard is ALREADY set at mount time — this tab
  // mounts fresh on every deep-link (it doesn't exist until activeTab switches to it), so
  // seeding it from "the previous seedCard" would just equal the incoming one and never fire.
  const [prevSeedCard, setPrevSeedCard] = useState<typeof seedCard | "UNSET">("UNSET");

  const toggleApparel = (a: string) => setApparel(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const toggleProps   = (a: string) => setProps(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const reset = () => { setSearchType("PERSON"); setThreshold(30); setGender(""); setApparel([]); setProps([]); setSelectedTarget(-1); setActiveVIP(-1); setDateRange({ start:null, end:null }); setLicensePlate(""); setCamera(""); };

  // Deep-link from a Live Monitoring card's "Search" hover button — see ReIDContent's identical
  // block for why camera/gender/date are what get seeded.
  if (seedCard !== prevSeedCard) {
    setPrevSeedCard(seedCard);
    if (seedCard) {
      setSelectedTarget(-1); setActiveVIP(-1); setApparel([]); setProps([]); setLicensePlate("");
      setCamera(seedCard.cam);
      setGender(seedCard.gender === "M" ? "Male" : "Female");
      const day = new Date(seedCard.date);
      setDateRange({ start: day, end: day });
      setSearched(true);
    }
  }
  useEffect(() => {
    if (seedCard) onSeedConsumed?.();
  }, [seedCard, onSeedConsumed]);

  // Picking a recent target means "search for someone matching this profile" — it cascades the
  // target's gender/apparel/props onto the rest of the form, and clicking the same one again
  // releases it (clears the cascade back out). The two pickers share one image-preview slot, so
  // selecting either clears the other.
  const selectRecentTarget = (i: number) => {
    if (selectedTarget === i) { setSelectedTarget(-1); setGender(""); setApparel([]); setProps([]); return; }
    setSelectedTarget(i); setActiveVIP(-1);
    const t = RECENT_TARGETS_EN[i];
    setGender(t.gender); setApparel([t.apparel]); setProps(t.props);
  };
  const selectVIP = (i: number) => {
    if (activeVIP === i) { setActiveVIP(-1); return; }
    setActiveVIP(i); setSelectedTarget(-1);
  };

  const state: SearchFilterState = {
    searchType, setSearchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP,
    threshold, setThreshold, gender, setGender, apparel, toggleApparel, props, toggleProps,
    dateRange, setDateRange, licensePlate, setLicensePlate, camera, setCamera, reset,
  };

  // A named target means "find this specific person elsewhere" — reuse their own photo across
  // synthesized appearances instead of filterReidData, whose gender/apparel/props/date cycles are
  // independent of any given target's cascaded profile and can easily have zero real overlap for
  // a particular combination (see buildTargetResultRows).
  const searchTarget = activeVIP >= 0 ? VIP_QUICK[activeVIP] : selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : null;
  const results = searchType === "PERSON" && searchTarget
    ? buildTargetResultRows(searchTarget.face, searchTarget.body, searchTarget.gender === "Male" ? "M" : "F", 20)
        .filter(r => r.similarity >= threshold)
    : filterReidData({ searchType, gender, apparel, props, dateRange, threshold, licensePlate, camera });
  const detailItem = detailId !== null ? results.find(p => p.id===detailId) ?? null : null;

  return (
    <>
      {searched
        ? <SmartSearchResults state={state} results={results} onCardClick={setDetailId}
            onRefine={() => setSearched(false)} onReset={() => { reset(); setSearched(false); }} />
        : <SmartSearchForm state={state} onSearch={() => setSearched(true)} />
      }
      {detailItem && <DetailModal item={reidToMatchItem(detailItem)} onClose={() => setDetailId(null)} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
    </>
  );
}

// ── Re-ID Analysis Tab ─────────────────────────────────────────
const REID_STATUS_STYLE: Record<ReIDStatus, { text: string; border: string; glow?: string }> = {
  VIP:     { text:"#5a3dfb", border:"#5a3dfb" },
  Unknown: { text:"#64748a", border:"#64748a" },
  RedFace: { text:"#ef4444", border:"#ef4444", glow:"0 0 0 2px #ef4444, 0 0 10px rgba(239,68,68,0.38)" },
};

const REID_STATUS_CYCLE: ReIDStatus[] = [
  "VIP","Unknown","Unknown","Unknown","VIP","Unknown","Unknown","VIP",
  "Unknown","Unknown","RedFace","Unknown","VIP","Unknown","Unknown","Unknown","VIP","RedFace",
];
const REID_GENDER_CYCLE  = ["F","M","F","F","M","F","M","F","F","M","M","F","F","M","F","M","F","M"];
const REID_AGE_CYCLE     = ["28yo","28yo","28yo","35yo","28yo","42yo","28yo","28yo","31yo","28yo","35yo","28yo","28yo","29yo","28yo","37yo","28yo","33yo"];
const REID_SCORE_CYCLE   = [null,null,87.8,null,null,null,87.8,null,null,null,null,87.8,null,null,null,null,87.8,null];
const REID_CAM_CYCLE     = ["NC-1","NC-2","NC-3","NC-1","NC-4","NC-2","NC-1","NC-3","NC-2","NC-4","NC-1","NC-3","NC-2","NC-1","NC-4","NC-3","NC-1","NC-2"];
const CAMERA_OPTIONS     = ["NC-1", "NC-2", "NC-3", "NC-4"];
const REID_FACE_POOL     = MATCH_DATA.map(m => m.face);
// Attribute/date/similarity fields backing the Re-ID / Smart Search filter forms — added so
// Gender/Apparel/Props/Search Period/Similarity actually narrow the result set instead of the
// filters being purely cosmetic. Fixed cycles (not Math.random/Date.now) to stay deterministic
// across server render and client hydration.
const REID_APPAREL_CYCLE = APPAREL_CHIPS;
const REID_PROP_CYCLE: (string | null)[] = [null, "Backpack/Bag", null, "Hat", null, "Wearing Glasses", null, "Backpack/Bag"];
const REID_DATE_CYCLE = [
  "2026-07-27", "2026-07-29", "2026-07-31", "2026-08-02", "2026-08-04",
  "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10",
];
const REID_SIMILARITY_CYCLE = Array.from({ length: 24 }, (_, i) => 62 + ((i * 11) % 38)); // 62–99

export const REID_DATA = PERSONS.map((p, i) => ({
  ...p,
  status:     REID_STATUS_CYCLE[i % REID_STATUS_CYCLE.length] as ReIDStatus,
  gender:     REID_GENDER_CYCLE[i % REID_GENDER_CYCLE.length],
  age:        REID_AGE_CYCLE[i % REID_AGE_CYCLE.length],
  score:      REID_SCORE_CYCLE[i % REID_SCORE_CYCLE.length],
  cam:        REID_CAM_CYCLE[i % REID_CAM_CYCLE.length],
  face:       REID_FACE_POOL[i % REID_FACE_POOL.length],
  apparel:    REID_APPAREL_CYCLE[i % REID_APPAREL_CYCLE.length],
  prop:       REID_PROP_CYCLE[i % REID_PROP_CYCLE.length],
  date:       REID_DATE_CYCLE[i % REID_DATE_CYCLE.length],
  similarity: REID_SIMILARITY_CYCLE[i % REID_SIMILARITY_CYCLE.length],
  plate:      null as string | null,
}));

// ── Vehicle search dataset (Figma node 182:14807 — VEHICLE mode filter is License plate only,
// no gender/apparel/props) ──────────────────────────────────────────────────────────────────
// No real vehicle photography in this mock app — a simple tinted car glyph stands in for a
// photo (deterministic per plate, not a fabricated stock photo pretending to be real footage).
const VEHICLE_COLOR_CYCLE = ["#475469", "#5a3dfb", "#0e162a", "#94a3b8", "#1d4ed8", "#b91c1c"];
function carSvgDataUri(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>`
    + `<rect width='200' height='200' fill='${color}'/>`
    + `<g transform='translate(30,70)' fill='white' fill-opacity='0.9'>`
    + `<path d='M8 40 L20 10 Q26 0 40 0 H100 Q114 0 120 10 L132 40 H140 Q146 40 146 46 V60 Q146 66 140 66 H8 Q2 66 2 60 V46 Q2 40 8 40 Z'/>`
    + `<circle cx='30' cy='66' r='12' fill='${color}'/><circle cx='118' cy='66' r='12' fill='${color}'/>`
    + `</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const VEHICLE_PLATES = [
  "SGA 1234 X", "SBC 5821 K", "SJT 9042 M", "SKL 3317 P", "SMN 7605 T",
  "SGX 2298 B", "SHV 6110 Q", "SFY 4483 W", "SDP 8827 R", "SLQ 1956 H",
  "SGA 3390 Z", "SBC 7712 N", "SJT 4488 J", "SKL 9931 E", "SMN 2264 Y",
];
export const VEHICLE_DATA = VEHICLE_PLATES.map((plate, i) => {
  const color = VEHICLE_COLOR_CYCLE[i % VEHICLE_COLOR_CYCLE.length];
  const img = carSvgDataUri(color);
  return {
    id: 900000 + i,
    url: img, face: img,
    time: TIMES_P[i % TIMES_P.length],
    badge: null as number | null,
    status: "Unknown" as ReIDStatus,
    gender: "", age: "",
    score: null as number | null,
    cam: REID_CAM_CYCLE[i % REID_CAM_CYCLE.length],
    apparel: "", prop: null as string | null,
    date: REID_DATE_CYCLE[i % REID_DATE_CYCLE.length],
    similarity: REID_SIMILARITY_CYCLE[i % REID_SIMILARITY_CYCLE.length],
    plate: plate as string | null,
  };
});

// Shared by Re-ID Analysis and Smart Search — applies every filter the two forms expose
// (type/gender/apparel/props/date range/similarity threshold) against the same dataset, so
// "Search" actually narrows results instead of always returning the same fixed slice.
function filterReidData(f: {
  searchType: "PERSON" | "VEHICLE"; gender: string; apparel: string[]; props: string[];
  dateRange: DateRangeValue; threshold: number; licensePlate?: string; camera?: string;
}): typeof REID_DATA {
  // An untouched date range isn't "any time ever" — it defaults to the last 7 days, same as the
  // trigger's "Last 7 days" placeholder implies.
  let { start, end } = f.dateRange;
  if (!start && !end) {
    end = new Date();
    start = new Date(end);
    start.setDate(start.getDate() - 7);
  }
  const inDateRange = (date: string) => (!start || new Date(date) >= start) && (!end || new Date(date) <= end);

  if (f.searchType === "VEHICLE") {
    const plateQuery = (f.licensePlate ?? "").trim().toLowerCase().replace(/\s+/g, "");
    return VEHICLE_DATA
      .filter(v => !plateQuery || (v.plate ?? "").toLowerCase().replace(/\s+/g, "").includes(plateQuery))
      .filter(v => !f.camera || v.cam === f.camera)
      .filter(v => v.similarity >= f.threshold)
      .filter(v => inDateRange(v.date))
      .sort((a, b) => b.similarity - a.similarity);
  }

  // RedFace hits used to be dropped from every attribute search entirely — surfacing them (with
  // the same REDFACE badge Live Monitoring/SearchResultCard already use) is exactly the point:
  // if a search happens to turn up someone already flagged, that's worth knowing, not hiding.
  const genderAbbrev = f.gender === "Male" ? "M" : f.gender === "Female" ? "F" : null;
  return REID_DATA
    .filter(p => !genderAbbrev || p.gender === genderAbbrev)
    .filter(p => f.apparel.length === 0 || f.apparel.includes(p.apparel))
    .filter(p => f.props.length === 0 || (p.prop !== null && f.props.includes(p.prop)))
    .filter(p => !f.camera || p.cam === f.camera)
    .filter(p => p.similarity >= f.threshold)
    .filter(p => inDateRange(p.date))
    .sort((a, b) => b.similarity - a.similarity);
}

interface ReidCluster {
  id: string;
  thumbnail: string;
  title: string;
  meta: { label: string; value: string }[];
  action: string;
  matches: MatchItem[];
}

// Unsplash serves images through imgix, so appending its query params re-renders the same
// source photo with a slightly different blur/exposure/saturation per tile — enough that a
// declining similarity score (97%, 96%, ... not literally the same file at every rank) reads as
// "same person, progressively worse camera conditions" instead of a pixel-identical repeat.
const MATCH_VARIATION_EXPOSURE = [0, -6, 5, -4, 7, -3, 4, -7, 3, -5, 6, -2];
function withMatchVariation(url: string, i: number): string {
  const blur = 1 + Math.min(i, 7);
  const sat = -(2 + Math.min(i * 2, 22));
  const exp = MATCH_VARIATION_EXPOSURE[i % MATCH_VARIATION_EXPOSURE.length];
  return `${url}&blur=${blur}&sat=${sat}&exp=${exp}`;
}

// A Re-ID match list should show ONE identity re-appearing across cameras, not a mix of
// different-looking people who merely share a gender. The mock photo pool has no multi-angle
// shots of a single real identity, so each synthesized appearance reuses the target's own photo
// across different cameras/times — the same convention the derived Tracking trail already uses
// for one person crossing multiple cameras.
function buildSuspectMatches(person: (typeof REID_DATA)[number], count: number): MatchItem[] {
  const base = reidToMatchItem(person);
  return Array.from({ length: count }, (_, i) => ({
    ...base,
    id: person.id * 1000 + i,
    face: withMatchVariation(base.face, i),
    body: withMatchVariation(base.body, i),
    cam: CAMERA_OPTIONS[i % CAMERA_OPTIONS.length],
    time: TIMES_P[i % TIMES_P.length],
    similarity: Math.round((97 - i * 0.8) * 10) / 10,
  }));
}

// Same idea as buildSuspectMatches, but for a live search target (VIP Quick Select / Recent
// Targets) whose face/body photos come from a different pool than REID_DATA, so it can't reuse a
// REID_DATA row directly. Returns REID_DATA-shaped rows (not MatchItem[]) so every search surface
// — Smart Search's grid, Re-ID Analysis's cluster (via reidToMatchItem), RedFace's candidate list
// — can reuse the same generator instead of each hitting filterReidData() with the target's
// cascaded gender/apparel/props and risking zero real hits: REID_DATA's attribute cycles are
// independent of what a named target's profile actually is, so a specific gender+apparel+props+
// date combination can easily have no real overlap at all — the target is a person we already
// have a photo of, not a filter that might come up empty.
function buildTargetResultRows(face: string, body: string, genderAbbrev: "M" | "F", count: number): typeof REID_DATA {
  return Array.from({ length: count }, (_, i) => ({
    id: 700000 + i,
    url: withMatchVariation(body, i),
    face: withMatchVariation(face, i),
    time: TIMES_P[i % TIMES_P.length],
    badge: null as number | null,
    status: "Unknown" as ReIDStatus,
    cam: CAMERA_OPTIONS[i % CAMERA_OPTIONS.length],
    similarity: Math.round((97 - i * 0.8) * 10) / 10,
    gender: genderAbbrev,
    age: "--",
    score: null as number | null,
    apparel: "",
    prop: null as string | null,
    date: REID_DATE_CYCLE[i % REID_DATE_CYCLE.length],
    plate: null as string | null,
  }));
}

const SUSPECT_1 = REID_DATA[0]; // gender F, matches REID_GENDER_CYCLE[0]
const SUSPECT_2 = REID_DATA[1]; // gender M, matches REID_GENDER_CYCLE[1]

const CLUSTERS: ReidCluster[] = [
  {
    id: "c1",
    thumbnail: SUSPECT_1.url,
    title: "Suspect #1 (TS017323)",
    meta: [
      { label:"Gender", value:"F" },
      { label:"Age", value:"20s" },
      { label:"Apparel", value:"Skirts" },
      { label:"Props", value:"None" },
    ],
    action: "RedFace",
    matches: buildSuspectMatches(SUSPECT_1, 20),
  },
  {
    id: "c2",
    thumbnail: SUSPECT_2.url,
    title: "Suspect #2 (TS015942)",
    meta: [
      { label:"Gender", value:"M" },
      { label:"Age", value:"30s" },
      { label:"Apparel", value:"Short Sleeve" },
      { label:"Props", value:"Backpack/Bag" },
    ],
    action: "RedFace",
    matches: buildSuspectMatches(SUSPECT_2, 20),
  },
];

function MetaField({ label, value }: { label:string; value:string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
      <span style={{ fontSize:"12px", fontWeight:600, color:"#94a3b8", letterSpacing:"-0.24px" }}>{label}:</span>
      <span style={{ fontSize:"12px", fontWeight:700, color:"#475469", letterSpacing:"-0.24px" }}>{value}</span>
    </div>
  );
}
function MetaDivider() {
  return <div style={{ width:"1px", height:"8px", backgroundColor:"#e2e8f0", flexShrink:0 }} />;
}

function ClusterMatchCard({ item, onClick }: { item: MatchItem; onClick?: () => void }) {
  const badgeColor = item.similarity >= 85 ? "#334155" : item.similarity >= 80 ? "#f59e0b" : "#64748a";
  return (
    <div onClick={onClick} style={{ backgroundColor:"white", borderRadius:"8px", overflow:"hidden", width:"133px", flexShrink:0, display:"flex", flexDirection:"column", gap:"8px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ position:"relative", height:"160px", overflow:"hidden" }}>
        <img src={item.body} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        <span style={{ position:"absolute", top:6, left:6, backgroundColor:badgeColor, color:"white", fontSize:"10px", fontWeight:600, padding:"2px 6px", borderRadius:"4px", letterSpacing:"-0.2px" }}>{item.similarity}%</span>
      </div>
      <div style={{ padding:"0 8px 8px", display:"flex", flexDirection:"column", gap:"2px" }}>
        <span style={{ fontSize:"10px", fontWeight:600, color:"#0e162a", letterSpacing:"-0.2px", fontFamily: item.plate ? "monospace" : undefined }}>
          {item.plate ?? item.cam}
        </span>
        <span style={{ fontSize:"10px", fontWeight:600, color:"#94a3b8", letterSpacing:"-0.2px" }}>{item.time}</span>
      </div>
    </div>
  );
}

function ClusterCard({ cluster, onNavigateTab, onMatchClick }: { cluster: ReidCluster; onNavigateTab?: (tab: DataTab) => void; onMatchClick?: (id: number) => void }) {
  return (
    <div style={{ backgroundColor:"white", borderRadius:"12px", padding:"12px 24px", display:"flex", flexDirection:"column", gap:"16px", width:"100%", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:"16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"16px", minWidth:0 }}>
          <img src={cluster.thumbnail} alt="" style={{ width:"48px", height:"48px", borderRadius:"8px", objectFit:"cover", flexShrink:0 }} />
          <div style={{ display:"flex", flexDirection:"column", gap:"4px", minWidth:0 }}>
            <span style={{ fontSize:"14px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.28px", whiteSpace:"nowrap" }}>{cluster.title}</span>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
              {cluster.meta.map((m, i) => (
                <React.Fragment key={m.label}>
                  <MetaField label={m.label} value={m.value} />
                  {i < cluster.meta.length - 1 && <MetaDivider />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => onNavigateTab?.(cluster.action as DataTab)} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"8px",
          backgroundColor:"#f1f5f9", border:"none", cursor:"pointer", flexShrink:0 }}>
          <RedFaceIconSm />
          <span style={{ fontSize:"13px", fontWeight:600, color:"#475469", letterSpacing:"-0.26px", whiteSpace:"nowrap" }}>{cluster.action}</span>
        </button>
      </div>
      <div className="vca-hide-scrollbar" style={{ display:"flex", gap:"12px", overflowX:"auto" }}>
        {cluster.matches.map(m => <ClusterMatchCard key={m.id} item={m} onClick={() => onMatchClick?.(m.id)} />)}
      </div>
    </div>
  );
}

const VIP_QUICK = [
  { name:"Mina", face: MATCH_DATA[0].face, body: MATCH_DATA[0].body, gender:"Female" },
  { name:"Joon", face: MATCH_DATA[1].face, body: MATCH_DATA[1].body, gender:"Male" },
  { name:"Taeho", face: MATCH_DATA[3].face, body: MATCH_DATA[3].body, gender:"Male" },
  { name:"Yuna", face: MATCH_DATA[2].face, body: MATCH_DATA[2].body, gender:"Female" },
  { name:"Minho", face: MATCH_DATA[4].face, body: MATCH_DATA[4].body, gender:"Male" },
  { name:"Seoyeon", face: MATCH_DATA[5].face, body: MATCH_DATA[5].body, gender:"Female" },
  { name:"Jihoon", face: MATCH_DATA[6].face, body: MATCH_DATA[6].body, gender:"Male" },
  { name:"Areum", face: MATCH_DATA[7].face, body: MATCH_DATA[7].body, gender:"Female" },
  { name:"Doyoon", face: MATCH_DATA[0].face, body: MATCH_DATA[0].body, gender:"Male" },
  { name:"Haeun", face: MATCH_DATA[1].face, body: MATCH_DATA[1].body, gender:"Female" },
  { name:"Junseo", face: MATCH_DATA[2].face, body: MATCH_DATA[2].body, gender:"Male" },
  { name:"Somin", face: MATCH_DATA[3].face, body: MATCH_DATA[3].body, gender:"Female" },
  { name:"Yejun", face: MATCH_DATA[4].face, body: MATCH_DATA[4].body, gender:"Male" },
  { name:"Chaewon", face: MATCH_DATA[5].face, body: MATCH_DATA[5].body, gender:"Female" },
  { name:"Hyunwoo", face: MATCH_DATA[6].face, body: MATCH_DATA[6].body, gender:"Male" },
];

// gender/apparel/props here are what picking this target cascades onto the rest of the filter
// form — a recent target isn't just a photo, it's "search for someone matching this profile".
const RECENT_TARGETS_EN = [
  { face: RECENT_TARGETS[0].face, body: RECENT_TARGETS[0].body, label:"Target 1024", time:"today 12:50", gender:"Female", apparel:"Skirts", props: [] as string[] },
  { face: RECENT_TARGETS[1].face, body: RECENT_TARGETS[1].body, label:"Target #254",  time:"today 13:21", gender:"Male", apparel:"Trousers", props: ["Backpack/Bag"] },
  { face: RECENT_TARGETS[2].face, body: RECENT_TARGETS[2].body, label:"Target #092",  time:"yesterday 18:30", gender:"Female", apparel:"Long Sleeve", props: ["Hat"] },
];

function PersonIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3 13.5C3 11.015 5.239 9 8 9C10.761 9 13 11.015 13 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function VehicleIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12.6672 11.3327H14.0007C14.4007 11.3327 14.6674 11.066 14.6674 10.666V8.66585C14.6674 8.0658 14.2007 7.53242 13.6673 7.39908C12.4672 7.06572 10.6671 6.66569 10.6671 6.66569C10.6671 6.66569 9.80035 5.73228 9.2003 5.13223C8.86694 4.86554 8.46691 4.66553 8.00021 4.66553H3.33317C2.93314 4.66553 2.59978 4.93222 2.39976 5.26558L1.46635 7.19906C1.37806 7.45657 1.33301 7.72691 1.33301 7.99913V10.666C1.33301 11.066 1.5997 11.3327 1.99973 11.3327H3.33317" stroke="currentColor" strokeLinecap="round"/>
      <path d="M4.66634 12.6667C5.40272 12.6667 5.99967 12.0697 5.99967 11.3333C5.99967 10.597 5.40272 10 4.66634 10C3.92996 10 3.33301 10.597 3.33301 11.3333C3.33301 12.0697 3.92996 12.6667 4.66634 12.6667Z" stroke="currentColor" strokeLinecap="round"/>
      <path d="M6 11.334H10" stroke="currentColor" strokeLinecap="round"/>
      <path d="M11.3333 12.6667C12.0697 12.6667 12.6667 12.0697 12.6667 11.3333C12.6667 10.597 12.0697 10 11.3333 10C10.597 10 10 10.597 10 11.3333C10 12.0697 10.597 12.6667 11.3333 12.6667Z" stroke="currentColor" strokeLinecap="round"/>
    </svg>
  );
}
function HistoryIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6C1.5 6.89002 1.76392 7.76005 2.25839 8.50007C2.75285 9.24009 3.45566 9.81686 4.27792 10.1575C5.10019 10.4981 6.00499 10.5872 6.87791 10.4135C7.75082 10.2399 8.55264 9.81132 9.18198 9.18198C9.81132 8.55264 10.2399 7.75082 10.4135 6.87791C10.5872 6.00499 10.4981 5.10019 10.1575 4.27792C9.81686 3.45566 9.24009 2.75285 8.50007 2.25839C7.76005 1.76392 6.89002 1.5 6 1.5C4.74198 1.50473 3.53448 1.99561 2.63 2.87L1.5 4M4 4H1.5V1.5M6 3.5V6L8 7" stroke="currentColor" strokeLinecap="round"/>
    </svg>
  );
}
function StarIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M5.78072 1.63235C5.80231 1.59316 5.83401 1.56047 5.87253 1.5377C5.91105 1.51494 5.95498 1.50293 5.99972 1.50293C6.04447 1.50293 6.0884 1.51494 6.12692 1.5377C6.16544 1.56047 6.19714 1.59316 6.21872 1.63235L7.69472 4.43435C7.72992 4.49923 7.77905 4.55552 7.83858 4.59916C7.89811 4.64281 7.96656 4.67273 8.03902 4.68678C8.11149 4.70083 8.18616 4.69867 8.25769 4.68044C8.32922 4.66221 8.39583 4.62837 8.45272 4.58135L10.5912 2.74935C10.6323 2.71596 10.6829 2.69646 10.7357 2.69365C10.7885 2.69084 10.8409 2.70487 10.8853 2.73373C10.9296 2.76258 10.9637 2.80476 10.9826 2.8542C11.0014 2.90364 11.0041 2.95779 10.9902 3.00885L9.57322 8.13185C9.5443 8.23669 9.48199 8.32923 9.39573 8.39546C9.30947 8.46169 9.20397 8.49799 9.09522 8.49885H2.90472C2.79589 8.49809 2.69028 8.46184 2.60392 8.39561C2.51756 8.32937 2.45517 8.23677 2.42622 8.13185L1.00972 3.00935C0.995849 2.95829 0.998535 2.90414 1.01739 2.8547C1.03625 2.80526 1.07032 2.76308 1.11467 2.73423C1.15903 2.70537 1.2114 2.69134 1.26424 2.69415C1.31708 2.69696 1.36767 2.71646 1.40872 2.74985L3.54672 4.58185C3.60362 4.62887 3.67023 4.66271 3.74176 4.68094C3.81328 4.69917 3.88796 4.70134 3.96042 4.68728C4.03289 4.67323 4.10134 4.64331 4.16087 4.59966C4.2204 4.55602 4.26953 4.49973 4.30472 4.43485L5.78072 1.63235Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10.5H9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function CalendarIconSm() {
  return (
    <svg width="14" height="14" viewBox="21 14 14 14" fill="none">
      <path d="M31.2 14.5107C31.2495 14.5109 31.2897 14.5511 31.2898 14.6006V15.5771H33.3328C33.9713 15.5771 34.4888 16.0949 34.489 16.7334V26.333C34.489 26.9717 33.9715 27.4893 33.3328 27.4893H22.6667C22.0281 27.4891 21.5105 26.9716 21.5105 26.333V16.7334C21.5107 16.095 22.0283 15.5773 22.6667 15.5771H24.7107V14.6006C24.7107 14.551 24.7509 14.5107 24.8005 14.5107C24.85 14.5109 24.8903 14.5511 24.8904 14.6006V15.5771H31.1101V14.6006C31.1102 14.551 31.1503 14.5107 31.2 14.5107ZM21.6902 26.333C21.6902 26.8722 22.1275 27.3094 22.6667 27.3096H33.3328C33.8721 27.3096 34.3093 26.8723 34.3093 26.333V18.957H21.6902V26.333ZM23.7332 25.1768C23.7828 25.1768 23.824 25.217 23.824 25.2666C23.8239 25.3162 23.7828 25.3564 23.7332 25.3564C23.6837 25.3562 23.6434 25.3161 23.6433 25.2666C23.6433 25.2171 23.6837 25.177 23.7332 25.1768ZM25.8669 25.1768C25.9165 25.1769 25.9568 25.217 25.9568 25.2666C25.9567 25.3162 25.9165 25.3564 25.8669 25.3564C25.8173 25.3564 25.7771 25.3162 25.7771 25.2666C25.7771 25.217 25.8173 25.1768 25.8669 25.1768ZM27.9998 25.1768C28.0494 25.1768 28.0896 25.217 28.0896 25.2666C28.0896 25.3162 28.0494 25.3564 27.9998 25.3564C27.9502 25.3563 27.91 25.3162 27.9099 25.2666C27.9099 25.217 27.9502 25.1769 27.9998 25.1768ZM30.1335 25.1768C30.183 25.177 30.2234 25.2171 30.2234 25.2666C30.2233 25.3161 30.183 25.3562 30.1335 25.3564C30.0839 25.3564 30.0428 25.3162 30.0427 25.2666C30.0427 25.217 30.0839 25.1768 30.1335 25.1768ZM23.7332 23.043C23.7828 23.043 23.824 23.0841 23.824 23.1338C23.8237 23.1833 23.7827 23.2236 23.7332 23.2236C23.6838 23.2234 23.6435 23.1831 23.6433 23.1338C23.6433 23.0843 23.6837 23.0432 23.7332 23.043ZM25.8669 23.043C25.9165 23.0431 25.9568 23.0842 25.9568 23.1338C25.9566 23.1832 25.9164 23.2235 25.8669 23.2236C25.8174 23.2236 25.7773 23.1833 25.7771 23.1338C25.7771 23.0841 25.8173 23.043 25.8669 23.043ZM27.9998 23.043C28.0494 23.043 28.0896 23.0841 28.0896 23.1338C28.0894 23.1833 28.0493 23.2236 27.9998 23.2236C27.9503 23.2235 27.9101 23.1832 27.9099 23.1338C27.9099 23.0842 27.9502 23.0431 27.9998 23.043ZM30.1335 23.043C30.183 23.0432 30.2234 23.0843 30.2234 23.1338C30.2232 23.1831 30.1829 23.2234 30.1335 23.2236C30.084 23.2236 30.043 23.1833 30.0427 23.1338C30.0427 23.0841 30.0839 23.043 30.1335 23.043ZM32.2664 23.043C32.316 23.043 32.3562 23.0842 32.3562 23.1338C32.356 23.1832 32.3158 23.2236 32.2664 23.2236C32.2169 23.2236 32.1768 23.1832 32.1765 23.1338C32.1765 23.0841 32.2167 23.043 32.2664 23.043ZM27.9998 20.9102C28.0494 20.9102 28.0895 20.9504 28.0896 21C28.0896 21.0497 28.0494 21.0898 27.9998 21.0898C27.9502 21.0897 27.9099 21.0496 27.9099 21C27.91 20.9505 27.9502 20.9103 27.9998 20.9102ZM30.1335 20.9102C30.183 20.9104 30.2233 20.9506 30.2234 21C30.2234 21.0495 30.183 21.0896 30.1335 21.0898C30.0839 21.0898 30.0427 21.0497 30.0427 21C30.0428 20.9504 30.0839 20.9102 30.1335 20.9102ZM32.2664 20.9102C32.3159 20.9102 32.3561 20.9505 32.3562 21C32.3562 21.0496 32.316 21.0898 32.2664 21.0898C32.2167 21.0898 32.1765 21.0496 32.1765 21C32.1766 20.9504 32.2168 20.9102 32.2664 20.9102ZM22.6667 15.7568C22.1276 15.757 21.6904 16.1943 21.6902 16.7334V18.7773H34.3093V16.7334C34.3091 16.1942 33.8719 15.7568 33.3328 15.7568H31.2898V16.7334C31.2898 16.783 31.2495 16.8241 31.2 16.8242C31.1503 16.8242 31.1101 16.783 31.1101 16.7334V15.7568H24.8904V16.7334C24.8904 16.783 24.85 16.824 24.8005 16.8242C24.7509 16.8242 24.7107 16.7831 24.7107 16.7334V15.7568H22.6667Z" fill="#64748A" stroke="#64748A" strokeWidth="0.8867"/>
    </svg>
  );
}
function DropzoneFaceIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12.875 7.66667C12.875 4.9737 10.693 2.79167 8 2.79167C5.30703 2.79167 3.125 4.9737 3.125 7.66667C3.125 10.3596 5.30703 12.5417 8 12.5417C10.693 12.5417 12.875 10.3596 12.875 7.66667ZM2 7.66667C2 4.3526 4.68594 1.66667 8 1.66667C11.3141 1.66667 14 4.3526 14 7.66667C14 10.9807 11.3141 13.6667 8 13.6667C4.68594 13.6667 2 10.9807 2 7.66667ZM6.15547 9.1526C6.50703 9.51823 7.11875 9.91667 8 9.91667C8.88125 9.91667 9.49297 9.51823 9.84453 9.1526C10.0602 8.9276 10.4164 8.92057 10.6391 9.1362C10.8617 9.35182 10.8711 9.70807 10.6555 9.93073C10.1375 10.4698 9.24922 11.0417 8 11.0417C6.75078 11.0417 5.8625 10.4698 5.34453 9.93073C5.12891 9.70573 5.13594 9.34948 5.36094 9.1362C5.58594 8.92292 5.94219 8.9276 6.15547 9.1526ZM5.375 6.54167C5.375 6.12682 5.71016 5.79167 6.125 5.79167C6.53984 5.79167 6.875 6.12682 6.875 6.54167C6.875 6.95651 6.53984 7.29167 6.125 7.29167C5.71016 7.29167 5.375 6.95651 5.375 6.54167ZM9.875 5.79167C10.2898 5.79167 10.625 6.12682 10.625 6.54167C10.625 6.95651 10.2898 7.29167 9.875 7.29167C9.46016 7.29167 9.125 6.95651 9.125 6.54167C9.125 6.12682 9.46016 5.79167 9.875 5.79167Z" fill="#324055"/>
    </svg>
  );
}
function DropzoneBodyIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M9.69575 2.75C9.69575 1.78477 8.93481 1 7.99888 1C7.06294 1 6.302 1.78477 6.302 2.75C6.302 3.71523 7.06294 4.5 7.99888 4.5C8.93481 4.5 9.69575 3.71523 9.69575 2.75ZM6.96219 5.6293C6.33382 5.39961 5.78233 4.96484 5.40319 4.37695L4.88617 3.57578C4.62634 3.17383 4.10137 3.06719 3.71161 3.33516C3.32186 3.60312 3.21581 4.14453 3.47564 4.54922L3.99266 5.34766C4.47256 6.08867 5.12744 6.67109 5.87778 7.05391V14.125C5.87778 14.609 6.25693 15 6.72622 15C7.19551 15 7.57466 14.609 7.57466 14.125V11.5H8.42309V14.125C8.42309 14.609 8.80224 15 9.27153 15C9.74082 15 10.12 14.609 10.12 14.125V7.05938C10.8915 6.67109 11.5623 6.06953 12.0475 5.30391L12.5301 4.54102C12.7846 4.13633 12.6732 3.59492 12.2808 3.32969C11.8884 3.06445 11.3635 3.1793 11.1063 3.58672L10.6237 4.34687C10.0457 5.26016 9.06207 5.8125 8.00418 5.8125C7.67011 5.8125 7.34399 5.75781 7.03378 5.65391C7.00992 5.6457 6.98605 5.63477 6.96219 5.6293Z" stroke="#324055"/>
    </svg>
  );
}
// Figma node 182:14807 ("Container" — vehicle-mode search bar) — exact vector data.
function LicensePlateIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 5.33333L12.6667 6.66667L11.6667 4.2C11.5724 3.94756 11.4038 3.72962 11.1831 3.5749C10.9625 3.42019 10.7001 3.33597 10.4307 3.33333H5.6C5.32834 3.32709 5.06125 3.40401 4.83451 3.55378C4.60778 3.70355 4.43221 3.91902 4.33133 4.17133L3.33333 6.66667L2 5.33333" stroke="#64748A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.66667 9.33333H4.67333" stroke="#64748A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.3333 9.33333H11.34" stroke="#64748A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 6.66667H3.33333C2.59695 6.66667 2 7.26362 2 8V10.6667C2 11.403 2.59695 12 3.33333 12H12.6667C13.403 12 14 11.403 14 10.6667V8C14 7.26362 13.403 6.66667 12.6667 6.66667Z" stroke="#64748A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 12V13.3333" stroke="#64748A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 12V13.3333" stroke="#64748A" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function FilterSlidersIconSm() {
  return (
    <svg width="12" height="12" viewBox="22 15 12 12" fill="none">
      <path d="M30.6667 19.6667V22.3333M22 21H28M30.6667 21H34M25.3333 24.3333V27M28 25.6667H34M22 25.6667H25.3333M26.6667 15V17.6667M29.3333 16.3333H34M22 16.3333H26.6667" stroke="#475469" strokeLinecap="round"/>
    </svg>
  );
}
function ResetIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8C2 9.18669 2.35189 10.3467 3.01118 11.3334C3.67047 12.3201 4.60754 13.0892 5.7039 13.5433C6.80026 13.9974 8.00666 14.1162 9.17054 13.8847C10.3344 13.6532 11.4035 13.0818 12.2426 12.2426C13.0818 11.4035 13.6532 10.3344 13.8847 9.17054C14.1162 8.00666 13.9974 6.80026 13.5433 5.7039C13.0892 4.60754 12.3201 3.67047 11.3334 3.01118C10.3467 2.35189 9.18669 2 8 2C6.32263 2.00631 4.71265 2.66082 3.50667 3.82667L2 5.33333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 2V5.33333H5.33333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function SmartSearchTitleIconSm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21.0002 21.0002L16.6602 16.6602" stroke="#5A3DFB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#5A3DFB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function SmartSearchFaceIconSm() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M16.0938 9.58301C16.0938 6.2168 13.3662 3.48926 10 3.48926C6.63379 3.48926 3.90625 6.2168 3.90625 9.58301C3.90625 12.9492 6.63379 15.6768 10 15.6768C13.3662 15.6768 16.0938 12.9492 16.0938 9.58301ZM2.5 9.58301C2.5 5.44043 5.85742 2.08301 10 2.08301C14.1426 2.08301 17.5 5.44043 17.5 9.58301C17.5 13.7256 14.1426 17.083 10 17.083C5.85742 17.083 2.5 13.7256 2.5 9.58301ZM7.69434 11.4404C8.13379 11.8975 8.89844 12.3955 10 12.3955C11.1016 12.3955 11.8662 11.8975 12.3057 11.4404C12.5752 11.1592 13.0205 11.1504 13.2988 11.4199C13.5771 11.6895 13.5889 12.1348 13.3193 12.4131C12.6719 13.0869 11.5615 13.8018 10 13.8018C8.43848 13.8018 7.32812 13.0869 6.68066 12.4131C6.41113 12.1318 6.41992 11.6865 6.70117 11.4199C6.98242 11.1533 7.42773 11.1592 7.69434 11.4404ZM6.71875 8.17676C6.71875 7.6582 7.1377 7.23926 7.65625 7.23926C8.1748 7.23926 8.59375 7.6582 8.59375 8.17676C8.59375 8.69531 8.1748 9.11426 7.65625 9.11426C7.1377 9.11426 6.71875 8.69531 6.71875 8.17676ZM12.3438 7.23926C12.8623 7.23926 13.2812 7.6582 13.2812 8.17676C13.2812 8.69531 12.8623 9.11426 12.3438 9.11426C11.8252 9.11426 11.4062 8.69531 11.4062 8.17676C11.4062 7.6582 11.8252 7.23926 12.3438 7.23926Z" fill="#324055"/>
    </svg>
  );
}
function SmartSearchBodyIconSm() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.1195 3.4375C12.1195 2.23096 11.1683 1.25 9.99843 1.25C8.82852 1.25 7.87734 2.23096 7.87734 3.4375C7.87734 4.64404 8.82852 5.625 9.99843 5.625C11.1683 5.625 12.1195 4.64404 12.1195 3.4375ZM8.70258 7.03662C7.91711 6.74951 7.22775 6.20605 6.75382 5.47119L6.10755 4.46973C5.78276 3.96729 5.12654 3.83398 4.63935 4.16895C4.15217 4.50391 4.0196 5.18066 4.34439 5.68652L4.99066 6.68457C5.59053 7.61084 6.40914 8.33887 7.34706 8.81738V17.6562C7.34706 18.2612 7.821 18.75 8.40761 18.75C8.99423 18.75 9.46816 18.2612 9.46816 17.6562V14.375H10.5287V17.6562C10.5287 18.2612 11.0026 18.75 11.5893 18.75C12.1759 18.75 12.6498 18.2612 12.6498 17.6562V8.82422C13.6142 8.33887 14.4527 7.58691 15.0592 6.62988L15.6624 5.67627C15.9806 5.17041 15.8414 4.49365 15.3509 4.16211C14.8604 3.83057 14.2042 3.97412 13.8827 4.4834L13.2795 5.43359C12.557 6.5752 11.3274 7.26562 10.0051 7.26562C9.58747 7.26562 9.17982 7.19727 8.79206 7.06738C8.76223 7.05713 8.7324 7.04346 8.70258 7.03662Z" fill="white" stroke="#324055"/>
    </svg>
  );
}
function DefaultFaceIconSm() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M19.3125 11.5C19.3125 7.46055 16.0395 4.1875 12 4.1875C7.96055 4.1875 4.6875 7.46055 4.6875 11.5C4.6875 15.5395 7.96055 18.8125 12 18.8125C16.0395 18.8125 19.3125 15.5395 19.3125 11.5ZM3 11.5C3 6.52891 7.02891 2.5 12 2.5C16.9711 2.5 21 6.52891 21 11.5C21 16.4711 16.9711 20.5 12 20.5C7.02891 20.5 3 16.4711 3 11.5ZM9.2332 13.7289C9.76055 14.2773 10.6781 14.875 12 14.875C13.3219 14.875 14.2395 14.2773 14.7668 13.7289C15.0902 13.3914 15.6246 13.3809 15.9586 13.7043C16.2926 14.0277 16.3066 14.5621 15.9832 14.8961C15.2062 15.7047 13.8738 16.5625 12 16.5625C10.1262 16.5625 8.79375 15.7047 8.0168 14.8961C7.69336 14.5586 7.70391 14.0242 8.04141 13.7043C8.37891 13.3844 8.91328 13.3914 9.2332 13.7289ZM8.0625 9.8125C8.0625 9.19023 8.56523 8.6875 9.1875 8.6875C9.80977 8.6875 10.3125 9.19023 10.3125 9.8125C10.3125 10.4348 9.80977 10.9375 9.1875 10.9375C8.56523 10.9375 8.0625 10.4348 8.0625 9.8125ZM14.8125 8.6875C15.4348 8.6875 15.9375 9.19023 15.9375 9.8125C15.9375 10.4348 15.4348 10.9375 14.8125 10.9375C14.1902 10.9375 13.6875 10.4348 13.6875 9.8125C13.6875 9.19023 14.1902 8.6875 14.8125 8.6875Z" fill="#94A3B8"/>
    </svg>
  );
}
function FullBodyIconSm() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M14.4001 4.80039C14.4001 3.47664 13.3239 2.40039 12.0001 2.40039C10.6764 2.40039 9.60014 3.47664 9.60014 4.80039C9.60014 6.12414 10.6764 7.20039 12.0001 7.20039C13.3239 7.20039 14.4001 6.12414 14.4001 4.80039ZM10.5339 8.74914C9.64514 8.43414 8.86514 7.83789 8.32889 7.03164L7.59764 5.93289C7.23014 5.38164 6.48764 5.23539 5.93639 5.60289C5.38514 5.97039 5.23514 6.71289 5.60264 7.26789L6.33389 8.36289C7.01264 9.37914 7.93889 10.1779 9.00014 10.7029V20.4004C9.00014 21.0641 9.53639 21.6004 10.2001 21.6004C10.8639 21.6004 11.4001 21.0641 11.4001 20.4004V16.8004H12.6001V20.4004C12.6001 21.0641 13.1364 21.6004 13.8001 21.6004C14.4639 21.6004 15.0001 21.0641 15.0001 20.4004V10.7104C16.0914 10.1779 17.0401 9.35289 17.7264 8.30289L18.4089 7.25664C18.7689 6.70164 18.6114 5.95914 18.0564 5.59539C17.5014 5.23164 16.7589 5.38914 16.3951 5.94789L15.7126 6.99039C14.8951 8.24289 13.5039 9.00039 12.0076 9.00039C11.5351 9.00039 11.0739 8.92539 10.6351 8.78289C10.6014 8.77164 10.5676 8.75664 10.5339 8.74914Z" fill="white" stroke="#94A3B8"/>
    </svg>
  );
}
function SlidersIconSm({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6.667 5.333H9.333M8 14V8M8 5.333V2M11.333 10.667H14M12.667 8V2M12.667 14V10.667M2 9.333H4.667M3.333 6.667V2M3.333 14V9.333" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/>
    </svg>
  );
}

function SearchPanel({ state, onSearch, onCollapse }: { state: SearchFilterState; onSearch: () => void; onCollapse: () => void }) {
  const {
    searchType, setSearchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP,
    threshold, setThreshold, gender, setGender, apparel, toggleApparel, props, toggleProps,
    dateRange, setDateRange, licensePlate, setLicensePlate, camera, setCamera, reset,
  } = state;
  const [attrOpen, setAttrOpen] = useState(false);
  const target = selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : activeVIP >= 0 ? VIP_QUICK[activeVIP] : null;
  const isVehicle = searchType === "VEHICLE";

  return (
    <div style={{ width:"320px", flexShrink:0, backgroundColor:"white", borderRadius:"12px", padding:"24px 16px",
      display:"flex", flexDirection:"column", gap:"24px", height:"100%", overflowY:"auto", boxSizing:"border-box" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <SlidersIconSm size={20} />
          <span style={{ fontSize:"14px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.28px" }}>Search Filters</span>
        </div>
        <button onClick={onCollapse} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", color:"#94a3b8" }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ transform:"rotate(180deg)" }}>
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div style={{ display:"flex", backgroundColor:"#f1f5f9", border:"1px solid #f1f5f9", borderRadius:"12px", padding:"1px", width:"100%" }}>
        {(["PERSON","VEHICLE"] as const).map(t => {
          const active = searchType === t;
          return (
            <button key={t} onClick={() => setSearchType(t)} style={{
              flex:1, borderRadius:"10px", border:"none", cursor:"pointer",
              backgroundColor: active ? "white" : "transparent",
              color: active ? "#5a3dfb" : "#64748a", fontWeight: active ? 700 : 600,
              fontSize:"13px", lineHeight:"18px", letterSpacing:"-0.26px", padding:"6px 20px",
              display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
            }}>
              {t === "PERSON" ? <PersonIconSm/> : <VehicleIconSm/>} {t}
            </button>
          );
        })}
      </div>

      {!isVehicle && (
        <>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <HistoryIconSm />
              <span style={{ fontSize:"13px", fontWeight:700, color:"#324055" }}>Recent Targets</span>
            </div>
            <div className="vca-hide-scrollbar" style={{ display:"flex", gap:"8px", overflowX:"auto" }}>
              {RECENT_TARGETS_EN.map((t, i) => (
                <button key={i} onClick={() => selectRecentTarget(i)} style={{
                  display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"8px",
                  backgroundColor: selectedTarget === i ? "#f0f0ff" : "#f1f5f9",
                  border: selectedTarget === i ? "1px solid #5a3dfb" : "none",
                  cursor:"pointer", flexShrink:0,
                }}>
                  <img src={t.face} alt="" style={{ width:"36px", height:"32px", borderRadius:"8px", objectFit:"cover" }} />
                  <div style={{ textAlign:"left" }}>
                    <p style={{ fontSize:"11px", fontWeight:600, color:"#0e162a", margin:0, whiteSpace:"nowrap" }}>{t.label}</p>
                    <p style={{ fontSize:"9px", color:"#64748a", margin:0, whiteSpace:"nowrap" }}>{t.time}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <StarIconSm />
              <span style={{ fontSize:"13px", fontWeight:700, color:"#324055" }}>VIP Quick Select</span>
            </div>
            <VipQuickSelectRow activeVIP={activeVIP} onSelect={selectVIP} />
          </div>
        </>
      )}

      <div style={{ height:"1px", backgroundColor:"#e2e8f0", width:"100%" }} />

      <div style={{ display:"flex", flexDirection:"column", gap:"16px", width:"100%", flex:1 }}>
        <DateRangeTrigger value={dateRange} onApply={setDateRange} mode="merged" emptyText="Last 7 days" />

        <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
          <span style={{ fontSize:"13px", fontWeight:600, color:"#475469" }}>Similarity</span>
          <div style={{ display:"flex", gap:"2px", backgroundColor:"#f1f5f9", borderRadius:"999px", padding:"2px", height:"36px" }}>
            {[30,50,70,90].map(v => {
              const active = threshold === v;
              return (
                <button key={v} onClick={() => setThreshold(v)} style={{
                  flex:1, borderRadius:"999px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "white" : "transparent",
                  color: active ? "#5a3dfb" : "#94a3b8", fontWeight: active ? 700 : 600, fontSize:"12px",
                }}>{v}%</button>
              );
            })}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
          <span style={{ fontSize:"13px", fontWeight:600, color:"#475469" }}>Camera</span>
          <CameraSelect value={camera} onChange={setCamera} />
        </div>

        {isVehicle ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"#475469" }}>License Plate</span>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", height:"42px", padding:"0 16px",
              borderRadius:"8px", border:BORDER, backgroundColor:"white" }}>
              <LicensePlateIconSm />
              <input
                value={licensePlate}
                onChange={e => setLicensePlate(e.target.value)}
                placeholder="SGA 1234 X"
                style={{ flex:1, border:"none", outline:"none", fontFamily:"monospace", fontSize:"12px",
                  fontWeight:500, color:"#0e162a", letterSpacing:"-0.24px" }}
              />
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
              <span style={{ fontSize:"13px", fontWeight:600, color:"#475469" }}>Search by Image</span>
              <div style={{ display:"flex", gap:"12px" }}>
                <div style={{ flex:1, height:"126px", borderRadius:"12px", border:"1px dashed #94a3b8", backgroundColor:"#f8fafc",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", overflow:"hidden", position:"relative" }}>
                  {target && <img src={target.face} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.15 }} />}
                  <span style={{ position:"relative", display:"flex", alignItems:"center", gap:"4px", fontSize:"13px", fontWeight:700, color:"#324055" }}>
                    <DropzoneFaceIconSm /> Face
                  </span>
                  <span style={{ position:"relative", fontSize:"12px", color:"#94a3b8", textAlign:"center" }}>Click or drop image<br/>to upload</span>
                </div>
                <div style={{ flex:1, height:"126px", borderRadius:"12px", border:"1px dashed #94a3b8", backgroundColor:"#f8fafc",
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", overflow:"hidden", position:"relative" }}>
                  {target && <img src={target.body} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.15 }} />}
                  <span style={{ position:"relative", display:"flex", alignItems:"center", gap:"4px", fontSize:"13px", fontWeight:700, color:"#324055" }}>
                    <DropzoneBodyIconSm /> Body
                  </span>
                  <span style={{ position:"relative", fontSize:"12px", color:"#94a3b8", textAlign:"center" }}>Click or drop image<br/>to upload</span>
                </div>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:"10px", width:"100%" }}>
              <button onClick={() => setAttrOpen(o => !o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
                backgroundColor:"#f8fafc", border:"none", borderRadius:"8px", padding:"0 16px", height:"42px", cursor:"pointer" }}>
                <span style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", fontWeight:600, color:"#475469" }}>
                  <FilterSlidersIconSm /> Filter
                </span>
                <span style={{ display:"flex", color:"#475469", transform: attrOpen ? "rotate(180deg)" : "none" }}>
                  <ChevronDownIconSm />
                </span>
              </button>
              {attrOpen && (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"11px", fontWeight:600, color:"#94a3b8" }}>Gender</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {GENDER_CHIPS.map(g => <AttrChip key={g} label={g} active={gender===g} onClick={() => setGender(gender===g ? "" : g)} size="sm" />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"11px", fontWeight:600, color:"#94a3b8" }}>Apparel</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {APPAREL_CHIPS.map(a => <AttrChip key={a} label={a} active={apparel.includes(a)} onClick={() => toggleApparel(a)} size="sm" />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"11px", fontWeight:600, color:"#94a3b8" }}>Props</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {PROPS_CHIPS.map(p => <AttrChip key={p} label={p} active={props.includes(p)} onClick={() => toggleProps(p)} size="sm" />)}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ display:"flex", gap:"12px", width:"100%" }}>
        <button onClick={reset} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
          padding:"12px 0", borderRadius:"8px", border:"1px solid #ccd5e1", backgroundColor:"white", cursor:"pointer",
          fontSize:"13px", fontWeight:700, color:"#475469" }}>
          <ResetIconSm /> Reset
        </button>
        <button onClick={onSearch} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
          padding:"12px 0", borderRadius:"8px", border:"none", backgroundColor:"#0e162a", cursor:"pointer",
          fontSize:"13px", fontWeight:700, color:"white" }}>
          <SearchIconSm /> {isVehicle ? "Search Vehicle" : "Search"}
        </button>
      </div>
    </div>
  );
}

function ReIDContent({ seedCard, onSeedConsumed, onNavigateTab, onGoRedmap, onGoAnalyzeFrame }: { seedCard?: (typeof REID_DATA)[number] | null; onSeedConsumed?: () => void; onNavigateTab?: (tab: DataTab) => void; onGoRedmap?: () => void; onGoAnalyzeFrame?: (location: string) => void } = {}) {
  const [expanded, setExpanded]         = useState(false);
  const [hasSearched, setHasSearched]   = useState(false);
  const [detailId, setDetailId]         = useState<number | null>(null);
  const [searchType, setSearchType]     = useState<"PERSON"|"VEHICLE">("PERSON");
  const [selectedTarget, setSelectedTarget] = useState(-1);
  const [activeVIP, setActiveVIP]       = useState(-1);
  const [threshold, setThreshold]       = useState(30);
  const [gender, setGender]             = useState("");
  const [apparel, setApparel]           = useState<string[]>([]);
  const [props, setProps]               = useState<string[]>([]);
  const [dateRange, setDateRange]       = useState<DateRangeValue>({ start:null, end:null });
  const [licensePlate, setLicensePlate] = useState("");
  const [camera, setCamera]             = useState("");
  // "UNSET" (not seedCard's own initial value) so the block below still fires on this
  // component's very first render even when seedCard is ALREADY set at mount time — this tab
  // mounts fresh on every deep-link (it doesn't exist until activeTab switches to it), so
  // seeding it from "the previous seedCard" would just equal the incoming one and never fire.
  const [prevSeedCard, setPrevSeedCard] = useState<typeof seedCard | "UNSET">("UNSET");

  const toggleApparel = (a: string) => setApparel(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const toggleProps   = (a: string) => setProps(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const reset = () => { setSearchType("PERSON"); setThreshold(30); setGender(""); setApparel([]); setProps([]); setSelectedTarget(-1); setActiveVIP(-1); setDateRange({ start:null, end:null }); setLicensePlate(""); setCamera(""); setHasSearched(false); };

  // Deep-link from a Live Monitoring card's "Re-ID" hover button — seed the filters that
  // actually narrow filterReidData() (camera/gender/date) so this lands on that person's
  // real results instead of a blank form the operator has to fill in by hand.
  if (seedCard !== prevSeedCard) {
    setPrevSeedCard(seedCard);
    if (seedCard) {
      setExpanded(true);
      setSelectedTarget(-1); setActiveVIP(-1); setApparel([]); setProps([]); setLicensePlate("");
      setCamera(seedCard.cam);
      setGender(seedCard.gender === "M" ? "Male" : "Female");
      const day = new Date(seedCard.date);
      setDateRange({ start: day, end: day });
      setHasSearched(true);
    }
  }
  useEffect(() => {
    if (seedCard) onSeedConsumed?.();
  }, [seedCard, onSeedConsumed]);

  const selectRecentTarget = (i: number) => {
    if (selectedTarget === i) { setSelectedTarget(-1); setGender(""); setApparel([]); setProps([]); return; }
    setSelectedTarget(i); setActiveVIP(-1);
    const t = RECENT_TARGETS_EN[i];
    setGender(t.gender); setApparel([t.apparel]); setProps(t.props);
  };
  const selectVIP = (i: number) => {
    if (activeVIP === i) { setActiveVIP(-1); return; }
    setActiveVIP(i); setSelectedTarget(-1);
  };

  const state: SearchFilterState = {
    searchType, setSearchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP,
    threshold, setThreshold, gender, setGender, apparel, toggleApparel, props, toggleProps,
    dateRange, setDateRange, licensePlate, setLicensePlate, camera, setCamera, reset,
  };

  // Before a search runs, show the two illustrative example clusters (unchanged from before).
  // Once Search is clicked, replace them with one real cluster built from the actual filter
  // state and the live-filtered dataset — the target's face if one was picked, else a generic
  // "Search Result" placeholder.
  const searchTarget = activeVIP >= 0 ? VIP_QUICK[activeVIP] : selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : null;
  // A named target (VIP Quick Select / Recent Targets) means "find this specific person
  // elsewhere" — the results should be that one identity re-appearing, not just anyone who shares
  // the filter attributes. Only the attribute-only search (no target picked) falls back to
  // filterReidData, where a spread of different people genuinely matching the criteria is the
  // correct result. buildTargetResultRows never looks at camera/gender/apparel/props/date, so once
  // a target's picked those stop being real filters — the meta line below only lists what's
  // actually driving the results, same reasoning as Smart Search's results-bar chips.
  const targetMatches = searchType === "PERSON" && searchTarget
    ? buildTargetResultRows(searchTarget.face, searchTarget.body, searchTarget.gender === "Male" ? "M" : "F", 20)
        .filter(r => r.similarity >= threshold)
        .map(reidToMatchItem)
    : null;
  const searchResultCluster: ReidCluster | null = hasSearched ? {
    id: "search-result",
    thumbnail: searchType === "VEHICLE" ? carSvgDataUri(VEHICLE_COLOR_CYCLE[0]) : (searchTarget?.face ?? MATCH_DATA[0].face),
    title: searchType === "VEHICLE" ? "Vehicle Search Result" : searchTarget && "label" in searchTarget ? searchTarget.label : searchTarget ? searchTarget.name : "Search Result",
    meta: targetMatches ? [
      { label:"Type", value: searchType },
      { label:"Min. Similarity", value:`${threshold}%` },
    ] : searchType === "VEHICLE" ? [
      { label:"Type", value: searchType },
      ...(camera ? [{ label:"Camera", value:camera }] : []),
      ...(licensePlate ? [{ label:"Plate", value:licensePlate }] : []),
      { label:"Min. Similarity", value:`${threshold}%` },
    ] : [
      { label:"Type", value: searchType },
      ...(camera ? [{ label:"Camera", value:camera }] : []),
      ...(gender ? [{ label:"Gender", value:gender }] : []),
      ...(apparel.length ? [{ label:"Apparel", value:apparel.join(", ") }] : []),
      ...(props.length ? [{ label:"Props", value:props.join(", ") }] : []),
      { label:"Min. Similarity", value:`${threshold}%` },
    ],
    action: "RedFace",
    matches: targetMatches ?? filterReidData({ searchType, gender, apparel, props, dateRange, threshold, licensePlate, camera }).slice(0, 20)
      .map(p => ({ ...reidToMatchItem(p), similarity: p.similarity })),
  } : null;
  const clusters = hasSearched ? (searchResultCluster ? [searchResultCluster] : []) : CLUSTERS;
  const detailItem = detailId !== null ? clusters.flatMap(c => c.matches).find(m => m.id === detailId) ?? null : null;

  return (
    <div style={{ flex:1, display:"flex", gap:"12px", overflow:"hidden", padding:"24px 24px 12px", backgroundColor:"#f1f5f9", boxSizing:"border-box" }}>
      {expanded
        ? <SearchPanel state={state} onSearch={() => setHasSearched(true)} onCollapse={() => setExpanded(false)} />
        : (
          <button onClick={() => setExpanded(true)} style={{
            width:"48px", height:"48px", borderRadius:"16px", backgroundColor:"white", border:"none",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0,
          }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="#0e162a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )
      }
      <div className="vca-hide-scrollbar" style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:"16px" }}>
        {clusters.length > 0
          ? clusters.map(c => <ClusterCard key={c.id} cluster={c} onNavigateTab={onNavigateTab} onMatchClick={setDetailId} />)
          : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:"13px", fontWeight:600 }}>
              No matches for the current filters.
            </div>
          )
        }
      </div>
      {detailItem && <DetailModal item={detailItem} onClose={() => setDetailId(null)} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
    </div>
  );
}

// ── RedFace Placeholder ────────────────────────────────────────
function UserCogIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="5.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M2 12v-.5A3.5 3.5 0 0 1 5.5 8h.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <circle cx="10.3" cy="10.3" r="1.6" stroke="currentColor" strokeWidth="1"/>
      <path d="M10.3 8.1v.8M10.3 11.7v.8M8.4 9.2l.7.4M12.5 11.4l.7.4M8.4 11.4l.7-.4M12.5 9.2l.7-.4" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  );
}
function XCircleIconSm() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
      <rect width="37.0607" height="37.0607" rx="8" fill="#F1F5F9"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 24L24 12L25.0607 13.0607L13.0607 25.0607L12 24Z" fill="#334155"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.0607 12L25.0607 24L24 25.0607L12 13.0607L13.0607 12Z" fill="#334155"/>
    </svg>
  );
}
function CheckIconSm() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface RedfaceCandidate { id:number; url:string; cam:string; time:string; similarity:number; plate?: string | null }

function candidatesFromFilters(f: {
  searchType: "PERSON" | "VEHICLE"; gender: string; apparel: string[]; props: string[];
  dateRange: DateRangeValue; threshold: number; licensePlate?: string; camera?: string;
}): RedfaceCandidate[] {
  return filterReidData(f).slice(0, 12)
    .map(p => ({ id:p.id, url:p.url, cam:p.cam, time:p.time, similarity:p.similarity, plate:p.plate }));
}

function CandidateCard({ c, selected, onClick }:
  { c: RedfaceCandidate; selected:boolean; onClick:()=>void }) {
  return (
    <div onClick={onClick} style={{
      position:"relative", width:"144px", backgroundColor:"white",
      border: selected ? "1px solid #5a3dfb" : "1px solid #e2e8f0",
      borderRadius:"10px", padding:"8px", cursor:"pointer", display:"flex", flexDirection:"column", gap:"8px",
      boxShadow: selected ? "0 4px 8px rgba(90,61,251,0.11)" : "none",
    }}>
      <div style={{ position:"relative", width:"128px", height:"133px", borderRadius:"6px", overflow:"hidden" }}>
        <img src={c.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        <span style={{ position:"absolute", top:6, right:6, fontSize:"10px", fontWeight:600, color:"#0e162a",
          backgroundColor:"rgba(255,255,255,0.8)", padding:"2px 6px", borderRadius:"4px" }}>{c.similarity}%</span>
        <span style={{ position:"absolute", bottom:6, left:6, fontSize:"10px", fontWeight:600, color:"white",
          fontFamily: c.plate ? "monospace" : undefined,
          backgroundColor:"rgba(14,22,42,0.5)", border:"1px solid white", padding:"2px 6px", borderRadius:"4px" }}>{c.plate ?? c.cam}</span>
        {selected && (
          <span style={{ position:"absolute", top:6, left:6, display:"flex", alignItems:"center", gap:"3px",
            backgroundColor:"#5a3dfb", color:"white", fontSize:"10px", fontWeight:800, padding:"2px 6px", borderRadius:"4px" }}>
            <CheckIconSm /> Selected
          </span>
        )}
      </div>
      <div>
        <p style={{ fontSize:"12px", fontWeight:700, color:"#0e162a", margin:0 }}>Target #TS{String(c.id).padStart(6,"0")}</p>
        <p style={{ fontSize:"10px", color:"#324055", margin:0 }}>today {c.time}</p>
      </div>
    </div>
  );
}

function CheckSquareIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="currentColor"/>
      <path d="M4 7l2 2 4-4.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ChevronDownIconSm() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function LayersIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1L1 3.5L6 6L11 3.5L6 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
      <path d="M1 6L6 8.5L11 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 8.5L6 11L11 8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function TableIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1"/>
      <path d="M1 4.3h10M4.3 4.3v6.7" stroke="currentColor" strokeWidth="1"/>
    </svg>
  );
}

function PrimaryTargetPickerModal({ onConfirm, onCancel }:
  { onConfirm:(c:RedfaceCandidate)=>void; onCancel:()=>void }) {
  useEscapeKey(onCancel);
  const [searchType, setSearchType]         = useState<"PERSON"|"VEHICLE">("PERSON");
  const [selectedTarget, setSelectedTarget] = useState(-1);
  const [activeVIP, setActiveVIP]           = useState(-1);
  const [threshold, setThreshold]           = useState(80);
  const [gender, setGender]                 = useState("");
  const [apparel, setApparel]               = useState<string[]>([]);
  const [props, setProps]                   = useState<string[]>([]);
  const [attrOpen, setAttrOpen]             = useState(false);
  const [searched, setSearched]             = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<number|null>(null);
  const [dateRange, setDateRange]           = useState<DateRangeValue>({ start:null, end:null });
  const [licensePlate, setLicensePlate]     = useState("");
  const [camera, setCamera]                 = useState("");
  const [uploadedFace, setUploadedFace]     = useState<string|null>(null);
  const [uploadedBody, setUploadedBody]     = useState<string|null>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFace(URL.createObjectURL(file));
  };
  const handleBodyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedBody(URL.createObjectURL(file));
  };

  // Same cascade/toggle/mutual-exclusivity behavior as Re-ID Analysis and Smart Search — see
  // those for the rationale.
  const selectRecentTarget = (i: number) => {
    if (selectedTarget === i) { setSelectedTarget(-1); setGender(""); setApparel([]); setProps([]); return; }
    setSelectedTarget(i); setActiveVIP(-1);
    const t = RECENT_TARGETS_EN[i];
    setGender(t.gender); setApparel([t.apparel]); setProps(t.props);
  };
  const selectVIP = (i: number) => {
    if (activeVIP === i) { setActiveVIP(-1); return; }
    setActiveVIP(i); setSelectedTarget(-1);
  };

  const target = selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : activeVIP >= 0 ? VIP_QUICK[activeVIP] : null;
  const hasFace = !!uploadedFace || !!target;
  const faceSrc = uploadedFace ?? target?.face;
  const hasBody = !!uploadedBody || !!target;
  const bodySrc = uploadedBody ?? target?.body;
  const toggleApparel = (a: string) => setApparel(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const toggleProps   = (a: string) => setProps(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const reset = () => {
    setSearchType("PERSON"); setThreshold(80); setGender(""); setApparel([]); setProps([]);
    setSelectedTarget(-1); setActiveVIP(-1); setUploadedFace(null); setUploadedBody(null);
    setDateRange({ start:null, end:null }); setLicensePlate(""); setCamera(""); setSearched(false);
  };
  // Same reasoning as Smart Search / Re-ID Analysis: a named target's cascaded gender/apparel/
  // props/date can coincidentally match nothing in REID_DATA, even though we already have a photo
  // of exactly who we're looking for — reuse that photo instead of risking an empty result.
  const targetCandidates: RedfaceCandidate[] | null = searchType === "PERSON" && target
    ? buildTargetResultRows(target.face, target.body, target.gender === "Male" ? "M" : "F", 20)
        .filter(r => r.similarity >= threshold)
        .map(p => ({ id: p.id, url: p.url, cam: p.cam, time: p.time, similarity: p.similarity, plate: p.plate }))
    : null;
  const candidates = searched ? (targetCandidates ?? candidatesFromFilters({ searchType, gender, apparel, props, dateRange, threshold, licensePlate, camera })) : [];
  const handleSearch = () => {
    const c = targetCandidates ?? candidatesFromFilters({ searchType, gender, apparel, props, dateRange, threshold, licensePlate, camera });
    setSearched(true);
    setSelectedCandidate(c[0]?.id ?? null);
  };
  const selectedObj = candidates.find(c => c.id === selectedCandidate) ?? null;
  const isVehicle = searchType === "VEHICLE";

  return (
    <div style={{ backgroundColor:"white", border:BORDER, borderRadius:"16px", boxShadow:"0 12px 24px rgba(15,23,42,0.1)",
      width:"1092px", maxWidth:"100%", display:"flex", flexDirection:"column", maxHeight:"92vh", overflow:"hidden" }}>

      <div style={{ padding:"16px 24px", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ width:"34px", height:"34px", borderRadius:"8px", backgroundColor:"#f0f0ff",
            display:"flex", alignItems:"center", justifyContent:"center", color:"#5a3dfb", flexShrink:0 }}>
            <UserCogIconSm />
          </div>
          <div>
            <p style={{ fontSize:"16px", fontWeight:800, color:"#1d293b", margin:0, letterSpacing:"-0.32px" }}>Select Primary Target</p>
            <p style={{ fontSize:"10px", color:"#94a3b8", margin:0 }}>Search and select a new target to rebuild RedFace relationship graph</p>
          </div>
        </div>
        <button onClick={onCancel} style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", flexShrink:0 }}>
          <XCircleIconSm />
        </button>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div className="vca-hide-scrollbar" style={{ width:"340px", flexShrink:0, backgroundColor:"#f8fafc", borderRight:BORDER,
          padding:"20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"24px" }}>

          <div style={{ display:"flex", backgroundColor:"#f1f5f9", border:"1px solid #f1f5f9", borderRadius:"10px", padding:"1px", width:"100%" }}>
            {(["PERSON","VEHICLE"] as const).map(t => {
              const active = searchType === t;
              return (
                <button key={t} onClick={() => setSearchType(t)} style={{
                  flex:1, borderRadius:"9px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "white" : "transparent",
                  color: active ? "#5a3dfb" : "#64748a", fontWeight: active ? 700 : 600,
                  fontSize:"11px", letterSpacing:"-0.2px", padding:"6px 0",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"5px",
                }}>
                  {t === "PERSON" ? <PersonIconSm/> : <VehicleIconSm/>} {t}
                </button>
              );
            })}
          </div>

          {!isVehicle && (
            <>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                  <HistoryIconSm />
                  <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>Recent Targets</span>
                </div>
                <div style={{ display:"flex", gap:"8px" }}>
                  {RECENT_TARGETS_EN.slice(0, 2).map((t, i) => (
                    <button key={i} onClick={() => selectRecentTarget(i)} style={{
                      flex:1, display:"flex", alignItems:"center", gap:"8px", padding:"8px", borderRadius:"8px", cursor:"pointer",
                      backgroundColor:"white",
                      border: selectedTarget === i ? "1px solid #5a3dfb" : "1px solid #e2e8f0",
                      boxShadow: selectedTarget === i ? "0 2px 2px rgba(90,61,251,0.1)" : "none",
                    }}>
                      <img src={t.face} alt="" style={{ width:"32px", height:"32px", borderRadius:"4px", objectFit:"cover" }} />
                      <div style={{ textAlign:"left" }}>
                        <p style={{ fontSize:"12px", fontWeight:700, color:"#0e162a", margin:0 }}>{t.label}</p>
                        <p style={{ fontSize:"10px", color:"#94a3b8", margin:0 }}>{t.time}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                  <StarIconSm />
                  <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>VIP Quick Select</span>
                </div>
                <VipQuickSelectRow activeVIP={activeVIP} onSelect={selectVIP} compact />
              </div>

              <div style={{ height:"1px", backgroundColor:"#e2e8f0" }} />

              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>Search by image</span>
                <div style={{ display:"flex", gap:"10px" }}>
                  <div onClick={() => faceInputRef.current?.click()} style={hasFace
                    ? { flex:1, height:"84px", borderRadius:"8px", border:"1px solid #8c85ff", backgroundColor:"#f0f0ff", overflow:"hidden", position:"relative", cursor:"pointer" }
                    : { flex:1, height:"84px", borderRadius:"8px", border:"1px dashed #ccd5e1", backgroundColor:"white", cursor:"pointer",
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", color:"#94a3b8" }
                  }>
                    {hasFace ? (
                      <>
                        <img src={faceSrc} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        {!uploadedFace && <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(90,61,251,0.15)" }} />}
                      </>
                    ) : (
                      <>
                        <DefaultFaceIconSm />
                        <span style={{ fontSize:"10px", color:"#94a3b8" }}>Face</span>
                      </>
                    )}
                    <input ref={faceInputRef} type="file" accept="image/*" onChange={handleFaceUpload} style={{ display:"none" }} />
                  </div>
                  <div onClick={() => bodyInputRef.current?.click()} style={hasBody
                    ? { flex:1, height:"84px", borderRadius:"8px", border:"1px solid #8c85ff", backgroundColor:"#f0f0ff", overflow:"hidden", position:"relative", cursor:"pointer" }
                    : { flex:1, height:"84px", borderRadius:"8px", border:"1px dashed #ccd5e1", backgroundColor:"white", cursor:"pointer",
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", color:"#94a3b8" }
                  }>
                    {hasBody ? (
                      <>
                        <img src={bodySrc} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        {!uploadedBody && <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(90,61,251,0.15)" }} />}
                      </>
                    ) : (
                      <>
                        <FullBodyIconSm />
                        <span style={{ fontSize:"10px", color:"#94a3b8" }}>Full Body</span>
                      </>
                    )}
                    <input ref={bodyInputRef} type="file" accept="image/*" onChange={handleBodyUpload} style={{ display:"none" }} />
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>Search Period</span>
            <DateRangeTrigger value={dateRange} onApply={setDateRange} mode="split" size="sm" emptyText="Last 7 days" />
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>Camera</span>
            <CameraSelect value={camera} onChange={setCamera} size="sm" />
          </div>

          {isVehicle && (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>License Plate</span>
              <div style={{ display:"flex", alignItems:"center", gap:"6px", height:"34px", padding:"0 10px",
                borderRadius:"8px", border:BORDER, backgroundColor:"white" }}>
                <LicensePlateIconSm />
                <input
                  value={licensePlate}
                  onChange={e => setLicensePlate(e.target.value)}
                  placeholder="SGA 1234 X"
                  style={{ flex:1, border:"none", outline:"none", fontFamily:"monospace", fontSize:"11px",
                    fontWeight:500, color:"#0e162a", letterSpacing:"-0.22px" }}
                />
              </div>
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>Min Similarity</span>
              <span style={{ fontSize:"11px", fontWeight:800, color:"#5a3dfb", backgroundColor:"#f0f0ff", padding:"2px 6px", borderRadius:"4px" }}>{threshold}%</span>
            </div>
            <div style={{ backgroundColor:"white", borderRadius:"12px", padding:"12px 8px 10px", display:"flex", flexDirection:"column", gap:"12px" }}>
              <div style={{ position:"relative", height:"16px", display:"flex", alignItems:"center" }}>
                <div style={{ position:"absolute", left:0, right:0, height:"6px", borderRadius:"999px", backgroundColor:"#e2e8f0" }} />
                <div style={{ position:"absolute", left:0, height:"6px", borderRadius:"999px", backgroundColor:"#5a3dfb",
                  width:`${((threshold-30)/60)*100}%` }} />
                <div style={{ position:"absolute", left:`calc(${((threshold-30)/60)*100}% - 8px)`, width:"16px", height:"16px", borderRadius:"50%",
                  backgroundColor:"#5a3dfb", border:"2px solid white", boxShadow:"0 1px 3px rgba(0,0,0,0.19)" }} />
                <input type="range" min={30} max={90} step={10} value={threshold} onChange={e => setThreshold(parseInt(e.target.value))}
                  style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0, margin:0, cursor:"pointer" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                {[30,50,70,80,90].map(v => (
                  <span key={v} style={{ fontSize:"10px", fontWeight:600, color: v===threshold ? "#5a3dfb" : "#64748a" }}>{v}%</span>
                ))}
              </div>
            </div>
          </div>

          {!isVehicle && (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <button onClick={() => setAttrOpen(o => !o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                background:"none", border:"none", padding:0, cursor:"pointer" }}>
                <span style={{ fontSize:"10px", fontWeight:800, color:"#324055", letterSpacing:"-0.2px" }}>Quick Attribute Filters</span>
                <span style={{ display:"flex", color:"#94a3b8", transform: attrOpen ? "rotate(180deg)" : "none" }}>
                  <ChevronDownIconSm />
                </span>
              </button>
              {attrOpen && (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"#94a3b8" }}>Gender</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {GENDER_CHIPS.map(g => <AttrChip key={g} label={g} active={gender===g} onClick={() => setGender(gender===g ? "" : g)} size="sm" />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"#94a3b8" }}>Apparel</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {APPAREL_CHIPS.map(a => <AttrChip key={a} label={a} active={apparel.includes(a)} onClick={() => toggleApparel(a)} size="sm" />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"#94a3b8" }}>Props</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {PROPS_CHIPS.map(p => <AttrChip key={p} label={p} active={props.includes(p)} onClick={() => toggleProps(p)} size="sm" />)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button onClick={handleSearch} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
            height:"36px", borderRadius:"8px", border:"none", backgroundColor:"#0e162a", color:"white", cursor:"pointer",
            fontSize:"12px", fontWeight:700 }}>
            <SearchIconSm /> Search Candidates
          </button>
        </div>

        <div style={{ flex:1, padding:"20px", display:"flex", flexDirection:"column", gap:"16px", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={{ fontSize:"13px", fontWeight:800, color:"#1d293b" }}>Search Results</span>
              <span style={{ fontSize:"11px", fontWeight:800, color:"#5a3dfb", backgroundColor:"#f0f0ff", padding:"2px 6px", borderRadius:"4px" }}>{candidates.length}</span>
            </div>
            <span style={{ fontSize:"12px", fontWeight:600, color:"#94a3b8" }}>Click a target card to select</span>
          </div>
          <div className="vca-hide-scrollbar" style={{ flex:1, overflowY:"auto" }}>
            {candidates.length === 0 ? (
              <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", color:"#94a3b8" }}>
                <SearchIconSm />
                <span style={{ fontSize:"13px", fontWeight:600 }}>Click &quot;Search Candidates&quot; to find matching targets</span>
              </div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"16px" }}>
                {candidates.map(c => (
                  <CandidateCard key={c.id} c={c} selected={selectedCandidate === c.id} onClick={() => setSelectedCandidate(c.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding:"16px 24px", borderTop:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:500, color:"#0e162a" }}>
          <ResetIconSm /> Reset Filters
        </button>
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onCancel} style={{ padding:"8px 12px", borderRadius:"8px", border:"1px solid #ccd5e1", backgroundColor:"white", fontSize:"13px", fontWeight:700, color:"#475469", cursor:"pointer" }}>Cancel</button>
          <button disabled={!selectedObj} onClick={() => selectedObj && onConfirm(selectedObj)} style={{ padding:"8px 12px", borderRadius:"8px", border:"none",
            backgroundColor: selectedObj ? "#5a3dfb" : "#c4b5fd", color:"white", fontSize:"13px", fontWeight:700,
            cursor: selectedObj ? "pointer" : "default" }}>
            Set as Primary Target
          </button>
        </div>
      </div>
    </div>
  );
}

const REDFACE_FACES = MATCH_DATA.map(m => m.face);
const faceAt = (i: number) => REDFACE_FACES[i % REDFACE_FACES.length];
const REDFACE_TIER1 = [510, 142].map((count, i) => ({ id: i, face: faceAt(i), count }));
const REDFACE_TIER2 = [84, 62, 45, 31, 19, 12].map((count, i) => ({ id: i + 2, face: faceAt(i + 2), count }));
const REDFACE_TIER3 = [4,3,3,2,2,1,1,1,1,1,1,1,1,1,1].map((count, i) => ({ id: i + 8, face: faceAt(i + 8), count }));

type RedfaceNode = { id:number; face:string; count:number };
type TierMeta = {
  weight:number; bg:string; labelBg:string; labelColor:string; label:string; sublabel:string;
  nodeSize:number; nodeBorder:number; nodeColor:string; step:number; lineWidth:number;
  dashed?:boolean; dashFlow?:boolean; lineOpacity:number; stagger?:boolean;
};
type PyramidRow = { key:string; weight:number; nodes:RedfaceNode[]; meta: TierMeta|null };

const PYRAMID_TIER_META: Record<"tier1"|"tier2"|"tier3", TierMeta> = {
  tier1: { weight:2.2, bg:"#fff1f2", labelBg:"#ffe4e6", labelColor:"#e11d48", label:"TIER 1 · RED ZONE", sublabel:">100 CO-OCCURRENCES",
    nodeSize:52, nodeBorder:3, nodeColor:"#f43f5e", step:16, lineWidth:1.4, dashFlow:true, lineOpacity:0.85 },
  tier2: { weight:2.6, bg:"#fffbeb", labelBg:"#fef3c7", labelColor:"#ea580c", label:"TIER 2 · ORANGE ZONE", sublabel:"10-99 CO-OCCURRENCES",
    nodeSize:52, nodeBorder:2, nodeColor:"#f59e0b", step:11, lineWidth:1, dashed:true, lineOpacity:0.7 },
  tier3: { weight:3.4, bg:"#f8fafc", labelBg:"#e2e8f0", labelColor:"#475469", label:"TIER 3 · SLATE ZONE", sublabel:"<10 CO-OCCURRENCES",
    nodeSize:36, nodeBorder:2, nodeColor:"#94a3b8", step:6.5, lineWidth:0.6, lineOpacity:0.45, stagger:true },
};

function xAt(i: number, count: number, step: number) {
  if (count <= 1) return 50;
  return 50 - ((count - 1) * step) / 2 + i * step;
}

function PyramidCanvas({ primaryTarget, rows, onNodeClick, selectedNodeId }: { primaryTarget:{ name:string; face:string }; rows: PyramidRow[]; onNodeClick:(tier:string, node:RedfaceNode)=>void; selectedNodeId:number|null }) {
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0) || 1;
  const positioned = rows.reduce<{ list: Array<PyramidRow & { top:number; bottom:number; center:number }>; acc:number }>((state, r) => {
    const top = (state.acc / totalWeight) * 100;
    const nextAcc = state.acc + r.weight;
    const bottom = (nextAcc / totalWeight) * 100;
    return { list: [...state.list, { ...r, top, bottom, center: (top + bottom) / 2 }], acc: nextAcc };
  }, { list: [], acc: 0 }).list;
  const apexRow = positioned.find(r => r.key === "apex")!;
  const tierRows = positioned.filter(r => r.key !== "apex");

  const nodeY = (r: (typeof positioned)[number], i: number) => {
    if (!r.meta?.stagger) return r.center;
    const band = r.bottom - r.top;
    return r.top + band * (i % 2 === 0 ? 0.32 : 0.72);
  };

  return (
    <div style={{ position:"relative", flex:1, minHeight:0, overflow:"hidden" }}>
      <style>{`
        @keyframes redfaceDashFlow { to { stroke-dashoffset: -20; } }
        .redface-dash-flow { stroke-dasharray: 6; animation: redfaceDashFlow 1.2s linear infinite; }
        .redface-avatar-hover { transition: transform 0.15s ease; cursor: pointer; }
        .redface-avatar-hover:hover { transform: scale(2.2); z-index: 30; }
      `}</style>

      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column" }}>
        {positioned.map(r => (
          <div key={r.key} style={{ flexGrow:r.weight, flexShrink:0, position:"relative",
            backgroundColor: r.meta?.bg ?? "#f0f0ff", borderBottom: r.key !== tierRows[tierRows.length-1]?.key ? "1px solid rgba(15,23,42,0.05)" : "none",
            display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", boxSizing:"border-box" }}>
            <span style={{ fontSize:"10px", fontWeight:800, letterSpacing:"0.4px",
              backgroundColor: r.meta?.labelBg ?? "rgba(255,255,255,0.8)", color: r.meta?.labelColor ?? "#818cf8",
              padding:"4px 8px", borderRadius:"4px" }}>
              {r.meta?.label ?? "APEX · PRIMARY TARGET ZONE"}
            </span>
            <span style={{ fontSize:"10px", fontWeight:800, letterSpacing:"0.4px",
              backgroundColor: r.meta?.labelBg ?? "rgba(255,255,255,0.8)", color: r.meta?.labelColor ?? "#818cf8",
              padding:"4px 8px", borderRadius:"4px" }}>
              {r.meta?.sublabel ?? "CENTRAL TARGET PROFILE"}
            </span>
          </div>
        ))}
      </div>

      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} preserveAspectRatio="none" viewBox="0 0 100 100">
        {tierRows.map(r => r.nodes.map((n, i) => {
          const x = xAt(i, r.nodes.length, r.meta!.step);
          const y = nodeY(r, i);
          return (
            <line key={`${r.key}-${n.id}`} x1="50" y1={apexRow.center} x2={x} y2={y}
              stroke={r.meta!.nodeColor} strokeWidth={r.meta!.lineWidth}
              strokeDasharray={r.meta!.dashed ? "3,3" : undefined}
              className={r.meta!.dashFlow ? "redface-dash-flow" : undefined}
              opacity={r.meta!.lineOpacity} vectorEffect="non-scaling-stroke" />
          );
        }))}
      </svg>

      <div style={{ position:"absolute", left:"50%", top:`${apexRow.center}%`, transform:"translate(-50%,-50%)",
        display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", zIndex:5 }}>
        <div className="redface-avatar-hover" style={{ width:64, height:64, borderRadius:"12px", border:"3px solid #5a3dfb", backgroundColor:"white",
          boxSizing:"border-box", boxShadow:"0 8px 20px rgba(90,61,251,0.25)" }}>
          <img src={primaryTarget.face} alt="" style={{ width:"100%", height:"100%", borderRadius:"9px", objectFit:"cover", display:"block" }} />
        </div>
        <span style={{ fontSize:"9px", fontWeight:800, color:"white", backgroundColor:"#5a3dfb", padding:"2px 8px", borderRadius:"999px", letterSpacing:"0.4px" }}>PRIMARY</span>
      </div>

      {tierRows.map(r => r.nodes.map((n, i) => {
        const x = xAt(i, r.nodes.length, r.meta!.step);
        const y = nodeY(r, i);
        return (
          <div key={`${r.key}-node-${n.id}`} style={{ position:"absolute", left:`${x}%`, top:`${y}%`, transform:"translate(-50%,-50%)",
            display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", zIndex: r.key === "tier1" ? 4 : r.key === "tier2" ? 3 : 2 }}>
            <div className="redface-avatar-hover" onClick={() => onNodeClick(r.key, n)} style={{ width:r.meta!.nodeSize, height:r.meta!.nodeSize, borderRadius:"10px",
              border:`${r.meta!.nodeBorder}px solid ${r.meta!.nodeColor}`, backgroundColor:"white", boxSizing:"border-box",
              boxShadow: n.id === selectedNodeId ? "0 0 0 3px rgba(90,61,251,0.45), 0 2px 8px rgba(15,23,42,0.15)" : "0 2px 8px rgba(15,23,42,0.15)" }}>
              <img src={n.face} alt="" style={{ width:"100%", height:"100%", borderRadius:`${10 - r.meta!.nodeBorder}px`, objectFit:"cover", display:"block" }} />
            </div>
            <span style={{ fontSize:"10px", fontWeight:800, color:"white", backgroundColor:r.meta!.nodeColor, padding:"3px 7px", borderRadius:"999px" }}>{n.count}</span>
          </div>
        );
      }))}
    </div>
  );
}

function LinkChainIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
      <path d="M12.8334 14.583C13.0839 14.9179 13.4035 15.195 13.7706 15.3955C14.1376 15.5961 14.5435 15.7153 14.9606 15.7452C15.3778 15.7751 15.7965 15.7149 16.1884 15.5687C16.5802 15.4225 16.9361 15.1938 17.2318 14.898L18.9818 13.148C19.5131 12.5979 19.807 11.8611 19.8004 11.0964C19.7937 10.3317 19.487 9.60012 18.9462 9.05935C18.4055 8.51858 17.6739 8.21183 16.9092 8.20519C16.1444 8.19854 15.4077 8.49253 14.8576 9.02382L13.8543 10.0213M15.1669 13.4165C14.9164 13.0816 14.5967 12.8044 14.2297 12.6039C13.8627 12.4034 13.4568 12.2842 13.0397 12.2543C12.6225 12.2244 12.2038 12.2846 11.8119 12.4308C11.4201 12.5769 11.0642 12.8057 10.7685 13.1015L9.01854 14.8515C8.48725 15.4016 8.19326 16.1383 8.19991 16.9031C8.20655 17.6678 8.5133 18.3993 9.05407 18.9401C9.59484 19.4809 10.3264 19.7876 11.0911 19.7943C11.8559 19.8009 12.5926 19.5069 13.1427 18.9756L14.1402 17.9781" stroke="currentColor" strokeLinecap="round"/>
    </svg>
  );
}

const TIER_LINK_META: Record<string, { label:string; correlation:string }> = {
  tier1: { label:"TIER 1 LINK", correlation:"Strong Correlation" },
  tier2: { label:"TIER 2 LINK", correlation:"Moderate Correlation" },
  tier3: { label:"TIER 3 LINK", correlation:"Weak Correlation" },
};

const COOCCUR_CAMERAS = [
  { code:"CAM-GEY-024", location:"Geylang Rd Int." },
  { code:"CAM-ORC-011", location:"Orchard Rd Junction" },
  { code:"CAM-BGS-007", location:"Bugis St Crossing" },
  { code:"CAM-CBD-019", location:"Raffles Pl Int." },
];

const JOINT_EVENT_DATES = [
  { first:"2026-07-15 08:30", last:"2026-07-28 12:44" },
  { first:"2026-07-10 14:12", last:"2026-07-26 19:05" },
  { first:"2026-07-18 07:50", last:"2026-07-30 21:37" },
];

function assocId(n: RedfaceNode) {
  return `AS${String((100000 + n.id * 6421) % 900000 + 100000).padStart(6,"0")}`;
}

type CooccurEvent = { location:string; camCode:string; date:string; time:string };

const COOCCUR_DATES = ["07-15","07-18","07-20","07-22","07-25","07-27","07-28","07-30"];
const COOCCUR_TIMES = ["07:52","08:30","08:42","12:05","14:18","18:15","19:40","21:40"];

function buildCooccurEvents(node: RedfaceNode): CooccurEvent[] {
  const total = Math.min(7, Math.max(3, Math.round(node.count / 15) + 3));
  const primaryIdx = node.id % COOCCUR_CAMERAS.length;
  return Array.from({ length: total }, (_, i) => {
    const isPrimary = i < Math.ceil(total * 0.6);
    const idx = isPrimary ? primaryIdx : (primaryIdx + 1 + (i % (COOCCUR_CAMERAS.length - 1))) % COOCCUR_CAMERAS.length;
    const cam = COOCCUR_CAMERAS[idx];
    const date = COOCCUR_DATES[(node.id + i * 3) % COOCCUR_DATES.length];
    const time = COOCCUR_TIMES[(node.id + i * 5) % COOCCUR_TIMES.length];
    return { location: cam.location, camCode: cam.code, date: `2026-${date}`, time };
  });
}

function groupCooccurEvents(events: CooccurEvent[]) {
  const groups: Array<{ location:string; camCode:string; events:CooccurEvent[] }> = [];
  events.forEach(e => {
    const g = groups.find(g => g.location === e.location);
    if (g) g.events.push(e); else groups.push({ location:e.location, camCode:e.camCode, events:[e] });
  });
  return groups.sort((a, b) => b.events.length - a.events.length);
}

function timeBucket(time: string) {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function dominantTimeBucket(events: CooccurEvent[]) {
  const counts: Record<string, number> = {};
  events.forEach(e => { const b = timeBucket(e.time); counts[b] = (counts[b] ?? 0) + 1; });
  const [bucket, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { bucket, pct: Math.round((count / events.length) * 100) };
}

function JointEvidencePanel({ primary, tier, node }: {
  primary: { name:string; face:string }; tier: "tier1"|"tier2"|"tier3"; node: RedfaceNode;
}) {
  const meta = TIER_LINK_META[tier];
  const primaryId = primary.name.match(/\(([^)]+)\)/)?.[1] ?? "TS------";
  const events = buildCooccurEvents(node);
  const groups = groupCooccurEvents(events);
  const topGroup = groups[0];
  const { bucket, pct } = dominantTimeBucket(events);
  const sortedByDate = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const firstSeen = sortedByDate[0];
  const lastSeen = sortedByDate[sortedByDate.length - 1];

  return (
    <div className="vca-hide-scrollbar" style={{ width:"330px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER,
      padding:"20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:"16px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.32px" }}>Joint Evidence Inspector</span>
        <span style={{ fontSize:"11px", fontWeight:800, color:"#f43f5e", backgroundColor:"#ffeaea", padding:"3px 10px", borderRadius:"999px", whiteSpace:"nowrap" }}>{node.count} EVENTS</span>
      </div>

      <div style={{ border:BORDER, borderRadius:"8px", backgroundColor:"#f8fafc", padding:"16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
          <img src={primary.face} alt="" style={{ width:"54px", height:"54px", borderRadius:"5px", objectFit:"cover", border:"2px solid #f43f5e" }} />
          <span style={{ fontSize:"12px", fontWeight:800, color:"#0e162a" }}>{primaryId}</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
          <span style={{ fontSize:"10px", fontWeight:800, color:"#f43f5e", letterSpacing:"0.4px" }}>{meta.label}</span>
          <div style={{ width:"28px", height:"28px", borderRadius:"50%", backgroundColor:"#ffeaea", display:"flex", alignItems:"center", justifyContent:"center", color:"#f43f5e" }}>
            <LinkChainIconSm />
          </div>
          <span style={{ fontSize:"11px", color:"#64748a" }}>{meta.correlation}</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
          <img src={node.face} alt="" style={{ width:"54px", height:"54px", borderRadius:"5px", objectFit:"cover", border:"2px solid #ef4444" }} />
          <span style={{ fontSize:"12px", fontWeight:800, color:"#0e162a" }}>{assocId(node)}</span>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
        <span style={{ fontSize:"14px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.28px" }}>Co-capture Pattern</span>

        <div style={{ display:"flex", alignItems:"flex-start", gap:"8px", backgroundColor:"#f0f0ff", border:"1px solid #ded9ff", borderRadius:"8px", padding:"10px 12px" }}>
          <span style={{ color:"#5a3dfb", flexShrink:0, marginTop:"1px" }}><LinkChainIconSm /></span>
          <span style={{ fontSize:"12px", color:"#324055", lineHeight:1.5 }}>
            Mostly seen together at <strong>{topGroup.location}</strong> ({topGroup.events.length}x), mainly during <strong>{bucket}</strong> hours ({pct}%)
          </span>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div>
            <p style={{ margin:0, fontSize:"11px", color:"#94a3b8" }}>First seen</p>
            <p style={{ margin:"2px 0 0", fontSize:"13px", fontWeight:700, color:"#0e162a" }}>{firstSeen.date} {firstSeen.time}</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ margin:0, fontSize:"11px", color:"#94a3b8" }}>Last seen</p>
            <p style={{ margin:"2px 0 0", fontSize:"13px", fontWeight:700, color:"#0e162a" }}>{lastSeen.date} {lastSeen.time}</p>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {groups.map(g => (
            <div key={g.location} style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", fontWeight:700, color:"#0e162a" }}>
                  <CameraGlyph size={13} /> {g.location}
                </span>
                <span style={{ fontSize:"10px", fontWeight:800, color:"#475469", backgroundColor:"#f1f5f9", padding:"2px 7px", borderRadius:"999px" }}>{g.events.length}x</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"4px", paddingLeft:"20px" }}>
                {g.events.map((e, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:"11px", color:"#94a3b8" }}>{e.camCode}</span>
                    <span style={{ fontSize:"11px", color:"#64748a" }}>{e.date} {e.time}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TIER_BADGE_META: Record<"tier1"|"tier2"|"tier3", { bg:string; text:string; label:string }> = {
  tier1: { bg:"#ffeaea", text:"#f43f5e", label:"Tier 1 (Red Zone)" },
  tier2: { bg:"#fef3c7", text:"#ea580c", label:"Tier 2 (Orange Zone)" },
  tier3: { bg:"#f1f5f9", text:"#475469", label:"Tier 3 (Slate Zone)" },
};
const COCAPTURE_COLOR: Record<"tier1"|"tier2"|"tier3", string> = {
  tier1:"#f43f5e", tier2:"#64748a", tier3:"#64748a",
};

function DataGridView({ rows, onInspect, selectedNodeId }: {
  rows: Array<{ tier:"tier1"|"tier2"|"tier3"; node:RedfaceNode }>;
  onInspect: (tier:string, node:RedfaceNode) => void;
  selectedNodeId: number|null;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", width:"100%" }}>
      <div style={{ backgroundColor:"#f8fafc", borderTop:"1px solid #f1f5f9", padding:"12px 20px",
        display:"flex", gap:"8px", fontSize:"12px", fontWeight:800, color:"#475469" }}>
        <span style={{ width:"50px", flexShrink:0 }}>Rank</span>
        <span style={{ flex:1 }}>Associate target</span>
        <span style={{ width:"180px", flexShrink:0 }}>Hierarchy tier &amp; zone</span>
        <span style={{ width:"110px", flexShrink:0 }}>Co-captures</span>
        <span style={{ width:"160px", flexShrink:0 }}>Top camera node</span>
        <span style={{ width:"150px", flexShrink:0 }}>First detected</span>
        <span style={{ width:"150px", flexShrink:0 }}>Last detected</span>
        <span style={{ width:"80px", flexShrink:0, textAlign:"center" }}>Action</span>
      </div>
      {rows.map((r, i) => {
        const badge = TIER_BADGE_META[r.tier];
        const cam = COOCCUR_CAMERAS[r.node.id % COOCCUR_CAMERAS.length];
        const dates = JOINT_EVENT_DATES[r.node.id % JOINT_EVENT_DATES.length];
        const visits = Math.max(1, Math.round(r.node.count * 0.75));
        return (
          <div key={`${r.tier}-${r.node.id}`} style={{ backgroundColor: i === 0 ? "#f0f0ff" : "white", borderTop:BORDER,
            padding:"10px 20px", display:"flex", gap:"8px", alignItems:"center" }}>
            <span style={{ width:"50px", flexShrink:0, fontSize:"12px", fontWeight:700, color:"#64748a" }}>{`#${String(i+1).padStart(2,"0")}`}</span>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:"10px", minWidth:0 }}>
              <img src={r.node.face} alt="" style={{ width:"28px", height:"28px", borderRadius:"999px", objectFit:"cover", flexShrink:0 }} />
              <span style={{ fontSize:"13px", fontWeight:700, color:"#0e162a", whiteSpace:"nowrap" }}>{`Associate #${String(i+1).padStart(2,"0")}`}</span>
            </div>
            <div style={{ width:"180px", flexShrink:0 }}>
              <span style={{ fontSize:"10px", fontWeight:800, color:badge.text, backgroundColor:badge.bg, padding:"2px 6px", borderRadius:"4px" }}>{badge.label}</span>
            </div>
            <span style={{ width:"110px", flexShrink:0, fontSize:"13px", fontWeight:700, color:COCAPTURE_COLOR[r.tier] }}>{r.node.count} Events</span>
            <span style={{ width:"160px", flexShrink:0, fontSize:"12px", fontWeight:600, color:"#0e162a" }}>{`C0${(r.node.id % 5) + 1} ${cam.location.split(" ")[0]} (${visits}x)`}</span>
            <span style={{ width:"150px", flexShrink:0, fontSize:"12px", fontWeight:600, color:"#64748a" }}>{dates.first}</span>
            <span style={{ width:"150px", flexShrink:0, fontSize:"12px", fontWeight:600, color:"#64748a" }}>{dates.last}</span>
            <div style={{ width:"80px", flexShrink:0, display:"flex", justifyContent:"center" }}>
              <button onClick={() => onInspect(r.tier, r.node)} style={{ padding:"4px 10px", borderRadius:"6px", border:"none",
                backgroundColor: r.node.id === selectedNodeId ? "#5a3dfb" : "#0e162a", color:"white", cursor:"pointer",
                fontSize:"12px", fontWeight:700 }}>
                Inspect
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssociateGraphView({ primaryTarget, onSwitchTarget }: { primaryTarget:{ name:string; face:string }; onSwitchTarget:()=>void }) {
  const [tier1On, setTier1On] = useState(true);
  const [tier2On, setTier2On] = useState(true);
  const [tier3On, setTier3On] = useState(true);
  const [minHits, setMinHits] = useState(1);
  const [view, setView] = useState<"pyramid"|"grid">("pyramid");
  const [selectedNode, setSelectedNode] = useState<{ tier:"tier1"|"tier2"|"tier3"; node:RedfaceNode } | null>(null);
  const toggleSelectedNode = (tier: string, node: RedfaceNode) =>
    setSelectedNode(prev => prev && prev.node.id === node.id ? null : { tier: tier as "tier1"|"tier2"|"tier3", node });

  const tier1 = REDFACE_TIER1.filter(n => n.count >= minHits);
  const tier2 = REDFACE_TIER2.filter(n => n.count >= minHits);
  const tier3 = REDFACE_TIER3.filter(n => n.count >= minHits);
  const totalAll = REDFACE_TIER1.length + REDFACE_TIER2.length + REDFACE_TIER3.length;
  const totalVisible = (tier1On ? tier1.length : 0) + (tier2On ? tier2.length : 0) + (tier3On ? tier3.length : 0);
  const reset = () => { setTier1On(true); setTier2On(true); setTier3On(true); setMinHits(1); };

  const visibleRows: PyramidRow[] = [
    { key:"apex", weight:1.3, nodes:[], meta:null },
    ...(tier1On ? [{ key:"tier1", weight:PYRAMID_TIER_META.tier1.weight, nodes:tier1, meta:PYRAMID_TIER_META.tier1 }] : []),
    ...(tier2On ? [{ key:"tier2", weight:PYRAMID_TIER_META.tier2.weight, nodes:tier2, meta:PYRAMID_TIER_META.tier2 }] : []),
    ...(tier3On ? [{ key:"tier3", weight:PYRAMID_TIER_META.tier3.weight, nodes:tier3, meta:PYRAMID_TIER_META.tier3 }] : []),
  ];
  const hasVisibleTier = tier1On || tier2On || tier3On;
  const gridRows: Array<{ tier:"tier1"|"tier2"|"tier3"; node:RedfaceNode }> = [
    ...(tier1On ? tier1.map(node => ({ tier:"tier1" as const, node })) : []),
    ...(tier2On ? tier2.map(node => ({ tier:"tier2" as const, node })) : []),
    ...(tier3On ? tier3.map(node => ({ tier:"tier3" as const, node })) : []),
  ];

  const tierRows = [
    { on:tier1On, toggle:() => setTier1On(o => !o), bg:"#ffebee", text:"#e11d48", label:"Tier 1 Red Zone (>100)", count:REDFACE_TIER1.length, badgeBg:"#f43f5e" },
    { on:tier2On, toggle:() => setTier2On(o => !o), bg:"#fffbeb", text:"#ea580c", label:"Tier 2 Orange Zone (10~99)", count:REDFACE_TIER2.length, badgeBg:"#f59e0b" },
    { on:tier3On, toggle:() => setTier3On(o => !o), bg:"#f1f5f9", text:"#324055", label:"Tier 3 Slate Zone (<10)", count:REDFACE_TIER3.length, badgeBg:"#475569" },
  ];

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
      <div className="vca-hide-scrollbar" style={{ width:"280px", flexShrink:0, backgroundColor:"white", borderRight:BORDER,
        padding:"20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <SlidersIconSm />
            <span style={{ fontSize:"14px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.28px" }}>Associate Filter</span>
          </div>
          <span style={{ fontSize:"12px", fontWeight:700, color:"#475469", backgroundColor:"#f1f5f9", padding:"2px 8px", borderRadius:"10px" }}>{totalVisible}/{totalAll}</span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"8px", border:BORDER, borderRadius:"6px", padding:"10px 12px" }}>
          <SearchIconSm />
          <span style={{ fontSize:"12px", color:"#94a3b8" }}>Search associate ID or name...</span>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"10px", width:"100%" }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:"#324055", letterSpacing:"-0.28px" }}>Zone Tiers</span>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
            {tierRows.map(row => (
              <button key={row.label} onClick={row.toggle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"8px", borderRadius:"6px", backgroundColor: row.on ? row.bg : "white", border: row.on ? "none" : BORDER, cursor:"pointer", width:"100%" }}>
                <span style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ color: row.on ? row.text : "#cbd5e1", display:"flex" }}><CheckSquareIconSm /></span>
                  <span style={{ fontSize:"12px", fontWeight:700, color: row.on ? row.text : "#94a3b8", letterSpacing:"-0.24px" }}>{row.label}</span>
                </span>
                <span style={{ fontSize:"10px", fontWeight:800, color:"white", backgroundColor: row.on ? row.badgeBg : "#cbd5e1", padding:"2px 6px", borderRadius:"10px" }}>{row.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"10px", width:"100%" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:"14px", fontWeight:700, color:"#324055", letterSpacing:"-0.28px" }}>Min. Co-occurrences</span>
            <span style={{ fontSize:"11px", color:"#5a3dfb" }}>{minHits} Hits</span>
          </div>
          <div style={{ position:"relative", height:"14px", display:"flex", alignItems:"center" }}>
            <div style={{ position:"absolute", left:0, right:0, height:"4px", borderRadius:"2px", backgroundColor:"#e2e8f0" }} />
            <div style={{ position:"absolute", left:0, height:"4px", borderRadius:"2px", backgroundColor:"#5a3dfb",
              width:`${((minHits-1)/149)*100}%` }} />
            <div style={{ position:"absolute", left:`calc(${((minHits-1)/149)*100}% - 5px)`, width:"10px", height:"10px", borderRadius:"50%",
              backgroundColor:"white", border:"2px solid #5a3dfb" }} />
            <input type="range" min={1} max={150} value={minHits} onChange={e => setMinHits(parseInt(e.target.value))}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0, margin:0, cursor:"pointer" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"10px", fontWeight:600, color:"#475469" }}>
            <span>1</span><span>10</span><span>50</span><span>100</span><span>150+</span>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:"#324055", letterSpacing:"-0.28px" }}>Sort Associates by</span>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", border:BORDER, borderRadius:"6px", padding:"10px 12px" }}>
            <span style={{ fontSize:"12px", fontWeight:700, color:"#0e162a" }}>Co-occurrence Frequency (High → Low)</span>
            <ChevronDownIconSm />
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", width:"100%", paddingTop:"4px" }}>
          <button onClick={reset} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
            padding:"10px", borderRadius:"6px", border:BORDER, backgroundColor:"white", cursor:"pointer", fontSize:"12px", fontWeight:500, color:"#475469" }}>
            <ResetIconSm /> Reset Filters
          </button>
        </div>
      </div>

      <div className="vca-hide-scrollbar" style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto" }}>
        <div style={{ backgroundColor:"white", borderBottom:BORDER, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <img src={primaryTarget.face} alt="" style={{ width:"44px", height:"44px", borderRadius:"6px", objectFit:"cover", border:"2px solid #f43f5e" }} />
            <div>
              <span style={{ display:"inline-flex", fontSize:"10px", fontWeight:800, color:"white", backgroundColor:"#f43f5e", padding:"2px 6px", borderRadius:"4px", letterSpacing:"-0.2px" }}>PRIMARY TARGET</span>
              <p style={{ fontSize:"14px", fontWeight:800, color:"#0e162a", margin:"4px 0 0", letterSpacing:"-0.28px" }}>{primaryTarget.name}</p>
            </div>
            <button onClick={onSwitchTarget} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 12px",
              borderRadius:"6px", backgroundColor:"#f1f5f9", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:600, color:"#475469" }}>
              <SearchIconSm /> Switch Primary Target
            </button>
          </div>
          <div style={{ display:"flex", gap:"2px", backgroundColor:"#f1f5f9", borderRadius:"8px", padding:"4px" }}>
            {(["pyramid","grid"] as const).map(v => {
              const active = view === v;
              return (
                <button key={v} onClick={() => setView(v)} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px",
                  borderRadius:"6px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "white" : "transparent", color: active ? "#0f172a" : "#64748a",
                  fontSize:"12px", fontWeight: active ? 700 : 600 }}>
                  {v === "pyramid" ? <LayersIconSm/> : <TableIconSm/>} {v === "pyramid" ? "Pyramid & Zone" : "Data Grid"}
                </button>
              );
            })}
          </div>
        </div>

        {view === "pyramid" ? (
          hasVisibleTier ? (
            <PyramidCanvas primaryTarget={primaryTarget} rows={visibleRows}
              selectedNodeId={selectedNode?.node.id ?? null}
              onNodeClick={toggleSelectedNode} />
          ) : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:"13px", fontWeight:600 }}>
              No tiers selected
            </div>
          )
        ) : (
          hasVisibleTier ? (
            <DataGridView rows={gridRows} selectedNodeId={selectedNode?.node.id ?? null} onInspect={toggleSelectedNode} />
          ) : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:"13px", fontWeight:600 }}>
              No tiers selected
            </div>
          )
        )}
      </div>

      {selectedNode && (
        <JointEvidencePanel primary={primaryTarget} tier={selectedNode.tier} node={selectedNode.node} />
      )}
    </div>
  );
}

function RedFaceContent({ seedCard, onSeedConsumed }: { seedCard?: (typeof REID_DATA)[number] | null; onSeedConsumed?: () => void } = {}) {
  const [primaryTarget, setPrimaryTarget] = useState<{ name:string; face:string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true);
  // "UNSET" (not seedCard's own initial value) so the block below still fires on this
  // component's very first render even when seedCard is ALREADY set at mount time — this tab
  // mounts fresh on every deep-link (it doesn't exist until activeTab switches to it), so
  // seeding it from "the previous seedCard" would just equal the incoming one and never fire.
  const [prevSeedCard, setPrevSeedCard] = useState<typeof seedCard | "UNSET">("UNSET");

  const handleConfirm = (c: RedfaceCandidate) => {
    setPrimaryTarget({ name:`Suspect #1 (TS${String(c.id).padStart(6,"0")})`, face:c.url });
    setPickerOpen(false);
  };

  // Deep-link from a Live Monitoring card's "RedFace" hover button — skip the picker and go
  // straight to this person as the confirmed primary target. Uses the card's full photo (url),
  // not its unrelated `face` stock-photo field, so the "same person" stays visually consistent.
  if (seedCard !== prevSeedCard) {
    setPrevSeedCard(seedCard);
    if (seedCard) {
      const label = seedCard.status === "VIP" ? "VIP Match" : `Suspect (TS${String(seedCard.id).padStart(6,"0")})`;
      setPrimaryTarget({ name: label, face: seedCard.url });
      setPickerOpen(false);
    }
  }
  useEffect(() => {
    if (seedCard) onSeedConsumed?.();
  }, [seedCard, onSeedConsumed]);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", backgroundColor:"#f8fafc", overflow:"hidden" }}>
      {primaryTarget && <AssociateGraphView primaryTarget={primaryTarget} onSwitchTarget={() => setPickerOpen(true)} />}
      {pickerOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget && primaryTarget) setPickerOpen(false); }}
          style={{ position:"absolute", inset:0, zIndex:50, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px", paddingTop:"6vh", overflow:"auto" }}
        >
          <div style={{ position:"absolute", inset:0, backdropFilter:"blur(9px)", backgroundColor:"rgba(205,205,205,0.4)" }} />
          <div style={{ position:"relative" }}>
            <PrimaryTargetPickerModal onConfirm={handleConfirm} onCancel={() => primaryTarget && setPickerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab icons ──────────────────────────────────────────────────
const TAB_ICONS: Record<DataTab, React.ReactNode> = {
  "Live Monitoring": (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 2V14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 8H14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 2H3.33333C2.59695 2 2 2.59695 2 3.33333V12.6667C2 13.403 2.59695 14 3.33333 14H12.6667C13.403 14 14 13.403 14 12.6667V3.33333C14 2.59695 13.403 2 12.6667 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  "Re-ID Analysis": (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.6665 4H10.6665C11.0201 4 11.3593 4.14048 11.6093 4.39052C11.8594 4.64057 11.9998 4.97971 11.9998 5.33333V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12H5.33333C4.97971 12 4.64057 11.8595 4.39052 11.6095C4.14048 11.3594 4 11.0203 4 10.6667V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  "Smart Search": (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M13.9998 13.9998L11.1064 11.1064" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  "RedFace": (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M13.5609 4.32275C14.2801 5.40986 14.6649 6.68395 14.6676 7.98743C14.6703 9.2909 14.2908 10.5666 13.5761 11.6566C12.8613 12.7467 11.8427 13.6033 10.6463 14.1206C9.4498 14.6378 8.12795 14.7929 6.84424 14.5668" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.43921 11.6774C1.72001 10.59 1.33541 9.31562 1.33302 8.01191C1.33063 6.7082 1.71054 5.4324 2.42575 4.34238C3.14096 3.25236 4.16008 2.39597 5.35698 1.87917C6.55389 1.36237 7.87606 1.20786 9.15988 1.43474" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6668 4.66667C13.4032 4.66667 14.0002 4.06971 14.0002 3.33333C14.0002 2.59695 13.4032 2 12.6668 2C11.9304 2 11.3335 2.59695 11.3335 3.33333C11.3335 4.06971 11.9304 4.66667 12.6668 4.66667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 14.0002C4.06971 14.0002 4.66667 13.4032 4.66667 12.6668C4.66667 11.9304 4.06971 11.3335 3.33333 11.3335C2.59695 11.3335 2 11.9304 2 12.6668C2 13.4032 2.59695 14.0002 3.33333 14.0002Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ── Main DataPage ──────────────────────────────────────────────
const DATA_TABS: DataTab[] = ["Live Monitoring","Re-ID Analysis","Smart Search","RedFace"];

// 데이터 연결(UV-38): onGoRedmap이 카드의 대상 참조(name+ref)를 함께 전달 — ref 없으면 플레인 이동
export default function DataPage({ onGoRedmap, onGoAnalyzeFrame }: { onGoRedmap?: (name?: string, ref?: TrackTargetRef) => void; onGoAnalyzeFrame?: (location: string) => void } = {}) {
  // Always lands on Live Monitoring — deliberately not persisted, unlike Best Frame's
  // camera selection. Switching sub-tabs while on this screen is normal component state;
  // leaving Data and coming back should start fresh at Live Monitoring.
  const [activeTab, setActiveTab] = useState<DataTab>("Live Monitoring");
  // Carries a Live Monitoring card's data into whichever tab its hover-action button targets,
  // so that tab lands on real results for that person instead of a bare, empty search form.
  const [seedCard, setSeedCard] = useState<(typeof REID_DATA)[number] | null>(null);
  const handleNavigateFromCard = (tab: DataTab, card: (typeof REID_DATA)[number]) => {
    setSeedCard(card);
    setActiveTab(tab);
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", backgroundColor:"#f8fafc" }}>

      {/* Sub-nav tabs */}
      <div style={{ backgroundColor:"white", borderBottom:BORDER, display:"flex", alignItems:"center", padding:"0 20px", height:"46px", flexShrink:0 }}>
        {DATA_TABS.map(tab => {
          const active = activeTab===tab;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ height:"100%", padding:"0 18px", background:"none", border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", gap:"6px",
              borderBottom: active?"2px solid #0e162a":"2px solid transparent",
              color: active?"#0e162a":"#64748a",
              fontWeight: 600,
              fontSize:"13px", letterSpacing:"-0.26px", transition:"color 0.15s" }}>
              {TAB_ICONS[tab]}
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab==="Live Monitoring" && <LiveMonitoringTab onNavigateTab={handleNavigateFromCard} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
      {activeTab==="Re-ID Analysis"   && <ReIDContent seedCard={seedCard} onSeedConsumed={() => setSeedCard(null)} onNavigateTab={setActiveTab} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
      {activeTab==="Smart Search"     && <SmartSearchContent seedCard={seedCard} onSeedConsumed={() => setSeedCard(null)} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
      {activeTab==="RedFace"          && <RedFaceContent seedCard={seedCard} onSeedConsumed={() => setSeedCard(null)} />}
    </div>
  );
}
