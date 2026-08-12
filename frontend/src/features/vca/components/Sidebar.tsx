
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Search, Crown } from "lucide-react";
import { dashboardStats, devices, type Device, type DeviceStatus, type FilterType, type SidebarTab, type LiveEvent, FACE_PHOTOS, getFacePhoto, formatTimeAgo } from "../lib/mockData";
import { useVcaStore, vcaEventsToLiveEvents } from "../lib/vcaStore";
import { useLiveDashboardStats } from "../../../lib/vca-bridge/useLiveDashboardStats";
import { useLiveDevices } from "../../../lib/vca-bridge/useLiveDevices";

const BORDER = "1px solid #E2E8F0";
const PAGE_SIZE = 12;
const SIDEBAR_TAB_STORAGE_KEY = "vca:sidebarTab";
const SIDEBAR_TAB_CHANGE_EVENT = "vca:sidebarTabChange";

function subscribeToSidebarTab(callback: () => void) {
  window.addEventListener(SIDEBAR_TAB_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SIDEBAR_TAB_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function getSidebarTabSnapshot(): SidebarTab {
  return localStorage.getItem(SIDEBAR_TAB_STORAGE_KEY) === "SYSTEM" ? "SYSTEM" : "EVENTS";
}
function getSidebarTabServerSnapshot(): SidebarTab {
  return "EVENTS";
}

// A page refresh lands back on whichever tab was active, via localStorage — useSyncExternalStore
// keeps server/client hydration in agreement on first paint, then picks up the real value.
function usePersistedSidebarTab(): [SidebarTab, (tab: SidebarTab) => void] {
  const tab = useSyncExternalStore(subscribeToSidebarTab, getSidebarTabSnapshot, getSidebarTabServerSnapshot);
  const setTab = (next: SidebarTab) => {
    localStorage.setItem(SIDEBAR_TAB_STORAGE_KEY, next);
    window.dispatchEvent(new Event(SIDEBAR_TAB_CHANGE_EVENT));
  };
  return [tab, setTab];
}

const PAGE_BTN: React.CSSProperties = {
  width:"26px", height:"26px", borderRadius:"7px",
  border:"1px solid #e2e8f0", background:"white",
  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  padding:0,
};

/* ── Shared subcomponents ── */
// Compares against the same time yesterday. Detection-count trend direction isn't clearly
// "good" or "bad" here, so this stays neutral gray rather than red/green — the ▲/▼ arrow
// alone (driven by `down`) conveys the up/down, no color needed.
function DeltaBadge({ delta, deltaPct, down }: { delta: number; deltaPct: number; down: boolean }) {
  return (
    <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
      <svg width="8" height="7" viewBox="0 0 8 7" style={{ flexShrink:0, transform: down ? "none" : "rotate(180deg)" }}>
        <path d="M4 7L0 0H8L4 7Z" fill="#475469"/>
      </svg>
      <span style={{ fontSize:"12px", fontWeight:600, color:"#475469", lineHeight:"16px" }}>{delta} ({deltaPct}%)</span>
    </div>
  );
}

// Per Figma (node 154:23572): 6px between the label row and the count block, then 4px
// *inside* that block between the count and the delta — not one flat gap across all three,
// which over-tallens the row and throws off the divider line's height next to it.
function StatCol({ icon, label, labelColor = "#475469", labelFontSize = 12, count, delta, deltaPct, down }: { icon?: React.ReactNode; label:string; labelColor?:string; labelFontSize?:number; count:number; delta:number; deltaPct:number; down:boolean }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
        {icon}
        <span style={{ fontSize:`${labelFontSize}px`, fontWeight:600, color:labelColor }}>{label}</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
        <span style={{ fontSize:"24px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.4px", lineHeight:"30px" }}>{count}</span>
        <DeltaBadge delta={delta} deltaPct={deltaPct} down={down} />
      </div>
    </div>
  );
}

function WatchlistStatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M1 10.5C0.999958 9.73016 1.22207 8.97667 1.63967 8.32994C2.05728 7.68322 2.65264 7.17074 3.3543 6.85401C4.05596 6.53728 4.83412 6.42975 5.59538 6.54434C6.35664 6.65893 7.06866 6.99075 7.646 7.5" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 6.5C6.38071 6.5 7.5 5.38071 7.5 4C7.5 2.61929 6.38071 1.5 5 1.5C3.61929 1.5 2.5 2.61929 2.5 4C2.5 5.38071 3.61929 6.5 5 6.5Z" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 9.5L9 10.5L11 8.5" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EventsTodayStatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M4 1V3" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 1V3" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 2H2.5C1.94772 2 1.5 2.44772 1.5 3V10C1.5 10.5523 1.94772 11 2.5 11H9.5C10.0523 11 10.5 10.5523 10.5 10V3C10.5 2.44772 10.0523 2 9.5 2Z" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.5 5H10.5" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.5 8L5.5 9L7.5 7" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LocationPinIcon({ color = "#324055" }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M6.3005 10.8995C7.2305 10.0965 10 7.4965 10 5C10 3.93913 9.57857 2.92172 8.82843 2.17157C8.07828 1.42143 7.06087 1 6 1C4.93913 1 3.92172 1.42143 3.17157 2.17157C2.42143 2.92172 2 3.93913 2 5C2 7.4965 4.7695 10.0965 5.6995 10.8995C5.78614 10.9646 5.8916 10.9999 6 10.9999C6.1084 10.9999 6.21386 10.9646 6.3005 10.8995Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 6.5C6.82843 6.5 7.5 5.82843 7.5 5C7.5 4.17157 6.82843 3.5 6 3.5C5.17157 3.5 4.5 4.17157 4.5 5C4.5 5.82843 5.17157 6.5 6 6.5Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AvatarStack() {
  return (
    <div style={{ display:"flex", alignItems:"center" }}>
      {FACE_PHOTOS.slice(0,3).map((url, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i, width:24, height:24, borderRadius:"50%", border:"1px solid white", overflow:"hidden", flexShrink:0 }}>
          <img src={url} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} alt="" />
        </div>
      ))}
    </div>
  );
}

function PersonThumb({ isSelected, photoUrl }: { isSelected:boolean; photoUrl:string }) {
  return (
    <div style={{ width:54, height:54, borderRadius:8, flexShrink:0, overflow:"hidden", outline: isSelected ? "2px solid #5a3dfb" : "none", outlineOffset:2 }}>
      <img src={photoUrl} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} alt="" />
    </div>
  );
}

function VipBadge() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"4px", flexShrink:0 }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
        <path d="M5.781 1.633C5.80258 1.5938 5.83429 1.56112 5.87281 1.53835C5.91133 1.51559 5.95525 1.50358 6 1.50358C6.04475 1.50358 6.08867 1.51559 6.12719 1.53835C6.16571 1.56112 6.19742 1.5938 6.219 1.633L7.695 4.435C7.7302 4.49988 7.77933 4.55617 7.83885 4.59981C7.89838 4.64345 7.96684 4.67338 8.0393 4.68743C8.11176 4.70148 8.18644 4.69932 8.25797 4.68109C8.3295 4.66286 8.3961 4.62902 8.453 4.582L10.5915 2.75C10.6326 2.71661 10.6831 2.69711 10.736 2.6943C10.7888 2.69149 10.8412 2.70552 10.8855 2.73437C10.9299 2.76322 10.964 2.8054 10.9828 2.85485C11.0017 2.90429 11.0044 2.95844 10.9905 3.0095L9.5735 8.1325C9.54458 8.23733 9.48226 8.32988 9.396 8.39611C9.30975 8.46233 9.20425 8.49863 9.0955 8.4995H2.905C2.79617 8.49874 2.69055 8.46249 2.6042 8.39626C2.51784 8.33002 2.45545 8.23742 2.4265 8.1325L1.01 3.01C0.996125 2.95894 0.998811 2.90479 1.01767 2.85535C1.03653 2.8059 1.07059 2.76372 1.11495 2.73487C1.15931 2.70602 1.21168 2.69199 1.26452 2.6948C1.31736 2.69761 1.36795 2.71711 1.409 2.7505L3.547 4.5825C3.6039 4.62952 3.6705 4.66336 3.74203 4.68159C3.81356 4.69982 3.88824 4.70198 3.9607 4.68793C4.03316 4.67388 4.10162 4.64395 4.16115 4.60031C4.22067 4.55666 4.2698 4.50038 4.305 4.4355L5.781 1.633Z" stroke="#5A3DFB" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.5 10.5H9.5" stroke="#5A3DFB" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontSize:"10px", fontWeight:600, color:"#5a3dfb" }}>VIP</span>
    </div>
  );
}

