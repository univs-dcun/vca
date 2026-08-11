
import { useState, useRef, useEffect } from "react";
import RedmapMap, { TRACKING_ORIGIN } from "./RedmapMap";
import type { RedmapMode as Mode, SimilarityLimit, HitResult, DateRange } from "../types/redmap";

const BORDER = "1px solid #e2e8f0";

export const MOCK_RESULTS: HitResult[] = [
  {
    id: "hit-1",
    camera: "Novena NC 1",
    location: "NC 1 Novena",
    date: "2026-06-12",
    time: "10:50:12",
    score: "99.7%",
    bodyScore: "85.0%",
    isUnregistered: false,
    faceUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Novena",
    lat: 1.3200, lng: 103.8440,
    elapsed: "20m 12s Elapsed", elapsedAlert: false,
  },
  {
    id: "hit-2",
    camera: "Geylang NC 3",
    location: "NC 3 Geylang",
    date: "2026-06-12",
    time: "11:20:44",
    score: "99.4%",
    bodyScore: "78.2%",
    isUnregistered: false,
    faceUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Geylang",
    lat: 1.3131, lng: 103.8600,
    elapsed: "30m 32s Elapsed", elapsedAlert: false,
  },
  {
    id: "hit-3",
    camera: "Marine NC 2",
    location: "NC 2 Marine Parade",
    date: "2026-06-13",
    time: "12:00:09",
    score: "82.3%",
    bodyScore: "70.1%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Marine",
    lat: 1.3015, lng: 103.9070,
  },
];

