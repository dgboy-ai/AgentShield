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

const FALLBACK_COLORS = { bg: "rgba(0,0,0,0.04)", fg: "#5A5248" };
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
function Tag({ label, colors }: { label: string; colors?: { bg: string; fg: string } }) {
  const c = colors || FALLBACK_COLORS;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide" style={{ background: c.bg, color: c.fg }}>
      {label}
    </span>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditEvents, setAuditEvents] = useState<Record<string, number>>({});
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [compliance, setCompliance] = useState("CHECKING");
  const [patternsCount, setPatternsCount] = useState<number>(0);
  const [signingBackend, setSigningBackend] = useState<string>("LOCAL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [c, m, t, cv, cr, patterns, health] = await Promise.allSettled([
        api.listConstraints(token),
        api.listMemories(token),
        api.auditTimeline(token),
        api.auditVerify(token),
        api.complianceReport(token),
        api.scanPatterns(token),
        api.health(),
      ]);

      if (c.status === "fulfilled" && Array.isArray(c.value)) {
        setConstraints(c.value as unknown as Constraint[]);
      }
      if (m.status === "fulfilled" && Array.isArray(m.value)) {
        setMemories(m.value as unknown as Memory[]);
      }
      if (t.status === "fulfilled") {
        const td = t.value as Record<string, unknown>;
        setAuditEntries(((td.entries || []) as unknown as AuditEntry[]));
        setAuditEvents(((td.events_by_type || {}) as Record<string, number>));
      }
      if (cv.status === "fulfilled") {
        const cvd = cv.value as Record<string, unknown>;
        setChainValid((cvd.valid as boolean) ?? (cvd.is_valid as boolean) ?? false);
      } else {
        setChainValid(false);
      }
      if (cr.status === "fulfilled") {
        setCompliance((cr.value as Record<string, unknown>).compliance_status as string || "COMPLIANT");
      } else {
        const reason = cr.reason;
        if (reason instanceof ApiError && reason.status === 403) {
          setCompliance("RESTRICTED (ADMIN)");
        } else {
          setCompliance("UNAVAILABLE");
        }
      }
      if (patterns.status === "fulfilled") {
        const pd = patterns.value as Record<string, unknown>;
        setPatternsCount(typeof pd.count === "number" ? pd.count : (Array.isArray(pd.patterns) ? pd.patterns.length : 0));
      }
      if (health.status === "fulfilled") {
        const hd = health.value as Record<string, unknown>;
        if (hd.signing && typeof hd.signing === "object") {
          setSigningBackend((hd.signing as any).backend?.toUpperCase() || "LOCAL");
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // 2.1 Real-time SSE: subscribe to audit stream for instant tamper alerts
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
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 rounded-xl animate-pulse bg-white/5" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl animate-pulse bg-white/5" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 rounded-xl animate-pulse bg-white/5" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-64 rounded-xl animate-pulse bg-white/5" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>Command Center</h1>
        <div className="rounded-2xl p-10 text-center bg-rose-500/10 border border-rose-500/20 backdrop-blur">
          <p className="font-medium mb-4 text-rose-400">{error}</p>
          <button onClick={load} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-500 text-white tracking-widest uppercase hover:bg-rose-600 transition-colors">Try Again</button>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-white/40 mt-1">Real-time tamper defense &amp; hash chain monitoring</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border backdrop-blur ${chainValid ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : (chainValid === false ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400')}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${chainValid ? 'bg-[#10B981] animate-pulse' : (chainValid === false ? 'bg-rose-400' : 'bg-gray-400')}`} />
            Chain {chainValid ? "Verified" : (chainValid === false ? "Broken" : "Checking")}
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border ${compliance === 'COMPLIANT' ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : (compliance.includes('RESTRICTED') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/10 text-white/50')}`}>
            {compliance}
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
            title="Refresh metrics"
            aria-label="Refresh metrics"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Constraints", value: constraints.length, color: "#10B981", link: "/dashboard/constraints" },
          { label: "Memories", value: memories.length, color: "#a78bfa", link: "/dashboard/memory" },
          { label: "Audit Events", value: totalEvents, color: "#f59e0b", link: "/dashboard/audit" },
          { label: "Detection Patterns", value: patternsCount, color: "#38bdf8", link: null },
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
            {stat.link && (
              <div className="mt-3 text-[9px] font-mono tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: stat.color }}>View all →</div>
            )}
          </a>
        ))}
      </div>

      {/* SECURITY POSTURE */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: "Chain Integrity", status: chainValid ? "VERIFIED" : (chainValid === false ? "BROKEN" : "CHECKING"), color: chainValid ? "#10B981" : (chainValid === false ? "#F43F5E" : "#9CA3AF") },
          { label: "Constraint Engine", status: `${constraints.length} PINNED`, color: "#10B981" },
          { label: "Memory Defense", status: `${memories.length} STORED`, color: "#10B981" },
          { label: "Threat Engine", status: `${patternsCount} PATTERNS`, color: "#38BDF8" },
          { label: "Audit Trail", status: `${totalEvents} LOGGED`, color: "#F59E0B" },
          { label: "Signing Backend", status: signingBackend, color: "#10B981" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center group transition-colors hover:bg-white/[0.05]">
            <div className="text-[10px] font-mono tracking-widest uppercase text-white/40 mb-2 h-8 flex items-center justify-center">{item.label}</div>
            <div className="text-xs font-bold font-mono tracking-widest uppercase truncate" style={{ color: item.color }}>{item.status}</div>
          </div>
        ))}
      </div>

      {/* MEMORY DEFENSE PIPELINE */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden p-6 hidden md:block">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Memory Defense Pipeline</span>
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono tracking-widest uppercase text-white/60">
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">1</div>
            <span>Auth</span>
            <div className="absolute right-0 top-4 w-1/2 h-px bg-gradient-to-r from-transparent to-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="absolute left-0 top-4 w-1/2 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] flex items-center justify-center">2</div>
            <span>Constraint Check</span>
            <div className="absolute right-0 top-4 w-1/2 h-px bg-gradient-to-r from-transparent to-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="absolute left-0 top-4 w-1/2 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center">3</div>
            <span>Poisoning Det.</span>
            <div className="absolute right-0 top-4 w-1/2 h-px bg-gradient-to-r from-transparent to-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="absolute left-0 top-4 w-1/2 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">4</div>
            <span>Integrity Hash</span>
            <div className="absolute right-0 top-4 w-1/2 h-px bg-gradient-to-r from-transparent to-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="absolute left-0 top-4 w-1/2 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">5</div>
            <span>Hash Chain</span>
            <div className="absolute right-0 top-4 w-1/2 h-px bg-gradient-to-r from-transparent to-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="absolute left-0 top-4 w-1/2 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center opacity-50">6</div>
            <span className="opacity-50">Digital Sig.</span>
            <div className="absolute right-0 top-4 w-1/2 h-px bg-gradient-to-r from-transparent to-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="absolute left-0 top-4 w-1/2 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center">7</div>
            <span>Persist</span>
            <div className="absolute right-0 top-4 w-1/2 h-px bg-gradient-to-r from-transparent to-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 relative">
            <div className="absolute left-0 top-4 w-1/2 h-px bg-gradient-to-r from-white/10 to-transparent" />
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center">8</div>
            <span>Audit</span>
          </div>
        </div>
      </div>

      {/* Two-column: Recent Constraints + Recent Memories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Constraints */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden flex flex-col min-h-[200px]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Recent Constraints</span>
            </div>
            <a href="/dashboard/constraints" className="text-[10px] font-mono tracking-widest uppercase text-[#10B981] hover:text-[#34D399] transition-colors">View all →</a>
          </div>
          <div className="p-2 flex-1">
            {constraints.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No constraints pinned yet</p>
              </div>
            ) : constraints.slice(0, 4).map((c) => (
              <div key={c.constraint_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded shrink-0" style={{ background: getTypeColor(c.constraint_type).bg, color: getTypeColor(c.constraint_type).fg }}>
                  {c.constraint_type}
                </span>
                <span className="text-xs text-white/60 truncate flex-1">{c.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Memories */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden flex flex-col min-h-[200px]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Recent Memories</span>
            </div>
            <a href="/dashboard/memory" className="text-[10px] font-mono tracking-widest uppercase text-[#10B981] hover:text-[#34D399] transition-colors">View all →</a>
          </div>
          <div className="p-2 flex-1">
            {memories.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No memories stored yet</p>
              </div>
            ) : memories.slice(0, 4).map((m) => (
              <div key={m.memory_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded shrink-0" style={{ background: getTypeColor(m.memory_type).bg, color: getTypeColor(m.memory_type).fg }}>
                  {m.memory_type}
                </span>
                <span className="text-xs text-white/60 truncate flex-1">{m.content}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column: Audit Feed + Event Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Audit feed */}
        <div className="col-span-3 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">Recent Security Activity</span>
            </div>
            <a href="/dashboard/audit" className="text-[10px] font-mono tracking-widest uppercase text-[#10B981] hover:text-[#34D399] transition-colors">View all →</a>
          </div>
          <div className="p-2 flex-1">
            {auditEntries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No audit entries yet</p>
              </div>
            ) : auditEntries.slice(0, 6).map((e) => (
              <div key={e.entry_id} className="flex flex-col gap-1 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors border-b border-white/[0.02] last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: getTypeColor(e.event_type).bg, color: getTypeColor(e.event_type).fg }}>
                    {e.event_type}
                  </span>
                  <span className="text-[10px] font-mono text-white/30">{new Date(e.recorded_at).toLocaleTimeString()}</span>
                </div>
                <span className="text-xs text-white/70 mt-1">{e.action}</span>
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
          <div className="p-5 space-y-4">
            {Object.keys(auditEvents).length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/30">No events recorded</p>
              </div>
            ) : Object.entries(auditEvents).map(([type, count]) => {
              const colors = getTypeColor(type);
              const pct = ((count as number) / maxAuditCount) * 100;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-white/60">{type}</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: colors.fg }}>{count as number}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors.fg, opacity: 0.8 }} />
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
