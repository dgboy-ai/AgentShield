"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { ErrorState, Skeleton } from "@/components/dashboard/kit";

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

const BLACK = "#000000";
const SHADOW = `6px 6px 0px ${BLACK}`;
const SHADOW_SM = `4px 4px 0px ${BLACK}`;
const FONT_HEAD = "var(--font-space-grotesk), system-ui, sans-serif";
const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";

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

type StatusTone = "green" | "red" | "amber" | "blue" | "neutral";

const STATUS_TONE: Record<StatusLevel, StatusTone> = {
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

const TONE_PILL: Record<StatusTone, { bg: string; fg: string }> = {
  green: { bg: "#2DD4A0", fg: BLACK },
  red: { bg: "#FF4D4D", fg: BLACK },
  amber: { bg: "#FACC15", fg: BLACK },
  blue: { bg: "#4D9FFF", fg: BLACK },
  neutral: { bg: "#E2E8F0", fg: "#334155" },
};

const icons = {
  chain: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  shield: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  brain: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7.5L12 20l3-3.5c2-2 4-4.5 4-7.5a7 7 0 0 0-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  alert: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
  clipboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  key: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  arrowRight: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  minus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  database: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  refresh: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
};

function StatusIcon({ status }: { status: StatusLevel }) {
  if (status === "verified" || status === "active") return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.check}</span>;
  if (status === "failed") return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.x}</span>;
  return <span style={{ color: STATUS_STYLES[status].fg }}>{icons.minus}</span>;
}

