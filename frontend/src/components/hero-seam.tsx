"use client";

import { motion } from "framer-motion";

const STATS = [
  { value: "49", label: "ASI06 patterns" },
  { value: "0%", label: "violation post-pin" },
  { value: "<0.5%", label: "token overhead" },
  { value: "SHA-256", label: "hash-chained" },
];

/** Melt between the dark hero and the cream body: gradient wash + bridging proof ticker. */
export function HeroSeam() {
  return (
    <div className="relative z-10" aria-hidden="true">
      {/* gradient melt: ink → moss → cream */}
      <div
        style={{
          height: 110,
          background: "linear-gradient(to bottom, #020412 0%, #0A1B14 38%, #46564A 72%, #F8F4ED 100%)",
        }}
      />

      {/* bridging proof ticker */}
      <div style={{ background: "#F8F4ED" }}>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-4xl px-6"
        >
          <div
            className="relative -mt-24 overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
            style={{
              background: "rgba(12,16,18,0.94)",
              border: "1px solid rgba(52,211,153,0.28)",
              boxShadow: "0 22px 55px rgba(0,0,0,0.32)",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.9), rgba(34,211,238,0.7), transparent)" }}
            />
            <div className="grid grid-cols-2 divide-white/5 sm:grid-cols-4 sm:divide-x">
              {STATS.map((s) => (
                <div key={s.label} className="group px-5 py-5 text-center transition-colors duration-200 hover:bg-white/[0.04]">
                  <div
                    className="font-black tracking-tight"
                    style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 26, color: "#fff" }}
                  >
                    {s.value}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(110,231,183,0.8)" }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#34D399", boxShadow: "0 0 8px rgba(52,211,153,0.9)" }} />
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="h-[2px] opacity-80"
              style={{ background: "linear-gradient(90deg, transparent, #10B981 25%, #22D3EE 55%, #A78BFA 80%, transparent)" }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
