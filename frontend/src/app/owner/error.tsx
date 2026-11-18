"use client";

export default function OwnerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel" style={{ padding: 24, textAlign: "center" }}>
      <div className="eyebrow">Owner Cockpit • Error</div>
      <div className="welcome-title" style={{ fontSize: 20, marginTop: 8 }}>Cockpit view crashed</div>
      <p className="welcome-subtitle" style={{ marginTop: 6 }}>SSE or ledger render failed. Retry — chain verification runs server-side.</p>
      <button onClick={reset} className="btn btn-primary" style={{ marginTop: 14 }}>
        Retry cockpit
      </button>
    </div>
  );
}
