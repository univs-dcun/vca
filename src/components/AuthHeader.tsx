const BORDER = "1px solid #E2E8F0";

/* Minimal header for pre-auth screens like login / password setup (logo only, no full nav) */
export default function AuthHeader() {
  return (
    <div style={{
      height: "56px", backgroundColor: "white", borderBottom: BORDER,
      display: "flex", alignItems: "center", padding: "0 24px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "4px 12px", borderRadius: "8px", backgroundColor: "#0E162A",
        }}>
          <span style={{ fontFamily: "'Jockey One', sans-serif", fontSize: "16px", lineHeight: "18px", color: "white" }}>VCA</span>
        </div>
        <span style={{ fontFamily: "'Jockey One', sans-serif", fontSize: "18px", lineHeight: "26px", letterSpacing: "0.36px", color: "#0E162A" }}>
          UNIVERSE AI
        </span>
      </div>
    </div>
  );
}
