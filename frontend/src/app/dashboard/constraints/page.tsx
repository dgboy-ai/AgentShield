"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Constraint {
  constraint_id: string;
  text: string;
  constraint_type: string;
  is_active: boolean;
  entry_hash: string;
  created_at: string;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  safety: { bg: "rgba(244,63,94,0.1)", text: "#FB7185", border: "rgba(244,63,94,0.2)", label: "Safety" },
  policy: { bg: "rgba(245,158,11,0.1)", text: "#FBBF24", border: "rgba(245,158,11,0.2)", label: "Policy" },
  instruction: { bg: "rgba(56,189,248,0.1)", text: "#38BDF8", border: "rgba(56,189,248,0.2)", label: "Instruction" },
};

export default function ConstraintsPage() {
  const { token } = useAuth();
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState("safety");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<Record<string, unknown> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingType, setEditingType] = useState("safety");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 50;

  const load = useCallback(async (reset = true) => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const off = reset ? 0 : offset;
      const [data, score] = await Promise.all([
        api.listConstraints(token, { limit: PAGE, offset: off }),
        reset ? api.integrityScore(token).catch(() => null) : Promise.resolve(null),
      ]);
      const arr = (Array.isArray(data) ? data : []) as unknown as Constraint[];
      if (reset) {
        setConstraints(arr);
        setOffset(arr.length);
        setHasMore(arr.length >= PAGE);
        if (score) setIntegrity(score as Record<string, unknown>);
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

  useEffect(() => { load(true); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !text.trim()) return;
    setLoading(true);
    try {
      await api.pinConstraint(token, text.trim(), type);
      setText("");
      toast.success("Constraint pinned with hash-chain integrity verification");
      load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to pin constraint");
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
      toast.error(err instanceof ApiError ? err.message : "Failed to deactivate");
    }
  }

  async function handleUpdate(id: string) {
    if (!token || !editingText.trim()) return;
    try {
      await api.updateConstraint(token, id, editingText.trim(), editingType);
      toast.success("Constraint updated & re-signed");
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

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 mb-2">Memory Security</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Constraints
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Pin immutable safety rules that persist across agent memory compactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 rounded-lg bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
            {constraints.length} Active {constraints.length === 1 ? "Rule" : "Rules"}
          </span>
        </div>
      </div>

      {/* Integrity score card */}
      {integrity && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-[#10B981]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase text-white/40">Integrity Score</div>
              <div className="text-2xl font-bold font-mono" style={{ color: Number(integrity.integrity_score) >= 1 ? "#10B981" : "#F43F5E" }}>
                {(Number(integrity.integrity_score) * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-[10px] font-mono tracking-widest uppercase text-white/40">Token Overhead</div>
            <div className="text-sm font-mono font-bold text-white/90">
              {(Number(integrity.token_overhead) * 100).toFixed(3)}%
            </div>
            <div className="text-[10px] font-mono text-[#10B981]/70">Target &lt; 0.5%</div>
          </div>
        </div>
      )}

      {/* Pin form */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-white tracking-wide">Pin New Constraint</h2>
        </div>
        <form onSubmit={handlePin} className="space-y-4">
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="e.g. Never execute destructive terminal commands without explicit user approval."
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] transition-colors resize-none"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono tracking-widest uppercase text-white/40 shrink-0">Type:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-mono font-medium bg-[#121212] border border-white/10 text-white focus:outline-none focus:border-[#10B981]"
              >
                <option value="safety">Safety</option>
                <option value="policy">Policy</option>
                <option value="instruction">Instruction</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="sm:ml-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#10B981] text-black hover:bg-[#34D399] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <span>Pinning...</span>
                </>
              ) : (
                "Pin Constraint"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl p-5 border border-rose-500/20 bg-rose-500/10 text-center">
          <p className="text-xs font-mono text-rose-400 mb-3">{error}</p>
          <button onClick={() => load(true)} className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-white/5 text-white/70 hover:bg-white/10">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {fetching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!fetching && !error && constraints.length === 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto mb-4 text-white/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-white/80">No constraints pinned yet</p>
          <p className="text-xs text-white/40 mt-1">Pin your first safety or policy constraint using the form above.</p>
        </div>
      )}

      {/* Constraint List */}
      <div className="space-y-3">
        {!fetching && constraints.map((c) => {
          const style = TYPE_STYLES[c.constraint_type] || TYPE_STYLES.safety;
          const isEditing = editingId === c.constraint_id;

          return (
            <div
              key={c.constraint_id}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] hover:border-white/10"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#10B981] resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={editingType}
                      onChange={(e) => setEditingType(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono bg-[#121212] border border-white/10 text-white"
                    >
                      <option value="safety">Safety</option>
                      <option value="policy">Policy</option>
                      <option value="instruction">Instruction</option>
                    </select>
                    <button
                      onClick={() => handleUpdate(c.constraint_id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#10B981] text-black hover:bg-[#34D399]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 leading-relaxed font-medium">{c.text}</p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase"
                        style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                      >
                        {style.label}
                      </span>
                      {c.entry_hash && (
                        <span className="text-[10px] font-mono text-white/30 truncate" title={`SHA-256: ${c.entry_hash}`}>
                          {c.entry_hash.slice(0, 10)}…{c.entry_hash.slice(-6)}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-white/30">
                        {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {c.is_active && (
                    <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                      <button
                        onClick={() => startEdit(c)}
                        className="px-2.5 py-1 rounded text-xs font-mono text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.constraint_id)}
                        className="px-2.5 py-1 rounded text-xs font-mono text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        Deactivate
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!fetching && hasMore && constraints.length >= 50 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => load(false)}
            className="px-4 py-2 rounded-xl text-xs font-mono font-bold border border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/5 transition-colors"
          >
            Load More ({constraints.length} loaded)
          </button>
        </div>
      )}
    </div>
  );
}
