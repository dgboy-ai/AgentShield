"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Constraint {
  constraint_id: string;
  org_id: string;
  text: string;
  constraint_type: string;
  is_active: boolean;
  previous_hash: string | null;
  entry_hash: string;
  kms_signature: string | null;
  created_at: string;
  updated_at: string;
}

interface IntegrityScore {
  org_id: string;
  integrity_score: number;
  token_overhead: number;
  token_overhead_pct: number;
  estimated_tokens: number;
}

interface IntegrityVerify {
  constraint_integrity: {
    report_id: string;
    total_constraints: number;
    active_constraints: number;
    compromised_constraints: number;
    hash_mismatches: string[];
    compaction_events_count: number;
    overall_score: number;
    generated_at: string;
  };
  hash_chain: Record<string, unknown>;
}

const TYPE_META: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
  safety: {
    bg: "rgba(239,68,68,0.08)",
    text: "#ef4444",
    border: "rgba(239,68,68,0.18)",
    label: "SAFETY",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  },
  policy: {
    bg: "rgba(245,158,11,0.08)",
    text: "#f59e0b",
    border: "rgba(245,158,11,0.18)",
    label: "POLICY",
    icon: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418",
  },
  instruction: {
    bg: "rgba(56,189,248,0.08)",
    text: "#38bdf8",
    border: "rgba(56,189,248,0.18)",
    label: "INSTRUCTION",
    icon: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  },
};

