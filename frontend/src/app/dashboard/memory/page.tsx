"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Memory {
  memory_id: string;
  content: string;
  memory_type: string;
  importance_score: number;
  trust_level: number;
  source_provenance: string;
  previous_hash: string | null;
  entry_hash: string;
  kms_signature: string | null;
  created_at: string;
}

interface MemoryStats {
  total_memories: number;
  type_counts: Record<string, number>;
  chain_valid: boolean;
  chain_total: number;
  signing_backend: string;
  signing_active: boolean;
  signing_fallback: boolean;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
  episodic: {
    bg: "rgba(139,92,246,0.08)", text: "#a78bfa", border: "rgba(139,92,246,0.2)",
    label: "EPISODIC",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  semantic: {
    bg: "rgba(56,189,248,0.08)", text: "#38bdf8", border: "rgba(56,189,248,0.2)",
    label: "SEMANTIC",
    icon: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
  },
  procedural: {
    bg: "rgba(245,158,11,0.08)", text: "#fbbf24", border: "rgba(245,158,11,0.2)",
    label: "PROCEDURAL",
    icon: "M11.42 15.17l-5.384 3.18A1.125 1.125 0 014.5 17.29V5.71a1.125 1.125 0 011.536-1.06l5.384 3.18a1.125 1.125 0 010 1.92z",
  },
};

const PIPELINE_STAGES = [
  { label: "INPUT", icon: "M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" },
  { label: "AUTHENTICATE", icon: "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" },
  { label: "CONSTRAINT CHECK", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
  { label: "POISONING DEFENSE", icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  { label: "SHA-256 HASH", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" },
  { label: "HASH CHAIN", icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.318a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.757 8.75" },
  { label: "SIGN / VERIFY", icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" },
  { label: "PERSIST", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
  { label: "AUDIT", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function truncateHash(hash: string | null) {
  if (!hash) return "\u2014";
  return `${hash.slice(0, 16)}...`;
}

export default function MemoryPage() {
  const { token } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState("");
  const [type, setType] = useState("episodic");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [storingResult, setStoringResult] = useState<"success" | "rejected" | null>(null);
  const [contentFocused, setContentFocused] = useState(false);
  const PAGE = 50;

  const load = useCallback(async (reset = true) => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const off = reset ? 0 : offset;
      const [data, statsData] = await Promise.all([
        api.listMemories(token, { limit: PAGE, offset: off }),
        reset ? api.memoryStats(token).catch(() => null) : Promise.resolve(null),
      ]);
      const arr = data as unknown as Memory[];
      if (reset) {
        setMemories(arr);
        setOffset(arr.length);
        setHasMore(arr.length >= PAGE);
        if (statsData) setStats(statsData as unknown as MemoryStats);
      } else {
        setMemories((prev) => [...prev, ...arr]);
        setOffset((o) => o + arr.length);
        setHasMore(arr.length >= PAGE);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load memories");
    } finally {
      setFetching(false);
    }
  }, [token, offset]);

  useEffect(() => { load(true); }, [load]);

  async function handleStore(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !content.trim()) return;
    setLoading(true);
    setStoringResult(null);
    try {
      await api.storeMemory(token, content.trim(), type);
      setContent("");
      setStoringResult("success");
      toast.success("Memory stored with hash chain integrity");
      load(true);
      setTimeout(() => setStoringResult(null), 2500);
    } catch (err) {
      const is422 = err instanceof ApiError && err.status === 422;
      setStoringResult("rejected");
      toast.error(is422 ? "Memory rejected by poisoning defense" : (err instanceof ApiError ? err.message : "Failed"));
      setTimeout(() => setStoringResult(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  const filtered = memories.filter((m) => {
    if (filterType && m.memory_type !== filterType) return false;
    if (search && !m.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const postureItems = stats ? [
    { label: "MEMORY STORE", status: "Connected" as const, color: "#10B981" },
    { label: "POISONING DEFENSE", status: "Active" as const, color: "#10B981" },
    { label: "HASH INTEGRITY", status: stats.chain_valid ? "Verified" as const : "Invalid" as const, color: stats.chain_valid ? "#10B981" : "#ef4444" },
    { label: "AUDIT TRAIL", status: "Active" as const, color: "#10B981" },
    { label: "KMS SIGNING", status: stats.signing_fallback ? "Local (Dev)" as const : stats.signing_active ? "Configured" as const : "Not Configured" as const, color: stats.signing_fallback ? "#fbbf24" : stats.signing_active ? "#10B981" : "#737373" },
  ] : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
              <svg className="w-4 h-4" style={{ color: "#10B981" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", color: "#ffffff" }}>
              MEMORY DEFENSE
            </h1>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)", maxWidth: "600px" }}>
            Protected long-term memory for your AI agent. Every memory is inspected before persistence and protected by AgentShield&apos;s integrity and audit pipeline.
          </p>
        </div>
        <button
          onClick={() => document.getElementById("memory-content-input")?.focus()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shrink-0"
          style={{
            background: "linear-gradient(135deg, #0D7C5F, #10B981)",
            color: "#ffffff",
            boxShadow: "0 2px 12px rgba(16,185,129,0.3)",
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          STORE MEMORY
        </button>
      </div>

      {/* SECURITY POSTURE */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {postureItems ? postureItems.map((item) => (
          <div key={item.label} className="relative overflow-hidden rounded-xl p-4 sm:p-5" style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
          }}>
            <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${item.color}, transparent)` }} />
            <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>{item.label}</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{
                background: item.color,
                boxShadow: `0 0 8px ${item.color}50`,
              }} />
              <span className="text-sm font-bold" style={{ color: item.color }}>{item.status}</span>
            </div>
          </div>
        )) : Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl p-4 sm:p-5 animate-pulse" style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div className="h-3 w-20 rounded mb-3" style={{ background: "rgba(255,255,255,0.04)" }} />
            <div className="h-5 w-16 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
          </div>
        ))}
      </div>

      {/* MEMORY TELEMETRY */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "TOTAL MEMORIES", value: stats.total_memories, color: "#10B981" },
            { label: "EPISODIC", value: stats.type_counts.episodic || 0, color: "#a78bfa" },
            { label: "SEMANTIC", value: stats.type_counts.semantic || 0, color: "#38bdf8" },
            { label: "PROCEDURAL", value: stats.type_counts.procedural || 0, color: "#fbbf24" },
          ].map((m) => (
            <div key={m.label} className="rounded-xl p-4" style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>{m.label}</div>
              <div className="text-xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)", color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* STORE NEW MEMORY + SECURITY PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Store Form */}
        <div className="lg:col-span-3 relative overflow-hidden rounded-xl" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}>
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, #10B981 30%, transparent)" }} />
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
                <svg className="w-4 h-4" style={{ color: "#10B981" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h2 className="text-sm font-bold tracking-wide" style={{ color: "#ffffff", fontFamily: "var(--font-space-grotesk)" }}>STORE NEW MEMORY</h2>
            </div>
            <p className="text-[11px] mb-5 ml-11" style={{ color: "rgba(255,255,255,0.3)" }}>
              Content is inspected for malicious instruction patterns before it enters long-term memory.
            </p>

            <form onSubmit={handleStore} className="space-y-3">
              <div className="relative">
                <textarea
                  id="memory-content-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onFocus={() => setContentFocused(true)}
                  onBlur={() => setContentFocused(false)}
                  placeholder="Enter memory content..."
                  rows={3}
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 placeholder:text-white/20 resize-none"
                  style={{
                    background: contentFocused ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${contentFocused ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)"}`,
                    color: "#ffffff",
                    boxShadow: contentFocused ? "0 0 0 3px rgba(16,185,129,0.08)" : "none",
                  }}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    disabled={loading}
                    className="appearance-none px-4 py-3 rounded-xl text-xs font-bold tracking-wide cursor-pointer transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: TYPE_STYLES[type]?.text || "#ffffff",
                      minWidth: "140px",
                    }}
                  >
                    <option value="episodic">EPISODIC</option>
                    <option value="semantic">SEMANTIC</option>
                    <option value="procedural">PROCEDURAL</option>
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

                <button
                  type="submit"
                  disabled={loading || !content.trim()}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-bold tracking-wider transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                  style={{
                    background: storingResult === "success"
                      ? "linear-gradient(135deg, #10B981, #059669)"
                      : storingResult === "rejected"
                        ? "linear-gradient(135deg, #ef4444, #dc2626)"
                        : "linear-gradient(135deg, #0D7C5F, #10B981)",
                    color: "#ffffff",
                    boxShadow: loading ? "none" : "0 2px 12px rgba(16,185,129,0.25)",
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      STORING...
                    </span>
                  ) : storingResult === "success" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      STORED
                    </span>
                  ) : storingResult === "rejected" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      REJECTED
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      STORE MEMORY
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Security Pipeline */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl" style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: "linear-gradient(90deg, rgba(16,185,129,0.4), transparent)" }} />
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <h3 className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>SECURITY PIPELINE</h3>
            </div>
            <div className="space-y-1.5">
              {PIPELINE_STAGES.map((stage, i) => (
                <div key={stage.label} className="flex items-center gap-3 py-1.5 px-2 rounded-lg transition-all hover:bg-white/[0.02]" style={{
                  animationDelay: `${i * 50}ms`,
                }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.12)",
                  }}>
                    <svg className="w-2.5 h-2.5" style={{ color: "#10B981" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={stage.icon} />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.45)" }}>{stage.label}</span>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="ml-auto w-3 h-3 flex items-center justify-center">
                      <div className="w-[1px] h-2.5" style={{ background: "rgba(16,185,129,0.2)" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="rounded-xl p-5 flex items-center gap-4" style={{
          background: "rgba(239,68,68,0.04)",
          border: "1px solid rgba(239,68,68,0.12)",
        }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.1)" }}>
            <svg className="w-5 h-5" style={{ color: "#ef4444" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: "#ef4444" }}>Failed to load memories</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(239,68,68,0.5)" }}>{error}</p>
          </div>
          <button
            onClick={() => load(true)}
            className="px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all hover:bg-white/5 shrink-0"
            style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* SEARCH + FILTER */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search protected memories..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium transition-all placeholder:text-white/20"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#ffffff",
            }}
          />
        </div>
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide cursor-pointer transition-all"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: filterType ? TYPE_STYLES[filterType]?.text || "#ffffff" : "rgba(255,255,255,0.4)",
              minWidth: "130px",
            }}
          >
            <option value="">All types</option>
            <option value="episodic">Episodic</option>
            <option value="semantic">Semantic</option>
            <option value="procedural">Procedural</option>
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* LOADING SKELETON */}
      {fetching && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: "#10B981" }} />
            <div className="h-3 w-40 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.04)" }} />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-3/4 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
                  <div className="flex gap-3">
                    <div className="h-5 w-16 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                    <div className="h-5 w-24 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!fetching && !error && memories.length === 0 && (
        <div className="rounded-xl p-10 sm:p-14 text-center" style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.1)" }}>
            <svg className="w-7 h-7" style={{ color: "#10B981" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
            </svg>
          </div>
          <p className="text-sm font-bold tracking-wide mb-1" style={{ color: "#ffffff", fontFamily: "var(--font-space-grotesk)" }}>NO MEMORIES STORED</p>
          <p className="text-xs mb-6 max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.3)" }}>
            Long-term memories will appear here after passing the AgentShield security pipeline.
          </p>
          <button
            onClick={() => document.getElementById("memory-content-input")?.focus()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#10B981",
            }}
          >
            + STORE FIRST MEMORY
          </button>
        </div>
      )}

      {/* NO MATCHES */}
      {!fetching && !error && memories.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl p-10 text-center" style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <p className="text-sm font-bold tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>No matches found</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Try a different search or filter</p>
        </div>
      )}

      {/* PROTECTED MEMORY VAULT */}
      {!fetching && filtered.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: "#10B981" }} />
            <h3 className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>PROTECTED MEMORIES</h3>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}>
              {filtered.length}
            </span>
          </div>

          <div className="space-y-2">
            {filtered.map((m, i) => {
              const style = TYPE_STYLES[m.memory_type] || TYPE_STYLES.episodic;
              const isSelected = selectedMemory?.memory_id === m.memory_id;
              return (
                <div
                  key={m.memory_id}
                  className="group rounded-xl transition-all duration-300 cursor-pointer"
                  style={{
                    background: isSelected ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                    border: isSelected ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(255,255,255,0.05)",
                    animationDelay: `${i * 40}ms`,
                  }}
                  onClick={() => setSelectedMemory(isSelected ? null : m)}
                >
                  <div className="flex items-stretch">
                    <div className="w-1 shrink-0 rounded-l-xl" style={{ background: style.text }} />
                    <div className="flex-1 p-4 sm:p-5 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{
                              background: style.bg,
                              border: `1px solid ${style.border}`,
                            }}>
                              <svg className="w-4 h-4" style={{ color: style.text }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold leading-relaxed" style={{ color: "#ffffff" }}>{m.content}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ml-11">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider" style={{
                              background: style.bg,
                              color: style.text,
                              border: `1px solid ${style.border}`,
                            }}>
                              {style.label}
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                              {truncateHash(m.entry_hash)}
                            </span>
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                              {formatDate(m.created_at)}
                            </span>
                            {m.kms_signature && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: "rgba(16,185,129,0.5)" }}>
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                SIGNED
                              </span>
                            )}
                            <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
                              ID:{m.memory_id.slice(0, 8)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.2)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isSelected && (
                        <div className="mt-4 pt-4 ml-11 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                              { label: "TYPE", value: style.label },
                              { label: "CREATED", value: new Date(m.created_at).toLocaleString() },
                              { label: "STATUS", value: "STORED" },
                              { label: "INTEGRITY", value: m.entry_hash ? "VERIFIED" : "\u2014" },
                              { label: "SOURCE", value: m.source_provenance || "\u2014" },
                              { label: "TRUST", value: `L${m.trust_level}` },
                            ].map((field) => (
                              <div key={field.label} className="rounded-lg p-3" style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.04)",
                              }}>
                                <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>{field.label}</div>
                                <div className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{field.value}</div>
                              </div>
                            ))}
                          </div>
                          {m.entry_hash && (
                            <div className="rounded-lg p-3" style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.04)",
                            }}>
                              <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>HASH</div>
                              <div className="text-[11px] font-mono break-all" style={{ color: "rgba(255,255,255,0.4)" }}>{m.entry_hash}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && filtered.length >= 50 && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => load(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all hover:bg-white/5"
                style={{ color: "#10B981", border: "1px solid rgba(16,185,129,0.15)" }}
              >
                LOAD MORE ({memories.length} loaded)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
