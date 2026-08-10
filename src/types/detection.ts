// Shared between BestFramePage and BestFrameDetailPage — was duplicated in both files.

export type DetType = "VIP" | "Vehicle" | "Unknown";
export type MonitorState = "normal" | "active" | "alert";

export interface Camera {
  id: string;
  name: string;
  checked: boolean;
  monitor: MonitorState;
}

export interface Detection {
  id: string;
  type: DetType;
  name: string;
  group: string;
  confidence: number;
  time: string;
  top: string;
  left: string;
  width: string;
  height: string;
}

export interface CamData {
  camLabel: string;
  location: string;
  bgUrl?: string;
  detections: Detection[];
}

export interface HUDState {
  det: Detection;
  camId: string;
  location: string;
  camLabel: string;
  x: number;
  y: number;
}
