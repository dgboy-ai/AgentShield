"use client";

import { useEffect, useRef } from "react";

/**
 * Lightweight, high-performance static hero background.
 * Zero CPU animation loops, zero canvas RAF overhead, zero composite repaint lag.
 */
export default function HeroShield() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse 65% 55% at 50% 32%, #08291F 0%, #03140F 45%, #02060F 90%)",
      }}
      aria-hidden="true"
    >
      {/* Soft emerald / cyan background glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 700px 380px at 50% 28%, rgba(16,185,129,0.18), transparent 75%), radial-gradient(ellipse 500px 300px at 80% 40%, rgba(34,211,238,0.10), transparent 75%)",
        }}
      />

      {/* Clean, static technical grid with soft vignette mask */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.9) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 40%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 40%, black 20%, transparent 80%)",
        }}
      />

      {/* Subtle top border accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(52,211,153,0.4) 30%, rgba(34,211,238,0.4) 70%, transparent)",
        }}
      />

      {/* Smooth bottom fade to page background */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(2,6,15,0.7) 60%, #02060F 100%)",
        }}
      />
    </div>
  );
}
