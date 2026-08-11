
import { useState } from "react";
import type { DetType, Detection, CamData } from "../types/detection";

const BORDER = "1px solid #E2E8F0";

export interface DetailProps {
  camLabel: string;
  data: CamData;
  initialDet: Detection;
  onBack: () => void;
  onGoRedmapTrace?: (name: string) => void;
}

const DET_COLOR: Record<DetType, string> = { VIP: "#5a3dfb", Vehicle: "#38bdf8", Unknown: "#976400" };

const AVATAR = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
];
const DB_PHOTO = "/enrolled-db-sample.png";
const LIVE_CAPTURE_PHOTO = "/live-capture-sample.png";

const ATTRS: Record<DetType, { basic: string[]; top: string[]; bottom: string[]; addons: string[] }> = {
  VIP:     { basic:["ASIAN","MALE","34YR"],  top:["WHITE TOP","LONG SLEEVE"],   bottom:["BROWN BOTTOM","TROUSERS"], addons:["NO BACKPACK"] },
  Unknown: { basic:["ASIAN","MALE","28YR"],  top:["RED JACKET","SHORT SLEEVE"], bottom:["BLACK JEANS"],             addons:["BACKPACK"] },
  Vehicle: { basic:["SEDAN","WHITE","2020"], top:["SGX411"],                    bottom:[],                          addons:["REGISTERED"] },
};

const REGISTERED: Record<DetType, string> = {
  VIP:     "Admin_Staff (Parking Zone F)",
  Unknown: "N/A — No registration found",
  Vehicle: "Navy Fleet Registry",
};

const PERSON_TAGS: Record<DetType, string[]> = {
  VIP:     ["Helmet", "Pink jacket"],
  Unknown: ["Red Helmet", "Pink jacket", "Orange vest"],
  Vehicle: ["White sedan", "Cargo door open"],
};

const FRAMES = ["12:13:48","12:13:48","12:13:53","12:13:58","12:14:03","12:14:09","12:14:14","12:14:19","12:14:19","12:14:24","12:14:29","12:14:34","12:14:39"];
const SELECTED_FRAME = 4;

