"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

const BLACK = "#000000";
const SHADOW = `6px 6px 0px ${BLACK}`;
const SHADOW_SM = `4px 4px 0px ${BLACK}`;
const FONT_HEAD = "var(--font-space-grotesk)";
const FONT_MONO = "var(--font-geist-mono)";

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
  constraint_pinned:  { bg: "#2DD4A0", fg: "#000", border: BLACK, dot: "#000", label: "CONSTRAINT" },
  memory_stored:      { bg: "#C084FC", fg: "#000", border: BLACK, dot: "#000", label: "MEMORY" },
  pattern_detected:   { bg: "#FF4D4D", fg: "#000", border: BLACK, dot: "#000", label: "THREAT" },
  auth_login:         { bg: "#4D9FFF", fg: "#000", border: BLACK, dot: "#000", label: "AUTH" },
  auth_register:      { bg: "#4D9FFF", fg: "#000", border: BLACK, dot: "#000", label: "AUTH" },
  auth_logout:        { bg: "#4D9FFF", fg: "#000", border: BLACK, dot: "#000", label: "AUTH" },
  memory_rejected:    { bg: "#FF4D4D", fg: "#000", border: BLACK, dot: "#000", label: "BLOCKED" },
  scan:               { bg: "#FACC15", fg: "#000", border: BLACK, dot: "#000", label: "SCAN" },
  chat_turn:          { bg: "#C084FC", fg: "#000", border: BLACK, dot: "#000", label: "CHAT" },
};
function getEventMeta(type: string) {
  return EVENT_META[type] || { bg: "#E2E8F0", fg: "#000", border: BLACK, dot: "#000", label: type.toUpperCase() };
}

const SEVERITY_META: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#FF4D4D", fg: "#000" },
  high:     { bg: "#FF8A4D", fg: "#000" },
  medium:   { bg: "#FACC15", fg: "#000" },
  low:      { bg: "#2DD4A0", fg: "#000" },
};

function getSeverityStyle(sev?: string) {
  return SEVERITY_META[sev?.toLowerCase() || ""] || { bg: "#E2E8F0", fg: "#000" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        background: "#E2E8F0",
        border: `3px solid ${BLACK}`,
        borderRadius: "12px",
        boxShadow: SHADOW_SM,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function Chip({ label, bg, fg = "#000", onClick, title }: { label: string; bg: string; fg?: string; onClick?: () => void; title?: string }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        background: bg,
        color: fg,
        border: `2px solid ${BLACK}`,
        borderRadius: "6px",
        padding: "3px 9px",
        fontFamily: FONT_HEAD,
        fontSize: "10px",
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        boxShadow: `2px 2px 0px ${BLACK}`,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {label}
    </Tag>
  );
}

function HashChip({ hash }: { hash: string | null | undefined }) {
  if (!hash) return <span style={{ fontFamily: FONT_MONO, fontSize: "10px", fontWeight: 700, color: "#475569" }}>—</span>;
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: "10px", fontWeight: 700, color: "#475569", cursor: "default" }} title={hash}>
      {hash.slice(0, 8)}…{hash.slice(-4)}
    </span>
  );
}

function NeoButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const palette =
    variant === "primary"
      ? { bg: "#2DD4A0", fg: "#000" }
      : variant === "danger"
      ? { bg: "#FF4D4D", fg: "#000" }
      : variant === "ghost"
      ? { bg: "transparent", fg: "#000" }
      : { bg: "#FFFFFF", fg: "#000" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        fontFamily: FONT_HEAD,
        fontWeight: 900,
        fontSize: size === "sm" ? "12px" : "13px",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: palette.fg,
        background: palette.bg,
        border: `3px solid ${BLACK}`,
        borderRadius: "9px",
        boxShadow: variant === "ghost" ? "none" : SHADOW_SM,
        padding: size === "sm" ? "7px 12px" : "10px 16px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transform: "translate(-1px, -1px)",
        transition: "transform 100ms, box-shadow 100ms",
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px, 2px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0px #000";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW_SM;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = variant === "ghost" ? "none" : SHADOW_SM;
      }}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  description,
  accent,
  action,
  children,
}: {
  title: string;
  description?: string;
  accent: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `3px solid ${BLACK}`,
        borderRadius: "16px",
        boxShadow: SHADOW,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          padding: "16px 20px",
          borderBottom: `3px solid ${BLACK}`,
          background: accent,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: BLACK, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: FONT_HEAD, fontSize: "18px", fontWeight: 900, color: BLACK, margin: 0, letterSpacing: "-0.01em" }}>
              {title}
            </h3>
            {description ? (
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: 700, color: BLACK, opacity: 0.65 }}>{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `3px solid ${BLACK}`,
        borderRadius: "14px",
        boxShadow: SHADOW,
        padding: "16px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: accent, border: `2px solid ${BLACK}`, flexShrink: 0 }} />
        <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: "20px", fontWeight: 900, letterSpacing: "-0.02em", color: BLACK, lineHeight: 1.15, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `3px solid ${BLACK}`,
  borderRadius: "9px",
  background: "#fff",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: 600,
  color: BLACK,
  outline: "none",
  boxShadow: `2px 2px 0px ${BLACK}`,
  fontFamily: FONT_MONO,
};

