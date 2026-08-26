"use client";

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
  const [chainValid, setChainValid] = useState(true);
  const [compliance, setCompliance] = useState("UNKNOWN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [c, m, t, cv, cr] = await Promise.all([
        api.listConstraints(token),
        api.listMemories(token),
        api.auditTimeline(token),
        api.auditVerify(token),
        api.complianceReport(token),
      ]);
      setConstraints(Array.isArray(c) ? c as unknown as Constraint[] : []);
      setMemories(Array.isArray(m) ? m as unknown as Memory[] : []);
      setAuditEntries(((t as Record<string, unknown>).entries || []) as unknown as AuditEntry[]);
      setAuditEvents(((t as Record<string, unknown>).events_by_type || {}) as Record<string, number>);
      setChainValid((cv as Record<string, unknown>).valid as boolean || false);
      setCompliance((cr as Record<string, unknown>).compliance_status as string || "UNKNOWN");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.04)" }} />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.03)" }} />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-64 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.03)" }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-black font-display">Dashboard</h1>
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="font-medium mb-4" style={{ color: "#C23B3B" }}>{error}</p>
          <button onClick={load} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "rgba(0,0,0,0.04)" }}>Try Again</button>
        </div>
      </div>
    );
  }

  const totalEvents = Object.values(auditEvents).reduce((a, b) => a + (b as number), 0);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight">Dashboard</h1>
          <p className="text-sm font-medium mt-1" style={{ color: "#5A5248" }}>AgentShield memory defense overview</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold" style={chainValid ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.15)" } : { background: "rgba(194,59,59,0.1)", color: "#C23B3B", border: "1px solid rgba(194,59,59,0.15)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: chainValid ? "#059669" : "#C23B3B", animation: "pulse-ring 2s ease-in-out infinite" }} />
            Chain {chainValid ? "Valid" : "Broken"}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold" style={compliance === "COMPLIANT" ? { background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.15)" } : { background: "rgba(245,158,11,0.1)", color: "#D97706", border: "1px solid rgba(245,158,11,0.15)" }}>
            {compliance}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Constraints", value: constraints.length, icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
          ), color: "#059669", bg: "rgba(16,185,129,0.1)", link: "/dashboard/constraints" },
          { label: "Memories", value: memories.length, icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
          ), color: "#7C3AED", bg: "rgba(139,92,246,0.1)", link: "/dashboard/memory" },
          { label: "Audit Events", value: totalEvents, icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          ), color: "#D97706", bg: "rgba(245,158,11,0.1)", link: "/dashboard/audit" },
          { label: "Patterns", value: 45, icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
          ), color: "#0284C7", bg: "rgba(14,165,233,0.1)", link: null },
        ].map((stat, i) => (
          <a
            key={stat.label}
            href={stat.link || "#"}
            className={`glass-card rounded-xl p-4 group transition-all duration-300 hover:-translate-y-0.5 animate-slide-up ${stat.link ? "cursor-pointer" : "cursor-default"}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ background: stat.bg, color: stat.color }}>
                {stat.icon}
              </div>
              {stat.link && (
                <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-1 group-hover:translate-x-0" style={{ color: stat.color }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              )}
            </div>
            <div className="text-2xl font-black font-display tracking-tight" style={{ color: "#1A1A1A" }}>
              <AnimatedNumber value={stat.value} delay={i * 80} />
            </div>
            <div className="text-[11px] font-bold tracking-wider uppercase mt-1" style={{ color: "#7A7164" }}>{stat.label}</div>
          </a>
        ))}
      </div>

      {/* Two-column: Recent Constraints + Recent Memories */}
      <div className="grid grid-cols-2 gap-4">
        {/* Constraints */}
        <div className="glass-card rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#059669" }} />
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#5A5248" }}>Recent Constraints</span>
            </div>
            <a href="/dashboard/constraints" className="text-[11px] font-bold hover-underline" style={{ color: "#0D7C5F" }}>View all</a>
          </div>
          <div className="p-2">
            {constraints.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs font-medium" style={{ color: "#7A7164" }}>No constraints pinned yet</p>
              </div>
            ) : constraints.slice(0, 4).map((c, i) => {
              return (
                <div key={c.constraint_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-white/40">
                  <Tag label={c.constraint_type} colors={TYPE_COLORS[c.constraint_type]} />
                  <span className="text-xs font-medium truncate flex-1" style={{ color: "#1A1A1A" }}>{c.text}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "#7A7164" }}>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Memories */}
        <div className="glass-card rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: "260ms" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#7C3AED" }} />
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#5A5248" }}>Recent Memories</span>
            </div>
            <a href="/dashboard/memory" className="text-[11px] font-bold hover-underline" style={{ color: "#0D7C5F" }}>View all</a>
          </div>
          <div className="p-2">
            {memories.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs font-medium" style={{ color: "#7A7164" }}>No memories stored yet</p>
              </div>
            ) : memories.slice(0, 4).map((m, i) => {
              return (
                <div key={m.memory_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-white/40">
                  <Tag label={m.memory_type} colors={TYPE_COLORS[m.memory_type]} />
                  <span className="text-xs font-medium truncate flex-1" style={{ color: "#1A1A1A" }}>{m.content}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "#7A7164" }}>{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-column: Audit Feed + Event Breakdown */}
      <div className="grid grid-cols-5 gap-4">
        {/* Audit feed */}
        <div className="col-span-3 glass-card rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: "320ms" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#D97706" }} />
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#5A5248" }}>Audit Trail</span>
            </div>
            <a href="/dashboard/audit" className="text-[11px] font-bold hover-underline" style={{ color: "#0D7C5F" }}>View all</a>
          </div>
          <div className="p-2">
            {auditEntries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs font-medium" style={{ color: "#7A7164" }}>No audit entries yet</p>
              </div>
            ) : auditEntries.slice(0, 5).map((e, i) => {
              return (
                <div key={e.entry_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-white/40">
                  <Tag label={e.event_type} colors={TYPE_COLORS[e.event_type]} />
                  <span className="text-xs font-medium flex-1" style={{ color: "#1A1A1A" }}>{e.action}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "#7A7164" }}>{new Date(e.recorded_at).toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event breakdown */}
        <div className="col-span-2 glass-card rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: "380ms" }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#0284C7" }} />
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#5A5248" }}>Event Breakdown</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {Object.keys(auditEvents).length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs font-medium" style={{ color: "#7A7164" }}>No events recorded</p>
              </div>
            ) : Object.entries(auditEvents).map(([type, count]) => {
              const colors = TYPE_COLORS[type] || FALLBACK_COLORS;
              const maxCount = Math.max(...Object.values(auditEvents).map(Number), 1);
              const pct = ((count as number) / maxCount) * 100;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold" style={{ color: "#5A5248" }}>{type}</span>
                    <span className="text-[11px] font-bold font-display" style={{ color: colors.fg }}>{count as number}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors.fg, opacity: 0.6 }} />
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
