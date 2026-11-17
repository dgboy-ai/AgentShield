"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Badge, ErrorState, PageHeader, SectionHeading, Skeleton, type Tone } from "@/components/dashboard/kit";

interface Constraint {
  constraint_id: string;
  text: string;
  constraint_type: string;
  is_active: boolean;
  created_at: string;
  entry_hash?: string;
  kms_signature?: string;
}

interface Memory {
  memory_id: string;
  content: string;
  memory_type: string;
  created_at: string;
  entry_hash?: string;
  importance_score?: number;
  trust_level?: number;
  source_provenance?: string;
  kms_signature?: string;
}

interface AuditEntry {
  entry_id: string;
  event_type: string;
  action: string;
  actor?: string;
  target?: string;
  recorded_at: string;
  details?: Record<string, unknown>;
  entry_hash?: string;
}

type StatusLevel = "verified" | "active" | "configured" | "unavailable" | "failed" | "unknown";

interface PostureItem {
  id: string;
  label: string;
  sublabel: string;
  status: StatusLevel;
  statusLabel: string;
  icon: React.ReactNode;
  href: string;
}

const EVENT_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  safety: { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" },
  policy: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  instruction: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
  episodic: { bg: "#F5F3FF", fg: "#6D28D9", border: "#DDD6FE" },
  semantic: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
  procedural: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  auth: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
  constraint: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
  memory: { bg: "#F5F3FF", fg: "#6D28D9", border: "#DDD6FE" },
  scan: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  audit: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
  system: { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" },
  chain: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
  detection: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  integrity: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
};

function getTypeColor(type: string) {
  if (EVENT_COLORS[type]) return EVENT_COLORS[type];
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { bg: `hsl(${hue}, 80%, 96%)`, fg: `hsl(${hue}, 60%, 35%)`, border: `hsl(${hue}, 60%, 85%)` };
}

const STATUS_TONE: Record<StatusLevel, Tone> = {
  verified: "green",
  active: "green",
  configured: "blue",
  unavailable: "neutral",
  failed: "red",
  unknown: "neutral",
};

const STATUS_STYLES: Record<StatusLevel, { bg: string; fg: string; border: string }> = {
  verified: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
  active: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
  configured: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
  unavailable: { bg: "#F8FAFC", fg: "#64748B", border: "#E2E8F0" },
  failed: { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" },
  unknown: { bg: "#F8FAFC", fg: "#64748B", border: "#E2E8F0" },
};

const icons = {
  chain: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  brain: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7.5L12 20l3-3.5c2-2 4-4.5 4-7.5a7 7 0 0 0-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  alert: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
  clipboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  key: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  arrowRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  minus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  database: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  refresh: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
};

function StatusIcon({ status }: { status: StatusLevel }) {
  if (status === "verified" || status === "active") return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.check}</span>;
  if (status === "failed") return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.x}</span>;
  return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.minus}</span>;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-7">
      <div className="space-y-3 border-b border-[#E2E8F0] pb-6">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ds-card h-[150px] p-5">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="mt-4 h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ds-card h-[120px] p-5">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-4 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="ds-card h-[104px] p-5">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}

