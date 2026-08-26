"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { CursorGlow } from "@/components/cursor-glow";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, fullName);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
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
            Create your account
          </h1>
          <p className="mt-2 text-base font-medium" style={{ color: "#5A5248" }}>
            Start protecting your agent memory
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold tracking-wider uppercase mb-2" style={{ color: "#5A5248" }}>Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-250"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
                placeholder="Your name"
              />
            </div>
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
                minLength={8}
                className="w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-250"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
                placeholder="Min. 8 characters"
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
                  Creating account...
                </span>
              ) : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm font-medium" style={{ color: "#5A5248" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-bold hover-underline" style={{ color: "#0D7C5F" }}>
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
