"use client";

import { useEffect, useRef } from "react";

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    const dot = dotRef.current;
    if (!el || !dot) return;

    let raf = 0;
    let tx = -200, ty = -200;
    let cx = -200, cy = -200;
    let dx = -200, dy = -200;

    function onMove(e: MouseEvent) {
      tx = e.clientX;
      ty = e.clientY;
      // immediate dot
      dot!.style.left = `${e.clientX}px`;
      dot!.style.top = `${e.clientY}px`;
    }
    function onEnter(e: Event) {
      const t = e.target as HTMLElement;
      if (t.closest("a, button, [data-hover-glow]")) {
        el!.style.width = "680px";
        el!.style.height = "680px";
        el!.style.opacity = "1";
      }
    }
    function onLeave(e: Event) {
      const t = e.target as HTMLElement;
      if (t.closest("a, button, [data-hover-glow]")) {
        el!.style.width = "500px";
        el!.style.height = "500px";
      }
    }
    function loop() {
      cx += (tx - cx) * 0.075;
      cy += (ty - cy) * 0.075;
      // trail easing slightly faster for inner
      dx += (tx - dx) * 0.18;
      dy += (ty - dy) * 0.18;
      el!.style.left = `${cx}px`;
      el!.style.top = `${cy}px`;
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onEnter);
    document.addEventListener("mouseout", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onEnter);
      document.removeEventListener("mouseout", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ref} className="cursor-glow" />
      <div
        ref={dotRef}
        className="fixed w-[6px] h-[6px] rounded-full pointer-events-none z-[45] -translate-x-1/2 -translate-y-1/2 hidden md:block"
        style={{ background: "#0D7C5F", boxShadow: "0 0 10px rgba(13,124,95,0.55)", left: -100, top: -100 }}
        aria-hidden="true"
      />
    </>
  );
}
