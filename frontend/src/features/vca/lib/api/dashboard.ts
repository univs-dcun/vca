// Dashboard domain — stats, live events, devices, map markers.
// Currently returns the static mock data from lib/mockData.ts.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { dashboardStats, liveEvents, devices, mapMarkers, DISTRICTS, hourlyDetections, type HourlyDetection } from "@/lib/mockData";
import { mockDelay } from "./client";

export async function getDashboardStats() {
  return mockDelay(dashboardStats);
}

export async function getLiveEvents() {
  return mockDelay(liveEvents);
}

export async function getDevices() {
  return mockDelay(devices);
}

export async function getMapMarkers() {
  return mockDelay(mapMarkers);
}

// The district boundaries/labels a deployment groups its cameras into for the map's cluster
// pills — real reference data a backend would own, unlike `nearestDistrict()` (a pure geometry
// helper that stays a plain sync import since there's nothing to fetch for it).
export async function getDistricts() {
  return mockDelay(DISTRICTS);
}

// Deterministic pseudo-random in [0,1) — same formula used elsewhere in the mock layer, so a
// given camera always scales to the same reproducible fraction of the citywide series instead of
// a different one on every refetch.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Stand-in for a real per-camera aggregation query. A single camera only ever sees a fraction of
// the citywide total; this fakes that fraction from the camera's id so switching back to the same
// camera reproduces the same-looking curve. A real backend replaces this whole function body with
// an actual "detections WHERE camera_id = ?" aggregation — the `cameraId` parameter below is the
// real, permanent part of the contract; only what happens inside when it's set is fake.
function mockCameraScale(cameraId: string): number {
  const seed = cameraId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 0.12 + seededRandom(seed) * 0.22;
}

// cameraId omitted (or undefined) = citywide totals, exactly like every other resource here.
// Passing one is expected to return that camera's own hourly series, not the citywide one scaled
// on the client — DetectionActivityChart used to do that scaling itself, which meant the "per
// camera" view wasn't actually asking the backend for anything camera-specific.
export async function getHourlyDetections(cameraId?: string): Promise<HourlyDetection[]> {
  if (!cameraId) return mockDelay(hourlyDetections);
  const scale = mockCameraScale(cameraId);
  const scaled = hourlyDetections.map(h => ({
    hour: h.hour,
    count: Math.round(h.count * scale),
    vipCount: Math.round(h.vipCount * scale),
  }));
  return mockDelay(scaled);
}
