"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CursorGlow } from "@/components/cursor-glow";

export default function Docs() {
  return (
    <div className="min-h-screen" style={{ background: "#F8F4ED" }}>
      <CursorGlow />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: "rgba(248,244,237,0.8)", backdropFilter: "blur(20px) saturate(1.5)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#0D7C5F", boxShadow: "0 2px 8px rgba(13,124,95,0.3)" }}>
              <span className="font-bold text-white text-xs" style={{ fontFamily: "var(--font-space-grotesk)" }}>AS</span>
            </div>
            <span className="font-bold text-sm tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>AgentShield</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="font-medium" style={{ color: "#3D3529" }}>
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button className="px-5 rounded-xl font-semibold text-white" style={{ background: "#0D7C5F", boxShadow: "0 2px 8px rgba(13,124,95,0.3)" }}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-6 pt-36 pb-28 relative z-10">
        <h1
          className="text-4xl md:text-5xl font-black tracking-tight mb-8"
          style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}
        >
          Documentation
        </h1>
        
        <div className="space-y-12">
          <div className="rounded-2xl p-7 bg-white/70 backdrop-blur-md border border-black/5 shadow-sm">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>Constraint Pinning</h2>
            <p className="text-gray-700 leading-relaxed">
              Quarantine critical rules from context compaction. They survive summarization and are re-injected verbatim — reducing violations from 30% to 0%.
            </p>
          </div>

          <div className="rounded-2xl p-7 bg-white/70 backdrop-blur-md border border-black/5 shadow-sm">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>Hash Chain Integrity</h2>
            <p className="text-gray-700 leading-relaxed">
              Every memory and audit entry is SHA-256 linked. Any modification, deletion, or reordering breaks the chain — detected instantly on verification.
            </p>
          </div>

          <div className="rounded-2xl p-7 bg-white/70 backdrop-blur-md border border-black/5 shadow-sm">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>Poisoning Detection</h2>
            <p className="text-gray-700 leading-relaxed">
              49 OWASP ASI06 detection patterns across 7 categories catch known attack signatures before they reach agent memory.
            </p>
          </div>

          <div className="rounded-2xl p-7 bg-white/70 backdrop-blur-md border border-black/5 shadow-sm">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>Time-Travel Queries</h2>
            <p className="text-gray-700 leading-relaxed">
              Powered by CockroachDB AS OF SYSTEM TIME, developers can query historical states of the memory system, enabling robust post-incident forensics.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs" style={{ color: "#7A7164" }}>
          <div>AgentShield v1.0.0 — Minor Project, BTech CSE AIML</div>
          <div>ITM University Gwalior</div>
        </div>
      </footer>
    </div>
  );
}