function PawTrackIcon({ color = "#6D9300", size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <path d="M2.33333 9.33333V7.945C2.33333 6.70833 1.7325 6.125 1.75 4.66667C1.7675 3.08 2.61917 1.16667 4.375 1.16667C5.46583 1.16667 5.83333 2.21667 5.83333 3.20833C5.83333 5.0225 4.66667 6.51 4.66667 8.27167V9.33333C4.66667 9.64275 4.54375 9.9395 4.32496 10.1583C4.10617 10.3771 3.80942 10.5 3.5 10.5C3.19058 10.5 2.89383 10.3771 2.67504 10.1583C2.45625 9.9395 2.33333 9.64275 2.33333 9.33333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.6667 11.6667V10.2783C11.6667 9.04167 12.2675 8.45833 12.25 7C12.2325 5.41333 11.3808 3.5 9.625 3.5C8.53417 3.5 8.16667 4.55 8.16667 5.54167C8.16667 7.35583 9.33333 8.84333 9.33333 10.605V11.6667C9.33333 11.9761 9.45625 12.2728 9.67504 12.4916C9.89383 12.7104 10.1906 12.8333 10.5 12.8333C10.8094 12.8333 11.1062 12.7104 11.325 12.4916C11.5437 12.2728 11.6667 11.9761 11.6667 11.6667Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.33333 9.91667H11.6667" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.33333 7.58333H4.66667" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FilterPillIcon({ id, color }: { id: FilterType; color:string }) {
  if (id === "VIP Detection") return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.781 1.633C5.80258 1.5938 5.83429 1.56112 5.87281 1.53835C5.91133 1.51559 5.95525 1.50358 6 1.50358C6.04475 1.50358 6.08867 1.51559 6.12719 1.53835C6.16571 1.56112 6.19742 1.5938 6.219 1.633L7.695 4.435C7.7302 4.49988 7.77933 4.55617 7.83885 4.59981C7.89838 4.64345 7.96684 4.67338 8.0393 4.68743C8.11176 4.70148 8.18644 4.69932 8.25797 4.68109C8.3295 4.66286 8.3961 4.62902 8.453 4.582L10.5915 2.75C10.6326 2.71661 10.6831 2.69711 10.736 2.6943C10.7888 2.69149 10.8412 2.70552 10.8855 2.73437C10.9299 2.76322 10.964 2.8054 10.9828 2.85485C11.0017 2.90429 11.0044 2.95844 10.9905 3.0095L9.5735 8.1325C9.54458 8.23733 9.48226 8.32988 9.396 8.39611C9.30975 8.46233 9.20425 8.49863 9.0955 8.4995H2.905C2.79617 8.49874 2.69055 8.46249 2.6042 8.39626C2.51784 8.33002 2.45545 8.23742 2.4265 8.1325L1.01 3.01C0.996125 2.95894 0.998811 2.90479 1.01767 2.85535C1.03653 2.8059 1.07059 2.76372 1.11495 2.73487C1.15931 2.70602 1.21168 2.69199 1.26452 2.6948C1.31736 2.69761 1.36795 2.71711 1.409 2.7505L3.547 4.5825C3.6039 4.62952 3.6705 4.66336 3.74203 4.68159C3.81356 4.69982 3.88824 4.70198 3.9607 4.68793C4.03316 4.67388 4.10162 4.64395 4.16115 4.60031C4.22067 4.55666 4.2698 4.50038 4.305 4.4355L5.781 1.633Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10.5H9.5" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (id === "Tracking") return <PawTrackIcon color={color} size={14} />;
  return null;
}

function AvailabilityDonut({ pct, size = 92 }: { pct: number; size?: number }) {
  const height = size * (40 / 92);
  // Neutral gray by default; only shift to a semantic signal color when availability is
  // genuinely low (matches the red/green convention already used elsewhere in this file for
  // LIVE/OUT status).
  const ringColor = pct < 50 ? "#f43f5e" : "#94a3b8";
  return (
    <div style={{ position:"relative", width:size, height, flexShrink:0 }}>
      <svg width={size} height={height} viewBox="0 0 92 40" fill="none">
        <path d="M17.8092 40C16.1597 35.4974 15.6272 30.666 16.2567 25.9154C16.8862 21.1648 18.6592 16.635 21.4254 12.7099C24.1917 8.78485 27.8696 5.58025 32.1475 3.36773C36.4254 1.15522 41.1772 0 46 0C50.8228 0 55.5746 1.15522 59.8525 3.36773C64.1304 5.58025 67.8083 8.78485 70.5746 12.7099C73.3408 16.635 75.1138 21.1648 75.7433 25.9154C76.3728 30.666 75.8403 35.4974 74.1908 40L66.1363 37.0874C67.3145 33.8712 67.6949 30.4202 67.2452 27.0269C66.7956 23.6336 65.5292 20.3981 63.5533 17.5944C61.5774 14.7908 58.9503 12.5018 55.8946 10.9215C52.839 9.34108 49.4449 8.51593 46 8.51593C42.5551 8.51593 39.161 9.34108 36.1054 10.9215C33.0497 12.5018 30.4226 14.7908 28.4467 17.5944C26.4708 20.3981 25.2044 23.6336 24.7548 27.0269C24.3051 30.4202 24.6855 33.8712 25.8637 37.0874L17.8092 40Z" fill={ringColor} fillOpacity="0.05"/>
        <path d="M17.7829 40C15.6048 33.9904 15.4173 27.4368 17.2482 21.3118C19.0791 15.1869 22.8309 9.81731 27.9464 6L33 12.7943C29.3399 15.5235 26.6566 19.3647 25.3492 23.7465C24.0419 28.1282 24.1804 32.816 25.7443 37.1124L17.7829 40Z" fill={ringColor} fillOpacity="0.5"/>
        <path d="M17.7424 40C15.6138 33.9904 15.4305 27.4368 17.2199 21.3118C19.0093 15.1869 22.676 9.81731 27.6756 6L29 7.81182C24.3763 11.3375 20.9848 16.2998 19.3294 21.9612C17.6741 27.6225 17.8433 33.6808 19.8118 39.2356L17.7424 40Z" fill={ringColor}/>
        <text x="46" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill={ringColor} fontFamily="SUIT, sans-serif">{pct}%</text>
      </svg>
    </div>
  );
}

function TablePinIcon({ active }: { active: boolean }) {
  const c = active ? "#5a3dfb" : "#64748A";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <g clipPath="url(#tpin)">
        <path d="M8.40467 11.1973C9.42067 10.2867 12 7.74265 12 5.33398C12 4.27312 11.5786 3.2557 10.8284 2.50556C10.0783 1.75541 9.06087 1.33398 8 1.33398C6.93913 1.33398 5.92172 1.75541 5.17157 2.50556C4.42143 3.2557 4 4.27312 4 5.33398C4 7.74265 6.58 10.2867 7.59533 11.1973C7.71156 11.2861 7.85375 11.3342 8 11.3342C8.14625 11.3342 8.28844 11.2861 8.40467 11.1973Z" stroke={c} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.99984 6.66667C8.73622 6.66667 9.33317 6.06971 9.33317 5.33333C9.33317 4.59695 8.73622 4 7.99984 4C7.26346 4 6.6665 4.59695 6.6665 5.33333C6.6665 6.06971 7.26346 6.66667 7.99984 6.66667Z" stroke={c} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.80921 9.33398H3.33588C3.1961 9.33404 3.05987 9.37804 2.94646 9.45975C2.83305 9.54146 2.74819 9.65675 2.70388 9.78932L1.36788 13.7893C1.33439 13.8895 1.32519 13.9963 1.34105 14.1007C1.35691 14.2052 1.39737 14.3044 1.45909 14.3901C1.52082 14.4759 1.60204 14.5457 1.69607 14.5939C1.79009 14.6421 1.89422 14.6673 1.99988 14.6673H13.9999C14.1055 14.6672 14.2095 14.6421 14.3035 14.5939C14.3974 14.5458 14.4786 14.476 14.5403 14.3903C14.602 14.3047 14.6425 14.2056 14.6584 14.1012C14.6743 13.9968 14.6652 13.8902 14.6319 13.79L13.2985 9.78998C13.2543 9.65718 13.1694 9.54167 13.0558 9.45982C12.9423 9.37798 12.8059 9.33395 12.6659 9.33398H10.1912" stroke={c} strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <defs>
        <clipPath id="tpin"><rect width="16" height="16" fill="white"/></clipPath>
      </defs>
    </svg>
  );
}

function SystemHeaderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0 }}>
      <path d="M16.6667 11.6667H3.33333C2.41286 11.6667 1.66667 12.4129 1.66667 13.3333V16.6667C1.66667 17.5871 2.41286 18.3333 3.33333 18.3333H16.6667C17.5871 18.3333 18.3333 17.5871 18.3333 16.6667V13.3333C18.3333 12.4129 17.5871 11.6667 16.6667 11.6667Z" stroke="#0E162A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.00833 15H5" stroke="#0E162A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.34167 15H8.33333" stroke="#0E162A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 8.33333V11.6667" stroke="#0E162A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.8667 5.975C14.5571 5.66508 14.1895 5.41922 13.7848 5.25147C13.3801 5.08372 12.9464 4.99738 12.5083 4.99738C12.0703 4.99738 11.6365 5.08372 11.2319 5.25147C10.8272 5.41922 10.4596 5.66508 10.15 5.975" stroke="#0E162A" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.2167 3.61667C15.9665 2.36737 14.2715 1.66559 12.5042 1.66559C10.7368 1.66559 9.04178 2.36737 7.79167 3.61667" stroke="#0E162A" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LinkedCamsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.41165 6.47011C5.61374 6.74029 5.87158 6.96385 6.16767 7.12561C6.46376 7.28738 6.79118 7.38358 7.12772 7.40768C7.46426 7.43178 7.80204 7.38323 8.11817 7.2653C8.43429 7.14738 8.72135 6.96285 8.95989 6.72423L10.3717 5.31247C10.8003 4.8687 11.0374 4.27434 11.0321 3.6574C11.0267 3.04047 10.7792 2.45032 10.343 2.01407C9.90673 1.57781 9.31659 1.33036 8.69965 1.325C8.08272 1.31964 7.48836 1.5568 7.04459 1.98541L6.23518 2.79011" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.32638 5.53182C6.12429 5.26164 5.86645 5.03808 5.57036 4.87631C5.27427 4.71455 4.94685 4.61835 4.61031 4.59425C4.27377 4.57014 3.93599 4.6187 3.61987 4.73662C3.30374 4.85455 3.01668 5.03908 2.77815 5.2777L1.36638 6.68946C0.937774 7.13323 0.70061 7.72759 0.705971 8.34452C0.711332 8.96146 0.958789 9.55161 1.39504 9.98786C1.8313 10.4241 2.42144 10.6716 3.03838 10.6769C3.65531 10.6823 4.24967 10.4451 4.69344 10.0165L5.49815 9.21182" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function OfflineCamsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.33 3H7C7.26522 3 7.51957 3.10536 7.70711 3.29289C7.89464 3.48043 8 3.73478 8 4V5.25L10.624 3.719C10.662 3.69683 10.7052 3.68508 10.7492 3.68493C10.7931 3.68478 10.8364 3.69624 10.8745 3.71815C10.9127 3.74006 10.9444 3.77165 10.9664 3.80972C10.9884 3.8478 11 3.89101 11 3.935V8.033" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 8C8 8.26522 7.89464 8.51957 7.70711 8.70711C7.51957 8.89464 7.26522 9 7 9H2C1.73478 9 1.48043 8.89464 1.29289 8.70711C1.10536 8.51957 1 8.26522 1 8V4C1 3.73478 1.10536 3.48043 1.29289 3.29289C1.48043 3.10536 1.73478 3 2 3H3" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 1L11 11" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AvailabilityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M11 6H9.76C9.54148 5.99953 9.32883 6.07065 9.15456 6.20248C8.98029 6.33431 8.854 6.5196 8.795 6.73L7.62 10.91C7.61243 10.936 7.59664 10.9588 7.575 10.975C7.55336 10.9912 7.52705 11 7.5 11C7.47295 11 7.44664 10.9912 7.425 10.975C7.40336 10.9588 7.38757 10.936 7.38 10.91L4.62 1.09C4.61243 1.06404 4.59664 1.04123 4.575 1.025C4.55336 1.00877 4.52705 1 4.5 1C4.47295 1 4.44664 1.00877 4.425 1.025C4.40336 1.04123 4.38757 1.06404 4.38 1.09L3.205 5.27C3.14623 5.47958 3.02069 5.66426 2.84743 5.79601C2.67417 5.92776 2.46266 5.99938 2.245 6H1" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isLive = status === "Live";
  return (
    <div style={{
      display:"inline-flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"4px 8px", borderRadius:"12px", backgroundColor:"white",
      border: isLive ? "1px solid rgba(22,163,74,0.3)" : "1px solid #ffeaea",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
        <div style={{ width: isLive ? 2 : 5, height: isLive ? 2 : 5, borderRadius:"50%", backgroundColor: isLive ? "#16a34a" : "#f43f5e", flexShrink:0 }} />
        <span style={{ fontSize:"10px", fontWeight:800, color: isLive ? "#16a34a" : "#f43f5e", letterSpacing:"-0.2px" }}>{isLive ? "LIVE" : "OUT"}</span>
      </div>
    </div>
  );
}

// Same counts EventsSummary/CollapsedSidebar both show — derived from vcaStore so a live
// detection added anywhere (e.g. the Data tab's monitoring feed) updates them everywhere.
// When the broker is publishing stats/summary, the two daily counters come from there instead
// (cumulative daily totals + real deltas); the store-derived row counts remain the mock fallback.
function useEventCounts() {
  const live = useLiveDashboardStats();
  const detections = vcaEventsToLiveEvents(useVcaStore(s => s.events));
  const persons = useVcaStore(s => s.persons);
  return {
    vipTargets: persons.filter(p => p.type === "VIP").length,
    watchlistMatch: live?.watchlistMatch ?? { ...dashboardStats.watchlistMatch, count: detections.filter(e => e.type === "VIP").length },
    tracking: { ...dashboardStats.tracking, count: detections.filter(e => e.type === "Tracking").length },
    eventsToday: live?.eventsToday ?? { ...dashboardStats.eventsToday, count: detections.length },
  };
}

/* ── VIP list modal ── */
function VipListModal({ onClose, onPersonSelect }: { onClose: () => void; onPersonSelect: (name: string) => void }) {
  const persons = useVcaStore(s => s.persons).filter(p => p.type === "VIP");

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, backgroundColor:"rgba(14,22,42,0.4)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"360px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"80vh", overflow:"hidden", boxShadow:"0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding:"14px 16px", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <Crown size={16} color="#5a3dfb" />
            <p style={{ fontSize:"14px", fontWeight:800, color:"#0e162a" }}>Registered VIP Targets</p>
            <span style={{ fontSize:"14px", fontWeight:800, color:"#5a3dfb" }}>{persons.length}</span>
          </div>
          <button onClick={onClose} style={{ padding:"4px", border:"none", background:"none", cursor:"pointer", color:"#94a3b8", display:"flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {persons.length === 0 && (
            <div style={{ padding:"32px 16px", textAlign:"center", color:"#94a3b8", fontSize:"13px" }}>No VIP targets registered.</div>
          )}
          {persons.map((p, i) => {
            const registeredLabel = new Date(p.registeredAt).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
            return (
              <div key={p.id}>
                <button
                  onClick={() => { onPersonSelect(p.name); onClose(); }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 16px", width:"100%", border:"none", background:"none", cursor:"pointer", textAlign:"left", transition:"background-color 0.1s" }}
                >
                  <PersonThumb isSelected={false} photoUrl={p.photoUrl} />
                  <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"3px" }}>
                    <span style={{ fontSize:"13px", fontWeight:600, color:"#0e162a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                    {p.description && (
                      <span style={{ fontSize:"11px", fontWeight:500, color:"#64748a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.description}</span>
                    )}
                    <span style={{ fontSize:"11px", fontWeight:500, color:"#94a3b8" }}>Registered {registeredLabel}</span>
                  </div>
                  <VipBadge />
                </button>
                {i < persons.length - 1 && <div style={{ height:"1px", backgroundColor:"#e2e8f0", margin:"0 16px" }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── EVENTS summary section (always shown) ── */
function EventsSummary({ onPersonSelect, onToggleDetectionChart }: { onPersonSelect: (name: string) => void; onToggleDetectionChart?: () => void }) {
  const { vipTargets, watchlistMatch, eventsToday } = useEventCounts();
  const [showVipList, setShowVipList] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDetectionsHovered, setIsDetectionsHovered] = useState(false);
  return (
    <div style={{ padding:"16px 20px 0", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"16px" }}>
        <AvatarStack />
        <button
          onClick={() => setShowVipList(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            display:"flex", alignItems:"center", gap:"8px", background: isHovered ? "#f8fafc" : "none",
            border:"none", cursor:"pointer", padding:"4px 8px", margin:"-4px -8px", borderRadius:"8px",
            transition:"background-color 0.15s",
          }}
        >
          <span style={{ fontSize:"16px", fontWeight:700, color:"#334155", letterSpacing:"-0.32px" }}>Registered VIP Targets</span>
          <span style={{ fontSize:"16px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.32px" }}>{vipTargets}</span>
        </button>
      </div>
      {showVipList && (
        <VipListModal
          onClose={() => setShowVipList(false)}
          onPersonSelect={(name) => onPersonSelect(name)}
        />
      )}
      <div style={{ display:"flex", alignItems:"center", gap:"16px", borderTop:BORDER, borderBottom:BORDER, padding:"12px 0", minHeight:"78px", boxSizing:"border-box" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <StatCol icon={<WatchlistStatIcon />} label="VIP Detections" labelColor="#324055" labelFontSize={13} count={watchlistMatch.count} delta={watchlistMatch.delta} deltaPct={watchlistMatch.deltaPct} down={watchlistMatch.down} />
        </div>
        <div style={{ width:"1px", backgroundColor:"#E2E8F0", alignSelf:"stretch", flexShrink:0 }} />
        <div
          onClick={onToggleDetectionChart}
          onMouseEnter={() => setIsDetectionsHovered(true)}
          onMouseLeave={() => setIsDetectionsHovered(false)}
          style={{
            flex:1, minWidth:0, cursor: onToggleDetectionChart ? "pointer" : undefined,
            backgroundColor: isDetectionsHovered ? "#f8fafc" : "transparent",
            borderRadius:"8px", padding:"4px", margin:"-4px", transition:"background-color 0.15s",
          }}
        >
          <StatCol icon={<EventsTodayStatIcon />} label="Today's detections" labelColor="#475469" labelFontSize={13} count={eventsToday.count} delta={eventsToday.delta} deltaPct={eventsToday.deltaPct} down={eventsToday.down} />
        </div>
      </div>
    </div>
  );
}

/* ── Location picker modal ── */
function LocationPickerModal({ current, onSelect, onClose }: { current: string | null; onSelect: (location: string | null) => void; onClose: () => void }) {
  const cameras = useVcaStore(s => s.cameras);
  const locations = Array.from(new Set(cameras.map(c => c.name)));
  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, backgroundColor:"rgba(14,22,42,0.4)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"320px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"70vh", overflow:"hidden", boxShadow:"0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding:"14px 16px", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <p style={{ fontSize:"14px", fontWeight:800, color:"#0e162a" }}>Select Location</p>
          <button onClick={onClose} style={{ padding:"4px", border:"none", background:"none", cursor:"pointer", color:"#94a3b8", display:"flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
          <button onClick={() => onSelect(null)}
            onMouseEnter={e => { if (current) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = !current ? "#f6f6fe" : "transparent"; }}
            style={{
              display:"flex", alignItems:"center", gap:"8px", width:"100%", textAlign:"left",
              padding:"9px 10px", borderRadius:"8px", border:"none", cursor:"pointer",
              backgroundColor: !current ? "#f6f6fe" : "transparent",
              fontSize:"13px", fontWeight:700, color: !current ? "#5a3dfb" : "#334155", transition:"background-color 0.1s",
            }}>All Locations</button>
          {locations.map(loc => {
            const active = current === loc;
            return (
              <button key={loc} onClick={() => onSelect(loc)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = active ? "#f6f6fe" : "transparent"; }}
                style={{
                  display:"flex", alignItems:"center", gap:"8px", width:"100%", textAlign:"left",
                  padding:"9px 10px", borderRadius:"8px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "#f6f6fe" : "transparent",
                  fontSize:"13px", fontWeight: active ? 700 : 600, color: active ? "#5a3dfb" : "#334155", transition:"background-color 0.1s",
                }}>
                <LocationPinIcon color={active ? "#5a3dfb" : "#64748a"} />
                {loc}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

function CameraTrailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8 6.5L10.6115 8.241C10.6491 8.26605 10.6929 8.28042 10.7381 8.28258C10.7832 8.28474 10.8281 8.27461 10.868 8.25327C10.9079 8.23192 10.9412 8.20016 10.9644 8.16137C10.9877 8.12258 11 8.07822 11 8.033V3.935C11 3.89101 10.9884 3.84779 10.9664 3.80972C10.9444 3.77164 10.9127 3.74006 10.8745 3.71814C10.8364 3.69623 10.7931 3.68477 10.7492 3.68492C10.7052 3.68507 10.662 3.69683 10.624 3.719L8 5.25" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 3H2C1.44772 3 1 3.44772 1 4V8C1 8.55228 1.44772 9 2 9H7C7.55228 9 8 8.55228 8 8V4C8 3.44772 7.55228 3 7 3Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Tracking events are anonymous multi-camera re-id trails rather than a single photo+name
// detection, so they get their own row: a person thumbnail followed by a hop-by-hop camera
// trail (each hop = a small rounded camera marker + where/when), ending in a "Tracking" tag.
// Every hop column keeps its label in NORMAL flow (never absolutely positioned) so long labels
// like "Jurong East" stay fully visible and scrollable instead of getting clipped by the row's
// overflow-x. Continuity of the dashed connector is instead handled by TWO pieces per gap: an
// internal flex:1 filler inside the badge row (covers whatever extra width this hop's own label
// adds beyond its 20px badge) plus a fixed dash between columns (the actual hop-to-hop gap) —
// together they always touch, so the line never breaks, and nothing renders past the last badge.
const TRAIL_HOP_GAP = "14px";
// A plain CSS "dashed" border re-stretches its dash/gap lengths to fit each element's own width,
// so two adjoining dashed pieces of different widths (the filler vs. the fixed gap) render with
// mismatched dash rhythm and look crinkled where they meet. A repeating-gradient background tiles
// at a fixed pixel interval regardless of the element's width, so consecutive pieces line up.
const HOP_DASH_STYLE: React.CSSProperties = {
  height:"1.5px",
  backgroundImage:"repeating-linear-gradient(to right, #475469 0, #475469 3px, transparent 3px, transparent 6px)",
};

function TrackingEventRow({ event, isSelected, onClick }: { event: LiveEvent; isSelected: boolean; onClick: () => void }) {
  const photoUrl = getFacePhoto(event.id);
  const hops = event.path ?? [];
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display:"flex", alignItems:"flex-start", gap:"12px", padding:"10px 16px", cursor:"pointer",
        backgroundColor: isSelected ? "#f6f6fe" : isHovered ? "#f8fafc" : "transparent",
        transition:"background-color 0.15s",
      }}
    >
      <PersonThumb isSelected={isSelected} photoUrl={photoUrl} />
      {/* Hops scroll on their own if they overflow — the "Tracking" tag below stays outside
          this scroll area so it's never pushed off-screen and hidden. */}
      <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"flex-start" }}>
        <div style={{ minWidth:0, display:"flex", alignItems:"flex-start", overflowX:"auto" }}>
          {hops.map((hop, i) => {
            const isLast = i === hops.length - 1;
            return (
              <div key={i} style={{
                display:"flex", flexDirection:"column", alignItems:"flex-start", gap:"5px",
                flexShrink:0, paddingRight: isLast ? 0 : TRAIL_HOP_GAP,
              }}>
                {/* badge-row overshoots into this column's own trailing gap (via calc), so the
                    single dash inside it runs from the badge all the way to the next hop with no
                    seam — two separate dashed pieces meeting mid-line is what caused the "crinkled"
                    look, since each one's dash rhythm restarts independently at its own edge. */}
                <div style={{ display:"flex", alignItems:"center", width: isLast ? "100%" : `calc(100% + ${TRAIL_HOP_GAP})` }}>
                  <div style={{ width:"20px", height:"16px", backgroundColor:"#324055", borderRadius:"7px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <CameraTrailIcon />
                  </div>
                  {!isLast && <div style={{ ...HOP_DASH_STYLE, flex:1, minWidth:0, marginLeft:"2px" }} />}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                  <span style={{ fontSize:"10px", fontWeight:600, color:"#0e162a", letterSpacing:"-0.2px", whiteSpace:"nowrap" }}>
                    {hop.location}{hop.cameraLabel ? ` ${hop.cameraLabel}` : ""}
                  </span>
                  <span style={{ fontSize:"10px", fontWeight:600, color:"#64748a", letterSpacing:"-0.2px", whiteSpace:"nowrap" }}>
                    {formatTimeAgo(hop.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Plain (no dashed line) spacer stretches to fill whatever's left, pinning the tag to
            the row's right edge — same right-aligned column the VIP badge sits in on VIP rows. */}
        <div style={{ flex:1, minWidth:"10px" }} />
        <div style={{ display:"flex", alignItems:"center", gap:"4px", flexShrink:0, marginTop:"1px" }}>
          <PawTrackIcon size={14} />
          <span style={{ fontSize:"12px", fontWeight:600, color:"#6d9300", letterSpacing:"-0.24px", whiteSpace:"nowrap" }}>Tracking</span>
        </div>
      </div>
    </div>
  );
}

function VipEventRow({ event, isSelected, photoUrl, onClick }: { event: LiveEvent; isSelected: boolean; photoUrl: string; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px", cursor:"pointer",
        backgroundColor: isSelected ? "#f6f6fe" : isHovered ? "#f8fafc" : "transparent",
        transition:"background-color 0.15s",
      }}
    >
      <div style={{ display:"flex", gap:"10px", alignItems:"center", flex:1, minWidth:0 }}>
        <PersonThumb isSelected={isSelected} photoUrl={photoUrl} />
        <div style={{ display:"flex", flexDirection:"column", gap:"5px", flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:"6px", alignItems:"baseline" }}>
            <span title={event.name} style={{ fontSize:"13px", fontWeight:600, color:"#0e162a", letterSpacing:"-0.26px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {event.name}
            </span>
            <span style={{
              fontSize:"10px", fontWeight:600, color:"#64748a", flexShrink:0,
              border:"1px solid #ccd5e1", borderRadius:"999px", padding:"1px 8px",
            }}>{event.confidence}%</span>
          </div>
          <div style={{ display:"flex", gap:"5px", alignItems:"center" }}>
            <LocationPinIcon color="#324055" />
            <span title={`${event.location}${event.cameraLabel ? ` · ${event.cameraLabel}` : ""}`} style={{ fontSize:"12px", fontWeight:600, color:"#324055", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {event.location}{event.cameraLabel ? ` · ${event.cameraLabel}` : ""}
            </span>
            <span style={{ color:"#cbd5e1", fontSize:"11px", flexShrink:0 }}>·</span>
            <span style={{ fontSize:"12px", fontWeight:600, color:"#64748a", flexShrink:0 }}>{formatTimeAgo(event.timestamp)}</span>
          </div>
        </div>
      </div>
      <div style={{ marginLeft:"8px", flexShrink:0, alignSelf:"flex-start", marginTop:"10px" }}>
        <VipBadge />
      </div>
    </div>
  );
}

/* ── EVENTS list section ── */
interface EventsListProps {
  onEventSelect?: (event: LiveEvent | null) => void;
  selectedEventId?: string;
  locationFilter?: string | null;
  onLocationClear?: () => void;
  onLocationSelect?: (location: string) => void;
  personFilter?: string | null;
  onPersonClear?: () => void;
}

function EventsList({ onEventSelect, selectedEventId, locationFilter, onLocationClear, onLocationSelect, personFilter, onPersonClear }: EventsListProps) {
  const [filter, setFilter] = useState<FilterType>("All");
  const [page, setPage] = useState(1);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const FILTERS: FilterType[] = ["All", "VIP Detection", "Tracking"];
  const liveEvents = vcaEventsToLiveEvents(useVcaStore(s => s.events));

  const byType = filter === "All" ? liveEvents
    : liveEvents.filter(e => {
        if (filter === "VIP Detection") return e.type === "VIP";
        return e.type === filter;
      });
  const byLocation = locationFilter
    ? byType.filter(e => e.location.toLowerCase().includes(locationFilter.toLowerCase()))
    : byType;
  const filtered = personFilter
    ? byLocation.filter(e => e.name.toLowerCase() === personFilter.toLowerCase())
    : byLocation;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <>
      {/* Live Analytics + filter */}
      <div style={{ padding:"20px 20px 12px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
          <span style={{ fontSize:"16px", fontWeight:700, color:"#334155", letterSpacing:"-0.32px" }}>Live Analytics</span>
          <button
            onClick={() => setShowLocationPicker(true)}
            style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"none", cursor:"pointer", padding:0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
              <path d="M8.40075 14.5333C9.64075 13.4627 13.3334 9.99599 13.3334 6.66732C13.3334 5.25283 12.7715 3.89628 11.7713 2.89608C10.7711 1.89589 9.41457 1.33398 8.00008 1.33398C6.58559 1.33398 5.22904 1.89589 4.22885 2.89608C3.22865 3.89628 2.66675 5.25283 2.66675 6.66732C2.66675 9.99599 6.35941 13.4627 7.59941 14.5333C7.71493 14.6202 7.85555 14.6672 8.00008 14.6672C8.14461 14.6672 8.28523 14.6202 8.40075 14.5333Z" stroke="#5A3DFB" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 8.66602C9.10457 8.66602 10 7.77059 10 6.66602C10 5.56145 9.10457 4.66602 8 4.66602C6.89543 4.66602 6 5.56145 6 6.66602C6 7.77059 6.89543 8.66602 8 8.66602Z" stroke="#5A3DFB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize:"13px", fontWeight:700, color:"#5a3dfb", letterSpacing:"-0.26px" }}>
              {locationFilter || "All"}
            </span>
          </button>
        </div>
        {personFilter && (
          <button
            onClick={onPersonClear}
            style={{ display:"flex", alignItems:"center", gap:"5px", background:"#f6f6fe", border:"none", borderRadius:"999px", padding:"5px 10px", cursor:"pointer", marginBottom:"12px" }}
          >
            <Crown size={11} color="#5a3dfb" />
            <span style={{ fontSize:"12px", fontWeight:700, color:"#5a3dfb" }}>{personFilter}</span>
            <span style={{ fontSize:"12px", color:"#5a3dfb", fontWeight:700 }}>✕</span>
          </button>
        )}
        <div style={{ display:"flex", gap:"6px" }}>
          {FILTERS.map(id => {
            const active = filter === id;
            const color  = active ? "white" : "#324055";
            return (
              <button key={id} onClick={() => { setFilter(id); setPage(1); }} style={{
                display:"flex", alignItems:"center", gap:"4px",
                padding:"4px 8px", borderRadius:"999px", border:"none", cursor:"pointer",
                backgroundColor: active ? "#5a3dfb" : "#f1f5f9",
                color, fontSize:"12px", fontWeight:500, letterSpacing:"-0.24px", transition:"all 0.15s",
              }}>
                <FilterPillIcon id={id} color={color} />
                {id === "VIP Detection" ? "VIP Detection" : id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event list */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {paginated.length === 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", padding:"32px 20px" }}>
            <span style={{ fontSize:"13px", fontWeight:500, color:"#94a3b8", textAlign:"center", letterSpacing:"-0.26px" }}>
              No events detected currently.
            </span>
          </div>
        )}
        {paginated.map((event, i) => {
          const isSelected = event.id === selectedEventId;
          const photoUrl = getFacePhoto(event.id);
          return (
            <div key={event.id}>
              {event.type === "Tracking" ? (
                <TrackingEventRow event={event} isSelected={isSelected} onClick={() => onEventSelect?.(isSelected ? null : event)} />
              ) : (
                <VipEventRow event={event} isSelected={isSelected} photoUrl={photoUrl} onClick={() => onEventSelect?.(isSelected ? null : event)} />
              )}
              {i < paginated.length - 1 && <div style={{ height:"1px", backgroundColor:"#e2e8f0", margin:"0 16px" }} />}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{ padding:"10px 16px", borderTop:BORDER, flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center", backgroundColor:"white" }}>
        <span style={{ fontSize:"11px", color:"#94a3b8", fontWeight:500 }}>{rangeStart} – {rangeEnd} of {filtered.length}</span>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ fontSize:"11px", color:"#94a3b8" }}>Go to page</span>
          <input type="number" min={1} max={totalPages} value={safePage}
            onChange={e => setPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
            style={{ width:"32px", textAlign:"center", fontSize:"12px", fontWeight:700, border:"1px solid #e2e8f0", borderRadius:"6px", padding:"2px 0", outline:"none", color:"#0e162a" }} />
          <span style={{ fontSize:"11px", color:"#94a3b8" }}>/ {totalPages}</span>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage===1} style={{ ...PAGE_BTN, opacity: safePage===1 ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage===totalPages} style={{ ...PAGE_BTN, opacity: safePage===totalPages ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {showLocationPicker && (
        <LocationPickerModal
          current={locationFilter ?? null}
          onSelect={(loc) => {
            if (loc) onLocationSelect?.(loc);
            else onLocationClear?.();
            setShowLocationPicker(false);
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </>
  );
}

/* ── SYSTEM tab ── */
interface SystemTabProps {
  onPinDevice?: (device: Device | null) => void;
  pinnedDeviceId?: string | null;
}

const SYSTEM_STATUS_FILTERS: ("All" | DeviceStatus)[] = ["All", "Live", "Off"];

function SystemTab({ onPinDevice, pinnedDeviceId: externalPinnedId }: SystemTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | DeviceStatus>("All");
  const [page,   setPage]   = useState(1);
  const [localPinnedId, setLocalPinnedId] = useState<string | null>(null);
  const pinnedDeviceId = externalPinnedId ?? localPinnedId;
  const cameras = useVcaStore(s => s.cameras);
  // Broker-fed camera list when live (MQTT status), mock devices otherwise.
  const deviceList = useLiveDevices() ?? devices;
  const { linkedCams, offlineCams, availability } = dashboardStats;
  const linkedCount  = deviceList.filter(d => d.status === "Live").length;
  const offlineCount = deviceList.filter(d => d.status === "Off").length;

  // The list has 1000 rows to draw from, so there's no reason a page should ever look emptier
  // than the space available for it — measure how tall the list container actually is and how
  // tall one row actually renders at, and fill the page with exactly that many rows instead of
  // a fixed guess. Only the true last page (1000 not evenly divisible) can ever come up short.
  const listRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => {
    const recalc = () => {
      const container = listRef.current;
      const row = firstRowRef.current;
      if (!container || !row || row.offsetHeight === 0) return;
      setPageSize(Math.max(1, Math.floor(container.clientHeight / row.offsetHeight)));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, []);

  const filtered = deviceList.filter(d =>
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.ip.includes(search)) &&
    (statusFilter === "All" || d.status === statusFilter)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd   = Math.min(safePage * pageSize, filtered.length);

  return (
    <>
      {/* Infrastructure & Debug header + stats */}
      <div style={{ padding:"16px 20px 0", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
          <SystemHeaderIcon />
          <p style={{ fontSize:"16px", fontWeight:700, color:"#334155", letterSpacing:"-0.32px" }}>
            Infrastructure & Debug
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"flex-start", borderTop:BORDER, borderBottom:BORDER, padding:"12px 0", minHeight:"78px", boxSizing:"border-box" }}>
          <div style={{ flex:1 }}>
            <StatCol icon={<LinkedCamsIcon />} label="Linked Cams" labelFontSize={13} count={linkedCount} delta={linkedCams.delta} deltaPct={linkedCams.deltaPct} down={linkedCams.down} />
          </div>
          <div style={{ width:"1px", backgroundColor:"#E2E8F0", alignSelf:"stretch", flexShrink:0 }} />
          <div style={{ flex:1, paddingLeft:"14px" }}>
            <StatCol icon={<OfflineCamsIcon />} label="Out Cams" labelFontSize={13} count={offlineCount} delta={offlineCams.delta} deltaPct={offlineCams.deltaPct} down={offlineCams.down} />
          </div>
          <div style={{ width:"1px", backgroundColor:"#E2E8F0", alignSelf:"stretch", flexShrink:0 }} />
          <div style={{ flex:1, paddingLeft:"14px", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", alignSelf:"flex-start", marginBottom:"6px" }}>
              <AvailabilityIcon />
              <span style={{ fontSize:"13px", fontWeight:600, color:"#475469" }}>Availability</span>
            </div>
            <AvailabilityDonut pct={availability} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding:"20px 20px 12px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", border:BORDER, borderRadius:"8px", padding:"9px 18px", backgroundColor:"white" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Enter Device Name"
            style={{ flex:1, border:"none", background:"none", outline:"none", fontSize:"12px", fontWeight:600, color:"#334155" }} />
          <Search size={18} color="#475469" />
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display:"flex", gap:"6px", padding:"0 20px 16px", flexShrink:0 }}>
        {SYSTEM_STATUS_FILTERS.map(id => {
          const active = statusFilter === id;
          const dotColor = id === "Live" ? "#22c55e" : id === "Off" ? "#f43f5e" : "#94a3b8";
          return (
            <button key={id} onClick={() => { setStatusFilter(id); setPage(1); }} style={{
              display:"flex", alignItems:"center", gap:"5px",
              padding:"4px 8px", borderRadius:"999px", border:"none", cursor:"pointer",
              backgroundColor: active ? "#5a3dfb" : "#f1f5f9",
              color: active ? "white" : "#324055", fontSize:"12px", fontWeight:500, letterSpacing:"-0.24px", transition:"all 0.15s",
            }}>
              <span style={{ width:"6px", height:"6px", borderRadius:"50%", backgroundColor: active ? "white" : dotColor, flexShrink:0 }} />
              {id === "Off" ? "Out" : id}
            </button>
          );
        })}
      </div>

      {/* Table header */}
      <div style={{ display:"grid", gridTemplateColumns:"48px 60px 52px 1fr 32px", padding:"6px 20px", flexShrink:0, gap:"4px" }}>
        {["NAME","STATUS","TYPE","INFO","PIN"].map(h => (
          <span key={h} style={{
            fontSize:"12px", fontWeight:800, color:"#324055", letterSpacing:"-0.24px",
            textAlign: h==="TYPE" || h==="PIN" ? "center" : h==="INFO" ? "right" : "left",
          }}>{h}</span>
        ))}
      </div>

      {/* Device list — flex:1 so pagination stays pinned to the sidebar's bottom (the standard
          pattern), but pageSize is measured from the actual available height (see the
          ResizeObserver below) so the page is filled with real rows instead of leaving a gap
          above the pagination bar. Only the true last page (e.g. 1000 not divisible by pageSize)
          can ever be short — that's unavoidable, not a bug. */}
      <div ref={listRef} style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {paginated.map((device, i) => {
          const isPinned = device.id === pinnedDeviceId;
          const zone = nearestZoneName(device.lat, device.lng, cameras);
          return (
            <div key={device.id} ref={i === 0 ? firstRowRef : undefined}>
            <div
              onClick={() => {
                const next = isPinned ? null : device;
                setLocalPinnedId(next?.id ?? null);
                onPinDevice?.(next);
              }}
              onMouseEnter={e => { if (!isPinned) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
              onMouseLeave={e => { if (!isPinned) e.currentTarget.style.backgroundColor = "transparent"; }}
              style={{
                display:"grid", gridTemplateColumns:"48px 60px 52px 1fr 32px",
                alignItems:"center", padding:"10px 20px", gap:"4px", cursor:"pointer",
                backgroundColor: isPinned ? "#f6f6fe" : "transparent", transition:"background-color 0.1s",
              }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"1px", overflow:"hidden" }}>
                <span style={{ fontSize:"12px", fontWeight:600, color:"#475469", letterSpacing:"-0.24px" }}>{device.name}</span>
                <span style={{ fontSize:"9px", fontWeight:500, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{zone}</span>
              </div>
              <div><StatusBadge status={device.status} /></div>
              <span style={{ fontSize:"12px", fontWeight:600, color:"#475469", textAlign:"center" }}>{device.type}</span>
              <span style={{ fontSize:"12px", fontWeight:600, color:"#475469", textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{device.ip}</span>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"2px" }}>
                <TablePinIcon active={isPinned} />
              </div>
            </div>
            {i < paginated.length - 1 && <div style={{ height:"1px", backgroundColor:"#e2e8f0", margin:"0 20px" }} />}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{ padding:"10px 16px", borderTop:BORDER, flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"11px", color:"#94a3b8", fontWeight:500 }}>{rangeStart} – {rangeEnd} of {filtered.length}</span>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ fontSize:"11px", color:"#94a3b8" }}>Go to page</span>
          <input type="number" min={1} max={totalPages} value={safePage}
            onChange={e => setPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
            style={{ width:"32px", textAlign:"center", fontSize:"12px", fontWeight:700, border:"1px solid #e2e8f0", borderRadius:"6px", padding:"2px 0", outline:"none", color:"#0e162a" }} />
          <span style={{ fontSize:"11px", color:"#94a3b8" }}>/ {totalPages}</span>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage===1} style={{ ...PAGE_BTN, opacity: safePage===1 ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage===totalPages} style={{ ...PAGE_BTN, opacity: safePage===totalPages ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Collapsed sidebar (60px) ── */
// Devices only carry lat/lng, not a location name — approximate one from the nearest
// registered camera zone rather than inventing a label with no data behind it.
function nearestZoneName(lat: number, lng: number, cameras: { name: string; lat: number; lng: number }[]): string {
  let best = cameras[0];
  let bestDist = Infinity;
  for (const c of cameras) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best?.name ?? "Unknown";
}

function CollapsedSidebar({ position = "left" }: { position?: "left" | "right" }) {
  const [tab, setTab] = usePersistedSidebarTab();
  const [hovered, setHovered] = useState<{ id: string; top: number; item: LiveEvent | Device } | null>(null);
  const { vipTargets, watchlistMatch, tracking } = useEventCounts();
  const { availability } = dashboardStats;
  const todayTotal = watchlistMatch.count + tracking.count;
  const liveEvents = vcaEventsToLiveEvents(useVcaStore(s => s.events));
  const cameras = useVcaStore(s => s.cameras);
  const deviceList = useLiveDevices() ?? devices;

  const handleMouseEnter = (e: React.MouseEvent, id: string, item: LiveEvent | Device) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHovered({ id, top: rect.top, item });
  };

  return (
    <div onMouseLeave={() => setHovered(null)} style={{ width:"60px", flexShrink:0, height:"100%", backgroundColor:"white", ...(position === "right" ? { borderLeft: BORDER } : { borderRight: BORDER }), display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 0", overflow:"hidden", position:"relative" }}>
      {/* Tab toggle */}
      <div style={{ width:"44px", backgroundColor:"#f1f5f9", borderRadius:"12px", padding:"4px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
        <button onClick={() => setTab("EVENTS")} style={{ width:"36px", height:"32px", borderRadius:"8px", border:"none", cursor:"pointer", backgroundColor: tab==="EVENTS" ? "#5a3dfb" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1.75 1.75V11.0833C1.75 11.3928 1.87292 11.6895 2.09171 11.9083C2.3105 12.1271 2.60725 12.25 2.91667 12.25H12.25" stroke={tab==="EVENTS" ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.083 5.25L8.16634 8.16667L5.83301 5.83333L4.08301 7.58333" stroke={tab==="EVENTS" ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button onClick={() => setTab("SYSTEM")} style={{ width:"36px", height:"32px", borderRadius:"8px", border:"none", cursor:"pointer", backgroundColor: tab==="SYSTEM" ? "#5a3dfb" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M9.87887 7.82031H12.0651C12.1677 7.82037 12.2685 7.84663 12.3581 7.89661C12.4477 7.94658 12.523 8.01862 12.5769 8.10587C12.6308 8.19313 12.6615 8.29271 12.6661 8.39517C12.6708 8.49764 12.6491 8.59958 12.6033 8.69133L11.3789 11.1406C11.3325 11.2334 11.2629 11.3127 11.1768 11.3706C11.0907 11.4286 10.9911 11.4633 10.8876 11.4714C10.7842 11.4796 10.6804 11.4608 10.5863 11.417C10.4923 11.3731 10.4111 11.3057 10.3508 11.2213L9.07227 9.43352" stroke={tab==="SYSTEM" ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.0928 6.04789C10.2354 6.11931 10.3439 6.24445 10.3944 6.39581C10.4448 6.54717 10.4331 6.71236 10.3618 6.8551L8.49219 10.5938C8.45683 10.6645 8.40788 10.7276 8.34814 10.7793C8.28841 10.8311 8.21905 10.8707 8.14403 10.8957C8.06901 10.9206 7.98981 10.9306 7.91094 10.925C7.83208 10.9193 7.75509 10.8982 7.68438 10.8628L1.96893 8.0024C1.55379 7.7933 1.23838 7.42826 1.09173 6.98717C0.945073 6.54608 0.979114 6.06486 1.1864 5.6488L2.01708 3.96938C2.12062 3.76305 2.26378 3.57913 2.43841 3.42813C2.61303 3.27713 2.81568 3.16202 3.0348 3.08935C3.25392 3.01668 3.48521 2.98789 3.71545 3.00462C3.9457 3.02135 4.17039 3.08327 4.3767 3.18685L10.0928 6.04789Z" stroke={tab==="SYSTEM" ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 12.0347H3.26331C3.48767 12.0363 3.70801 11.9751 3.89945 11.8581C4.0909 11.7411 4.24585 11.573 4.34681 11.3726L5.21361 9.62695" stroke={tab==="SYSTEM" ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 13.2398V10.832" stroke={tab==="SYSTEM" ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.00977 6.01562H4.01458" stroke={tab==="SYSTEM" ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Summary badges */}
      <div style={{ width:"100%", borderTop:"1px solid #f1f5f9", borderBottom:"1px solid #f1f5f9", padding:"12px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", margin:"12px 0", flexShrink:0 }}>
        {tab === "EVENTS" ? (
          <>
            {/* Purple only when there are actual registered VIP targets — not a fixed default. */}
            <div style={{
              width:"38px", height:"38px", borderRadius:"10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              backgroundColor: vipTargets > 0 ? "#eef2ff" : "#f1f5f9", border: vipTargets > 0 ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
            }}>
              <span style={{ fontSize:"8px", fontWeight:700, color: vipTargets > 0 ? "#5a3dfb" : "#94a3b8", letterSpacing:"0.5px" }}>VIP</span>
              <span style={{ fontSize:"13px", fontWeight:800, color: vipTargets > 0 ? "#5a3dfb" : "#94a3b8", lineHeight:1 }}>{vipTargets}</span>
            </div>
            {/* This is just today's detection count, not an alert — plain gray, no red. */}
            <div style={{ width:"38px", height:"38px", borderRadius:"10px", backgroundColor:"#f1f5f9", border:"1px solid #e2e8f0", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:"8px", fontWeight:700, color:"#64748a", letterSpacing:"0.3px" }}>TODAY</span>
              <span style={{ fontSize:"13px", fontWeight:800, color:"#334155", lineHeight:1 }}>{todayTotal}</span>
            </div>
          </>
        ) : (
          // Same neutral-by-default rule as AvailabilityDonut: gray unless availability is
          // genuinely low (<50%), not a fixed purple regardless of value.
          <div style={{
            width:"38px", height:"38px", borderRadius:"10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            backgroundColor: availability < 50 ? "#fff1f2" : "#f1f5f9", border: availability < 50 ? "1px solid #fecdd3" : "1px solid #e2e8f0",
          }}>
            <span style={{ fontSize:"8px", fontWeight:700, color: availability < 50 ? "#f43f5e" : "#94a3b8", letterSpacing:"0.3px" }}>AVAIL</span>
            <span style={{ fontSize:"13px", fontWeight:800, color: availability < 50 ? "#f43f5e" : "#94a3b8", lineHeight:1 }}>{availability}%</span>
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex:1, overflowY:"auto", width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", paddingBottom:"8px" }}>
        {tab === "EVENTS"
          ? liveEvents.map(event => {
              const photoUrl = getFacePhoto(event.id);
              return (
                <div key={event.id}
                  onMouseEnter={e => handleMouseEnter(e, event.id, event)}
                  style={{ width:"40px", height:"40px", borderRadius:"10px", overflow:"hidden", flexShrink:0, cursor:"pointer", position:"relative",
                    border: event.type==="VIP" ? "2px solid #5a3dfb" : "1.5px solid #e2e8f0" }}>
                  <img src={photoUrl} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} alt="" />
                  {event.type === "VIP" && (
                    <div style={{ position:"absolute", top:"1px", right:"1px", width:"15px", height:"15px", borderRadius:"50%", backgroundColor:"#5a3dfb", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Crown size={9} color="white" />
                    </div>
                  )}
                </div>
              );
            })
          : deviceList.map(device => {
              const isLive = device.status === "Live";
              return (
                <div key={device.id}
                  onMouseEnter={e => handleMouseEnter(e, device.id, device)}
                  style={{ width:"40px", height:"40px", borderRadius:"10px", backgroundColor: isLive ? "#0e162a" : "#f8fafc", border: isLive ? "1px solid #334155" : "1px solid #fecdd3", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"relative", flexShrink:0 }}>
                  <span style={{ fontSize:"9px", fontWeight:700, color: isLive ? "white" : "#f43f5e", fontFamily:"monospace", textAlign:"center" }}>{device.name}</span>
                  <div style={{ position:"absolute", bottom:"3px", right:"3px", width:"6px", height:"6px", borderRadius:"50%", backgroundColor: isLive ? "#22c55e" : "#f43f5e" }} />
                </div>
              );
            })
        }
      </div>

      {/* Hover flyout (fixed) */}
      {hovered && (() => {
        const isDevice = "status" in hovered.item;
        // Clamp to the viewport so hovering an item near the bottom of the scrollable list
        // doesn't push the flyout off-screen.
        const estimatedHeight = isDevice ? 76 : 132;
        const clampedTop = Math.min(Math.max(8, hovered.top), (typeof window !== "undefined" ? window.innerHeight : 1080) - estimatedHeight - 8);
        if (!isDevice) {
          const event = hovered.item as LiveEvent;
          const photoUrl = getFacePhoto(event.id);
          return (
            <div style={{ position:"fixed", ...(position === "right" ? { right:"64px" } : { left:"64px" }), top: clampedTop, zIndex:1000, width:"210px", backgroundColor:"white", border:BORDER, borderRadius:"12px", padding:"10px", boxShadow:"0 4px 20px rgba(0,0,0,0.12)", pointerEvents:"none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:"8px", marginBottom:"8px", borderBottom:"1px solid #f1f5f9" }}>
                <span style={{ fontSize:"10px", fontWeight:800, color: event.type==="VIP" ? "#5a3dfb" : "#6d9300", backgroundColor: event.type==="VIP" ? "#eef2ff" : "#f6f9ec", padding:"2px 6px", borderRadius:"4px" }}>
                  {event.type==="VIP" ? `VIP · ${event.confidence}%` : "TRACKING"}
                </span>
                <span style={{ fontSize:"10px", color:"#94a3b8" }}>{formatTimeAgo(event.timestamp)}</span>
              </div>
              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <img src={photoUrl} style={{ width:"36px", height:"48px", borderRadius:"6px", objectFit:"cover", flexShrink:0 }} alt="" />
                <div>
                  <div style={{ fontSize:"12px", fontWeight:800, color:"#0e162a" }}>{event.name}</div>
                  <div style={{ fontSize:"10px", color:"#64748a", marginTop:"3px" }}>{event.location}</div>
                </div>
              </div>
            </div>
          );
        } else {
          const device = hovered.item as Device;
          const isLive = device.status === "Live";
          const zone = nearestZoneName(device.lat, device.lng, cameras);
          return (
            <div style={{ position:"fixed", ...(position === "right" ? { right:"64px" } : { left:"64px" }), top: clampedTop, zIndex:1000, width:"180px", backgroundColor:"#0e162a", border:"1px solid #334155", borderRadius:"12px", padding:"10px", boxShadow:"0 4px 20px rgba(0,0,0,0.2)", pointerEvents:"none" }}>
              <div style={{ fontSize:"10px", color:"#94a3b8", marginBottom:"3px" }}>{zone}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"12px", fontWeight:800, color:"white" }}>{device.name}</span>
                <span style={{ fontSize:"10px", fontWeight:700, color: isLive ? "#22c55e" : "#f43f5e", backgroundColor: isLive ? "rgba(34,197,94,0.1)" : "rgba(244,63,94,0.1)", padding:"2px 6px", borderRadius:"4px" }}>
                  {isLive ? "● LIVE" : "○ OFF"}
                </span>
              </div>
            </div>
          );
        }
      })()}
    </div>
  );
}

/* ── Main sidebar ── */
interface SidebarProps {
  onEventSelect?: (event: LiveEvent | null) => void;
  selectedEventId?: string;
  locationFilter?: string | null;
  onLocationClear?: () => void;
  onLocationSelect?: (location: string) => void;
  onPinDevice?: (device: Device | null) => void;
  pinnedDeviceId?: string | null;
  isCollapsed?: boolean;
  onToggleDetectionChart?: () => void;
  /** Which side of the map this sidebar sits on — flips which edge carries the border. */
  position?: "left" | "right";
}

export default function Sidebar({ onEventSelect, selectedEventId, locationFilter, onLocationClear, onLocationSelect, onPinDevice, pinnedDeviceId, isCollapsed, onToggleDetectionChart, position = "left" }: SidebarProps) {
  const [activeTab, setActiveTab] = usePersistedSidebarTab();
  const [personFilter, setPersonFilter] = useState<string | null>(null);

  if (isCollapsed) return <CollapsedSidebar position={position} />;

  return (
    <div style={{ width:"380px", flexShrink:0, height:"100%", backgroundColor:"white", ...(position === "right" ? { borderLeft: BORDER } : { borderRight: BORDER }), display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Tab toggle */}
      <div style={{ padding:"12px 20px 6px", flexShrink:0 }}>
        <div style={{ display:"flex", backgroundColor:"#f1f5f9", borderRadius:"12px", padding:"4px", gap:"4px" }}>
          {(["EVENTS","SYSTEM"] as SidebarTab[]).map(tab => {
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex:1, padding:"8px 0", borderRadius:"10px", border:"none", cursor:"pointer",
                backgroundColor: active ? "#5a3dfb" : "transparent",
                color: active ? "white" : "#64748a",
                fontSize:"13px", fontWeight:700, letterSpacing:"-0.26px",
                display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
                transition:"background-color 0.15s",
              }}>
                {tab === "EVENTS" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.75 1.75V11.0833C1.75 11.3928 1.87292 11.6895 2.09171 11.9083C2.3105 12.1271 2.60725 12.25 2.91667 12.25H12.25" stroke={active ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11.083 5.25L8.16634 8.16667L5.83301 5.83333L4.08301 7.58333" stroke={active ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M9.87887 7.82031H12.0651C12.1677 7.82037 12.2685 7.84663 12.3581 7.89661C12.4477 7.94658 12.523 8.01862 12.5769 8.10587C12.6308 8.19313 12.6615 8.29271 12.6661 8.39517C12.6708 8.49764 12.6491 8.59958 12.6033 8.69133L11.3789 11.1406C11.3325 11.2334 11.2629 11.3127 11.1768 11.3706C11.0907 11.4286 10.9911 11.4633 10.8876 11.4714C10.7842 11.4796 10.6804 11.4608 10.5863 11.417C10.4923 11.3731 10.4111 11.3057 10.3508 11.2213L9.07227 9.43352" stroke={active ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10.0928 6.04789C10.2354 6.11931 10.3439 6.24445 10.3944 6.39581C10.4448 6.54717 10.4331 6.71236 10.3618 6.8551L8.49219 10.5938C8.45683 10.6645 8.40788 10.7276 8.34814 10.7793C8.28841 10.8311 8.21905 10.8707 8.14403 10.8957C8.06901 10.9206 7.98981 10.9306 7.91094 10.925C7.83208 10.9193 7.75509 10.8982 7.68438 10.8628L1.96893 8.0024C1.55379 7.7933 1.23838 7.42826 1.09173 6.98717C0.945073 6.54608 0.979114 6.06486 1.1864 5.6488L2.01708 3.96938C2.12062 3.76305 2.26378 3.57913 2.43841 3.42813C2.61303 3.27713 2.81568 3.16202 3.0348 3.08935C3.25392 3.01668 3.48521 2.98789 3.71545 3.00462C3.9457 3.02135 4.17039 3.08327 4.3767 3.18685L10.0928 6.04789Z" stroke={active ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 12.0347H3.26331C3.48767 12.0363 3.70801 11.9751 3.89945 11.8581C4.0909 11.7411 4.24585 11.573 4.34681 11.3726L5.21361 9.62695" stroke={active ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 13.2398V10.832" stroke={active ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.00977 6.01562H4.01458" stroke={active ? "white" : "#64748a"} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* EVENTS tab */}
      {activeTab === "EVENTS" && (
        <>
          <EventsSummary onPersonSelect={setPersonFilter} onToggleDetectionChart={onToggleDetectionChart} />
          <EventsList
            onEventSelect={onEventSelect}
            selectedEventId={selectedEventId}
            locationFilter={locationFilter}
            onLocationClear={onLocationClear}
            onLocationSelect={onLocationSelect}
            personFilter={personFilter}
            onPersonClear={() => setPersonFilter(null)}
          />
        </>
      )}

      {/* SYSTEM tab */}
      {activeTab === "SYSTEM" && (
        <SystemTab onPinDevice={onPinDevice} pinnedDeviceId={pinnedDeviceId} />
      )}
    </div>
  );
}
