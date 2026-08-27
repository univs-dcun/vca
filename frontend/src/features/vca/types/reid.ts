// DataPage domain — Re-ID matching and RedFace watchlist.

export type ReIDStatus = "VIP" | "Unknown" | "RedFace";
export type GenderFilter = "All" | "F" | "M";

export interface MatchItem {
  id: number;
  face: string;
  body: string;
  cam: string;
  date: string;
  time: string;
  similarity: number;
  gender: "M" | "F";
  age: string;
  plate?: string | null;
  status: ReIDStatus;
  // 데이터 연결(UV-39): 라이브 매치 전용 — 상세 팝업의 이동 경로(Track on Map)·Analyze Frame
  // 딥링크용. targetId = 감지 eventId. mock 항목에는 없다(옵셔널 → 팝업이 mock 타임라인 유지)
  targetId?: string;
  cameraId?: string;
  capturedMs?: number;
  /** matchedVip 이름 (미등록·mock이면 없음) — RedMap Trace 딥링크의 Tracing 라벨 */
  label?: string;
}
