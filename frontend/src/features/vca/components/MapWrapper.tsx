
// Next.js에서는 Leaflet SSR 회피를 위해 next/dynamic을 썼지만, Vite SPA에서는 직접 import한다.
import MapView from "./MapView";
import type { LiveEvent, Device } from "../lib/mockData";

interface MapWrapperProps {
  selectedEvent?: LiveEvent | null;
  onCameraSelect?: (label: string | null) => void;
  pinnedDevice?: Device | null;
  onGoLiveCam?: (location: string) => void;
  onGoRedmapTrace?: (personName: string) => void;
  onAnalyzeFrame?: (location: string) => void;
}

export default function MapWrapper({ selectedEvent, onCameraSelect, pinnedDevice, onGoLiveCam, onGoRedmapTrace, onAnalyzeFrame }: MapWrapperProps) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapView
        selectedEvent={selectedEvent}
        onCameraSelect={onCameraSelect}
        pinnedDevice={pinnedDevice}
        onGoLiveCam={onGoLiveCam}
        onGoRedmapTrace={onGoRedmapTrace}
        onAnalyzeFrame={onAnalyzeFrame}
      />
    </div>
  );
}