/* ── Solid type icon ───────────────────────────────────────── */
function TypeIcon({ type, color, size = 11 }: { type: DetType; color: string; size?: number }) {
  if (type === "VIP") return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.78072 1.63333C5.80231 1.59413 5.83401 1.56145 5.87253 1.53868C5.91105 1.51592 5.95498 1.50391 5.99972 1.50391C6.04447 1.50391 6.0884 1.51592 6.12692 1.53868C6.16544 1.56145 6.19714 1.59413 6.21872 1.63333L7.69472 4.43533C7.72992 4.50021 7.77905 4.55649 7.83858 4.60014C7.89811 4.64378 7.96656 4.67371 8.03902 4.68776C8.11149 4.70181 8.18616 4.69965 8.25769 4.68142C8.32922 4.66319 8.39583 4.62935 8.45272 4.58233L10.5912 2.75033C10.6323 2.71694 10.6829 2.69744 10.7357 2.69463C10.7885 2.69182 10.8409 2.70585 10.8853 2.7347C10.9296 2.76355 10.9637 2.80573 10.9826 2.85517C11.0014 2.90461 11.0041 2.95876 10.9902 3.00983L9.57322 8.13283C9.5443 8.23766 9.48199 8.33021 9.39573 8.39644C9.30947 8.46266 9.20397 8.49896 9.09522 8.49983H2.90472C2.79589 8.49907 2.69028 8.46282 2.60392 8.39658C2.51756 8.33035 2.45517 8.23774 2.42622 8.13283L1.00972 3.01033C0.995849 2.95926 0.998535 2.90511 1.01739 2.85567C1.03625 2.80623 1.07032 2.76405 1.11467 2.7352C1.15903 2.70635 1.2114 2.69232 1.26424 2.69513C1.31708 2.69794 1.36767 2.71744 1.40872 2.75083L3.54672 4.58283C3.60362 4.62985 3.67023 4.66369 3.74176 4.68192C3.81328 4.70015 3.88796 4.70231 3.96042 4.68826C4.03289 4.67421 4.10134 4.64428 4.16087 4.60064C4.2204 4.55699 4.26953 4.50071 4.30472 4.43583L5.78072 1.63333Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10.5H9.5" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === "Unknown") return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <g clipPath="url(#typeIconUnknownClip)">
        <path d="M2.24582 5.02831C2.16068 4.64478 2.17375 4.24597 2.28383 3.86884C2.39391 3.49171 2.59743 3.14849 2.87551 2.87098C3.1536 2.59347 3.49725 2.39068 3.87461 2.28139C4.25197 2.1721 4.65081 2.15986 5.03416 2.24581C5.24515 1.91582 5.53583 1.64425 5.87938 1.45614C6.22293 1.26803 6.60831 1.16943 6.99999 1.16943C7.39167 1.16943 7.77705 1.26803 8.1206 1.45614C8.46415 1.64425 8.75483 1.91582 8.96582 2.24581C9.34975 2.15949 9.74928 2.17167 10.1272 2.28123C10.5052 2.39078 10.8493 2.59414 11.1276 2.8724C11.4058 3.15066 11.6092 3.49477 11.7187 3.87273C11.8283 4.25068 11.8405 4.65021 11.7542 5.03414C12.0841 5.24514 12.3557 5.53581 12.5438 5.87936C12.7319 6.22292 12.8305 6.60829 12.8305 6.99998C12.8305 7.39166 12.7319 7.77703 12.5438 8.12059C12.3557 8.46414 12.0841 8.75481 11.7542 8.96581C11.8401 9.34916 11.8279 9.748 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4025 10.5083 11.6061 10.1311 11.7161C9.754 11.8262 9.35518 11.8393 8.97166 11.7541C8.76093 12.0854 8.47004 12.3581 8.1259 12.5471C7.78176 12.736 7.39551 12.8351 7.00291 12.8351C6.61031 12.8351 6.22406 12.736 5.87992 12.5471C5.53578 12.3581 5.24488 12.0854 5.03416 11.7541C4.65081 11.8401 4.25197 11.8278 3.87461 11.7186C3.49725 11.6093 3.1536 11.4065 2.87551 11.129C2.59743 10.8515 2.39391 10.5082 2.28383 10.1311C2.17375 9.75398 2.16068 9.35517 2.24582 8.97164C1.9133 8.7612 1.6394 8.47008 1.4496 8.12535C1.25981 7.78062 1.16028 7.3935 1.16028 6.99998C1.16028 6.60645 1.25981 6.21933 1.4496 5.8746C1.6394 5.52987 1.9133 5.23875 2.24582 5.02831Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.30249 5.25009C5.43963 4.86023 5.71033 4.53148 6.06663 4.32208C6.42293 4.11268 6.84185 4.03614 7.24918 4.106C7.65651 4.17587 8.02597 4.38764 8.29212 4.70381C8.55827 5.01998 8.70394 5.42014 8.70332 5.83342C8.70332 7.00009 6.95332 7.58342 6.95332 7.58342" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 9.91675H7.00583" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <defs>
        <clipPath id="typeIconUnknownClip"><rect width="14" height="14" fill="white"/></clipPath>
      </defs>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
      <path d="M14 5.33336L12.6667 6.66669L11.6667 4.20003C11.5724 3.94758 11.4038 3.72964 11.1831 3.57493C10.9625 3.42022 10.7001 3.33599 10.4307 3.33336H5.6C5.32834 3.32712 5.06125 3.40403 4.83451 3.5538C4.60778 3.70357 4.43221 3.91904 4.33133 4.17136L3.33333 6.66669L2 5.33336" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.66663 9.33325H4.67413" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.3334 9.33325H11.3409" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 6.66675H3.33333C2.59695 6.66675 2 7.2637 2 8.00008V10.6667C2 11.4031 2.59695 12.0001 3.33333 12.0001H12.6667C13.403 12.0001 14 11.4031 14 10.6667V8.00008C14 7.2637 13.403 6.66675 12.6667 6.66675Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33337 12V13.3333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6666 12V13.3333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Reel filter chips ────────────────────────────────────────── */
type ReelFilter = DetType | "All";

function ReelFilterIcon({ type, color }: { type: DetType; color: string }) {
  if (type === "Unknown") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
        <g clipPath="url(#reelUnknownClip)">
          <path d="M2.24582 5.02831C2.16068 4.64478 2.17375 4.24597 2.28383 3.86884C2.39391 3.49171 2.59743 3.14849 2.87551 2.87098C3.1536 2.59347 3.49725 2.39068 3.87461 2.28139C4.25197 2.1721 4.65081 2.15986 5.03416 2.24581C5.24515 1.91582 5.53583 1.64425 5.87938 1.45614C6.22293 1.26803 6.60831 1.16943 6.99999 1.16943C7.39167 1.16943 7.77705 1.26803 8.1206 1.45614C8.46415 1.64425 8.75483 1.91582 8.96582 2.24581C9.34975 2.15949 9.74928 2.17167 10.1272 2.28123C10.5052 2.39078 10.8493 2.59414 11.1276 2.8724C11.4058 3.15066 11.6092 3.49477 11.7187 3.87273C11.8283 4.25068 11.8405 4.65021 11.7542 5.03414C12.0841 5.24514 12.3557 5.53581 12.5438 5.87936C12.7319 6.22292 12.8305 6.60829 12.8305 6.99998C12.8305 7.39166 12.7319 7.77703 12.5438 8.12059C12.3557 8.46414 12.0841 8.75481 11.7542 8.96581C11.8401 9.34916 11.8279 9.748 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4025 10.5083 11.6061 10.1311 11.7161C9.754 11.8262 9.35518 11.8393 8.97166 11.7541C8.76093 12.0854 8.47004 12.3581 8.1259 12.5471C7.78176 12.736 7.39551 12.8351 7.00291 12.8351C6.61031 12.8351 6.22406 12.736 5.87992 12.5471C5.53578 12.3581 5.24488 12.0854 5.03416 11.7541C4.65081 11.8401 4.25197 11.8278 3.87461 11.7186C3.49725 11.6093 3.1536 11.4065 2.87551 11.129C2.59743 10.8515 2.39391 10.5082 2.28383 10.1311C2.17375 9.75398 2.16068 9.35517 2.24582 8.97164C1.9133 8.7612 1.6394 8.47008 1.4496 8.12535C1.25981 7.78062 1.16028 7.3935 1.16028 6.99998C1.16028 6.60645 1.25981 6.21933 1.4496 5.8746C1.6394 5.52987 1.9133 5.23875 2.24582 5.02831Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5.30249 5.25009C5.43963 4.86023 5.71033 4.53148 6.06663 4.32208C6.42293 4.11268 6.84185 4.03614 7.24918 4.106C7.65651 4.17587 8.02597 4.38764 8.29212 4.70381C8.55827 5.01998 8.70394 5.42014 8.70332 5.83342C8.70332 7.00009 6.95332 7.58342 6.95332 7.58342" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 9.91675H7.00583" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <defs>
          <clipPath id="reelUnknownClip"><rect width="14" height="14" fill="white"/></clipPath>
        </defs>
      </svg>
    );
  }
  return <TypeIcon type={type} color={color} size={14} />;
}

const REEL_FILTER_CFG: { id: ReelFilter; label: string; color?: string; activeBg?: string }[] = [
  { id:"All",     label:"All" },
  { id:"VIP",     label:"VIP",     color: DET_COLOR.VIP,     activeBg:"#f0f0ff" },
  { id:"Vehicle", label:"Vehicle", color: DET_COLOR.Vehicle, activeBg:"#f2faff" },
  { id:"Unknown", label:"Unknown", color: DET_COLOR.Unknown, activeBg:"#fef3c7" },
];

