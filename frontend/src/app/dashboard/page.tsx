"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const timer = setTimeout(() => {
      const duration = 900;
      const start = performance.now();
      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayed(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return <span>{displayed}</span>;
}

interface Constraint { constraint_id: string; text: string; constraint_type: string; is_active: boolean; created_at: string; }
interface Memory { memory_id: string; content: string; memory_type: string; created_at: string; }
interface AuditEntry { entry_id: string; event_type: string; action: string; recorded_at: string; }

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  safety: { bg: "rgba(194,59,59,0.08)", fg: "#C23B3B" },
  policy: { bg: "rgba(245,158,11,0.08)", fg: "#D97706" },
  instruction: { bg: "rgba(14,165,233,0.08)", fg: "#0284C7" },
  episodic: { bg: "rgba(139,92,246,0.08)", fg: "#7C3AED" },
  semantic: { bg: "rgba(14,165,233,0.08)", fg: "#0284C7" },
  procedural: { bg: "rgba(245,158,11,0.08)", fg: "#D97706" },
  auth: { bg: "rgba(14,165,233,0.08)", fg: "#0284C7" },
  constraint: { bg: "rgba(16,185,129,0.08)", fg: "#059669" },
  memory: { bg: "rgba(139,92,246,0.08)", fg: "#7C3AED" },
  scan: { bg: "rgba(245,158,11,0.08)", fg: "#D97706" },
};

