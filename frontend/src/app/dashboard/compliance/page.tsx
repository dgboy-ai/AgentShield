"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

interface ComplianceReport {
  report_id: string;
  total_events: number;
  events_by_type: Record<string, number>;
  hash_chain: Record<string, unknown>;
  constraint_summary: Record<string, unknown>;
  alert_summary: Record<string, unknown>;
  retention_years: number;
  compliance_status: string;
  article_12_satisfied: boolean;
  generated_at: string;
}

export default function CompliancePage() {
  const { token } = useAuth();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const data = await api.complianceReport(token);
      setReport(data as unknown as ComplianceReport);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load compliance report");
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (fetching) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="h-12 w-60 rounded-2xl animate-pulse" style={{ background: "rgba(0,0,0,0.04)" }} />
        <div className="flex gap-3">
          <div className="h-8 w-48 rounded-full animate-pulse" style={{ background: "rgba(0,0,0,0.04)" }} />
          <div className="h-8 w-40 rounded-full animate-pulse" style={{ background: "rgba(0,0,0,0.04)" }} />
        </div>
        <div className="grid grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "rgba(0,0,0,0.03)" }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 animate-fade-in">
        <h1 className="text-4xl font-black font-display tracking-tight">Compliance</h1>
        <div className="glass-card rounded-2xl p-10 text-center" style={{ background: "rgba(194,59,59,0.04)", border: "1px solid rgba(194,59,59,0.12)" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#C23B3B" }}>{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "rgba(0,0,0,0.04)" }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-4xl font-black font-display tracking-tight">Compliance</h1>
        <p className="mt-2 text-base font-medium" style={{ color: "#5A5248" }}>
          EU AI Act Article 12 compliance report
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold font-display tracking-wide" style={report.article_12_satisfied ? {
          background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)"
        } : {
          background: "rgba(194,59,59,0.1)", color: "#C23B3B", border: "1px solid rgba(194,59,59,0.2)"
        }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          Article 12: {report.article_12_satisfied ? "Satisfied" : "Not Satisfied"}
        </div>
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold font-display tracking-wide" style={report.compliance_status === "COMPLIANT" ? {
          background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)"
        } : {
          background: "rgba(245,158,11,0.1)", color: "#D97706", border: "1px solid rgba(245,158,11,0.2)"
        }}>
          {report.compliance_status}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="glass-card rounded-2xl p-6">
          <div className="text-4xl font-black font-display tracking-tight">{report.total_events}</div>
          <div className="text-sm font-bold mt-1" style={{ color: "#5A5248" }}>Total Events</div>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <div className="text-4xl font-black font-display tracking-tight">{report.retention_years}yr</div>
          <div className="text-sm font-bold mt-1" style={{ color: "#5A5248" }}>Retention</div>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <div className="text-[11px] font-mono truncate" style={{ color: "#7A7164" }}>{report.report_id}</div>
          <div className="text-sm font-bold mt-2" style={{ color: "#5A5248" }}>Report ID</div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: "#7A7164" }}>Hash Chain Integrity</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(report.hash_chain).map(([key, value]) => (
            <div key={key}>
              <div className="text-[11px] font-bold tracking-wider uppercase" style={{ color: "#7A7164" }}>{key}</div>
              <div className="text-sm font-mono font-medium mt-1" style={{ color: "#1A1A1A" }}>{String(value)}</div>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(report.events_by_type).length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: "#7A7164" }}>Events by Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(report.events_by_type).map(([eventType, count]) => (
              <div key={eventType} className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
                <div className="text-2xl font-black font-display" style={{ color: "#1A1A1A" }}>{count}</div>
                <div className="text-xs font-bold mt-1" style={{ color: "#7A7164" }}>{eventType}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xs font-bold tracking-[0.15em] uppercase mb-4" style={{ color: "#7A7164" }}>Constraint Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(report.constraint_summary).map(([key, value]) => (
            <div key={key}>
              <div className="text-[11px] font-bold tracking-wider uppercase" style={{ color: "#7A7164" }}>{key}</div>
              <div className="text-sm font-medium mt-1" style={{ color: "#1A1A1A" }}>{String(value)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs" style={{ color: "#7A7164" }}>
        Generated at: {new Date(report.generated_at).toLocaleString()}
      </div>
    </div>
  );
}
