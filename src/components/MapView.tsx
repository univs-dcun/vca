"use client";

import { useEffect, useRef, useState } from "react";
import { LiveEvent, Device, TrackingHop, District, DISTRICTS, getFacePhoto, formatTimeAgo } from "@/lib/mockData";
import { useVcaStore, vcaEventsToLiveEvents } from "@/lib/vcaStore";

// Leaflet popups are raw HTML strings, not React — values dropped into an inline onclick="...('...')"
// attribute need their quotes escaped so a name/label containing one can't break the attribute.
function escapeAttr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Recent-activity ping — a fixed-size dot with an expanding/fading ring around it (same visual
// as the old 100+-count zone alert), shown at every location with an actual live/tracked
// detection. Replaces the old always-on, hardcoded zone-count pills so the default map only
// ever shows where something was really just found.
const VIP_PING_COLOR = "#5a3dfb";
const TRACKING_PING_COLOR = "#16a34a";

function recentPingHtml(color: string): string {
  return `
    <div style="position:relative;width:10px;height:10px;transform:translateX(-50%) translateY(-50%)">
      <span class="vca-alert-ping" style="position:absolute;inset:0;border-radius:50%;background:${color};"></span>
      <div style="position:relative;width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid white;"></div>
    </div>`;
}

// Zoomed out (zoom <= breakpoint) shows district cluster pills (real counts, computed below);
// zoomed in past it shows the per-camera recent-activity dots instead — the same breakpoint
// idea as RedmapMap's tracking-route decluttering, just gating which layer draws at all.
const CLUSTER_ZOOM_BREAKPOINT = 14;

function nearestDistrict(lat: number, lng: number, districts: District[]): District {
  let best = districts[0];
  let bestDist = Infinity;
  for (const d of districts) {
    const dist = (d.lat - lat) ** 2 + (d.lng - lng) ** 2;
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

// Ported from RedmapMap.tsx's statusMarkerHtml() — same colors/thresholds/dashed-camera-icon —
// but driven by real computed { count, hasCamera } instead of RedmapMap's hardcoded STATUS_ZONES.
function districtPillHtml(label: string, count: number, hasCamera: boolean): string {
  const isAlert = count >= 100;
  const isDark = !isAlert && count >= 20;
  const isDashed = !hasCamera;
  let bg: string, textColor: string, border: string;
  if (isAlert)      { bg = "#f43f5e"; textColor = "white";   border = ""; }
  else if (isDark)  { bg = "#0e162a"; textColor = "white";   border = ""; }
  else if (isDashed){ bg = "white";   textColor = "#64748a"; border = "border:1.5px dashed #cbd5e1;"; }
  else              { bg = "white";   textColor = "#334155"; border = "border:1.5px solid #e2e8f0;"; }
  const camSvg = isDashed
    ? `<svg width="14" height="11" viewBox="0 0 14 11" fill="none" style="flex-shrink:0">
        <path d="M1 1L13 10" stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M6 1H2A1.5 1.5 0 0 0 0.5 2.5v5A1.5 1.5 0 0 0 2 9h9A1.5 1.5 0 0 0 11.5 7.5V5"
              stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 2L13.5 0.5V10L10 8.5"
              stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    : "";
  const labelHtml = isDashed ? label : `${label}&nbsp;&nbsp;${count}`;
  const fw = isDark || isAlert ? 700 : 600;
  const shadow = isDark || isAlert ? "0 2px 10px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.08)";
  return `<div style="transform:translateX(-50%) translateY(-50%);display:inline-flex;align-items:center;
      gap:5px;background:${bg};${border}border-radius:999px;padding:5px 12px;
      font-family:'SUIT',system-ui,sans-serif;font-size:12px;font-weight:${fw};
      color:${textColor};box-shadow:${shadow};white-space:nowrap;letter-spacing:-0.2px">
    ${camSvg}${labelHtml}</div>`;
}

function getPopupHTML(event: LiveEvent): string {
  const typeColor = event.type === "VIP" ? "#8b5cf6" : "#6d9300";
  const typeBg = event.type === "VIP" ? "#f6f6fe" : "#f6f9ec";
  const photoUrl = getFacePhoto(event.id);
  const vipBadge = event.type === "VIP"
    ? `<div style="background:#f6f6fe;border-radius:10px;padding:2px 8px;display:flex;align-items:center;gap:3px;flex-shrink:0">
         <span style="font-size:9px;font-weight:700;color:#8b5cf6">VIP</span>
       </div>`
    : `<div style="background:${typeBg};border-radius:10px;padding:2px 8px;flex-shrink:0">
         <span style="font-size:9px;font-weight:700;color:${typeColor}">${event.type.toUpperCase()}</span>
       </div>`;

  return `
    <div style="font-family:'SUIT',system-ui,sans-serif;width:256px;padding:14px 14px 12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;padding-right:18px;gap:8px">
        <div style="display:flex;align-items:flex-start;gap:5px;min-width:0">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;margin-top:1px">
            <path d="M12.5625 9.00781H15.2865C15.4143 9.00788 15.5399 9.0406 15.6515 9.10287C15.7631 9.16514 15.857 9.25489 15.9241 9.36361C15.9913 9.47233 16.0296 9.5964 16.0353 9.72407C16.0411 9.85173 16.0141 9.97875 15.957 10.0931L14.4315 13.1448C14.3737 13.2605 14.2869 13.3592 14.1796 13.4314C14.0724 13.5036 13.9483 13.5469 13.8194 13.557C13.6905 13.5671 13.5612 13.5437 13.444 13.4891C13.3268 13.4345 13.2257 13.3505 13.1505 13.2453L11.5575 11.0178" stroke="#475469" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12.8295 6.79756C13.0073 6.88655 13.1424 7.04246 13.2053 7.23105C13.2681 7.41964 13.2536 7.62547 13.1647 7.80331L10.8352 12.4616C10.7912 12.5497 10.7302 12.6282 10.6558 12.6928C10.5813 12.7573 10.4949 12.8066 10.4015 12.8377C10.308 12.8688 10.2093 12.8812 10.111 12.8742C10.0128 12.8672 9.91685 12.8409 9.82875 12.7968L2.7075 9.23281C2.19025 8.97227 1.79727 8.51745 1.61454 7.96786C1.43181 7.41828 1.47423 6.8187 1.7325 6.30031L2.7675 4.20781C2.8965 3.95073 3.07488 3.72157 3.29245 3.53344C3.51003 3.3453 3.76253 3.20187 4.03554 3.11133C4.30855 3.02079 4.59673 2.98491 4.8836 3.00576C5.17048 3.0266 5.45044 3.10376 5.7075 3.23281L12.8295 6.79756Z" stroke="#475469" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1.5 14.2578H4.32C4.59955 14.2598 4.87408 14.1835 5.11261 14.0378C5.35115 13.892 5.54421 13.6825 5.67 13.4328L6.75 11.2578" stroke="#475469" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1.5 15.7578V12.7578" stroke="#475469" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5.25 7H5.25729" stroke="#475469" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span style="font-size:12px;font-weight:800;color:#0e162a;letter-spacing:-0.24px;line-height:1.3">${event.location}${event.cameraLabel ? ` · ${event.cameraLabel}` : ""}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;margin-top:1px">
          <div style="width:6px;height:6px;background:#22c55e;border-radius:50%"></div>
          <span style="font-size:11px;color:#64748a;letter-spacing:-0.22px">${formatTimeAgo(event.timestamp)}</span>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        ${vipBadge}
        <span style="font-size:13px;font-weight:700;color:#0e162a;letter-spacing:-0.26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${event.name}</span>
      </div>

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div style="text-align:center">
          <div style="width:60px;height:60px;border-radius:8px;background:#f1f5f9;overflow:hidden">
            <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
          </div>
          <span style="font-size:10px;color:#94a3b8;display:block;margin-top:4px;letter-spacing:-0.2px">Captured</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:20px">
          <div style="width:44px;border-top:1.5px dashed #cbd5e1"></div>
          <span style="font-size:11px;font-weight:700;color:#64748a;letter-spacing:-0.22px">${event.confidence}%</span>
          <div style="width:44px;border-top:1.5px dashed #cbd5e1"></div>
        </div>
        <div style="text-align:center">
          <div style="width:60px;height:60px;border-radius:8px;background:#dde8ff;display:flex;align-items:center;justify-content:center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#818cf8" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="#818cf8" stroke-width="2"/></svg>
          </div>
          <span style="font-size:10px;color:#94a3b8;display:block;margin-top:4px;letter-spacing:-0.2px">Registered</span>
        </div>
      </div>

      <div style="background:#0e162a;border-radius:8px;height:96px;overflow:hidden;position:relative">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(14,22,42,0.8), rgba(14,22,42,0) 55%)"></div>
        <span style="position:absolute;bottom:8px;left:10px;font-size:9px;color:rgba(255,255,255,0.85);font-weight:700;letter-spacing:0.5px">CAPTURED FRAME</span>
      </div>

      <button onclick="window.__vcaGoAnalyzeFrame && window.__vcaGoAnalyzeFrame('${escapeAttr(event.location)}')"
        style="margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;
        background:#0e162a;color:white;border:none;border-radius:6px;padding:8px 0;
        font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:700;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3.5L8.5 6L4.5 8.5V3.5Z" fill="white"/></svg>
        Analyze Frame
      </button>
    </div>
  `;
}

function getMarkerHTML(type: string, photoUrl: string): string {
  const color = type === "VIP" ? "#5a3dfb" : "#6d9300";
  // VIP arrivals get a flashing glow around the pin so they're easy to spot on the map at a
  // glance — other event types keep the plain static halo.
  const flashClass = type === "VIP" ? "vca-vip-flash" : "";
  return `
    <div style="width:42px;height:56px;position:relative;display:flex;flex-direction:column;align-items:center">
      <div class="${flashClass}" style="position:absolute;left:50%;bottom:0;width:92px;height:92px;border-radius:50%;background:${color}14;transform:translate(-50%,50%);z-index:0"></div>
      <div class="${flashClass}" style="position:absolute;left:50%;bottom:0;width:60px;height:60px;border-radius:50%;background:${color}26;transform:translate(-50%,50%);z-index:0"></div>
      <div style="width:40px;height:40px;border-radius:50%;border:2.5px solid ${color};background:#f1f5f9;overflow:hidden;position:relative;z-index:2">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
      </div>
      <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:18px solid ${color};margin-top:-12px;z-index:1"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${color};margin-top:-4px;z-index:1"></div>
    </div>
  `;
}

function nearestZoneName(lat: number, lng: number, cameras: { name: string; lat: number; lng: number }[]): string {
  let best = cameras[0];
  let bestDist = Infinity;
  for (const c of cameras) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best?.name ?? "Unknown";
}

function getDevicePopupHTML(device: Device, zoneName: string): string {
  const isLive = device.status === "Live";
  return `
    <div style="font-family:'SUIT',system-ui,sans-serif;width:200px;padding:12px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:800;color:#0e162a;letter-spacing:-0.26px">${device.name}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;color:${isLive ? "#16a34a" : "#f43f5e"};background:${isLive ? "rgba(34,197,94,0.12)" : "rgba(244,63,94,0.12)"}">
          ${isLive ? "LIVE" : "OUT"}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.3 10.9C7.23 10.1 10 7.5 10 5c0-2.21-1.79-4-4-4S2 2.79 2 5c0 2.5 2.77 5.1 3.7 5.9.09.06.19.1.3.1s.21-.04.3-.1Z" stroke="#64748a" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="5" r="1.5" stroke="#64748a"/></svg>
        <span style="font-size:11px;font-weight:600;color:#475469">${zoneName}</span>
      </div>
      ${!isLive ? `
      <div style="display:flex;align-items:center;gap:5px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#f43f5e" stroke-linecap="round"/><path d="M6 3v3l2 1.5" stroke="#f43f5e" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span style="font-size:11px;font-weight:600;color:#f43f5e">Out since ${device.lastSeen}</span>
      </div>` : `
      <button onclick="window.__vcaGoLiveCam && window.__vcaGoLiveCam('${escapeAttr(zoneName)}')"
        style="margin-top:8px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;
        background:#0e162a;color:white;border:none;border-radius:6px;padding:7px 0;
        font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:700;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3.5L8.5 6L4.5 8.5V3.5Z" fill="white"/></svg>
        View Live in Best Frame
      </button>`}
    </div>
  `;
}

function getDeviceMarkerHTML(name: string, isLive: boolean): string {
  const color = isLive ? "#22c55e" : "#f43f5e";
  return `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;align-items:center;gap:5px;background:#0e162a;border-radius:999px;padding:5px 10px;box-shadow:0 2px 10px rgba(0,0,0,0.2);white-space:nowrap">
        <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <span style="font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:800;color:white;letter-spacing:-0.2px">${name}</span>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #0e162a;margin-top:-1px"></div>
    </div>
  `;
}

// Ported from RedmapMap.tsx's tracking-route rendering — reused here so a Tracking event
// selected on the Dashboard draws the same numbered-node route instead of a single pin, since
// the whole point of "Tracking" is the multi-camera path, not just one last-known point.
type CameraRef = { name: string; lat: number; lng: number };

// A TrackingHop only carries a location name (+ optional camera label), not lat/lng — resolve it
// against the registered camera list the same way the badge label is built ("Geylang" + "NC1").
function hopToLatLng(hop: TrackingHop, cameras: CameraRef[]): { lat: number; lng: number } {
  const fullName = hop.cameraLabel ? `${hop.location} ${hop.cameraLabel}` : hop.location;
  const exact = cameras.find(c => c.name === fullName) ?? cameras.find(c => c.name === hop.location);
  if (exact) return { lat: exact.lat, lng: exact.lng };
  const firstWord = hop.location.split(" ")[0];
  const partial = cameras.find(c => c.name.includes(firstWord));
  if (!partial) return { lat: cameras[0]?.lat ?? 1.3521, lng: cameras[0]?.lng ?? 103.8198 };
  // No dedicated coordinate for this specific camera label (e.g. a second camera at the same
  // site) — nudge deterministically off the site's own point so it doesn't sit exactly on top.
  const seed = hop.cameraLabel ? hop.cameraLabel.charCodeAt(hop.cameraLabel.length - 1) : 0;
  return { lat: partial.lat + (seed % 5) * 0.0015, lng: partial.lng + (seed % 3) * 0.0015 };
}

function routeBubbleTailHtml(centerY: number, fillColor: string, borderColor: string): string {
  return `<div style="position:absolute;left:-9px;top:${centerY - 8}px;width:0;height:0;
        border-top:8px solid transparent;border-bottom:8px solid transparent;border-right:9px solid ${borderColor};"></div>
     <div style="position:absolute;left:-8px;top:${centerY - 7}px;width:0;height:0;
        border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:8px solid ${fillColor};"></div>`;
}

interface MapViewProps {
  selectedEvent?: LiveEvent | null;
  onCameraSelect?: (label: string | null) => void;
  pinnedDevice?: Device | null;
  onGoLiveCam?: (location: string) => void;
  onGoRedmapTrace?: (personName: string) => void;
  onAnalyzeFrame?: (location: string) => void;
}

export default function MapView({ selectedEvent, onCameraSelect, pinnedDevice, onGoLiveCam, onGoRedmapTrace, onAnalyzeFrame }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const popupRef = useRef<unknown>(null);
  // Flips once Leaflet's async init resolves — the selectedEvent/pinnedDevice/district-cluster
  // effects below read mapInstanceRef synchronously and bail if it's still null, so without this
  // they silently no-op when data arrives on the very first mount (init hasn't resolved yet) and
  // never retry.
  const [mapReady, setMapReady] = useState(false);
  // Mirrors the map's own zoom level — read by the district-cluster/recent-activity effect to
  // decide whether to draw the zoomed-out cluster pills or the zoomed-in per-camera dots.
  const [zoom, setZoom] = useState(12);

  // Bridge for clicks inside Leaflet's raw-HTML popups (they aren't React, so they can't call
  // these handlers directly) — the popup markup calls window.__vcaGoLiveCam(...) / __vcaGoRedmapTrace(...).
  useEffect(() => {
    (window as unknown as { __vcaGoLiveCam?: (location: string) => void }).__vcaGoLiveCam = onGoLiveCam;
    (window as unknown as { __vcaGoRedmapTrace?: (name: string) => void }).__vcaGoRedmapTrace = onGoRedmapTrace;
    (window as unknown as { __vcaGoAnalyzeFrame?: (location: string) => void }).__vcaGoAnalyzeFrame = onAnalyzeFrame;
    return () => {
      delete (window as unknown as { __vcaGoLiveCam?: (location: string) => void }).__vcaGoLiveCam;
      delete (window as unknown as { __vcaGoRedmapTrace?: (name: string) => void }).__vcaGoRedmapTrace;
      delete (window as unknown as { __vcaGoAnalyzeFrame?: (location: string) => void }).__vcaGoAnalyzeFrame;
    };
  }, [onGoLiveCam, onGoRedmapTrace, onAnalyzeFrame]);
  const pinMarkerRef = useRef<unknown>(null);
  const deviceMarkerRef = useRef<unknown>(null);
  const devicePopupRef = useRef<unknown>(null);
  const zoneLayerRef = useRef<unknown>(null);
  const trackingRouteLayersRef = useRef<unknown[]>([]);
  const onCameraSelectRef = useRef(onCameraSelect);
  useEffect(() => { onCameraSelectRef.current = onCameraSelect; }, [onCameraSelect]);

  // Registered cameras' real lat/lng — the exact CCTV install point, distinct from a zone
  // marker's own (approximate, district-level) coordinate.
  const cameras = useVcaStore(s => s.cameras);
  const camerasRef = useRef(cameras);
  useEffect(() => { camerasRef.current = cameras; }, [cameras]);

  // Recently-detected locations — feeds the district-cluster/recent-activity effect below
  // directly (no ref needed there since that effect already re-runs on every change).
  const recentEvents = vcaEventsToLiveEvents(useVcaStore(s => s.events));

  // ── Map initialization ───────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const container = mapRef.current as any;
      if (container._leaflet_id) {
        delete container._leaflet_id;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [1.3521, 103.8198],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });

      if (cancelled) {
        map.remove();
        return;
      }

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

  // ── District cluster pills (zoomed out) / per-camera activity pings (zoomed in) ─
  // Zoom <= CLUSTER_ZOOM_BREAKPOINT: aggregate into district pill badges — camera counts and
  // today's VIP-hit counts, real computed data rather than the old hardcoded RedmapMap mock.
  // Zoom > breakpoint: fall back to the original per-location recent-activity dots so individual
  // detections are still identifiable once zoomed in far enough to tell sites apart.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    if (zoneLayerRef.current) {
      (zoneLayerRef.current as { remove: () => void }).remove();
      zoneLayerRef.current = null;
    }

    import("leaflet").then(({ default: L }) => {
      const group = L.layerGroup();

      if (zoom <= CLUSTER_ZOOM_BREAKPOINT) {
        // ── Zoomed out: one pill per district ──
        const today = new Date().toDateString();
        DISTRICTS.forEach((district) => {
          const camerasInDistrict = cameras.filter(c => nearestDistrict(c.lat, c.lng, DISTRICTS).id === district.id);
          const hasCamera = camerasInDistrict.length > 0;
          const count = recentEvents.filter(ev =>
            ev.type === "VIP" &&
            new Date(ev.timestamp).toDateString() === today &&
            nearestDistrict(ev.lat, ev.lng, DISTRICTS).id === district.id
          ).length;

          const icon = L.divIcon({
            html: districtPillHtml(district.label, count, hasCamera),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          L.marker([district.lat, district.lng], { icon }).addTo(group);
        });
      } else {
        // ── Zoomed in: per-location recent-activity dots (same visual as before) ──
        // Dedupe by rounded lat/lng so repeat hits at the same site (e.g. a person seen on two
        // cameras in the same zone) don't stack multiple pings on top of each other.
        const seen = new Set<string>();
        recentEvents.forEach((ev) => {
          const key = `${ev.lat.toFixed(4)},${ev.lng.toFixed(4)}`;
          if (seen.has(key)) return;
          seen.add(key);

          const color = ev.type === "Tracking" ? TRACKING_PING_COLOR : VIP_PING_COLOR;
          const icon = L.divIcon({
            html: recentPingHtml(color),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          L.marker([ev.lat, ev.lng], { icon })
            .addTo(group)
            .on("click", () => onCameraSelectRef.current?.(ev.location));
        });
      }
      group.addTo(map);
      zoneLayerRef.current = group;
    });
  }, [recentEvents, cameras, zoom, mapReady]);

  // ── Keep the map's internal canvas in sync with its container ───
  // Leaflet only measures its container once on init, so collapsing/expanding the sidebar
  // (which resizes this container without remounting it) leaves stale, cut-off tiles unless
  // told to re-measure.
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current;
    const observer = new ResizeObserver(() => {
      (mapInstanceRef.current as { invalidateSize: () => void } | null)?.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Event selection → flyTo + popup (or full route, for Tracking) ─
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    // Remove existing popup / pin marker / route
    if (popupRef.current) {
      (popupRef.current as { remove: () => void }).remove();
      popupRef.current = null;
    }
    if (pinMarkerRef.current) {
      (pinMarkerRef.current as { remove: () => void }).remove();
      pinMarkerRef.current = null;
    }
    trackingRouteLayersRef.current.forEach(l => { try { (l as { remove: () => void }).remove(); } catch { /* noop */ } });
    trackingRouteLayersRef.current = [];

    if (!selectedEvent) return;

    const hops = selectedEvent.type === "Tracking" ? selectedEvent.path : undefined;

    // Dynamically import Leaflet
    import("leaflet").then(({ default: L }) => {
      // ── Tracking: draw the full multi-camera route instead of a single pin ──
      if (hops && hops.length > 0) {
        const nodes = hops.map(h => ({ ...hopToLatLng(h, camerasRef.current), label: h.location + (h.cameraLabel ? ` ${h.cameraLabel}` : ""), time: formatTimeAgo(h.timestamp) }));

        map.flyTo([nodes[nodes.length - 1].lat, nodes[nodes.length - 1].lng], 14, { duration: 0.8, easeLinearity: 0.5 });

        const line = L.polyline(nodes.map(n => [n.lat, n.lng]), {
          color: "#5a3dfb", weight: 3, opacity: 1, lineJoin: "round", className: "vca-route-line",
        }).addTo(map);
        trackingRouteLayersRef.current.push(line);

        if (nodes.length >= 2) {
          const a = nodes[nodes.length - 2];
          const b = nodes[nodes.length - 1];
          const t = 0.35;
          const arrowLat = a.lat + (b.lat - a.lat) * t;
          const arrowLng = a.lng + (b.lng - a.lng) * t;
          const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
          const arrowIcon = L.divIcon({
            html: `<svg width="14" height="14" viewBox="0 0 14 14" style="display:block;transform:rotate(${bearing}deg)"><path d="M7 1L12.5 12H1.5Z" fill="#5a3dfb"/></svg>`,
            iconSize: [14, 14], iconAnchor: [7, 7], className: "",
          });
          const arrowMarker = L.marker([arrowLat, arrowLng], { icon: arrowIcon, interactive: false }).addTo(map);
          arrowMarker.setZIndexOffset(50);
          trackingRouteLayersRef.current.push(arrowMarker);
        }

        nodes.forEach((node, i) => {
          const num = String(i + 1).padStart(2, "0");
          const isLast = i === nodes.length - 1;
          const size = isLast ? 44 : 36;

          const circleHtml = isLast
            ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#5a3dfb;display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:14px;font-weight:700;color:white;box-shadow:0 0 0 10px rgba(90,61,251,0.15)">${num}</div>`
            : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:white;border:2px solid #5a3dfb;display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:13px;font-weight:700;color:#5a3dfb;box-shadow:0 2px 6px rgba(0,0,0,0.12)">${num}</div>`;

          const tailCenterY = size / 2;
          const tailHtml = isLast
            ? routeBubbleTailHtml(tailCenterY, "#5a3dfb", "#5a3dfb")
            : routeBubbleTailHtml(tailCenterY, "white", "#e2e8f0");

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
                     <div onclick="window.__vcaGoRedmapTrace && window.__vcaGoRedmapTrace('${escapeAttr(selectedEvent.name)}')"
                       style="margin-top:6px;padding-top:6px;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:4px;
                       font-size:12px;font-weight:700;color:#5a3dfb;cursor:pointer">
                       View Full Trace on RedMap
                       <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8" stroke="#5a3dfb" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                     </div>
                   </div>
                 </div>
               </div>`
            : `<div style="position:relative;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:10px 14px;white-space:nowrap;
                          font-family:'SUIT',sans-serif;box-shadow:0 4px 10px rgba(0,0,0,0.08)">
                 ${tailHtml}
                 <div style="font-size:15px;font-weight:800;color:#0e162a">${node.label}</div>
                 <div style="font-size:13px;color:#64748a;margin-top:2px">${node.time}</div>
               </div>`;

          const html = `<div style="display:inline-flex;align-items:flex-start;gap:10px">${circleHtml}${cardHtml}</div>`;
          const icon = L.divIcon({ html, iconSize: [1, 1], iconAnchor: [size / 2, size / 2], className: "" });
          const marker = L.marker([node.lat, node.lng], { icon }).addTo(map);
          marker.setZIndexOffset(i * 100);
          trackingRouteLayersRef.current.push(marker);
        });
        return;
      }

      // ── VIP (or Tracking with no path data): single pin + detail popup ──
      const { lat, lng } = selectedEvent;

      map.flyTo([lat, lng], 15, { duration: 0.8, easeLinearity: 0.5 });

      const pinIcon = L.divIcon({
        html: getMarkerHTML(selectedEvent.type, getFacePhoto(selectedEvent.id)),
        iconSize: [42, 56],
        iconAnchor: [21, 50],
        className: "",
      });
      const pinMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      pinMarkerRef.current = pinMarker;

      const popup = L.popup({
        offset: [0, -58],
        className: "vca-custom-popup",
        closeButton: true,
        autoPan: false,
        maxWidth: 280,
      })
        .setLatLng([lat, lng])
        .setContent(getPopupHTML(selectedEvent))
        .openOn(map);
      popupRef.current = popup;

      popup.on("remove", () => {
        if (pinMarkerRef.current) {
          (pinMarkerRef.current as { remove: () => void }).remove();
          pinMarkerRef.current = null;
        }
      });
    });
  }, [selectedEvent, mapReady]);

  // ── Pinned device (SYSTEM tab) → flyTo + marker ────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    if (deviceMarkerRef.current) {
      (deviceMarkerRef.current as { remove: () => void }).remove();
      deviceMarkerRef.current = null;
    }
    if (devicePopupRef.current) {
      (devicePopupRef.current as { remove: () => void }).remove();
      devicePopupRef.current = null;
    }

    if (!pinnedDevice) return;

    import("leaflet").then(({ default: L }) => {
      const { lat, lng } = pinnedDevice;
      map.flyTo([lat, lng], 15, { duration: 0.8, easeLinearity: 0.5 });

      const icon = L.divIcon({
        html: getDeviceMarkerHTML(pinnedDevice.name, pinnedDevice.status === "Live"),
        iconSize: [1, 1],
        iconAnchor: [0, 24],
        className: "",
      });
      deviceMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);

      const zoneName = nearestZoneName(lat, lng, camerasRef.current);
      const popup = L.popup({
        offset: [0, -30], className: "vca-custom-popup", closeButton: true, autoPan: false, maxWidth: 220,
      })
        .setLatLng([lat, lng])
        .setContent(getDevicePopupHTML(pinnedDevice, zoneName))
        .openOn(map);
      devicePopupRef.current = popup;
    });
  }, [pinnedDevice, mapReady]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    />
  );
}
