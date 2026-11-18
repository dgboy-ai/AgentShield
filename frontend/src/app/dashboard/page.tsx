"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayed, setDisplayed] = useState(value);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const duration = 900;
    let start = 0;
    let cancelled = false;
    const animateFrom = displayed;
    const delta = value - animateFrom;
    if (delta === 0) {
      setDisplayed(value);
      return;
    }
    const begin = () => {
      start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayed(Math.round(animateFrom + delta * eased));
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    timerRef.current = setTimeout(begin, delay);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{displayed}</span>;
}

interface Constraint { constraint_id: string; text: string; constraint_type: string; is_active: boolean; created_at: string; }
interface Memory { memory_id: string; content: string; memory_type: string; created_at: string; source_provenance?: string; }
interface AuditEntry { entry_id: string; event_type: string; action: string; recorded_at: string; actor?: string; }

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
  const [compliance, setCompliance] = useState("UNKNOWN");
  const [patternsTotal, setPatternsTotal] = useState(49);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const [c, m, t, cv, cr, pat] = await Promise.all([
          api.listConstraints(token),
          api.listMemories(token),
          api.auditTimeline(token),
          api.auditVerify(token),
          api.complianceReport(token).catch(() => ({ compliance_status: "UNKNOWN" })),
          api.scanPatterns(token).catch(() => null),
        ]);
        if (cancelled) return;
        setConstraints(Array.isArray(c) ? c as unknown as Constraint[] : []);
        setMemories(Array.isArray(m) ? m as unknown as Memory[] : []);
        setAuditEntries(((t as Record<string, unknown>).entries || []) as unknown as AuditEntry[]);
        setAuditEvents(((t as Record<string, unknown>).events_by_type || {}) as Record<string, number>);
        // Handle both valid and is_valid for backward compat
        const cvd = cv as Record<string, unknown>;
        if (typeof cvd.valid === "boolean") setChainValid(cvd.valid as boolean);
        else if (typeof cvd.is_valid === "boolean") setChainValid(cvd.is_valid as boolean);
        else setChainValid(false);
        setCompliance((cr as Record<string, unknown>).compliance_status as string || "UNKNOWN");
        const pd = pat as Record<string, unknown> | null;
        const total =
          (pd?.total_patterns as number) ??
          ((pd?.stats as Record<string, unknown>)?.total_patterns as number) ??
          (Array.isArray((pd as Record<string, unknown>)?.patterns) ? ((pd as Record<string, unknown>).patterns as unknown[]).length : undefined) ??
          49;
        if (typeof total === "number" && Number.isFinite(total)) setPatternsTotal(total);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  // Real-time SSE with polling fallback (no silent death)
  useEffect(() => {
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let es: EventSource | null = null;
    let closed = false;
    try {
      es = new EventSource(`${base}/api/audit/stream`, { withCredentials: true } as unknown as EventSourceInit);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.entries) setAuditEntries(data.entries as unknown as AuditEntry[]);
          if (data.events_by_type) setAuditEvents(data.events_by_type as Record<string, number>);
          if (typeof data.audit_valid === "boolean" || typeof data.hash_valid === "boolean") {
            const a = typeof data.audit_valid === "boolean" ? data.audit_valid : true;
            const h = typeof data.hash_valid === "boolean" ? data.hash_valid : true;
            setChainValid(!!(a && h));
          }
        } catch {}
      };
      es.onerror = () => {
        try { es?.close(); } catch {}
        es = null;
      };
    } catch {}
    const id = setInterval(() => {
      if (closed || es) return;
      setReloadKey((k) => k + 1);
    }, 15000);
    return () => {
      closed = true;
      try { es?.close(); } catch {}
      clearInterval(id);
    };
  }, [token]);

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
          <button onClick={reload} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "rgba(0,0,0,0.04)" }}>Try Again</button>
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-5xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-500 drop-shadow-sm pb-1">
            Dashboard
          </h1>
          <p className="text-base font-medium mt-1 tracking-tight text-gray-500">
            AgentShield memory defense overview
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold shadow-sm"
            role="status"
            aria-live="polite"
            style={
              chainValid === null
                ? { background: "#f4f3ef", color: "#57534e", border: "1px solid rgba(0,0,0,0.08)" }
                : chainValid
                  ? { background: "linear-gradient(to right, #ecfdf5, #d1fae5)", color: "#047857", border: "1px solid rgba(16,185,129,0.2)" }
                  : { background: "linear-gradient(to right, #fef2f2, #fee2e2)", color: "#b91c1c", border: "1px solid rgba(220,38,38,0.2)" }
            }
          >
            <div className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${chainValid ? "bg-emerald-500" : chainValid === null ? "bg-stone-400" : "bg-red-500"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${chainValid ? "bg-emerald-600" : chainValid === null ? "bg-stone-400" : "bg-red-600"}`}></span>
            </div>
            Chain {chainValid === null ? "Checking…" : chainValid ? "Valid" : "Broken"}
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold shadow-sm" style={compliance === "COMPLIANT" ? { background: "linear-gradient(to right, #ecfdf5, #d1fae5)", color: "#047857", border: "1px solid rgba(16,185,129,0.2)" } : { background: "linear-gradient(to right, #fffbeb, #fef3c7)", color: "#b45309", border: "1px solid rgba(245,158,11,0.2)" }}>
            {compliance}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { label: "Constraints", value: constraints.length, icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
          ), color: "#059669", bg: "linear-gradient(135deg, #ecfdf5, #d1fae5)", border: "border-emerald-100", link: "/dashboard/constraints" },
          { label: "Memories", value: memories.length, icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
          ), color: "#7C3AED", bg: "linear-gradient(135deg, #f5f3ff, #ede9fe)", border: "border-violet-100", link: "/dashboard/memory" },
          { label: "Audit Events", value: totalEvents, icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          ), color: "#D97706", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "border-amber-100", link: "/dashboard/audit" },
          { label: "Patterns", value: patternsTotal, icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
          ), color: "#0284C7", bg: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", border: "border-sky-100", link: null },
        ].map((stat, i) => {
          const card = (
            <div
              className={`glass-card rounded-2xl p-6 group transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl border ${stat.border} ${stat.link ? "cursor-pointer" : "cursor-default"}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm" style={{ background: stat.bg, color: stat.color }}>
                {stat.icon}
              </div>
              {stat.link && (
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0" style={{ color: stat.color }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              )}
            </div>
            <div className="text-4xl font-black font-display tracking-tighter" style={{ color: "#111827" }}>
              <AnimatedNumber value={stat.value} delay={i * 80} />
            </div>
            <div className="text-xs font-bold tracking-widest uppercase mt-2" style={{ color: "#6B7280" }}>{stat.label}</div>
            </div>
          );
          if (!stat.link) return <div key={stat.label}>{card}</div>;
          return (
            <Link key={stat.label} href={stat.link} aria-label={`View all ${stat.label}`} className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2">
              {card}
            </Link>
          );
        })}
      </div>

      {/* Two-column: Recent Constraints + Recent Memories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
        {/* Constraints */}
        <div className="glass-card rounded-2xl overflow-hidden animate-slide-up shadow-sm border border-gray-100" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/40">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-sm font-black tracking-widest uppercase text-gray-800 font-display">Recent Constraints</span>
            </div>
            <Link href="/dashboard/constraints" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors rounded">View all &rarr;</Link>
          </div>
          <div className="p-3">
            {constraints.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-gray-400">No constraints pinned yet</p>
              </div>
            ) : constraints.slice(0, 4).map((c, i) => {
              return (
                <div key={c.constraint_id} className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white hover:shadow-sm hover:scale-[1.01] border border-transparent hover:border-gray-100 cursor-default group">
                  <Tag label={c.constraint_type} colors={getTypeColor(c.constraint_type)} />
                  <span className="text-sm font-semibold truncate flex-1 text-gray-700 group-hover:text-gray-900 transition-colors">{c.text}</span>
                  <span className="text-xs font-medium text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Memories */}
        <div className="glass-card rounded-2xl overflow-hidden animate-slide-up shadow-sm border border-gray-100" style={{ animationDelay: "260ms" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/40">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              <span className="text-sm font-black tracking-widest uppercase text-gray-800 font-display">Recent Memories</span>
            </div>
            <Link href="/dashboard/memory" className="text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors rounded">View all &rarr;</Link>
          </div>
          <div className="p-3">
            {memories.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-gray-400">No memories stored yet</p>
              </div>
            ) : memories.slice(0, 4).map((m, i) => {
              return (
                <div key={m.memory_id} className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white hover:shadow-sm hover:scale-[1.01] border border-transparent hover:border-gray-100 cursor-default group">
                  <Tag label={m.memory_type} colors={getTypeColor(m.memory_type)} />
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full shrink-0 border border-gray-200 shadow-sm">Agent: {m.source_provenance || "direct"}</span>
                  <span className="text-sm font-semibold truncate flex-1 text-gray-700 group-hover:text-gray-900 transition-colors">{m.content}</span>
                  <span className="text-xs font-medium text-gray-400">{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-column: Audit Feed + Event Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-8 mb-8">
        {/* Audit feed */}
        <div className="lg:col-span-3 glass-card rounded-2xl overflow-hidden animate-slide-up shadow-sm border border-gray-100" style={{ animationDelay: "320ms" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/40">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <span className="text-sm font-black tracking-widest uppercase text-gray-800 font-display">Audit Trail</span>
            </div>
            <Link href="/dashboard/audit" className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors rounded">View all &rarr;</Link>
          </div>
          <div className="p-3">
            {auditEntries.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-gray-400">No audit entries yet</p>
              </div>
            ) : auditEntries.slice(0, 5).map((e, i) => {
              return (
                <div key={e.entry_id} className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white hover:shadow-sm hover:scale-[1.01] border border-transparent hover:border-gray-100 cursor-default group">
                  <Tag label={e.event_type} colors={getTypeColor(e.event_type)} />
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full shrink-0 border border-gray-200 shadow-sm">Actor: {e.actor || "system"}</span>
                  <span className="text-sm font-semibold flex-1 truncate text-gray-700 group-hover:text-gray-900 transition-colors">{e.action}</span>
                  <span className="text-xs font-medium text-gray-400">{new Date(e.recorded_at).toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event breakdown */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden animate-slide-up shadow-sm border border-gray-100" style={{ animationDelay: "380ms" }}>
          <div className="px-6 py-4 border-b border-gray-100 bg-white/40">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
              <span className="text-sm font-black tracking-widest uppercase text-gray-800 font-display">Event Breakdown</span>
            </div>
          </div>
          <div className="p-6 h-[300px]">
            {Object.keys(auditEvents).length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm font-medium text-gray-400">No events recorded</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(auditEvents).map(([name, value]) => ({ name, value }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '13px', fontWeight: 600, padding: '12px' }} 
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {Object.entries(auditEvents).map(([name], index) => (
                      <Cell key={`cell-${index}`} fill={getTypeColor(name).fg} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