export default function ConstraintsPage() {
  const { token } = useAuth();
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState("safety");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrityScore, setIntegrityScore] = useState<IntegrityScore | null>(null);
  const [integrityVerify, setIntegrityVerify] = useState<IntegrityVerify | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingType, setEditingType] = useState("safety");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [textFocused, setTextFocused] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const PAGE = 50;

  const load = useCallback(async (reset = true) => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const off = reset ? 0 : offset;
      const [data, score, verify] = await Promise.all([
        api.listConstraints(token, { limit: PAGE, offset: off }),
        reset ? api.integrityScore(token).catch(() => null) : Promise.resolve(null),
        reset ? api.verifyConstraints(token).catch(() => null) : Promise.resolve(null),
      ]);
      const arr = data as unknown as Constraint[];
      if (reset) {
        setConstraints(arr);
        setOffset(arr.length);
        setHasMore(arr.length >= PAGE);
        if (score) setIntegrityScore(score as unknown as IntegrityScore);
        if (verify) setIntegrityVerify(verify as unknown as IntegrityVerify);
      } else {
        setConstraints((prev) => [...prev, ...arr]);
        setOffset((o) => o + arr.length);
        setHasMore(arr.length >= PAGE);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load constraints");
    } finally {
      setFetching(false);
    }
  }, [token, offset]);

  useEffect(() => { load(true); }, [load]);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !text.trim()) return;
    setLoading(true);
    setPinSuccess(false);
    try {
      await api.pinConstraint(token, text.trim(), type);
      setText("");
      setPinSuccess(true);
      toast.success("Constraint pinned with hash chain integrity");
      load(true);
      setTimeout(() => setPinSuccess(false), 2000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await api.deleteConstraint(token, id);
      toast.success("Constraint deactivated");
      load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function handleUpdate(id: string) {
    if (!token || !editingText.trim()) return;
    try {
      await api.updateConstraint(token, id, editingText.trim(), editingType);
      toast.success("Constraint updated and re-signed");
      setEditingId(null);
      setEditingText("");
      load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update");
    }
  }

  function startEdit(c: Constraint) {
    setEditingId(c.constraint_id);
    setEditingText(c.text);
    setEditingType(c.constraint_type);
  }

  const activeCount = constraints.filter((c) => c.is_active).length;
  const totalCount = constraints.length;
  const hasKmsVerified = constraints.some((c) => !!c.kms_signature);
  const integrityHealthy = integrityScore ? integrityScore.integrity_score >= 1 : null;
  const hashChainValid = integrityVerify?.hash_chain ? (integrityVerify.hash_chain as { valid?: boolean }).valid : null;

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
    if (!hash) return "—";
    return `${hash.slice(0, 12)}...`;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
              <svg className="w-4 h-4" style={{ color: "#10B981" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)", color: "#ffffff" }}>
              CONSTRAINT SECURITY
            </h1>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)", maxWidth: "600px" }}>
            Pin critical safety rules outside the agent&apos;s compressible context so they remain protected during memory operations.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.focus()}
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
          PIN CONSTRAINT
        </button>
      </div>

      {/* ═══════════════ SECURITY POSTURE ═══════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Constraints */}
        <div className="relative overflow-hidden rounded-xl p-4 sm:p-5" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}>
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: "linear-gradient(90deg, #10B981, transparent)" }} />
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>ACTIVE RULES</div>
          {fetching ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ) : (
            <div className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)", color: "#10B981" }}>
              {activeCount}
            </div>
          )}
          <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
            {totalCount} total
          </div>
        </div>

        {/* Integrity Status */}
        <div className="relative overflow-hidden rounded-xl p-4 sm:p-5" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}>
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{
            background: integrityHealthy === null
              ? "linear-gradient(90deg, rgba(255,255,255,0.2), transparent)"
              : integrityHealthy
                ? "linear-gradient(90deg, #10B981, transparent)"
                : "linear-gradient(90deg, #ef4444, transparent)"
          }} />
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>INTEGRITY</div>
          {fetching ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{
                background: integrityHealthy === null ? "#737373" : integrityHealthy ? "#10B981" : "#ef4444",
                boxShadow: integrityHealthy === null ? "none" : `0 0 8px ${integrityHealthy ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"}`,
              }} />
              <span className="text-sm font-bold" style={{
                color: integrityHealthy === null ? "rgba(255,255,255,0.3)" : integrityHealthy ? "#10B981" : "#ef4444",
              }}>
                {integrityHealthy === null ? "—" : integrityHealthy ? "HEALTHY" : "DEGRADED"}
              </span>
            </div>
          )}
          <div className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            {integrityScore ? `${(integrityScore.integrity_score * 100).toFixed(0)}% verified` : "no data"}
          </div>
        </div>

        {/* Hash Chain */}
        <div className="relative overflow-hidden rounded-xl p-4 sm:p-5" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}>
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{
            background: hashChainValid === null
              ? "linear-gradient(90deg, rgba(255,255,255,0.2), transparent)"
              : hashChainValid
                ? "linear-gradient(90deg, #10B981, transparent)"
                : "linear-gradient(90deg, #ef4444, transparent)"
          }} />
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>HASH CHAIN</div>
          {fetching ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{
                background: hashChainValid === null ? "#737373" : hashChainValid ? "#10B981" : "#ef4444",
                boxShadow: hashChainValid === null ? "none" : `0 0 8px ${hashChainValid ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"}`,
              }} />
              <span className="text-sm font-bold" style={{
                color: hashChainValid === null ? "rgba(255,255,255,0.3)" : hashChainValid ? "VALID" : "BROKEN",
              }}>
                {hashChainValid === null ? "—" : hashChainValid ? "VALID" : "BROKEN"}
              </span>
            </div>
          )}
          <div className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            SHA-256 chain
          </div>
        </div>

        {/* KMS Signing */}
        <div className="relative overflow-hidden rounded-xl p-4 sm:p-5" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}>
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{
            background: hasKmsVerified
              ? "linear-gradient(90deg, #10B981, transparent)"
              : "linear-gradient(90deg, rgba(255,255,255,0.2), transparent)"
          }} />
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>KMS SIGNING</div>
          {fetching ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{
                background: hasKmsVerified ? "#10B981" : "#737373",
                boxShadow: hasKmsVerified ? "0 0 8px rgba(16,185,129,0.5)" : "none",
              }} />
              <span className="text-sm font-bold" style={{
                color: hasKmsVerified ? "#10B981" : "rgba(255,255,255,0.3)",
              }}>
                {hasKmsVerified ? "ACTIVE" : "—"}
              </span>
            </div>
          )}
          <div className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            {constraints.filter(c => c.kms_signature).length} signed
          </div>
        </div>
      </div>

      {/* ═══════════════ PIN NEW CONSTRAINT ═══════════════ */}
      <div className="relative overflow-hidden rounded-xl" style={{
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
            <h2 className="text-sm font-bold tracking-wide" style={{ color: "#ffffff", fontFamily: "var(--font-space-grotesk)" }}>PROTECT A NEW RULE</h2>
          </div>
          <p className="text-[11px] mb-5 ml-11" style={{ color: "rgba(255,255,255,0.3)" }}>
            Protected constraints are checked by AgentShield before security-sensitive memory operations.
          </p>

          <form ref={formRef} onSubmit={handlePin} className="space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setTextFocused(true)}
                onBlur={() => setTextFocused(false)}
                placeholder="e.g. Never execute arbitrary shell commands without user confirmation"
                disabled={loading}
                className="w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 placeholder:text-white/20"
                style={{
                  background: textFocused ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${textFocused ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: "#ffffff",
                  boxShadow: textFocused ? "0 0 0 3px rgba(16,185,129,0.08)" : "none",
                }}
              />
              {text.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
                </div>
              )}
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
                    color: TYPE_META[type]?.text || "#ffffff",
                    minWidth: "140px",
                  }}
                >
                  <option value="safety">SAFETY</option>
                  <option value="policy">POLICY</option>
                  <option value="instruction">INSTRUCTION</option>
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-bold tracking-wider transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                style={{
                  background: pinSuccess
                    ? "linear-gradient(135deg, #10B981, #059669)"
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
                    PINNING...
                  </span>
                ) : pinSuccess ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    PINNED
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    PIN CONSTRAINT
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ═══════════════ ERROR STATE ═══════════════ */}
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
            <p className="text-sm font-bold" style={{ color: "#ef4444" }}>Failed to load constraints</p>
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

      {/* ═══════════════ LOADING SKELETON ═══════════════ */}
      {fetching && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: "#10B981" }} />
            <div className="h-3 w-32 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
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

      {/* ═══════════════ EMPTY STATE ═══════════════ */}
      {!fetching && !error && constraints.length === 0 && (
        <div className="rounded-xl p-10 sm:p-14 text-center" style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.1)" }}>
            <svg className="w-7 h-7" style={{ color: "#10B981" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <p className="text-sm font-bold tracking-wide mb-1" style={{ color: "#ffffff", fontFamily: "var(--font-space-grotesk)" }}>NO PROTECTED RULES</p>
          <p className="text-xs mb-6 max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.3)" }}>
            Your agent currently has no pinned safety constraints. Pin a rule to protect critical behavior from context compaction.
          </p>
          <button
            onClick={() => inputRef.current?.focus()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#10B981",
            }}
          >
            + PIN FIRST CONSTRAINT
          </button>
        </div>
      )}

      {/* ═══════════════ PROTECTED CONSTRAINTS ═══════════════ */}
      {!fetching && constraints.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: "#10B981" }} />
            <h3 className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>PROTECTED CONSTRAINTS</h3>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}>
              {constraints.length}
            </span>
          </div>

          <div className="space-y-2">
            {constraints.map((c, i) => {
              const meta = TYPE_META[c.constraint_type] || TYPE_META.safety;
              const isEditing = editingId === c.constraint_id;
              return (
                <div
                  key={c.constraint_id}
                  className="group rounded-xl transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {isEditing ? (
                    <div className="p-4 sm:p-5">
                      <div className="space-y-3">
                        <input
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#ffffff",
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={editingType}
                            onChange={(e) => setEditingType(e.target.value)}
                            className="appearance-none px-3 py-2 rounded-xl text-xs font-bold tracking-wide cursor-pointer"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: TYPE_META[editingType]?.text || "#ffffff",
                            }}
                          >
                            <option value="safety">SAFETY</option>
                            <option value="policy">POLICY</option>
                            <option value="instruction">INSTRUCTION</option>
                          </select>
                          <button
                            onClick={() => handleUpdate(c.constraint_id)}
                            className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all hover:brightness-110"
                            style={{ background: "#10B981", color: "#000000" }}
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all hover:bg-white/5"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-stretch">
                      {/* Left accent */}
                      <div className="w-1 shrink-0 rounded-l-xl" style={{
                        background: c.is_active
                          ? meta.text
                          : "rgba(255,255,255,0.1)",
                      }} />

                      <div className="flex-1 p-4 sm:p-5 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Rule text */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{
                                background: meta.bg,
                                border: `1px solid ${meta.border}`,
                              }}>
                                <svg className="w-4 h-4" style={{ color: meta.text }} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold leading-relaxed" style={{ color: "#ffffff" }}>{c.text}</p>
                              </div>
                            </div>

                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ml-11">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider" style={{
                                background: meta.bg,
                                color: meta.text,
                                border: `1px solid ${meta.border}`,
                              }}>
                                {meta.label}
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                                {truncateHash(c.entry_hash)}
                              </span>
                              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                                {formatDate(c.created_at)}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{
                                color: c.is_active ? "#10B981" : "rgba(255,255,255,0.2)",
                              }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{
                                  background: c.is_active ? "#10B981" : "rgba(255,255,255,0.15)",
                                }} />
                                {c.is_active ? "ACTIVE" : "INACTIVE"}
                              </span>
                              {c.kms_signature && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: "rgba(16,185,129,0.5)" }}>
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                  </svg>
                                  SIGNED
                                </span>
                              )}
                              <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
                                ID:{c.constraint_id.slice(0, 8)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          {c.is_active && (
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                onClick={() => startEdit(c)}
                                className="p-2 rounded-lg text-[10px] font-bold tracking-wide transition-all hover:bg-white/5"
                                style={{ color: "rgba(255,255,255,0.4)" }}
                                title="Edit constraint"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(c.constraint_id)}
                                className="p-2 rounded-lg text-[10px] font-bold tracking-wide transition-all hover:bg-white/5"
                                style={{ color: "rgba(255,255,255,0.3)" }}
                                title="Deactivate constraint"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && constraints.length >= 50 && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => load(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all hover:bg-white/5"
                style={{ color: "#10B981", border: "1px solid rgba(16,185,129,0.15)" }}
              >
                LOAD MORE ({constraints.length} loaded)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ WHY CONSTRAINT PINNING ═══════════════ */}
      <div className="rounded-xl p-5 sm:p-6" style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <h3 className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>WHY CONSTRAINT PINNING?</h3>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)", maxWidth: "700px" }}>
          During long conversations, context compaction summarises older messages to fit within token limits. Without pinning, critical safety rules are silently lost. AgentShield maintains your constraints outside the compressible context and re-injects them after every compaction, ensuring they are never forgotten. Each constraint is signed with a hash chain for tamper detection.
        </p>
      </div>
    </div>
  );
}