function EventRow({ entry, expanded, onToggle }: { entry: AuditEntry; expanded: boolean; onToggle: () => void }) {
  const meta = getEventMeta(entry.event_type);
  const d = entry.details;
  const isBlocked = d?.blocked === true;
  const severity = d?.max_severity;

  return (
    <div
      style={{ borderBottom: `2px solid ${BLACK}`, cursor: "pointer" }}
      onClick={onToggle}
    >
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px" }}>
        {/* Dot + event type */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "130px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: BLACK, flexShrink: 0 }} />
          <Chip label={meta.label} bg={meta.bg} fg={meta.fg} />
        </div>

        {/* Action */}
        <span style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 700, color: BLACK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.action}{d?.memory_type ? ` · ${d.memory_type}` : ""}
          {d?.constraint_type ? ` · ${d.constraint_type}` : ""}
        </span>

        {/* Blocked / severity */}
        <div style={{ display: "none", alignItems: "center", gap: "8px", flexShrink: 0 }} className="md:flex">
          {isBlocked && (
            <Chip label="BLOCKED" bg="#FF4D4D" />
          )}
          {severity && (
            <Chip label={severity} bg={getSeverityStyle(severity).bg} fg={getSeverityStyle(severity).fg} />
          )}
        </div>

        {/* Hash */}
        <div style={{ display: "none" }} className="lg:block">
          <HashChip hash={entry.entry_hash} />
        </div>

        {/* Timestamp */}
        <span style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, color: "#475569", flexShrink: 0, marginLeft: "auto", paddingLeft: "8px" }}>
          {new Date(entry.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>

        {/* Expand icon */}
        <svg
          style={{ width: "14px", height: "14px", color: "#475569", flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "12px", borderTop: `2px solid ${BLACK}`, paddingTop: "12px" }}>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "4px" }}>Event ID</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, color: BLACK, wordBreak: "break-all" }}>{entry.entry_id}</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "4px" }}>Actor</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, color: BLACK, wordBreak: "break-all" }}>{entry.actor || "—"}</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "4px" }}>Target</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, color: BLACK, wordBreak: "break-all" }}>{entry.target || "—"}</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "4px" }}>Timestamp</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, color: BLACK }}>{new Date(entry.recorded_at).toISOString()}</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "4px" }}>Entry Hash (SHA-256)</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, color: "#475569", wordBreak: "break-all", fontSize: "11px" }}>{entry.entry_hash || "—"}</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "4px" }}>Previous Hash</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, color: "#475569", wordBreak: "break-all", fontSize: "11px" }}>{entry.previous_hash || "—"}</div>
          </div>
          {d && Object.keys(d).length > 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "8px" }}>Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
                {d.risk_score !== undefined && (
                  <div style={{ padding: "8px 10px", background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "8px", boxShadow: `2px 2px 0px ${BLACK}` }}>
                    <div style={{ fontFamily: FONT_HEAD, fontSize: "9px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "3px" }}>Risk Score</div>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: "13px", color: Number(d.risk_score) >= 20 ? "#DC2626" : Number(d.risk_score) >= 10 ? "#B45309" : "#059669" }}>
                      {d.risk_score}
                    </div>
                  </div>
                )}
                {d.max_severity && (
                  <div style={{ padding: "8px 10px", background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "8px", boxShadow: `2px 2px 0px ${BLACK}` }}>
                    <div style={{ fontFamily: FONT_HEAD, fontSize: "9px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "3px" }}>Severity</div>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: "13px", color: BLACK }}>{d.max_severity}</div>
                  </div>
                )}
                {d.patterns_matched !== undefined && (
                  <div style={{ padding: "8px 10px", background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "8px", boxShadow: `2px 2px 0px ${BLACK}` }}>
                    <div style={{ fontFamily: FONT_HEAD, fontSize: "9px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "3px" }}>Patterns Matched</div>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: "13px", color: BLACK }}>{d.patterns_matched}</div>
                  </div>
                )}
                {d.blocked !== undefined && (
                  <div style={{ padding: "8px 10px", background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "8px", boxShadow: `2px 2px 0px ${BLACK}` }}>
                    <div style={{ fontFamily: FONT_HEAD, fontSize: "9px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "3px" }}>Outcome</div>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: "13px", color: d.blocked ? "#DC2626" : "#059669" }}>
                      {d.blocked ? "BLOCKED" : "ALLOWED"}
                    </div>
                  </div>
                )}
                {d.memory_type && (
                  <div style={{ padding: "8px 10px", background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "8px", boxShadow: `2px 2px 0px ${BLACK}` }}>
                    <div style={{ fontFamily: FONT_HEAD, fontSize: "9px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "3px" }}>Memory Type</div>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: "13px", color: "#7C3AED" }}>{d.memory_type}</div>
                  </div>
                )}
                {d.categories && d.categories.length > 0 && (
                  <div style={{ gridColumn: "1 / -1", padding: "8px 10px", background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "8px", boxShadow: `2px 2px 0px ${BLACK}` }}>
                    <div style={{ fontFamily: FONT_HEAD, fontSize: "9px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "6px" }}>Categories</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {d.categories.map((cat) => (
                        <Chip key={cat} label={cat} bg="#FF4D4D" />
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
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
  const load = useCallback(async (forceRefresh = false) => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const [timeline, verify, health] = await Promise.allSettled([
        api.auditTimeline(token, forceRefresh),
        api.auditVerify(token, forceRefresh),
        api.health(forceRefresh),
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await load();
    })();
    return () => { cancelled = true; };
  }, [load]);

  // ── SSE stream ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const es = new EventSource(`${base}/api/audit/stream?token=${encodeURIComponent(token)}`, { withCredentials: true } as unknown as EventSourceInit);
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
    <div className="space-y-7 pb-10">
      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#0A0F14",
          border: `3px solid ${BLACK}`,
          borderRadius: "16px",
          boxShadow: SHADOW,
          padding: "32px 36px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#FACC15",
              margin: 0,
            }}
          >
            Security intelligence
          </p>
          <h1
            style={{
              fontFamily: FONT_HEAD,
              fontSize: "44px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#fff",
              margin: "10px 0 0 0",
              lineHeight: 1.05,
            }}
          >
            Audit &amp; Forensics
          </h1>
          <p style={{ margin: "10px 0 0 0", fontSize: "15px", fontWeight: 600, color: "#94A3B8", maxWidth: "640px" }}>
            Trace memory operations, verify chain integrity, and investigate security events.
          </p>
        </div>

        {/* Chain integrity + stream badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flexShrink: 0 }}>
          {fetching ? (
            <div style={{ width: "160px", height: "40px", background: "#1E293B", borderRadius: "9px", animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : verifyResult ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontFamily: FONT_HEAD,
                fontWeight: 900,
                fontSize: "12px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: BLACK,
                background: chainValid ? "#2DD4A0" : "#FF4D4D",
                border: `3px solid ${BLACK}`,
                borderRadius: "9px",
                boxShadow: SHADOW_SM,
                padding: "9px 14px",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: BLACK }} />
              {chainValid ? `Chain Verified · ${chainTotal} entries` : `Chain Broken at #${brokenAt}`}
            </span>
          ) : error ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontFamily: FONT_HEAD,
                fontWeight: 900,
                fontSize: "12px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: BLACK,
                background: "#FACC15",
                border: `3px solid ${BLACK}`,
                borderRadius: "9px",
                boxShadow: SHADOW_SM,
                padding: "9px 14px",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: BLACK }} />
              Verification Unavailable
            </span>
          ) : null}

          {/* Stream indicator */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontFamily: FONT_HEAD,
              fontWeight: 900,
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: BLACK,
              background: streamConnected ? "#FFFFFF" : "#1E293B",
              border: `3px solid ${BLACK}`,
              borderRadius: "9px",
              boxShadow: SHADOW_SM,
              padding: "8px 12px",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: streamConnected ? "#2DD4A0" : "#64748B" }} />
            {streamConnected ? "Live" : "Stream Offline"}
          </span>
        </div>
      </div>

      {/* ── Global error ───────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            background: "#FFE4E4",
            border: `3px solid ${BLACK}`,
            borderRadius: "14px",
            boxShadow: SHADOW,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: BLACK, margin: "0 0 4px 0" }}>Error</p>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: BLACK }}>{error}</p>
          </div>
          <NeoButton variant="secondary" size="sm" onClick={() => load(true)}>
            Retry
          </NeoButton>
        </div>
      )}

      {/* ── Security posture bar ───────────────────────────────────────────── */}
      {!fetching && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: "Chain Integrity",
              value: verifyResult
                ? (chainValid ? "VERIFIED" : "BROKEN")
                : (error ? "UNAVAILABLE" : "—"),
              accent: verifyResult
                ? (chainValid ? "#2DD4A0" : "#FF4D4D")
                : "#E2E8F0",
            },
            {
              label: "Audit Entries",
              value: verifyResult ? String(chainTotal) : "—",
              accent: "#C084FC",
            },
            {
              label: "Event Types",
              value: String(uniqueTypes.length || Object.keys(eventsByType).length || 0),
              accent: "#4D9FFF",
            },
            {
              label: "Threat Detections",
              value: String(eventsByType["pattern_detected"] ?? 0),
              accent: (eventsByType["pattern_detected"] ?? 0) > 0 ? "#FF4D4D" : "#E2E8F0",
            },
            {
              label: "Signing Backend",
              value: signingBackend ? signingBackend.toUpperCase() : "—",
              accent: "#FACC15",
            },
            {
              label: "Key ID",
              value: keyId ? keyId.slice(0, 8) + "…" : "—",
              accent: "#E2E8F0",
            },
          ].map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} accent={item.accent} />
          ))}
        </div>
      )}

      {fetching && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} height={72} />)}
        </div>
      )}

      {/* ── Event breakdown ────────────────────────────────────────────────── */}
      {!fetching && Object.keys(eventsByType).length > 0 && (
        <Panel title="Event Breakdown" description={`${totalEvents} total events`} accent="#4D9FFF">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(eventsByType).map(([type, count]) => {
              const meta = getEventMeta(type);
              const pct = (count / (totalEvents || 1)) * 100;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(filterType === type ? "all" : type)}
                  style={{
                    textAlign: "left",
                    padding: "14px",
                    border: `3px solid ${BLACK}`,
                    borderRadius: "12px",
                    boxShadow: SHADOW_SM,
                    background: filterType === type ? meta.bg : "#FFFFFF",
                    cursor: "pointer",
                    transform: "translate(-1px, -1px)",
                    transition: "transform 100ms, box-shadow 100ms",
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px, 2px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0px #000";
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW_SM;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW_SM;
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", gap: "8px" }}>
                    <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: BLACK, wordBreak: "break-all" }}>{type}</span>
                    <span style={{ fontFamily: FONT_HEAD, fontSize: "22px", fontWeight: 900, color: BLACK, flexShrink: 0 }}>{count}</span>
                  </div>
                  <div style={{ height: "8px", background: "#E2E8F0", border: `2px solid ${BLACK}`, borderRadius: "6px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: meta.bg, borderRight: `2px solid ${BLACK}` }} />
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: "10px", fontWeight: 700, color: "#475569", marginTop: "6px" }}>{pct.toFixed(1)}% of all events</div>
                </button>
              );
            })}
          </div>
          {filterType !== "all" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", paddingTop: "14px", borderTop: `2px solid ${BLACK}` }}>
              <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569" }}>Filtering by:</span>
              <Chip label={filterType} bg={getEventMeta(filterType).bg} />
              <button
                onClick={() => setFilterType("all")}
                style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, textDecoration: "underline", color: BLACK, background: "none", border: "none", cursor: "pointer" }}
              >
                clear
              </button>
            </div>
          )}
        </Panel>
      )}

      {/* ── Event timeline ─────────────────────────────────────────────────── */}
      <Panel
        title="Security Event Timeline"
        description={filterType !== "all" ? `Filtered: ${filterType}` : "Live hash-linked audit entries"}
        accent="#FACC15"
        action={<NeoButton size="sm" variant="secondary" onClick={() => load(true)}>Refresh</NeoButton>}
      >
        {fetching && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} height={48} />)}
          </div>
        )}

        {!fetching && filteredEntries.length === 0 && (
          <div style={{ padding: "48px 16px", textAlign: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                margin: "0 auto 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#E2E8F0",
                border: `3px solid ${BLACK}`,
                borderRadius: "12px",
                boxShadow: SHADOW_SM,
                fontSize: "24px",
              }}
            >
              📋
            </div>
            <p style={{ fontFamily: FONT_HEAD, fontSize: "14px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: BLACK, margin: "0 0 8px 0" }}>
              {filterType !== "all" ? `No ${filterType} events` : "No Audit Events"}
            </p>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#475569" }}>
              {filterType !== "all"
                ? "No events match the selected filter."
                : "Security-sensitive memory operations will appear here."}
            </p>
          </div>
        )}

        {!fetching && filteredEntries.length > 0 && (
          <div style={{ margin: "-20px", marginTop: 0 }}>
            {filteredEntries.map((entry) => (
              <EventRow
                key={entry.entry_id}
                entry={entry}
                expanded={expanded.has(entry.entry_id)}
                onToggle={() => toggleExpand(entry.entry_id)}
              />
            ))}

            {/* Load more */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderTop: `2px solid ${BLACK}` }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, color: "#475569" }}>{filteredEntries.length} events shown</span>
              {hasMore ? (
                <NeoButton size="sm" variant="secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load More"}
                </NeoButton>
              ) : (
                <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569" }}>All events loaded</span>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* ── Chain verification panel ────────────────────────────────────────── */}
      <Panel title="Hash Chain Verification" description="SHA-256 tamper evidence across every audit entry" accent={chainValid === false ? "#FF4D4D" : chainValid ? "#2DD4A0" : "#E2E8F0"}>
        {fetching ? (
          <Skeleton height={80} />
        ) : verifyResult ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "stretch" }}>
            <div
              style={{
                flex: "1 1 320px",
                minWidth: 0,
                padding: "16px 18px",
                border: `3px solid ${BLACK}`,
                borderRadius: "12px",
                boxShadow: SHADOW_SM,
                background: chainValid ? "#D9F99D" : "#FFE4E4",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "20px" }}>{chainValid ? "✅" : "⚠️"}</span>
                <span style={{ fontFamily: FONT_HEAD, fontSize: "16px", fontWeight: 900, color: BLACK }}>
                  {chainValid ? "Hash Chain Valid" : "Hash Chain Broken"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#475569", lineHeight: 1.55 }}>
                {chainValid
                  ? `All ${chainTotal} audit entries are correctly hash-linked. No tampering detected.`
                  : `Tamper evidence detected at entry index #${brokenAt}. Chain integrity is compromised.`}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0 }}>
              <div
                style={{
                  textAlign: "center",
                  padding: "12px 20px",
                  background: "#FFFFFF",
                  border: `3px solid ${BLACK}`,
                  borderRadius: "12px",
                  boxShadow: SHADOW_SM,
                  minWidth: "120px",
                }}
              >
                <div style={{ fontFamily: FONT_HEAD, fontSize: "28px", fontWeight: 900, color: BLACK, lineHeight: 1.1 }}>{chainTotal}</div>
                <div style={{ fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginTop: "4px" }}>Linked Entries</div>
              </div>
              <NeoButton size="sm" variant="secondary" onClick={() => load(true)}>
                Re-verify
              </NeoButton>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontFamily: FONT_MONO, fontSize: "13px", fontWeight: 700, color: "#475569" }}>
            {error ? "Verification unavailable — " + error : "Loading verification state…"}
          </p>
        )}
      </Panel>

      {/* ── Time-travel forensics ───────────────────────────────────────────── */}
      <Panel title="Time-Travel Forensics" description="Reconstruct memory state at any point in time" accent="#C084FC">
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: 600, color: "#475569", lineHeight: 1.6 }}>
          Query the audit trail as it existed at a specific timestamp. On CockroachDB uses AS OF SYSTEM TIME; on SQLite filters by recorded_at.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <label style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BLACK, marginBottom: "6px" }}>
              Timestamp (local time)
            </label>
            <input
              type="datetime-local"
              value={timeTravelTs}
              onChange={(e) => setTimeTravelTs(e.target.value)}
              style={inputStyle}
            />
            {timeTravelTs && (
              <p style={{ margin: "6px 0 0 0", fontFamily: FONT_MONO, fontSize: "10px", fontWeight: 700, color: "#475569" }}>
                Local ({Intl.DateTimeFormat().resolvedOptions().timeZone}) → UTC {new Date(timeTravelTs).toISOString()}
              </p>
            )}
          </div>
          <div>
            <NeoButton onClick={handleTimeTravel} disabled={timeTravelLoading || !timeTravelTs} variant="secondary">
              {timeTravelLoading ? "Querying…" : "Query State"}
            </NeoButton>
          </div>
        </div>

        {timeTravelError && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px 14px",
              background: "#FFE4E4",
              border: `3px solid ${BLACK}`,
              borderRadius: "10px",
              boxShadow: SHADOW_SM,
            }}
          >
            <p style={{ margin: 0, fontFamily: FONT_MONO, fontSize: "12px", fontWeight: 700, color: BLACK }}>{timeTravelError}</p>
          </div>
        )}

        {timeTravelResult && !timeTravelError && (
          <div style={{ marginTop: "14px", border: `3px solid ${BLACK}`, borderRadius: "12px", boxShadow: SHADOW_SM, overflow: "hidden", background: "#FFFFFF" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", padding: "10px 14px", borderBottom: `3px solid ${BLACK}`, background: "#F1F5F9" }}>
              <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BLACK }}>Query Result</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                {(timeTravelResult.total as number) ?? 0} events · {timeTravelResult.backend as string ?? ""}
              </span>
            </div>
            <div style={{ padding: "14px", maxHeight: "256px", overflow: "auto" }}>
              <pre style={{ margin: 0, fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 600, color: "#475569", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>
                {JSON.stringify(timeTravelResult, null, 2).slice(0, 8000)}
              </pre>
            </div>
          </div>
        )}
      </Panel>

      {/* ── Export & compliance ─────────────────────────────────────────────── */}
      <Panel title="Export &amp; Compliance" description="Portable audit records for external review" accent="#4D9FFF">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
          {/* Export JSONL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
            <NeoButton
              onClick={handleExportJsonl}
              disabled={exportStatus === "loading"}
              variant={exportStatus === "done" ? "primary" : exportStatus === "error" ? "danger" : "secondary"}
            >
              {exportStatus === "loading" ? "Exporting…"
                : exportStatus === "done" ? "✓ Exported"
                : exportStatus === "error" ? "Export Failed"
                : "Export Audit JSONL"}
            </NeoButton>
            <span style={{ fontFamily: FONT_MONO, fontSize: "10px", fontWeight: 700, color: "#475569" }}>Full audit trail as JSONL</span>
          </div>

          {/* Export CSV */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
            <NeoButton
              onClick={handleExportCsv}
              disabled={csvExportStatus === "loading"}
              variant={csvExportStatus === "done" ? "primary" : csvExportStatus === "error" ? "danger" : "secondary"}
            >
              {csvExportStatus === "loading" ? "Exporting…"
                : csvExportStatus === "done" ? "✓ Exported"
                : csvExportStatus === "error" ? "Export Failed"
                : "Export Audit CSV"}
            </NeoButton>
            <span style={{ fontFamily: FONT_MONO, fontSize: "10px", fontWeight: 700, color: "#475569" }}>Audit event table as CSV</span>
          </div>

          {/* Export compliance */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "200px" }}>
            <NeoButton
              onClick={handleExportCompliance}
              disabled={complianceExportStatus === "loading"}
              variant={complianceExportStatus === "done" ? "primary" : complianceExportStatus === "forbidden" ? "secondary" : complianceExportStatus === "error" ? "danger" : "secondary"}
            >
              {complianceExportStatus === "loading" ? "Generating…"
                : complianceExportStatus === "done" ? "✓ Downloaded"
                : complianceExportStatus === "error" ? "Export Failed"
                : complianceExportStatus === "forbidden" ? "Access Restricted"
                : "Export Compliance JSON"}
            </NeoButton>
            <span style={{ fontFamily: FONT_MONO, fontSize: "10px", fontWeight: 700, color: "#475569" }}>
              {complianceExportStatus === "forbidden"
                ? "Requires admin role"
                : "EU AI Act Article 12 report"}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
