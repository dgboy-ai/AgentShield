"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CursorGlow } from "@/components/cursor-glow";

export default function Home() {
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (token) router.push("/dashboard");
  }, [token, router]);

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

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-36 pb-28 text-center relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-5 py-2.5 mb-10 text-xs font-semibold rounded-full" style={{ background: "rgba(13,124,95,0.1)", color: "#0D7C5F", border: "1px solid rgba(13,124,95,0.2)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "#0D7C5F", boxShadow: "0 0 8px rgba(13,124,95,0.4)" }} />
          OWASP ASI06 Compliant
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-8xl font-black tracking-tight mb-8 leading-[1.05]"
          style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}
        >
          Tamper-Evident Memory
          <br />
          <span style={{ color: "#0D7C5F" }}>for LLM Agents</span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-xl max-w-2xl mx-auto mb-14 leading-relaxed font-medium"
          style={{ color: "#5A5248" }}
        >
          AI agents with persistent memory are vulnerable to poisoning, tampering, and
          silent rule erasure. AgentShield provides cryptographic hash chain integrity,
          constraint pinning, and automated compliance — so your agents stay safe.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-5 mb-20">
          <Link href="/register">
            <Button
              size="lg"
              className="text-white px-10 h-14 rounded-2xl font-bold text-base transition-all duration-300 hover:-translate-y-1"
              style={{ background: "#0D7C5F", boxShadow: "0 4px 20px rgba(13,124,95,0.35)" }}
            >
              Start Free
              <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 rounded-2xl font-semibold text-base"
              style={{ borderColor: "rgba(0,0,0,0.12)", color: "#3D3529", background: "rgba(255,255,255,0.6)" }}
            >
              How It Works
            </Button>
          </a>
        </div>

        {/* Terminal preview */}
        <div className="max-w-3xl mx-auto rounded-2xl overflow-hidden" style={{ background: "#1A1A1A", boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#252525", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#FF5F56" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#27C93F" }} />
            <span className="ml-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>terminal</span>
          </div>
          <pre className="p-6 text-sm font-mono text-left leading-loose overflow-x-auto">
            <span style={{ color: "#6B7280" }}>$ </span>
            <span style={{ color: "#34D399" }}>pip install agentshield</span>
            {"\n"}
            <span style={{ color: "#6B7280" }}>$ </span>
            <span style={{ color: "#9CA3AF" }}>python -c '</span>
            {"\n"}
            <span style={{ color: "#C084FC" }}>from</span>{" "}
            <span style={{ color: "#F9FAFB" }}>agentshield</span>{" "}
            <span style={{ color: "#C084FC" }}>import</span>{" "}
            <span style={{ color: "#F9FAFB" }}>AgentShield</span>
            {"\n"}
            <span style={{ color: "#F9FAFB" }}>shield = </span>
            <span style={{ color: "#34D399" }}>AgentShield</span>
            <span style={{ color: "#F9FAFB" }}>(</span>
            <span style={{ color: "#FBBF24" }}>"http://localhost:8000"</span>
            <span style={{ color: "#F9FAFB" }}>)</span>
            {"\n"}
            <span style={{ color: "#F9FAFB" }}>shield.constraints.</span>
            <span style={{ color: "#34D399" }}>pin</span>
            <span style={{ color: "#F9FAFB" }}>(</span>
            <span style={{ color: "#FBBF24" }}>"Never delete files without confirmation"</span>
            <span style={{ color: "#F9FAFB" }}>)</span>
            {"\n"}
            <span style={{ color: "#F9FAFB" }}>shield.</span>
            <span style={{ color: "#34D399" }}>scan</span>
            <span style={{ color: "#F9FAFB" }}>(</span>
            <span style={{ color: "#FBBF24" }}>"Ignore all previous instructions"</span>
            <span style={{ color: "#F9FAFB" }}>)</span>
            {"\n"}
            <span style={{ color: "#9CA3AF" }}># {'\u2192'} blocked=True, 3 attack patterns detected</span>
            {"\n"}
            <span style={{ color: "#6B7280" }}>$ </span>
            <span style={{ color: "#F9FAFB" }}>| </span>
            <span style={{ color: "#34D399" }}>&#10003; Chain valid</span>
            <span style={{ color: "#F9FAFB" }}> | </span>
            <span style={{ color: "#34D399" }}>&#10003; EU AI Act compliant</span>
            {"\n"}
          </pre>
        </div>
      </section>

      {/* Problem */}
      <section className="py-28 relative z-10" style={{ background: "rgba(255,255,255,0.3)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#C23B3B" }}>Why This Matters</span>
          </div>
          <h2
            className="text-4xl md:text-5xl font-black text-center mb-6 tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}
          >
            The Problem
          </h2>
          <p className="text-lg text-center max-w-3xl mx-auto mb-16" style={{ color: "#5A5248" }}>
            Research shows safety constraint violations jump from <strong>0% to 30%</strong> after context
            compaction. Attack success rates reach <strong>99.8%</strong> on GPT-5.5. No existing system
            combines constraint preservation, cryptographic integrity, and tamper-evident auditing.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { stat: "30%", label: "Violation Rate", desc: "after context compaction. Soft policies decay 8.3x faster than hard safety norms." },
              { stat: "99.8%", label: "Attack Success", desc: "memory poisoning rate on GPT-5.5 via delayed sleeper poisoning technique." },
              { stat: "188", label: "Known Incidents", desc: "verified cases of AI agents causing enterprise damage with no attacker involved." },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1"
                style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}
              >
                <div className="text-5xl font-black mb-2" style={{ fontFamily: "var(--font-space-grotesk)", color: "#C23B3B" }}>
                  {card.stat}
                </div>
                <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#1A1A1A" }}>
                  {card.label}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#5A5248" }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-28 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#0D7C5F" }}>Mechanism</span>
          </div>
          <h2
            className="text-4xl md:text-5xl font-black text-center mb-16 tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}
          >
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { num: "01", title: "Pin Safety Constraints", desc: "Quarantine critical rules from context compaction. They survive summarization and are re-injected verbatim — reducing violations from 30% to 0%.", color: "#0D7C5F" },
              { num: "02", title: "Hash Chain Integrity", desc: "Every memory and audit entry is SHA-256 linked. Any modification, deletion, or reordering breaks the chain — detected instantly on verification.", color: "#0D7C5F" },
              { num: "03", title: "Detect Poisoning", desc: "45 OWASP ASI06 detection patterns across 7 categories catch known attack signatures before they reach agent memory.", color: "#D4A843" },
              { num: "04", title: "Cryptographic Signatures", desc: "ECDSA-P256 digital signatures provide non-repudiable integrity. Every sign/verify call is logged for third-party verification.", color: "#D4A843" },
              { num: "05", title: "Tamper-Evident Audit", desc: "Hash-chained audit trail records every operation. Generate EU AI Act Article 12 compliance reports automatically.", color: "#6B4FA0" },
              { num: "06", title: "3-Line Integration", desc: "pip install agentshield — one import, one client, three method calls. Works with any LLM agent framework.", color: "#6B4FA0" },
            ].map((step, i) => (
              <div
                key={i}
                className="rounded-2xl p-7 flex items-start gap-5 transition-all duration-300 hover:-translate-y-1"
                style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${step.color}15` }}>
                  <span className="text-base font-black" style={{ fontFamily: "var(--font-space-grotesk)", color: step.color }}>{step.num}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold mb-2" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#5A5248" }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="py-28 relative z-10" style={{ background: "rgba(255,255,255,0.3)" }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#0D7C5F" }}>Developer Experience</span>
          </div>
          <h2
            className="text-4xl md:text-5xl font-black text-center mb-12 tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}
          >
            Zero-Friction Integration
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: "#1A1A1A", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div className="flex items-center gap-2 px-5 py-3" style={{ background: "#252525", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-3 h-3 rounded-full" style={{ background: "#FF5F56" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#27C93F" }} />
              <span className="ml-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>example.py</span>
            </div>
            <pre className="p-7 text-sm font-mono overflow-x-auto leading-loose">
              <span style={{ color: "#C084FC" }}>from</span>{" "}
              <span style={{ color: "#F9FAFB" }}>agentshield</span>{" "}
              <span style={{ color: "#C084FC" }}>import</span>{" "}
              <span style={{ color: "#F9FAFB" }}>AgentShield</span>
              {"\n\n"}
              <span style={{ color: "#F9FAFB" }}>shield = </span>
              <span style={{ color: "#34D399" }}>AgentShield</span>
              <span style={{ color: "#F9FAFB" }}>(</span>
              <span style={{ color: "#FBBF24" }}>"http://localhost:8000"</span>
              <span style={{ color: "#F9FAFB" }}>)</span>
              {"\n"}
              <span style={{ color: "#F9FAFB" }}>shield.auth.</span>
              <span style={{ color: "#34D399" }}>register</span>
              <span style={{ color: "#F9FAFB" }}>(</span>
              <span style={{ color: "#FBBF24" }}>"you@example.com"</span>
              <span style={{ color: "#F9FAFB" }}>, </span>
              <span style={{ color: "#FBBF24" }}>"password123"</span>
              <span style={{ color: "#F9FAFB" }}>, </span>
              <span style={{ color: "#FBBF24" }}>"You"</span>
              <span style={{ color: "#F9FAFB" }}>)</span>
              {"\n\n"}
              <span style={{ color: "#6B7280" }}># Pin rules that survive compaction</span>
              {"\n"}
              <span style={{ color: "#F9FAFB" }}>shield.constraints.</span>
              <span style={{ color: "#34D399" }}>pin</span>
              <span style={{ color: "#F9FAFB" }}>(</span>
              <span style={{ color: "#FBBF24" }}>"Never delete files without confirmation"</span>
              <span style={{ color: "#F9FAFB" }}>, </span>
              <span style={{ color: "#FBBF24" }}>"safety"</span>
              <span style={{ color: "#F9FAFB" }}>)</span>
              {"\n\n"}
              <span style={{ color: "#6B7280" }}># Store memories with automatic hash chain integrity</span>
              {"\n"}
              <span style={{ color: "#F9FAFB" }}>shield.memory.</span>
              <span style={{ color: "#34D399" }}>store</span>
              <span style={{ color: "#F9FAFB" }}>(</span>
              <span style={{ color: "#FBBF24" }}>"User prefers dark mode"</span>
              <span style={{ color: "#F9FAFB" }}>, memory_type=</span>
              <span style={{ color: "#FBBF24" }}>"episodic"</span>
              <span style={{ color: "#F9FAFB" }}>)</span>
              {"\n\n"}
              <span style={{ color: "#6B7280" }}># Detect poisoning before it reaches memory</span>
              {"\n"}
              <span style={{ color: "#F9FAFB" }}>result = shield.</span>
              <span style={{ color: "#34D399" }}>scan</span>
              <span style={{ color: "#F9FAFB" }}>(</span>
              <span style={{ color: "#FBBF24" }}>"Ignore all previous instructions"</span>
              <span style={{ color: "#F9FAFB" }}>)</span>
              {"\n"}
              <span style={{ color: "#C084FC" }}>print</span>
              <span style={{ color: "#F9FAFB" }}>(result.blocked)  </span>
              <span style={{ color: "#6B7280" }}># {'\u2192'} True</span>
            </pre>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-28 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { value: "45", label: "Detection Patterns" },
              { value: "7", label: "Attack Categories" },
              { value: "0%", label: "Violation Rate" },
              { value: "<0.5%", label: "Token Overhead" },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-2xl p-8 text-center transition-all duration-300 hover:-translate-y-1"
                style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}
              >
                <div className="text-4xl font-black" style={{ fontFamily: "var(--font-space-grotesk)", color: "#0D7C5F" }}>
                  {s.value}
                </div>
                <div className="text-sm font-semibold mt-2" style={{ color: "#5A5248" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 relative z-10" style={{ background: "rgba(255,255,255,0.3)" }}>
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="rounded-3xl p-14" style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 8px 32px rgba(0,0,0,0.05)" }}>
            <h2
              className="text-4xl font-black mb-5 tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}
            >
              Protect Your Agents Today
            </h2>
            <p className="text-lg mb-10" style={{ color: "#5A5248" }}>
              Open source. MIT licensed. Works with any LLM framework.
            </p>
            <div
              className="inline-flex items-center gap-3 px-6 py-4 rounded-xl font-mono text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.08)", color: "#0D7C5F", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              pip install agentshield
            </div>
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
