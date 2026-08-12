// Re-ID / RedFace domain — face-body match results and Re-ID analysis rows.
// Currently returns the static mock data defined in DataPage.tsx.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { MATCH_DATA, REID_DATA } from "@/components/DataPage";
import { mockDelay } from "./client";

export async function getMatchItems() {
  return mockDelay(MATCH_DATA);
}

export async function getReIDRows() {
  return mockDelay(REID_DATA);
}
