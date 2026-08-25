"use client";

import { useState, useRef, useEffect } from "react";
import RedmapMap, { TRACKING_ORIGIN } from "./RedmapMap";
import type { RedmapMode as Mode, SimilarityLimit, HitResult, DateRange } from "@/types/redmap";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "./Toast";

const BORDER = "1px solid var(--gray-200)";

// Unlike BestFramePage's camera list (now sourced from the shared VIP_SIMULATION_CAMERAS pool —
// see vcaStore.ts), these hits are intentionally hand-authored narrative content (specific face/
// body photos, elapsed-time framing, isUnregistered flag) rather than a checkable camera list, so
// there's no real payoff in re-keying them onto shared camera ids the way BestFrame's bulk filler
// was. The `camera`/`location`/`mapLabel` strings here don't correspond to any real camera id in
// CAMERAS/VIP_SIMULATION_CAMERAS today — that's fine as long as nothing cross-navigates from a
// Redmap hit to another page by name (nothing currently does). If a "View Live"/"Open in Best
// Frame" action ever gets added here, it'll hit the same silent-match-failure bug the Dashboard's
// device popup had (see BestFramePage.tsx's focusLocation handling) unless these are re-keyed
// onto real camera ids first.
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
    personId: "p1", personLabel: "Match 1",
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
    personId: "p1", personLabel: "Match 1",
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
    personId: "p1", personLabel: "Match 1",
  },
];

// A real search doesn't always come back with a full 3-camera trail — sometimes the person only
// shows up once or twice, sometimes not at all. These extra sets let a search "miss" or come back
// thin instead of always returning the same rich trace, which was the whole trace feature reading
// as fake. `RESULT_SETS` is what searches actually pick from; `MOCK_RESULTS` stays as its own
// export (unchanged) since `lib/api/redmap.ts` already imports it as the future-backend stub's
// default payload.
const RESULT_SET_MODERATE: HitResult[] = [
  {
    id: "hit-m1",
    camera: "Jurong Gateway JR1",
    location: "Jurong Gateway Mall",
    date: "2026-06-15",
    time: "14:02:20",
    score: "81.2%",
    bodyScore: "73.5%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Jurong",
    lat: 1.3329, lng: 103.7436,
    elapsed: "1h 40m Elapsed", elapsedAlert: true,
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-m2",
    camera: "Clarke Quay CQ1",
    location: "Clarke Quay Riverside",
    date: "2026-06-15",
    time: "15:42:55",
    score: "79.8%",
    bodyScore: "71.0%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Clarke Quay",
    lat: 1.2884, lng: 103.8460,
    personId: "p1", personLabel: "Match 1",
  },
];

const RESULT_SET_SPARSE: HitResult[] = [
  {
    id: "hit-s1",
    camera: "Tampines Hub TH1",
    location: "Tampines Concourse",
    date: "2026-06-16",
    time: "09:12:03",
    score: "76.4%",
    bodyScore: "68.0%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Tampines",
    lat: 1.3530, lng: 103.9440,
    personId: "p1", personLabel: "Match 1",
  },
];

// A low-similarity search can genuinely surface more than one distinct person, not just several
// sightings of the same one — this set demonstrates that so the person-filter chips (see
// distinctPersons below) have something real to group/color-code. Two people, two sightings each.
const RESULT_SET_LOOKALIKES: HitResult[] = [
  {
    id: "hit-l1",
    camera: "Bugis MRT BM1",
    location: "Bugis MRT Station",
    date: "2026-06-17",
    time: "08:20:11",
    score: "58.3%",
    bodyScore: "52.0%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Bugis",
    lat: 1.3006, lng: 103.8559,
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-l2",
    camera: "City Hall CH2",
    location: "City Hall Link",
    date: "2026-06-17",
    time: "09:05:47",
    score: "55.1%",
    bodyScore: "49.8%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "City Hall",
    lat: 1.2930, lng: 103.8520,
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-l3",
    camera: "Somerset SS1",
    location: "Somerset Skywalk",
    date: "2026-06-17",
    time: "08:45:02",
    score: "56.7%",
    bodyScore: "50.2%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Somerset",
    lat: 1.3006, lng: 103.8390,
    personId: "p2", personLabel: "Match 2",
  },
  {
    id: "hit-l4",
    camera: "Dhoby Ghaut DG3",
    location: "Dhoby Ghaut Xchange",
    date: "2026-06-17",
    time: "09:30:18",
    score: "54.4%",
    bodyScore: "48.1%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Dhoby Ghaut",
    lat: 1.2988, lng: 103.8455,
    personId: "p2", personLabel: "Match 2",
  },
];

const RESULT_SET_EMPTY: HitResult[] = [];

const RESULT_SETS: HitResult[][] = [MOCK_RESULTS, RESULT_SET_MODERATE, RESULT_SET_SPARSE, RESULT_SET_EMPTY, RESULT_SET_LOOKALIKES];

