"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#F8F4ED", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div
            style={{
              maxWidth: 440, width: "100%", background: "#fff", borderRadius: 24, padding: 32,
              textAlign: "center", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#1A1A1A", margin: "0 0 8px" }}>AgentShield crashed</h1>
            <p style={{ fontSize: 14, color: "#5A5248", lineHeight: 1.6 }}>
              Critical failure caught at the root. Reload to restore the shield wall.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 20, padding: "10px 22px", borderRadius: 12, border: 0, cursor: "pointer",
                background: "linear-gradient(135deg,#0D7C5F,#10B981)", color: "#fff", fontWeight: 800, fontSize: 14,
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
