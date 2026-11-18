"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { Reveal } from "@/components/reveal";

const INSTALL_CMD = "pip install agentshield";

export function CTASection() {
  const [copied, setCopied] = useState(false);
  const [terminalOn, setTerminalOn] = useState(false);

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTerminalOn(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <section className="py-28 relative z-10 overflow-hidden" style={{ background: "linear-gradient(to bottom, #F8F4ED 0%, #EDF3EE 60%, #F8F4ED 100%)" }}>
      {/* ambient orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: "radial-gradient(ellipse 640px 340px at 50% 108%, rgba(16,185,129,0.14), transparent 70%), radial-gradient(ellipse 480px 280px at 12% 20%, rgba(167,139,250,0.08), transparent 70%), radial-gradient(ellipse 480px 280px at 88% 24%, rgba(34,211,238,0.08), transparent 70%)" }} />
      <div className="max-w-3xl mx-auto px-6 text-center relative">
        <Reveal>
          <div className="mb-6 flex items-center justify-center gap-4">
            <span className="hidden h-px w-16 sm:block" style={{ background: "linear-gradient(90deg, transparent, rgba(13,124,95,0.5))" }} aria-hidden="true" />
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#0D7C5F", letterSpacing: "0.32em" }}>Get Started</span>
            <span className="hidden h-px w-16 sm:block" style={{ background: "linear-gradient(90deg, rgba(13,124,95,0.5), transparent)" }} aria-hidden="true" />
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="text-5xl md:text-6xl font-black tracking-[-0.035em] leading-[1.04]" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>
            Protect Your{" "}
            <span className="italic" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500, backgroundImage: "linear-gradient(120deg,#0D7C5F,#10B981 55%,#22D3EE)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Agents
            </span>{" "}
            Today
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-5 text-lg" style={{ color: "#5A5248" }}>
            <strong style={{ color: "#1A1A1A" }}>Open source. MIT licensed.</strong> Works with any LLM framework — LangChain, CrewAI, AutoGen, or raw HTTP.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div
            className="group relative mx-auto mt-10 max-w-xl overflow-hidden rounded-3xl p-[1.5px] transition-all duration-300 hover:-translate-y-1"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.6), rgba(34,211,238,0.4), rgba(167,139,250,0.5))", boxShadow: "0 18px 55px rgba(13,124,95,0.16)" }}
          >
            <div className="rounded-3xl px-6 py-8 sm:px-10" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)" }}>
              <div className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "#7A7164" }}>
                Install in 10 seconds
              </div>

              {/* copyable install pill */}
              <button
                onClick={copyCmd}
                aria-live="polite"
                className="group/cmd relative mx-auto mt-4 flex w-full items-center gap-3 overflow-hidden rounded-2xl px-5 py-4 font-mono text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2"
                style={{ background: "#101415", border: "1px solid rgba(52,211,153,0.3)", color: "#6EE7B7", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}
                title="Click to copy"
              >
                <span style={{ color: "#5A5248" }} aria-hidden="true">$</span>
                <span className="flex-1 text-left">{INSTALL_CMD}</span>
                <span
                  className="rounded-full px-3 py-1 text-[11px] transition-all"
                  style={{ background: copied ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.35)" }}
                >
                  {copied ? "copied ✓" : "copy"}
                </span>
                <span className="absolute inset-0 opacity-0 transition-opacity group-hover/cmd:opacity-100" style={{ background: "linear-gradient(100deg, transparent 30%, rgba(52,211,153,0.12) 50%, transparent 70%)" }} aria-hidden="true" />
              </button>

              {/* fake terminal feedback */}
              <div className="mt-3 min-h-[24px] font-mono text-[12px]" aria-live="polite" style={{ color: terminalOn ? "#059669" : "rgba(122,113,100,0.7)" }}>
                {terminalOn ? "✓ agentshield installed — now run the 6-line quickstart above" : "↑ click to copy, paste in your terminal"}
              </div>

              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="group relative overflow-hidden rounded-2xl px-8 py-3.5 text-[15px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                  style={{ background: "linear-gradient(135deg,#0D7C5F,#10B981)", boxShadow: "0 8px 26px rgba(16,185,129,0.4)" }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Start Free
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
                  </span>
                  <span className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)", backgroundSize: "200% 100%" }} aria-hidden="true" />
                </Link>
                <Link
                  href="/docs"
                  className="rounded-2xl px-8 py-3.5 text-[15px] font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ background: "rgba(13,124,95,0.07)", border: "1px solid rgba(13,124,95,0.2)", color: "#0D7C5F" }}
                >
                  Read the Docs
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                {["MIT licensed", "Python 3.10+", "REST + SDK", "EU AI Act ready"].map((c) => (
                  <span key={c} className="rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-200 hover:-translate-y-px" style={{ background: "rgba(0,0,0,0.035)", color: "#5A5248", border: "1px solid rgba(0,0,0,0.06)" }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
