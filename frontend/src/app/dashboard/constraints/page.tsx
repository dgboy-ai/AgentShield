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
  safety: { bg: "rgba(194,59,59,0.08)", text: "#C23B3B", border: "rgba(194,59,59,0.15)", label: "Safety" },
  policy: { bg: "rgba(245,158,11,0.08)", text: "#D97706", border: "rgba(245,158,11,0.15)", label: "Policy" },
  instruction: { bg: "rgba(14,165,233,0.08)", text: "#0284C7", border: "rgba(14,165,233,0.15)", label: "Instruction" },
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
      const arr = data as unknown as Constraint[];
      if (reset) { setConstraints(arr); setOffset(arr.length); setHasMore(arr.length >= PAGE); if (score) setIntegrity(score as Record<string, unknown>); }
      else { setConstraints((prev) => [...prev, ...arr]); setOffset((o) => o + arr.length); setHasMore(arr.length >= PAGE); }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load constraints");
    } finally {
      setFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(true); }, [load]);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !text.trim()) return;
    setLoading(true);
    try {
      await api.pinConstraint(token, text.trim(), type);
      setText("");
      toast.success("Constraint pinned with hash chain integrity");
      load(true);
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

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-4xl font-black font-display tracking-tight">Constraints</h1>
        <p className="mt-2 text-base font-medium" style={{ color: "#5A5248" }}>
          Pin safety rules that survive context compaction
        </p>
      </div>

      {/* Integrity score */}
      {integrity && (
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "#7A7164" }}>Integrity Score</div>
            <div className="text-2xl font-black font-display" style={{ color: Number(integrity.integrity_score) >= 1 ? "#059669" : "#C23B3B" }}>{(Number(integrity.integrity_score) * 100).toFixed(0)}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold" style={{ color: "#7A7164" }}>Token Overhead</div>
            <div className="text-sm font-mono font-bold" style={{ color: "#5A5248" }}>{(Number(integrity.token_overhead) * 100).toFixed(3)}%</div>
            <div className="text-[11px]" style={{ color: "#7A7164" }}>target &lt;0.5%</div>
          </div>
        </div>
      )}

      {/* Pin form */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)" }}>
            <svg className="w-5 h-5" style={{ color: "#059669" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="text-sm font-bold font-display" style={{ color: "#1A1A1A" }}>Pin New Constraint</h2>
        </div>
        <form onSubmit={handlePin} className="space-y-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Never delete files without user confirmation"
            className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-250"
            style={{
              background: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(0,0,0,0.08)",
              color: "#1A1A1A",
            }}
          />
          <div className="flex items-center gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-250"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(0,0,0,0.08)",
                color: "#1A1A1A",
              }}
            >
              <option value="safety">Safety</option>
              <option value="policy">Policy</option>
              <option value="instruction">Instruction</option>
            </select>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)", boxShadow: "0 2px 12px rgba(13,124,95,0.25)" }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Pinning...
                </span>
              ) : "Pin Constraint"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-6 text-center" style={{ background: "rgba(194,59,59,0.04)", border: "1px solid rgba(194,59,59,0.12)" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#C23B3B" }}>{error}</p>
          <button onClick={() => load(true)} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "rgba(0,0,0,0.04)" }}>Retry</button>
        </div>
      )}

      {fetching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(0,0,0,0.03)" }} />
          ))}
        </div>
      )}

      {!fetching && !error && constraints.length === 0 && (
        <div className="glass-card rounded-2xl p-14 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(0,0,0,0.03)" }}>
            <svg className="w-8 h-8" style={{ color: "#7A7164" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          </div>
          <p className="font-bold font-display" style={{ color: "#1A1A1A" }}>No constraints pinned yet</p>
          <p className="text-xs mt-1" style={{ color: "#7A7164" }}>Pin your first safety rule above</p>
        </div>
      )}

      {!fetching && constraints.map((c, i) => {
        const style = TYPE_STYLES[c.constraint_type] || TYPE_STYLES.safety;
        const isEditing = editingId === c.constraint_id;
        return (
          <div
            key={c.constraint_id}
            className="glass-card rounded-2xl p-5 flex flex-col gap-4 animate-slide-up group"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {isEditing ? (
              <div className="space-y-3">
                <input
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
                />
                <div className="flex items-center gap-3">
                  <select
                    value={editingType}
                    onChange={(e) => setEditingType(e.target.value)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
                  >
                    <option value="safety">Safety</option>
                    <option value="policy">Policy</option>
                    <option value="instruction">Instruction</option>
                  </select>
                  <button
                    onClick={() => handleUpdate(c.constraint_id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ background: "#0D7C5F" }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold"
                    style={{ background: "rgba(0,0,0,0.04)", color: "#5A5248" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>{c.text}</p>
                  <div className="flex items-center gap-2.5 mt-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                      {style.label}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: "#7A7164" }}>
                      {c.entry_hash?.slice(0, 16)}...
                    </span>
                    <span className="text-[11px]" style={{ color: "#7A7164" }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {c.is_active && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:bg-white/60"
                      style={{ color: "#0D7C5F" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c.constraint_id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:bg-white/60"
                      style={{ color: "#7A7164" }}
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
      {!fetching && hasMore && constraints.length >= 50 && (
        <div className="flex justify-center">
          <button onClick={() => load(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold" style={{ background: "rgba(13,124,95,0.08)", color: "#0D7C5F" }}>Load More ({constraints.length} loaded)</button>
        </div>
      )}
    </div>
  );
}


