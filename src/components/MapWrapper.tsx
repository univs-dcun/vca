"use client";

import dynamic from "next/dynamic";
import { LiveEvent, Device } from "@/lib/mockData";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

interface MapWrapperProps {
  selectedEvent?: LiveEvent | null;
  onCameraSelect?: (label: string | null) => void;
  pinnedDevice?: Device | null;
  onGoLiveCam?: (location: string) => void;
  onGoRedmapTrace?: (personName: string) => void;
}

export default function MapWrapper({ selectedEvent, onCameraSelect, pinnedDevice, onGoLiveCam, onGoRedmapTrace }: MapWrapperProps) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapView
        selectedEvent={selectedEvent}
        onCameraSelect={onCameraSelect}
        pinnedDevice={pinnedDevice}
        onGoLiveCam={onGoLiveCam}
        onGoRedmapTrace={onGoRedmapTrace}
      />
    </div>
  );
}
