"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// ──────────────────────────────────────────────
//  Lightweight sparkle field — no three.js, pure 2D canvas
//  ~45 particles, RAF, respects prefers-reduced-motion
// ──────────────────────────────────────────────
function SparkleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0;
    const particles: { x: number; y: number; r: number; o: number; vx: number; vy: number; c: string }[] = [];
    const colors = ["#10B981", "#34D399", "#22D3EE", "#A78BFA", "#FBBF24"];
    const COUNT = 44;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width * dpr;
      h = rect.height * dpr;
      canvas!.width = w;
      canvas!.height = h;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * 1200,
        y: Math.random() * 700,
        r: Math.random() * 1.6 + 0.4,
        o: Math.random() * 0.5 + 0.2,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        c: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let t = 0;
    let cw = 0;
    let ch = 0;
    let visible = true;
    const syncSize = () => {
      const rect = canvas!.getBoundingClientRect();
      cw = rect.width;
      ch = rect.height;
    };
    function frame() {
      if (!ctx || !canvas) return;
      if (!visible) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      ctx.clearRect(0, 0, cw, ch);
      t += 0.008;
      for (const p of particles) {
        p.x += p.vx + Math.sin(t + p.y * 0.01) * 0.12;
        p.y += p.vy + Math.cos(t + p.x * 0.01) * 0.12;
        // wrap
        if (p.x < -20) p.x = cw + 20;
        if (p.x > cw + 20) p.x = -20;
        if (p.y < -20) p.y = ch + 20;
        if (p.y > ch + 20) p.y = -20;

        const tw = 0.55 + Math.sin(t * 2 + p.x) * 0.45;
        ctx.globalAlpha = p.o * tw;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        // 4-point star
        const r = p.r;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        // cross glare for larger
        if (r > 1.1) {
          ctx.globalAlpha = p.o * tw * 0.45;
          ctx.fillRect(p.x - r * 3, p.y - 0.35, r * 6, 0.7);
          ctx.fillRect(p.x - 0.35, p.y - r * 3, 0.7, r * 6);
        }
      }
      // draw faint connecting lines between close particles
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.globalAlpha = (1 - d / 110) * 0.08;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(() => {
      resize();
      syncSize();
    });
    ro.observe(canvas);
    resize();
    syncSize();
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    io.observe(canvas);
    const onVis = () => {
      visible = !document.hidden && (io ? true : true);
    };
    document.addEventListener("visibilitychange", onVis);
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!mql.matches) frame();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

// ──────────────────────────────────────────────
//  Animated mesh blobs (Framer) — soft aurora orbs
// ──────────────────────────────────────────────
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

