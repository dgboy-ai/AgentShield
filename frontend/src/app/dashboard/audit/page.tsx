"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuditDetails {
  memory_type?: string;
  risk_score?: number;
  patterns_matched?: number;
  max_severity?: string;
  blocked?: boolean;
  categories?: string[];
  constraint_type?: string;
  [key: string]: unknown;
}

interface AuditEntry {
  entry_id: string;
  org_id: string;
  event_type: string;
  actor: string;
  target: string | null;
  action: string;
  details: AuditDetails | null;
  previous_hash: string | null;
  entry_hash: string | null;
  recorded_at: string;
  source?: string;
}

interface VerifyResult {
  org_id: string;
  total_entries: number;
  valid: boolean;
  broken_at: number | null;
}

interface HealthSigning {
  backend: string;
  requested_backend: string;
  key_id: string;
  total_signs: number;
  total_verifies: number;
  fallback: boolean;
}

// ─── Color maps ───────────────────────────────────────────────────────────────
const EVENT_META: Record<string, { bg: string; fg: string; border: string; dot: string; label: string }> = {
  constraint_pinned:  { bg: "rgba(16,185,129,0.06)",  fg: "#10B981", border: "rgba(16,185,129,0.15)", dot: "#10B981",  label: "CONSTRAINT" },
  memory_stored:      { bg: "rgba(139,92,246,0.06)",  fg: "#a78bfa", border: "rgba(139,92,246,0.15)", dot: "#a78bfa",  label: "MEMORY" },
  pattern_detected:   { bg: "rgba(239,68,68,0.06)",   fg: "#f87171", border: "rgba(239,68,68,0.15)",  dot: "#f87171",  label: "THREAT" },
  auth_login:         { bg: "rgba(56,189,248,0.06)",  fg: "#38bdf8", border: "rgba(56,189,248,0.15)", dot: "#38bdf8",  label: "AUTH" },
  auth_register:      { bg: "rgba(56,189,248,0.06)",  fg: "#38bdf8", border: "rgba(56,189,248,0.15)", dot: "#38bdf8",  label: "AUTH" },
  auth_logout:        { bg: "rgba(56,189,248,0.06)",  fg: "#38bdf8", border: "rgba(56,189,248,0.15)", dot: "#38bdf8",  label: "AUTH" },
  memory_rejected:    { bg: "rgba(239,68,68,0.06)",   fg: "#f87171", border: "rgba(239,68,68,0.15)",  dot: "#f87171",  label: "BLOCKED" },
  scan:               { bg: "rgba(245,158,11,0.06)",  fg: "#f59e0b", border: "rgba(245,158,11,0.15)", dot: "#f59e0b",  label: "SCAN" },
};
function getEventMeta(type: string) {
  return EVENT_META[type] || { bg: "rgba(255,255,255,0.02)", fg: "#6b7280", border: "rgba(255,255,255,0.06)", dot: "#6b7280", label: type.toUpperCase() };
}

const SEVERITY_META: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "rgba(239,68,68,0.1)",  fg: "#f87171" },
  high:     { bg: "rgba(249,115,22,0.1)", fg: "#fb923c" },
  medium:   { bg: "rgba(245,158,11,0.1)", fg: "#fbbf24" },
  low:      { bg: "rgba(16,185,129,0.1)", fg: "#34d399" },
};

