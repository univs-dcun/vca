"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { useApiData } from "@/hooks/useApiData";
import { getHourlyDetections } from "@/lib/api/dashboard";

const CHART_HEIGHT = 160;
const FALLBACK_WIDTH = 900; // used only until the container's real width is measured
const HOUR_TICKS = [0, 4, 8, 12, 16, 20];
// Figma's reference draws several thin bars/scatter groups per hour rather than one wide bar —
// subdividing each hour keeps that dense, textured look while still deriving every value from
// the same hourly count (not hand-placed like the original absolute-position export).
const SUB_STEPS_PER_HOUR = 3;

function hourLabel(hour: number): string {
  if (hour === 0) return "12AM";
  if (hour === 12) return "12PM";
  return hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
}

function xForStep(step: number, totalSteps: number, width: number): number {
  return (step / (totalSteps - 1)) * width;
}

// Deterministic pseudo-random in [0,1) — a plain Math.random() would differ between the
// server-rendered and client-hydrated pass and trigger a hydration mismatch.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// A single camera only ever sees a fraction of the citywide total — stable per camera name so
// switching back to the same camera reproduces the same-looking curve.
function cameraScaleFor(name: string): number {
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 0.12 + seededRandom(seed) * 0.22;
}

// Catmull-Rom -> cubic-bezier smoothing so the trend line flows through every point instead
// of a jagged polyline.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 6L8 10L12 6" stroke="#475469" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Figma node 178:14623 ("all camreas") — exact vector data fetched from the node's asset export.
function CameraIconFigma() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M13.9583 10H16.985C17.127 10.0001 17.2666 10.0364 17.3906 10.1056C17.5146 10.1748 17.6189 10.2745 17.6935 10.3953C17.7681 10.5161 17.8107 10.654 17.817 10.7958C17.8234 10.9377 17.7935 11.0788 17.73 11.2058L16.035 14.5967C15.9707 14.7252 15.8743 14.8348 15.7552 14.9151C15.636 14.9953 15.4981 15.0434 15.3549 15.0546C15.2117 15.0659 15.068 15.0399 14.9377 14.9792C14.8075 14.9185 14.6952 14.8252 14.6117 14.7083L12.8417 12.2333" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.255 7.54373C14.4525 7.6426 14.6027 7.81584 14.6726 8.02539C14.7424 8.23493 14.7262 8.46363 14.6275 8.66123L12.0392 13.8371C11.9902 13.935 11.9225 14.0223 11.8398 14.094C11.7571 14.1657 11.661 14.2204 11.5572 14.255C11.4533 14.2896 11.3437 14.3034 11.2345 14.2956C11.1253 14.2878 11.0187 14.2586 10.9209 14.2096L3.00836 10.2496C2.43364 9.96007 1.99699 9.45471 1.79396 8.84407C1.59093 8.23342 1.63806 7.56722 1.92503 6.99123L3.07503 4.66623C3.21836 4.38058 3.41656 4.12597 3.65831 3.91693C3.90006 3.70788 4.18061 3.54851 4.48396 3.44791C4.78731 3.34731 5.1075 3.30746 5.42625 3.33062C5.74501 3.35378 6.05608 3.4395 6.34169 3.5829L14.255 7.54373Z" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66667 15.8333H4.8C5.11061 15.8355 5.41564 15.7508 5.68068 15.5888C5.94573 15.4269 6.16023 15.1941 6.3 14.9167L7.5 12.5" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66675 17.4993V14.166" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83333 7.5H5.84063" stroke="#475469" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRightIconFigma({ rotate }: { rotate: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${rotate}deg)`, transition: "transform 0.15s" }}>
      <path d="M6 12L10 8L6 4" stroke="#475469" strokeLinecap="round"/>
    </svg>
  );
}
// Exact stops from the Figma source (node 154:18811): lavender on the left, deep blue at the
// midpoint, cyan on the right.
const GRADIENT_STOPS: [string, string][] = [["0%", "#dbb7ff"], ["50.5%", "#0047ff"], ["100%", "#52d5ff"]];
const DOT_COLORS = ["#c4b5fd", "#818cf8", "#3b82f6", "#0047ff", "#2563eb", "#60a5fa", "#52d5ff"];
const DOT_RADIUS_PX = 2.5; // 5x5px circle

