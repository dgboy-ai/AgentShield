"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="glass-card rounded-2xl p-10 text-center">
      <h2 className="text-xl font-black font-display">Dashboard failed to render</h2>
      <p className="mt-2 text-sm font-medium text-gray-500">Charts or live streams threw. Retry — your on-chain data is untouched.</p>
      <button
        onClick={reset}
        className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg,#0D7C5F,#10B981)" }}
      >
        Retry dashboard
      </button>
    </div>
  );
}
