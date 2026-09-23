"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

/* ─── Types ─── */
interface Constraint { constraint_id: string; text: string; constraint_type: string; is_active: boolean; created_at: string; entry_hash?: string; kms_signature?: string; }
interface Memory { memory_id: string; content: string; memory_type: string; created_at: string; entry_hash?: string; importance_score?: number; trust_level?: number; source_provenance?: string; kms_signature?: string; }
interface AuditEntry { entry_id: string; event_type: string; action: string; actor?: string; target?: string; recorded_at: string; details?: Record<string, unknown>; entry_hash?: string; }
type StatusLevel = "verified" | "active" | "configured" | "unavailable" | "failed" | "unknown";
interface PostureItem { id: string; label: string; sublabel: string; status: StatusLevel; statusLabel: string; icon: React.ReactNode; href: string; }

/* ─── Color Maps ─── */
const EVENT_COLORS: Record<string, { bg: string; fg: string }> = {
  safety: { bg: "rgba(180,40,40,0.10)", fg: "#dc6b6b" },
  policy: { bg: "rgba(217,130,6,0.10)", fg: "#d99050" },
  instruction: { bg: "rgba(56,150,210,0.10)", fg: "#5cb0d9" },
  episodic: { bg: "rgba(130,80,220,0.10)", fg: "#a882e0" },
  semantic: { bg: "rgba(56,150,210,0.10)", fg: "#5cb0d9" },
  procedural: { bg: "rgba(217,130,6,0.10)", fg: "#d99050" },
  auth: { bg: "rgba(56,150,210,0.10)", fg: "#5cb0d9" },
  constraint: { bg: "rgba(16,150,110,0.10)", fg: "#34b88a" },
  memory: { bg: "rgba(130,80,220,0.10)", fg: "#a882e0" },
  scan: { bg: "rgba(217,130,6,0.10)", fg: "#d99050" },
  audit: { bg: "rgba(16,150,110,0.10)", fg: "#34b88a" },
  system: { bg: "rgba(100,116,139,0.10)", fg: "#8e9bae" },
  chain: { bg: "rgba(16,150,110,0.10)", fg: "#34b88a" },
  detection: { bg: "rgba(217,130,6,0.10)", fg: "#d99050" },
  integrity: { bg: "rgba(16,150,110,0.10)", fg: "#34b88a" },
};

function getTypeColor(type: string) {
  if (EVENT_COLORS[type]) return EVENT_COLORS[type];
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { bg: `hsla(${hue},50%,45%,0.10)`, fg: `hsl(${hue},50%,55%)` };
}

const STATUS_STYLES: Record<StatusLevel, { bg: string; fg: string; dot: string; border: string }> = {
  verified:   { bg: "rgba(16,150,110,0.06)",  fg: "#34d399", dot: "#34d399", border: "rgba(16,150,110,0.12)" },
  active:     { bg: "rgba(16,150,110,0.06)",  fg: "#34d399", dot: "#34d399", border: "rgba(16,150,110,0.12)" },
  configured: { bg: "rgba(56,150,210,0.06)",  fg: "#60b8e0", dot: "#60b8e0", border: "rgba(56,150,210,0.12)" },
  unavailable:{ bg: "rgba(100,116,139,0.06)", fg: "#8e9bae", dot: "#64748b", border: "rgba(100,116,139,0.12)" },
  failed:     { bg: "rgba(220,80,80,0.06)",   fg: "#e08080", dot: "#dc6060", border: "rgba(220,80,80,0.12)" },
  unknown:    { bg: "rgba(100,116,139,0.06)", fg: "#8e9bae", dot: "#64748b", border: "rgba(100,116,139,0.12)" },
};

/* ─── SVG Icons ─── */
const icons = {
  chain: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  brain: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7.5L12 20l3-3.5c2-2 4-4.5 4-7.5a7 7 0 0 0-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
  clipboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  key: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  arrowRight: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  arrowDown: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  ),
  check: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  minus: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  database: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
};

function StatusIcon({ status }: { status: StatusLevel }) {
  if (status === "verified" || status === "active") return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.check}</span>;
  if (status === "failed") return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.x}</span>;
  return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.minus}</span>;
}

