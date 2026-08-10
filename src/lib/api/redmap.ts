// Redmap domain — person/vehicle search hit results.
// Currently returns the static mock data defined in RedmapPage.tsx.
// Swap the body of this function for a real fetch(`${API_BASE_URL}/...`) call later.

import { MOCK_RESULTS } from "@/components/RedmapPage";
import { mockDelay } from "./client";

export async function getHitResults() {
  return mockDelay(MOCK_RESULTS);
}
