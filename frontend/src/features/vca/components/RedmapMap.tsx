
import { useEffect, useRef, useState } from "react";

export interface TrackingHit {
  lat: number;
  lng: number;
  mapLabel: string;
  time: string;
  isAlert: boolean;
}

// Speech-bubble pointer for a marker's side-tooltip: a slightly larger border-colored triangle
// behind a fill-colored one (1px smaller on each side), so only a thin outline ring shows at the
// tip. Pass the same value for fillColor/borderColor for a solid, borderless arrow.
function bubbleTailHtml(centerY: number, fillColor: string, borderColor: string) {
  return `<div style="position:absolute;left:-9px;top:${centerY - 8}px;width:0;height:0;
        border-top:8px solid transparent;border-bottom:8px solid transparent;border-right:9px solid ${borderColor};"></div>
     <div style="position:absolute;left:-8px;top:${centerY - 7}px;width:0;height:0;
        border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:8px solid ${fillColor};"></div>`;
}

export const TRACKING_ORIGIN = {
  lat: 1.3691,
  lng: 103.8454,
  label: "Ang Mo Kio",
  date: "2026-06-11",
  time: "10:15:20",
  faceUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&h=100&q=80",
};

interface StatusZone {
  id: string;
  label: string;
  count: number;
  lat: number;
  lng: number;
  isAlert?: boolean;
  cam?: boolean;
}

const STATUS_ZONES: StatusZone[] = [
  { id: "amk",  label: "Angmokio",     count: 0,   lat: 1.3691, lng: 103.8454 },
  { id: "sea",  label: "Serangoon",    count: 0,   lat: 1.3554, lng: 103.8679 },
  { id: "geo1", label: "Geylang",      count: 0,   lat: 1.3202, lng: 103.8649, cam: true },
  { id: "aug",  label: "August",       count: 0,   lat: 1.3380, lng: 103.8840, cam: true },
  { id: "houg", label: "Hougang",      count: 0,   lat: 1.3717, lng: 103.8927 },
  { id: "geo2", label: "Geylang",      count: 0,   lat: 1.3108, lng: 103.8572 },
  { id: "bis",  label: "Bishan",       count: 0,   lat: 1.3517, lng: 103.8490 },
  { id: "bkt",  label: "Bukit",        count: 0,   lat: 1.3522, lng: 103.7786, cam: true },
  { id: "tp",   label: "Toa payoh",    count: 0,   lat: 1.3343, lng: 103.8565 },
  { id: "nov",  label: "Novena",       count: 30,  lat: 1.3195, lng: 103.8410 },
  { id: "kal1", label: "Kallang",      count: 12,  lat: 1.3108, lng: 103.8715 },
  { id: "geo3", label: "Geylang",      count: 80,  lat: 1.3158, lng: 103.8920 },
  { id: "bdk",  label: "Bedok",        count: 0,   lat: 1.3250, lng: 103.9291 },
  { id: "tam",  label: "Tampines",     count: 0,   lat: 1.3527, lng: 103.9442 },
  { id: "cen",  label: "Central area", count: 0,   lat: 1.2895, lng: 103.8500 },
  { id: "mar",  label: "Marine",       count: 180, lat: 1.3020, lng: 103.9090, isAlert: true },
  { id: "kal2", label: "Kallang",      count: 50,  lat: 1.3088, lng: 103.8648 },
];