function ReelFilterBar({ filter, onChange }: { filter: ReelFilter; onChange: (f: ReelFilter) => void }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
      {REEL_FILTER_CFG.map(f => {
        const active = filter === f.id;
        if (f.id === "All") {
          return (
            <button key="All" onClick={() => onChange("All")} style={{
              padding:"6px 14px", borderRadius:"999px", cursor:"pointer",
              border: active ? "1px solid #324055" : "1px solid #ccd5e1",
              backgroundColor: active ? "#f1f5f9" : "white",
              color:"#324055", fontSize:"12px", fontWeight: active ? 700 : 600,
            }}>All</button>
          );
        }
        const c = f.color!;
        return (
          <button key={f.id} onClick={() => onChange(f.id)} style={{
            display:"flex", alignItems:"center", gap:"5px",
            padding:"6px 10px", borderRadius:"999px", cursor:"pointer",
            border: active ? `1px solid ${c}` : "1px solid #ccd5e1",
            backgroundColor: active ? f.activeBg : "white",
            color: active ? c : "#324055", fontSize:"12px", fontWeight: active ? 700 : 600,
          }}>
            <ReelFilterIcon type={f.id as DetType} color={c} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Tag chip ─────────────────────────────────────────────────── */
function Tag({ label }: { label: string }) {
  return (
    <span style={{ backgroundColor:"#f1f5f9", borderRadius:"999px", padding:"3px 9px", fontSize:"11px", fontWeight:600, color:"#475569", whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

/* ── Also-captured card — body crop + overlapping face-crop bubble, per
   Figma node 573:37303 ─────────────────────────────────────────── */
function AlsoCapturedCard({ det, index, onClick }: { det: Detection; index: number; onClick: () => void }) {
  const photo = AVATAR[index % AVATAR.length];
  return (
    <button onClick={onClick} style={{ background:"none", border:"none", padding:0, cursor:"pointer", flexShrink:0, width:"84px" }}>
      <div style={{ position:"relative", width:"84px", height:"108px" }}>
        <div style={{ width:"84px", height:"108px", borderRadius:"10px", overflow:"hidden", backgroundColor:"#0e162a" }}>
          <img src={photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top", display:"block" }} />
        </div>
        {/* Face-crop bubble, overlapping the body photo's bottom-left corner */}
        <div style={{ position:"absolute", left:"-6px", bottom:"-6px", width:"36px", height:"36px", borderRadius:"50%", overflow:"hidden", border:"2px solid white", boxShadow:"0 1px 4px rgba(14,22,42,0.18)" }}>
          <img src={photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }} />
        </div>
      </div>
      <p style={{ marginTop:"8px", fontSize:"11px", fontWeight:700, color:"#0e162a", textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {det.name}
      </p>
    </button>
  );
}

function MaleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="5" cy="7" r="3" stroke="#0e162a" strokeWidth="1"/>
      <path d="M7.3 4.7L10 2M10 2H7.3M10 2V4.7" stroke="#0e162a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Reel card ────────────────────────────────────────────────── */
function ReelCard({ det, index, isFocused, onClick }: { det: Detection; index: number; isFocused: boolean; onClick: () => void }) {
  const c = DET_COLOR[det.type];
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"8px", cursor:"pointer",
        padding:"8px", margin:"-8px", boxSizing:"border-box", borderRadius:"12px",
        outline: isFocused ? "2px solid #5a3dfb" : hovered ? "1px solid #cbd5e1" : "none",
        boxShadow: isFocused ? "0 0 0 3px rgba(90,61,251,0.12)" : "none",
        backgroundColor: hovered && !isFocused ? "#f8fafc" : "transparent",
        transition: "background-color 0.15s ease",
      }}
    >
      <div style={{
        position:"relative", width:"100%", aspectRatio:"140/154", borderRadius:"10px", overflow:"hidden", backgroundColor:"#0e162a",
      }}>
        <img src={AVATAR[index % AVATAR.length]} alt=""
          style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top", display:"block" }} />
        <div style={{ position:"absolute", top:6, left:6, backgroundColor:"rgba(14,22,42,0.75)", borderRadius:"4px", padding:"2px 6px", fontSize:"9px", fontWeight:700, color:"white" }}>
          P-0{index + 1}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
          <TypeIcon type={det.type} color={c} size={12} />
          <span style={{ fontSize:"12px", fontWeight:600, color:c }}>{det.type}</span>
        </div>
        {/* Confidence is a match-against-registry score — only meaningful for VIP, since
            Vehicle/Unknown have nothing registered to match against. */}
        {det.type === "VIP" && (
          <span style={{ fontSize:"10px", fontWeight:700, color:"#64748a" }}>{det.confidence}%</span>
        )}
      </div>
      <p style={{ fontSize:"13px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.24px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {det.name}
      </p>
      <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
        <span style={{ backgroundColor:"#f1f5f9", borderRadius:"999px", padding:"2px 6px", display:"flex", alignItems:"center" }}>
          <MaleIcon />
        </span>
        {PERSON_TAGS[det.type].map(t => <Tag key={t} label={t} />)}
      </div>
    </div>
  );
}

/* ── Best Frame Reel panel ─────────────────────────────────────── */
function BestFrameReel({ data, focusedId, onFocus, onSelect, filter, onFilterChange }: {
  data: CamData; focusedId: string;
  onFocus: (det: Detection) => void;
  onSelect: (det: Detection) => void;
  filter: ReelFilter;
  onFilterChange: (f: ReelFilter) => void;
}) {
  const dets = filter === "All" ? data.detections : data.detections.filter(d => d.type === filter);
  return (
    <div style={{ width:"380px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 12px", borderBottom:BORDER, flexShrink:0, display:"flex", flexDirection:"column", gap:"12px" }}>
        <div>
          <p style={{ fontSize:"14px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.28px" }}>Best Frame Reel</p>
          <p style={{ fontSize:"11px", color:"#94a3b8", marginTop:"2px" }}>Objects captured in current frame</p>
        </div>
        <ReelFilterBar filter={filter} onChange={onFilterChange} />
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px", display:"flex", flexDirection:"column", gap:"12px" }}>
        {dets.length === 0 && (
          <div style={{ padding:"24px 0", textAlign:"center", color:"#94a3b8", fontSize:"12px" }}>No detections</div>
        )}
        {Array.from({ length: Math.ceil(dets.length / 2) }).map((_, rowIdx) => {
          const left = dets[rowIdx * 2];
          const right = dets[rowIdx * 2 + 1];
          const isLastRow = rowIdx === Math.ceil(dets.length / 2) - 1;
          return (
            <div key={rowIdx} style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              <div style={{ display:"flex", alignItems:"stretch", gap:"12px" }}>
                <ReelCard det={left} index={rowIdx * 2} isFocused={left.id === focusedId} onClick={() => { onFocus(left); onSelect(left); }} />
                {right && (
                  <>
                    <div style={{ width:"1px", backgroundColor:"#e2e8f0", flexShrink:0 }} />
                    <ReelCard det={right} index={rowIdx * 2 + 1} isFocused={right.id === focusedId} onClick={() => { onFocus(right); onSelect(right); }} />
                  </>
                )}
              </div>
              {!isLastRow && <div style={{ height:"1px", backgroundColor:"#e2e8f0", width:"100%" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── AI Inspection Detail panel ───────────────────────────────── */
function AIInspectionDetail({ det, data, onClose, onSelectOther, onGoRedmapTrace }: { det: Detection; data: CamData; onClose: () => void; onSelectOther: (det: Detection) => void; onGoRedmapTrace?: (name: string) => void }) {
  const attrs = ATTRS[det.type];
  const c = DET_COLOR[det.type];

  return (
    <div style={{ width:"380px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"14px 16px 10px", borderBottom:BORDER, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <p style={{ fontSize:"16px", fontWeight:700, color:"#0e162a", letterSpacing:"-0.32px" }}>Inspection Detail</p>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:"16px", lineHeight:1, padding:"0 2px" }}>✕</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
        {/* Photo comparison */}
        <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", marginBottom:"14px" }}>
          <div style={{ flex:"0 0 77px", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
            <img src={LIVE_CAPTURE_PHOTO} alt="" style={{ width:"77px", height:"177px", objectFit:"cover", objectPosition:"top", borderRadius:"8px", display:"block" }} />
            <p style={{ fontSize:"11px", fontWeight:800, color:"#5a3dfb", letterSpacing:"-0.2px" }}>LIVE Capture</p>
          </div>
          <div style={{ flex:1, alignSelf:"flex-end", height:"177px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px" }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path d="M5 4L3 6L5 8" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6H13" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 12L13 10L11 8" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 10H3" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize:"13px", fontWeight:800, color:"#0e162a" }}>{det.confidence || 0}%</span>
          </div>
          <div style={{ flex:"0 0 176px", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
            <img src={DB_PHOTO} alt="" style={{ width:"176px", height:"177px", objectFit:"cover", objectPosition:"top", borderRadius:"10px", display:"block" }} />
            <p style={{ fontSize:"11px", fontWeight:600, color:"#64748a", letterSpacing:"-0.2px" }}>ENROLLED DB</p>
          </div>
        </div>

        {/* Name */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
          <TypeIcon type={det.type} color={c} size={15} />
          <span style={{ fontSize:"16px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.32px" }}>{det.name}</span>
        </div>
        <p style={{ fontSize:"11px", fontWeight:500, color:"#64748a", marginBottom:"14px" }}>Registered: {REGISTERED[det.type]}</p>

        {/* Divider — info below is separated by rules, not a boxed container */}
        <div style={{ height:"1px", backgroundColor:"#e2e8f0", marginBottom:"14px" }} />

        {/* Meta */}
        <div style={{ marginBottom:"14px" }}>
          {[["Camera Name", data.location], ["Event Time", `2026-07-13 ${det.time}`]].map(([k, v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", padding:"3px 0" }}>
              <span style={{ fontSize:"12px", color:"#64748a", fontWeight:600, width:"88px", flexShrink:0 }}>{k}</span>
              <span style={{ fontSize:"13px", color:"#0e162a", fontWeight:700 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height:"1px", backgroundColor:"#e2e8f0", marginBottom:"22px" }} />

        {/* AI Analysis Results */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"10px" }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8.00195 1.33301C8.1574 1.33309 8.30814 1.38798 8.42773 1.4873C8.54731 1.58669 8.62868 1.72508 8.65723 1.87793L9.35742 5.58301C9.40718 5.84636 9.53512 6.08878 9.72461 6.27832C9.9141 6.46781 10.1566 6.5957 10.4199 6.64551L14.126 7.34668C14.2785 7.37528 14.4164 7.45589 14.5156 7.5752C14.615 7.69488 14.6699 7.84638 14.6699 8.00195C14.6698 8.1574 14.6149 8.30814 14.5156 8.42773C14.4163 8.54716 14.2786 8.62864 14.126 8.65723L10.4199 9.35742C10.1566 9.40723 9.91411 9.53511 9.72461 9.72461C9.53511 9.91411 9.40723 10.1566 9.35742 10.4199L8.65723 14.126C8.62864 14.2786 8.54716 14.4163 8.42773 14.5156C8.30814 14.6149 8.1574 14.6698 8.00195 14.6699C7.84638 14.6699 7.69488 14.615 7.5752 14.5156C7.45589 14.4164 7.37528 14.2785 7.34668 14.126L6.64551 10.4199C6.5957 10.1566 6.46781 9.9141 6.27832 9.72461C6.08878 9.53512 5.84636 9.40718 5.58301 9.35742L1.87793 8.65723C1.72508 8.62868 1.58669 8.54731 1.4873 8.42773C1.38798 8.30814 1.33309 8.1574 1.33301 8.00195C1.33301 7.84638 1.38791 7.69488 1.4873 7.5752C1.58668 7.45571 1.72515 7.37522 1.87793 7.34668L5.58301 6.64551C5.8464 6.59573 6.08877 6.46787 6.27832 6.27832C6.46787 6.08877 6.59573 5.8464 6.64551 5.58301L7.34668 1.87793C7.37522 1.72515 7.45571 1.58668 7.5752 1.4873C7.69488 1.38791 7.84638 1.33301 8.00195 1.33301ZM2.66699 12C3.40311 12.0002 3.99982 12.5969 4 13.333C4 14.0693 3.40322 14.6668 2.66699 14.667C1.93061 14.667 1.33301 14.0694 1.33301 13.333C1.33318 12.5968 1.93072 12 2.66699 12ZM13.333 0.833008C13.609 0.833008 13.8328 1.05702 13.833 1.33301V2.16699H14.667C14.943 2.16717 15.167 2.39096 15.167 2.66699C15.1668 2.94288 14.9429 3.16682 14.667 3.16699H13.833V4C13.8328 4.27599 13.609 4.5 13.333 4.5C13.0571 4.49982 12.8332 4.27588 12.833 4V3.16699H12C11.724 3.16699 11.5002 2.94298 11.5 2.66699C11.5 2.39085 11.7239 2.16699 12 2.16699H12.833V1.33301C12.8332 1.05712 13.0571 0.833183 13.333 0.833008Z" fill="#5a3dfb"/>
          </svg>
          <p style={{ fontSize:"13px", fontWeight:700, color:"#5a3dfb", letterSpacing:"-0.26px" }}>Analysis Results</p>
        </div>
        {[["Basic", attrs.basic], ["Top", attrs.top], ["Bottom", attrs.bottom], ["Add-ons", attrs.addons]]
          .filter(([, v]) => (v as string[]).length > 0)
          .map(([label, tags]) => (
            <div key={label as string} style={{ display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"8px" }}>
              <span style={{ fontSize:"11px", fontWeight:700, color:"#475469", width:"52px", flexShrink:0, paddingTop:"2px" }}>{label as string}</span>
              <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                {(tags as string[]).map(t => <Tag key={t} label={t} />)}
              </div>
            </div>
          ))}

        {/* Also captured in this frame */}
        {data.detections.filter(d => d.id !== det.id).length > 0 && (
          <>
            <p style={{ fontSize:"13px", fontWeight:700, color:"#0e162a", letterSpacing:"-0.26px", marginTop:"18px", marginBottom:"12px" }}>Also Captured In This Frame</p>
            <div style={{ display:"flex", gap:"14px", overflowX:"auto", paddingBottom:"4px" }}>
              {data.detections.filter(d => d.id !== det.id).map((d, i) => (
                <AlsoCapturedCard key={d.id} det={d} index={i} onClick={() => onSelectOther(d)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Buttons */}
      <div style={{ padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", flexShrink:0 }}>
        <button onClick={onClose} style={{ padding:"9px 0", borderRadius:"8px", border:BORDER, backgroundColor:"white", color:"#334155", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
          Back
        </button>
        <button onClick={() => onGoRedmapTrace?.(det.name)} style={{ padding:"9px 0", borderRadius:"8px", border:"none", backgroundColor:"#0e162a", color:"white", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M16.6667 8.33333C16.6667 13.3333 10 18.3333 10 18.3333C10 18.3333 3.33333 13.3333 3.33333 8.33333C3.33333 6.56522 4.03571 4.86953 5.28596 3.61929C6.5362 2.36905 8.23189 1.66667 10 1.66667C11.7681 1.66667 13.4638 2.36905 14.714 3.61929C15.9643 4.86953 16.6667 6.56522 16.6667 8.33333Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 10.8333C11.3807 10.8333 12.5 9.71404 12.5 8.33333C12.5 6.95262 11.3807 5.83333 10 5.83333C8.61929 5.83333 7.5 6.95262 7.5 8.33333C7.5 9.71404 8.61929 10.8333 10 10.8333Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Track on Map
        </button>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
const TRACK_DATES = ["2026-06-25", "2026-06-24", "2026-06-23", "2026-06-22", "2026-06-21"];

export default function BestFrameDetailPage({ data, initialDet, onBack, onGoRedmapTrace }: DetailProps) {
  const [selectedPerson, setSelectedPerson] = useState<Detection | null>(null);
  const [focusedDet, setFocusedDet] = useState<Detection>(initialDet);
  const [trackDate, setTrackDate] = useState(TRACK_DATES[0]);
  const [dateOpen, setDateOpen] = useState(false);
  const [cameraHovered, setCameraHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reelFilter, setReelFilter] = useState<ReelFilter>("All");

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden", backgroundColor:"white" }}>

      {/* ── Main area ─────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

        {/* Breadcrumb */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 20px", borderBottom:BORDER, backgroundColor:"white", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:"5px", background:"none", border:"none", cursor:"pointer", color:"#64748a", fontSize:"13px", fontWeight:600 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="#64748a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Best frame
            </button>
            <span style={{ color:"#cbd5e1" }}>›</span>
            <div style={{ display:"flex", alignItems:"center", gap:"5px", color:"#334155", fontSize:"13px", fontWeight:600 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="5" width="12" height="8" rx="1.5" stroke="#64748a" strokeWidth="1.3"/>
                <circle cx="8" cy="9" r="2" stroke="#64748a" strokeWidth="1.3"/>
                <path d="M6 5V4a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1" stroke="#64748a" strokeWidth="1.3"/>
              </svg>
              {data.location}
            </div>
            <span style={{ color:"#cbd5e1" }}>›</span>
            <div style={{ display:"flex", alignItems:"center", gap:"5px", color:"#334155", fontSize:"13px", fontWeight:600 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#64748a" strokeWidth="1.3"/>
                <path d="M8 5v3l2 2" stroke="#64748a" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              2026-07-10
            </div>
          </div>
          <div style={{ padding:"4px 10px", fontSize:"11px", fontWeight:700, color:"#64748a" }}>
            AI Engine v5.22.2
          </div>
        </div>

        {/* Camera feed */}
        <div
          onMouseEnter={() => setCameraHovered(true)}
          onMouseLeave={() => setCameraHovered(false)}
          style={{ flex:1, position:"relative", overflow:"hidden", backgroundColor:"#0e162a", minHeight:0 }}
        >
          <img src={data.bgUrl ?? ""} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", opacity:0.9 }} />
          <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"linear-gradient(to bottom,rgba(0,0,0,0) 50%,rgba(0,0,0,0.04) 50%)", backgroundSize:"100% 4px" }} />
          <div style={{ position:"absolute", top:12, right:14, backgroundColor:"rgba(14,22,42,0.65)", padding:"3px 8px", fontSize:"10px", fontWeight:600, color:"rgba(255,255,255,0.8)", letterSpacing:"0.5px" }}>
            19-05-2026 14 21.0
          </div>

          {data.detections.map((det, i) => {
            const isFocused = det.id === focusedDet.id;
            if (selectedPerson && !isFocused) return null;
            const isDash = det.type === "Unknown";
            // Every box stays clearly visible (not just the focused one) — focus just brightens
            // and thickens it, matching the "always-on bounding box" look of the reference.
            // VIP boxes always render in the primary purple — a VIP hit is an identity signal,
            // not just a focus state, so it stays purple whether focused or not.
            const borderColor = det.type === "VIP" ? "#5a3dfb" : isFocused ? "#38bdf8" : "#3b82f6";
            return (
              <div key={det.id}
                onClick={() => { setFocusedDet(det); setSelectedPerson(det); }}
                style={{
                  position:"absolute", zIndex:10, cursor:"pointer",
                  top:det.top, left:det.left, width:det.width, height:det.height,
                  border:`${isFocused ? 3 : 2}px ${isDash ? "dashed" : "solid"} ${borderColor}`,
                  borderRadius:"3px", boxSizing:"border-box",
                  transition:"border-color 0.15s, border-width 0.15s",
                }}
              >
                <div style={{
                  position:"absolute", bottom:"calc(100% + 4px)", left:0,
                  backgroundColor:"white", padding:"3px 8px",
                  display:"flex", alignItems:"center", gap:"5px", whiteSpace:"nowrap",
                  boxShadow:"0 1px 6px rgba(14,22,42,0.12)",
                  opacity: isFocused ? 1 : 0.85,
                }}>
                  <span style={{ fontSize:"10px", fontWeight:700, color:"#64748a" }}>P-0{i + 1}</span>
                  {det.type === "VIP" && <TypeIcon type="VIP" color="#8b5cf6" size={10} />}
                  <span style={{ fontSize:"10px", fontWeight:700, color:"#0e162a" }}>{det.name}</span>
                </div>
              </div>
            );
          })}

          {/* Play bar (shown on hover) */}
          {cameraHovered && (
            <div style={{
              position:"absolute", bottom:"20px", left:"50%", transform:"translateX(-50%)",
              zIndex:20, width:"244px", height:"60px", borderRadius:"30px",
              backgroundColor:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"0 14px", boxSizing:"border-box",
            }}>
              {/* Skip back */}
              <button onClick={() => {}} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="16" fill="white" fillOpacity="0.0784314"/>
                  <path d="M16 11.4997C15.9999 11.2031 15.9119 10.9131 15.7471 10.6665C15.5823 10.4199 15.348 10.2277 15.074 10.1142C14.7999 10.0007 14.4984 9.97095 14.2075 10.0288C13.9165 10.0867 13.6493 10.2295 13.4395 10.4392L8.9395 14.9392C8.65829 15.2205 8.50032 15.6019 8.50032 15.9997C8.50032 16.3974 8.65829 16.7789 8.9395 17.0602L13.4395 21.5602C13.6493 21.7699 13.9165 21.9127 14.2075 21.9706C14.4984 22.0284 14.7999 21.9987 15.074 21.8852C15.348 21.7717 15.5823 21.5795 15.7471 21.3329C15.9119 21.0863 15.9999 20.7963 16 20.4997V11.4997Z" fill="white" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23.5 11.4997C23.4999 11.2031 23.4119 10.9131 23.2471 10.6665C23.0823 10.4199 22.848 10.2277 22.574 10.1142C22.2999 10.0007 21.9984 9.97095 21.7075 10.0288C21.4165 10.0867 21.1493 10.2295 20.9395 10.4392L16.4395 14.9392C16.1583 15.2205 16.0003 15.6019 16.0003 15.9997C16.0003 16.3974 16.1583 16.7789 16.4395 17.0602L20.9395 21.5602C21.1493 21.7699 21.4165 21.9127 21.7075 21.9706C21.9984 22.0284 22.2999 21.9987 22.574 21.8852C22.848 21.7717 23.0823 21.5795 23.2471 21.3329C23.4119 21.0863 23.4999 20.7963 23.5 20.4997V11.4997Z" fill="white" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {/* Prev frame */}
              <button onClick={() => {}} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="16" fill="white" fillOpacity="0.0784314"/>
                  <path d="M21.2311 10.0001C20.9657 10.0035 20.7059 10.0772 20.4783 10.2137L12.9784 14.7133C12.756 14.8466 12.572 15.0354 12.4444 15.261C12.3167 15.4867 12.2497 15.7415 12.25 16.0008C12.2502 16.26 12.3176 16.5148 12.4457 16.7402C12.5737 16.9657 12.758 17.154 12.9806 17.287L20.4783 21.7851C20.7059 21.9216 20.9657 21.9953 21.2311 21.9987C21.4965 22.002 21.7581 21.9349 21.9891 21.8041C22.22 21.6733 22.4122 21.4836 22.5459 21.2543C22.6796 21.025 22.75 20.7644 22.75 20.4989V11.4999C22.75 11.2344 22.6796 10.9738 22.5459 10.7445C22.4122 10.5152 22.22 10.3255 21.9891 10.1947C21.7581 10.0639 21.4965 9.99677 21.2311 10.0001Z" fill="white"/>
                  <path d="M9.25 21.9988V10M20.4783 10.2137C20.7059 10.0772 20.9657 10.0035 21.2311 10.0001C21.4965 9.99677 21.7581 10.0639 21.9891 10.1947C22.22 10.3255 22.4122 10.5152 22.5459 10.7445C22.6796 10.9738 22.75 11.2344 22.75 11.4999V20.4989C22.75 20.7644 22.6796 21.025 22.5459 21.2543C22.4122 21.4836 22.22 21.6733 21.9891 21.8041C21.7581 21.9349 21.4965 22.002 21.2311 21.9987C20.9657 21.9953 20.7059 21.9216 20.4783 21.7851L12.9806 17.287C12.758 17.154 12.5737 16.9657 12.4457 16.7402C12.3176 16.5148 12.2502 16.26 12.25 16.0008C12.2497 15.7415 12.3167 15.4867 12.4444 15.261C12.572 15.0354 12.756 14.8466 12.9784 14.7133L20.4783 10.2137Z" stroke="white" strokeLinecap="round"/>
                </svg>
              </button>
              {/* Play/Pause */}
              <button onClick={() => setIsPlaying(p => !p)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}>
                {isPlaying ? (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="20" fill="#5A3DFB"/>
                    <rect x="14" y="13" width="4" height="14" rx="1.5" fill="white"/>
                    <rect x="22" y="13" width="4" height="14" rx="1.5" fill="white"/>
                  </svg>
                ) : (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="20" fill="#5A3DFB"/>
                    <path d="M14.9511 13.9987C14.8189 14.2272 14.7493 14.4864 14.7494 14.7503V25.2497C14.7493 25.5136 14.8189 25.7728 14.9511 26.0013C15.0833 26.2297 15.2734 26.4192 15.5023 26.5507C15.7312 26.6821 15.9907 26.7509 16.2547 26.75C16.5186 26.7491 16.7777 26.6786 17.0057 26.5456L26.0068 21.2959C26.2336 21.1638 26.4219 20.9744 26.5526 20.7468C26.6833 20.5191 26.752 20.2611 26.7518 19.9986C26.7516 19.7361 26.6824 19.4782 26.5513 19.2508C26.4202 19.0234 26.2316 18.8343 26.0045 18.7026L17.0057 13.4544C16.7777 13.3214 16.5186 13.2509 16.2547 13.25C15.9907 13.2491 15.7312 13.3179 15.5023 13.4493C15.2734 13.5808 15.0833 13.7703 14.9511 13.9987Z" fill="white" stroke="white" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
              {/* Next frame */}
              <button onClick={() => {}} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="16" fill="white" fillOpacity="0.0784314"/>
                  <path d="M10.7689 10.0001C11.0344 10.0035 11.2941 10.0772 11.5217 10.2137L19.0217 14.7133C19.2441 14.8466 19.4281 15.0354 19.5557 15.261C19.6834 15.4867 19.7504 15.7415 19.7502 16.0008C19.7499 16.26 19.6825 16.5148 19.5544 16.7402C19.4264 16.9657 19.2421 17.154 19.0195 17.287L11.5217 21.7851C11.2941 21.9216 11.0344 21.9953 10.7689 21.9987C10.5035 22.002 10.2419 21.9349 10.0109 21.8041C9.77996 21.6733 9.58781 21.4836 9.45412 21.2543C9.32044 21.025 9.25 20.7644 9.25 20.4989V11.4999C9.25 11.2344 9.32044 10.9738 9.45412 10.7445C9.58781 10.5152 9.77996 10.3255 10.0109 10.1947C10.2419 10.0639 10.5035 9.99677 10.7689 10.0001Z" fill="white"/>
                  <path d="M22.75 10V21.9988M11.5217 10.2137C11.2941 10.0772 11.0344 10.0035 10.7689 10.0001C10.5035 9.99677 10.2419 10.0639 10.0109 10.1947C9.77996 10.3255 9.58781 10.5152 9.45412 10.7445C9.32044 10.9738 9.25 11.2344 9.25 11.4999V20.4989C9.25 20.7644 9.32044 21.025 9.45412 21.2543C9.58781 21.4836 9.77996 21.6733 10.0109 21.8041C10.2419 21.9349 10.5035 22.002 10.7689 21.9987C11.0344 21.9953 11.2941 21.9216 11.5217 21.7851L19.0195 17.287C19.2421 17.154 19.4264 16.9657 19.5544 16.7402C19.6825 16.5148 19.7499 16.26 19.7502 16.0008C19.7504 15.7415 19.6834 15.4867 19.5557 15.261C19.4281 15.0354 19.2441 14.8466 19.0217 14.7133L11.5217 10.2137Z" stroke="white" strokeLinecap="round"/>
                </svg>
              </button>
              {/* Skip forward */}
              <button onClick={() => {}} style={{ background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="16" fill="white" fillOpacity="0.0784314"/>
                  <path d="M16 11.4997C16.0001 11.2031 16.0881 10.9131 16.2529 10.6665C16.4177 10.4199 16.652 10.2277 16.926 10.1142C17.2001 10.0007 17.5016 9.97095 17.7925 10.0288C18.0835 10.0867 18.3507 10.2295 18.5605 10.4392L23.0605 14.9392C23.3417 15.2205 23.4997 15.6019 23.4997 15.9997C23.4997 16.3974 23.3417 16.7789 23.0605 17.0602L18.5605 21.5602C18.3507 21.7699 18.0835 21.9127 17.7925 21.9706C17.5016 22.0284 17.2001 21.9987 16.926 21.8852C16.652 21.7717 16.4177 21.5795 16.2529 21.3329C16.0881 21.0863 16.0001 20.7963 16 20.4997V11.4997Z" fill="white" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.5 11.4997C8.50006 11.2031 8.58807 10.9131 8.7529 10.6665C8.91772 10.4199 9.15197 10.2277 9.42602 10.1142C9.70007 10.0007 10.0016 9.97095 10.2925 10.0288C10.5835 10.0867 10.8507 10.2295 11.0605 10.4392L15.5605 14.9392C15.8417 15.2205 15.9997 15.6019 15.9997 15.9997C15.9997 16.3974 15.8417 16.7789 15.5605 17.0602L11.0605 21.5602C10.8507 21.7699 10.5835 21.9127 10.2925 21.9706C10.0016 22.0284 9.70007 21.9987 9.42602 21.8852C9.15197 21.7717 8.91772 21.5795 8.7529 21.3329C8.58807 21.0863 8.50006 20.7963 8.5 20.4997V11.4997Z" fill="white" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Timeline (hidden when AI Inspection Detail is open) ──── */}
        <div style={{ backgroundColor:"white", borderTop:BORDER, flexShrink:0, display: selectedPerson ? "none" : "block" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 16px 14px" }}>
            <span style={{ fontSize:"13px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.26px" }}>Multi-Track Event History</span>
            <div style={{ position:"relative" }}>
              <button onClick={() => setDateOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:"6px", backgroundColor:"white", borderRadius:"8px", padding:"6px 12px", border:"1px solid #ccd5e1", cursor:"pointer" }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="#0e162a" strokeWidth="1.4"/>
                  <path d="M8 5v3l2 2" stroke="#0e162a" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize:"12px", fontWeight:700, color:"#0e162a" }}>{trackDate}</span>
                <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                  <path d="M2 3L4 5L6 3" stroke="#0e162a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {dateOpen && (
                <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", backgroundColor:"white", borderRadius:"8px", boxShadow:"0 4px 16px rgba(0,0,0,0.12)", border:"1px solid #e2e8f0", overflow:"hidden", zIndex:50, minWidth:"120px" }}>
                  {TRACK_DATES.map(d => (
                    <button key={d} onClick={() => { setTrackDate(d); setDateOpen(false); }} style={{ display:"block", width:"100%", padding:"7px 12px", border:"none", background: d === trackDate ? "#f0f0ff" : "white", cursor:"pointer", fontSize:"11px", fontWeight: d === trackDate ? 700 : 500, color: d === trackDate ? "#5a3dfb" : "#334155", textAlign:"left" }}>
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Track rows + cursor line — Unknown's own row was dropped, not something anyone
              checks via this timeline bar. */}
          <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:"10px", position:"relative" }}>
            {/* Cursor vertical line */}
            <div style={{ position:"absolute", top:0, bottom:0, left:`calc(16px + 36%)`, width:"1.5px", backgroundColor:"#38bdf8", zIndex:10, pointerEvents:"none" }} />

            {/* VIP — per Figma node 161:23734: pill starts at 13.5% of the track, spans 32% of
                it, with 8 icons evenly spaced by the pill's own flex layout (not hand-placed
                percentages). */}
            <div style={{ position:"relative", height:"32px", backgroundColor:"#F1F5F9", borderRadius:"999px" }}>
              <div style={{
                position:"absolute", top:"4px", bottom:"4px", left:"13.5%", width:"32%",
                backgroundColor:"#f0f0ff", borderRadius:"999px", outline:`1px solid ${DET_COLOR.VIP}`,
                display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px",
              }}>
                {Array.from({ length:8 }).map((_, i) => <TypeIcon key={i} type="VIP" color={DET_COLOR.VIP} size={16} />)}
              </div>
            </div>
            {/* Vehicle — per Figma node 161:23760: pill starts at 2.5%, spans 39.5%, 7 icons. */}
            <div style={{ position:"relative", height:"32px", backgroundColor:"#F1F5F9", borderRadius:"999px" }}>
              <div style={{
                position:"absolute", top:"4px", bottom:"4px", left:"2.5%", width:"39.5%",
                backgroundColor:"#e0f2fe", borderRadius:"999px", outline:`1px solid ${DET_COLOR.Vehicle}`,
                display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px",
              }}>
                {Array.from({ length:7 }).map((_, i) => <TypeIcon key={i} type="Vehicle" color={DET_COLOR.Vehicle} size={16} />)}
              </div>
            </div>
          </div>

          {/* Frame strip */}
          <div style={{ display:"flex", gap:"6px", padding:"10px 16px 18px", overflowX:"auto" }}>
            {FRAMES.map((ts, i) => {
              const isSelected = i === SELECTED_FRAME;
              return (
                <div key={i} style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:"5px" }}>
                  <div style={{
                    width:"128px", height:"82px", boxSizing:"border-box",
                    padding: isSelected ? "2px" : "1.5px",
                    background: isSelected ? "linear-gradient(90deg, #52D5FF 0%, #0047FF 50.5%, #DBB7FF 100%)" : "#E2E8F0",
                    borderRadius:"9px",
                  }}>
                    <div style={{ width:"100%", height:"100%", overflow:"hidden", borderRadius:"7px", position:"relative", backgroundColor:"#1e293b" }}>
                      <img src={data.bgUrl ?? ""} alt=""
                        style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", filter: isSelected ? "none" : "grayscale(100%)", opacity: isSelected ? 1 : 0.75 }} />
                      {/* Detection count badge */}
                      <div style={{ position:"absolute", top:5, right:5, width:"19px", height:"19px", borderRadius:"50%", backgroundColor:"rgba(255,255,255,0.9)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:"9px", fontWeight:700, color:"#334155" }}>2</span>
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize:"12px", fontWeight: isSelected ? 800 : 500, color: isSelected ? "#38bdf8" : "#94a3b8" }}>{ts}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────── */}
      {selectedPerson ? (
        <AIInspectionDetail det={selectedPerson} data={data} onClose={() => setSelectedPerson(null)} onSelectOther={(d) => { setFocusedDet(d); setSelectedPerson(d); }} onGoRedmapTrace={onGoRedmapTrace} />
      ) : (
        <BestFrameReel data={data} focusedId={focusedDet.id} onFocus={setFocusedDet} onSelect={setSelectedPerson} filter={reelFilter} onFilterChange={setReelFilter} />
      )}
    </div>
  );
}
