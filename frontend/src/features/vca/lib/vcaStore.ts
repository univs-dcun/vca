import { create } from "zustand";
import { liveEvents, getFacePhoto, DISTRICTS, type EventType, type LiveEvent, type TrackingHop } from "./mockData";

// Deterministic pseudo-random in [0,1) — same formula as mockData.ts's own seededRandom — used
// below to bulk-generate cameras without Math.random(), which would differ between the
// server-rendered and client-hydrated pass and trigger a hydration mismatch.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export type CameraStatus = "online" | "offline";

export interface Organization {
  id: string;
  name: string;
  region: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
}

export interface Camera {
  id: string;
  projectId: string;
  code: string;
  name: string;
  ip: string;
  mac: string;
  rtspUrl: string;
  status: CameraStatus;
  location: string;
  zone: string;
  thumbnail: string;
  lat: number;
  lng: number;
  /** 마지막 상태 수신 시각(ISO) — 실데이터(MQTT status) 카메라에만 존재, mock 시드에는 없음 */
  lastSeenAt?: string;
}

export type EventSeverity = "critical" | "warning" | "info";

export interface VcaEvent {
  id: string;
  cameraId: string;
  type: string;
  severity: EventSeverity;
  timestamp: string;
  // Detection-result fields — optional so DataPage's existing addEvent({cameraId, type, severity,
  // timestamp}) call still type-checks; populated when the event comes from a person match (VIP/
  // Tracking hit) rather than a generic system event.
  personId?: string;
  personName?: string;
  personDescription?: string;
  personType?: EventType;
  confidence?: number;
  location?: string;
  cameraLabel?: string;
  personPath?: TrackingHop[];
  lat?: number;
  lng?: number;
  photoUrl?: string;
}

// Person = the VIP/watchlist registry. Portal (a separate app) owns registration/CRUD for this —
// VCA only consumes it, so this store holds it as a read cache to be kept in sync from Portal's
// API later, not something VCA's own UI writes to.
export interface Person {
  id: string;
  name: string;
  type: EventType;
  photoUrl: string;
  registeredAt: string;
  description?: string;
}

interface VcaStoreState {
  organizations: Organization[];
  projects: Project[];
  cameras: Camera[];
  persons: Person[];
  events: VcaEvent[];
  // Notifications (header bell) only care about VIP-match events from this point forward —
  // events seeded at load are historical and start out already "read".
  lastReadNotifAt: string;
  setCameraStatus: (cameraId: string, status: CameraStatus) => void;
  addCamera: (camera: Omit<Camera, "id">) => void;
  addProject: (project: Omit<Project, "id">) => void;
  addPerson: (person: Omit<Person, "id">) => void;
  addEvent: (event: Omit<VcaEvent, "id">) => void;
  markNotificationsRead: () => void;
}

const ORGANIZATIONS: Organization[] = [
  { id: "org-univs", name: "UNIVS Smart City Control Center", region: "Singapore" },
];

const PROJECTS: Project[] = [
  { id: "proj-sg", orgId: "org-univs", name: "Singapore Smart City Control Project" },
];

