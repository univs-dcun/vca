function Bone({ w, h, color = "#e2e8f0", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

function SearchBarSkeleton() {
  return (
    <div style={{
      backgroundColor: "white", borderBottom: "1px solid #E2E8F0",
      padding: "0 24px", height: "52px",
      display: "flex", alignItems: "center", gap: "0", flexShrink: 0,
    }}>
      {/* Mode toggle pill */}
      <div style={{ display: "flex", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: "999px", padding: "2px", gap: "2px" }}>
        <Bone w="76px" h="32px" color="white" radius="999px" />
        <Bone w="76px" h="32px" color="#e2e8f0" radius="999px" />
      </div>

      <div style={{ width: "1px", height: "20px", backgroundColor: "#e2e8f0", margin: "0 16px" }} />

      {/* Date range */}
      <Bone w="180px" h="34px" color="#f1f5f9" radius="999px" />

      <div style={{ width: "1px", height: "20px", backgroundColor: "#e2e8f0", margin: "0 16px" }} />

      {/* Search-by-image chips */}
      <div style={{ display: "flex", gap: "8px" }}>
        <Bone w="120px" h="36px" color="#f1f5f9" radius="999px" />
        <Bone w="120px" h="36px" color="#f1f5f9" radius="999px" />
      </div>

      <div style={{ width: "1px", height: "20px", backgroundColor: "#e2e8f0", margin: "0 16px" }} />

      {/* Similarity */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Bone w="60px" h="12px" color="#f1f5f9" />
        <Bone w="120px" h="20px" color="#f1f5f9" radius="999px" />
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: "12px" }}>
        <Bone w="88px" h="36px" color="#f8fafc" radius="8px" />
        <Bone w="112px" h="36px" color="#e2e8f0" radius="10px" />
      </div>
    </div>
  );
}

function MapSkeleton() {
  const dots = [
    { left: "20%", top: "24%" }, { left: "35%", top: "46%" }, { left: "50%", top: "28%" },
    { left: "62%", top: "58%" }, { left: "45%", top: "70%" }, { left: "72%", top: "38%" },
  ];
  const pins = [{ left: "50%", top: "50%" }, { left: "68%", top: "62%" }];
  return (
    <div style={{ flex: 1, position: "relative", backgroundColor: "#f1f5f9", overflow: "hidden" }}>
      {dots.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "8px", height: "8px",
          borderRadius: "50%", backgroundColor: "#cbd5e1",
        }} />
      ))}
      {pins.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "32px", height: "32px",
          borderRadius: "50%", backgroundColor: "#94a3b8", opacity: 0.35,
        }} />
      ))}
    </div>
  );
}

// The loading skeleton always represents the landing state (before any search has run) — that's
// the only state a fresh page load can actually be in. Redmap's left/right panels only mount
// once a search produces results, so this skeleton matches that: just the search bar and a
// full-width map, no side panels.
export default function SkeletonRedmap() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>
      <SearchBarSkeleton />
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <MapSkeleton />
      </div>
    </div>
  );
}
