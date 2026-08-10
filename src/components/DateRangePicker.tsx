"use client";

import { useState } from "react";

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}

const KO_DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const KO_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function toStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

type ShortcutKey = "today" | "last7" | "thisMonth" | "last3" | "last6" | "thisYear" | "all";

const SHORTCUTS: { label: string; key: ShortcutKey }[] = [
  { label: "Today",         key: "today"     },
  { label: "Last 7 days",   key: "last7"     },
  { label: "This month",    key: "thisMonth" },
  { label: "Last 3 months", key: "last3"     },
  { label: "Last 6 months", key: "last6"     },
  { label: "This year",     key: "thisYear"  },
  { label: "All time",      key: "all"       },
];

function resolveShortcut(key: ShortcutKey): { start: string; end: string; leftYear: number; leftMonth: number } {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2,"0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const todayStr = fmt(today);

  const sub = (d: number) => { const r = new Date(today); r.setDate(r.getDate() - d); return r; };
  const subM = (m: number) => { const r = new Date(today); r.setMonth(r.getMonth() - m); return r; };

  switch (key) {
    case "today":     return { start: todayStr, end: todayStr, leftYear: today.getFullYear(), leftMonth: today.getMonth() };
    case "last7":     { const s = sub(6); return { start: fmt(s), end: todayStr, leftYear: s.getFullYear(), leftMonth: s.getMonth() }; }
    case "thisMonth": { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { start: fmt(s), end: todayStr, leftYear: s.getFullYear(), leftMonth: s.getMonth() }; }
    case "last3":     { const s = subM(3); return { start: fmt(s), end: todayStr, leftYear: s.getFullYear(), leftMonth: s.getMonth() }; }
    case "last6":     { const s = subM(6); return { start: fmt(s), end: todayStr, leftYear: s.getFullYear(), leftMonth: s.getMonth() }; }
    case "thisYear":  { const s = new Date(today.getFullYear(), 0, 1); return { start: fmt(s), end: todayStr, leftYear: s.getFullYear(), leftMonth: 0 }; }
    case "all":       { const s = new Date(2020, 0, 1); return { start: fmt(s), end: todayStr, leftYear: s.getFullYear(), leftMonth: 0 }; }
  }
}

