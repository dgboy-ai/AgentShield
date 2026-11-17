"use client";

export const dynamic = 'force-dynamic';

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";

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
      <div className="dashboard-shell flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFDF5] ring-1 ring-[#A7F3D0]">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[#059669]" />
          </div>
          <p className="text-sm font-medium text-[#475569]">Loading AgentShield...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="dashboard-shell min-h-screen bg-[#F5F7FA]" suppressHydrationWarning>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#0F172A]/30 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div
        className={`
          fixed bottom-0 left-0 top-0 z-40
          transition-transform duration-300 ease-out
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar onNavigate={closeSidebar} />
      </div>

      <main className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#172033]"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#059669]">
              <span className="font-heading text-[10px] font-bold text-white">AS</span>
            </div>
            <span className="font-heading text-[15px] font-bold text-[#172033]">AgentShield</span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8 xl:px-10">
          <div className="animate-fade-in" suppressHydrationWarning>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