const CAMERAS: Camera[] = [
  {
    id: "cam-novena", projectId: "proj-sg", code: "CAM-NOV-001", name: "Novena",
    ip: "10.20.4.11", mac: "00:1B:44:11:3A:B7", rtspUrl: "rtsp://10.20.4.11:554/stream1",
    status: "online", location: "Novena, Singapore", zone: "Novena",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.3202, lng: 103.8440,
  },
  {
    id: "cam-geylang", projectId: "proj-sg", code: "CAM-GEY-001", name: "Geylang NC1",
    ip: "10.20.4.12", mac: "00:1B:44:11:3A:B8", rtspUrl: "rtsp://10.20.4.12:554/stream1",
    status: "online", location: "Geylang NC1, Singapore", zone: "Geylang",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3148, lng: 103.8778,
  },
  {
    id: "cam-orchard", projectId: "proj-sg", code: "CAM-ORC-001", name: "Orchard MRT",
    ip: "10.20.4.13", mac: "00:1B:44:11:3A:B9", rtspUrl: "rtsp://10.20.4.13:554/stream1",
    status: "online", location: "Orchard MRT, Singapore", zone: "Orchard",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.3044, lng: 103.8321,
  },
  {
    id: "cam-bugis", projectId: "proj-sg", code: "CAM-BGS-001", name: "Bugis MRT",
    ip: "10.20.4.14", mac: "00:1B:44:11:3A:BA", rtspUrl: "rtsp://10.20.4.14:554/stream1",
    status: "online", location: "Bugis MRT, Singapore", zone: "Bugis",
    thumbnail: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    lat: 1.3006, lng: 103.8561,
  },
  {
    id: "cam-tampines", projectId: "proj-sg", code: "CAM-TPS-001", name: "Tampines Hub",
    ip: "10.20.4.15", mac: "00:1B:44:11:3A:BB", rtspUrl: "rtsp://10.20.4.15:554/stream1",
    status: "online", location: "Tampines Hub, Singapore", zone: "Tampines",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.3528, lng: 103.9440,
  },
  {
    id: "cam-bedok", projectId: "proj-sg", code: "CAM-BDK-001", name: "Bedok MRT",
    ip: "10.20.4.16", mac: "00:1B:44:11:3A:BC", rtspUrl: "rtsp://10.20.4.16:554/stream1",
    status: "offline", location: "Bedok MRT, Singapore", zone: "Bedok",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3240, lng: 103.9302,
  },
  {
    id: "cam-queenstown", projectId: "proj-sg", code: "CAM-QTN-001", name: "Queenstown",
    ip: "10.20.4.17", mac: "00:1B:44:11:3A:BD", rtspUrl: "rtsp://10.20.4.17:554/stream1",
    status: "online", location: "Queenstown, Singapore", zone: "Queenstown",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.2942, lng: 103.8060,
  },
  {
    id: "cam-jurong-east", projectId: "proj-sg", code: "CAM-JRE-001", name: "Jurong East",
    ip: "10.20.4.18", mac: "00:1B:44:11:3A:BE", rtspUrl: "rtsp://10.20.4.18:554/stream1",
    status: "offline", location: "Jurong East, Singapore", zone: "Jurong East",
    thumbnail: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    lat: 1.3329, lng: 103.7436,
  },
  // Bulk-generated, deterministic (seededRandom, not Math.random — see above) — one small batch
  // per district so the Dashboard map's zoomed-out cluster pills have real, non-zero counts to
  // aggregate instead of showing mostly-empty districts. Kept in the 50-60 total camera range on
  // purpose: DataPage's LiveMonitoringTab seeds 120 live-feed items per camera and ticks one
  // addEvent per online camera every few seconds, so going into the hundreds would make that
  // "All Cameras" view and the per-tick store updates too heavy.
  ...DISTRICTS.flatMap((district, di) => {
    const thumbnails = [
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    ];
    const camCount = Math.floor(seededRandom(di * 4.13 + 9) * 7); // 0–6 cameras in this district
    return Array.from({ length: camCount }, (_, j) => {
      const idx = di * 6 + j; // stable per-camera seed base, unique across all districts
      const isOnline = seededRandom(idx * 8.17 + 2) > 0.1; // ~90% online
      const jitterLat = (seededRandom(idx * 3.31 + 3) - 0.5) * 0.02; // ±0.01°, ~±1km
      const jitterLng = (seededRandom(idx * 5.71 + 4) - 0.5) * 0.02;
      return {
        id: `cam-bulk-${idx}`,
        projectId: "proj-sg",
        code: `CAM-BLK-${String(idx).padStart(3, "0")}`,
        name: `${district.label} ${j + 1}`,
        ip: `10.30.${1 + (idx >> 8)}.${idx % 256}`,
        mac: `00:1B:44:22:${String(10 + (idx % 90)).padStart(2, "0")}:${String(idx % 100).padStart(2, "0")}`,
        rtspUrl: `rtsp://10.30.${1 + (idx >> 8)}.${idx % 256}:554/stream1`,
        status: (isOnline ? "online" : "offline") as CameraStatus,
        location: district.label,
        zone: district.label,
        thumbnail: thumbnails[idx % thumbnails.length],
        lat: Math.round((district.lat + jitterLat) * 10000) / 10000,
        lng: Math.round((district.lng + jitterLng) * 10000) / 10000,
      };
    });
  }),
];

