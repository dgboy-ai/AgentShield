"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/** AgentShield shield mark — hash-linked nodes + verification check. */
export function ShieldMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden rounded-xl transition-transform duration-300 group-hover:rotate-[6deg] group-hover:scale-[1.05]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg,#0B5C47 0%,#0D7C5F 45%,#10B981 100%)",
        boxShadow: "0 2px 12px rgba(13,124,95,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="as-chain" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <path
          d="M12 2.5 20 6v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6l8-3.5Z"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <circle cx="9" cy="10.5" r={1.5} fill="url(#as-chain)" />
        <circle cx="15" cy="10.5" r={1.5} fill="url(#as-chain)" />
        <path d="M10.2 10.5h3.6" stroke="#A7F3D0" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M9.3 14.8l2 2 3.6-4" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <motion.span
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)", backgroundSize: "210% 100%" }}
        animate={{ backgroundPosition: ["-130% 0", "170% 0"] }}
        transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 3.4, ease: "easeInOut" }}
        aria-hidden="true"
      />
    </span>
  );
}

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4" aria-label="AgentShield home">
      <ShieldMark size={compact ? 32 : 36} />
      <span className="leading-none">
        <span className="block font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: compact ? 14 : 15 }}>
          AgentShield
        </span>
        {!compact ? (
          <span className="mt-1 block font-mono text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: "rgba(110,231,183,0.75)" }}>
            Memory Defense
          </span>
        ) : null}
      </span>
    </Link>
  );
}