/* ── SVG Icons ──────────────────────────────────────────────── */
function PersonIcon({ color = "currentColor", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M9.99992 10.8333C12.3011 10.8333 14.1666 8.96785 14.1666 6.66667C14.1666 4.36548 12.3011 2.5 9.99992 2.5C7.69873 2.5 5.83325 4.36548 5.83325 6.66667C5.83325 8.96785 7.69873 10.8333 9.99992 10.8333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.6666 17.4987C16.6666 15.7306 15.9642 14.0349 14.714 12.7847C13.4637 11.5344 11.768 10.832 9.99992 10.832C8.23181 10.832 6.53612 11.5344 5.28587 12.7847C4.03563 14.0349 3.33325 15.7306 3.33325 17.4987" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function VehicleIcon({ color = "currentColor", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M15.8334 14.1654H17.5001C18.0001 14.1654 18.3334 13.832 18.3334 13.332V10.832C18.3334 10.082 17.7501 9.41536 17.0834 9.2487C15.5834 8.83203 13.3334 8.33203 13.3334 8.33203C13.3334 8.33203 12.2501 7.16536 11.5001 6.41536C11.0834 6.08203 10.5834 5.83203 10.0001 5.83203H4.16675C3.66675 5.83203 3.25008 6.16536 3.00008 6.58203L1.83341 8.9987C1.72306 9.32055 1.66675 9.65845 1.66675 9.9987V13.332C1.66675 13.832 2.00008 14.1654 2.50008 14.1654H4.16675" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83335 15.8333C6.75383 15.8333 7.50002 15.0871 7.50002 14.1667C7.50002 13.2462 6.75383 12.5 5.83335 12.5C4.91288 12.5 4.16669 13.2462 4.16669 14.1667C4.16669 15.0871 4.91288 15.8333 5.83335 15.8333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 14.168H12.5" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.1667 15.8333C15.0871 15.8333 15.8333 15.0871 15.8333 14.1667C15.8333 13.2462 15.0871 12.5 14.1667 12.5C13.2462 12.5 12.5 13.2462 12.5 14.1667C12.5 15.0871 13.2462 15.8333 14.1667 15.8333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2.5" width="12" height="10" rx="2" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M1 6.5h12" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M4 1v3M10 1v3" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FaceIcon({ color = "#94a3b8" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.2" />
      <circle cx="5" cy="6" r="0.8" fill={color} />
      <circle cx="9" cy="6" r="0.8" fill={color} />
      <path d="M5 9.5c.5.7 3.5.7 4 0" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function BodyIcon({ color = "#94a3b8" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="3" r="1.8" stroke={color} strokeWidth="1.2" />
      <path d="M4 7h6M7 5v5M5 13l2-3 2 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 5.33336L12.6667 6.66669L11.6667 4.20003C11.5724 3.94758 11.4038 3.72964 11.1831 3.57493C10.9625 3.42022 10.7001 3.33599 10.4307 3.33336H5.6C5.32834 3.32712 5.06125 3.40403 4.83451 3.5538C4.60778 3.70357 4.43221 3.91904 4.33133 4.17136L3.33333 6.66669L2 5.33336" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6665 9.33325H4.67317" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.3335 9.33325H11.3402" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6667 6.66675H3.33333C2.59695 6.66675 2 7.2637 2 8.00008V10.6667C2 11.4031 2.59695 12.0001 3.33333 12.0001H12.6667C13.403 12.0001 14 11.4031 14 10.6667V8.00008C14 7.2637 13.403 6.66675 12.6667 6.66675Z" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.3335 12V13.3333" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6665 12V13.3333" stroke="#94a3b8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <line x1="8" y1="8" x2="8" y2="24" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="3" fill="#cbd5e1" />
      <circle cx="8" cy="16" r="3" fill="#e2e8f0" />
      <circle cx="8" cy="24" r="3" fill="#f1f5f9" />
      <line x1="14" y1="8" x2="26" y2="8" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="16" x2="24" y2="16" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="24" x2="22" y2="24" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
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

function ClockIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="#94a3b8" strokeWidth="1.2" />
      <path d="M6 3.5V6L7.8 7.2" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 3H6a3 3 0 0 0-3 3v3M15 3h3a3 3 0 0 1 3 3v3M9 21H6a3 3 0 0 1-3-3v-3M15 21h3a3 3 0 0 0 3-3v-3" stroke="#0e162a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="#0e162a" strokeWidth="1.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 4L14 14M14 4L4 14" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2L4.7 8.4L9.5 3.6" stroke="#5a3dfb" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIconSm({ color = "#475469" }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 11S10 7.5 10 4.8A4 4 0 0 0 2 4.8C2 7.5 6 11 6 11Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="6" cy="4.8" r="1.4" stroke={color} strokeWidth="1.1" />
    </svg>
  );
}

/* ── DateRangePicker ──────────────────────────────────────── */
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_HEADS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"start"|"end">("start");
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(5); // 0-indexed
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector("[data-active='true']");
      el?.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const toDateStr = (day: number) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

  const formatDisplay = (d: string | null) => {
    if (!d) return null;
    const [y, m, day] = d.split("-");
    return `${MONTHS_SHORT[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
  };

  const handleDayClick = (day: number) => {
    const ds = toDateStr(day);
    if (step === "start") {
      onChange({ start: ds, end: null });
      setStep("end");
    } else {
      if (value.start && ds < value.start) onChange({ start: ds, end: value.start });
      else onChange({ start: value.start, end: ds });
      setStep("start");
      setOpen(false);
    }
  };

  const dayState = (day: number): "start"|"end"|"range"|"none" => {
    const d = toDateStr(day);
    if (d === value.start) return "start";
    if (d === value.end) return "end";
    if (value.start && value.end && d > value.start && d < value.end) return "range";
    return "none";
  };

  const monthList: { year: number; month: number }[] = [];
  for (let y = 2023; y <= 2027; y++) for (let m = 0; m < 12; m++) monthList.push({ year: y, month: m });

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1); } else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y=>y+1); } else setViewMonth(m=>m+1); };

  const sd = formatDisplay(value.start);
  const ed = formatDisplay(value.end);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger button */}
      <div
        onClick={() => { setOpen(o=>!o); setStep("start"); }}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          border: `1px solid ${open ? "#c7d2fe" : "#E2E8F0"}`,
          borderRadius: "999px", padding: "0 20px", height: "36px",
          backgroundColor: "white", cursor: "pointer", userSelect: "none",
        }}
      >
        <CalendarIcon />
        <span style={{ fontSize: "12px", fontWeight: 600, color: sd ? "#1d293b" : "#64748a", whiteSpace: "nowrap" }}>
          {sd || "Start date"}
        </span>
        <span style={{ color: "#cbd5e1", fontSize: "12px" }}>-</span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: ed ? "#1d293b" : "#64748a", whiteSpace: "nowrap" }}>
          {ed || "End date"}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "42px", left: 0, zIndex: 2000,
          backgroundColor: "white", border: "1px solid #E8EEF2", borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", overflow: "hidden", width: "560px",
        }}>
          {/* Left: month list */}
          <div ref={listRef} style={{
            width: "148px", borderRight: "1px solid #E8EEF2",
            overflowY: "auto", maxHeight: "360px", flexShrink: 0,
            paddingTop: "4px", paddingBottom: "4px",
          }}>
            {monthList.map(({ year, month }) => {
              const active = year === viewYear && month === viewMonth;
              return (
                <div
                  key={`${year}-${month}`}
                  data-active={active ? "true" : undefined}
                  onClick={() => { setViewYear(year); setViewMonth(month); }}
                  style={{
                    padding: "9px 16px", fontSize: "13px",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#5a3dfb" : "#17191A",
                    backgroundColor: active ? "#F0F0FF" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  {MONTHS_SHORT[month]} {year}
                </div>
              );
            })}
          </div>

          {/* Right: calendar */}
          <div style={{ flex: 1, padding: "16px 20px" }}>
            {/* Step pills */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              {(["start","end"] as const).map(s => (
                <span key={s} style={{
                  fontSize: "11px", padding: "2px 10px", borderRadius: "999px", fontWeight: 600,
                  backgroundColor: step === s ? "#eef2ff" : "#f1f5f9",
                  color: step === s ? "#5a3dfb" : "#94a3b8",
                  border: `1px solid ${step === s ? "#c7d2fe" : "#e2e8f0"}`,
                }}>
                  {s === "start" ? `Start${sd ? " · "+sd : " · pick"}` : `End${ed ? " · "+ed : " · pick"}`}
                </span>
              ))}
            </div>

            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#17191A", padding: "2px 6px", lineHeight: 1 }}>‹</button>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#17191A" }}>{MONTHS_FULL[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#17191A", padding: "2px 6px", lineHeight: 1 }}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "2px" }}>
              {DAY_HEADS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#94a3b8", padding: "3px 0" }}>{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
              {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const ds = dayState(day);
                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    style={{
                      height: "34px", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", fontWeight: ds === "start" || ds === "end" ? 700 : 400,
                      cursor: "pointer", borderRadius: ds === "start" || ds === "end" ? "50%" : "4px",
                      color: ds === "start" || ds === "end" ? "white" : ds === "range" ? "#5a3dfb" : "#17191A",
                      backgroundColor: ds === "start" || ds === "end" ? "#5a3dfb" : ds === "range" ? "#F0F0FF" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Clear */}
            {(value.start || value.end) && (
              <div style={{ marginTop: "10px", textAlign: "right" }}>
                <button
                  onClick={() => { onChange({ start: null, end: null }); setStep("start"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────── */
export default function RedmapPage({ initialSearchName, onInitialSearchConsumed }: { initialSearchName?: string | null; onInitialSearchConsumed?: () => void } = {}) {
  const [mode, setMode] = useState<Mode>("person");
  const [similarity, setSimilarity] = useState<SimilarityLimit>(30);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [licensePlate, setLicensePlate] = useState("");
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [bodyImage, setBodyImage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeHit, setActiveHit] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [uploadFor, setUploadFor] = useState<"face" | "body" | null>(null);
  const [hoverUpload, setHoverUpload] = useState<"face" | "body" | null>(null);
  const [traceName, setTraceName] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Tracks the last `initialSearchName` value already consumed, following React's "adjusting
  // state when a prop changes" pattern (state, not a ref, so it's safe to read during render).
  // Starts at `undefined` — a sentinel no real name/`null` can equal — so a deep-link name
  // present on the very FIRST mount (RedmapPage isn't kept mounted across tab switches, so this
  // is the common case, not an edge case) is still detected as "new" instead of being silently
  // treated as already-consumed because it happened to match the initial state.
  const [consumedSearchName, setConsumedSearchName] = useState<string | null | undefined>(undefined);

  // Deep-link from Dashboard's Tracking route popup ("View Full Trace on RedMap") — jump
  // straight to the completed-search view instead of requiring the user to fill the form.
  // Search results are the same mock set either way; this just labels whose trace it is.
  if (initialSearchName != null && initialSearchName !== consumedSearchName) {
    setConsumedSearchName(initialSearchName);
    setMode("person");
    setHasSearched(true);
    setActiveHit(MOCK_RESULTS.length - 1);
    setActiveNode(MOCK_RESULTS.length - 1);
    setTraceName(initialSearchName);
  }

  // Tell the parent its deep-link hint has been consumed — a real side effect (notifying an
  // external callback), so it belongs in an effect rather than the render-phase block above.
  useEffect(() => {
    if (initialSearchName) onInitialSearchConsumed?.();
  }, [initialSearchName, onInitialSearchConsumed]);

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (uploadFor === "face") setFaceImage(url);
    else if (uploadFor === "body") setBodyImage(url);
    setUploadFor(null);
  };

  const handleSearch = () => {
    setHasSearched(true);
    // The map/right panel show the combined tracking route for ALL search results as soon as a
    // search runs — not just after clicking one. Pre-select the most recent hit so it's highlighted
    // by default; clicking any result or map marker afterwards just moves which node is highlighted.
    setActiveHit(MOCK_RESULTS.length - 1);
    setActiveNode(MOCK_RESULTS.length - 1);
  };

  const handleReset = () => {
    setMode("person");
    setSimilarity(30);
    setDateRange({ start: null, end: null });
    setLicensePlate("");
    setFaceImage(null);
    setBodyImage(null);
    setHasSearched(false);
    setActiveHit(null);
    setActiveNode(null);
    setTraceName(null);
  };

  const handleHitClick = (index: number) => {
    setActiveHit(index);
    setActiveNode(index);
  };

  const handleNodeClick = (index: number) => {
    if (activeHit === null) return;
    setActiveNode(index);
  };

  const handleMarkerClick = (index: number) => {
    if (!hasSearched) return;
    setActiveHit(index);
    setActiveNode(index);
  };

  // The tracking route (map line + right panel timeline) reflects the whole set of search
  // results, so it should appear as soon as a search has run — not only once a specific
  // result is clicked.
  const trackingActive = hasSearched;

  const inputBase: React.CSSProperties = {
    background: "none", border: "none", outline: "none",
    fontSize: "13px", fontWeight: 500, color: "#1d293b",
    fontFamily: "'SUIT', sans-serif",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>

      <input ref={uploadInputRef} type="file" accept="image/*" onChange={handleUploadFile} style={{ display: "none" }} />

      {/* ── Image upload popup ── */}
      {uploadFor && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2000,
          display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "24px", pointerEvents: "none",
        }}>
          <div style={{
            pointerEvents: "auto", width: "730px", height: "303px", boxSizing: "border-box", backgroundColor: "white",
            border: "1px solid #e2e8f0", borderRadius: "8px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            padding: "12px", display: "flex", flexDirection: "column", gap: "10px",
          }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setUploadFor(null)} style={{
                width: "37px", height: "37px", borderRadius: "8px", backgroundColor: "#f5f6f8",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CloseIcon />
              </button>
            </div>
            <div style={{
              flex: 1, borderRadius: "12px", border: "1px dashed #cbd5e1",
              backgroundColor: "#f8fafc", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "12px", padding: "20px 24px",
            }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "24px", backgroundColor: "#f1f5f9",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FocusIcon />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#5a3dfb" }}>Drag and drop an image here</span>
                <span style={{ fontSize: "11px", fontWeight: 500, color: "#475469" }}>
                  File types supported: JPG, PNG, GIF, TIFF, HEIC, WebP. Max size 50MB
                </span>
              </div>
              <button
                onClick={() => uploadInputRef.current?.click()}
                style={{
                  padding: "10px 16px", borderRadius: "24px", border: "none", cursor: "pointer",
                  backgroundColor: "#0e162a", color: "white", fontSize: "13px", fontWeight: 700,
                  boxShadow: "0 4px 4px rgba(29,41,59,0.1)",
                }}
              >
                Choose Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{
        backgroundColor: "white", borderBottom: BORDER,
        padding: "0 24px", height: "52px",
        display: "flex", alignItems: "center", gap: "20px", flexShrink: 0,
      }}>

        {/* Mode toggle */}
        <div style={{
          display: "flex", alignItems: "center",
          backgroundColor: "#F1F5F9", borderRadius: "999px",
          padding: "2px", gap: "12px", height: "36px", boxSizing: "border-box",
        }}>
          {(["person", "car"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  width: "160px", height: "32px", padding: "0 28px",
                  borderRadius: "999px", border: "none",
                  cursor: "pointer",
                  backgroundColor: active ? "white" : "transparent",
                  color: active ? "#5a3dfb" : "#64748a",
                  fontWeight: active ? 800 : 600, fontSize: "13px", letterSpacing: "-0.26px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {m === "person"
                  ? <PersonIcon color={active ? "#5a3dfb" : "#94a3b8"} size={18} />
                  : <VehicleIcon color={active ? "#5a3dfb" : "#94a3b8"} size={18} />}
                {m === "person" ? "PERSON" : "VEHICLE"}
              </button>
            );
          })}
        </div>

        {mode === "car" ? (
          /* ── VEHICLE mode fields ── */
          <>
            {/* License plate */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#64748a", whiteSpace: "nowrap" }}>License plate</span>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                border: BORDER, borderRadius: "999px",
                padding: "0 10px 0 12px", height: "36px", backgroundColor: "white",
                minWidth: "160px",
              }}>
                <PlateIcon />
                <input
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="SGA 1234 X"
                  style={{ ...inputBase, width: "100px" }}
                />
                {licensePlate && (
                  <button
                    onClick={() => setLicensePlate("")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "14px", padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0" }} />

            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </>
        ) : (
          /* ── PERSON mode fields ── */
          <>
            <DateRangePicker value={dateRange} onChange={setDateRange} />

            <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0" }} />

            {/* Search by image chips */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {([
                { key: "face" as const, label: "Face", image: faceImage },
                { key: "body" as const, label: "Body", image: bodyImage },
              ]).map(({ key, label, image }) => {
                const active = !!image;
                const uploading = uploadFor === key;
                const highlighted = active || uploading;
                const iconColor = highlighted ? "#324055" : "#94a3b8";
                return (
                  <button
                    key={key}
                    onClick={() => setUploadFor(key)}
                    style={{
                      height: "36px", padding: "0 12px", borderRadius: "999px",
                      border: `1px dashed ${highlighted ? "#5a3dfb" : "#94a3b8"}`,
                      backgroundColor: highlighted ? "#f0f0ff" : "white",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 700, color: "#324055", whiteSpace: "nowrap" }}>
                      {key === "face" ? <FaceIcon color={iconColor} /> : <BodyIcon color={iconColor} />} {label}
                    </span>
                    {active ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "#5a3dfb", whiteSpace: "nowrap" }}>
                        <CheckIconSm /> Loaded
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", whiteSpace: "nowrap" }}>
                        Search by image
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0" }} />

            {/* Similarity */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#475469", whiteSpace: "nowrap" }}>Similarity</span>
              <div style={{ display: "flex", gap: "2px", backgroundColor: "#f1f5f9", borderRadius: "999px", padding: "2px", height: "36px", boxSizing: "border-box" }}>
                {([30, 50, 70, 90] as SimilarityLimit[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSimilarity(s)}
                    style={{
                      padding: "8px 12px", borderRadius: "999px",
                      border: "none", cursor: "pointer",
                      backgroundColor: similarity === s ? "white" : "transparent",
                      color: similarity === s ? "#5a3dfb" : "#94a3b8",
                      fontWeight: similarity === s ? 700 : 600,
                      fontSize: "12px",
                      display: "flex", alignItems: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: "12px", flexShrink: 0 }}>
          <button
            onClick={handleReset}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              height: "36px", padding: "0 20px", borderRadius: "8px",
              border: "none", backgroundColor: "transparent", cursor: "pointer",
              color: "#475469", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap",
              fontFamily: "'SUIT', sans-serif", flexShrink: 0,
            }}
          >
            <ResetIconSm /> Reset
          </button>
          <button
            onClick={handleSearch}
            style={{
              height: "36px", padding: "0 20px", borderRadius: "8px",
              border: "none", cursor: "pointer",
              backgroundColor: "#0e162a", color: "white",
              fontWeight: 800, fontSize: "14px", letterSpacing: "-0.28px", whiteSpace: "nowrap",
              fontFamily: "'SUIT', sans-serif", flexShrink: 0,
            }}
          >
            {mode === "car" ? "Search Vehicle" : "Search persons"}
          </button>
        </div>
      </div>

      {/* ── Main 3-column area (always visible) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT: Search Targets + Search Results — only mounts once a search has actually run;
            the landing state is just the search bar + full-width map, no side panels. */}
        {hasSearched && (
        <div style={{
          width: "320px", backgroundColor: "white", borderRight: BORDER,
          display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
        }}>

          <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── Search Targets (read-only preview of the uploaded face/body) ── */}
            {mode === "person" && (faceImage || bodyImage) && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a", letterSpacing: "-0.32px" }}>Search Targets</h3>
                  <div style={{ display: "flex", gap: "24px" }}>
                    {([
                      { key: "face" as const, image: faceImage, height: "100px" },
                      { key: "body" as const, image: bodyImage, height: "140px" },
                    ]).map(({ key, image, height }) => (
                      <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
                        <span style={{
                          fontSize: "11px", fontWeight: 700, color: "#5145e9",
                          backgroundColor: "#eef0ff", borderRadius: "6px",
                          padding: "4px 8px", alignSelf: "flex-start",
                        }}>
                          {key === "face" ? "Face" : "Body"}
                        </span>
                        <div
                          onClick={() => setUploadFor(key)}
                          onMouseEnter={() => setHoverUpload(key)}
                          onMouseLeave={() => setHoverUpload(null)}
                          style={{
                            height, borderRadius: "12px", overflow: "hidden", position: "relative", cursor: "pointer",
                            border: hoverUpload === key ? "1px dashed #5a3dfb" : "1px dashed #ccd5e1",
                            backgroundColor: image ? "white" : "#f1f5f9",
                          }}
                        >
                          {image && (
                            <img src={image} style={{
                              width: "100%", height: "100%", objectFit: "cover", display: "block",
                              opacity: hoverUpload === key ? 0.5 : 1, transition: "opacity 0.15s",
                            }} alt="" />
                          )}
                          {hoverUpload === key && (
                            <div style={{
                              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              backgroundColor: image ? "rgba(14,22,42,0.35)" : "transparent",
                            }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: image ? "white" : "#5a3dfb" }}>
                                {image ? "Click to change" : "Click to upload"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ height: "1px", backgroundColor: "#e2e8f0" }} />
              </>
            )}

            {/* ── Search Results header ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a", letterSpacing: "-0.32px" }}>Search Results</h3>
              <span style={{
                width: "18px", height: "18px", borderRadius: "999px", backgroundColor: "#f1f5f9",
                color: "#324055", fontSize: "10px", fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {hasSearched ? MOCK_RESULTS.length : 0}
              </span>
              {traceName && (
                <span style={{
                  fontSize: "11px", fontWeight: 700, color: "#5a3dfb", backgroundColor: "#f0f0ff",
                  borderRadius: "999px", padding: "3px 10px", whiteSpace: "nowrap",
                }}>
                  Tracing: {traceName}
                </span>
              )}
            </div>

            {/* ── Search Results grid ── */}
            {!hasSearched ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px 0" }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="#e2e8f0" strokeWidth="2" />
                  <path d="M18 18L25 25" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.7, color: "#94a3b8" }}>
                  {mode === "person"
                    ? <>Upload a face or body image<br />above and click <strong style={{ color: "#334155" }}>Search persons</strong></>
                    : <>Enter a license plate and click<br /><strong style={{ color: "#334155" }}>Search Vehicle</strong></>
                  }
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {MOCK_RESULTS.map((hit, index) => (
                  <div
                    key={hit.id}
                    onClick={() => handleHitClick(index)}
                    style={{
                      cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px",
                      padding: "4px", borderRadius: "10px",
                      border: activeHit === index ? "2px solid #5a3dfb" : "2px solid transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", gap: "4px" }}>
                      <div style={{ position: "relative", width: "63px", height: "62px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                        <img src={hit.faceUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                        <span style={{ position: "absolute", top: "4px", left: "4px", backgroundColor: "rgba(15,23,42,0.6)", color: "white", fontSize: "10px", fontWeight: 600, padding: "2px 4px", borderRadius: "3px" }}>Face</span>
                      </div>
                      <div style={{ position: "relative", width: "63px", height: "62px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                        <img src={hit.bodyUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                        <span style={{ position: "absolute", top: "4px", left: "4px", backgroundColor: "rgba(90,61,251,0.4)", color: "white", fontSize: "10px", fontWeight: 600, padding: "2px 4px", borderRadius: "3px" }}>Body</span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: "#f1f5f9", borderRadius: "6px", padding: "4px 6px" }}>
                      <span style={{ fontSize: "10px", color: "#324055" }}>
                        Face <span style={{ fontWeight: 800, color: "#5a3dfb" }}>{hit.score}</span> · Body <span style={{ fontWeight: 800, color: "#5a3dfb" }}>{hit.bodyScore}</span>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <PinIconSm />
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "#475469" }}>{hit.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasSearched && (
            <div style={{ padding: "10px 20px", borderTop: BORDER, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#1e293b" }}>1–{MOCK_RESULTS.length} of {MOCK_RESULTS.length}</span>
            </div>
          )}
        </div>
        )}

        {/* CENTER: Leaflet Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <RedmapMap
            hits={hasSearched ? MOCK_RESULTS.map((h) => ({
              lat: h.lat, lng: h.lng,
              mapLabel: h.mapLabel,
              time: h.time.slice(0, 5),
              isAlert: h.isUnregistered,
            })) : []}
            trackingActive={trackingActive}
            showStatus={false}
            activeNode={activeNode}
            onMarkerClick={handleMarkerClick}
          />
        </div>

        {/* RIGHT: Route History Timeline — same landing-state rule as the left panel. */}
        {hasSearched && (
        <div style={{
          width: "320px", backgroundColor: "white", borderLeft: BORDER,
          display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
        }}>
          <div style={{
            padding: "16px", borderBottom: BORDER,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0e162a", letterSpacing: "-0.32px" }}>
              Multi-Track Route History
            </h3>
            <button style={{
              display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none",
              cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#64748a",
            }}>
              Newest first
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3.5 4L6 1.5L8.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 10.5V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
            {!trackingActive ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
                <TimelineIcon />
                <p style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.7, color: "#94a3b8" }}>
                  Click a hit result to view<br />
                  <strong style={{ color: "#334155" }}>movement tracking history</strong>
                </p>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "22px", top: "22px", bottom: "22px", width: "2px", backgroundColor: "#e2e8f0" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {(() => {
                    const nodes = [
                      { key: "origin", location: TRACKING_ORIGIN.label, date: TRACKING_ORIGIN.date, time: TRACKING_ORIGIN.time, faceUrl: TRACKING_ORIGIN.faceUrl, elapsed: undefined as string | undefined, elapsedAlert: false },
                      ...MOCK_RESULTS.map((hit) => ({ key: hit.id, location: hit.location, date: hit.date, time: hit.time, faceUrl: hit.faceUrl, elapsed: hit.elapsed, elapsedAlert: hit.elapsedAlert })),
                    ];
                    return [...nodes].reverse().map((node, revIndex) => {
                      const index = nodes.length - 1 - revIndex; // hit index: -1 = origin, 0..N-1 = MOCK_RESULTS
                      const num = nodes.length - revIndex;
                      const isLatest = revIndex === 0;
                      const isActive = activeNode === index - 1;
                      return (
                        <div
                          key={node.key}
                          onClick={() => { if (index > 0) handleNodeClick(index - 1); }}
                          style={{ display: "flex", alignItems: "flex-start", gap: "12px", position: "relative", zIndex: 1, cursor: index > 0 ? "pointer" : "default" }}
                        >
                          <div style={{
                            width: "44px", height: "44px", borderRadius: "999px", flexShrink: 0,
                            border: isActive ? "2px solid #5a3dfb" : "1px solid #ccd5e1",
                            backgroundColor: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                          }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: isActive ? "#5a3dfb" : "#94a3b8" }}>
                              {String(num).padStart(2, "0")}
                            </span>
                          </div>
                          <div style={{
                            flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0,
                            border: isActive ? "1px solid #c7d2fe" : "1px solid transparent",
                            borderRadius: "12px", padding: isActive ? "12px" : "0",
                            boxShadow: isActive ? "2px 2px 6px rgba(0,0,0,0.06)" : "none",
                            transition: "all 0.2s",
                          }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <div style={{ width: "64px", height: "48px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                                <img src={node.faceUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#0e162a", margin: 0, marginBottom: "4px" }}>{node.location}</p>
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <ClockIconSm />
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748a", fontFamily: "monospace" }}>{node.date}</span>
                                </div>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748a", fontFamily: "monospace", paddingLeft: "16px" }}>{node.time}</span>
                              </div>
                            </div>
                            {node.elapsed && (
                              <div style={{
                                backgroundColor: node.elapsedAlert ? "#fff1f2" : "#f0f0ff", borderRadius: "8px",
                                padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
                              }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: node.elapsedAlert ? "#f43f5e" : "#5a3dfb" }}>
                                  {node.elapsed}
                                </span>
                                {isLatest && <span style={{ fontSize: "10px", fontWeight: 800, color: "#5a3dfb" }}>LAST SEEN</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