const ALL_CAMERAS = "All Cameras";

export default function DetectionActivityChart({ onHide }: { onHide?: () => void } = {}) {
  // The viewBox width tracks the container's actual rendered width (instead of a fixed 900 that
  // the SVG then stretches to fit) so the x/y scale is always exactly 1:1 — no more, no less —
  // keeping the chart's height fixed while still fully avoiding the stretched-circle/warped-line
  // distortion that non-uniform scaling caused.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cameras = useVcaStore(s => s.cameras);
  const [selectedCamera, setSelectedCamera] = useState<string>(ALL_CAMERAS);
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);
  // Routed through the future-backend stub instead of importing the mock array directly — see
  // lib/api/dashboard.ts. `data` is null for the brief window before the (currently mock-delayed)
  // fetch resolves; every derived value below falls back to an empty/flat chart until then.
  const { data: hourlyDetections } = useApiData(() => getHourlyDetections(), []);
  // The whole point of this chart is spotting when VIPs show up, so the line/bars/dots plot
  // vipCount directly (not total detection count) — re-scaled for the selected camera. There's
  // no real per-camera dataset behind this, just a stable, reproducible variation of the
  // citywide one.
  const scaledHourly = useMemo(() => {
    const scale = selectedCamera === ALL_CAMERAS ? 1 : cameraScaleFor(selectedCamera);
    return (hourlyDetections ?? []).map(h => ({
      hour: h.hour,
      count: Math.max(0, h.vipCount * scale),
    }));
  }, [selectedCamera, hourlyDetections]);

  const yMax = useMemo(() => {
    const peak = Math.max(...scaledHourly.map(h => h.count), 1);
    return Math.max(2, Math.ceil(peak * 1.2));
  }, [scaledHourly]);
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8].map(f => Math.round(yMax * f));
  const yForCount = (count: number) => CHART_HEIGHT - (count / yMax) * CHART_HEIGHT;

  const { steps, totalSteps } = useMemo(() => {
    const s = scaledHourly.flatMap((h, hi) =>
      Array.from({ length: SUB_STEPS_PER_HOUR }, (_, si) => {
        const seed = hi * SUB_STEPS_PER_HOUR + si;
        const variance = (seededRandom(seed * 3.1) - 0.5) * h.count * 0.5;
        return { step: seed, hour: h.hour, count: Math.max(0, h.count + variance) };
      })
    );
    return { steps: s, totalSteps: s.length };
  }, [scaledHourly]);

  const linePoints = steps.map(s => ({ x: xForStep(s.step, totalSteps, width), y: yForCount(s.count) }));
  const linePath = smoothPath(linePoints);
  // Area fill: the trend line's own path, closed along the top edge — so the wash only ever
  // covers the region above the line, following its curve, instead of a flat rectangle. Empty
  // during the brief pre-fetch window (no points yet), not just while data is genuinely all-zero.
  const areaPath = linePoints.length > 0
    ? `${linePath} L ${linePoints[linePoints.length - 1].x},0 L ${linePoints[0].x},0 Z`
    : "";

  return (
    <div className="vca-rise-in" style={{
      backgroundColor: "rgba(255,255,255,0.4)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      borderRadius: "11px", border: "1px solid rgba(226,232,240,0.6)", boxShadow: "0 8px 32px rgba(14,22,42,0.12)",
      padding: "18px 22px 14px", display: "flex", flexDirection: "column", gap: "12px",
    }}>
      {/* Whole header row is the click target to minimize (except the camera filter, which
          stops propagation) — a wide horizontal hit area reads as a control much more clearly
          than a small icon tucked next to the title. The chevron sits at the far right, in its
          own visible pill, as the visual cue for that behavior. */}
      <div
        onClick={onHide}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", cursor: onHide ? "pointer" : "default" }}
      >
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#0e162a", letterSpacing: "-0.32px", whiteSpace: "nowrap" }}>
          VIP Detection Today
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {/* Camera filter — Figma node 178:14623 ("all camreas") */}
            <button
              onClick={() => setCameraPickerOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                width: "160px", padding: "8px 12px", borderRadius: "8px", border: "none",
                backgroundColor: "white", cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
                <CameraIconFigma />
                <span style={{
                  fontSize: "14px", fontWeight: 600, color: "#1D293B", letterSpacing: "-0.28px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {selectedCamera === ALL_CAMERAS ? "All cameras" : selectedCamera}
                </span>
              </span>
              <ChevronRightIconFigma rotate={cameraPickerOpen ? 270 : 90} />
            </button>

            {cameraPickerOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0, width: "160px", backgroundColor: "white",
                border: "1px solid #E2E8F0", borderRadius: "8px", boxShadow: "0 8px 20px rgba(14,22,42,0.12)",
                zIndex: 10, overflow: "hidden",
              }}>
                {[ALL_CAMERAS, ...cameras.map(c => c.name)].map(name => (
                  <button
                    key={name}
                    onClick={() => { setSelectedCamera(name); setCameraPickerOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", cursor: "pointer",
                      backgroundColor: name === selectedCamera ? "#f0f0ff" : "white",
                      fontSize: "13px", fontWeight: name === selectedCamera ? 700 : 500,
                      color: name === selectedCamera ? "#5a3dfb" : "#334155",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span
            aria-label="Minimize chart"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "rgba(226,232,240,0.6)", flexShrink: 0,
            }}
          >
            <ChevronDownIcon />
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${CHART_HEIGHT}px`, paddingBottom: "1px" }}>
          {[...yTicks].reverse().map((tick, i) => (
            <span key={i} style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", lineHeight: 1 }}>{tick}</span>
          ))}
        </div>

        <div ref={containerRef} style={{ flex: 1, minWidth: 0 }}>
          <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT} style={{ overflow: "visible", display: "block" }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
              </linearGradient>
              <linearGradient id="areaWash" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
              </linearGradient>
              {/* Vertical fade: transparent at the chart's top, opaque down at the line — used as
                  an alpha mask so the wash below only ever shows through near the curve. */}
              <linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="100%" stopColor="white" stopOpacity="0.5" />
              </linearGradient>
              <mask id="areaFadeMask">
                <path d={areaPath} fill="url(#areaFade)" />
              </mask>
            </defs>

            {/* Soft color wash — clipped to the area path (line's curve, closed at the top), so
                it only ever appears above the line and fades out toward the top of the chart. */}
            <g mask="url(#areaFadeMask)">
              <rect x={0} y={0} width={width} height={CHART_HEIGHT} fill="url(#areaWash)" />
            </g>

            {yTicks.map((tick, i) => (
              <line key={i} x1={0} y1={yForCount(tick)} x2={width} y2={yForCount(tick)} stroke="#e2e8f0" strokeWidth={1} />
            ))}

            {/* Baseline volume bars */}
            {steps.map((s, i) => {
              const barWidth = (width / totalSteps) * 0.55;
              const x = xForStep(s.step, totalSteps, width) - barWidth / 2;
              const barHeight = Math.max(2, (s.count / yMax) * CHART_HEIGHT * 0.3);
              return (
                <rect key={i} x={x} y={CHART_HEIGHT - barHeight} width={barWidth} height={barHeight} rx={1} fill="#ccd5e1" />
              );
            })}

            {/* Scatter — individual detections jittered around the trend line */}
            {steps.map((s, i) => {
              const baseY = yForCount(s.count);
              const dotCount = 1 + Math.round(seededRandom(i * 7.3) * 2);
              return Array.from({ length: dotCount }).map((_, di) => {
                const seed = i * 13.7 + di * 5.1;
                const jitterX = (seededRandom(seed) - 0.5) * (width / totalSteps) * 0.9;
                const jitterY = (seededRandom(seed + 1) - 0.5) * 40 - 6;
                const colorIdx = Math.floor((i / totalSteps) * DOT_COLORS.length);
                return (
                  <circle
                    key={di}
                    cx={xForStep(s.step, totalSteps, width) + jitterX}
                    cy={Math.max(4, baseY + jitterY)}
                    r={DOT_RADIUS_PX}
                    fill={DOT_COLORS[Math.min(DOT_COLORS.length - 1, colorIdx)]}
                    opacity={0.85}
                  />
                );
              });
            })}

            <path d={linePath} fill="none" stroke="url(#trendGradient)" strokeWidth={3} strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "24px" }}>
        {HOUR_TICKS.map(hour => (
          <span key={hour} style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>
            {hourLabel(hour)}
          </span>
        ))}
      </div>
    </div>
  );
}