function PanelHeader({ title, description, color, action }: { title: string; description?: string; color: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0">
          <h3 className="ds-card-title">{title}</h3>
          {description ? <p className="ds-meta mt-0.5">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function PipelineStage({ label, status, isLast }: { label: string; status: StatusLevel; isLast?: boolean }) {
  const style = STATUS_STYLES[status];
  return (
    <div className="flex items-center">
      <div className="flex min-w-[86px] flex-col items-center gap-2">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{ backgroundColor: style.bg, borderColor: style.border, color: style.fg }}
        >
          <StatusIcon status={status} />
        </div>
        <span className="text-center text-[12px] font-semibold leading-tight text-[#475569]">{label}</span>
      </div>
      {!isLast ? (
        <div className="relative mx-2 h-[2px] min-w-[24px] flex-1 overflow-hidden rounded-full bg-[#E2E8F0]">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{
              width: status === "verified" || status === "active" ? "100%" : status === "configured" ? "50%" : "0%",
              backgroundColor: style.fg,
              opacity: 0.45,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

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

  const maxEventCount = (() => {
    const vals = Object.values(auditEvents).map(Number);
    return vals.length ? Math.max(...vals) : 1;
  })();

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState title="Dashboard unavailable" message={error} onRetry={reload} retryLabel="Retry connection" />;

  const stats = [
    { label: "Constraints", sublabel: `${constraints.filter(c => c.is_active).length} active`, value: constraints.length, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", link: "/dashboard/constraints" },
    { label: "Memories", sublabel: "Secured entries", value: memories.length, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", link: "/dashboard/memory" },
    { label: "Audit Events", sublabel: "Total recorded", value: totalAuditEvents, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", link: "/dashboard/audit" },
    { label: "Detection Rules", sublabel: patternCount !== null ? "OWASP ASI06" : "Unavailable", value: patternCount ?? 0, color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", link: null },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="AgentShield / Overview"
        title="Command Center"
        description="Monitor memory protection, verify cryptographic integrity, and review your agent's security posture in one place."
        icon={icons.shield}
        actions={
          <>
            <Badge tone={backendOk === true ? "green" : backendOk === false ? "red" : "neutral"}>
              <span className="ds-dot" />
              Backend {backendOk === true ? "Connected" : backendOk === false ? "Unavailable" : "Checking"}
            </Badge>
            <Badge tone={chainValid === true ? "green" : chainValid === false ? "red" : "neutral"}>
              <span className="ds-dot" />
              Chain {chainValid === true ? "Verified" : chainValid === false ? "Broken" : "Unknown"}
            </Badge>
            <Badge tone={compliance === "COMPLIANT" ? "green" : compliance === "UNKNOWN" ? "neutral" : "amber"}>
              {compliance}
            </Badge>
            <button type="button" onClick={reload} className="ds-btn ds-btn-secondary ds-btn-icon" title="Refresh data" aria-label="Refresh data">
              {icons.refresh}
            </button>
          </>
        }
      />

      <section className="space-y-4">
        <SectionHeading title="Security posture" description="Live verification status across the memory defense pipeline." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {postureItems.map((item) => {
            const style = STATUS_STYLES[item.status];
            return (
              <Link key={item.id} href={item.href} className="ds-card ds-card-interactive block p-5">
                <div className="flex items-start justify-between">
                  <div className="ds-icon-tile" style={{ backgroundColor: style.bg, color: style.fg, border: `1px solid ${style.border}` }}>
                    {item.icon}
                  </div>
                  <StatusIcon status={item.status} />
                </div>
                <h3 className="mt-4 text-[14px] font-semibold leading-snug text-[#172033]">{item.label}</h3>
                <div className="mt-2">
                  <Badge tone={STATUS_TONE[item.status]}>{item.statusLabel}</Badge>
                </div>
                <p className="ds-meta mt-2">{item.sublabel}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="Core telemetry" description="Counts reported by the backend API." />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {stats.map((stat) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="ds-icon-tile h-9 w-9" style={{ backgroundColor: stat.bg, color: stat.color, border: `1px solid ${stat.border}` }}>
                    <span className="text-[13px] font-bold">{stat.label.charAt(0)}</span>
                  </div>
                  {stat.link ? <span className="text-[#64748B]">{icons.arrowRight}</span> : null}
                </div>
                <div className="mt-4 ds-stat" style={{ color: stat.color }}>{stat.value}</div>
                <div className="mt-2 text-[14px] font-semibold text-[#172033]">{stat.label}</div>
                <div className="ds-meta mt-0.5">{stat.sublabel}</div>
              </>
            );
            return stat.link ? (
              <Link key={stat.label} href={stat.link} className="ds-card ds-card-interactive block p-5">
                {content}
              </Link>
            ) : (
              <div key={stat.label} className="ds-card block p-5">
                {content}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="Memory defense pipeline" description="Each stage reflects live API and integrity checks." />
        <div className="ds-card px-4 py-5 sm:px-5">
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-none">
            {pipelineStages.map((stage, i) => (
              <PipelineStage key={stage.label} label={stage.label} status={stage.status} isLast={i === pipelineStages.length - 1} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="ds-card overflow-hidden xl:col-span-2">
          <PanelHeader
            title="Recent security activity"
            description={`${auditEntries.length} latest audit events`}
            color="#D97706"
            action={
              <Link href="/dashboard/audit" className="text-[13px] font-semibold text-[#059669] hover:text-[#047857]">
                View all
              </Link>
            }
          />
          <div className="p-3">
            {auditEntries.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="ds-icon-tile mb-3" style={{ backgroundColor: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }}>
                  {icons.clipboard}
                </div>
                <p className="text-[14px] font-semibold text-[#475569]">No security events recorded yet</p>
                <p className="ds-meta mt-1">Events will appear here once the agent starts using protected memory.</p>
              </div>
            ) : auditEntries.slice(0, 6).map((entry) => {
              const c = getTypeColor(entry.event_type);
              return (
                <Link key={entry.entry_id} href="/dashboard/audit" className="ds-row flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
                  <span className="inline-flex w-fit shrink-0 items-center rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}>
                    {entry.event_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#172033]">{entry.action}</p>
                    {entry.actor || entry.target ? (
                      <p className="ds-meta mt-0.5 truncate">
                        {entry.actor ? `Actor: ${entry.actor}` : ""}{entry.actor && entry.target ? " · " : ""}{entry.target ? `Target: ${entry.target}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <span className="ds-meta flex shrink-0 items-center gap-1.5">
                    {icons.clock}
                    {formatDate(entry.recorded_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="ds-card overflow-hidden">
            <PanelHeader title="Integrity center" description="Cryptographic verification" color="#059669" />
            <div className="space-y-3 p-4">
              <div className="ds-subcard flex items-center gap-3 p-3">
                <div className="ds-icon-tile h-9 w-9" style={{
                  backgroundColor: chainValid === true ? "#ECFDF5" : chainValid === false ? "#FEF2F2" : "#F8FAFC",
                  color: chainValid === true ? "#047857" : chainValid === false ? "#B91C1C" : "#64748B",
                  border: `1px solid ${chainValid === true ? "#A7F3D0" : chainValid === false ? "#FECACA" : "#E2E8F0"}`,
                }}>
                  {icons.chain}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[#475569]">Audit chain</div>
                  <div className="mt-0.5">
                    <Badge tone={chainValid === true ? "green" : chainValid === false ? "red" : "neutral"}>
                      {chainValid === true ? "Verified" : chainValid === false ? "Invalid" : "Unknown"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="ds-subcard flex items-center gap-3 p-3">
                <div className="ds-icon-tile h-9 w-9" style={{
                  backgroundColor: constraintIntegrity === true ? "#ECFDF5" : constraintIntegrity === false ? "#FEF2F2" : "#F8FAFC",
                  color: constraintIntegrity === true ? "#047857" : constraintIntegrity === false ? "#B91C1C" : "#64748B",
                  border: `1px solid ${constraintIntegrity === true ? "#A7F3D0" : constraintIntegrity === false ? "#FECACA" : "#E2E8F0"}`,
                }}>
                  {icons.shield}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[#475569]">Constraint hash</div>
                  <div className="mt-0.5">
                    <Badge tone={constraintIntegrity === true ? "green" : constraintIntegrity === false ? "red" : "neutral"}>
                      {constraintIntegrity === true ? "Verified" : constraintIntegrity === false ? "Invalid" : "Unknown"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ds-card overflow-hidden">
            <PanelHeader title="Event breakdown" description="Audit events by type" color="#2563EB" />
            <div className="space-y-3 p-4">
              {Object.keys(auditEvents).length === 0 ? (
                <p className="py-6 text-center text-[14px] text-[#64748B]">No events recorded</p>
              ) : Object.entries(auditEvents)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([type, count]) => {
                  const c = getTypeColor(type);
                  const pct = ((count as number) / maxEventCount) * 100;
                  return (
                    <div key={type}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[#475569]">{type}</span>
                        <span className="ds-mono text-[13px] font-bold" style={{ color: c.fg }}>{count as number}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: c.fg }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="ds-card overflow-hidden">
          <PanelHeader
            title="Recent constraints"
            description={`${constraints.length} protected rules`}
            color="#059669"
            action={<Link href="/dashboard/constraints" className="text-[13px] font-semibold text-[#059669] hover:text-[#047857]">View all</Link>}
          />
          <div className="p-3">
            {constraints.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="ds-icon-tile mb-3" style={{ backgroundColor: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }}>
                  {icons.shield}
                </div>
                <p className="text-[14px] font-semibold text-[#475569]">No constraints pinned yet</p>
                <Link href="/dashboard/constraints" className="mt-3 text-[13px] font-semibold text-[#059669] hover:text-[#047857]">Pin your first rule</Link>
              </div>
            ) : constraints.slice(0, 4).map((c) => {
              const tc = getTypeColor(c.constraint_type);
              return (
                <Link key={c.constraint_id} href="/dashboard/constraints" className="ds-row flex items-start gap-3 px-3 py-3">
                  <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ backgroundColor: tc.bg, color: tc.fg, borderColor: tc.border }}>
                    {c.constraint_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[14px] font-medium leading-relaxed text-[#172033]">{c.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="ds-meta flex items-center gap-1">{icons.clock}{formatDate(c.created_at)}</span>
                      <Badge tone={c.is_active ? "green" : "neutral"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                      {c.kms_signature ? <Badge tone="blue">Signed</Badge> : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="ds-card overflow-hidden">
          <PanelHeader
            title="Recent memories"
            description={`${memories.length} secured entries`}
            color="#7C3AED"
            action={<Link href="/dashboard/memory" className="text-[13px] font-semibold text-[#059669] hover:text-[#047857]">View all</Link>}
          />
          <div className="p-3">
            {memories.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="ds-icon-tile mb-3" style={{ backgroundColor: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }}>
                  {icons.database}
                </div>
                <p className="text-[14px] font-semibold text-[#475569]">No memories stored yet</p>
                <Link href="/dashboard/memory" className="mt-3 text-[13px] font-semibold text-[#059669] hover:text-[#047857]">Store your first memory</Link>
              </div>
            ) : memories.slice(0, 4).map((m) => {
              const tc = getTypeColor(m.memory_type);
              return (
                <Link key={m.memory_id} href="/dashboard/memory" className="ds-row flex items-start gap-3 px-3 py-3">
                  <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ backgroundColor: tc.bg, color: tc.fg, borderColor: tc.border }}>
                    {m.memory_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[14px] font-medium leading-relaxed text-[#172033]">{m.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="ds-meta flex items-center gap-1">{icons.clock}{formatDate(m.created_at)}</span>
                      {m.entry_hash ? <Badge tone="green">Hashed</Badge> : null}
                      {m.kms_signature ? <Badge tone="blue">Signed</Badge> : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
