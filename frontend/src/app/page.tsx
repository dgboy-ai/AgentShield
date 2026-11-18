"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CursorGlow } from "@/components/cursor-glow";
import { SiteNav } from "@/components/site-nav";
import { HeroSeam } from "@/components/hero-seam";
import { CodeExplorer } from "@/components/code-explorer";
import { CTASection } from "@/components/cta-section";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const HeroShield = dynamic(() => import("@/components/hero-shield"), { ssr: false });

// ─── helpers ──────────────────────────────────────────────────────────
function useMagnetic() {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useRef(0), y = useRef(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      x.current = (e.clientX - cx) * 0.18;
      y.current = (e.clientY - cy) * 0.24;
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        el!.style.transform = `translate3d(${x.current}px,${y.current}px,0)`;
      });
    }
    function onLeave() {
      cancelAnimationFrame(raf.current);
      el!.style.transform = `translate3d(0,0,0)`;
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); cancelAnimationFrame(raf.current); };
  }, []);
  return ref;
}

function Sparkle({ delay = 0, x = 0, y = 0 }: { delay?: number; x?: number; y?: number }) {
  return (
    <motion.span
      className="absolute pointer-events-none"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0, rotate: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1.1, 0], rotate: [0, 90, 180] }}
      transition={{ duration: 1.1, delay, repeat: Infinity, repeatDelay: 2.4 + Math.random() * 1.6, ease: "easeOut" }}
      aria-hidden
    >
      <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d="M5 0L5.9 4.1L10 5L5.9 5.9L5 10L4.1 5.9L0 5L4.1 4.1Z" fill="#34D399" /></svg>
    </motion.span>
  );
}

function Reveal({ children, delay = 0, y = 18 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function TiltCard({ children, className, style, glow }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; glow?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    const g = el.querySelector(".tilt-glow") as HTMLElement;
    if (g) { g.style.opacity = "1"; g.style.background = `radial-gradient(520px 220px at ${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%, ${glow || "rgba(16,185,129,0.13)"}, transparent 70%)`; }
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `perspective(900px) rotateX(0) rotateY(0) translateY(0)`;
    const g = el.querySelector(".tilt-glow") as HTMLElement;
    if (g) g.style.opacity = "0";
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className} style={{ ...style, transformStyle: "preserve-3d", transition: "transform 0.45s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s ease, border-color 0.35s ease", willChange: "transform" } as any}>
      <span className="tilt-glow absolute inset-0 rounded-2xl pointer-events-none opacity-0 transition-opacity duration-300" aria-hidden />
      <span className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ boxShadow: "0 0 0 1px rgba(16,185,129,0.10), 0 18px 36px rgba(0,0,0,0.07)" }} aria-hidden />
      {children}
    </div>
  );
}

const PROOFS = [
  { label: "hash-chain (seed+prev_hash)", detail: "Every memory links to the last — any edit, deletion or reorder breaks the chain instantly." },
  { label: "ECDSA-P256 · KMS", detail: "Each receipt is signed inside AWS KMS HSM — non-repudiable, CloudTrail-logged proof." },
  { label: "49 FARMA patterns", detail: "Injection, sleeper & forged-reasoning attacks blocked before they ever reach memory." },
];

