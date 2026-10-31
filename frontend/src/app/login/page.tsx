"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { CursorGlow } from "@/components/cursor-glow";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && token) {
      router.push("/dashboard");
    }
  }, [authLoading, token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F8F4ED" }}>
      <CursorGlow />
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-float" style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)", boxShadow: "0 8px 32px rgba(13,124,95,0.3)" }}>
            <span className="font-black text-white text-xl font-display">AS</span>
          </div>
          <h1 className="text-4xl font-black font-display tracking-tight" style={{ color: "#1A1A1A" }}>
            Welcome back
          </h1>
          <p className="mt-2 text-base font-medium" style={{ color: "#5A5248" }}>
            Log in to AgentShield
          </p>
        </div>

        {/* Session expired banner */}
        {sessionExpired && (
          <div className="mb-4 rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#f87171">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-bold" style={{ color: "#f87171" }}>Session Expired</p>
              <p className="text-xs mt-0.5" style={{ color: "#5A5248" }}>Your session has timed out. Please sign in again to continue.</p>
            </div>
          </div>
        )}

        <div className="glass-card rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold tracking-wider uppercase mb-2" style={{ color: "#5A5248" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-250"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wider uppercase mb-2" style={{ color: "#5A5248" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-250"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)", boxShadow: "0 4px 20px rgba(13,124,95,0.3)" }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm font-medium" style={{ color: "#5A5248" }}>
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-bold hover-underline" style={{ color: "#0D7C5F" }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F4ED" }}>
        <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
