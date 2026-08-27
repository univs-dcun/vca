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
  /** AI 분석 태그 (라이브, 계약 v1.5 — Analyze Frame). 없으면 화면이 mock ATTRS로 폴백 */
  analysis?: { basic: string[]; top: string[]; bottom: string[]; addons: string[] };
  /** 인물 성별 (라이브, 계약 v1.5). 미상·차량이면 undefined */
  gender?: "male" | "female";
}

export interface CamData {
  camLabel: string;
  location: string;
  bgUrl?: string;
  /** 업로드 비디오 타일 (라이브, 계약 v1.3 — vca-bridge가 공급). 있으면 bgUrl 대신 video로 재생 */
  videoUrl?: string;
  /** 카메라 실시간 스트림 (라이브, 계약 v0.9.0 — vca-bridge가 공급, UV-43). 있으면 bestframe 대신 WHEP 재생, 실패 시 bgUrl 폴백 */
  streamUrl?: string | null;
  /** 업로드 비디오 촬영 시작 시각 (라이브, 계약 v1.5) — Analyze Frame의 절대 시각 축 */
  recordedAt?: string;
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
