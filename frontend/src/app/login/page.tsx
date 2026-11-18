"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { motion } from "framer-motion";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { login, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";

  useEffect(() => {
    if (!authLoading && token) router.replace("/dashboard");
  }, [authLoading, token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-white selection:bg-emerald-500/30 overflow-hidden">
      
      {/* LEFT PANEL - Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 xl:px-24 relative z-10 bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px] mx-auto"
        >
          {/* Logo */}
          <div className="mb-12">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 transition-transform duration-500 group-hover:scale-110" />
              <span className="relative z-10 font-black text-white text-lg tracking-tighter">AS</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-[2.5rem] leading-tight font-black tracking-[-0.04em] text-gray-900 mb-3">
              Welcome back
            </h1>
            <p className="text-[15px] font-medium text-gray-500">
              Enter your credentials to access AgentShield.
            </p>
          </div>

          {/* Session expired banner */}
          {sessionExpired && (
            <div role="status" className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#ef4444" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c.762 0 1.503-.423 1.948-3.374L13.949 3.378c-.866-1.5-.217-3.374 1.948-3.374h1.143c.762 0 1.503.423 1.948 1.132l10.543 17.5c.545.907-.08 1.948-1.948 1.948H3.375c-1.948 0-3.153-1.041-2.607-1.948L12 13.127V9" />
              </svg>
              <div>
                <p className="text-sm font-bold text-red-600">Session expired</p>
                <p className="mt-0.5 text-xs font-medium text-gray-500">Your session has timed out. Please sign in again to continue.</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate={false}>
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-[13px] font-bold tracking-wide text-gray-700 uppercase">Email</label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-xl opacity-0 group-focus-within:opacity-20 transition duration-300 blur-sm" aria-hidden="true" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-invalid={formError ? true : undefined}
                  aria-describedby={formError ? "login-error" : undefined}
                  className="relative w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-[15px] font-medium text-gray-900 outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder-gray-400"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-[13px] font-bold tracking-wide text-gray-700 uppercase">Password</label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-xl opacity-0 group-focus-within:opacity-20 transition duration-300 blur-sm" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={formError ? true : undefined}
                  aria-describedby={formError ? "login-error" : undefined}
                  className="relative w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 text-[15px] font-medium text-gray-900 outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder-gray-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {formError ? (
              <p id="login-error" role="alert" className="text-[13px] font-semibold rounded-xl px-4 py-3" style={{ color: "#C23B3B", background: "rgba(194,59,59,0.07)", border: "1px solid rgba(194,59,59,0.18)" }}>
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="relative w-full group overflow-hidden rounded-xl py-3.5 mt-2 disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-gray-900 transition-transform duration-300 group-hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center gap-2 text-[15px] font-bold text-white">
                {loading ? (
                  <svg className="w-5 h-5 animate-spin text-white/70" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  "Sign in to your account"
                )}
                {!loading && (
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </div>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[14px] font-medium text-gray-500">
              Don't have an account?{" "}
              <Link href="/register" className="text-emerald-600 font-bold hover:text-emerald-500 transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* RIGHT PANEL - Beautiful Animated Showcase */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-[#0A0F14] items-center justify-center overflow-hidden">
        {/* Animated Grid Background */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
        }} />

        {/* Dynamic Glowing Lines & Shapes */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none">
          {/* Rotating Conic Gradient */}
          <div className="absolute inset-0 rounded-full animate-spin-slow opacity-30 blur-2xl" 
               style={{ background: 'conic-gradient(from 0deg, transparent 0 340deg, #10B981 360deg)' }} />
               
          {/* Inner Glowing Core */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 blur-[80px] rounded-full animate-pulse-ring" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-teal-400/20 blur-[60px] rounded-full" />
        </div>

        {/* Floating Abstract UI Elements */}
        <motion.div 
          animate={{ y: [-15, 15, -15], rotate: [-2, 2, -2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10 w-[380px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6 shadow-[0_0_80px_rgba(16,185,129,0.15)]"
        >
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold tracking-wide">Continuous Verification</h3>
              <p className="text-emerald-400/80 text-sm font-mono mt-1">Hash chain valid</p>
            </div>
          </div>
          
          <div className="space-y-4" aria-hidden="true">
            {[80, 60, 40].map((w, idx) => (
              <div key={w} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-white/20'}`} />
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${w}%`, opacity: w / 100 }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Additional decorative floating elements */}
        <motion.div 
          animate={{ y: [10, -10, 10], x: [5, -5, 5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute right-24 top-32 w-48 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
        >
          <div className="text-xs font-bold text-white/50 tracking-wider uppercase mb-2">Integrity</div>
          <div className="text-2xl font-black text-white">100<span className="text-emerald-400">%</span></div>
        </motion.div>

        <motion.div 
          animate={{ y: [-20, 20, -20], x: [-10, 10, -10] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute left-16 bottom-32 w-56 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
        >
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
               <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
             </div>
             <div>
               <div className="text-sm font-bold text-white">Memory Synced</div>
               <div className="text-[10px] text-indigo-300 font-mono">Just now</div>
             </div>
           </div>
        </motion.div>
        
        {/* Glow corner accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
