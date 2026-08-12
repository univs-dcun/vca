// Dashboard domain — stats, live events, devices, map markers.
// Currently returns the static mock data from lib/mockData.ts.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { dashboardStats, liveEvents, devices, mapMarkers, DISTRICTS, hourlyDetections } from "@/lib/mockData";
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

export async function getHourlyDetections() {
  return mockDelay(hourlyDetections);
}
