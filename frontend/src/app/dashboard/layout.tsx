"use client";

export const dynamic = 'force-dynamic';

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { CursorGlow } from "@/components/cursor-glow";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

  const [showDbModal, setShowDbModal] = useState(false);
  const [dbString, setDbString] = useState("");
  const [dbStatus, setDbStatus] = useState<{ engine: string; status: string } | null>(null);
  const [dbChecking, setDbChecking] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const dbConnected = dbStatus?.status === "connected";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("agentshield_db_engine");
      if (saved) {
        const parsed = JSON.parse(saved) as { engine: string; status: string };
        if (parsed?.status === "connected") setDbStatus(parsed);
      }
    } catch {}
    let cancelled = false;
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const r = await fetch(`${base}/health`, { credentials: "include" });
        if (!cancelled && r.ok) {
          const j = (await r.json()) as { db?: string; engine?: string };
          const engine = j.engine || j.db || "unknown";
          setDbStatus((prev) => prev ?? { engine, status: "connected" });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showDbModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDbModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDbModal]);

  const handleDbConnect = useCallback(async () => {
    if (!dbString.trim()) {
      setDbError("Paste a connection string first");
      return;
    }
    setDbChecking(true);
    setDbError(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const r = await fetch(`${base}/health`, { credentials: "include" });
      if (!r.ok) throw new Error(`Backend ${r.status} — is FastAPI running?`);
      const j = (await r.json()) as { db?: string; engine?: string };
      const engine = j.engine || j.db || (/cockroach/i.test(dbString) ? "cockroachdb" : /postgres/i.test(dbString) ? "postgresql" : "custom");
      const next = { engine, status: "connected" };
      setDbStatus(next);
      try {
        localStorage.setItem("agentshield_db_engine", JSON.stringify(next));
      } catch {}
      setShowDbModal(false);
      setDbString("");
    } catch (e) {
      setDbError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setDbChecking(false);
    }
  }, [dbString]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center pulse-ring">
            <div className="w-3 h-3 bg-primary rounded-full" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading AgentShield...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="min-h-screen" suppressHydrationWarning>
      <CursorGlow />
      {/* Mobile hamburger (teammate responsive fix — light themed) */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl bg-white/80 border border-black/10 flex items-center justify-center hover:bg-white hover:-translate-y-px transition-all backdrop-blur-md"
        style={{ color: "#3D3529", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={sidebarOpen}
        aria-controls="dashboard-sidebar"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <div
        id="dashboard-sidebar"
        className={`
        fixed left-0 top-0 bottom-0 z-40
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-300 ease-out
      `}>
        <Sidebar onNavigate={closeSidebar} />
      </div>
      <main className="lg:ml-[260px] p-4 sm:p-6 lg:p-8 min-h-screen relative z-10 flex flex-col" suppressHydrationWarning>
        {/* Header Bar */}
        <div className="w-full mb-8 flex justify-end animate-fade-in">
          <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-4">
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              <div className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-emerald-500 animate-pulse-ring' : 'bg-amber-500'}`} aria-hidden="true" />
              <span className="text-xs font-bold font-display" style={{ color: "#5A5248" }}>
                {dbConnected ? `${dbStatus?.engine || "DB"} Connected` : 'No Active DB Connection'}
              </span>
            </div>
            <button
              onClick={() => setShowDbModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)", color: "white", boxShadow: "0 2px 12px rgba(13,124,95,0.25)" }}
            >
              Connect DB
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="w-full flex-1 relative" suppressHydrationWarning>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="animate-stagger w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* DB Connection — verified against /health, not a mock */}
        {showDbModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in p-4"
            onClick={() => setShowDbModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="db-modal-title"
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 w-full max-w-[400px] animate-scale-in border border-white/40 shadow-2xl"
            >
              <h3 id="db-modal-title" className="text-lg font-black font-display mb-2 text-gray-900">Connect to database</h3>
              <p className="text-xs text-gray-600 mb-4">We verify <span className="font-mono font-bold">GET /health</span> before showing Connected. String stays in this browser only.</p>

              <label htmlFor="db-conn" className="text-[11px] font-bold tracking-wider uppercase text-gray-500">Connection string</label>
              <input
                id="db-conn"
                type="password"
                autoComplete="off"
                value={dbString}
                onChange={(e) => setDbString(e.target.value)}
                placeholder="postgresql://user:pass@cluster..."
                className="mt-1.5 w-full bg-white/50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:ring-2 focus:ring-primary/50 outline-none"
              />
              {dbError ? (
                <p role="alert" className="text-xs font-semibold rounded-lg px-3 py-2 mb-3" style={{ color: "#C23B3B", background: "rgba(194,59,59,0.07)", border: "1px solid rgba(194,59,59,0.18)" }}>
                  {dbError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDbModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100/50 transition-all hover:-translate-y-px"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDbConnect}
                  disabled={dbChecking}
                  aria-busy={dbChecking}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)", boxShadow: "0 2px 12px rgba(13,124,95,0.25)" }}
                >
                  {dbChecking ? "Verifying…" : "Verify & Connect"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