// A separate, much larger camera pool that only the VIP-detection simulator (VipAlertTicker in
// ClientLayout.tsx) picks from — NOT part of the `cameras` store state above, and not rendered as
// a device list anywhere. Deliberately kept out of `CAMERAS`: that array is capped around 50-60 on
// purpose (see the comment there) because LiveMonitoringTab seeds 120 feed items per camera and
// ticks an addEvent per online camera every 4s, so a 1,000-entry `cameras` store would make that
// feature very heavy. This pool exists purely so the Dashboard's VIP simulation feels like it's
// running across the smart city's real ~1,000-camera deployment, without that cost.
export const VIP_SIMULATION_CAMERAS: Camera[] = DISTRICTS.flatMap((district, di) => {
  const thumbnails = [
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
  ];
  const camCount = 58 + Math.floor(seededRandom(di * 7.77 + 50000) * 6); // ~58-63 per district, ~1,000 total across 17 districts
  return Array.from({ length: camCount }, (_, j) => {
    const idx = 50000 + di * 100 + j; // large offset keeps ids/seeds distinct from CAMERAS's own bulk pool
    const isOnline = seededRandom(idx * 8.17 + 2) > 0.1; // ~90% online, same ratio as the small pool
    const jitterLat = (seededRandom(idx * 3.31 + 3) - 0.5) * 0.02;
    const jitterLng = (seededRandom(idx * 5.71 + 4) - 0.5) * 0.02;
    return {
      id: `cam-sim-${idx}`,
      projectId: "proj-sg",
      code: `CAM-SIM-${String(idx).padStart(5, "0")}`,
      name: `${district.label} ${j + 1}`,
      ip: `10.40.${1 + (idx >> 8)}.${idx % 256}`,
      mac: `00:1B:44:33:${String(10 + (idx % 90)).padStart(2, "0")}:${String(idx % 100).padStart(2, "0")}`,
      rtspUrl: `rtsp://10.40.${1 + (idx >> 8)}.${idx % 256}:554/stream1`,
      status: (isOnline ? "online" : "offline") as CameraStatus,
      location: district.label,
      zone: district.label,
      thumbnail: thumbnails[idx % thumbnails.length],
      lat: Math.round((district.lat + jitterLat) * 10000) / 10000,
      lng: Math.round((district.lng + jitterLng) * 10000) / 10000,
    };
  });
});

function cameraIdForLocation(location: string): string {
  return CAMERAS.find(c => c.name === location)?.id ?? CAMERAS[0].id;
}

// Seeded from mockData's liveEvents — the ONE raw event list — so the store starts already
// consistent with what the Dashboard/Sidebar show, instead of inventing a second baseline.
const SEED_EVENTS: VcaEvent[] = liveEvents.map((e) => ({
  id: `evt-seed-${e.id}`,
  cameraId: cameraIdForLocation(e.location),
  type: e.type === "VIP" ? "VIP Match" : "Tracking Detection",
  severity: e.type === "VIP" ? "warning" : "info",
  timestamp: e.timestamp,
  personId: e.id,
  personName: e.name,
  personDescription: e.description,
  personType: e.type,
  confidence: e.confidence,
  location: e.location,
  cameraLabel: e.cameraLabel,
  personPath: e.path,
  lat: e.lat,
  lng: e.lng,
  photoUrl: getFacePhoto(e.id),
}));