// Deterministic (not random) so re-running the exact same search — same uploaded file, same
// license plate — always lands on the same result set instead of flickering between runs.
// Different inputs will usually (not always — it's a small hash space) land on a different one.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Colors assigned to distinct people in a result set, in first-appearance order — shared by the
// person-filter chips, each result card's person tag, and that person's trail/markers on the map,
// so the same color always means the same person across all three.
const PERSON_COLORS = ["#5a3dfb", "#38bdf8", "#f43f5e", "#16a34a", "#f59e0b"];

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
      <rect x="1" y="2.5" width="12" height="10" rx="2" stroke="var(--gray-400)" strokeWidth="1.2" />
      <path d="M1 6.5h12" stroke="var(--gray-400)" strokeWidth="1.2" />
      <path d="M4 1v3M10 1v3" stroke="var(--gray-400)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FaceIcon({ color = "var(--gray-400)" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.2" />
      <circle cx="5" cy="6" r="0.8" fill={color} />
      <circle cx="9" cy="6" r="0.8" fill={color} />
      <path d="M5 9.5c.5.7 3.5.7 4 0" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function BodyIcon({ color = "var(--gray-400)" }: { color?: string }) {
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
      <path d="M14 5.33336L12.6667 6.66669L11.6667 4.20003C11.5724 3.94758 11.4038 3.72964 11.1831 3.57493C10.9625 3.42022 10.7001 3.33599 10.4307 3.33336H5.6C5.32834 3.32712 5.06125 3.40403 4.83451 3.5538C4.60778 3.70357 4.43221 3.91904 4.33133 4.17136L3.33333 6.66669L2 5.33336" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6665 9.33325H4.67317" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.3335 9.33325H11.3402" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6667 6.66675H3.33333C2.59695 6.66675 2 7.2637 2 8.00008V10.6667C2 11.4031 2.59695 12.0001 3.33333 12.0001H12.6667C13.403 12.0001 14 11.4031 14 10.6667V8.00008C14 7.2637 13.403 6.66675 12.6667 6.66675Z" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.3335 12V13.3333" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6665 12V13.3333" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
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
      <circle cx="6" cy="6" r="5" stroke="var(--gray-400)" strokeWidth="1.2" />
      <path d="M6 3.5V6L7.8 7.2" stroke="var(--gray-400)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 3H6a3 3 0 0 0-3 3v3M15 3h3a3 3 0 0 1 3 3v3M9 21H6a3 3 0 0 1-3-3v-3M15 21h3a3 3 0 0 0 3-3v-3" stroke="var(--gray-900)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="var(--gray-900)" strokeWidth="1.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 4L14 14M14 4L4 14" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Deliberately bolder/redder than CloseIcon — this removes a sighting from the trace, not just
// dismisses a panel, so it needs to read as "this one's wrong" at a glance, not as generic chrome.
function RemoveFromTraceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="var(--danger-400)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2L4.7 8.4L9.5 3.6" stroke="var(--primary-400)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIconSm({ color = "var(--gray-600)" }: { color?: string }) {
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
  useEscapeKey(() => setOpen(false), open);

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
          border: `1px solid ${open ? "var(--primary-200)" : "var(--gray-200)"}`,
          borderRadius: "999px", padding: "0 20px", height: "36px",
          backgroundColor: "white", cursor: "pointer", userSelect: "none",
        }}
      >
        <CalendarIcon />
        <span style={{ fontSize: "12px", fontWeight: 600, color: sd ? "var(--gray-800)" : "var(--gray-500)", whiteSpace: "nowrap" }}>
          {sd || "Start date"}
        </span>
        <span style={{ color: "var(--gray-300)", fontSize: "12px" }}>-</span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: ed ? "var(--gray-800)" : "var(--gray-500)", whiteSpace: "nowrap" }}>
          {ed || "End date"}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "42px", left: 0, zIndex: 2000,
          backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(14, 22, 42,0.12)", display: "flex", overflow: "hidden", width: "560px",
        }}>
          {/* Left: month list */}
          <div ref={listRef} style={{
            width: "148px", borderRight: "1px solid var(--gray-200)",
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
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                  style={{
                    padding: "9px 16px", fontSize: "13px",
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--primary-400)" : "var(--gray-900)",
                    backgroundColor: active ? "var(--primary-100)" : "transparent",
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
                  fontSize: "12px", padding: "2px 10px", borderRadius: "999px", fontWeight: 600,
                  backgroundColor: step === s ? "var(--primary-100)" : "var(--gray-100)",
                  color: step === s ? "var(--primary-400)" : "var(--gray-400)",
                  border: `1px solid ${step === s ? "var(--primary-200)" : "var(--gray-200)"}`,
                }}>
                  {s === "start" ? `Start${sd ? " · "+sd : " · pick"}` : `End${ed ? " · "+ed : " · pick"}`}
                </span>
              ))}
            </div>

            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <button onClick={prevMonth} aria-label="Previous month" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--gray-900)", padding: "2px 6px", lineHeight: 1 }}>‹</button>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{MONTHS_FULL[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} aria-label="Next month" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--gray-900)", padding: "2px 6px", lineHeight: 1 }}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "2px" }}>
              {DAY_HEADS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", padding: "3px 0" }}>{d}</div>
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
                    onMouseEnter={e => { if (ds === "none") e.currentTarget.style.backgroundColor = "var(--gray-100)"; }}
                    onMouseLeave={e => { if (ds === "none") e.currentTarget.style.backgroundColor = "transparent"; }}
                    style={{
                      height: "34px", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", fontWeight: ds === "start" || ds === "end" ? 700 : 400,
                      cursor: "pointer", borderRadius: ds === "start" || ds === "end" ? "50%" : "4px",
                      color: ds === "start" || ds === "end" ? "white" : ds === "range" ? "var(--primary-400)" : "var(--gray-900)",
                      backgroundColor: ds === "start" || ds === "end" ? "var(--primary-400)" : ds === "range" ? "var(--primary-100)" : "transparent",
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
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "var(--gray-400)", fontWeight: 600 }}
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
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>("person");
  const [similarity, setSimilarity] = useState<SimilarityLimit>(70);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [licensePlate, setLicensePlate] = useState("");
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [bodyImage, setBodyImage] = useState<string | null>(null);
  // Identifies the uploaded file's content (name+size) independently of its blob: URL, which is
  // randomly generated per upload and can't be hashed for a reproducible result set — see
  // `handleSearch` below.
  const [faceFileKey, setFaceFileKey] = useState<string | null>(null);
  const [bodyFileKey, setBodyFileKey] = useState<string | null>(null);
  const [results, setResults] = useState<HitResult[]>(MOCK_RESULTS);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeHit, setActiveHit] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [uploadFor, setUploadFor] = useState<"face" | "body" | null>(null);
  const [hoverUpload, setHoverUpload] = useState<"face" | "body" | null>(null);
  const [traceName, setTraceName] = useState<string | null>(null);
  const [timelineNewestFirst, setTimelineNewestFirst] = useState(true);
  // A sighting that's obviously a different person (see the X button on each trace node below)
  // gets pulled out of the route without being deleted from the underlying search results — the
  // left result list still shows it, just dimmed, so excluding is a correction to the trace, not
  // a destructive edit to what was actually found.
  const [excludedHitIds, setExcludedHitIds] = useState<Set<string>>(new Set());
  // Which distinct person(s) the map/route-history panel currently trace — only meaningful (and
  // only shown as chips) when the current results actually contain more than one distinct person.
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Tracks the last `initialSearchName` value already consumed, following React's "adjusting
  // state when a prop changes" pattern (state, not a ref, so it's safe to read during render).
  // Starts at `undefined` — a sentinel no real name/`null` can equal — so a deep-link name
  // present on the very FIRST mount (RedmapPage isn't kept mounted across tab switches, so this
  // is the common case, not an edge case) is still detected as "new" instead of being silently
  // treated as already-consumed because it happened to match the initial state.
  const [consumedSearchName, setConsumedSearchName] = useState<string | null | undefined>(undefined);
  useEscapeKey(() => setUploadFor(null), uploadFor !== null);

  // Deep-link from Dashboard's Tracking route popup ("View Full Trace on RedMap") — jump
  // straight to the completed-search view instead of requiring the user to fill the form.
  // Search results are the same mock set either way; this just labels whose trace it is.
  if (initialSearchName != null && initialSearchName !== consumedSearchName) {
    setConsumedSearchName(initialSearchName);
    setMode("person");
    setResults(MOCK_RESULTS);
    setHasSearched(true);
    setActiveHit(MOCK_RESULTS.length - 1);
    setActiveNode(MOCK_RESULTS.length - 1);
    setSelectedPersonIds(new Set([MOCK_RESULTS[MOCK_RESULTS.length - 1].personId]));
    setTraceName(initialSearchName);
  }

  // Tell the parent its deep-link hint has been consumed — a real side effect (notifying an
  // external callback), so it belongs in an effect rather than the render-phase block above.
  useEffect(() => {
    if (initialSearchName) onInitialSearchConsumed?.();
  }, [initialSearchName, onInitialSearchConsumed]);

  // A body-only search has nothing but build/clothing to go on, which matches far more loosely
  // than a face does — the same 70% the face search treats as solid confidence would let in the
  // kind of lookalike-heavy results RESULT_SET_LOOKALIKES demonstrates. Forcing a higher floor
  // here (and disabling the presets below it) keeps a body-only search from ever reaching that
  // territory, rather than just defaulting there and letting the user slide back down.
  const BODY_ONLY_MIN_SIMILARITY = 75;
  const bodyOnly = mode === "person" && !!bodyFileKey && !faceFileKey;
  // Only a body upload can newly create the body-only state (there's no way to remove a face once
  // set short of Reset, which already puts similarity back at 70) — so the floor only needs
  // enforcing right here, as a direct response to that upload, not as an effect watching for it.
  const bumpSimilarityForBodyOnly = (hasFace: boolean) => {
    if (!hasFace) setSimilarity(s => s < BODY_ONLY_MIN_SIMILARITY ? BODY_ONLY_MIN_SIMILARITY : s);
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const key = `${file.name}_${file.size}`;
    if (uploadFor === "face") { setFaceImage(url); setFaceFileKey(key); }
    else if (uploadFor === "body") { setBodyImage(url); setBodyFileKey(key); bumpSimilarityForBodyOnly(!!faceImage); }
    setUploadFor(null);
  };

  // Backs the "Drag and drop an image here" copy in the upload popup — without this the dropzone
  // was decorative (only the "Choose Image" button actually worked).
  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const key = `${file.name}_${file.size}`;
    if (uploadFor === "face") { setFaceImage(url); setFaceFileKey(key); }
    else if (uploadFor === "body") { setBodyImage(url); setBodyFileKey(key); bumpSimilarityForBodyOnly(!!faceImage); }
    setUploadFor(null);
  };

  const handleSearch = () => {
    // An empty query used to still run — hashing down to whichever RESULT_SET the empty key
    // landed on (often RESULT_SET_EMPTY) — and land on "No matching sightings found," reading as
    // a real search that failed rather than a search that was never actually given anything to
    // look for. Block it before it runs and say so instead.
    const hasQuery = mode === "car" ? licensePlate.trim().length > 0 : !!faceFileKey || !!bodyFileKey;
    if (!hasQuery) {
      showToast({ variant:"warning", title:"Enter a search", desc: mode === "car"
        ? "Enter a license plate to search."
        : "Upload a face or body image to search." });
      return;
    }
    // Which result set comes back depends on what was actually searched for — the same
    // face/body/plate always reproduces the same outcome, but a different upload will usually
    // land on a different (or empty) set instead of always showing the same 3-camera trail
    // regardless of input.
    const searchKey = mode === "car"
      ? `car:${licensePlate.trim().toUpperCase()}`
      : `person:${faceFileKey ?? ""}|${bodyFileKey ?? ""}`;
    const picked = RESULT_SETS[hashStr(searchKey) % RESULT_SETS.length];
    // dateRange was collected in the toolbar but never actually consulted here — picking a range
    // that excludes every mock hit's date still returned the exact same results as picking
    // nothing at all. Both fields are already "YYYY-MM-DD" strings, so this is a plain string
    // comparison, no Date parsing needed.
    const inDateRange = (date: string) =>
      (!dateRange.start || date >= dateRange.start) && (!dateRange.end || date <= dateRange.end);
    // The similarity control used to be decorative — this is what actually keeps a low-confidence
    // match out of the results instead of just labeling it low-confidence. Body-only searches
    // compare against bodyScore (see BODY_ONLY_MIN_SIMILARITY above); everything else compares
    // against the face-anchored score.
    const filtered = (mode === "person"
      ? picked.filter(hit => parseFloat(bodyOnly ? hit.bodyScore : hit.score) >= similarity)
      : picked
    ).filter(hit => inDateRange(hit.date));
    setResults(filtered);
    setExcludedHitIds(new Set());
    setHasSearched(true);
    // The map/right panel show the combined tracking route for ALL search results as soon as a
    // search runs — not just after clicking one. Pre-select the most recent hit so it's highlighted
    // by default; clicking any result or map marker afterwards just moves which node is highlighted.
    setActiveHit(filtered.length ? filtered.length - 1 : null);
    setActiveNode(filtered.length ? filtered.length - 1 : null);
    // If these results span more than one distinct person, default the trace to just the most
    // recent hit's person — an empty selection would leave the map/timeline blank, and selecting
    // everyone by default would recreate the exact overlapping-paths confusion the chips exist
    // to prevent.
    setSelectedPersonIds(filtered.length ? new Set([filtered[filtered.length - 1].personId]) : new Set());
    // A manual search is a fresh, untargeted query — clear any "Tracing: <name>" label left over
    // from a Dashboard deep-link, otherwise these generic results stay mislabeled as tracing that
    // earlier person until Reset is clicked.
    setTraceName(null);
  };

  const handleReset = () => {
    setMode("person");
    setSimilarity(70);
    setDateRange({ start: null, end: null });
    setLicensePlate("");
    setFaceImage(null);
    setBodyImage(null);
    setFaceFileKey(null);
    setBodyFileKey(null);
    setResults(MOCK_RESULTS);
    setHasSearched(false);
    setActiveHit(null);
    setActiveNode(null);
    setSelectedPersonIds(new Set());
    setTraceName(null);
    setExcludedHitIds(new Set());
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
  // result is clicked. A search that came back with no hits has nothing to trace.
  const trackingActive = hasSearched && results.length > 0;

  // Distinct people in the CURRENT results, in first-appearance order. Chips only render when
  // there's more than one — a single person's own sightings don't need disambiguating, and
  // showing a one-chip row every search would just be noise.
  const distinctPersons = Array.from(new Map(results.map((h) => [h.personId, h.personLabel])).entries())
    .map(([personId, personLabel], i) => ({ personId, personLabel, color: PERSON_COLORS[i % PERSON_COLORS.length] }));
  const showPersonChips = distinctPersons.length > 1;
  const personColor = (personId: string) => distinctPersons.find((p) => p.personId === personId)?.color ?? PERSON_COLORS[0];
  const togglePerson = (personId: string) => {
    setSelectedPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId); else next.add(personId);
      return next;
    });
  };

  const inputBase: React.CSSProperties = {
    background: "none", border: "none", outline: "none",
    fontSize: "13px", fontWeight: 600, color: "var(--gray-800)",
    fontFamily: "'SUIT', sans-serif",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>

      <input ref={uploadInputRef} type="file" accept="image/*" onChange={handleUploadFile} style={{ display: "none" }} />

      {/* ── Image upload popup ── */}
      {uploadFor && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setUploadFor(null); }}
          style={{
            position: "absolute", inset: 0, zIndex: 2000, backgroundColor: "rgba(14,22,42,0.15)",
            display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "24px",
          }}>
          <div style={{
            width: "730px", height: "303px", boxSizing: "border-box", backgroundColor: "white",
            border: "1px solid var(--gray-200)", borderRadius: "8px",
            boxShadow: "0 2px 12px rgba(14, 22, 42,0.08)",
            padding: "12px", display: "flex", flexDirection: "column", gap: "10px",
          }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setUploadFor(null)} aria-label="Close" style={{
                width: "37px", height: "37px", borderRadius: "8px", backgroundColor: "var(--gray-50)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CloseIcon />
              </button>
            </div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropFile}
              style={{
                flex: 1, borderRadius: "12px", border: "1px dashed var(--gray-300)",
                backgroundColor: "var(--gray-50)", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "12px", padding: "20px 24px",
              }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "24px", backgroundColor: "var(--gray-100)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FocusIcon />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary-400)" }}>Drag and drop an image here</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>
                  File types supported: JPG, PNG, GIF, TIFF, HEIC, WebP. Max size 50MB
                </span>
              </div>
              <button
                onClick={() => uploadInputRef.current?.click()}
                style={{
                  padding: "10px 16px", borderRadius: "24px", border: "none", cursor: "pointer",
                  backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700,
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
          backgroundColor: "var(--gray-100)", borderRadius: "999px",
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
                  color: active ? "var(--primary-400)" : "var(--gray-500)",
                  fontWeight: active ? 800 : 600, fontSize: "13px", letterSpacing: "-0.26px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  boxShadow: active ? "0 1px 3px rgba(14, 22, 42,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {m === "person"
                  ? <PersonIcon color={active ? "var(--primary-400)" : "var(--gray-400)"} size={18} />
                  : <VehicleIcon color={active ? "var(--primary-400)" : "var(--gray-400)"} size={18} />}
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
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap" }}>License plate</span>
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
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", fontSize: "14px", padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div style={{ width: "1px", height: "24px", backgroundColor: "var(--gray-200)" }} />

            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </>
        ) : (
          /* ── PERSON mode fields ── */
          <>
            <DateRangePicker value={dateRange} onChange={setDateRange} />

            <div style={{ width: "1px", height: "24px", backgroundColor: "var(--gray-200)" }} />

            {/* Search by image chips */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {([
                { key: "face" as const, label: "Face", image: faceImage },
                { key: "body" as const, label: "Full body", image: bodyImage },
              ]).map(({ key, label, image }) => {
                const active = !!image;
                const uploading = uploadFor === key;
                const highlighted = active || uploading;
                const iconColor = highlighted ? "var(--gray-700)" : "var(--gray-400)";
                return (
                  <button
                    key={key}
                    onClick={() => setUploadFor(key)}
                    style={{
                      height: "36px", padding: "0 12px", borderRadius: "999px",
                      border: `1px dashed ${highlighted ? "var(--primary-400)" : "var(--gray-400)"}`,
                      backgroundColor: highlighted ? "var(--primary-100)" : "white",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 700, color: "var(--gray-700)", whiteSpace: "nowrap" }}>
                      {key === "face" ? <FaceIcon color={iconColor} /> : <BodyIcon color={iconColor} />} {label}
                    </span>
                    {active ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--primary-400)", whiteSpace: "nowrap" }}>
                        <CheckIconSm /> Loaded
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
                        Search by image
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ width: "1px", height: "24px", backgroundColor: "var(--gray-200)" }} />

            {/* Similarity — quick presets plus a slider for anything in between, so landing on
                e.g. 65% doesn't require picking the nearest preset and living with it. */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-600)", whiteSpace: "nowrap" }}
                title={bodyOnly ? `Body-only searches start at ${BODY_ONLY_MIN_SIMILARITY}% match — matching by build/clothing alone is too loose to trust below that.` : undefined}
              >Similarity</span>
              <div style={{ display: "flex", gap: "2px", backgroundColor: "var(--gray-100)", borderRadius: "999px", padding: "2px", height: "36px", boxSizing: "border-box" }}>
                {([60, 70, 80, 90] as SimilarityLimit[]).map((s) => {
                  const disabled = bodyOnly && s < BODY_ONLY_MIN_SIMILARITY;
                  return (
                    <button
                      key={s}
                      disabled={disabled}
                      onClick={() => setSimilarity(s)}
                      title={disabled ? "Not available for a body-only search" : undefined}
                      style={{
                        padding: "8px 12px", borderRadius: "999px",
                        border: "none", cursor: disabled ? "not-allowed" : "pointer",
                        backgroundColor: similarity === s ? "white" : "transparent",
                        color: disabled ? "var(--gray-300)" : similarity === s ? "var(--primary-400)" : "var(--gray-400)",
                        fontWeight: similarity === s ? 700 : 600,
                        fontSize: "12px",
                        display: "flex", alignItems: "center",
                        transition: "all 0.15s",
                      }}
                    >
                      {s}%
                    </button>
                  );
                })}
              </div>
              {/* Resets the browser's native range-input chrome (Chrome/Safari/Firefox each draw
                  their own track/thumb border by default) down to a flat gray track + solid
                  purple thumb — same treatment as Data's Smart Search Similarity slider. */}
              <style>{`
                .vca-similarity-slider { -webkit-appearance:none; appearance:none; background:transparent; outline:none; border:none; }
                .vca-similarity-slider::-webkit-slider-runnable-track { height:4px; border-radius:999px; background:var(--gray-200); border:none; }
                .vca-similarity-slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:var(--primary-400); border:none; margin-top:-5px; cursor:pointer; }
                .vca-similarity-slider::-moz-range-track { height:4px; border-radius:999px; background:var(--gray-200); border:none; }
                .vca-similarity-slider::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:var(--primary-400); border:none; cursor:pointer; }
              `}</style>
              <input
                className="vca-similarity-slider"
                type="range" min={bodyOnly ? BODY_ONLY_MIN_SIMILARITY : 0} max={100} value={similarity}
                onChange={e => setSimilarity(Number(e.target.value))}
                style={{ width: "100px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", width: "30px", flexShrink: 0 }}>{similarity}%</span>
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
              color: "var(--gray-600)", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap",
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
              backgroundColor: "var(--gray-900)", color: "white",
              fontWeight: 800, fontSize: "14px", letterSpacing: "-0.28px", whiteSpace: "nowrap",
              fontFamily: "'SUIT', sans-serif", flexShrink: 0,
            }}
          >
            {mode === "car" ? "Search Vehicle" : "Search Persons"}
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

          {/* vca-thin-scrollbar — the native scrollbar eats into the right padding since it sits
              inside the border-box, on top of the content edge; a thin custom scrollbar shrinks
              that so the left/right padding reads as symmetric instead of the right side looking
              squeezed. */}
          <div className="vca-thin-scrollbar" style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── Search Targets (read-only preview of the uploaded face/body) ── */}
            {mode === "person" && (faceImage || bodyImage) && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>Search targets</h3>
                  <div style={{ display: "flex", gap: "24px" }}>
                    {([
                      { key: "face" as const, image: faceImage, height: "100px" },
                      { key: "body" as const, image: bodyImage, height: "140px" },
                    ]).map(({ key, image, height }) => (
                      <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
                        <span style={{
                          fontSize: "12px", fontWeight: 700, color: "var(--primary-400)",
                          backgroundColor: "var(--primary-100)", borderRadius: "6px",
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
                            border: hoverUpload === key ? "1px dashed var(--primary-400)" : "1px dashed var(--gray-300)",
                            backgroundColor: image ? "white" : "var(--gray-100)",
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
                              <span style={{ fontSize: "12px", fontWeight: 700, color: image ? "white" : "var(--primary-400)" }}>
                                {image ? "Click to change" : "Click to upload"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)" }} />
              </>
            )}

            {/* ── Search Results header ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>Search results</h3>
              <span style={{
                width: "18px", height: "18px", borderRadius: "999px", backgroundColor: "var(--gray-100)",
                color: "var(--gray-700)", fontSize: "10px", fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {hasSearched ? results.length : 0}
              </span>
              {traceName && (
                <span style={{
                  fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", backgroundColor: "var(--primary-100)",
                  borderRadius: "999px", padding: "3px 10px", whiteSpace: "nowrap",
                }}>
                  Tracing: {traceName}
                </span>
              )}
            </div>

            {/* ── Person filter chips — only when these results actually contain more than one
                distinct person. Toggling a chip controls who the map/route-history panel trace;
                the results grid below always keeps showing everyone regardless of selection. */}
            {showPersonChips && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {distinctPersons.map((p) => {
                  const active = selectedPersonIds.has(p.personId);
                  return (
                    <button key={p.personId} onClick={() => togglePerson(p.personId)} style={{
                      display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px",
                      borderRadius: "999px", cursor: "pointer",
                      border: active ? `1px solid ${p.color}` : "1px solid var(--gray-300)",
                      backgroundColor: active ? p.color : "white",
                      fontSize: "12px", fontWeight: active ? 700 : 600,
                      color: active ? "white" : "var(--gray-700)",
                    }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "999px", backgroundColor: active ? "white" : p.color, flexShrink: 0 }} />
                      {p.personLabel}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Search Results grid ── */}
            {!hasSearched ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px 0" }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="var(--gray-200)" strokeWidth="2" />
                  <path d="M18 18L25 25" stroke="var(--gray-200)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.7, color: "var(--gray-400)" }}>
                  {mode === "person"
                    ? <>Upload a face or body image<br />above and click <strong style={{ color: "var(--gray-700)" }}>Search Persons</strong></>
                    : <>Enter a license plate and click<br /><strong style={{ color: "var(--gray-700)" }}>Search Vehicle</strong></>
                  }
                </p>
              </div>
            ) : results.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px 0" }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="var(--gray-200)" strokeWidth="2" />
                  <path d="M18 18L25 25" stroke="var(--gray-200)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 9l6 6M15 9l-6 6" stroke="var(--danger-200)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.7, color: "var(--gray-400)" }}>
                  <strong style={{ color: "var(--gray-700)" }}>No matching sightings found.</strong><br />
                  Try a different image, a wider date range,<br />or a lower similarity threshold.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {results.map((hit, index) => {
                  const excluded = excludedHitIds.has(hit.id);
                  return (
                  <div
                    key={hit.id}
                    onClick={() => handleHitClick(index)}
                    onMouseEnter={e => { if (activeHit !== index) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                    onMouseLeave={e => { if (activeHit !== index) e.currentTarget.style.backgroundColor = "transparent"; }}
                    style={{
                      cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px",
                      padding: "4px", borderRadius: "10px",
                      border: activeHit === index ? "2px solid var(--primary-400)" : "2px solid transparent",
                      opacity: excluded ? 0.45 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", gap: "4px" }}>
                      <div style={{ position: "relative", width: "63px", height: "62px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                        <img src={hit.faceUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                        <span style={{ position: "absolute", top: "4px", left: "4px", backgroundColor: "rgba(14, 22, 42,0.6)", color: "white", fontSize: "10px", fontWeight: 600, padding: "2px 4px", borderRadius: "3px" }}>Face</span>
                      </div>
                      <div style={{ position: "relative", width: "63px", height: "62px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                        <img src={hit.bodyUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                        <span style={{ position: "absolute", top: "4px", left: "4px", backgroundColor: "rgba(90,61,251,0.4)", color: "white", fontSize: "10px", fontWeight: 600, padding: "2px 4px", borderRadius: "3px" }}>Body</span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: "var(--gray-100)", borderRadius: "6px", padding: "4px 6px", overflow: "hidden" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--gray-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Face <span style={{ fontWeight: 800, color: "var(--primary-400)" }}>{hit.score}</span>
                        {/* No body image was searched → bodyScore has nothing real behind it and
                            reads as "0%", not an actual (low) match — show Face alone rather than
                            a body score that isn't measuring anything. */}
                        {parseFloat(hit.bodyScore) > 0 && (
                          <> · Body <span style={{ fontWeight: 800, color: "var(--primary-400)" }}>{hit.bodyScore}</span></>
                        )}
                      </span>
                    </div>
                    {excluded ? (
                      <button
                        onClick={e => { e.stopPropagation(); setExcludedHitIds(prev => { const next = new Set(prev); next.delete(hit.id); return next; }); }}
                        style={{ display: "flex", alignItems: "center", gap: "4px", border: "none", background: "none", padding: 0, cursor: "pointer", width: "fit-content" }}
                      >
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--danger-400)" }}>Excluded</span>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary-400)", textDecoration: "underline" }}>Restore</span>
                      </button>
                    ) : showPersonChips && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "999px", backgroundColor: personColor(hit.personId), flexShrink: 0 }} />
                        <span style={{ fontSize: "10px", fontWeight: 700, color: personColor(hit.personId) }}>{hit.personLabel}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <PinIconSm />
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-600)" }}>{hit.location}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {hasSearched && results.length > 0 && (
            <div style={{ padding: "10px 20px", borderTop: BORDER, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-800)" }}>1–{results.length} of {results.length}</span>
            </div>
          )}
        </div>
        )}

        {/* CENTER: Leaflet Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <RedmapMap
            hits={trackingActive ? results.map((h) => ({
              lat: h.lat, lng: h.lng,
              mapLabel: h.mapLabel,
              time: h.time.slice(0, 5),
              isAlert: h.isUnregistered,
              color: personColor(h.personId),
              groupId: h.personId,
              // Keeps `results` and `hits` the same length/order — see the comment on
              // TrackingHit.hidden in RedmapMap.tsx for why this can't just be a `.filter()`.
              hidden: excludedHitIds.has(h.id),
            })) : []}
            trackingActive={trackingActive}
            showStatus={false}
            activeNode={activeNode}
            onMarkerClick={handleMarkerClick}
            visibleGroupIds={showPersonChips ? Array.from(selectedPersonIds) : null}
          />
        </div>

        {/* RIGHT: Route History Timeline — only mounts when there is an actual route to
            trace. A search that came back empty hides this panel outright rather than
            showing an empty-state next to the left panel's own "no results" message —
            two empty states side by side just restated the same thing. */}
        {trackingActive && (
        <div style={{
          width: "320px", backgroundColor: "white", borderLeft: BORDER,
          display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
        }}>
          <div style={{
            padding: "16px", borderBottom: BORDER,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>
              Multi-track route history
            </h3>
            <button onClick={() => setTimelineNewestFirst(v => !v)} style={{
              display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none",
              cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)",
            }}>
              {timelineNewestFirst ? "Newest first" : "Oldest first"}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: timelineNewestFirst ? "none" : "rotate(180deg)" }}>
                <path d="M3.5 4L6 1.5L8.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 10.5V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "22px", top: "22px", bottom: "22px", width: "2px", backgroundColor: "var(--gray-200)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {(() => {
                    // Only the currently-traced person(s) get a row here — an untraced lookalike's
                    // sightings would otherwise sit in the same flat list with nothing to show they
                    // don't belong to who's actually being traced. The shared TRACKING_ORIGIN node
                    // only makes sense for ONE target, so it's dropped once more than one distinct
                    // person is being traced at once (see RedmapMap's identical rule).
                    const tracedHits = results
                      .map((hit, hitIndex) => ({ hit, hitIndex }))
                      .filter(({ hit }) => !showPersonChips || selectedPersonIds.has(hit.personId))
                      .filter(({ hit }) => !excludedHitIds.has(hit.id));
                    const showOrigin = tracedHits.length > 0 && new Set(tracedHits.map((t) => t.hit.personId)).size <= 1;
                    const nodes = [
                      ...(showOrigin ? [{
                        key: "origin", location: TRACKING_ORIGIN.label, date: TRACKING_ORIGIN.date, time: TRACKING_ORIGIN.time,
                        faceUrl: TRACKING_ORIGIN.faceUrl, elapsed: undefined as string | undefined, elapsedAlert: false,
                        hitIndex: -1, color: PERSON_COLORS[0],
                      }] : []),
                      ...tracedHits.map(({ hit, hitIndex }) => ({
                        key: hit.id, location: hit.location, date: hit.date, time: hit.time, faceUrl: hit.faceUrl,
                        elapsed: hit.elapsed, elapsedAlert: hit.elapsedAlert, hitIndex, color: personColor(hit.personId),
                      })),
                    ];
                    const ordered = timelineNewestFirst ? [...nodes].reverse() : nodes;
                    return ordered.map((node, i) => {
                      // Position in the original chronological array (origin=-1..MOCK_RESULTS.length-1),
                      // independent of which direction we're currently displaying it in.
                      const index = timelineNewestFirst ? nodes.length - 1 - i : i;
                      const num = index + 1; // chronological step number — stable regardless of sort direction
                      const isLatest = index === nodes.length - 1;
                      const isActive = node.hitIndex >= 0 && activeNode === node.hitIndex;
                      return (
                        <div
                          key={node.key}
                          onClick={() => { if (node.hitIndex >= 0) handleNodeClick(node.hitIndex); }}
                          onMouseEnter={e => { if (node.hitIndex >= 0 && !isActive) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          style={{ display: "flex", alignItems: "flex-start", gap: "12px", position: "relative", zIndex: 1, cursor: node.hitIndex >= 0 ? "pointer" : "default", borderRadius: "12px", transition: "background-color 0.15s" }}
                        >
                          <div style={{
                            width: "44px", height: "44px", borderRadius: "999px", flexShrink: 0,
                            border: isActive ? `2px solid ${node.color}` : "1px solid var(--gray-300)",
                            backgroundColor: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                          }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: isActive ? node.color : "var(--gray-400)" }}>
                              {String(num).padStart(2, "0")}
                            </span>
                          </div>
                          <div style={{
                            flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0,
                            border: isActive ? "1px solid var(--primary-200)" : "1px solid transparent",
                            borderRadius: "12px", padding: isActive ? "12px" : "0",
                            boxShadow: isActive ? "2px 2px 6px rgba(14, 22, 42,0.06)" : "none",
                            transition: "all 0.2s",
                          }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", gap: "10px", alignItems: "center", minWidth: 0 }}>
                                <div style={{ width: "64px", height: "48px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                                  <img src={node.faceUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", margin: 0, marginBottom: "4px" }}>{node.location}</p>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <ClockIconSm />
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", fontFamily: "monospace" }}>{node.date}</span>
                                  </div>
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", fontFamily: "monospace", paddingLeft: "16px" }}>{node.time}</span>
                                </div>
                              </div>
                              {/* Not this trace's origin (hitIndex -1) — only a real sighting can be
                                  a wrong one. Removing pulls it out of THIS route only; it stays in
                                  the left result list (dimmed, restorable) since it's still a real
                                  search hit, just not this person's. */}
                              {node.hitIndex >= 0 && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setExcludedHitIds(prev => new Set(prev).add(node.key));
                                    // The left list's own "Excluded · Restore" tag is the lasting way
                                    // back, but it's easy to miss right after the click — a toast with
                                    // its own Undo gives an immediate way to reverse a misclick without
                                    // hunting for that hit in the grid.
                                    showToast({
                                      variant: "default", title: `Removed "${node.location}" from this trace`,
                                      actionLabel: "Undo",
                                      onAction: () => setExcludedHitIds(prev => { const next = new Set(prev); next.delete(node.key); return next; }),
                                    });
                                  }}
                                  title="Not the same person — remove from this trace"
                                  style={{
                                    width: "22px", height: "22px", borderRadius: "999px", flexShrink: 0,
                                    border: "1px solid var(--danger-200)", backgroundColor: "var(--danger-100)",
                                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                  }}
                                >
                                  <RemoveFromTraceIcon />
                                </button>
                              )}
                            </div>
                            {node.elapsed && (
                              <div style={{
                                backgroundColor: node.elapsedAlert ? "var(--danger-100)" : "var(--primary-100)", borderRadius: "8px",
                                padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
                              }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: node.elapsedAlert ? "var(--danger-400)" : "var(--primary-400)" }}>
                                  {node.elapsed}
                                </span>
                                {isLatest && <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--primary-400)" }}>LAST SEEN</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
