"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error("AgentShield route error:", error);
    } catch {}
  }, [error]);

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
        <div
          className="mx-auto mb-5 w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black"
          style={{ background: "linear-gradient(135deg,#C23B3B,#ef4444)", boxShadow: "0 6px 18px rgba(194,59,59,0.35)" }}
          aria-hidden="true"
        >
          !
        </div>
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>
          Something broke
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "#5A5248" }}>
          The shield wall caught a render error instead of crashing. Your data is safe — hash chains are verified server-side.
        </p>
        {error?.digest ? (
          <p className="mt-3 font-mono text-[11px] truncate" style={{ color: "#7A7164" }} title={error.digest}>
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "linear-gradient(135deg,#0D7C5F,#10B981)", boxShadow: "0 4px 16px rgba(13,124,95,0.3)" }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 bg-white/70 hover:bg-white focus-visible:outline-2"
            style={{ border: "1px solid rgba(0,0,0,0.08)", color: "#0D7C5F" }}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