function getSeverityStyle(sev?: string) {
  return SEVERITY_META[sev?.toLowerCase() || ""] || { bg: "rgba(255,255,255,0.04)", fg: "#6b7280" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.04] ${className}`} />;
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-widest uppercase"
      style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

function HashChip({ hash }: { hash: string | null | undefined }) {
  if (!hash) return <span className="text-white/20 font-mono text-[10px]">—</span>;
  return (
    <span className="font-mono text-[10px] text-white/30 hover:text-white/50 transition-colors cursor-default" title={hash}>
      {hash.slice(0, 8)}…{hash.slice(-4)}
    </span>
  );
}

function EventRow({ entry, expanded, onToggle }: { entry: AuditEntry; expanded: boolean; onToggle: () => void }) {
  const meta = getEventMeta(entry.event_type);
  const d = entry.details;
  const isBlocked = d?.blocked === true;
  const severity = d?.max_severity;

  return (
    <div
      className="group border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.02] cursor-pointer"
      onClick={onToggle}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Dot + event type */}
        <div className="flex items-center gap-2.5 min-w-[140px]">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
          <Badge label={meta.label} bg={meta.bg} fg={meta.fg} />
        </div>

        {/* Action */}
        <span className="text-xs text-white/70 flex-1 truncate hidden sm:block">
          {entry.action}{d?.memory_type ? ` · ${d.memory_type}` : ""}
          {d?.constraint_type ? ` · ${d.constraint_type}` : ""}
        </span>

        {/* Blocked / severity */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {isBlocked && (
            <Badge label="BLOCKED" bg="rgba(239,68,68,0.1)" fg="#f87171" />
          )}
          {severity && (
            <Badge label={severity} bg={getSeverityStyle(severity).bg} fg={getSeverityStyle(severity).fg} />
          )}
        </div>

        {/* Hash */}
        <div className="hidden lg:block shrink-0">
          <HashChip hash={entry.entry_hash} />
        </div>

        {/* Timestamp */}
        <span className="text-[10px] font-mono text-white/30 shrink-0 ml-auto pl-2">
          {new Date(entry.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>

        {/* Expand icon */}
        <svg
          className={`w-3 h-3 text-white/20 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] border-t border-white/[0.04] animate-fade-in">
          <div className="space-y-1">
            <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Event ID</div>
            <div className="font-mono text-white/50 break-all">{entry.entry_id}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Actor</div>
            <div className="font-mono text-white/50 break-all">{entry.actor || "—"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Target</div>
            <div className="font-mono text-white/50 break-all">{entry.target || "—"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Timestamp</div>
            <div className="font-mono text-white/50">{new Date(entry.recorded_at).toISOString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Entry Hash (SHA-256)</div>
            <div className="font-mono text-white/40 break-all text-[10px]">{entry.entry_hash || "—"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Previous Hash</div>
            <div className="font-mono text-white/40 break-all text-[10px]">{entry.previous_hash || "—"}</div>
          </div>
          {d && Object.keys(d).length > 0 && (
            <div className="col-span-full space-y-1">
              <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Details</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {d.risk_score !== undefined && (
                  <div className="rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Risk Score</div>
                    <div className={`font-bold text-xs ${Number(d.risk_score) >= 20 ? "text-red-400" : Number(d.risk_score) >= 10 ? "text-amber-400" : "text-green-400"}`}>
                      {d.risk_score}
                    </div>
                  </div>
                )}
                {d.max_severity && (
                  <div className="rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Severity</div>
                    <div className="font-bold text-xs" style={{ color: getSeverityStyle(d.max_severity).fg }}>{d.max_severity}</div>
                  </div>
                )}
                {d.patterns_matched !== undefined && (
                  <div className="rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Patterns Matched</div>
                    <div className="font-bold text-xs text-white/70">{d.patterns_matched}</div>
                  </div>
                )}
                {d.blocked !== undefined && (
                  <div className="rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Outcome</div>
                    <div className={`font-bold text-xs ${d.blocked ? "text-red-400" : "text-green-400"}`}>
                      {d.blocked ? "BLOCKED" : "ALLOWED"}
                    </div>
                  </div>
                )}
                {d.memory_type && (
                  <div className="rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Memory Type</div>
                    <div className="font-bold text-xs text-purple-400">{d.memory_type}</div>
                  </div>
                )}
                {d.categories && d.categories.length > 0 && (
                  <div className="rounded px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.05] col-span-full">
                    <div className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Categories</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {d.categories.map((cat) => (
                        <Badge key={cat} label={cat} bg="rgba(239,68,68,0.08)" fg="#f87171" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const { token } = useAuth();

  // Core state
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [eventsByType, setEventsByType] = useState<Record<string, number>>({});
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [signing, setSigning] = useState<HealthSigning | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [auditOffset, setAuditOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 50;

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Stream
  const [streamConnected, setStreamConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Time-travel
  const [timeTravelTs, setTimeTravelTs] = useState("");
  const [timeTravelResult, setTimeTravelResult] = useState<Record<string, unknown> | null>(null);
  const [timeTravelLoading, setTimeTravelLoading] = useState(false);
  const [timeTravelError, setTimeTravelError] = useState<string | null>(null);

  // Export
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [csvExportStatus, setCsvExportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [complianceExportStatus, setComplianceExportStatus] = useState<"idle" | "loading" | "done" | "error" | "forbidden">("idle");

  // Filter
  const [filterType, setFilterType] = useState("all");

  // ── Load core data ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const [timeline, verify, health] = await Promise.allSettled([
        api.auditTimeline(token),
        api.auditVerify(token),
        api.health(),
      ]);

      if (timeline.status === "fulfilled") {
        const t = timeline.value as Record<string, unknown>;
        const rawEntries = (t.entries as AuditEntry[]) || [];
        setEntries(rawEntries);
        setEventsByType((t.events_by_type as Record<string, number>) || {});
        setTotalEvents((t.total_events as number) || rawEntries.length);
        setHasMore(rawEntries.length >= PAGE);
      } else {
        throw timeline.reason;
      }

      if (verify.status === "fulfilled") {
        setVerifyResult(verify.value as unknown as VerifyResult);
      }

      if (health.status === "fulfilled") {
        const h = health.value as Record<string, unknown>;
        setSigning(h.signing as HealthSigning);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load audit trail");
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ── SSE stream ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const es = new EventSource(`${base}/api/audit/stream`, { withCredentials: true } as unknown as EventSourceInit);
    esRef.current = es;

    es.onopen = () => setStreamConnected(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as Record<string, unknown>;
        if (data.entries) {
          setEntries(data.entries as AuditEntry[]);
        }
        if (data.events_by_type) setEventsByType(data.events_by_type as Record<string, number>);
        if (data.total_events) setTotalEvents(data.total_events as number);
      } catch { /* noop */ }
    };
    es.onerror = () => {
      setStreamConnected(false);
      es.close();
    };
    return () => { es.close(); setStreamConnected(false); };
  }, [token]);

  // ── Load more ─────────────────────────────────────────────────────────────
  async function loadMore() {
    if (!token || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextOffset = auditOffset + PAGE;
      const next = await api.auditEntries(token, { limit: String(PAGE), offset: String(nextOffset) });
      const more = ((next as Record<string, unknown>)?.entries as AuditEntry[]) || (Array.isArray(next) ? next as AuditEntry[] : []);
      if (more.length > 0) {
        setEntries((prev) => [...prev, ...more]);
        setAuditOffset(nextOffset);
        setHasMore(more.length >= PAGE);
      } else {
        setHasMore(false);
      }
    } catch { /* noop */ } finally {
      setLoadingMore(false);
    }
  }

  // ── Time-travel ───────────────────────────────────────────────────────────
  async function handleTimeTravel() {
    if (!token || !timeTravelTs) return;
    setTimeTravelLoading(true);
    setTimeTravelError(null);
    setTimeTravelResult(null);
    try {
      const local = new Date(timeTravelTs);
      const iso = local.toISOString();
      const r = await api.auditTimeTravel(token, iso);
      setTimeTravelResult({ ...(r as Record<string, unknown>), _queried_as_utc: iso });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setTimeTravelError(msg);
    } finally {
      setTimeTravelLoading(false);
    }
  }

  // ── Export JSONL ──────────────────────────────────────────────────────────
  async function handleExportJsonl() {
    if (!token) return;
    setExportStatus("loading");
    try {
      const raw = await api.exportJsonl(token) as unknown;
      const text = typeof raw === "string" ? raw : JSON.stringify(raw);
      const blob = new Blob([text], { type: "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agentshield-audit-${new Date().toISOString().slice(0, 10)}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("done");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch {
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 4000);
    }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  async function handleExportCsv() {
    if (!token) return;
    setCsvExportStatus("loading");
    try {
      const raw = await api.exportCsv(token) as unknown;
      const text = typeof raw === "string" ? raw : JSON.stringify(raw);
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agentshield-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setCsvExportStatus("done");
      setTimeout(() => setCsvExportStatus("idle"), 3000);
    } catch {
      setCsvExportStatus("error");
      setTimeout(() => setCsvExportStatus("idle"), 4000);
    }
  }

  // ── Export compliance ─────────────────────────────────────────────────────
  async function handleExportCompliance() {
    if (!token) return;
    setComplianceExportStatus("loading");
    try {
      const r = await api.complianceReport(token) as unknown as Record<string, unknown>;
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agentshield-compliance-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setComplianceExportStatus("done");
      setTimeout(() => setComplianceExportStatus("idle"), 3000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setComplianceExportStatus("forbidden");
      } else {
        setComplianceExportStatus("error");
      }
      setTimeout(() => setComplianceExportStatus("idle"), 5000);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredEntries = filterType === "all" ? entries : entries.filter(e => e.event_type === filterType);
  const uniqueTypes = Array.from(new Set(entries.map(e => e.event_type)));
  const chainValid = verifyResult?.valid;
  const chainTotal = verifyResult?.total_entries ?? 0;
  const brokenAt = verifyResult?.broken_at;
  const signingBackend = signing?.backend;
  const keyId = signing?.key_id;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 pb-6 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/25 mb-2">Security Intelligence</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Audit &amp; Forensics
            </h1>
            <p className="text-sm text-white/40 mt-1.5">
              Trace memory operations, verify chain integrity, and investigate security events.
            </p>
          </div>

          {/* Chain integrity badge */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-col sm:items-end">
            {fetching ? (
              <Skeleton className="h-8 w-36" />
            ) : verifyResult ? (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border ${
                chainValid
                  ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${chainValid ? "bg-[#10B981] animate-pulse" : "bg-rose-400"}`} />
                {chainValid ? `Chain Verified · ${chainTotal} entries` : `Chain Broken at #${brokenAt}`}
              </div>
            ) : error ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border bg-amber-500/10 border-amber-500/20 text-amber-400">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Verification Unavailable
              </div>
            ) : null}

            {/* Stream indicator */}
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono tracking-widest uppercase ${
              streamConnected ? "text-[#10B981]/60" : "text-white/20"
            }`}>
              <div className={`w-1 h-1 rounded-full ${streamConnected ? "bg-[#10B981] animate-pulse" : "bg-white/10"}`} />
              {streamConnected ? "LIVE" : "STREAM OFFLINE"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Global error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl p-5 bg-rose-500/5 border border-rose-500/15 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase text-rose-400/60 mb-1">Error</p>
            <p className="text-sm text-rose-400">{error}</p>
          </div>
          <button onClick={load} className="shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase bg-white/5 text-white/60 hover:bg-white/10 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* ── Security posture bar ───────────────────────────────────────────── */}
      {!fetching && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Chain Integrity",
              value: verifyResult
                ? (chainValid ? "VERIFIED" : "BROKEN")
                : (error ? "UNAVAILABLE" : "—"),
              color: verifyResult
                ? (chainValid ? "#10B981" : "#f87171")
                : "#6b7280",
            },
            {
              label: "Audit Entries",
              value: verifyResult ? String(chainTotal) : "—",
              color: "#a78bfa",
            },
            {
              label: "Event Types",
              value: String(uniqueTypes.length || Object.keys(eventsByType).length || 0),
              color: "#38bdf8",
            },
            {
              label: "Threat Detections",
              value: String(eventsByType["pattern_detected"] ?? 0),
              color: (eventsByType["pattern_detected"] ?? 0) > 0 ? "#f87171" : "#6b7280",
            },
            {
              label: "Signing Backend",
              value: signingBackend ? signingBackend.toUpperCase() : "—",
              color: "#f59e0b",
            },
            {
              label: "Key ID",
              value: keyId ? keyId.slice(0, 8) + "…" : "—",
              color: "#6b7280",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[9px] font-mono tracking-widest uppercase text-white/30 mb-2 leading-tight">{item.label}</div>
              <div className="text-sm font-bold font-mono" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {fetching && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      )}

      {/* ── Event breakdown ────────────────────────────────────────────────── */}
      {!fetching && Object.keys(eventsByType).length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
            <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Event Breakdown</span>
            <span className="ml-auto text-[10px] font-mono text-white/20">{totalEvents} total</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(eventsByType).map(([type, count]) => {
              const meta = getEventMeta(type);
              const pct = (count / (totalEvents || 1)) * 100;
              return (
                <button
                  key={type}
                  className="text-left rounded-lg p-3 border transition-all hover:bg-white/[0.04]"
                  style={{ background: meta.bg, borderColor: meta.border }}
                  onClick={() => setFilterType(filterType === type ? "all" : type)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-mono tracking-widest uppercase" style={{ color: meta.fg }}>{type}</span>
                    <span className="text-lg font-bold" style={{ color: meta.fg, fontFamily: "var(--font-space-grotesk)" }}>{count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.fg, opacity: 0.6 }} />
                  </div>
                  <div className="text-[8px] font-mono text-white/20 mt-1.5">{pct.toFixed(1)}% of all events</div>
                </button>
              );
            })}
          </div>
          {filterType !== "all" && (
            <div className="px-5 pb-3 flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/30">Filtering by:</span>
              <Badge label={filterType} bg={getEventMeta(filterType).bg} fg={getEventMeta(filterType).fg} />
              <button onClick={() => setFilterType("all")} className="text-[10px] font-mono text-white/30 hover:text-white/60 underline ml-1">clear</button>
            </div>
          )}
        </div>
      )}

      {/* ── Event timeline ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Security Event Timeline</span>
            {filterType !== "all" && (
              <Badge label={`filtered: ${filterType}`} bg="rgba(255,255,255,0.04)" fg="#6b7280" />
            )}
          </div>
          <button onClick={load} className="text-[10px] font-mono tracking-widest uppercase text-white/20 hover:text-white/50 transition-colors">
            Refresh
          </button>
        </div>

        {fetching && (
          <div className="p-4 space-y-2">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        )}

        {!fetching && filteredEntries.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <p className="text-[10px] font-mono tracking-widest uppercase text-white/25 mb-2">
              {filterType !== "all" ? `No ${filterType} events` : "No Audit Events"}
            </p>
            <p className="text-xs text-white/20">
              {filterType !== "all"
                ? "No events match the selected filter."
                : "Security-sensitive memory operations will appear here."}
            </p>
          </div>
        )}

        {!fetching && filteredEntries.length > 0 && (
          <div>
            {filteredEntries.map((entry) => (
              <EventRow
                key={entry.entry_id}
                entry={entry}
                expanded={expanded.has(entry.entry_id)}
                onToggle={() => toggleExpand(entry.entry_id)}
              />
            ))}

            {/* Load more */}
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/25">{filteredEntries.length} events shown</span>
              {hasMore ? (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase bg-white/[0.03] border border-white/5 text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all disabled:opacity-40"
                >
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              ) : (
                <span className="text-[10px] font-mono text-white/20">All events loaded</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Chain verification panel ────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
          <div className={`w-1.5 h-1.5 rounded-full ${chainValid ? "bg-[#10B981] animate-pulse" : chainValid === false ? "bg-rose-400" : "bg-white/20"}`} />
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Hash Chain Verification</span>
        </div>
        <div className="p-5">
          {fetching ? (
            <Skeleton className="h-16" />
          ) : verifyResult ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className={`flex-1 rounded-lg p-4 border ${chainValid ? "bg-[#10B981]/5 border-[#10B981]/15" : "bg-rose-500/5 border-rose-500/15"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {chainValid ? (
                    <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  )}
                  <span className={`text-sm font-bold ${chainValid ? "text-[#10B981]" : "text-rose-400"}`}>
                    {chainValid ? "Hash Chain Valid" : "Hash Chain Broken"}
                  </span>
                </div>
                <p className="text-xs text-white/40">
                  {chainValid
                    ? `All ${chainTotal} audit entries are correctly hash-linked. No tampering detected.`
                    : `Tamper evidence detected at entry index #${brokenAt}. Chain integrity is compromised.`}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-center rounded-lg px-4 py-3 bg-white/[0.02] border border-white/5">
                  <div className="text-xl font-bold text-white/80" style={{ fontFamily: "var(--font-space-grotesk)" }}>{chainTotal}</div>
                  <div className="text-[9px] font-mono tracking-widest uppercase text-white/25">Linked Entries</div>
                </div>
                <button onClick={load} className="px-4 py-2 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase bg-white/[0.04] border border-white/5 text-white/50 hover:bg-white/[0.08] transition-all">
                  Re-verify
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/30 font-mono">
              {error ? "Verification unavailable — " + error : "Loading verification state…"}
            </p>
          )}
        </div>
      </div>

      {/* ── Time-travel forensics ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Time-Travel Forensics</span>
          <span className="ml-2 text-[9px] font-mono text-white/15">— reconstruct memory state at any point in time</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-white/30">
            Query the audit trail as it existed at a specific timestamp. On CockroachDB uses AS OF SYSTEM TIME; on SQLite filters by recorded_at.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-mono tracking-widest uppercase text-white/25 block mb-1.5">Timestamp (local time)</label>
              <input
                type="datetime-local"
                value={timeTravelTs}
                onChange={(e) => setTimeTravelTs(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-mono bg-white/[0.04] border border-white/8 text-white/70 focus:outline-none focus:border-[#8B5CF6]/40 focus:bg-white/[0.06] transition-all"
              />
              {timeTravelTs && (
                <p className="text-[9px] font-mono text-white/20 mt-1">
                  Local ({Intl.DateTimeFormat().resolvedOptions().timeZone}) → UTC {new Date(timeTravelTs).toISOString()}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <button
                onClick={handleTimeTravel}
                disabled={timeTravelLoading || !timeTravelTs}
                className="px-5 py-2.5 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase bg-[#8B5CF6]/20 border border-[#8B5CF6]/20 text-[#a78bfa] hover:bg-[#8B5CF6]/30 transition-all disabled:opacity-40"
              >
                {timeTravelLoading ? "Querying…" : "Query State"}
              </button>
            </div>
          </div>

          {timeTravelError && (
            <div className="rounded-lg p-3 bg-rose-500/5 border border-rose-500/15">
              <p className="text-xs text-rose-400 font-mono">{timeTravelError}</p>
            </div>
          )}

          {timeTravelResult && !timeTravelError && (
            <div className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[9px] font-mono tracking-widest uppercase text-white/30">Query Result</span>
                <span className="text-[10px] font-mono text-white/30">
                  {(timeTravelResult.total as number) ?? 0} events · {timeTravelResult.backend as string ?? ""}
                </span>
              </div>
              <div className="p-4 max-h-64 overflow-auto">
                <pre className="text-[10px] font-mono text-white/40 whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(timeTravelResult, null, 2).slice(0, 8000)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Export & compliance ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Export &amp; Compliance</span>
        </div>
        <div className="p-5 flex flex-wrap gap-3">
          {/* Export JSONL */}
          <div className="flex flex-col gap-1">
            <button
              onClick={handleExportJsonl}
              disabled={exportStatus === "loading"}
              className={`px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase border transition-all ${
                exportStatus === "done"
                  ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]"
                  : exportStatus === "error"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  : "bg-white/[0.04] border-white/8 text-white/50 hover:bg-white/[0.08] hover:text-white/70"
              }`}
            >
              {exportStatus === "loading" ? "Exporting…"
                : exportStatus === "done" ? "✓ Exported"
                : exportStatus === "error" ? "Export Failed"
                : "Export Audit JSONL"}
            </button>
            <span className="text-[9px] font-mono text-white/20">Full audit trail as JSONL</span>
          </div>

          {/* Export CSV */}
          <div className="flex flex-col gap-1">
            <button
              onClick={handleExportCsv}
              disabled={csvExportStatus === "loading"}
              className={`px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase border transition-all ${
                csvExportStatus === "done"
                  ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]"
                  : csvExportStatus === "error"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  : "bg-white/[0.04] border-white/8 text-white/50 hover:bg-white/[0.08] hover:text-white/70"
              }`}
            >
              {csvExportStatus === "loading" ? "Exporting…"
                : csvExportStatus === "done" ? "✓ Exported"
                : csvExportStatus === "error" ? "Export Failed"
                : "Export Audit CSV"}
            </button>
            <span className="text-[9px] font-mono text-white/20">Audit event table as CSV</span>
          </div>

          {/* Export compliance */}
          <div className="flex flex-col gap-1">
            <button
              onClick={handleExportCompliance}
              disabled={complianceExportStatus === "loading"}
              className={`px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase border transition-all ${
                complianceExportStatus === "done"
                  ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]"
                  : complianceExportStatus === "error"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  : complianceExportStatus === "forbidden"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-white/[0.04] border-white/8 text-white/50 hover:bg-white/[0.08] hover:text-white/70"
              }`}
            >
              {complianceExportStatus === "loading" ? "Generating…"
                : complianceExportStatus === "done" ? "✓ Downloaded"
                : complianceExportStatus === "error" ? "Export Failed"
                : complianceExportStatus === "forbidden" ? "Access Restricted"
                : "Export Compliance JSON"}
            </button>
            <span className="text-[9px] font-mono text-white/20">
              {complianceExportStatus === "forbidden"
                ? "Requires admin role"
                : "EU AI Act Article 12 report"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
