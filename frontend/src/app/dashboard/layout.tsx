"use client";

export const dynamic = 'force-dynamic';

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 bg-[#10B981]/10 rounded-2xl flex items-center justify-center pulse-ring">
            <div className="w-3 h-3 bg-[#10B981] rounded-full" />
          </div>
          <p className="text-sm text-white/40 font-medium" style={{ fontFamily: "var(--font-space-grotesk)" }}>Loading AgentShield...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-[#050505]" suppressHydrationWarning>
      <CursorGlow />
      {/* Mobile hamburger */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md"
        aria-label="Toggle sidebar"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 bottom-0 z-40
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-300 ease-out
      `}>
        <Sidebar onNavigate={closeSidebar} />
      </div>
      <main className="lg:ml-[240px] min-h-screen relative z-10">
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1440px] mx-auto">
          <div className="animate-stagger" suppressHydrationWarning>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
