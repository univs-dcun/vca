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
  /** 감지 시점 크롭 이미지 (라이브 — vca-bridge가 공급). 없으면 화면이 mock 아바타로 폴백 */
  snapshotUrl?: string;
  /** 등록 인물 DB 사진 (라이브, VIP·Staff 매칭 시). 없으면 mock 사진/NO DB MATCH 폴백 */
  enrolledPhotoUrl?: string;
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
