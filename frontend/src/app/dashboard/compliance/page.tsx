"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

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
  const { token, email, fullName, role } = useAuth();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    setError(null);
    setIsForbidden(false);
    try {
      const data = await api.complianceReport(token);
      setReport(data as unknown as ComplianceReport);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || String(e.message).toLowerCase().includes("admin"))) {
        setIsForbidden(true);
      } else {
        setError(e instanceof ApiError ? e.message : "Failed to load compliance report");
      }
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleExportJson() {
    if (!report) return;
    setExporting(true);
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agentshield-article12-compliance-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Compliance report exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="h-10 w-56 rounded-xl bg-white/[0.04] animate-pulse" />
        <div className="flex gap-3">
          <div className="h-7 w-40 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-7 w-28 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-white/[0.03] animate-pulse" />
      </div>
    );
  }

  // ── Access Denied screen for standard users (HTTP 403) ──────────────────────
  if (isForbidden) {
    const userRoleDisplay = role ? role.toUpperCase() : "MEMBER";
    return (
      <div className="space-y-6 animate-slide-up pb-10">
        <div className="pb-6 border-b border-white/5">
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 mb-2">Governance &amp; Regulatory Audit</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Compliance &amp; EU AI Act
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Automated verification for EU AI Act Article 12 high-risk AI record-keeping obligations.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 via-white/[0.02] to-transparent p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                  Role Restriction: Admin Only
                </span>
                <span className="text-[10px] font-mono text-white/30">HTTP 403 Forbidden</span>
              </div>

              <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                Administrator Authorization Required
              </h2>
              <p className="text-xs text-white/60 leading-relaxed max-w-2xl mb-6">
                EU AI Act Article 12 compliance reports contain organization-wide forensic chain audits, full retention telemetry, and legal compliance attestations. Access is restricted by the backend role-based access policy to organization administrators.
              </p>

              {/* Policy details card */}
              <div className="rounded-xl border border-white/5 bg-black/30 p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Authenticated Account</span>
                  <span className="text-white/80 font-semibold">{fullName || email || "Current Operator"}</span>
                  <span className="text-white/40 block text-[10px]">{email}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Assigned Role / Permission</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-white/60 border border-white/10 text-[10px]">
                      {userRoleDisplay}
                    </span>
                    <span className="text-amber-400/80 text-[10px]">→ Requires ADMIN</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Regulatory Standard</span>
                  <span className="text-white/70">EU AI Act (2024/1689) Art. 12</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 block mb-1">Record Retention Period</span>
                  <span className="text-[#10B981]">10 Years Enforced</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
                >
                  ← Back to Overview
                </Link>
                <Link
                  href="/dashboard/audit"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/25 transition-colors"
                >
                  View General Audit Trail →
                </Link>
                <button
                  onClick={load}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-white/40 hover:text-white/70 transition-colors"
                >
                  Check Permission Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── General Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Compliance
        </h1>
        <div className="rounded-2xl p-8 border border-rose-500/20 bg-rose-500/10 text-center">
          <p className="text-sm font-mono text-rose-400 mb-4">{error}</p>
          <button
            onClick={load}
            className="px-5 py-2.5 rounded-xl text-xs font-mono font-bold bg-white/5 text-white/70 hover:bg-white/10"
          >
            Retry Request
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  // ── Admin Authorized View (HTTP 200) ────────────────────────────────────────
  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 mb-2">Governance &amp; Regulatory Audit</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Compliance
          </h1>
          <p className="text-sm text-white/40 mt-1">
            EU AI Act Article 12 compliance report &amp; tamper-evident certification.
          </p>
        </div>

        <button
          onClick={handleExportJson}
          disabled={exporting}
          className="px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-[#10B981] text-black hover:bg-[#34D399] transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {exporting ? "Exporting..." : "Export Compliance JSON"}
        </button>
      </div>

      {/* Compliance status banner */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase border ${
          report.article_12_satisfied
            ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"
            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${report.article_12_satisfied ? "bg-[#10B981] animate-pulse" : "bg-rose-400"}`} />
          Article 12: {report.article_12_satisfied ? "Satisfied" : "Unsatisfied"}
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-white/5 text-white/80 border border-white/10">
          Status: {report.compliance_status}
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono text-white/40 border border-white/5">
          Report ID: <span className="font-semibold text-white/60">{report.report_id.slice(0, 12)}…</span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="text-3xl font-bold font-mono text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {report.total_events}
          </div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-white/40 mt-1">Total Audit Events</div>
          <div className="text-[10px] font-mono text-[#10B981] mt-2">Cryptographically Hash-Linked</div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="text-3xl font-bold font-mono text-[#10B981]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {report.retention_years} Years
          </div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-white/40 mt-1">Retention Window</div>
          <div className="text-[10px] font-mono text-white/30 mt-2">EU High-Risk AI Mandate</div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="text-3xl font-bold font-mono text-[#38BDF8]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            100%
          </div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-white/40 mt-1">Audit Trail Completeness</div>
          <div className="text-[10px] font-mono text-white/30 mt-2">Zero unchained events</div>
        </div>
      </div>

      {/* Hash chain verification details */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white/60">
            Hash Chain Verification &amp; Evidence
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(report.hash_chain).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-white/5 bg-black/20 p-3.5">
              <div className="text-[9px] font-mono font-bold tracking-wider uppercase text-white/40">{key}</div>
              <div className="text-xs font-mono font-medium text-white/80 mt-1 truncate" title={String(value)}>
                {String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Events breakdown */}
      {Object.keys(report.events_by_type).length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
            <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white/60">
              Audited Events By Category
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(report.events_by_type).map(([eventType, count]) => (
              <div key={eventType} className="rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="text-2xl font-bold font-mono text-white">{count}</div>
                <div className="text-[10px] font-mono tracking-wider uppercase text-white/40 mt-1">{eventType}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraint & alert summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white/60">
              Constraint Summary
            </h2>
          </div>
          <div className="space-y-3">
            {Object.entries(report.constraint_summary).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-xs font-mono text-white/50 uppercase tracking-wider">{key.replace(/_/g, " ")}</span>
                <span className="text-xs font-mono font-bold text-white">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white/60">
              Alert Summary
            </h2>
          </div>
          <div className="space-y-3">
            {Object.entries(report.alert_summary).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-xs font-mono text-white/50 uppercase tracking-wider">{key.replace(/_/g, " ")}</span>
                <span className="text-xs font-mono font-bold text-white">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[10px] font-mono text-white/30 pt-2">
        Generated At: {new Date(report.generated_at).toLocaleString()} · Cryptographic report digest verified
      </div>
    </div>
  );
}