// Registration metadata for the VIP registry — not present on the raw mockData events (those are
// detections, not registrations), so it's seeded here per known name until Portal's real API lands.
const PERSON_REGISTRY_INFO: Record<string, { registeredAt: string; description: string }> = {
  "Alexander Wright": { registeredAt: "2026-03-14", description: "Corporate Security — Executive Protection" },
  "Priya Nair":        { registeredAt: "2026-05-02", description: "VIP Watchlist — Frequent Visitor" },
};

export const PERSONS: Person[] = (() => {
  const seen = new Set<string>();
  const persons: Person[] = [];
  liveEvents.forEach((e) => {
    // Tracking events are anonymous re-id trails, not identified individuals — they don't
    // belong in the Person/VIP registry.
    if (e.type === "Tracking" || seen.has(e.name)) return;
    seen.add(e.name);
    const info = PERSON_REGISTRY_INFO[e.name];
    persons.push({
      id: `person-${e.id}`,
      name: e.name,
      type: e.type,
      photoUrl: getFacePhoto(e.id),
      registeredAt: info?.registeredAt ?? "2026-01-01",
      description: info?.description,
    });
  });
  return persons;
})();

let cameraSeq = CAMERAS.length;
let projectSeq = PROJECTS.length;
let personSeq = PERSONS.length;
let eventSeq = SEED_EVENTS.length;

// Latest seed timestamp — anything at or before this is historical, so the bell starts with
// nothing unread instead of surfacing all 12 seed VIP hits as "new" on first load.
const LATEST_SEED_TIMESTAMP = SEED_EVENTS.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), "");

// A real recognition engine re-fires repeatedly while the same person lingers in one camera's
// frame — that's one continuous sighting, not N separate visits, so those re-fires should update
// the existing history row (bump its "last seen" time) rather than spam the list with duplicates.
// Only a gap LONGER than this counts as the person genuinely leaving and reappearing later, which
// still logs as a brand-new row (this window is intentionally short — a few minutes apart is a
// real second visit, not the same dwell).
const VIP_SESSION_WINDOW_MS = 2 * 60 * 1000;

interface LiveHit { location: string; cameraLabel?: string; timestamp: string; confidence: number; lat: number; lng: number }

function hitCameraKey(h: { cameraLabel?: string; location?: string }): string {
  return `${h.location ?? ""}::${h.cameraLabel ?? ""}`;
}