function Pill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const p = TONE_PILL[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: p.bg,
        color: p.fg,
        border: `3px solid ${BLACK}`,
        borderRadius: "999px",
        padding: "5px 14px",
        fontSize: "12px",
        fontWeight: 900,
        fontFamily: FONT_HEAD,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        boxShadow: `2px 2px 0px ${BLACK}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-7">
      <div style={{ background: "#0A0F14", border: `3px solid ${BLACK}`, borderRadius: "16px", boxShadow: SHADOW, padding: "40px 36px" }}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-5 h-14 w-80" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ border: `3px solid ${BLACK}`, borderRadius: "14px", boxShadow: SHADOW, padding: "24px", background: "#fff", minHeight: 170 }}>
            <Skeleton className="h-12 w-12" />
            <Skeleton className="mt-5 h-5 w-36" />
            <Skeleton className="mt-3 h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: `3px solid ${BLACK}`, borderRadius: "14px", boxShadow: SHADOW, padding: "24px", background: "#fff", minHeight: 140 }}>
            <Skeleton className="h-12 w-20" />
            <Skeleton className="mt-5 h-5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ title, description, accent }: { title: string; description?: string; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
      <span
        style={{
          width: "18px",
          height: "44px",
          background: accent,
          border: `3px solid ${BLACK}`,
          borderRadius: "8px",
          boxShadow: `3px 3px 0px ${BLACK}`,
          flexShrink: 0,
        }}
      />
      <div>
        <h2
          style={{
            fontFamily: FONT_HEAD,
            fontSize: "30px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: BLACK,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h2>
        {description ? (
          <p style={{ margin: "4px 0 0 0", fontSize: "15px", fontWeight: 600, color: "#475569" }}>{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ title, description, accent, action, children, span }: {
  title: string;
  description?: string;
  accent: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `3px solid ${BLACK}`,
        borderRadius: "16px",
        boxShadow: SHADOW,
        overflow: "hidden",
        ...(span ? { gridColumn: "span 2" } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          padding: "18px 22px",
          borderBottom: `3px solid ${BLACK}`,
          background: accent,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: BLACK, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: FONT_HEAD, fontSize: "19px", fontWeight: 900, color: BLACK, margin: 0, letterSpacing: "-0.01em" }}>{title}</h3>
            {description ? <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: 700, color: BLACK, opacity: 0.65 }}>{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

function ViewAllLink({ href, label = "VIEW ALL →" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: FONT_HEAD,
        fontSize: "13px",
        fontWeight: 900,
        letterSpacing: "0.08em",
        color: BLACK,
        background: "#FFFFFF",
        border: `3px solid ${BLACK}`,
        boxShadow: `3px 3px 0px ${BLACK}`,
        borderRadius: "8px",
        padding: "8px 14px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        transform: "translate(-1px, -1px)",
      }}
    >
      {label}
    </Link>
  );
}

function TypeChip({ type, fg, bg }: { type: string; fg: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: bg,
        color: fg,
        border: `2px solid ${BLACK}`,
        borderRadius: "7px",
        padding: "4px 10px",
        fontSize: "11px",
        fontWeight: 900,
        fontFamily: FONT_HEAD,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        flexShrink: 0,
        boxShadow: `2px 2px 0px ${BLACK}`,
      }}
    >
      {type}
    </span>
  );
}

function PipelineStage({ label, status, isLast }: { label: string; status: StatusLevel; isLast?: boolean }) {
  const good = status === "verified" || status === "active" || status === "configured";
  return (
    <div style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : "1 1 0", minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: good ? "#2DD4A0" : status === "failed" ? "#FF4D4D" : "#F1F5F9",
            border: `3px solid ${BLACK}`,
            borderRadius: "12px",
            boxShadow: `3px 3px 0px ${BLACK}`,
            color: BLACK,
          }}
        >
          <StatusIcon status={status} />
        </div>
        <span
          style={{
            fontFamily: FONT_HEAD,
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: BLACK,
            textAlign: "center",
          }}
        >
          {label}
        </span>
      </div>
      {!isLast ? (
        <div
          style={{
            flex: 1,
            height: "6px",
            minWidth: "18px",
            margin: "0 8px 26px 8px",
            background: good ? "#2DD4A0" : "#E2E8F0",
            border: `2px solid ${BLACK}`,
            borderRadius: "999px",
          }}
        />
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
    const isManual = reloadKey > 0;
    (async () => {
      if (!token) return;
      if (constraints.length === 0 && memories.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const [c, m, t, cv, cr] = await Promise.all([
          api.listConstraints(token, undefined, isManual),
          api.listMemories(token, undefined, isManual),
          api.auditTimeline(token, isManual),
          api.auditVerify(token, isManual),
          api.complianceReport(token, isManual).catch(() => ({ compliance_status: "UNKNOWN" })),
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
        if (!cancelled && constraints.length === 0) setError(e instanceof ApiError ? e.message : "Failed to load dashboard");
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
    const isManual = reloadKey > 0;
    (async () => {
      const [healthResult, patternsResult, ciResult] = await Promise.allSettled([
        api.health(isManual),
        api.scanPatterns(token, isManual),
        api.verifyConstraints(token, isManual),
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

  const postureAccent: Record<string, string> = {
    chain: "#2DD4A0",
    constraints: "#4D9FFF",
    memory: "#C084FC",
    detection: "#FACC15",
    audit: "#FF8A4D",
    kms: "#FF4D4D",
  };

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
    { label: "Constraints", sublabel: `${constraints.filter(c => c.is_active).length} active`, value: constraints.length, color: "#059669", chip: "#2DD4A0", link: "/dashboard/constraints" },
    { label: "Memories", sublabel: "Secured entries", value: memories.length, color: "#7C3AED", chip: "#C084FC", link: "/dashboard/memory" },
    { label: "Audit Events", sublabel: "Total recorded", value: totalAuditEvents, color: "#D97706", chip: "#FACC15", link: "/dashboard/audit" },
    { label: "Detection Rules", sublabel: patternCount !== null ? "OWASP ASI06" : "Unavailable", value: patternCount ?? 0, color: "#2563EB", chip: "#4D9FFF", link: null },
  ];

  return (
    <div className="space-y-9">
      {/* ═══ HERO ═══ */}
      <div
        style={{
          background: "#0A0F14",
          border: `3px solid ${BLACK}`,
          borderRadius: "16px",
          boxShadow: SHADOW,
          padding: "40px 36px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-45%",
            right: "-8%",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,212,160,0.32) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", flexWrap: "wrap", position: "relative" }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "inline-block",
                background: "#FACC15",
                border: `3px solid ${BLACK}`,
                boxShadow: SHADOW_SM,
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.18em",
                color: BLACK,
                fontFamily: FONT_HEAD,
                marginBottom: "18px",
                transform: "rotate(-1.5deg)",
              }}
            >
              AGENTSHIELD / OVERVIEW
            </div>
            <h1
              style={{
                fontFamily: FONT_HEAD,
                fontSize: "clamp(40px, 6vw, 60px)",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.0,
                color: "#FFFFFF",
                margin: 0,
              }}
            >
              Command <span style={{ color: "#2DD4A0" }}>Center</span>
            </h1>
            <p
              style={{
                marginTop: "16px",
                fontSize: "17px",
                fontWeight: 600,
                color: "#94A3B8",
                maxWidth: "620px",
                lineHeight: 1.55,
                margin: "16px 0 0 0",
              }}
            >
              Monitor memory protection, verify cryptographic integrity, and review your agent&apos;s security posture in one place.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <Pill tone={backendOk === true ? "green" : backendOk === false ? "red" : "neutral"}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: BLACK, display: "inline-block" }} />
              Backend {backendOk === true ? "Connected" : backendOk === false ? "Down" : "…"}
            </Pill>
            <Pill tone={chainValid === true ? "green" : chainValid === false ? "red" : "neutral"}>
              Chain {chainValid === true ? "Verified" : chainValid === false ? "Broken" : "…"}
            </Pill>
            <Pill tone={compliance === "COMPLIANT" ? "green" : compliance === "UNKNOWN" ? "neutral" : "amber"}>
              {compliance}
            </Pill>
            <button
              type="button"
              onClick={reload}
              aria-label="Refresh data"
              title="Refresh data"
              style={{
                width: "52px",
                height: "52px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#FACC15",
                color: BLACK,
                border: `3px solid ${BLACK}`,
                boxShadow: SHADOW_SM,
                borderRadius: "12px",
                cursor: "pointer",
                transform: "translate(-2px, -2px)",
              }}
            >
              {icons.refresh}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SECURITY POSTURE ═══ */}
      <section>
        <SectionTitle title="Security posture" description="Live verification status across the memory defense pipeline." accent="#2DD4A0" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {postureItems.map((item) => {
            const accent = postureAccent[item.id] || "#FACC15";
            const good = item.status === "verified" || item.status === "active";
            const bad = item.status === "failed";
            return (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: "block",
                  background: "#FFFFFF",
                  border: `3px solid ${BLACK}`,
                  borderRadius: "14px",
                  boxShadow: SHADOW,
                  padding: "0",
                  textDecoration: "none",
                  color: BLACK,
                  overflow: "hidden",
                  transform: "translate(-2px, -2px)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translate(0,0)";
                  e.currentTarget.style.boxShadow = `2px 2px 0px ${BLACK}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translate(-2px,-2px)";
                  e.currentTarget.style.boxShadow = SHADOW;
                }}
              >
                <div style={{ height: "12px", background: accent, borderBottom: `3px solid ${BLACK}` }} />
                <div style={{ padding: "20px 18px 22px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <span
                      style={{
                        width: "52px",
                        height: "52px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: accent,
                        border: `3px solid ${BLACK}`,
                        borderRadius: "12px",
                        boxShadow: `3px 3px 0px ${BLACK}`,
                        color: BLACK,
                      }}
                    >
                      {item.icon}
                    </span>
                    <span
                      style={{
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `3px solid ${BLACK}`,
                        borderRadius: "50%",
                        background: good ? "#2DD4A0" : bad ? "#FF4D4D" : "#F1F5F9",
                        color: BLACK,
                      }}
                    >
                      <StatusIcon status={item.status} />
                    </span>
                  </div>
                  <h3
                    style={{
                      fontFamily: FONT_HEAD,
                      fontSize: "17px",
                      fontWeight: 900,
                      letterSpacing: "-0.01em",
                      margin: "16px 0 0 0",
                      color: BLACK,
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </h3>
                  <div style={{ marginTop: "10px" }}>
                    <Pill tone={STATUS_TONE[item.status]}>{item.statusLabel}</Pill>
                  </div>
                  <p style={{ margin: "12px 0 0 0", fontSize: "13px", fontWeight: 700, color: "#64748B" }}>{item.sublabel}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ═══ CORE TELEMETRY ═══ */}
      <section>
        <SectionTitle title="Core telemetry" description="Counts reported by the backend API." accent="#FACC15" />
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          {stats.map((stat) => {
            const content = (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <span
                    style={{
                      width: "46px",
                      height: "46px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: stat.chip,
                      border: `3px solid ${BLACK}`,
                      borderRadius: "12px",
                      boxShadow: `3px 3px 0px ${BLACK}`,
                      fontFamily: FONT_HEAD,
                      fontSize: "20px",
                      fontWeight: 900,
                      color: BLACK,
                    }}
                  >
                    {stat.label.charAt(0)}
                  </span>
                  {stat.link ? <span style={{ color: BLACK, opacity: 0.35 }}>{icons.arrowRight}</span> : null}
                </div>
                <div
                  style={{
                    fontFamily: FONT_HEAD,
                    fontSize: "clamp(44px, 6vw, 56px)",
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                    color: stat.color,
                    marginTop: "18px",
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontFamily: FONT_HEAD, fontSize: "17px", fontWeight: 900, color: BLACK, marginTop: "8px" }}>{stat.label}</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748B", marginTop: "2px" }}>{stat.sublabel}</div>
              </>
            );
            const style: React.CSSProperties = {
              background: "#FFFFFF",
              border: `3px solid ${BLACK}`,
              borderRadius: "14px",
              boxShadow: SHADOW,
              padding: "22px",
              display: "block",
              textDecoration: "none",
              color: BLACK,
              transform: "translate(-2px, -2px)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            };
            const handlers = {
              onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
                e.currentTarget.style.transform = "translate(0,0)";
                e.currentTarget.style.boxShadow = `2px 2px 0px ${BLACK}`;
              },
              onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
                e.currentTarget.style.transform = "translate(-2px,-2px)";
                e.currentTarget.style.boxShadow = SHADOW;
              },
            };
            return stat.link ? (
              <Link key={stat.label} href={stat.link} style={style} {...handlers}>
                {content}
              </Link>
            ) : (
              <div key={stat.label} style={style}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ PIPELINE ═══ */}
      <section>
        <SectionTitle title="Memory defense pipeline" description="Each stage reflects live API and integrity checks." accent="#4D9FFF" />
        <div
          style={{
            background: "#FFFFFF",
            border: `3px solid ${BLACK}`,
            borderRadius: "16px",
            boxShadow: SHADOW,
            padding: "28px 24px",
            overflowX: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "4px", minWidth: "640px" }}>
            {pipelineStages.map((stage, i) => (
              <PipelineStage key={stage.label} label={stage.label} status={stage.status} isLast={i === pipelineStages.length - 1} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ACTIVITY + INTEGRITY ═══ */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title="Recent security activity"
            description={`${auditEntries.length} latest audit events`}
            accent="#FACC15"
            action={<ViewAllLink href="/dashboard/audit" />}
          >
            {auditEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 12px" }}>
                <p style={{ fontFamily: FONT_HEAD, fontSize: "17px", fontWeight: 900, color: BLACK, margin: 0 }}>No security events recorded yet</p>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#64748B", marginTop: "8px" }}>
                  Events appear once the agent starts using protected memory.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {auditEntries.slice(0, 6).map((entry) => {
                  const c = getTypeColor(entry.event_type);
                  return (
                    <Link
                      key={entry.entry_id}
                      href="/dashboard/audit"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        flexWrap: "wrap",
                        background: "#F8FAFC",
                        border: `3px solid ${BLACK}`,
                        borderRadius: "12px",
                        boxShadow: `3px 3px 0px ${BLACK}`,
                        padding: "14px 16px",
                        textDecoration: "none",
                        color: BLACK,
                      }}
                    >
                      <TypeChip type={entry.event_type} fg={c.fg} bg={c.bg} />
                      <div style={{ flex: 1, minWidth: "160px" }}>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, fontFamily: FONT_HEAD, color: BLACK }}>{entry.action}</p>
                        {entry.actor || entry.target ? (
                          <p style={{ margin: "3px 0 0 0", fontSize: "13px", fontWeight: 600, color: "#64748B" }}>
                            {entry.actor ? `Actor: ${entry.actor}` : ""}{entry.actor && entry.target ? " · " : ""}{entry.target ? `Target: ${entry.target}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 800, color: "#64748B", fontFamily: FONT_MONO }}>
                        {icons.clock}
                        {formatDate(entry.recorded_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Integrity center" description="Cryptographic verification" accent="#2DD4A0">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                {
                  key: "chain",
                  label: "Audit chain",
                  ok: chainValid,
                  icon: icons.chain,
                },
                {
                  key: "constraint",
                  label: "Constraint hash",
                  ok: constraintIntegrity,
                  icon: icons.shield,
                },
              ].map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    background: "#F8FAFC",
                    border: `3px solid ${BLACK}`,
                    borderRadius: "12px",
                    boxShadow: `3px 3px 0px ${BLACK}`,
                    padding: "14px 16px",
                  }}
                >
                  <span
                    style={{
                      width: "44px",
                      height: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: row.ok === true ? "#2DD4A0" : row.ok === false ? "#FF4D4D" : "#E2E8F0",
                      border: `3px solid ${BLACK}`,
                      borderRadius: "10px",
                      color: BLACK,
                      flexShrink: 0,
                    }}
                  >
                    {row.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_HEAD, fontSize: "15px", fontWeight: 900, color: BLACK }}>{row.label}</div>
                    <div style={{ marginTop: "6px" }}>
                      <Pill tone={row.ok === true ? "green" : row.ok === false ? "red" : "neutral"}>
                        {row.ok === true ? "Verified" : row.ok === false ? "Invalid" : "Unknown"}
                      </Pill>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Event breakdown" description="Audit events by type" accent="#4D9FFF">
            {Object.keys(auditEvents).length === 0 ? (
              <p style={{ textAlign: "center", fontSize: "15px", fontWeight: 700, color: "#64748B", padding: "24px 0", margin: 0 }}>No events recorded</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {Object.entries(auditEvents)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([type, count]) => {
                    const c = getTypeColor(type);
                    const pct = ((count as number) / maxEventCount) * 100;
                    return (
                      <div key={type}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 900, fontFamily: FONT_HEAD, color: BLACK, textTransform: "uppercase", letterSpacing: "0.04em" }}>{type}</span>
                          <span style={{ fontFamily: FONT_MONO, fontSize: "14px", fontWeight: 900, color: BLACK }}>{count as number}</span>
                        </div>
                        <div
                          style={{
                            height: "14px",
                            background: "#F1F5F9",
                            border: `2px solid ${BLACK}`,
                            borderRadius: "999px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: c.fg,
                              borderRight: pct > 0 ? `2px solid ${BLACK}` : "none",
                              transition: "width 0.7s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Panel>
        </div>
      </section>

      {/* ═══ CONSTRAINTS ═══ */}
      <section>
        <Panel
          title="Recent constraints"
          description={`${constraints.length} protected rules`}
          accent="#2DD4A0"
          action={<ViewAllLink href="/dashboard/constraints" />}
        >
          {constraints.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 12px" }}>
              <p style={{ fontFamily: FONT_HEAD, fontSize: "17px", fontWeight: 900, color: BLACK, margin: 0 }}>No constraints pinned yet</p>
              <Link
                href="/dashboard/constraints"
                style={{
                  display: "inline-block",
                  marginTop: "16px",
                  fontFamily: FONT_HEAD,
                  fontSize: "14px",
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  color: BLACK,
                  background: "#FACC15",
                  border: `3px solid ${BLACK}`,
                  boxShadow: SHADOW_SM,
                  borderRadius: "8px",
                  padding: "10px 18px",
                  textDecoration: "none",
                }}
              >
                PIN YOUR FIRST RULE →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {constraints.slice(0, 4).map((c) => {
                const tc = getTypeColor(c.constraint_type);
                return (
                  <Link
                    key={c.constraint_id}
                    href="/dashboard/constraints"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                      background: "#F8FAFC",
                      border: `3px solid ${BLACK}`,
                      borderRadius: "12px",
                      boxShadow: `3px 3px 0px ${BLACK}`,
                      padding: "14px 16px",
                      textDecoration: "none",
                      color: BLACK,
                    }}
                  >
                    <TypeChip type={c.constraint_type} fg={tc.fg} bg={tc.bg} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, lineHeight: 1.5, color: BLACK }}>{c.text}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 800, color: "#64748B", fontFamily: FONT_MONO }}>
                          {icons.clock}
                          {formatDate(c.created_at)}
                        </span>
                        <Pill tone={c.is_active ? "green" : "neutral"}>{c.is_active ? "Active" : "Inactive"}</Pill>
                        {c.kms_signature ? <Pill tone="blue">Signed</Pill> : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