// ─── page ─────────────────────────────────────────────────────────────
export default function Home() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 20, restDelta: 0.001 });
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 90]);
  const heroOpacity = useTransform(scrollY, [0, 480], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 520], [1, 0.96]);

  const mag2 = useMagnetic();

  const [typed, setTyped] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTyped(s => (s < 3 ? s + 1 : s)), 520);
    return () => clearInterval(t);
  }, []);

  // GSAP ScrollTrigger — subtle parallax + reveal for non-hero sections
  const problemRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const speed = parseFloat(el.dataset.parallax || "0.12");
        gsap.to(el, { yPercent: -speed * 100, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.9 } });
      });
    });
    return () => ctx.revert();
  }, []);

  const headline = ["Tamper-Evident", "Memory"];

  const [chip, setChip] = useState<number | null>(null);

  return (
    <div className="min-h-screen" style={{ background: "#F8F4ED" }} suppressHydrationWarning>
      <CursorGlow />
      {/* scroll progress */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] origin-left z-[60] pointer-events-none"
        style={{ scaleX: progress, background: "linear-gradient(90deg, #0D7C5F, #10B981 40%, #22D3EE 75%, #A78BFA)" }}
      />

      <SiteNav />

      {/* Hero */}
      <section ref={heroRef as any} className="relative overflow-hidden min-h-[92vh] flex items-center">
        <HeroShield />
        <motion.div style={{ y: heroY, opacity: heroOpacity, scale: heroScale }} className="max-w-6xl mx-auto px-6 pt-36 pb-16 text-center relative z-10 w-full">
          {/* Badge — shimmer sweep + sparkle */}
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 mb-10 text-xs font-semibold rounded-full backdrop-blur relative overflow-hidden"
            style={{ background: "rgba(16,185,129,0.13)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.28)", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse relative" style={{ background: "#10B981", boxShadow: "0 0 14px rgba(16,185,129,0.85)" }}>
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(16,185,129,0.35)" }} />
            </span>
            49 OWASP ASI06 PATTERNS • KMS SIGNED • 10YR RETENTION
            <motion.span className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)", backgroundSize: "220% 100%" }} animate={{ backgroundPosition: ["-140% 0", "160% 0"] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }} />
            <Sparkle x={8} y={-6} delay={0.2} />
            <Sparkle x={208} y={18} delay={0.9} />
          </motion.div>

          {/* Headline — word stagger + editorial serif accent */}
          <h1 className="text-[44px] sm:text-6xl md:text-[88px] font-black tracking-[-0.045em] mb-7 leading-[0.98]" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 800 }}>
            <motion.span className="block" style={{ color: "#F9FAFB", textShadow: "0 2px 28px rgba(16,185,129,0.22)" }} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}>
              {headline.map((w, i) => (
                <motion.span key={w} variants={{ hidden: { y: 30, opacity: 0, filter: "blur(8px)" }, show: { y: 0, opacity: 1, filter: "blur(0px)", transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 } } }} className="inline-block mr-[0.18em]">
                  {w}
                </motion.span>
              ))}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.85, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="bg-clip-text text-transparent inline-block italic"
              style={{ backgroundImage: "linear-gradient(120deg, #6EE7B7 0%, #34D399 22%, #22D3EE 55%, #A78BFA 100%)", WebkitBackgroundClip: "text", fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 500, letterSpacing: "-0.015em", paddingBottom: "0.1em" }}
            >
              for LLM Agents
            </motion.span>
          </h1>

          {/* Sub-copy — lead + interactive proof chips + outcome */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="max-w-2xl mx-auto mb-10"
          >
            <p className="text-lg md:text-[21px] leading-relaxed font-normal" style={{ color: "rgba(255,255,255,0.82)" }}>
              AI agents with persistent memory are vulnerable to{" "}
              <em className="not-italic font-semibold" style={{ color: "#fff" }}>poisoning</em>,{" "}
              <em className="not-italic font-semibold" style={{ color: "#fff" }}>tampering</em>, and{" "}
              <em className="not-italic font-semibold" style={{ color: "#fff" }}>silent rule erasure</em>.
              AgentShield answers with three proofs:
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5" role="group" aria-label="AgentShield protections — hover each for detail">
              {PROOFS.map((p, i) => {
                const active = chip === i;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onMouseEnter={() => setChip(i)}
                    onMouseLeave={() => setChip(null)}
                    onFocus={() => setChip(i)}
                    onBlur={() => setChip(null)}
                    onClick={() => setChip(active ? null : i)}
                    aria-expanded={active}
                    className="group relative overflow-hidden rounded-full px-4 py-2 font-mono text-[12px] font-bold tracking-wide transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      color: active ? "#06281D" : "#6EE7B7",
                      background: active ? "linear-gradient(135deg,#6EE7B7,#34D399)" : "rgba(16,185,129,0.1)",
                      border: `1px solid ${active ? "rgba(110,231,183,0.9)" : "rgba(16,185,129,0.32)"}`,
                      boxShadow: active ? "0 6px 22px rgba(16,185,129,0.45)" : "inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                  >
                    <span className="relative z-10">{p.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 min-h-[26px]" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.p
                  key={chip === null ? "idle" : chip}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="text-[13.5px] font-mono"
                  style={{ color: chip === null ? "rgba(255,255,255,0.42)" : "#6EE7B7" }}
                >
                  {chip === null ? "— hover a proof to see how it works —" : PROOFS[chip].detail}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="mt-4 text-xl md:text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", color: "#fff" }}>
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(120deg,#34D399,#22D3EE)", WebkitBackgroundClip: "text" }}
              >
                0% violation
              </span>{" "}
              <span className="font-normal" style={{ color: "rgba(255,255,255,0.6)" }}>at</span>{" "}
              <span className="relative inline-block">
                &lt;0.5% overhead
                <motion.span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full" style={{ background: "linear-gradient(90deg,#34D399,#22D3EE,#A78BFA)", boxShadow: "0 0 14px rgba(52,211,153,0.6)" }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 1.1 }} />
              </span>
            </p>
          </motion.div>

          {/* CTAs — magnetic + sparkle */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.58 }} className="flex items-center justify-center gap-4 mb-16">
            <Link href="/register" ref={mag2} className="inline-block will-change-transform">
              <Button size="lg" className="text-white px-10 h-14 rounded-2xl font-bold text-base relative overflow-hidden group" style={{ background: "linear-gradient(135deg, #0D7C5F 0%, #10B981 100%)", boxShadow: "0 6px 22px rgba(16,185,129,0.42)" }}>
                <span className="relative z-10 flex items-center">Start Free <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></span>
                <motion.span className="absolute inset-0 opacity-0 group-hover:opacity-100" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)", backgroundSize: "200% 100%" }} animate={{ backgroundPosition: ["-80% 0", "180% 0"] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }} />
              </Button>
            </Link>
            <a href="#how-it-works" className="inline-block">
              <Button size="lg" variant="outline" className="h-14 px-8 rounded-2xl font-semibold text-base backdrop-blur relative overflow-hidden group/how" style={{ borderColor: "rgba(255,255,255,0.16)", color: "#fff", background: "rgba(255,255,255,0.08)" }}>
                <span className="relative z-10">How It Works</span>
                <span className="absolute inset-0 opacity-0 group-hover/how:opacity-100 transition-opacity" style={{ background: "rgba(255,255,255,0.08)" }} />
              </Button>
            </a>
          </motion.div>

          {/* Terminal — tilt + glow + type indicators */}
          <motion.div
            initial={{ opacity: 0, y: 28, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.85, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl mx-auto group/term"
            style={{ perspective: "1200px" }}
            whileHover={{ y: -4 }}
          >
            <div className="rounded-2xl overflow-hidden backdrop-blur-xl relative" style={{ background: "rgba(22,22,22,0.92)", boxShadow: "0 28px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(16,185,129,0.16), 0 0 44px rgba(16,185,129,0.11)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover/term:opacity-100 transition-opacity pointer-events-none" style={{ background: "linear-gradient(120deg, rgba(16,185,129,0.22), rgba(34,211,238,0.16), rgba(167,139,250,0.16))", filter: "blur(14px)" }} />
              <div className="flex items-center gap-2 px-5 py-3 relative" style={{ background: "rgba(34,34,34,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="w-3 h-3 rounded-full" style={{ background: "#FF5F56", boxShadow: "0 0 8px rgba(255,95,86,0.5)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E", boxShadow: "0 0 8px rgba(255,189,46,0.5)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#27C93F", boxShadow: "0 0 8px rgba(39,201,63,0.5)" }} />
                <span className="ml-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.42)" }}>terminal — shield wall active</span>
                <span className="ml-auto flex items-center gap-2 text-xs font-mono" style={{ color: "#10B981" }}><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> CockroachDB • KMS</span>
              </div>
              <pre className="p-6 text-sm font-mono text-left leading-loose overflow-x-auto relative">
                <span style={{ color: "#6B7280" }}>$ </span><span style={{ color: "#34D399" }}>pip install agentshield</span>{"\n"}
                <span style={{ color: "#6B7280" }}>$ </span><span style={{ color: "#9CA3AF" }}>python -c &apos;</span>{"\n"}
                <span style={{ color: "#C084FC" }}>from</span> <span style={{ color: "#F9FAFB" }}>agentshield</span> <span style={{ color: "#C084FC" }}>import</span> <span style={{ color: "#F9FAFB" }}>AgentShield</span>{"\n"}
                <span style={{ color: "#F9FAFB" }}>shield = </span><span style={{ color: "#34D399" }}>AgentShield</span><span style={{ color: "#F9FAFB" }}>(</span><span style={{ color: "#FBBF24" }}>&quot;http://localhost:8000&quot;</span><span style={{ color: "#F9FAFB" }}>)</span>{"\n"}
                <span style={{ color: "#F9FAFB" }}>shield.constraints.</span><span style={{ color: "#34D399" }}>pin</span><span style={{ color: "#F9FAFB" }}>(</span><span style={{ color: "#FBBF24" }}>&quot;Never delete files without confirmation&quot;</span><span style={{ color: "#F9FAFB" }}>)</span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: typed >= 1 ? 1 : 0 }} className="ml-1 inline-flex items-center gap-1 text-xs" style={{ color: "#10B981" }}> ✓ pinned</motion.span>{"\n"}
                <span style={{ color: "#F9FAFB" }}>shield.scan.</span><span style={{ color: "#34D399" }}>text</span><span style={{ color: "#F9FAFB" }}>(</span><span style={{ color: "#FBBF24" }}>&quot;Ignore all previous instructions&quot;</span><span style={{ color: "#F9FAFB" }}>)</span>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: typed >= 2 ? 1 : 0 }} className="ml-1 text-xs" style={{ color: "#F59E0B" }}> → blocked FARMA-001</motion.span>{"\n"}
                <span style={{ color: "#9CA3AF" }}># → blocked=True, FARMA-001 detected</span>{"\n"}
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: typed >= 3 ? 1 : 0 }} style={{ color: "#6B7280" }}>$ <span style={{ color: "#F9FAFB" }}>| </span><span style={{ color: "#34D399" }}>✓ Chain valid</span><span style={{ color: "#F9FAFB" }}> | </span><span style={{ color: "#34D399" }}>✓ KMS signed</span><span style={{ color: "#F9FAFB" }}> | </span><span style={{ color: "#34D399" }}>✓ EU AI Act</span></motion.span>{"\n"}
              </pre>
            </div>
            <p className="text-xs mt-4 flex items-center justify-center gap-2" style={{ color: "rgba(255,255,255,0.55)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981", boxShadow: "0 0 8px rgba(16,185,129,0.7)" }} /> Shield Wall blocks injection • Chain stays unbroken • 0% violation</p>
          </motion.div>
        </motion.div>
      </section>

      <HeroSeam />

      {/* Problem — editorial */}
      <section ref={problemRef as any} className="pt-24 pb-28 relative z-10 overflow-hidden" style={{ background: "linear-gradient(to bottom, #F8F4ED 0%, #F4EEE2 60%, #F6F1E7 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" data-parallax="0.06" style={{ background: "radial-gradient(ellipse 760px 300px at 50% -8%, rgba(16,185,129,0.08), transparent 70%), radial-gradient(ellipse 700px 420px at 12% 18%, rgba(194,59,59,0.07), transparent 70%), radial-gradient(ellipse 600px 380px at 90% 100%, rgba(13,124,95,0.05), transparent 70%)" }} />
        {/* watermark */}
        <div className="pointer-events-none absolute inset-x-0 top-6 select-none overflow-hidden" aria-hidden="true">
          <div className="text-center font-black leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(90px, 19vw, 260px)", color: "transparent", WebkitTextStroke: "1.5px rgba(194,59,59,0.09)" }}>
            DECAY
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 relative">
          <Reveal>
            <div className="mb-6 flex items-center justify-center gap-4">
              <span className="hidden h-px w-16 sm:block" style={{ background: "linear-gradient(90deg, transparent, rgba(194,59,59,0.5))" }} aria-hidden="true" />
              <motion.span initial={{ letterSpacing: "0.18em", opacity: 0 }} whileInView={{ letterSpacing: "0.32em", opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="text-xs font-bold tracking-widest uppercase inline-block" style={{ color: "#C23B3B" }}>Why This Matters</motion.span>
              <span className="hidden h-px w-16 sm:block" style={{ background: "linear-gradient(90deg, rgba(194,59,59,0.5), transparent)" }} aria-hidden="true" />
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-5xl md:text-7xl font-black text-center mb-6 tracking-[-0.035em] leading-[1.02]" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>
              The{" "}
              <span className="italic" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500, color: "#C23B3B", letterSpacing: "-0.01em" }}>
                Problem
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="text-lg md:text-xl text-center max-w-3xl mx-auto mb-14 leading-relaxed" style={{ color: "#5A5248" }}>
              Safety violations jump from{" "}
              <strong className="relative inline-block whitespace-nowrap" style={{ color: "#C23B3B" }}>
                0% → 30%
                <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full" style={{ background: "linear-gradient(90deg,#C23B3B,#ef4444)", boxShadow: "0 0 10px rgba(194,59,59,0.4)" }} aria-hidden="true" />
              </strong>{" "}
              after compaction. Attacks reach{" "}
              <strong style={{ color: "#1A1A1A" }}>99.8%</strong> on GPT-5.5.{" "}
              <span style={{ color: "#1A1A1A", fontWeight: 600 }}>No existing system</span> combines preservation, integrity, and audit.
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { rank: "01", stat: "30%", label: "Violation Rate", desc: "after context compaction. Soft policies decay 8.3× faster than hard safety norms.", chip: "8.3× decay" },
              { rank: "02", stat: "99.8%", label: "Attack Success", desc: "memory poisoning rate on GPT-5.5 via delayed sleeper poisoning technique.", chip: "sleeper attack" },
              { rank: "03", stat: "188", label: "Known Incidents", desc: "verified cases of AI agents causing enterprise damage with no attacker involved.", chip: "no attacker" },
            ].map((card, i) => (
              <Reveal key={i} delay={0.08 + i * 0.08}>
                <TiltCard className="group relative rounded-3xl p-8 overflow-hidden transition-shadow duration-300 hover:shadow-[0_24px_60px_rgba(194,59,59,0.14)]" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 14px rgba(0,0,0,0.04)" } as any} glow="rgba(194,59,59,0.14)">
                  <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ background: "linear-gradient(90deg,#C23B3B,#ef4444,#D4A843)" }} aria-hidden="true" />
                  <div className="mb-5 flex items-start justify-between">
                    <span className="font-mono text-[11px] font-bold tracking-[0.2em]" style={{ color: "rgba(194,59,59,0.55)" }}>{card.rank}</span>
                    <span className="rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-300 group-hover:-translate-y-0.5" style={{ background: "rgba(194,59,59,0.08)", color: "#C23B3B", border: "1px solid rgba(194,59,59,0.16)" }}>{card.chip}</span>
                  </div>
                  <motion.div className="font-black tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 58, lineHeight: 1, color: "#C23B3B", textShadow: "0 2px 22px rgba(194,59,59,0.18)" }} initial={{ scale: 0.9, filter: "blur(4px)" }} whileInView={{ scale: 1, filter: "blur(0px)" }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.12 + i * 0.06 }}>{card.stat}</motion.div>
                  <div className="mt-3 text-sm font-bold uppercase tracking-wider" style={{ color: "#1A1A1A" }}>{card.label}</div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "#5A5248" }}>{card.desc}</p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — editorial mechanism */}
      <section ref={howRef as any} id="how-it-works" className="py-28 relative z-10 overflow-hidden" style={{ background: "linear-gradient(to bottom, #F6F1E7 0%, #EFE9DB 55%, #F8F4ED 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" data-parallax="0.08" style={{ background: "radial-gradient(ellipse 820px 520px at 50% -10%, rgba(13,124,95,0.08), transparent 70%), radial-gradient(ellipse 640px 420px at 100% 90%, rgba(107,79,160,0.07), transparent 70%)" }} />
        <div className="pointer-events-none absolute inset-x-0 top-8 select-none overflow-hidden" aria-hidden="true">
          <div className="text-center font-black leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(80px, 16vw, 220px)", color: "transparent", WebkitTextStroke: "1.5px rgba(13,124,95,0.10)" }}>
            SHIELD
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 relative">
          <Reveal>
            <div className="mb-6 flex items-center justify-center gap-4">
              <span className="hidden h-px w-16 sm:block" style={{ background: "linear-gradient(90deg, transparent, rgba(13,124,95,0.5))" }} aria-hidden="true" />
              <span className="text-xs font-bold tracking-widest uppercase inline-block" style={{ color: "#0D7C5F", letterSpacing: "0.32em" }}>Mechanism</span>
              <span className="hidden h-px w-16 sm:block" style={{ background: "linear-gradient(90deg, rgba(13,124,95,0.5), transparent)" }} aria-hidden="true" />
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-5xl md:text-7xl font-black text-center mb-5 tracking-[-0.035em] leading-[1.02]" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>
              How It{" "}
              <span className="italic" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500, backgroundImage: "linear-gradient(120deg,#0D7C5F,#10B981 55%,#22D3EE)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Works
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-center text-base md:text-lg max-w-2xl mx-auto mb-14" style={{ color: "#5A5248" }}>
              Six mechanisms, one pipeline — every memory is{" "}
              <strong style={{ color: "#0D7C5F" }}>pinned</strong>,{" "}
              <strong style={{ color: "#0D7C5F" }}>scanned</strong>,{" "}
              <strong style={{ color: "#0D7C5F" }}>chained</strong> and{" "}
              <strong style={{ color: "#0D7C5F" }}>signed</strong> before it earns trust.
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { num: "01", tag: "PIN", title: "Pin Safety Constraints", desc: "Quarantine critical rules from context compaction. They survive summarization and are re-injected verbatim — reducing violations from 30% to 0%.", color: "#0D7C5F" },
              { num: "02", tag: "HASH", title: "Hash Chain Integrity", desc: "Every memory and audit entry is SHA-256 linked. Any modification, deletion, or reordering breaks the chain — detected instantly on verification.", color: "#0D7C5F" },
              { num: "03", tag: "SCAN", title: "Detect Poisoning", desc: "49 OWASP ASI06 detection patterns (incl. FARMA forged reasoning + homoglyph) across 7 categories catch known attack signatures before they reach agent memory.", color: "#D4A843" },
              { num: "04", tag: "SIGN", title: "Cryptographic Signatures", desc: "ECDSA-P256 digital signatures provide non-repudiable integrity. Every sign/verify call is logged for third-party verification.", color: "#D4A843" },
              { num: "05", tag: "AUDIT", title: "Tamper-Evident Audit", desc: "Hash-chained audit trail records every operation. Generate EU AI Act Article 12 compliance reports automatically.", color: "#6B4FA0" },
              { num: "06", tag: "SDK", title: "3-Line Integration", desc: "pip install agentshield — one import, one client, three method calls. Works with any LLM agent framework.", color: "#6B4FA0" },
            ].map((step, i) => (
              <Reveal key={i} delay={0.04 + i * 0.06}>
                <TiltCard className="group relative rounded-3xl p-7 flex items-start gap-5 overflow-hidden transition-shadow duration-300 hover:shadow-[0_24px_60px_rgba(0,0,0,0.10)]" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 14px rgba(0,0,0,0.04)" } as any} glow={`${step.color}1f`}>
                  <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ background: `linear-gradient(90deg, ${step.color}, ${step.color}88)` }} aria-hidden="true" />
                  <motion.div whileHover={{ scale: 1.08, rotate: -2 }} transition={{ type: "spring", stiffness: 380 }} className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl relative overflow-hidden" style={{ background: `${step.color}15`, border: `1px solid ${step.color}30`, boxShadow: `0 0 0 rgba(0,0,0,0)` }}>
                    <span className="text-base font-black leading-none relative z-10" style={{ fontFamily: "var(--font-space-grotesk)", color: step.color }}>{step.num}</span>
                    <span className="font-mono text-[8px] font-bold tracking-[0.14em] relative z-10" style={{ color: step.color }}>{step.tag}</span>
                    <motion.span className="absolute inset-0 opacity-0 group-hover:opacity-100" style={{ background: `linear-gradient(120deg, transparent, ${step.color}18, transparent)`, backgroundSize: "200% 100%" }} animate={{ backgroundPosition: ["-100% 0", "160% 0"] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.2 + i * 0.3 }} />
                  </motion.div>
                  <div className="relative flex-1">
                    <h3 className="text-lg font-black tracking-tight mb-2 transition-transform duration-300 group-hover:-translate-y-px" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#5A5248" }}>{step.desc}</p>
                    <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] font-bold opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" style={{ color: step.color }} aria-hidden="true">
                      {step.tag} → live in dashboard
                    </span>
                  </div>
                  <span className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"><Sparkle delay={i * 0.15} x={0} y={0} /></span>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example — reveal + glow */}
      <section ref={codeRef as any} className="py-28 relative z-10 overflow-hidden" style={{ background: "rgba(255,255,255,0.34)" }}>
        <div className="absolute inset-0 pointer-events-none" data-parallax="0.05" style={{ background: "radial-gradient(ellipse 760px 420px at 50% 0%, rgba(13,124,95,0.06), transparent 70%)" }} />
        <div className="max-w-3xl mx-auto px-6 relative">
          <Reveal>
            <div className="text-center mb-6">
              <span className="text-xs font-bold tracking-widest uppercase inline-block" style={{ color: "#0D7C5F", letterSpacing: "0.32em" }}>Developer Experience</span>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-4xl md:text-5xl font-black text-center mb-12 tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", color: "#1A1A1A" }}>Zero-Friction Integration</h2>
          </Reveal>
          <Reveal delay={0.14}>
            <CodeExplorer />
          </Reveal>
        </div>
      </section>

      {/* Stats — stagger + tilt */}
      <section className="py-28 relative z-10 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { value: "49", label: "Detection Patterns" },
              { value: "7", label: "Attack Categories" },
              { value: "0%", label: "Violation Rate" },
              { value: "<0.5%", label: "Token Overhead" },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <TiltCard className="group relative rounded-2xl p-8 text-center overflow-hidden" style={{ background: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 14px rgba(0,0,0,0.04)" } as any} glow="rgba(13,124,95,0.12)">
                  <motion.div className="text-4xl font-black" style={{ fontFamily: "var(--font-space-grotesk)", color: "#0D7C5F" }} initial={{ y: 10, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.55, delay: 0.1 + i * 0.05 }}>{s.value}</motion.div>
                  <div className="text-sm font-semibold mt-2" style={{ color: "#5A5248" }}>{s.label}</div>
                  <motion.span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[2px] rounded-full" style={{ background: "linear-gradient(90deg, transparent, #0D7C5F, transparent)" }} initial={{ width: 0, opacity: 0 }} whileInView={{ width: "66%", opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.35 + i * 0.07 }} />
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection />

      <footer className="py-8" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs" style={{ color: "#7A7164" }}>
          <div>AgentShield v1.0.0 — Minor Project, BTech CSE AIML</div>
          <div>ITM University Gwalior</div>
        </div>
      </footer>
    </div>
  );
}