// Same grouping rule as mockData.ts's deriveLiveEvents (2+ distinct cameras -> one collapsed
// Tracking row), but applied incrementally so it also covers events added live via addEvent, not
// just the static seed data. A person's full hit history lives disassembled across their current
// event rows — a Tracking row's `personPath` for older hits, plain VIP rows for anything not yet
// promoted — and gets rebuilt every time a new hit comes in for them.
function personHitHistory(events: VcaEvent[], personName: string): LiveHit[] {
  const hits: LiveHit[] = [];
  events.filter(e => e.personName === personName).forEach(e => {
    if (e.personType === "Tracking" && e.personPath) {
      hits.push(...e.personPath.map(p => ({ location: p.location, cameraLabel: p.cameraLabel, timestamp: p.timestamp, confidence: 0, lat: e.lat ?? 0, lng: e.lng ?? 0 })));
    } else {
      hits.push({ location: e.location ?? "", cameraLabel: e.cameraLabel, timestamp: e.timestamp, confidence: e.confidence ?? 0, lat: e.lat ?? 0, lng: e.lng ?? 0 });
    }
  });
  return hits.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export const useVcaStore = create<VcaStoreState>((set) => ({
  organizations: ORGANIZATIONS,
  projects: PROJECTS,
  cameras: CAMERAS,
  persons: PERSONS,
  events: SEED_EVENTS,
  lastReadNotifAt: LATEST_SEED_TIMESTAMP,
  setCameraStatus: (cameraId, status) =>
    set(state => ({ cameras: state.cameras.map(c => (c.id === cameraId ? { ...c, status } : c)) })),
  addCamera: (camera) =>
    set(state => ({ cameras: [...state.cameras, { ...camera, id: `cam-${++cameraSeq}` }] })),
  addProject: (project) =>
    set(state => ({ projects: [...state.projects, { ...project, id: `proj-${++projectSeq}` }] })),
  addPerson: (person) =>
    set(state => ({ persons: [...state.persons, { ...person, id: `person-${++personSeq}` }] })),
  addEvent: (event) =>
    set(state => {
      if (!event.personName || !event.location) {
        return { events: [{ ...event, id: `evt-${++eventSeq}` }, ...state.events].slice(0, 500) };
      }

      const personName = event.personName;
      const otherEvents = state.events.filter(e => e.personName !== personName);
      const history = personHitHistory(state.events, personName);
      const newHit: LiveHit = { location: event.location, cameraLabel: event.cameraLabel, timestamp: event.timestamp, confidence: event.confidence ?? 0, lat: event.lat ?? 0, lng: event.lng ?? 0 };

      // Session-merge against only the MOST RECENT prior hit, and only if it's the same camera —
      // a return visit after being seen elsewhere in between must NOT merge into that older
      // same-camera hit, since the person genuinely left and came back (that gap is exactly what
      // makes it a trackable path rather than one long dwell).
      const last = history[history.length - 1];
      if (last && hitCameraKey(last) === hitCameraKey(newHit) &&
          Math.abs(new Date(newHit.timestamp).getTime() - new Date(last.timestamp).getTime()) <= VIP_SESSION_WINDOW_MS) {
        history[history.length - 1] = newHit;
      } else {
        history.push(newHit);
      }

      const distinctCameras = new Set(history.map(hitCameraKey));
      let personEvents: VcaEvent[];
      if (distinctCameras.size >= 2) {
        // 2+ distinct cameras — collapse this person's entire history into one Tracking row
        // (replaces whatever VIP/Tracking rows they had before), same rule as mockData.ts's
        // deriveLiveEvents for the static seed data.
        const latest = history[history.length - 1];
        personEvents = [{
          ...event,
          id: `evt-${++eventSeq}`,
          personType: "Tracking",
          location: latest.location,
          cameraLabel: latest.cameraLabel,
          timestamp: latest.timestamp,
          lat: latest.lat,
          lng: latest.lng,
          confidence: 0,
          personPath: history.map(h => ({ location: h.location, cameraLabel: h.cameraLabel, timestamp: h.timestamp })),
        }];
      } else {
        // Still only ever seen at one camera — one VIP row per (session-merged) hit.
        personEvents = history.map(h => ({
          ...event,
          id: `evt-${++eventSeq}`,
          personType: "VIP",
          location: h.location, cameraLabel: h.cameraLabel, timestamp: h.timestamp, confidence: h.confidence, lat: h.lat, lng: h.lng,
        }));
      }

      return { events: [...personEvents, ...otherEvents].slice(0, 500) };
    }),
  markNotificationsRead: () => set({ lastReadNotifAt: new Date().toISOString() }),
}));

// Converts store events back into the Dashboard/Sidebar's LiveEvent shape. Only events carrying
// person-match info (personType set) are person detections — generic camera/system events (e.g.
// a bare online/offline ping) have nothing to show here and are skipped.
export function vcaEventsToLiveEvents(events: VcaEvent[]): LiveEvent[] {
  return events
    .filter((e): e is VcaEvent & { personType: EventType } => e.personType !== undefined)
    .map((e) => ({
      id: e.personId ?? e.id,
      name: e.personName ?? "Unknown",
      description: e.personDescription,
      confidence: e.confidence ?? 0,
      location: e.location ?? "",
      cameraLabel: e.cameraLabel,
      path: e.personPath,
      photoUrl: e.photoUrl,
      timestamp: e.timestamp,
      type: e.personType,
      lat: e.lat ?? 0,
      lng: e.lng ?? 0,
    }));
}