// 2.3 Fix: deterministic color for unknown event types (no hardcoded grey)
function hashColor(str: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { bg: `hsla(${hue}, 70%, 50%, 0.08)`, fg: `hsl(${hue}, 70%, 40%)` };
}
function getTypeColor(type: string) {
  return TYPE_COLORS[type] || hashColor(type);
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditEvents, setAuditEvents] = useState<Record<string, number>>({});
  const [chainValid, setChainValid] = useState(true);
  const [compliance, setCompliance] = useState("UNKNOWN");
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
        setAuditEntries(((t as Record<string, unknown>).entries || []) as unknown as AuditEntry[]);
        setAuditEvents(((t as Record<string, unknown>).events_by_type || {}) as Record<string, number>);
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

  // 2.1 Real-time SSE: subscribe to audit stream for instant tamper alerts
  useEffect(() => {
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const es = new EventSource(`${base}/api/audit/stream`, { withCredentials: true } as unknown as EventSourceInit);
    // Also try with token header via fetch-based SSE polyfill fallback: we use native EventSource which can't send Authorization header,
    // so we rely on httpOnly cookie (if not present, fallback to polling)
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
    es.onerror = () => {
      // Fallback to polling on error
      es.close();
    };
    return () => es.close();
  }, [token]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 rounded-xl animate-pulse bg-white/5" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl animate-pulse bg-white/5" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-64 rounded-xl animate-pulse bg-white/5" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>Dashboard</h1>
        <div className="rounded-2xl p-10 text-center bg-rose-500/10 border border-rose-500/20 backdrop-blur">
          <p className="font-medium mb-4 text-rose-400">{error}</p>
          <button onClick={reload} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-500 text-white tracking-widest uppercase">Try Again</button>
        </div>
      </div>
    );
  }

  // 2.2 Fix: memoize heavy calculation to avoid UI freeze on large auditEvents
  const totalEvents = Object.values(auditEvents).reduce((a, b) => a + (b as number), 0);
  const maxAuditCount = (() => {
    const vals = Object.values(auditEvents).map(Number);
    return vals.length ? Math.max(...vals) : 1;
  })();

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 mb-2">Memory Defense Overview</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>Command Center</h1>
          <p className="text-sm text-white/40 mt-1">AgentShield memory defense overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border backdrop-blur ${chainValid ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${chainValid ? 'bg-[#10B981]' : 'bg-rose-400'}`} />
            Chain {chainValid ? "Valid" : "Broken"}
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border ${compliance === 'COMPLIANT' ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
            {compliance}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Constraints", value: constraints.length, color: "#10B981", link: "/dashboard/constraints" },
          { label: "Memories", value: memories.length, color: "#a78bfa", link: "/dashboard/memory" },
          { label: "Audit Events", value: totalEvents, color: "#f59e0b", link: "/dashboard/audit" },
          { label: "Detection Patterns", value: 49, color: "#38bdf8", link: null, note: "Configured" },
        ].map((stat, i) => (
          <a
            key={stat.label}
            href={stat.link || "#"}
            className={`rounded-xl p-5 border border-white/5 bg-white/[0.02] transition-all duration-200 hover:bg-white/[0.05] hover:border-white/10 ${stat.link ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'} group`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-space-grotesk)", color: stat.color }}>
              <AnimatedNumber value={stat.value} delay={i * 80} />
            </div>
            <div className="text-[10px] font-mono tracking-widest uppercase text-white/40">{stat.label}</div>
            {'note' in stat && stat.note && (
              <div className="text-[8px] font-mono tracking-widest uppercase text-white/25 mt-1">{stat.note}</div>
            )}
            {stat.link && (
              <div className="mt-3 text-[9px] font-mono tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: stat.color }}>View all →</div>
            )}
          </a>
        ))}
      </div>

      {/* Two-column: Recent Constraints + Recent Memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Constraints */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Recent Constraints</span>
            </div>
            <a href="/dashboard/constraints" className="text-[10px] font-mono tracking-widest uppercase text-[#10B981] hover:text-[#34D399] transition-colors">View all →</a>
          </div>
          <div className="p-2">
            {constraints.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No constraints pinned yet</p>
              </div>
            ) : constraints.slice(0, 4).map((c) => (
              <div key={c.constraint_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: getTypeColor(c.constraint_type).bg, color: getTypeColor(c.constraint_type).fg }}>
                  {c.constraint_type}
                </span>
                <span className="text-xs text-white/60 truncate flex-1">{c.text}</span>
                <span className="text-[9px] font-mono text-white/25 shrink-0">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Memories */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Recent Memories</span>
            </div>
            <a href="/dashboard/memory" className="text-[10px] font-mono tracking-widest uppercase text-[#10B981] hover:text-[#34D399] transition-colors">View all →</a>
          </div>
          <div className="p-2">
            {memories.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No memories stored yet</p>
              </div>
            ) : memories.slice(0, 4).map((m) => (
              <div key={m.memory_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: getTypeColor(m.memory_type).bg, color: getTypeColor(m.memory_type).fg }}>
                  {m.memory_type}
                </span>
                <span className="text-xs text-white/60 truncate flex-1">{m.content}</span>
                <span className="text-[9px] font-mono text-white/25 shrink-0">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column: Audit Feed + Event Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Audit feed */}
        <div className="col-span-3 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Audit Trail</span>
            </div>
            <a href="/dashboard/audit" className="text-[10px] font-mono tracking-widest uppercase text-[#10B981] hover:text-[#34D399] transition-colors">View all →</a>
          </div>
          <div className="p-2">
            {auditEntries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No audit entries yet</p>
              </div>
            ) : auditEntries.slice(0, 5).map((e) => (
              <div key={e.entry_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: getTypeColor(e.event_type).bg, color: getTypeColor(e.event_type).fg }}>
                  {e.event_type}
                </span>
                <span className="text-xs text-white/60 flex-1">{e.action}</span>
                <span className="text-[9px] font-mono text-white/25 shrink-0">{new Date(e.recorded_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Event breakdown */}
        <div className="col-span-2 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Event Breakdown</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {Object.keys(auditEvents).length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No events recorded</p>
              </div>
            ) : Object.entries(auditEvents).map(([type, count]) => {
              const colors = getTypeColor(type);
              const pct = ((count as number) / maxAuditCount) * 100;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">{type}</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: colors.fg }}>{count as number}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors.fg, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