/* ─── Loading Skeleton ─── */
function Skeleton() {
  return (
    <div className="space-y-5">
      {/* Header skeleton */}
      <div className="flex items-center justify-between pb-5 border-b border-white/[0.04]">
        <div className="space-y-3">
          <div className="h-3 w-40 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-7 w-56 rounded bg-white/[0.04] animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-7 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>
      </div>
      {/* Posture skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[108px] rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        ))}
      </div>
      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        ))}
      </div>
      {/* Pipeline skeleton */}
      <div className="h-20 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
      {/* Bottom skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 h-64 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        <div className="space-y-3">
          <div className="h-28 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse h-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="h-56 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        <div className="h-56 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
      </div>
    </div>
  );
}

/* ─── Error State ─── */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 mb-2">System Error</p>
        <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>Command Center</h1>
      </div>
      <div className="rounded-xl p-10 text-center bg-[rgba(220,60,60,0.04)] border border-[rgba(220,60,60,0.12)]">
        <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-[rgba(220,60,60,0.08)] flex items-center justify-center">
          <span className="text-[rgba(220,60,60,0.6)]">{icons.alert}</span>
        </div>
        <p className="text-sm font-medium mb-1.5 text-[rgba(220,100,100,0.9)]">{error}</p>
        <p className="text-[10px] font-mono tracking-wider uppercase text-white/25 mb-5">Unable to connect to backend services</p>
        <button onClick={onRetry} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[10px] font-mono font-bold tracking-widest uppercase bg-[rgba(220,60,60,0.08)] text-[rgba(220,100,100,0.9)] border border-[rgba(220,60,60,0.15)] hover:bg-[rgba(220,60,60,0.12)] transition-all cursor-pointer">
          {icons.refresh}
          Retry Connection
        </button>
      </div>
    </div>
  );
}

/* ─── Panel Component ─── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ label, color, action }: { label: string; color: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
      <div className="flex items-center gap-2.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/40">{label}</span>
      </div>
      {action}
    </div>
  );
}

/* ─── Pipeline Stage ─── */
function PipelineStage({ label, status, isLast }: { label: string; status: StatusLevel; isLast?: boolean }) {
  const s = STATUS_STYLES[status];
  return (
    <div className="flex items-center gap-0">
      <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all"
          style={{ backgroundColor: s.bg, borderColor: s.border }}
        >
          <StatusIcon status={status} />
        </div>
        <span className="text-[8px] font-mono tracking-[0.12em] uppercase text-white/35 text-center leading-tight">{label}</span>
      </div>
      {!isLast && (
        <div className="flex-1 h-px mx-1.5 relative min-w-[16px]">
          <div className="absolute inset-0 bg-white/[0.06]" />
          <div
            className="absolute inset-y-0 left-0 transition-all duration-700"
            style={{
              width: status === "verified" || status === "active" ? "100%" : status === "configured" ? "50%" : "0%",
              background: `linear-gradient(90deg, ${s.fg}40, ${s.fg}20)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { token } = useAuth();

  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditEvents, setAuditEvents] = useState<Record<string, number>>({});
  const [totalAuditEvents, setTotalAuditEvents] = useState(0);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [compliance, setCompliance] = useState("UNKNOWN");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [patternCount, setPatternCount] = useState<number | null>(null);
  const [constraintIntegrity, setConstraintIntegrity] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const [c, m, t, cv, cr] = await Promise.all([
          api.listConstraints(token),
          api.listMemories(token),
          api.auditTimeline(token),
          api.auditVerify(token),
          api.complianceReport(token).catch(() => ({ compliance_status: "UNKNOWN" })),
        ]);
        if (cancelled) return;

        setConstraints(Array.isArray(c) ? c as unknown as Constraint[] : []);
        setMemories(Array.isArray(m) ? m as unknown as Memory[] : []);

        const timeline = t as Record<string, unknown>;
        const entries = (timeline.entries || []) as unknown as AuditEntry[];
        setAuditEntries(entries);
        const evts = (timeline.events_by_type || {}) as Record<string, number>;
        setAuditEvents(evts);
        setTotalAuditEvents(Number(timeline.total_events) || Object.values(evts).reduce((a, b) => a + (b as number), 0));

        const cvd = cv as Record<string, unknown>;
        setChainValid((cvd.valid as boolean) ?? (cvd.is_valid as boolean) ?? false);

        setCompliance((cr as Record<string, unknown>).compliance_status as string || "UNKNOWN");
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  // SSE for real-time updates
  useEffect(() => {
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const es = new EventSource(`${base}/api/audit/stream`, { withCredentials: true } as unknown as EventSourceInit);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.entries) setAuditEntries(data.entries as unknown as AuditEntry[]);
        if (data.events_by_type) setAuditEvents(data.events_by_type as Record<string, number>);
        if (typeof data.audit_valid === "boolean" || typeof data.hash_valid === "boolean") {
          setChainValid(!!(data.audit_valid && data.hash_valid));
        }
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [token]);

  // Background checks: health, patterns, constraint integrity
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [healthResult, patternsResult, ciResult] = await Promise.allSettled([
        api.health(),
        api.scanPatterns(token),
        api.verifyConstraints(token),
      ]);
      if (cancelled) return;
      setBackendOk(healthResult.status === "fulfilled");
      if (patternsResult.status === "fulfilled") {
        const pr = patternsResult.value as Record<string, unknown>;
        const stats = pr.stats as Record<string, unknown> | undefined;
        setPatternCount(stats?.total_patterns as number ?? null);
      }
      if (ciResult.status === "fulfilled") {
        const ci = ciResult.value as Record<string, unknown>;
        const hc = ci.hash_chain as Record<string, unknown> | undefined;
        setConstraintIntegrity(hc?.is_valid as boolean ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  // ─── Security Posture ───
  const postureItems: PostureItem[] = [
    {
      id: "chain",
      label: "Chain Integrity",
      sublabel: "Hash chain verification",
      status: chainValid === null ? "unknown" : chainValid ? "verified" : "failed",
      statusLabel: chainValid === null ? "Unknown" : chainValid ? "Verified" : "Broken",
      icon: icons.chain,
      href: "/dashboard/audit",
    },
    {
      id: "constraints",
      label: "Constraint Protection",
      sublabel: `${constraints.filter(c => c.is_active).length} active rules`,
      status: constraintIntegrity === null ? (constraints.length > 0 ? "active" : "unknown") : constraintIntegrity ? "verified" : "failed",
      statusLabel: constraintIntegrity === null ? (constraints.length > 0 ? "Active" : "Unknown") : constraintIntegrity ? "Verified" : "Invalid",
      icon: icons.shield,
      href: "/dashboard/constraints",
    },
    {
      id: "memory",
      label: "Memory Defense",
      sublabel: `${memories.length} memories stored`,
      status: memories.length > 0 ? "active" : "unknown",
      statusLabel: memories.length > 0 ? "Active" : "No Data",
      icon: icons.brain,
      href: "/dashboard/memory",
    },
    {
      id: "detection",
      label: "Poisoning Detection",
      sublabel: patternCount !== null ? `${patternCount} patterns loaded` : "Pattern engine",
      status: patternCount !== null ? "configured" : "unavailable",
      statusLabel: patternCount !== null ? "Configured" : "Unavailable",
      icon: icons.alert,
      href: "/dashboard/constraints",
    },
    {
      id: "audit",
      label: "Audit Trail",
      sublabel: `${totalAuditEvents} events recorded`,
      status: totalAuditEvents > 0 ? "active" : "unknown",
      statusLabel: totalAuditEvents > 0 ? "Recording" : "No Events",
      icon: icons.clipboard,
      href: "/dashboard/audit",
    },
    {
      id: "kms",
      label: "KMS Signing",
      sublabel: "Cryptographic signatures",
      status: constraints.some(c => c.kms_signature) || memories.some(m => m.kms_signature) ? "active" : "unknown",
      statusLabel: constraints.some(c => c.kms_signature) || memories.some(m => m.kms_signature) ? "Active" : "Unknown",
      icon: icons.key,
      href: "/dashboard/compliance",
    },
  ];

  // ─── Pipeline stages ───
  const pipelineStages: { label: string; status: StatusLevel }[] = [
    { label: "Authenticate", status: backendOk === true ? "verified" : backendOk === false ? "failed" : "unknown" },
    { label: "Constraint", status: constraintIntegrity === null ? (constraints.length > 0 ? "active" : "unknown") : constraintIntegrity ? "verified" : "failed" },
    { label: "Detect", status: patternCount !== null ? "configured" : "unavailable" },
    { label: "Hash", status: chainValid === null ? "unknown" : chainValid ? "verified" : "failed" },
    { label: "Chain", status: chainValid === null ? "unknown" : chainValid ? "verified" : "failed" },
    { label: "Sign", status: constraints.some(c => c.kms_signature) || memories.some(m => m.kms_signature) ? "active" : "unknown" },
    { label: "Persist", status: backendOk === true ? "verified" : backendOk === false ? "failed" : "unknown" },
    { label: "Audit", status: totalAuditEvents > 0 ? "active" : "unknown" },
  ];

  // ─── Max event count for bar chart ───
  const maxEventCount = (() => {
    const vals = Object.values(auditEvents).map(Number);
    return vals.length ? Math.max(...vals) : 1;
  })();

  if (loading) return <Skeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-5 animate-slide-up">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/[0.04]">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center">
              <span className="text-[#10B981]">{icons.shield}</span>
            </div>
            <div>
              <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#10B981]/50">AgentShield</p>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none" style={{ fontFamily: "var(--font-space-grotesk)" }}>Memory Defense</h1>
            </div>
          </div>
          <p className="text-[11px] text-white/30 max-w-md">Protect, verify and audit your AI agent&apos;s long-term memory against tampering, poisoning, and injection attacks.</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono tracking-wider uppercase border transition-all ${
            backendOk === true ? 'bg-[rgba(16,150,110,0.06)] border-[rgba(16,150,110,0.12)] text-[#34d399]'
            : backendOk === false ? 'bg-[rgba(220,60,60,0.06)] border-[rgba(220,60,60,0.12)] text-[#e08080]'
            : 'bg-[rgba(100,116,139,0.06)] border-[rgba(100,116,139,0.12)] text-[#8e9bae]'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${backendOk === true ? 'bg-[#34d399]' : backendOk === false ? 'bg-[#dc6060]' : 'bg-[#64748b]'} ${backendOk !== false ? 'animate-pulse' : ''}`} />
            Backend {backendOk === true ? "Connected" : backendOk === false ? "Unavailable" : "Checking"}
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono tracking-wider uppercase border ${
            chainValid === true ? 'bg-[rgba(16,150,110,0.06)] border-[rgba(16,150,110,0.12)] text-[#34d399]'
            : chainValid === false ? 'bg-[rgba(220,60,60,0.06)] border-[rgba(220,60,60,0.12)] text-[#e08080]'
            : 'bg-[rgba(100,116,139,0.06)] border-[rgba(100,116,139,0.12)] text-[#8e9bae]'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${chainValid === true ? 'bg-[#34d399]' : chainValid === false ? 'bg-[#dc6060]' : 'bg-[#64748b]'}`} />
            Chain {chainValid === true ? "Verified" : chainValid === false ? "Broken" : "Unknown"}
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono tracking-wider uppercase border ${
            compliance === 'COMPLIANT' ? 'bg-[rgba(16,150,110,0.06)] border-[rgba(16,150,110,0.12)] text-[#34d399]'
            : 'bg-[rgba(217,130,6,0.06)] border-[rgba(217,130,6,0.12)] text-[#d99050]'
          }`}>
            {compliance}
          </div>
        </div>
      </div>

      {/* ─── SECURITY POSTURE ─── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/25">Security Posture</span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {postureItems.map((item) => {
            const s = STATUS_STYLES[item.status];
            return (
              <a
                key={item.id}
                href={item.href}
                className="group relative rounded-xl p-4 border transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                style={{ backgroundColor: s.bg, borderColor: s.border }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span style={{ color: s.fg }} className="opacity-70 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                  <StatusIcon status={item.status} />
                </div>
                <div className="text-[10px] font-mono tracking-wider uppercase text-white/60 mb-0.5 group-hover:text-white/80 transition-colors">{item.label}</div>
                <div className="text-[9px] font-mono tracking-wider uppercase" style={{ color: `${s.fg}99` }}>{item.statusLabel}</div>
                <div className="text-[8px] font-mono tracking-wider text-white/20 mt-1">{item.sublabel}</div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ─── CORE TELEMETRY ─── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/25">Core Telemetry</span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { label: "Constraints", sublabel: `${constraints.filter(c => c.is_active).length} active`, value: constraints.length, color: "#34d399", link: "/dashboard/constraints" },
            { label: "Memories", sublabel: "Secured entries", value: memories.length, color: "#a882e0", link: "/dashboard/memory" },
            { label: "Audit Events", sublabel: "Total recorded", value: totalAuditEvents, color: "#d99050", link: "/dashboard/audit" },
            { label: "Detection Rules", sublabel: patternCount !== null ? "OWASP ASI06" : "Unavailable", value: patternCount ?? 0, color: "#60b8e0", link: null },
          ].map((stat) => (
            <a
              key={stat.label}
              href={stat.link || "#"}
              className={`group relative rounded-xl p-4 border border-white/[0.04] bg-white/[0.015] transition-all duration-300 hover:bg-white/[0.03] hover:border-white/[0.08] ${stat.link ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'}`}
            >
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--font-space-grotesk)", color: stat.color }}>{stat.value}</span>
              </div>
              <div className="text-[10px] font-mono tracking-[0.12em] uppercase text-white/40">{stat.label}</div>
              <div className="text-[8px] font-mono tracking-wider text-white/20 mt-0.5">{stat.sublabel}</div>
              {stat.link && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0" style={{ color: stat.color }}>
                  {icons.arrowRight}
                </div>
              )}
            </a>
          ))}
        </div>
      </section>

      {/* ─── MEMORY DEFENSE PIPELINE ─── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/25">Memory Defense Pipeline</span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>
        <Panel className="px-5 py-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
            {pipelineStages.map((stage, i) => (
              <PipelineStage key={stage.label} label={stage.label} status={stage.status} isLast={i === pipelineStages.length - 1} />
            ))}
          </div>
        </Panel>
      </section>

      {/* ─── RECENT SECURITY ACTIVITY + INTEGRITY + EVENTS ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Security Activity */}
        <div className="lg:col-span-2">
          <Panel>
            <PanelHeader label="Recent Security Activity" color="#d99050" action={
              <a href="/dashboard/audit" className="text-[9px] font-mono tracking-[0.12em] uppercase text-[#34d399]/70 hover:text-[#34d399] transition-colors">View all</a>
            } />
            <div className="p-2">
              {auditEntries.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-8 h-8 mx-auto mb-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <span className="text-white/15">{icons.clipboard}</span>
                  </div>
                  <p className="text-[10px] font-mono tracking-[0.12em] uppercase text-white/25">No security events recorded yet</p>
                </div>
              ) : auditEntries.slice(0, 6).map((entry) => {
                const c = getTypeColor(entry.event_type);
                return (
                  <a
                    key={entry.entry_id}
                    href="/dashboard/audit"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group cursor-pointer"
                  >
                    <span className="text-[8px] font-mono tracking-wider uppercase px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: c.bg, color: c.fg }}>
                      {entry.event_type}
                    </span>
                    <span className="text-[11px] text-white/50 flex-1 truncate group-hover:text-white/70 transition-colors">{entry.action}</span>
                    {entry.actor && (
                      <span className="text-[8px] font-mono tracking-wider text-white/20 shrink-0 hidden sm:block">{entry.actor}</span>
                    )}
                    <span className="text-[8px] font-mono tracking-wider text-white/20 shrink-0 flex items-center gap-1">
                      {icons.clock}
                      {new Date(entry.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </a>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Right column: Integrity + Event Breakdown */}
        <div className="space-y-3">
          {/* Integrity Center */}
          <Panel>
            <PanelHeader label="Integrity Center" color="#34d399" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  chainValid === true ? 'bg-[rgba(16,150,110,0.08)] border-[rgba(16,150,110,0.15)]'
                  : chainValid === false ? 'bg-[rgba(220,60,60,0.08)] border-[rgba(220,60,60,0.15)]'
                  : 'bg-white/[0.03] border-white/[0.06]'
                }`}>
                  <span style={{ color: chainValid === true ? '#34d399' : chainValid === false ? '#e08080' : '#8e9bae' }}>{icons.chain}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono tracking-wider uppercase text-white/50">Audit Chain</div>
                  <div className={`text-[11px] font-mono font-medium ${
                    chainValid === true ? 'text-[#34d399]' : chainValid === false ? 'text-[#e08080]' : 'text-[#8e9bae]'
                  }`}>
                    {chainValid === true ? "Verified" : chainValid === false ? "Invalid" : "Unknown"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  constraintIntegrity === true ? 'bg-[rgba(16,150,110,0.08)] border-[rgba(16,150,110,0.15)]'
                  : constraintIntegrity === false ? 'bg-[rgba(220,60,60,0.08)] border-[rgba(220,60,60,0.15)]'
                  : 'bg-white/[0.03] border-white/[0.06]'
                }`}>
                  <span style={{ color: constraintIntegrity === true ? '#34d399' : constraintIntegrity === false ? '#e08080' : '#8e9bae' }}>{icons.shield}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono tracking-wider uppercase text-white/50">Constraint Hash</div>
                  <div className={`text-[11px] font-mono font-medium ${
                    constraintIntegrity === true ? 'text-[#34d399]' : constraintIntegrity === false ? 'text-[#e08080]' : 'text-[#8e9bae]'
                  }`}>
                    {constraintIntegrity === true ? "Verified" : constraintIntegrity === false ? "Invalid" : "Unknown"}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Event Breakdown */}
          <Panel className="flex-1">
            <PanelHeader label="Event Breakdown" color="#60b8e0" />
            <div className="p-4 space-y-2.5">
              {Object.keys(auditEvents).length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-[10px] font-mono tracking-[0.12em] uppercase text-white/25">No events recorded</p>
                </div>
              ) : Object.entries(auditEvents)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([type, count]) => {
                    const c = getTypeColor(type);
                    const pct = ((count as number) / maxEventCount) * 100;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-mono tracking-wider uppercase text-white/40">{type}</span>
                          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: c.fg }}>{count as number}</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden bg-white/[0.04]">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: c.fg, opacity: 0.6 }} />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </Panel>
        </div>
      </section>

      {/* ─── RECENT CONSTRAINTS + MEMORIES ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Constraints */}
        <Panel>
          <PanelHeader label="Recent Constraints" color="#34d399" action={
            <a href="/dashboard/constraints" className="text-[9px] font-mono tracking-[0.12em] uppercase text-[#34d399]/70 hover:text-[#34d399] transition-colors">View all</a>
          } />
          <div className="p-2">
            {constraints.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-8 h-8 mx-auto mb-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <span className="text-white/15">{icons.shield}</span>
                </div>
                <p className="text-[10px] font-mono tracking-[0.12em] uppercase text-white/25">No constraints pinned yet</p>
              </div>
            ) : constraints.slice(0, 4).map((c) => {
              const tc = getTypeColor(c.constraint_type);
              return (
                <a
                  key={c.constraint_id}
                  href="/dashboard/constraints"
                  className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors group cursor-pointer border border-transparent hover:border-white/[0.04]"
                >
                  <div className="mt-0.5">
                    <span className="text-[8px] font-mono tracking-wider uppercase px-2 py-0.5 rounded inline-block" style={{ backgroundColor: tc.bg, color: tc.fg }}>
                      {c.constraint_type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">{c.text}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[8px] font-mono tracking-wider text-white/20 flex items-center gap-1">
                        {icons.clock}
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      <span className={`text-[8px] font-mono tracking-wider uppercase ${c.is_active ? 'text-[#34d399]/50' : 'text-white/20'}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                      {c.kms_signature && (
                        <span className="text-[8px] font-mono tracking-wider text-[#60b8e0]/40 flex items-center gap-1">
                          {icons.key} Signed
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </Panel>

        {/* Recent Memories */}
        <Panel>
          <PanelHeader label="Recent Memories" color="#a882e0" action={
            <a href="/dashboard/memory" className="text-[9px] font-mono tracking-[0.12em] uppercase text-[#34d399]/70 hover:text-[#34d399] transition-colors">View all</a>
          } />
          <div className="p-2">
            {memories.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-8 h-8 mx-auto mb-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <span className="text-white/15">{icons.database}</span>
                </div>
                <p className="text-[10px] font-mono tracking-[0.12em] uppercase text-white/25">No memories stored yet</p>
              </div>
            ) : memories.slice(0, 4).map((m) => {
              const tc = getTypeColor(m.memory_type);
              return (
                <a
                  key={m.memory_id}
                  href="/dashboard/memory"
                  className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors group cursor-pointer border border-transparent hover:border-white/[0.04]"
                >
                  <div className="mt-0.5">
                    <span className="text-[8px] font-mono tracking-wider uppercase px-2 py-0.5 rounded inline-block" style={{ backgroundColor: tc.bg, color: tc.fg }}>
                      {m.memory_type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">{m.content}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[8px] font-mono tracking-wider text-white/20 flex items-center gap-1">
                        {icons.clock}
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                      {m.entry_hash && (
                        <span className="text-[8px] font-mono tracking-wider text-[#34d399]/40">Hashed</span>
                      )}
                      {m.kms_signature && (
                        <span className="text-[8px] font-mono tracking-wider text-[#60b8e0]/40 flex items-center gap-1">
                          {icons.key} Signed
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </Panel>
      </section>
    </div>
  );
}
