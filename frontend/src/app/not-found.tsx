import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#F8F4ED" }}>
      <div
        className="w-full max-w-md rounded-3xl p-8 text-center transition-all duration-300 hover:-translate-y-1"
        style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div className="font-mono text-xs font-bold tracking-[0.3em] uppercase" style={{ color: "#0D7C5F" }}>
          404 • Lost in memory
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>
          Page not found
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#5A5248" }}>
          This route was never pinned. Head back to safety.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#0D7C5F,#10B981)" }}
          >
            Landing
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white/70 hover:bg-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ border: "1px solid rgba(0,0,0,0.08)", color: "#0D7C5F" }}
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
