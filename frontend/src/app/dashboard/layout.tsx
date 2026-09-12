"use client";

export const dynamic = 'force-dynamic';

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { CursorGlow } from "@/components/cursor-glow";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

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
    <div className="min-h-screen bg-[#050505]" suppressHydrationWarning>
      <CursorGlow />
      <Sidebar />
      <main className="ml-[240px] p-8 min-h-screen relative z-10" suppressHydrationWarning>
        <div className="max-w-5xl animate-stagger" suppressHydrationWarning>
          {children}
        </div>
      </main>
    </div>
  );
}
