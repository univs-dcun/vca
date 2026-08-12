// Best Frame domain — camera feeds and detections.
// Currently returns the static mock data defined in BestFramePage.tsx.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { CAM_DATA, DEFAULT_DATA, NORMAL_CAMS_INIT, VIDEO_CAMS_INIT, IMAGE_CAMS_INIT } from "@/components/BestFramePage";
import { mockDelay } from "./client";

export async function getCamData() {
  return mockDelay(CAM_DATA);
}

export async function getDefaultCamData() {
  return mockDelay(DEFAULT_DATA);
}

export async function getNormalCams() {
  return mockDelay(NORMAL_CAMS_INIT);
}

export async function getVideoCams() {
  return mockDelay(VIDEO_CAMS_INIT);
}

export async function getImageCams() {
  return mockDelay(IMAGE_CAMS_INIT);
}
