export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F4ED" }} aria-busy="true" aria-label="Loading AgentShield">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: "rgba(13,124,95,0.12)" }}>
          <div className="w-3 h-3 rounded-full" style={{ background: "#0D7C5F" }} />
        </div>
        <p className="text-sm font-medium" style={{ color: "#5A5248" }}>Loading AgentShield…</p>
      </div>
    </div>
  );
}
