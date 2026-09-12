"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const HeroShield = dynamic(() => import("@/components/hero-shield"), { ssr: false });

// ─── Reusable section reveal ───
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Section tag ───
function Tag({ color = "#10B981", children }: { color?: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 mb-6">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color }}>{children}</span>
    </div>
  );
}

// ─── Pipeline step ───
const PIPELINE_STEPS = [
  { label: "Memory Request", icon: "→", color: "#38bdf8" },
  { label: "Authenticate", icon: "🔐", color: "#10B981" },
  { label: "Constraint Check", icon: "📌", color: "#10B981" },
  { label: "Poisoning Scan", icon: "🔍", color: "#f59e0b" },
  { label: "Decision", icon: "⚡", color: "#10B981" },
  { label: "SHA-256 Hash", icon: "#", color: "#a78bfa" },
  { label: "Hash Chain", icon: "⛓", color: "#a78bfa" },
  { label: "Digital Signature", icon: "✍", color: "#38bdf8" },
  { label: "Persist", icon: "💾", color: "#10B981" },
  { label: "Audit", icon: "📋", color: "#10B981" },
];

// ─── Live metrics from backend ───
function LiveMetrics() {
  const [metrics, setMetrics] = useState<{ constraints: number; memories: number; audit: number; patterns: number } | null>(null);

  useEffect(() => {
    // Try to load from localStorage token then call API
    const token = typeof window !== "undefined" ? localStorage.getItem("agentshield_token") : null;
    if (!token) return;
    Promise.all([
      api.dashboardStats(token).catch(() => null),
    ]).then(([stats]) => {
      if (stats) {
        const s = stats as Record<string, unknown>;
        setMetrics({
          constraints: (s.active_constraints as number) ?? 0,
          memories: (s.secured_memories as number) ?? 0,
          audit: (s.total_audit_events as number) ?? 0,
          patterns: (s.detection_patterns as number) ?? 0,
        });
      }
    });
  }, []);

  const items = [
    { label: "Constraints", value: metrics?.constraints ?? 0, color: "#10B981" },
    { label: "Memories", value: metrics?.memories ?? 0, color: "#38bdf8" },
    { label: "Audit Events", value: metrics?.audit ?? 0, color: "#a78bfa" },
    { label: "Detection Patterns", value: metrics?.patterns ?? 0, color: "#f59e0b" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl p-5 border border-white/5 bg-white/[0.03] text-center transition-all hover:bg-white/[0.06]"
        >
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)", color: item.color }}>
            {item.value}
          </div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-white/40 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.6], [0, -60]);

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden" suppressHydrationWarning>

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-[#10B981] flex items-center justify-center">
              <span className="text-black font-bold text-[10px]" style={{ fontFamily: "var(--font-space-grotesk)" }}>AS</span>
            </div>
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/90" style={{ fontFamily: "var(--font-space-grotesk)" }}>AgentShield</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {["Overview", "Technology", "Security", "Dashboard"].map((item) => (
              <a key={item} href={item === "Dashboard" ? "/dashboard" : `#${item.toLowerCase()}`}
                className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#10B981]">System Online</span>
            </div>
            <Link href="/dashboard">
              <button className="px-4 py-2 rounded-lg bg-[#10B981] text-black text-[10px] font-bold tracking-[0.15em] uppercase hover:bg-[#34D399] transition-colors">
                Open Dashboard
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── 01 HERO ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-14">
        <HeroShield />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-white/60">A Tamper-Evident Memory Framework</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] mb-4"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Your agent<br />has memory.
            </motion.h1>

            <motion.h2
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] mb-8"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] to-[#34D399]">But can you<br />trust it?</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-base text-white/50 leading-relaxed mb-10 max-w-md"
            >
              AgentShield is a tamper-evident security framework for LLM agent memory. Protect, verify, and audit the long-term memory layer of intelligent agents using cryptographic hash chains and pinned constraints.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-wrap gap-3"
            >
              <Link href="/dashboard">
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#10B981] text-black text-xs font-bold tracking-[0.15em] uppercase hover:bg-[#34D399] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all">
                  Open Dashboard
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </Link>
              <a href="#overview">
                <button className="px-6 py-3 rounded-lg border border-white/10 text-white/70 text-xs font-bold tracking-[0.15em] uppercase hover:bg-white/5 hover:text-white transition-all">
                  Learn More
                </button>
              </a>
            </motion.div>

            {/* Metrics row */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="mt-12 grid grid-cols-4 gap-4 border-t border-white/5 pt-8"
            >
              {[
                { n: "0", label: "Constraints" },
                { n: "0", label: "Memories" },
                { n: "0", label: "Audit Events" },
                { n: "0", label: "Detection Patterns" },
              ].map((m) => (
                <div key={m.label}>
                  <div className="text-xl font-bold text-white/90" style={{ fontFamily: "var(--font-space-grotesk)" }}>{m.n}</div>
                  <div className="text-[9px] font-mono tracking-widest uppercase text-white/30 mt-0.5">{m.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Architecture diagram */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div className="relative w-[480px] h-[480px]">
              {/* Central shield */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute -inset-8 rounded-full bg-[#10B981]/10 animate-pulse" />
                  <div className="absolute -inset-16 rounded-full border border-[#10B981]/10 animate-pulse" style={{ animationDelay: "0.5s" }} />
                  <div className="absolute -inset-24 rounded-full border border-[#10B981]/5" />
                  <div className="w-24 h-24 rounded-2xl bg-black border border-[#10B981]/40 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#10B981]/20 to-[#10B981]/5 flex items-center justify-center">
                      <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: "var(--font-space-grotesk)" }}>AS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orbital nodes */}
              {[
                { label: "CONSTRAINTS", angle: -90, color: "#10B981", r: 180 },
                { label: "DETECTION", angle: 0, color: "#38bdf8", r: 180 },
                { label: "AUDIT TRAIL", angle: 120, color: "#a78bfa", r: 180 },
                { label: "HASH CHAIN", angle: 240, color: "#f59e0b", r: 180 },
              ].map((node) => {
                const rad = (node.angle * Math.PI) / 180;
                const x = 240 + node.r * Math.cos(rad) - 48;
                const y = 240 + node.r * Math.sin(rad) - 48;
                return (
                  <div
                    key={node.label}
                    className="absolute w-24 h-12 rounded-xl border flex items-center justify-center text-center"
                    style={{
                      left: x, top: y,
                      borderColor: `${node.color}30`,
                      background: `${node.color}08`,
                    }}
                  >
                    <span className="text-[8px] font-mono tracking-widest uppercase" style={{ color: node.color }}>{node.label}</span>
                  </div>
                );
              })}

              {/* Top/bottom labels */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
                <div className="text-[10px] font-mono tracking-widest uppercase text-white/40">LLM AGENT</div>
                <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent mx-auto mt-1" />
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <div className="w-px h-8 bg-gradient-to-t from-white/20 to-transparent mx-auto mb-1" />
                <div className="text-[10px] font-mono tracking-widest uppercase text-white/40">LONG-TERM MEMORY</div>
              </div>

              {/* Corner labels */}
              <div className="absolute top-8 right-0 space-y-1">
                {["SECURE", "MEMORY", "SAFER AI"].map((t) => (
                  <div key={t} className="text-right text-[8px] font-mono tracking-widest uppercase text-white/20">{t}</div>
                ))}
              </div>
              <div className="absolute bottom-8 right-0 space-y-1">
                {["PROTECT", "DETECT", "VERIFY", "RECORD"].map((t) => (
                  <div key={t} className="text-right text-[8px] font-mono tracking-widest uppercase text-[#10B981]/50">{t}</div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <div className="text-[9px] font-mono tracking-[0.25em] uppercase text-white/30">Scroll to explore</div>
          <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </section>

      {/* ─── 02 THE MEMORY PROBLEM ─── */}
      <section id="overview" className="py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#10B981]/[0.02] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <Tag color="#38bdf8">The Problem</Tag>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                  Your agent<br />remembers.
                </h2>
                <p className="text-white/50 text-base leading-relaxed mb-6">
                  Persistent memory allows an agent to reuse information across future interactions. But information stored in memory cannot automatically be assumed trustworthy.
                </p>
                <p className="text-white/30 text-sm leading-relaxed">
                  If malicious or incorrect information enters memory, it can lead to unsafe, unexpected, or harmful agent behavior — across every future interaction.
                </p>
              </Reveal>
            </div>
            <div>
              <Reveal delay={0.2}>
                {/* Flow diagram */}
                <div className="space-y-0">
                  {[
                    { label: "INTERACTION", sub: "User, tools, env", color: "#38bdf8" },
                    { label: "MEMORY", sub: "Stored for future use", color: "#10B981" },
                    { label: "FUTURE BEHAVIOR", sub: "Influences decisions", color: "#a78bfa" },
                  ].map((step, i) => (
                    <div key={step.label}>
                      <div className="flex items-center gap-4 p-5 rounded-xl border bg-white/[0.02] transition-all hover:bg-white/[0.04]"
                        style={{ borderColor: `${step.color}20` }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${step.color}10`, border: `1px solid ${step.color}20` }}>
                          <span className="text-lg">{i === 0 ? "💬" : i === 1 ? "🗄️" : "🧠"}</span>
                        </div>
                        <div>
                          <div className="text-xs font-mono tracking-widest uppercase font-bold" style={{ color: step.color }}>{step.label}</div>
                          <div className="text-xs text-white/40 mt-0.5">{step.sub}</div>
                        </div>
                      </div>
                      {i < 2 && <div className="flex justify-center py-2"><div className="w-px h-6 bg-white/10" /></div>}
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-xs text-white/50 leading-relaxed">
                    <span className="text-white/80 font-medium">Memory changes the future behavior of an agent.</span> This is why memory integrity is not optional — it is foundational.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 03 THE ATTACK ─── */}
      <section className="py-32 border-t border-white/5 relative overflow-hidden bg-black/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal delay={0.2}>
              {/* Attack flow */}
              <div className="space-y-0">
                {[
                  { label: "MALICIOUS INPUT", sub: "Injected information", icon: "⚠️", color: "#ef4444" },
                  { label: "POISONED MEMORY", sub: "Corrupts context", icon: "☠️", color: "#ef4444" },
                  { label: "HARMFUL BEHAVIOR", sub: "Unsafe actions", icon: "🔴", color: "#ef4444" },
                ].map((step, i) => (
                  <div key={step.label}>
                    <div className="flex items-center gap-4 p-5 rounded-xl border bg-red-500/[0.03] transition-all"
                      style={{ borderColor: "#ef444420" }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20">
                        <span className="text-lg">{step.icon}</span>
                      </div>
                      <div>
                        <div className="text-xs font-mono tracking-widest uppercase font-bold text-red-400">{step.label}</div>
                        <div className="text-xs text-white/40 mt-0.5">{step.sub}</div>
                      </div>
                    </div>
                    {i < 2 && <div className="flex justify-center py-2"><div className="w-px h-6 bg-red-500/20" /></div>}
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 rounded-xl bg-red-500/[0.04] border border-red-500/10">
                <p className="text-xs font-mono tracking-wide uppercase text-red-400/80 mb-2">Real risks include:</p>
                {["Prompt injection", "Indirect manipulation", "False information", "Behavioral drift", "Persistence of unsafe rules"].map((r) => (
                  <div key={r} className="flex items-center gap-2 py-1">
                    <div className="w-1 h-1 rounded-full bg-red-400" />
                    <span className="text-xs text-white/50">{r}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <div>
              <Reveal>
                <Tag color="#ef4444">The Threat</Tag>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                  But memory<br />can be poisoned.
                </h2>
                <p className="text-white/50 text-base leading-relaxed mb-8">
                  Attackers can inject misleading, harmful or manipulating information into an agent's memory through indirect prompts, tool outputs, or environmental data.
                </p>
                <a href="#technology">
                  <button className="px-5 py-2.5 rounded-lg border border-white/10 text-xs font-mono tracking-widest uppercase text-white/60 hover:text-white hover:bg-white/5 transition-all">
                    See how detection works →
                  </button>
                </a>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 04 AGENTSHIELD ─── */}
      <section id="technology" className="py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#10B981]/[0.03] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <Tag color="#10B981">The Solution</Tag>
          </Reveal>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                  AgentShield.
                </h2>
                <p className="text-xl text-white/60 mb-4 font-light leading-relaxed">A security layer between the agent and its memory.</p>
                <p className="text-white/40 text-sm leading-relaxed mb-8">
                  AgentShield enforces safety through constraint pinning, poisoning detection, cryptographic hash chains, digital signatures, and audit trails.
                </p>
                {/* LLM → AS → MEM flow */}
                <div className="flex items-center gap-3 mb-8">
                  {["LLM AGENT", "AGENTSHIELD", "LONG-TERM MEMORY"].map((label, i) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="text-center">
                        <div className={`w-16 h-16 rounded-xl border flex items-center justify-center mb-2 ${i === 1 ? "border-[#10B981]/40 bg-[#10B981]/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]" : "border-white/10 bg-white/[0.02]"}`}>
                          <span className="text-xl">{i === 0 ? "🤖" : i === 1 ? "🛡️" : "🗄️"}</span>
                        </div>
                        <div className="text-[8px] font-mono tracking-widest uppercase text-white/40">{label}</div>
                        {i === 1 && <div className="text-[7px] font-mono text-[#10B981]/60 mt-0.5">Protect · Detect · Verify · Record</div>}
                      </div>
                      {i < 2 && <div className="flex-shrink-0 text-white/20 text-lg">→</div>}
                    </div>
                  ))}
                </div>
                <a href="#architecture">
                  <button className="px-5 py-2.5 rounded-lg border border-white/10 text-xs font-mono tracking-widest uppercase text-white/60 hover:text-white hover:bg-white/5 transition-all">
                    Explore the architecture →
                  </button>
                </a>
              </Reveal>
            </div>
            <Reveal delay={0.2}>
              <div className="space-y-3">
                {[
                  { icon: "📌", title: "Constraint Pinning", desc: "Quarantine safety rules from context compaction.", color: "#10B981" },
                  { icon: "🔍", title: "Memory Poisoning Detection", desc: "49 OWASP ASI06 patterns across 7 categories.", color: "#10B981" },
                  { icon: "#", title: "SHA-256 Hash Chain", desc: "Cryptographically linked, tamper-evident chain.", color: "#10B981" },
                  { icon: "✍️", title: "Digital Signature Verification", desc: "ECDSA-P256 signatures via AWS KMS.", color: "#10B981" },
                  { icon: "📋", title: "Audit Trail", desc: "Hash-chained audit for every operation.", color: "#10B981" },
                  { icon: "⏱️", title: "Historical Verification", desc: "Time-travel forensics via CockroachDB MVCC.", color: "#10B981" },
                ].map((feature) => (
                  <div key={feature.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#10B981]/20 hover:bg-[#10B981]/[0.03] transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-sm shrink-0 mt-0.5">
                      {feature.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white/80 uppercase tracking-widest group-hover:text-[#10B981] transition-colors">{feature.title}</div>
                      <div className="text-xs text-white/40 mt-1">{feature.desc}</div>
                    </div>
                    <svg className="w-3 h-3 text-white/20 group-hover:text-[#10B981] transition-colors ml-auto mt-1 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── INTEGRATION CODE ─── */}
      <section className="py-32 border-t border-white/5 bg-black/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <Tag color="#38bdf8">Integration</Tag>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                  Zero-friction<br />protocol.
                </h2>
                <p className="text-white/50 text-base leading-relaxed mb-8">
                  Secure your agent's memory pipeline in three steps. Constraint pinning ensures critical rules survive context compaction, while hash chains guarantee integrity.
                </p>
                <div className="space-y-4">
                  {[
                    { title: "Constraint Pinning", desc: "Quarantine safety rules from being overwritten." },
                    { title: "Poisoning Detection", desc: "Scan inputs against 49 known attack patterns." },
                    { title: "Hash Chain Storage", desc: "Link memories cryptographically for tamper-evidence." },
                  ].map((f) => (
                    <div key={f.title} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-white/80">{f.title}</div>
                        <div className="text-xs text-white/40 mt-0.5">{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/30 mb-2">Simple to integrate. Powerful protection.</p>
                  <a href="/docs" className="text-xs text-[#10B981] hover:text-[#34D399] transition-colors font-mono tracking-wider">View Documentation →</a>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.2}>
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#10B981]/20 to-[#38bdf8]/10 rounded-2xl blur-xl opacity-50" />
                <div className="relative rounded-2xl bg-[#0a0a0a] border border-white/10 overflow-hidden">
                  <div className="flex items-center px-4 py-3 border-b border-white/5 bg-black/50">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    </div>
                    <div className="mx-auto text-[9px] font-mono text-white/30 tracking-widest uppercase">agent_memory.py</div>
                  </div>
                  <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto text-white/60">
                    <span className="text-[#38bdf8]">from</span>{" agentshield "}<span className="text-[#38bdf8]">import</span>{" AgentShield\n\n"}
                    {"shield = AgentShield("}<span className="text-[#10B981]">"http://localhost:8000"</span>{")\n\n"}
                    <span className="text-white/25"># 1. Pin critical constraint</span>{"\n"}
                    {"shield.constraints.pin(\n  "}<span className="text-[#10B981]">"Never execute arbitrary commands"</span>{"\n)\n\n"}
                    <span className="text-white/25"># 2. Store memory (auto hash-chained)</span>{"\n"}
                    {"shield.memory.store(\n  "}<span className="text-[#10B981]">"User prefers strict validation"</span>{"\n)\n\n"}
                    <span className="text-white/25"># 3. Audit verification</span>{"\n"}
                    <span className="text-[#38bdf8]">assert</span>{" shield.audit.verify().valid"}
                  </pre>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 12 SECURITY PIPELINE ─── */}
      <section id="architecture" className="py-32 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Reveal>
            <Tag color="#a78bfa">Architecture</Tag>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              The security pipeline.
            </h2>
            <p className="text-white/50 text-base mb-16 max-w-xl mx-auto">
              Every memory write passes through the full AgentShield pipeline before being persisted and recorded.
            </p>
          </Reveal>

          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent -translate-x-1/2" />
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, i) => (
                <Reveal key={step.label} delay={i * 0.05}>
                  <div className={`flex items-center gap-6 ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    {i % 2 !== 0 && <div className="flex-1" />}
                    <div className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-white/[0.02] hover:bg-white/[0.04] transition-all w-64"
                      style={{ borderColor: `${step.color}20` }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: `${step.color}15`, border: `1px solid ${step.color}20` }}>
                        {step.icon}
                      </div>
                      <span className="text-xs font-mono tracking-widest uppercase" style={{ color: step.color }}>{step.label}</span>
                    </div>
                    {i % 2 === 0 && <div className="flex-1" />}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 13 COMMAND CENTER ─── */}
      <section id="security" className="py-32 border-t border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <Reveal>
              <Tag color="#10B981">Command Center</Tag>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                See the memory defense<br />in action.
              </h2>
              <p className="text-white/50 text-base max-w-xl mx-auto">
                The AgentShield Command Center gives you a real-time view of your agent's security posture. Every metric comes directly from the backend.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8">
              <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                  <div className="text-xs font-mono tracking-widest uppercase text-white/40 mb-1">Security Overview</div>
                  <h3 className="text-lg font-bold text-white/90" style={{ fontFamily: "var(--font-space-grotesk)" }}>AgentShield Telemetry</h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[9px] font-mono tracking-widest uppercase text-[#10B981]">Live Backend Data</span>
                </div>
              </div>
              <LiveMetrics />
              <div className="mt-8 text-center">
                <Link href="/dashboard">
                  <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#10B981] text-black text-xs font-bold tracking-[0.15em] uppercase hover:bg-[#34D399] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all">
                    Open Command Center
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 14 FINAL CTA ─── */}
      <section className="py-40 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#10B981]/[0.04] pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-[#10B981]/[0.04] blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-white/50">Ready to secure your agents?</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Build safer, more<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] to-[#34D399]">trustworthy agents.</span>
            </h2>
            <p className="text-white/40 text-base mb-12 max-w-xl mx-auto">
              Start using AgentShield to protect your agent's memory today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <button className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#10B981] text-black text-xs font-bold tracking-[0.15em] uppercase hover:bg-[#34D399] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all">
                  Open Dashboard →
                </button>
              </Link>
              <Link href="/register">
                <button className="px-8 py-4 rounded-xl border border-white/10 text-white/70 text-xs font-bold tracking-[0.15em] uppercase hover:bg-white/5 hover:text-white transition-all">
                  Read the Docs
                </button>
              </Link>
            </div>
            <div className="mt-8 text-[10px] font-mono tracking-widest uppercase text-white/30">
              Memory You Can Verify.
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-8 bg-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-[#10B981] flex items-center justify-center">
              <span className="text-black font-bold text-[8px]">AS</span>
            </div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">AgentShield</span>
            <span className="text-white/20 text-xs">—</span>
            <span className="text-[10px] font-mono text-white/30">A Tamper-Evident Memory Defense for LLM Agents</span>
          </div>
          <div className="flex items-center gap-6">
            {["/dashboard", "/login"].map((href) => (
              <Link key={href} href={href} className="text-[9px] font-mono tracking-widest uppercase text-white/30 hover:text-white/60 transition-colors">
                {href.replace("/", "")}
              </Link>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[9px] font-mono tracking-widest uppercase text-[#10B981]/70">System Online</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
