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
  entry_hash: string;
  created_at: string;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  episodic: { bg: "rgba(139,92,246,0.08)", text: "#7C3AED", border: "rgba(139,92,246,0.15)", label: "Episodic" },
  semantic: { bg: "rgba(14,165,233,0.08)", text: "#0284C7", border: "rgba(14,165,233,0.15)", label: "Semantic" },
  procedural: { bg: "rgba(245,158,11,0.08)", text: "#D97706", border: "rgba(245,158,11,0.15)", label: "Procedural" },
};

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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 50;

  const load = useCallback(async (reset = true) => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const off = reset ? 0 : offset;
      const data = await api.listMemories(token, { limit: PAGE, offset: off });
      const arr = data as unknown as Memory[];
      if (reset) { setMemories(arr); setOffset(arr.length); setHasMore(arr.length >= PAGE); }
      else { setMemories((prev) => [...prev, ...arr]); setOffset((o) => o + arr.length); setHasMore(arr.length >= PAGE); }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load memories");
    } finally {
      setFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(true); }, [load]);

  async function handleStore(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !content.trim()) return;
    setLoading(true);
    try {
      await api.storeMemory(token, content.trim(), type);
      setContent("");
      toast.success("Memory stored with hash chain integrity");
      load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const filtered = memories.filter((m) => {
    if (filterType && m.memory_type !== filterType) return false;
    if (search && !m.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-4xl font-black font-display tracking-tight">Memory</h1>
        <p className="mt-2 text-base font-medium" style={{ color: "#5A5248" }}>
          Store memories with SHA-256 hash chain integrity
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)" }}>
            <svg className="w-5 h-5" style={{ color: "#7C3AED" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="text-sm font-bold font-display" style={{ color: "#1A1A1A" }}>Store New Memory</h2>
        </div>
        <form onSubmit={handleStore} className="space-y-3">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="e.g. User prefers dark mode and works late nights"
            className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-250"
            style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
          />
          <div className="flex items-center gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-250"
              style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)", color: "#1A1A1A" }}
            >
              <option value="episodic">Episodic</option>
              <option value="semantic">Semantic</option>
              <option value="procedural">Procedural</option>
            </select>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #0D7C5F, #10B981)", boxShadow: "0 2px 12px rgba(13,124,95,0.25)" }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Storing...
                </span>
              ) : "Store Memory"}
            </button>
          </div>
          <p className="text-xs font-medium" style={{ color: "#7A7164" }}>
            Content is scanned for injection patterns before storage
          </p>
        </form>
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-6 text-center" style={{ background: "rgba(194,59,59,0.04)", border: "1px solid rgba(194,59,59,0.12)" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#C23B3B" }}>{error}</p>
          <button onClick={() => load(true)} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "rgba(0,0,0,0.04)" }}>Retry</button>
        </div>
      )}

      {/* search + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories..." className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}>
          <option value="">All types</option><option value="episodic">Episodic</option><option value="semantic">Semantic</option><option value="procedural">Procedural</option>
        </select>
      </div>

      {fetching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(0,0,0,0.03)" }} />
          ))}
        </div>
      )}

      {!fetching && !error && filtered.length === 0 && (
        <div className="glass-card rounded-2xl p-14 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(0,0,0,0.03)" }}>
            <svg className="w-8 h-8" style={{ color: "#7A7164" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
            </svg>
          </div>
          <p className="font-bold font-display" style={{ color: "#1A1A1A" }}>{memories.length === 0 ? "No memories stored yet" : "No matches"}</p>
          <p className="text-xs mt-1" style={{ color: "#7A7164" }}>{memories.length === 0 ? "Store your first memory above" : "Try a different search or filter"}</p>
        </div>
      )}

      {!fetching && filtered.map((m, i) => {
        const style = TYPE_STYLES[m.memory_type] || TYPE_STYLES.episodic;
        return (
          <div
            key={m.memory_id}
            className="glass-card rounded-2xl p-5 animate-slide-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>{m.content}</p>
            <div className="flex items-center gap-2.5 mt-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                {style.label}
              </span>
              <span className="text-[11px] font-mono" style={{ color: "#7A7164" }}>
                {m.entry_hash?.slice(0, 16)}...
              </span>
              <span className="text-[11px]" style={{ color: "#7A7164" }}>
                {new Date(m.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        );
      })}
      {!fetching && hasMore && filtered.length > 0 && (
        <div className="flex justify-center">
          <button onClick={() => load(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold" style={{ background: "rgba(13,124,95,0.08)", color: "#0D7C5F" }}>Load More ({memories.length} loaded)</button>
        </div>
      )}
    </div>
  );
}


