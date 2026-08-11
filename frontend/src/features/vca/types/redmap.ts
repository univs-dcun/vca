// RedmapPage domain — person/vehicle search hits.

export type RedmapMode = "person" | "car";
export type SimilarityLimit = 30 | 50 | 70 | 90;

export interface HitResult {
  id: string;
  camera: string;
  location: string;
  date: string;
  time: string;
  score: string;
  bodyScore: string;
  isUnregistered: boolean;
  faceUrl: string;
  bodyUrl: string;
  mapLabel: string;
  lat: number;
  lng: number;
  elapsed?: string;
  elapsedAlert?: boolean;
}

export interface DateRange {
  start: string | null;
  end: string | null;
}
