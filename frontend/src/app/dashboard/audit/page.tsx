"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

interface AuditEntry {
  entry_id: string;
  event_type: string;
  actor: string;
  target: string;
  action: string;
  entry_hash: string;
  recorded_at: string;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  auth: { bg: "rgba(14,165,233,0.08)", text: "#0284C7", border: "rgba(14,165,233,0.15)" },
  constraint: { bg: "rgba(16,185,129,0.08)", text: "#059669", border: "rgba(16,185,129,0.15)" },
  memory: { bg: "rgba(139,92,246,0.08)", text: "#7C3AED", border: "rgba(139,92,246,0.15)" },
  scan: { bg: "rgba(245,158,11,0.08)", text: "#D97706", border: "rgba(245,158,11,0.15)" },
  default: { bg: "rgba(0,0,0,0.04)", text: "#5A5248", border: "rgba(0,0,0,0.08)" },
};

export default function AuditPage() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [timeline, setTimeline] = useState<Record<string, unknown>>({});
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const [t, cv] = await Promise.all([
        api.auditTimeline(token),
        api.auditVerify(token),
      ]);
      setTimeline(t);
      setChainValid((cv as Record<string, unknown>).valid as boolean);
      setEntries((t as Record<string, unknown>).entries as unknown as AuditEntry[] || []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load audit trail");
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const eventsByType = (timeline.events_by_type || {}) as Record<string, number>;

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-4xl font-black font-display tracking-tight">Audit Trail</h1>
        <p className="mt-2 text-base font-medium" style={{ color: "#5A5248" }}>
          Tamper-evident, hash-chained event log
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold font-display tracking-wide" style={chainValid ? {
          background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)"
        } : chainValid === null ? {
          background: "rgba(0,0,0,0.03)", color: "#7A7164", border: "1px solid rgba(0,0,0,0.06)"
        } : {
          background: "rgba(194,59,59,0.1)", color: "#C23B3B", border: "1px solid rgba(194,59,59,0.2)"
        }}>
          <div className="w-2 h-2 rounded-full" style={{
            background: chainValid ? "#059669" : chainValid === null ? "#7A7164" : "#C23B3B",
            animation: chainValid ? "pulse-ring 2.5s ease-in-out infinite" : "none"
          }} />
          Chain: {chainValid ? "Valid" : chainValid === null ? "Checking..." : "Broken"}
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-6 text-center" style={{ background: "rgba(194,59,59,0.04)", border: "1px solid rgba(194,59,59,0.12)" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#C23B3B" }}>{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "rgba(0,0,0,0.04)" }}>Retry</button>
        </div>
      )}

      {fetching && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(0,0,0,0.03)" }} />
          ))}
        </div>
      )}

      {!fetching && !error && Object.keys(eventsByType).length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: "#7A7164" }}>Events by Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(eventsByType).map(([eventType, count]) => {
              const style = EVENT_COLORS[eventType] || EVENT_COLORS.default;
              return (
                <div key={eventType} className="rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                  <div className="text-2xl font-black font-display" style={{ color: style.text }}>
                    {count as number}
                  </div>
                  <div className="text-xs font-bold mt-1" style={{ color: style.text }}>{eventType}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!fetching && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: "#7A7164" }}>Recent Events</h2>
          {entries.length === 0 && (
            <p className="text-sm text-center py-10" style={{ color: "#7A7164" }}>No audit entries yet</p>
          )}
          <div className="space-y-1">
            {entries.map((e, i) => {
              const style = EVENT_COLORS[e.event_type] || EVENT_COLORS.default;
              return (
                <div
                  key={e.entry_id}
                  className="flex items-center justify-between py-3 px-3 rounded-xl transition-all duration-200 hover:bg-white/40 animate-slide-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                      {e.event_type}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{e.action}</span>
                    <span className="text-[11px] font-mono hidden md:inline" style={{ color: "#7A7164" }}>
                      {e.entry_hash?.slice(0, 12)}...
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: "#7A7164" }}>
                    {new Date(e.recorded_at).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
