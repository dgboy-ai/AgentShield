"use client";

export const dynamic = 'force-dynamic';

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { CursorGlow } from "@/components/cursor-glow";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 bg-[#10B981]/10 rounded-2xl flex items-center justify-center">
            <div className="w-3 h-3 bg-[#10B981] rounded-full animate-pulse" />
          </div>
          <p className="text-sm text-white/40 font-medium">Loading AgentShield...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-[#050505]" suppressHydrationWarning>
      <CursorGlow />

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-16 bg-[#050505]/90 border-b border-white/5 backdrop-blur-xl px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/70 hover:text-white"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#10B981] flex items-center justify-center">
              <span className="font-bold text-black text-[9px]" style={{ fontFamily: "var(--font-space-grotesk)" }}>AS</span>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-white/90" style={{ fontFamily: "var(--font-space-grotesk)" }}>AgentShield</span>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed inset-y-0 left-0 z-50 transition-transform duration-300 h-full`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="md:ml-[240px] p-4 pt-20 md:p-8 min-h-screen relative z-10 overflow-x-hidden" suppressHydrationWarning>
        <div className="max-w-6xl mx-auto" suppressHydrationWarning>
          {children}
        </div>
      </main>
    </div>
  );
}