export default function DateRangePicker({ startDate, endDate, onApply, onClose }: DateRangePickerProps) {
  const today = new Date();
  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [tempStart, setTempStart] = useState<string | null>(startDate);
  const [tempEnd,   setTempEnd]   = useState<string | null>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [activeShortcut, setActiveShortcut] = useState<ShortcutKey | null>(null);

  /* ── Right calendar ── */
  const rMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const rYear  = viewMonth === 11 ? viewYear + 1 : viewYear;

  function prev() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleShortcut(key: ShortcutKey) {
    const r = resolveShortcut(key);
    setTempStart(r.start);
    setTempEnd(r.end);
    setViewYear(r.leftYear);
    setViewMonth(r.leftMonth);
    setActiveShortcut(key);
  }

  function handleDayClick(dateStr: string) {
    setActiveShortcut(null);
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr); setTempEnd(null);
    } else {
      if (dateStr < tempStart)      { setTempStart(dateStr); setTempEnd(null); }
      else if (dateStr === tempStart){ setTempStart(null); }
      else                           { setTempEnd(dateStr); setHoverDate(null); }
    }
  }

  function rangeState(dateStr: string): "start" | "end" | "in" | "single" | null {
    if (!tempStart) return null;
    const endRef = tempEnd ?? hoverDate;
    if (!endRef || endRef === tempStart) return dateStr === tempStart ? "single" : null;
    const [lo, hi] = tempStart <= endRef ? [tempStart, endRef] : [endRef, tempStart];
    if (dateStr === lo) return "start";
    if (dateStr === hi) return "end";
    if (dateStr > lo && dateStr < hi) return "in";
    return null;
  }

  function renderMonth(y: number, m: number) {
    const numDays = daysInMonth(y, m);
    const firstDay = firstDow(y, m);
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= numDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div style={{ flex: 1 }}>
        {/* Weekday header */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:"4px" }}>
          {KO_DAYS.map(d => (
            <div key={d} style={{ textAlign:"center", fontSize:"12px", color:"#94a3b8", padding:"4px 0", fontWeight:500 }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", rowGap:"2px" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} style={{ height:"36px" }} />;
            const dateStr = toStr(y, m, day);
            const state = rangeState(dateStr);
            const isToday = dateStr === todayStr;
            const isEndpoint = state === "start" || state === "end" || state === "single";
            const isIn = state === "in";
            const isStart = state === "start";
            const isEnd = state === "end";
            const hasEnd = !!tempEnd;

            return (
              <div
                key={i}
                onClick={() => handleDayClick(dateStr)}
                onMouseEnter={() => { if (tempStart && !tempEnd) setHoverDate(dateStr); }}
                onMouseLeave={() => setHoverDate(null)}
                style={{ position:"relative", height:"36px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
              >
                {/* range strip */}
                {(isIn || (isStart && hasEnd) || isEnd) && (
                  <div style={{
                    position:"absolute", top:3, bottom:3,
                    left: isStart ? "50%" : 0,
                    right: isEnd  ? "50%" : 0,
                    backgroundColor:"#ede9fe",
                  }} />
                )}
                {/* circle */}
                <div style={{
                  position:"relative", zIndex:1,
                  width:"34px", height:"34px", borderRadius:"50%",
                  backgroundColor: isEndpoint ? "#5a3dfb" : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexDirection:"column", gap:"1px",
                }}>
                  <span style={{
                    fontSize:"13px",
                    fontWeight: isEndpoint || isToday ? 700 : 400,
                    color: isEndpoint ? "white" : isIn ? "#5a3dfb" : "#0e162a",
                    lineHeight:1,
                    userSelect:"none",
                  }}>{day}</span>
                  {/* today dot */}
                  {isToday && !isEndpoint && (
                    <div style={{ width:"4px", height:"4px", borderRadius:"50%", backgroundColor:"#5a3dfb" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const canApply = !!tempStart && !!tempEnd;

  return (
    <div style={{
      position:"absolute", top:"calc(100% + 8px)", left:"50%",
      transform:"translateX(-50%)",
      zIndex:3000,
      backgroundColor:"white",
      border:"1px solid #e8e8f0",
      borderRadius:"16px",
      boxShadow:"0 8px 32px rgba(0,0,0,0.13)",
      fontFamily:"'SUIT', sans-serif",
      display:"flex",
      overflow:"hidden",
      minWidth:"660px",
    }}>
      {/* ── Left shortcut panel ── */}
      <div style={{ width:"148px", flexShrink:0, borderRight:"1px solid #f1f5f9", padding:"12px 0" }}>
        {SHORTCUTS.map(s => {
          const active = activeShortcut === s.key;
          return (
            <button
              key={s.key}
              onClick={() => handleShortcut(s.key)}
              style={{
                display:"block", width:"100%",
                textAlign:"left", padding:"9px 20px",
                border:"none", cursor:"pointer",
                backgroundColor: active ? "#ede9fe" : "transparent",
                color: active ? "#5a3dfb" : "#334155",
                fontSize:"13px", fontWeight: active ? 700 : 500,
                letterSpacing:"-0.26px",
                borderRadius:"0",
                transition:"background-color 0.1s",
              }}
            >{s.label}</button>
          );
        })}
      </div>

      {/* ── Right calendar area ── */}
      <div style={{ flex:1, padding:"20px 24px 16px", display:"flex", flexDirection:"column", gap:"16px" }}>
        {/* Navigation header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={prev} style={NAV_BTN}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="#64748a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ display:"flex", flex:1, justifyContent:"space-around" }}>
            <span style={{ fontSize:"15px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.3px" }}>
              {KO_MONTHS[viewMonth]} {viewYear}
            </span>
            <span style={{ fontSize:"15px", fontWeight:800, color:"#0e162a", letterSpacing:"-0.3px" }}>
              {KO_MONTHS[rMonth]} {rYear}
            </span>
          </div>
          <button onClick={next} style={NAV_BTN}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="#64748a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Two-month calendar */}
        <div style={{ display:"flex", gap:"24px" }}>
          {renderMonth(viewYear, viewMonth)}
          <div style={{ width:"1px", backgroundColor:"#f1f5f9", flexShrink:0 }} />
          {renderMonth(rYear, rMonth)}
        </div>

        {/* Bottom buttons */}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:"8px", paddingTop:"12px", borderTop:"1px solid #f1f5f9" }}>
          <button onClick={onClose} style={{
            height:"36px", padding:"0 20px", borderRadius:"10px",
            border:"1px solid #e2e8f0", background:"white",
            cursor:"pointer", fontSize:"13px", fontWeight:600, color:"#334155",
          }}>Cancel</button>
          <button
            onClick={() => canApply && onApply(tempStart!, tempEnd!)}
            disabled={!canApply}
            style={{
              height:"36px", padding:"0 24px", borderRadius:"10px", border:"none",
              cursor: canApply ? "pointer" : "not-allowed",
              backgroundColor: canApply ? "#5a3dfb" : "#e2e8f0",
              color: canApply ? "white" : "#94a3b8",
              fontSize:"13px", fontWeight:700, transition:"all 0.15s",
            }}
          >Apply changes</button>
        </div>
      </div>
    </div>
  );
}

const NAV_BTN: React.CSSProperties = {
  width:"30px", height:"30px", borderRadius:"8px",
  border:"1px solid #e2e8f0", background:"white",
  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  padding:0, flexShrink:0,
};
