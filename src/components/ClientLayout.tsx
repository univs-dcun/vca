"use client";

import { useEffect, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MapWrapper from "./MapWrapper";
import BestFramePage from "./BestFramePage";
import DataPage from "./DataPage";
import RedmapPage from "./RedmapPage";
import SkeletonDashboard from "./SkeletonDashboard";
import SkeletonBestFrame from "./SkeletonBestFrame";
import SkeletonData from "./SkeletonData";
import SkeletonRedmap from "./SkeletonRedmap";
import DetectionActivityChart from "./DetectionActivityChart";
import { ToastProvider } from "./Toast";
import { LiveEvent, Device } from "@/lib/mockData";

export type NavTab = "DASHBOARD" | "BEST FRAME" | "DATA" | "REDMAP";
const VALID_TABS: NavTab[] = ["DASHBOARD", "BEST FRAME", "DATA", "REDMAP"];

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  // Right-pointing triangle = "펼치기" (expand, shown while collapsed); left-pointing = "접기"
  // (collapse, shown while expanded) — same box+shadow shell either way, just the triangle flips.
  const trianglePath = collapsed ? "M19 29L13 23.8038L13 34.1962L19 29Z" : "M11 29L17 23.8038L17 34.1962L11 29Z";
  const filterId = collapsed ? "sidebar-toggle-shadow-expand" : "sidebar-toggle-shadow-collapse";
  return (
    <svg width="34" height="62" viewBox="0 0 34 62" fill="none">
      <g filter={`url(#${filterId})`}>
        <path d="M3 1H19C25.6274 1 31 6.37258 31 13V45C31 51.6274 25.6274 57 19 57H3V1Z" fill="white"/>
        <path d={trianglePath} fill="#475469"/>
      </g>
      <defs>
        <filter id={filterId} x="0" y="0" width="34" height="62" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dy="2"/>
          <feGaussianBlur stdDeviation="1.5"/>
          <feComposite in2="hardAlpha" operator="out"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0"/>
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
        </filter>
      </defs>
    </svg>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "12px", backgroundColor: "#f8fafc",
    }}>
      <span style={{ fontSize: "32px", color: "#e2e8f0" }}>⚙️</span>
      <span style={{ fontSize: "18px", fontWeight: 700, color: "#94a3b8" }}>
        {title} — Coming Soon
      </span>
    </div>
  );
}

export default function ClientLayout() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const initialTab = (VALID_TABS as string[]).includes(tabParam ?? "") ? (tabParam as NavTab) : "DASHBOARD";
  const [activePage, setActivePageState] = useState<NavTab>(initialTab);
  const setActivePage = (tab: NavTab) => {
    setActivePageState(tab);
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  };
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [pinnedDevice, setPinnedDevice] = useState<Device | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDetectionChart, setShowDetectionChart] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [bestFrameFocusLocation, setBestFrameFocusLocation] = useState<string | null>(null);
  const [redmapAutoSearchName, setRedmapAutoSearchName] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);
  const handleGoLiveCam = (location: string) => {
    setBestFrameFocusLocation(location);
    setActivePage("BEST FRAME");
  };
  const handleGoRedmapTrace = (personName: string) => {
    setRedmapAutoSearchName(personName);
    setActivePage("REDMAP");
  };

  return (
    <ToastProvider>
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar activeTab={activePage} onTabChange={setActivePage} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {isLoading ? (
          <>
            {activePage === "DASHBOARD" && <SkeletonDashboard />}
            {activePage === "BEST FRAME" && <SkeletonBestFrame />}
            {activePage === "DATA" && <SkeletonData />}
            {activePage === "REDMAP" && <SkeletonRedmap />}
          </>
        ) : activePage === "DASHBOARD" && (
          <>
            <Sidebar
              isCollapsed={sidebarCollapsed}
              onEventSelect={setSelectedEvent}
              selectedEventId={selectedEvent?.id}
              locationFilter={locationFilter}
              onLocationClear={() => setLocationFilter(null)}
              onLocationSelect={(loc) => setLocationFilter(loc)}
              onPinDevice={setPinnedDevice}
              pinnedDeviceId={pinnedDevice?.id ?? null}
              onToggleDetectionChart={() => setShowDetectionChart(v => !v)}
            />
            {/* Map area */}
            <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
              <MapWrapper
                selectedEvent={selectedEvent}
                onCameraSelect={(label) => setLocationFilter((prev) => (prev === label ? null : label))}
                pinnedDevice={pinnedDevice}
                onGoLiveCam={handleGoLiveCam}
                onGoRedmapTrace={handleGoRedmapTrace}
              />
              {/* Sidebar toggle button - absolutely positioned over the map. Shifted -3px: the
                  SidebarToggleIcon's pill shape starts at x=3 within its own 34px-wide viewBox
                  (padding for its drop shadow), so left:0 left a 3px sliver of the map's gray
                  background showing between the sidebar's edge and the button. */}
              <div
                onClick={() => setSidebarCollapsed(c => !c)}
                style={{
                  position: "absolute", top: "50%", left: "-3px",
                  transform: "translateY(-50%)",
                  zIndex: 1000,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <SidebarToggleIcon collapsed={sidebarCollapsed} />
              </div>
              {/* Detection activity chart — floating, semi-transparent overlay so the map shows
                  through behind it, rather than a separate opaque section below the map.
                  Toggles from clicking "Today's detections" in the sidebar, or minimizes down
                  into a small floating pill from the chevron on the chart itself. */}
              {showDetectionChart ? (
                <div style={{ position: "absolute", left: "24px", right: "24px", bottom: "24px", zIndex: 900 }}>
                  <DetectionActivityChart onHide={() => setShowDetectionChart(false)} />
                </div>
              ) : (
                <button
                  onClick={() => setShowDetectionChart(true)}
                  className="vca-rise-in"
                  style={{
                    position: "absolute", left: "24px", bottom: "24px", zIndex: 900,
                    display: "flex", alignItems: "center", gap: "8px",
                    backgroundColor: "rgba(255,255,255,0.74)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid rgba(226,232,240,0.6)", borderRadius: "999px", padding: "8px 14px",
                    boxShadow: "0 8px 32px rgba(14,22,42,0.12)", cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 10L8 6L12 10" stroke="#0e162a" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0e162a", letterSpacing: "-0.24px", whiteSpace: "nowrap" }}>
                    Detection Topology
                  </span>
                </button>
              )}
            </div>
          </>
        )}
        {/* Best Frame stays mounted once loaded (display:none instead of unmounting) so its
            camera selection / detail view survives switching to another tab and back. */}
        {!isLoading && (
          <div style={{ display: activePage === "BEST FRAME" ? "contents" : "none" }}>
            <BestFramePage
              focusLocation={bestFrameFocusLocation}
              onFocusConsumed={() => setBestFrameFocusLocation(null)}
              onGoRedmapTrace={handleGoRedmapTrace}
            />
          </div>
        )}
        {!isLoading && activePage === "DATA"   && <DataPage />}
        {!isLoading && activePage === "REDMAP" && (
          <RedmapPage
            initialSearchName={redmapAutoSearchName}
            onInitialSearchConsumed={() => setRedmapAutoSearchName(null)}
          />
        )}
      </div>
    </div>
    </ToastProvider>
  );
}