function AuroraBlobs() {
  const reduced = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute rounded-full blur-[70px]"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0) 70%)", width: 720, height: 720, left: "8%", top: "6%" }}
        animate={reduced ? {} : { x: [0, 28, -18, 0], y: [0, -22, 18, 0], scale: [1, 1.06, 0.97, 1] }}
        transition={{ duration: 14, repeat: reduced ? 0 : Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full blur-[80px]"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,0.22) 0%, rgba(6,182,212,0) 70%)", width: 640, height: 640, right: "10%", top: "18%" }}
        animate={reduced ? {} : { x: [0, -30, 20, 0], y: [0, 24, -16, 0], scale: [1, 0.96, 1.04, 1] }}
        transition={{ duration: 16, repeat: reduced ? 0 : Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute rounded-full blur-[90px]"
        style={{ background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0) 70%)", width: 800, height: 800, left: "32%", bottom: "-12%" }}
        animate={reduced ? {} : { x: [0, 18, -24, 0], y: [0, -14, 10, 0], scale: [1, 1.03, 0.99, 1] }}
        transition={{ duration: 18, repeat: reduced ? 0 : Infinity, ease: "easeInOut", delay: 0.6 }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
//  Hash-chain line — SVG dash animation
// ──────────────────────────────────────────────
function HashChainLine() {
  return (
    <motion.svg
      className="absolute left-1/2 -translate-x-1/2 top-[52%] w-[88%] max-w-[980px] h-[2px] pointer-events-none hidden md:block"
      viewBox="0 0 980 2"
      preserveAspectRatio="none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.2, duration: 1 }}
      aria-hidden
    >
      <line x1="0" y1="1" x2="980" y2="1" stroke="rgba(16,185,129,0.0)" strokeWidth={2} />
      <motion.line
        x1="0"
        y1="1"
        x2="980"
        y2="1"
        stroke="url(#hg)"
        strokeWidth={1.5}
        strokeDasharray="8 12"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -80 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
      />
      <defs>
        <linearGradient id="hg" x1="0" x2="1">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="18%" stopColor="rgba(16,185,129,0.55)" />
          <stop offset="50%" stopColor="rgba(34,211,238,0.55)" />
          <stop offset="82%" stopColor="rgba(167,139,250,0.45)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}

export default function HeroShield() {
  // subtle mouse parallax for blobs vs sparkles
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 20 });
  const sy = useSpring(my, { stiffness: 50, damping: 20 });
  const blobX = useTransform(sx, [-0.5, 0.5], [-14, 14]);
  const blobY = useTransform(sy, [-0.5, 0.5], [-10, 10]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function onMove(e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <div
      onMouseMove={onMove}
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 70% 52% at 22% 30%, rgba(16,185,129,0.22) 0%, transparent 62%), radial-gradient(ellipse 60% 48% at 82% 34%, rgba(34,211,238,0.14) 0%, transparent 60%), radial-gradient(ellipse 66% 56% at 58% 88%, rgba(167,139,250,0.13) 0%, transparent 62%), radial-gradient(ellipse 92% 74% at 50% 36%, #0B3225 0%, #061A14 34%, #020412 74%)",
      }}
    >
      {/* rotating conic sheen */}
      <motion.div
        className="absolute left-1/2 top-[30%] pointer-events-none"
        style={{
          width: 1100,
          height: 1100,
          x: "-50%",
          y: "-50%",
          background: "conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.07) 60deg, transparent 120deg, transparent 200deg, rgba(34,211,238,0.06) 260deg, transparent 320deg)",
          filter: "blur(30px)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        aria-hidden="true"
      />
      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.9) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(ellipse 72% 62% at 50% 44%, black 38%, transparent 78%)",
        }}
      />
      {/* perspective floor grid fading to horizon */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none hidden md:block"
        style={{
          height: "34%",
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.35) 1px, transparent 1px)",
          backgroundSize: "44px 22px",
          transform: "perspective(520px) rotateX(58deg) scale(1.6)",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(to top, black 20%, transparent 90%)",
          opacity: 0.16,
        }}
        aria-hidden="true"
      />
      {/* horizon glow where floor meets content */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          bottom: "16%",
          height: 120,
          background: "radial-gradient(ellipse 60% 100% at 50% 100%, rgba(16,185,129,0.16), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* aurora */}
      <motion.div style={{ x: blobX, y: blobY }} className="absolute inset-0">
        <AuroraBlobs />
      </motion.div>

      {/* sparkles */}
      {mounted && <SparkleField />}

      {/* soft vignette orbs glow behind content */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 420px 420px at 18% 48%, rgba(16,185,129,0.14), transparent 72%), radial-gradient(ellipse 380px 380px at 82% 62%, rgba(6,182,212,0.10), transparent 72%)",
        }}
      />
      {/* film grain for depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
        }}
        aria-hidden="true"
      />

      {/* wall highlight frame */}
      <div
        className="absolute left-1/2 top-[13%] -translate-x-1/2 w-[88%] max-w-[1120px] h-[60%] rounded-[2.6rem] pointer-events-none hidden md:block"
        style={{
          background: "linear-gradient(to bottom, rgba(16,185,129,0.07), transparent 22%, transparent 78%, rgba(2,4,18,0.35))",
          border: "1px solid rgba(16,185,129,0.11)",
          boxShadow: "inset 0 1px 0 rgba(16,185,129,0.10), 0 0 90px rgba(16,185,129,0.09)",
        }}
      />

      <HashChainLine />

      {/* top shimmer line */}
      <motion.div
        className="absolute top-0 left-0 h-[1px] w-full opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.55) 20%, rgba(34,211,238,0.5) 50%, rgba(167,139,250,0.45) 80%, transparent)" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* vignettes for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(2,4,18,0.08) 0%, transparent 34%, rgba(2,4,18,0.52) 84%, #020412 100%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 46%, rgba(2,4,18,0.38) 100%)" }}
      />
    </div>
  );
}