function statusMarkerHtml(zone: StatusZone): string {
  const isDark   = !zone.cam && !zone.isAlert && zone.count >= 20;
  const isDashed = !!zone.cam;

  let bg: string, textColor: string, border: string;
  if (zone.isAlert)  { bg = "#f43f5e"; textColor = "white";   border = ""; }
  else if (isDark)   { bg = "#0e162a"; textColor = "white";   border = ""; }
  else if (isDashed) { bg = "white";   textColor = "#64748a"; border = "border:1.5px dashed #cbd5e1;"; }
  else               { bg = "white";   textColor = "#334155"; border = "border:1.5px solid #e2e8f0;"; }

  const camSvg = isDashed
    ? `<svg width="14" height="11" viewBox="0 0 14 11" fill="none" style="flex-shrink:0">
        <path d="M1 1L13 10" stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M6 1H2A1.5 1.5 0 0 0 0.5 2.5v5A1.5 1.5 0 0 0 2 9h9A1.5 1.5 0 0 0 11.5 7.5V5"
              stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 2L13.5 0.5V10L10 8.5"
              stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    : "";

  const label  = isDashed ? zone.label : `${zone.label}&nbsp;&nbsp;${zone.count}`;
  const fw     = isDark || !!zone.isAlert ? 700 : 600;
  const shadow = isDark || !!zone.isAlert ? "0 2px 10px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.08)";

  return `<div style="transform:translateX(-50%) translateY(-50%);display:inline-flex;align-items:center;
      gap:5px;background:${bg};${border}border-radius:999px;padding:5px 12px;
      font-family:'SUIT',system-ui,sans-serif;font-size:12px;font-weight:${fw};
      color:${textColor};box-shadow:${shadow};white-space:nowrap;letter-spacing:-0.2px">
    ${camSvg}${label}</div>`;
}

interface RedmapMapProps {
  hits: TrackingHit[];
  trackingActive: boolean;
  showStatus: boolean;
  activeNode: number | null;
  onMarkerClick: (index: number) => void;
  // 데이터 연결(UV-34): 실검색 경로는 hits만으로 완결 — mock 전용 시작점(TRACKING_ORIGIN)을 그리지 않는다
  showOrigin?: boolean;
}

export default function RedmapMap({
  hits,
  trackingActive,
  showStatus,
  activeNode,
  onMarkerClick,
  showOrigin = true,
}: RedmapMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const overlayLayersRef = useRef<unknown[]>([]);
  const [zoom, setZoom] = useState(12);
  // Flips once Leaflet's async init resolves — the overlay-drawing effect below reads
  // mapInstanceRef synchronously and bails if it's still null, so without this the landing-state
  // status pills silently never draw (nothing else changes to re-trigger that effect afterward).
  const [mapReady, setMapReady] = useState(false);

  // ── Map init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const container = mapRef.current as any;
      if (container._leaflet_id) delete container._leaflet_id;

      const map = L.map(mapRef.current!, {
        center: [1.3521, 103.8698],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });

      if (cancelled) { map.remove(); return; }

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      map.zoomControl.setPosition("topright");
      map.on("zoomend", () => setZoom(map.getZoom()));
      mapInstanceRef.current = map;
      setZoom(map.getZoom());
      setMapReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ── Draw overlays ─────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    overlayLayersRef.current.forEach((l) => {
      try { (l as { remove: () => void }).remove(); } catch (_) { /* noop */ }
    });
    overlayLayersRef.current = [];

    import("leaflet").then(({ default: L }) => {

      if (!trackingActive && showStatus) {
        // ── STATUS VIEW: per-zone activity circles + labels ───────

        // Activity circles first (render behind labels)
        STATUS_ZONES.forEach((zone) => {
          if (!zone.cam && zone.count >= 20) {
            const circleColor = zone.isAlert ? "#f43f5e" : "#818cf8";
            const circle = L.circle([zone.lat, zone.lng], {
              radius: 600 + zone.count * 12,
              color: "transparent",
              fillColor: circleColor,
              fillOpacity: 0.12,
              weight: 0,
            }).addTo(map);
            overlayLayersRef.current.push(circle);
          }
        });

        // Zone label markers
        STATUS_ZONES.forEach((zone) => {
          const icon = L.divIcon({
            html: statusMarkerHtml(zone),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          const m = L.marker([zone.lat, zone.lng], { icon }).addTo(map);
          overlayLayersRef.current.push(m);
        });
        return;
      }

      if (!trackingActive) return;

      // ── TRACKING VIEW ─────────────────────────────────────────
      type RouteNode = { lat: number; lng: number; label: string; time: string };
      const originOffset = showOrigin ? 1 : 0; // 노드 index → 히트 index 변환량
      const nodes: RouteNode[] = [
        ...(showOrigin ? [{ lat: TRACKING_ORIGIN.lat, lng: TRACKING_ORIGIN.lng, label: TRACKING_ORIGIN.label, time: TRACKING_ORIGIN.time }] : []),
        ...hits.map((h) => ({ lat: h.lat, lng: h.lng, label: h.mapLabel, time: h.time })),
      ];

      const line = L.polyline(nodes.map((n) => [n.lat, n.lng]), {
        color: "#5a3dfb",
        weight: 3,
        opacity: 1,
        lineJoin: "round",
        className: "vca-route-line",
      }).addTo(map);
      overlayLayersRef.current.push(line);

      // Single arrowhead near the end of the line, pointing into the most recent node.
      // Placed at 35% along the final segment (not the midpoint) so it clears the
      // destination circle's glow halo instead of hiding underneath it.
      if (nodes.length >= 2) {
        const a = nodes[nodes.length - 2];
        const b = nodes[nodes.length - 1];
        const t = 0.35;
        const lat = a.lat + (b.lat - a.lat) * t;
        const lng = a.lng + (b.lng - a.lng) * t;
        const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
        const arrowIcon = L.divIcon({
          html: `<svg width="14" height="14" viewBox="0 0 14 14" style="display:block;transform:rotate(${bearing}deg)">
                   <path d="M7 1L12.5 12H1.5Z" fill="#5a3dfb"/>
                 </svg>`,
          iconSize: [14, 14], iconAnchor: [7, 7], className: "",
        });
        const arrowMarker = L.marker([lat, lng], { icon: arrowIcon, interactive: false }).addTo(map);
        arrowMarker.setZIndexOffset(50);
        overlayLayersRef.current.push(arrowMarker);
      }

      // Below this zoom level, nearby nodes crowd together — decluttering kicks in:
      // non-last nodes drop their label card (circle only), and the last node's
      // card moves underneath its circle instead of beside it, clearing the cluster.
      const ZOOM_DECLUTTER_THRESHOLD = 12;
      const isZoomedOut = zoom < ZOOM_DECLUTTER_THRESHOLD;

      nodes.forEach((node, i) => {
        const num = String(i + 1).padStart(2, "0");
        const isLast = i === nodes.length - 1;
        const hitIndex = i - originOffset;
        const isActive = hitIndex >= 0 && activeNode === hitIndex;
        const size = isLast ? 44 : 36;
        const showCard = isLast || !isZoomedOut;
        const cardBelow = isLast && isZoomedOut;

        const circleHtml = isLast
          ? `<div style="width:${size}px;height:${size}px;aspect-ratio:1/1;flex:none;border-radius:50%;background:#5a3dfb;display:flex;align-items:center;justify-content:center;
                        font-family:'SUIT',sans-serif;font-size:14px;font-weight:700;color:white;box-shadow:0 0 0 10px rgba(90,61,251,0.15)">${num}</div>`
          : `<div style="width:${size}px;height:${size}px;aspect-ratio:1/1;flex:none;border-radius:50%;background:white;border:2px solid #5a3dfb;display:flex;align-items:center;justify-content:center;
                        font-family:'SUIT',sans-serif;font-size:13px;font-weight:700;color:#5a3dfb;
                        transform:${isActive ? "scale(1.15)" : "scale(1)"};transition:transform 0.2s;box-shadow:0 2px 6px rgba(0,0,0,0.12)">${num}</div>`;

        if (!showCard) {
          const icon = L.divIcon({ html: circleHtml, iconSize: [size, size], iconAnchor: [size / 2, size / 2], className: "" });
          const marker = L.marker([node.lat, node.lng], { icon }).addTo(map);
          marker.setZIndexOffset(i * 100);
          if (hitIndex >= 0) marker.on("click", () => onMarkerClick(hitIndex));
          overlayLayersRef.current.push(marker);
          return;
        }

        // speech-bubble tail: points at the exact geo-anchored circle center (size/2 from the icon's
        // top-left corner — true regardless of the card's own height, since both start flush at y:0).
        const tailCenterY = size / 2;
        const tailHtml = cardBelow
          ? `<div style="position:absolute;left:${size / 2 - 7}px;top:-7px;width:14px;height:14px;
                background:#5a3dfb;border-radius:3px;transform:rotate(45deg);"></div>`
          : isLast
            ? bubbleTailHtml(tailCenterY, "#5a3dfb", "#5a3dfb") // Primary/400 — solid violet arrow for the "LAST SEEN" card
            : bubbleTailHtml(tailCenterY, "white", "#e2e8f0");

        const cardHtml = isLast
          ? `<div style="position:relative;font-family:'SUIT',sans-serif;filter:drop-shadow(0 4px 10px rgba(90,61,251,0.25))">
               ${tailHtml}
               <div style="position:relative;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;border:1.5px solid #5a3dfb">
                 <div style="background:#5a3dfb;color:white;font-size:11px;font-weight:800;padding:6px 12px;display:flex;align-items:center;gap:4px;white-space:nowrap">
                   <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M6 0.5L1.5 6.5H5L4.5 10.5L9.5 4.5H6L6 0.5Z" fill="white"/></svg>
                   LAST SEEN
                 </div>
                 <div style="background:white;padding:8px 12px 10px;white-space:nowrap">
                   <div style="font-size:15px;font-weight:800;color:#0e162a">${node.label}</div>
                   <div style="font-size:13px;color:#64748a;margin-top:2px">${node.time}</div>
                 </div>
               </div>
             </div>`
          : `<div style="position:relative;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:10px 14px;white-space:nowrap;
                        font-family:'SUIT',sans-serif;box-shadow:0 4px 10px rgba(0,0,0,0.08);cursor:${hitIndex >= 0 ? "pointer" : "default"}">
               ${tailHtml}
               <div style="font-size:15px;font-weight:800;color:#0e162a">${node.label}</div>
               <div style="font-size:13px;color:#64748a;margin-top:2px">${node.time}</div>
             </div>`;

        const html = cardBelow
          ? `<div style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:10px">
               ${circleHtml}
               ${cardHtml}
             </div>`
          : `<div style="display:inline-flex;align-items:flex-start;gap:10px">
               ${circleHtml}
               ${cardHtml}
             </div>`;
        // The circle is always first in DOM order and flush to the top-left corner (align-items:flex-start
        // for the "below" layout), so its center sits at (size/2, size/2) regardless of card direction.
        const icon = L.divIcon({ html, iconSize: [1, 1], iconAnchor: [size / 2, size / 2], className: "" });
        const marker = L.marker([node.lat, node.lng], { icon }).addTo(map);
        marker.setZIndexOffset(i * 100);
        if (hitIndex >= 0) marker.on("click", () => onMarkerClick(hitIndex));
        overlayLayersRef.current.push(marker);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingActive, showStatus, activeNode, hits, zoom, mapReady, showOrigin]);

  return (
    <>
      <style>{`
        .vca-route-line {
          stroke-dasharray: 10 8;
          animation: vca-route-flow 0.9s linear infinite;
        }
        @keyframes vca-route-flow {
          to { stroke-dashoffset: -18; }
        }
      `}</style>
      <div ref={mapRef} style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#f1f5f9" }} />
    </>
  );
}
