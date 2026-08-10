// Dashboard domain — stats, live events, devices, map markers.
// Currently returns the static mock data from lib/mockData.ts.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { dashboardStats, liveEvents, devices, mapMarkers } from "@/lib/mockData";
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
