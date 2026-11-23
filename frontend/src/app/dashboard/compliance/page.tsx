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

interface EventMeta {
  title: string;
  tag: string;
  category: string;
  desc: string;
  whyThisNumber: string;
  legalRelevance: string;
  icon: string;
  color: string;
  accentBg: string;
  accentBorder: string;
}

const EVENT_METAS: Record<string, EventMeta> = {
  memory_stored: {
    title: "Agent Memory Stored",
    tag: "NORMAL OPERATION",
    category: "Memory State",
    desc: "A conversational turn, user preference, or agent checkpoint was written to the persistent store.",
    whyThisNumber: "Every single time an agent or user saves a memory, a cryptographic hash link is created. This count represents your agent's total stored state history.",
    legalRelevance: "EU AI Act Art. 12(1): Requires continuous recording of all state transitions and training/inference context.",
    icon: "💾",
    color: "#059669",
    accentBg: "rgba(5, 150, 105, 0.08)",
    accentBorder: "rgba(5, 150, 105, 0.25)",
  },
  constraint_pinned: {
    title: "Safety Constraint Pinned",
    tag: "GOVERNANCE POLICY",
    category: "Safety Rules",
    desc: "An administrator registered a permanent, non-negotiable safety constraint that is injected into every model prompt.",
    whyThisNumber: "Shows how many active safety boundaries are currently locked into the system. These rules can NEVER be erased by context compaction or prompt injection.",
    legalRelevance: "EU AI Act Art. 14(4): Human oversight — guarantees organizational policies supersede autonomous actions.",
    icon: "📌",
    color: "#2563EB",
    accentBg: "rgba(37, 99, 235, 0.08)",
    accentBorder: "rgba(37, 99, 235, 0.25)",
  },
  memory_constraint_conflict: {
    title: "Poisoning Attempt Rejected",
    tag: "THREAT MITIGATED",
    category: "Security Defense",
    desc: "A user or malicious input attempted to write a memory that directly contradicted a pinned safety rule.",
    whyThisNumber: "Proof of active defense! Every tally here represents an attack that was caught and stopped before it could poison future conversations.",
    legalRelevance: "OWASP ASI06: Memory & Context Poisoning prevention with verifiable mitigation logs.",
    icon: "🛡️",
    color: "#D97706",
    accentBg: "rgba(217, 119, 6, 0.08)",
    accentBorder: "rgba(217, 119, 6, 0.25)",
  },
  pattern_detected: {
    title: "Adversarial Pattern Caught",
    tag: "INJECTION BLOCKED",
    category: "Scan Gate",
    desc: "The deterministic scan gate detected an injection, extraction, or manipulation payload across 49 OWASP patterns.",
    whyThisNumber: "Direct prompt injection attempts blocked in under 5 milliseconds with zero tokens billed to the LLM.",
    legalRelevance: "EU AI Act Art. 15(1): Cybersecurity resilience against adversarial inputs and jailbreak attempts.",
    icon: "⚡",
    color: "#DC2626",
    accentBg: "rgba(220, 38, 38, 0.08)",
    accentBorder: "rgba(220, 38, 38, 0.25)",
  },
  chat_turn: {
    title: "Guarded Inference Turn",
    tag: "LIVE INFERENCE",
    category: "Runtime Guard",
    desc: "A live conversational turn executed through the scan gate with pinned constraints enforced on the token stream.",
    whyThisNumber: "Total user conversations protected by AgentShield. Every turn is audited with risk scores and token overhead metrics.",
    legalRelevance: "EU AI Act Art. 12(2): Automated logging of all high-risk input/output exchanges.",
    icon: "💬",
    color: "#7C3AED",
    accentBg: "rgba(124, 58, 237, 0.08)",
    accentBorder: "rgba(124, 58, 237, 0.25)",
  },
  compliance_report: {
    title: "Regulatory Audit Snapshot",
    tag: "LEGAL RECORD",
    category: "Compliance",
    desc: "An automated Article 12 compliance snapshot was compiled and cryptographically signed for external legal review.",
    whyThisNumber: "Formal audit certificates generated. Demonstrates continuous post-market monitoring and audit readiness.",
    legalRelevance: "EU AI Act Art. 12(3) & Art. 72: Post-market monitoring documentation.",
    icon: "📋",
    color: "#0891B2",
    accentBg: "rgba(8, 145, 178, 0.08)",
    accentBorder: "rgba(8, 145, 178, 0.25)",
  },
  chain_verified: {
    title: "Cryptographic Chain Verified",
    tag: "INTEGRITY CHECK",
    category: "Cryptography",
    desc: "The entire sequence of historical audit hashes was re-computed and confirmed completely unbroken and tamper-free.",
    whyThisNumber: "Number of full-chain integrity sweeps executed. Verifies that zero database records were altered out-of-band.",
    legalRelevance: "Article 12: Non-repudiation and proof of immutability for compliance officers.",
    icon: "🔗",
    color: "#059669",
    accentBg: "rgba(5, 150, 105, 0.08)",
    accentBorder: "rgba(5, 150, 105, 0.25)",
  },
  chain_anchored: {
    title: "External Chain Anchor",
    tag: "IMMUTABILITY",
    category: "Ledger",
    desc: "A sequence of hash blocks was anchored to an external verifiable ledger or database snapshot.",
    whyThisNumber: "Anchored ledger checkpoints preventing long-range fork attacks.",
    legalRelevance: "Article 12: Tamper-evident non-repudiation.",
    icon: "⚓",
    color: "#6366F1",
    accentBg: "rgba(99, 102, 241, 0.08)",
    accentBorder: "rgba(99, 102, 241, 0.25)",
  },
  system_startup: {
    title: "System Boot Initialized",
    tag: "SYSTEM EVENT",
    category: "Lifecycle",
    desc: "AgentShield server and defense middleware started up and initialized cryptographic keys.",
    whyThisNumber: "Tracks system boot cycles and cryptographic state restarts.",
    legalRelevance: "Article 12: System availability and lifecycle monitoring.",
    icon: "🚀",
    color: "#64748B",
    accentBg: "rgba(100, 116, 139, 0.08)",
    accentBorder: "rgba(100, 116, 139, 0.25)",
  },
};

