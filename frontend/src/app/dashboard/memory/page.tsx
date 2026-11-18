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

interface MemoryVerifyResult {
  valid?: boolean;
  is_valid?: boolean;
  total_memories?: number;
  broken_at?: number | null;
}

interface ThreatScanResult {
  risk_score: number;
  threat_detected: boolean;
  patterns_matched: Array<{ category: string; severity: string; description: string }>;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  episodic: { bg: "rgba(167,139,250,0.1)", text: "#7C3AED", border: "rgba(167,139,250,0.2)", label: "Episodic" },
  semantic: { bg: "rgba(56,189,248,0.1)", text: "#0284C7", border: "rgba(56,189,248,0.2)", label: "Semantic" },
  procedural: { bg: "rgba(245,158,11,0.1)", text: "#B45309", border: "rgba(245,158,11,0.2)", label: "Procedural" },
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
  const [verifyResult, setVerifyResult] = useState<MemoryVerifyResult | null>(null);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ThreatScanResult | null>(null);

  const PAGE = 50;

  const load = useCallback(async (reset = true) => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const off = reset ? 0 : offset;
      const [data, verify] = await Promise.allSettled([
        api.listMemories(token, { limit: PAGE, offset: off }),
        reset ? api.verifyMemories(token) : Promise.resolve(null),
      ]);

      if (data.status === "fulfilled") {
        const arr = (Array.isArray(data.value) ? data.value : []) as unknown as Memory[];
        if (reset) {
          setMemories(arr);
          setOffset(arr.length);
          setHasMore(arr.length >= PAGE);
        } else {
          setMemories((prev) => [...prev, ...arr]);
          setOffset((o) => o + arr.length);
          setHasMore(arr.length >= PAGE);
        }
      } else {
        throw data.reason;
      }

      if (verify.status === "fulfilled" && verify.value) {
        setVerifyResult(verify.value as unknown as MemoryVerifyResult);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load memories");
    } finally {
      setFetching(false);
    }
  }, [token, offset]);

  useEffect(() => { load(true); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleScan() {
    if (!token || !content.trim()) return;
    setScanning(true);
    try {
      const res = await api.scanText(token, content.trim()) as any;
      setScanResult({
        risk_score: res.risk_score ?? 0,
        threat_detected: res.threat_detected ?? (res.risk_score > 0.4),
        patterns_matched: res.matched_patterns || res.patterns_matched || [],
      });
      if (res.threat_detected || (res.risk_score && res.risk_score > 0.5)) {
        toast.warning(`Threat scan: Risk score ${(res.risk_score * 100).toFixed(0)}%`);
      } else {
        toast.success("Threat scan passed: No malicious patterns detected");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleStore(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !content.trim()) return;
    setLoading(true);
    try {
      await api.storeMemory(token, content.trim(), type);
      setContent("");
      setScanResult(null);
      toast.success("Memory stored with SHA-256 hash-chain integrity");
      load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to store memory");
    } finally {
      setLoading(false);
    }
  }

  const filtered = memories.filter((m) => {
    if (filterType && m.memory_type !== filterType) return false;
    if (search && !m.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isChainValid = verifyResult?.valid ?? verifyResult?.is_valid;

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground font-medium mb-2">Memory Defense</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Memory Store
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store and verify agent episodic, semantic, and procedural memories with cryptographic hash chains.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {verifyResult && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border ${
              isChainValid ? "bg-[#059669]/10 border-[#059669]/20 text-[#059669]" : "bg-rose-500/10 border-rose-500/20 text-rose-600"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isChainValid ? "bg-[#059669] animate-pulse" : "bg-rose-400"}`} />
              Chain {isChainValid ? "Verified" : "Tampered"}
            </div>
          )}
          <span className="text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 rounded-lg bg-[#E6E0D4] text-foreground border border-border">
            {memories.length} Entries
          </span>
        </div>
      </div>

      {/* Store Memory Form */}
      <div className="panel-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-foreground tracking-wide">Store New Memory</h2>
        </div>
        <form onSubmit={handleStore} className="space-y-4">
          <div>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (scanResult) setScanResult(null);
              }}
              rows={3}
              placeholder="e.g. Agent preferences: Database connection string must always use sslmode=verify-full."
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-[#E6E0D4] border border-border text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-[#059669] transition-colors resize-none"
            />
          </div>

          {/* Pre-store scan feedback if available */}
          {scanResult && (
            <div className={`p-4 rounded-xl text-xs font-mono border ${
              scanResult.threat_detected ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-[#059669]/10 border-[#059669]/20 text-[#059669]"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold uppercase tracking-wider">
                  {scanResult.threat_detected ? "Threat Detected" : "Threat Scan Clean"}
                </span>
                <span>Risk: {(scanResult.risk_score * 100).toFixed(0)}%</span>
              </div>
              {scanResult.patterns_matched.length > 0 && (
                <div className="mt-2 space-y-1 text-foreground font-medium">
                  {scanResult.patterns_matched.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-rose-600">[{p.severity}]</span>
                      <span>{p.category}: {p.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground shrink-0">Memory Type:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-mono font-medium bg-[#121212] border border-border text-foreground focus:outline-none focus:border-[#059669]"
              >
                <option value="episodic">Episodic</option>
                <option value="semantic">Semantic</option>
                <option value="procedural">Procedural</option>
              </select>
            </div>

            <div className="sm:ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning || !content.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-[#E6E0D4] border border-border text-foreground hover:bg-[#E0D9CC] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {scanning ? "Scanning..." : "Scan for Threat"}
              </button>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#059669] text-black hover:bg-[#10B981] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    <span>Storing...</span>
                  </>
                ) : (
                  "Store Memory"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stored memory content..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-medium bg-[#E6E0D4] border border-border text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-[#059669]"
          />
          <svg className="w-4 h-4 text-muted-foreground font-medium absolute left-3 top-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          {["", "episodic", "semantic", "procedural"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-2 rounded-xl text-[10px] font-mono tracking-wider uppercase transition-colors border ${
                filterType === t
                  ? "bg-[#059669]/15 text-[#059669] border-[#059669]/30 font-bold"
                  : "bg-[#ECE7DD] text-muted-foreground border-border hover:text-foreground font-medium"
              }`}
            >
              {t === "" ? "All" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl p-5 border border-rose-500/20 bg-rose-500/10 text-center">
          <p className="text-xs font-mono text-rose-600 mb-3">{error}</p>
          <button onClick={() => load(true)} className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#E6E0D4] text-foreground font-medium hover:bg-[#E0D9CC]">
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {fetching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[#E6E0D4] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!fetching && !error && filtered.length === 0 && (
        <div className="panel-card p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#E6E0D4] border border-border flex items-center justify-center mx-auto mb-4 text-muted-foreground font-medium">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {search || filterType ? "No matching memories found" : "No memories stored yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || filterType ? "Try adjusting your filter or search query." : "Store your first memory entry above to establish the hash chain."}
          </p>
        </div>
      )}

      {/* Memory List */}
      <div className="space-y-3">
        {!fetching && filtered.map((m) => {
          const style = TYPE_STYLES[m.memory_type] || TYPE_STYLES.episodic;
          return (
            <div
              key={m.memory_id}
              className="panel-card p-4"
            >
              <p className="text-sm text-foreground leading-relaxed font-medium">{m.content}</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase"
                  style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                >
                  {style.label}
                </span>
                {m.entry_hash && (
                  <span className="text-[10px] font-mono text-muted-foreground font-medium truncate" title={`SHA-256: ${m.entry_hash}`}>
                    {m.entry_hash.slice(0, 10)}…{m.entry_hash.slice(-6)}
                  </span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground font-medium">
                  {new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!fetching && hasMore && memories.length >= 50 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => load(false)}
            className="px-4 py-2 rounded-xl text-xs font-mono font-bold border border-border bg-[#ECE7DD] text-foreground font-medium hover:bg-[#E6E0D4] transition-colors"
          >
            Load More ({memories.length} loaded)
          </button>
        </div>
      )}
    </div>
  );
}
