"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Logo, ShieldMark } from "@/components/logo";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/docs", label: "Docs" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    let y0 = window.scrollY;
    lastYRef.current = y0;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      if (!open) {
        if (y < 90) setHidden(false);
        else if (y > y0 + 5) setHidden(true);
        else if (y < y0 - 5) setHidden(false);
      }
      y0 = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
    <motion.header
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: hidden && !open ? "-115%" : "0%", opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-3 sm:px-4"
      aria-hidden={hidden && !open}
    >
      <nav
        aria-label="Primary"
        className={`mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border transition-all duration-300 ${
          scrolled ? "mt-2 shadow-2xl" : "mt-3"
        }`}
        style={{
          height: scrolled ? 56 : 64,
          padding: "0 12px 0 14px",
          background: scrolled ? "rgba(10,15,20,0.82)" : "rgba(10,15,20,0.55)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderColor: scrolled ? "rgba(52,211,153,0.28)" : "rgba(255,255,255,0.1)",
          boxShadow: scrolled
            ? "0 14px 44px rgba(0,0,0,0.45), 0 0 0 1px rgba(52,211,153,0.08), 0 0 28px rgba(16,185,129,0.12)"
            : "0 8px 28px rgba(0,0,0,0.3)",
        }}
      >
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href === "/docs" ? pathname?.startsWith("/docs") : pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="group relative rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition-all duration-200 hover:-translate-y-px"
                style={{ color: active ? "#6EE7B7" : "rgba(255,255,255,0.78)" }}
              >
                {l.label}
                <span
                  className="absolute inset-x-3 -bottom-px h-px transition-all duration-300"
                  style={{
                    background: "linear-gradient(90deg, transparent, #34D399, transparent)",
                    opacity: active ? 1 : 0,
                    transform: active ? "scaleX(1)" : "scaleX(0.4)",
                  }}
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ background: "rgba(52,211,153,0.1)" }}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-[13.5px] font-bold transition-all duration-200 hover:-translate-y-px hover:text-white"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="group relative overflow-hidden rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white transition-all duration-200 hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg,#0D7C5F,#10B981)", boxShadow: "0 4px 18px rgba(16,185,129,0.4)" }}
          >
            <span className="relative z-10 flex items-center gap-1.5">
              Get Started
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
            </span>
            <span
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)", backgroundSize: "200% 100%" }}
              aria-hidden="true"
            />
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white transition-all duration-200 hover:-translate-y-px md:hidden"
          style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)" }}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true" className="text-lg leading-none">{open ? "✕" : "☰"}</span>
        </button>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-2 max-w-6xl overflow-hidden rounded-2xl border md:hidden"
            style={{ background: "rgba(10,15,20,0.92)", backdropFilter: "blur(22px)", borderColor: "rgba(52,211,153,0.25)", boxShadow: "0 18px 50px rgba(0,0,0,0.5)" }}
          >
            <div className="flex flex-col p-3">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-xl px-4 py-3 text-sm font-bold text-white/85 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
              <div className="my-2 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="grid grid-cols-2 gap-2 p-1">
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-3 text-center text-sm font-bold text-white/85 transition-colors hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl px-4 py-3 text-center text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#0D7C5F,#10B981)" }}
                >
                  Get Started →
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>

    {/* floating reopen pill — appears once the bar auto-hides on scroll */}
    <AnimatePresence>
      {hidden && !open && scrolled ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => {
            lastYRef.current = window.scrollY;
            setHidden(false);
          }}
          className="group fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full py-2 pl-2.5 pr-4 transition-all duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: "rgba(10,15,20,0.88)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(52,211,153,0.35)",
            boxShadow: "0 10px 32px rgba(0,0,0,0.45), 0 0 20px rgba(16,185,129,0.18)",
          }}
          aria-label="Show navigation"
        >
          <ShieldMark size={26} />
          <span className="font-mono text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: "#6EE7B7" }}>
            Menu
          </span>
          <span className="text-[13px] transition-transform duration-200 group-hover:translate-y-0.5" style={{ color: "#6EE7B7" }} aria-hidden="true">↓</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
    </>
  );
}