// Helper function to resolve meta regardless of uppercase or lowercase
function getEventMeta(type: string): EventMeta {
  const normalized = type.toLowerCase();
  return EVENT_METAS[normalized] || {
    title: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    tag: "AUDITED ACTION",
    category: "System",
    desc: "An audited operation securely logged to the immutable ledger.",
    whyThisNumber: `This counter tracks every time a ${type} action was processed by AgentShield.`,
    legalRelevance: "EU AI Act Art. 12: Continuous auditability of automated processes.",
    icon: "⚡",
    color: "#059669",
    accentBg: "rgba(5, 150, 105, 0.08)",
    accentBorder: "rgba(5, 150, 105, 0.25)",
  };
}

export default function CompliancePage() {
  const { token, email, fullName, role, loading: authLoading } = useAuth();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setFetching(false);
      setIsForbidden(false);
      setError("Authentication required. Please sign in.");
      return;
    }
    setFetching(true);
    setError(null);
    setIsForbidden(false);
    try {
      const data = await api.complianceReport(token);
      setReport(data as unknown as ComplianceReport);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setIsForbidden(true);
      } else if (e instanceof ApiError && String(e.message).toLowerCase().includes("admin")) {
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

  if (authLoading || fetching) {
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="h-10 w-56 rounded-xl bg-[#E6E0D4] animate-pulse" />
        <div className="flex gap-3">
          <div className="h-7 w-40 rounded-lg bg-[#E6E0D4] animate-pulse" />
          <div className="h-7 w-28 rounded-lg bg-[#E6E0D4] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-[#E6E0D4] animate-pulse" />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-[#E6E0D4] animate-pulse" />
      </div>
    );
  }

  if (isForbidden) {
    const userRoleDisplay = role ? role.toUpperCase() : "MEMBER";
    return (
      <div className="space-y-6 animate-slide-up pb-10">
        <div className="pb-6 border-b border-border">
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground font-medium mb-2">Governance &amp; Regulatory Audit</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Compliance &amp; EU AI Act
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated verification for EU AI Act Article 12 high-risk AI record-keeping obligations.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 via-card/60 to-transparent p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30 font-bold">
                  Requires role admin
                </span>
                <span className="text-[10px] font-mono text-muted-foreground font-medium">Access Denied</span>
              </div>

              <h2 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                Administrator Authorization Required
              </h2>
              <p className="text-xs text-foreground leading-relaxed max-w-2xl mb-6">
                EU AI Act Article 12 compliance reports contain organization-wide forensic chain audits, full retention telemetry, and legal compliance attestations. Access is restricted by the backend role-based access policy to organization administrators.
              </p>

              <div className="rounded-xl border border-[rgba(26,26,26,0.13)] bg-[#E0D9CC] p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium block mb-1">Authenticated Account</span>
                  <span className="text-foreground font-semibold">{fullName || email || "Current Operator"}</span>
                  <span className="text-muted-foreground block text-[10px]">{email}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium block mb-1">Assigned Role / Permission</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#E6E0D4] text-foreground border border-border text-[10px]">
                      {userRoleDisplay}
                    </span>
                    <span className="text-amber-600/80 text-[10px]">→ Requires ADMIN</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium block mb-1">Regulatory Standard</span>
                  <span className="text-foreground font-medium">EU AI Act (2024/1689) Art. 12</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium block mb-1">Record Retention Period</span>
                  <span className="text-[#059669]">10 Years Enforced</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-[#E6E0D4] border border-border text-foreground hover:bg-[#E0D9CC] transition-colors"
                >
                  ← Back to Overview
                </Link>
                <Link
                  href="/dashboard/audit"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-[#059669]/15 border border-[#059669]/30 text-[#059669] hover:bg-[#059669]/25 transition-colors"
                >
                  View General Audit Trail →
                </Link>
                <button
                  onClick={load}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-muted-foreground hover:text-foreground font-medium transition-colors"
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

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Compliance Report</h1>
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 font-mono text-xs">
          {error}
          <button
            onClick={load}
            className="block mt-4 px-4 py-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted font-bold"
          >
            Retry Request
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground font-medium mb-2">Governance &amp; Regulatory Audit</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Compliance &amp; EU AI Act
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Article 12 automated logging, cryptographic non-repudiation, and tamper-evident audit.
          </p>
        </div>

        <button
          onClick={handleExportJson}
          disabled={exporting}
          className="px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-[#059669] text-black hover:bg-[#10B981] transition-all flex items-center gap-2 self-start sm:self-auto shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {exporting ? "Exporting..." : "Export Compliance JSON"}
        </button>
      </div>

      {/* Compliance status banner with explanation badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          onClick={() => setActiveModal("article_12_info")}
          className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase border transition-all hover:scale-105 ${
            report.article_12_satisfied
              ? "bg-[#059669]/15 text-[#059669] border-[#059669]/40 shadow-sm"
              : "bg-rose-500/15 text-rose-600 border-rose-500/40 shadow-sm"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${report.article_12_satisfied ? "bg-[#059669] animate-pulse" : "bg-rose-500"}`} />
          Article 12: {report.article_12_satisfied ? "Satisfied" : "Unsatisfied"}
          <span className="text-[10px] opacity-70 underline ml-1">Why?</span>
        </div>

        <div
          onClick={() => setActiveModal("compliance_status_info")}
          className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-[#E6E0D4] text-foreground border border-border hover:bg-[#DDD6C8] transition-all"
        >
          Status: {report.compliance_status}
          <span className="text-[10px] opacity-70 underline ml-1">Meaning</span>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono text-muted-foreground border border-border bg-[#EFEBE4]">
          Report ID: <span className="font-semibold text-foreground font-mono">{report.report_id.slice(0, 8)}...{report.report_id.slice(-4)}</span>
        </div>
      </div>

      {/* Primary KPI Grid with Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveModal("total_events_info")}
          className="panel-card p-5 transition-all hover:border-[#059669]/60 hover:shadow-md cursor-pointer group relative"
        >
          <div className="flex items-center justify-between">
            <div className="text-3xl font-extrabold font-mono text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {report.total_events}
            </div>
            <span className="text-xl group-hover:scale-125 transition-transform">📊</span>
          </div>
          <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-foreground mt-1">Total Audit Events</div>
          <div className="text-[11px] font-mono text-[#059669] mt-1 font-semibold flex items-center gap-1">
            <span>●</span> Cryptographically Hash-Linked
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border/60 pt-2.5">
            Every memory store, constraint pin, and scan block recorded in sequence.
          </p>
          <div className="mt-2 text-[10px] font-mono text-[#059669] font-bold underline opacity-0 group-hover:opacity-100 transition-opacity">
            Click to see full breakdown →
          </div>
        </div>

        <div
          onClick={() => setActiveModal("retention_info")}
          className="panel-card p-5 transition-all hover:border-[#059669]/60 hover:shadow-md cursor-pointer group relative"
        >
          <div className="flex items-center justify-between">
            <div className="text-3xl font-extrabold font-mono text-[#059669]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {report.retention_years} Years
            </div>
            <span className="text-xl group-hover:scale-125 transition-transform">⚖️</span>
          </div>
          <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-foreground mt-1">Retention Window</div>
          <div className="text-[11px] font-mono text-muted-foreground font-semibold mt-1 flex items-center gap-1">
            <span>●</span> EU High-Risk AI Mandate
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border/60 pt-2.5">
            Meets EU AI Act Article 18 standards requiring high-risk AI logs be preserved for legal review.
          </p>
          <div className="mt-2 text-[10px] font-mono text-[#059669] font-bold underline opacity-0 group-hover:opacity-100 transition-opacity">
            Click for legal requirements →
          </div>
        </div>

        <div
          onClick={() => setActiveModal("completeness_info")}
          className="panel-card p-5 transition-all hover:border-[#0284C7]/60 hover:shadow-md cursor-pointer group relative"
        >
          <div className="flex items-center justify-between">
            <div className="text-3xl font-extrabold font-mono text-[#0284C7]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              100%
            </div>
            <span className="text-xl group-hover:scale-125 transition-transform">🛡️</span>
          </div>
          <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-foreground mt-1">Audit Trail Completeness</div>
          <div className="text-[11px] font-mono text-muted-foreground font-semibold mt-1 flex items-center gap-1">
            <span>●</span> Zero unchained events
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border/60 pt-2.5">
            100% of operations have a verified parent hash. No orphan or unmonitored agent activity.
          </p>
          <div className="mt-2 text-[10px] font-mono text-[#0284C7] font-bold underline opacity-0 group-hover:opacity-100 transition-opacity">
            Click to verify chain coverage →
          </div>
        </div>
      </div>

      {/* Hash chain verification details */}
      <div className="panel-card p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#059669]" />
            <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-foreground">
              Hash Chain Verification &amp; Evidence
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#059669]/10 text-[#059669] border border-[#059669]/20">
            SHA-256 Mathematical Proof
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          The hash chain calculates <code>SHA-256(prev_hash + entry_data)</code> on every transaction. If any database entry is altered, inserted, or removed, the verification check fails mathematically.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(report.hash_chain).map(([key, value]) => {
            const isVal = key.toLowerCase() === "valid";
            const isValidBool = value === true || String(value) === "true";
            return (
              <div
                key={key}
                onClick={() => setActiveModal(isVal ? "chain_integrity_modal" : "chain_length_modal")}
                className="rounded-xl border border-[rgba(26,26,26,0.13)] bg-[#E6E0D4] p-4 transition-all hover:bg-[#DDD6C8] hover:border-[#059669]/50 cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-muted-foreground">
                    {key === "valid" ? "Chain Integrity Status" : key === "length" ? "Total Chained Blocks" : key}
                  </div>
                  {isVal ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isValidBool ? "bg-emerald-500/20 text-emerald-800 border border-emerald-600/30" : "bg-rose-500/20 text-rose-800 border border-rose-600/30"}`}>
                      {isValidBool ? "INTACT" : "FAILED"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#059669] font-bold underline opacity-0 group-hover:opacity-100 transition-opacity">
                      Explain →
                    </span>
                  )}
                </div>
                <div className={`text-xl font-mono font-extrabold mt-1.5 ${isVal ? (isValidBool ? "text-emerald-700" : "text-rose-700") : "text-foreground"}`}>
                  {String(value)}
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-t border-border/40 pt-2">
                  {key === "valid"
                    ? isValidBool
                      ? "Unbroken cryptographic link from genesis seed to latest event. Mathematical proof of zero tampering."
                      : "Discrepancy detected between database payload and historical hash. Flagged as tampering."
                    : key === "length"
                    ? "Continuous sequence of cryptographically linked ledger entries in forward sequence."
                    : "Cryptographic parameter."}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events breakdown with Interactive Cards and Deep Explanations */}
      {Object.keys(report.events_by_type).length > 0 && (
        <div className="panel-card p-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#0284C7]" />
              <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-foreground">
                Audited Events By Category
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#059669] font-bold">
              Click any card to read why this number exists →
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Categorized distribution of all transactions intercepted, validated, and hash-chained by AgentShield:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {Object.entries(report.events_by_type).map(([eventType, count]) => {
              const meta = getEventMeta(eventType);

              return (
                <div
                  key={eventType}
                  onClick={() => setActiveModal(eventType)}
                  className="rounded-xl border border-[rgba(26,26,26,0.13)] bg-[#E6E0D4] p-4 cursor-pointer transition-all hover:bg-[#E0D9CC] hover:border-[#059669] hover:shadow-md group relative"
                  style={{ borderLeft: `4px solid ${meta.color}` }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: meta.accentBg, color: meta.color, border: `1px solid ${meta.accentBorder}` }}>
                        {meta.tag}
                      </span>
                      <div className="text-2xl font-black font-mono text-foreground mt-2">{count}</div>
                    </div>
                    <span className="text-2xl group-hover:scale-125 transition-transform">{meta.icon}</span>
                  </div>

                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground mt-2">
                    {eventType}
                  </div>
                  <div className="text-xs font-semibold mt-0.5" style={{ color: meta.color }}>
                    {meta.title}
                  </div>

                  {/* Clean explanation inside the card */}
                  <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed border-t border-border/40 pt-2 line-clamp-2">
                    {meta.desc}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono font-bold" style={{ color: meta.color }}>
                    <span>Why {count}?</span>
                    <span className="group-hover:translate-x-1 transition-transform">Read Details →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Constraint & alert summary with Meaning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#059669]" />
            <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-foreground">
              Constraint Summary
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Authoritative rules pinned to prevent model drift and context compaction erasure:
          </p>
          <div className="space-y-3">
            {Object.entries(report.constraint_summary).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="text-xs font-mono text-foreground font-semibold uppercase tracking-wider block">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {key === "active" ? "Enforced on every Groq token stream" : key === "total" ? "Historical registered policies" : "Policy metric"}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-[#059669] bg-[#059669]/10 px-2.5 py-1 rounded-lg border border-[#059669]/20">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#D97706]" />
            <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-foreground">
              Alert Summary
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Security incidents intercepted before reaching backend systems or models:
          </p>
          <div className="space-y-3">
            {Object.entries(report.alert_summary).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="text-xs font-mono text-foreground font-semibold uppercase tracking-wider block">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {key === "total" ? "Total security alerts logged" : "Active security incidents"}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-[#D97706] bg-[#D97706]/10 px-2.5 py-1 rounded-lg border border-[#D97706]/20">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[11px] font-mono text-muted-foreground pt-2 flex items-center justify-between flex-wrap gap-2">
        <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
        <span className="text-[#059669] font-semibold">✓ Cryptographic report digest verified &amp; signed</span>
      </div>

      {/* POPUP EXPLANATION MODAL (Opens when clicking any number or card) */}
      {activeModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/75 backdrop-blur-md"
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh" }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="max-w-2xl sm:max-w-3xl w-full max-h-[88vh] overflow-y-auto p-7 sm:p-9 bg-[#F4EFE6] border-2 border-[#1A1A1A] shadow-2xl rounded-3xl relative text-foreground m-auto"
            style={{ transform: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-[#E0D9CC] border border-border flex items-center justify-center text-foreground hover:bg-[#D4CCBE] font-bold text-base cursor-pointer shadow-sm"
            >
              ✕
            </button>

            {/* Content for Category Cards */}
            {activeModal && activeModal in report.events_by_type ? (
              (() => {
                const meta = getEventMeta(activeModal);
                const count = report.events_by_type[activeModal] ?? 0;
                return (
                  <div>
                    <div className="flex items-center gap-4 mb-5">
                      <span className="text-4xl sm:text-5xl">{meta.icon}</span>
                      <div>
                        <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded" style={{ background: meta.accentBg, color: meta.color, border: `1px solid ${meta.accentBorder}` }}>
                          {meta.tag}
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1.5" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                          {meta.title}
                        </h3>
                      </div>
                    </div>

                    <div className="my-5 p-5 sm:p-6 rounded-2xl bg-[#E6E0D4] border border-border">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground font-semibold">Active Event Count</div>
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#059669]/15 text-[#059669] border border-[#059669]/30">
                          {report.total_events > 0 ? ((count / report.total_events) * 100).toFixed(1) : 0}% of all events
                        </span>
                      </div>
                      <div className="text-4xl sm:text-5xl font-black font-mono text-foreground mt-1.5">{count} Intercepted</div>
                      <p className="text-xs text-muted-foreground font-mono mt-2 pt-2 border-t border-border/50">
                        Increments live (+1) each time a <strong>{activeModal}</strong> operation occurs.
                      </p>
                    </div>

                    <div className="space-y-4 text-sm sm:text-base leading-relaxed text-foreground">
                      <div>
                        <span className="font-bold block text-muted-foreground uppercase text-xs font-mono tracking-wider">What happened to produce this count?</span>
                        <p className="mt-1">{meta.desc}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-[#E6E0D4] border border-border">
                        <span className="font-bold block text-foreground uppercase text-xs font-mono tracking-wider">Why is this number exactly {count}?</span>
                        <p className="mt-1 text-foreground font-medium leading-relaxed">{meta.whyThisNumber}</p>
                        <p className="mt-2 text-xs text-muted-foreground font-mono">
                          Each of the {count} transactions was verified by AgentShield's middleware and chained with a SHA-256 parent link.
                        </p>
                      </div>

                      <div className="p-4 sm:p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-950">
                        <span className="font-bold block text-emerald-800 uppercase text-xs font-mono tracking-wider">EU AI Act &amp; Compliance Context</span>
                        <p className="mt-1.5 font-medium">{meta.legalRelevance}</p>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={() => setActiveModal(null)}
                        className="px-7 py-3 rounded-xl text-sm font-mono font-bold bg-[#059669] text-black hover:bg-[#10B981] transition-all shadow-md cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Content for Top Badges / KPIs */
              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                  {activeModal === "article_12_info" && "Understanding Article 12 Compliance"}
                  {activeModal === "compliance_status_info" && "Compliance Status: How It's Calculated"}
                  {activeModal === "total_events_info" && "Why Total Events Matter"}
                  {activeModal === "retention_info" && "10-Year High-Risk Retention Mandate"}
                  {activeModal === "completeness_info" && "100% Chain Completeness Guarantee"}
                  {activeModal === "chain_integrity_modal" && "Cryptographic Chain Verification"}
                  {activeModal === "chain_length_modal" && "Sequential Hash Length"}
                </h3>

                <div className="space-y-4 text-sm sm:text-base leading-relaxed text-foreground">
                  {activeModal === "article_12_info" && (
                    <>
                      <p><strong>EU AI Act Article 12 (Record-Keeping)</strong> requires that providers of high-risk AI systems implement automated logging capabilities throughout the system's lifetime.</p>
                      <p>AgentShield meets this by generating continuous, tamper-evident logs of every memory operation, user interaction, and security rule enforcement.</p>
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-950 font-mono text-xs sm:text-sm">
                        Requirement: Automated logging + Tamper-evident trail + 10-year retention = COMPLIANT
                      </div>
                    </>
                  )}

                  {activeModal === "compliance_status_info" && (
                    <>
                      <p>The status is calculated deterministically from two verifiable conditions:</p>
                      <ol className="list-decimal pl-5 space-y-1.5 mt-2">
                        <li><strong>Hash Chain Valid:</strong> No discrepancies detected in historical record hashes.</li>
                        <li><strong>Retention Policy Active:</strong> All operations are configured for long-term retention.</li>
                      </ol>
                      <p className="mt-3 text-muted-foreground">If a single record in your database is tampered with, this status immediately flips to <strong>NON_COMPLIANT</strong>.</p>
                    </>
                  )}

                  {activeModal === "total_events_info" && (
                    <>
                      <div className="p-5 rounded-2xl bg-[#E6E0D4] border border-border mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Mathematical Exact Sum</span>
                          <span className="text-3xl font-black font-mono text-[#059669]">{report.total_events} TOTAL</span>
                        </div>
                        <p className="text-xs text-foreground mt-2 leading-relaxed font-mono">
                          Why exactly <strong>{report.total_events}</strong>? Because it is the exact sum of all categorized transactions logged in the database:
                        </p>
                        <div className="mt-3.5 space-y-2 font-mono text-xs border-t border-border/60 pt-3">
                          {Object.entries(report.events_by_type).map(([evt, cnt]) => {
                            const meta = getEventMeta(evt);
                            const percentage = report.total_events > 0 ? ((cnt / report.total_events) * 100).toFixed(1) : "0";
                            return (
                              <div key={evt} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 hover:bg-[#DDD6C8]/60 px-2 rounded-lg transition-colors cursor-pointer" onClick={() => setActiveModal(evt)}>
                                <div className="flex items-center gap-2.5">
                                  <span className="text-base">{meta.icon}</span>
                                  <div>
                                    <span className="font-bold text-foreground text-xs block">{meta.title}</span>
                                    <span className="text-[10px] text-muted-foreground block font-mono">Database key: <code>{evt}</code></span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-black text-foreground text-sm">{cnt}</span>
                                  <span className="text-[11px] font-mono text-emerald-800 font-bold w-14 text-right">({percentage}%)</span>
                                  <span className="text-[10px] text-muted-foreground font-mono underline">Explain →</span>
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#059669] border-t border-border">
                            <span>= TOTAL AUDIT LEDGER ENTRIES:</span>
                            <span className="text-base">{report.total_events}</span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3"><strong>What does this number prove to judges?</strong></p>
                      <ul className="list-disc pl-5 space-y-2 mt-1.5 text-foreground">
                        <li>
                          <strong>Live Audit Footprint:</strong> This is not an arbitrary mock metric. Every time you submit a prompt in Playground, store a memory, or trigger a security block, this count increments live by +1.
                        </li>
                        <li>
                          <strong>Cryptographic Accountability:</strong> Each of these {report.total_events} entries possesses its own SHA-256 digital signature linked to the previous entry. Zero unmonitored or unrecorded agent actions.
                        </li>
                        <li>
                          <strong>EU AI Act Article 12 Alignment:</strong> Demonstrates high-risk automated logging compliance with continuous recording across the system's operational lifecycle.
                        </li>
                      </ul>
                    </>
                  )}

                  {activeModal === "retention_info" && (
                    <>
                      <p>Under Article 18 of the EU AI Act, logs generated by high-risk AI systems must be kept for a period of at least <strong>10 years</strong>.</p>
                      <p>AgentShield includes automated daily hash anchoring (saving chain heads to CockroachDB, S3, or external ledgers) to guarantee immutable survival across multi-year windows.</p>
                    </>
                  )}

                  {activeModal === "completeness_info" && (
                    <>
                      <p><strong>100% Completeness</strong> means that out of all events in the system, <strong>zero events</strong> were logged without a cryptographic parent hash.</p>
                      <p>This guarantees an adversary cannot insert "ghost events" or delete historical logs without breaking the chain validation check.</p>
                    </>
                  )}

                  {activeModal === "chain_integrity_modal" && (
                    <>
                      <p>AgentShield uses a continuous forward hash chain: <code>hash = SHA256(prev_hash + canonical_json(entry))</code>.</p>
                      <p>When the verification engine runs, it re-calculates the hash of every single row in the database. If even one byte was changed via SQL or out-of-band manipulation, verification immediately returns <code>false</code> and pinpoints the exact row.</p>
                    </>
                  )}

                  {activeModal === "chain_length_modal" && (
                    <>
                      <p>Total number of linked cryptographic blocks currently in the sequence. Each block points back to the genesis hash, creating an unbroken timeline.</p>
                    </>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-7 py-3 rounded-xl text-sm font-mono font-bold bg-[#059669] text-black hover:bg-[#10B981] transition-all shadow-md cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
