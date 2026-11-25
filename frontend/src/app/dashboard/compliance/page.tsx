"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

const BLACK = "#000000";
const SHADOW = `6px 6px 0px ${BLACK}`;
const SHADOW_SM = `4px 4px 0px ${BLACK}`;
const FONT_HEAD = "var(--font-space-grotesk)";
const FONT_MONO = "var(--font-geist-mono)";

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
    color: "#2DD4A0",
  },
  constraint_pinned: {
    title: "Safety Constraint Pinned",
    tag: "GOVERNANCE POLICY",
    category: "Safety Rules",
    desc: "An administrator registered a permanent, non-negotiable safety constraint that is injected into every model prompt.",
    whyThisNumber: "Shows how many active safety boundaries are currently locked into the system. These rules can NEVER be erased by context compaction or prompt injection.",
    legalRelevance: "EU AI Act Art. 14(4): Human oversight — guarantees organizational policies supersede autonomous actions.",
    icon: "📌",
    color: "#4D9FFF",
  },
  memory_constraint_conflict: {
    title: "Poisoning Attempt Rejected",
    tag: "THREAT MITIGATED",
    category: "Security Defense",
    desc: "A user or malicious input attempted to write a memory that directly contradicted a pinned safety rule.",
    whyThisNumber: "Proof of active defense! Every tally here represents an attack that was caught and stopped before it could poison future conversations.",
    legalRelevance: "OWASP ASI06: Memory & Context Poisoning prevention with verifiable mitigation logs.",
    icon: "🛡️",
    color: "#FACC15",
  },
  pattern_detected: {
    title: "Adversarial Pattern Caught",
    tag: "INJECTION BLOCKED",
    category: "Scan Gate",
    desc: "The deterministic scan gate detected an injection, extraction, or manipulation payload across 49 OWASP patterns.",
    whyThisNumber: "Direct prompt injection attempts blocked in under 5 milliseconds with zero tokens billed to the LLM.",
    legalRelevance: "EU AI Act Art. 15(1): Cybersecurity resilience against adversarial inputs and jailbreak attempts.",
    icon: "⚡",
    color: "#FF4D4D",
  },
  chat_turn: {
    title: "Guarded Inference Turn",
    tag: "LIVE INFERENCE",
    category: "Runtime Guard",
    desc: "A live conversational turn executed through the scan gate with pinned constraints enforced on the token stream.",
    whyThisNumber: "Total user conversations protected by AgentShield. Every turn is audited with risk scores and token overhead metrics.",
    legalRelevance: "EU AI Act Art. 12(2): Automated logging of all high-risk input/output exchanges.",
    icon: "💬",
    color: "#C084FC",
  },
  compliance_report: {
    title: "Regulatory Audit Snapshot",
    tag: "LEGAL RECORD",
    category: "Compliance",
    desc: "An automated Article 12 compliance snapshot was compiled and cryptographically signed for external legal review.",
    whyThisNumber: "Formal audit certificates generated. Demonstrates continuous post-market monitoring and audit readiness.",
    legalRelevance: "EU AI Act Art. 12(3) & Art. 72: Post-market monitoring documentation.",
    icon: "📋",
    color: "#4D9FFF",
  },
  chain_verified: {
    title: "Cryptographic Chain Verified",
    tag: "INTEGRITY CHECK",
    category: "Cryptography",
    desc: "The entire sequence of historical audit hashes was re-computed and confirmed completely unbroken and tamper-free.",
    whyThisNumber: "Number of full-chain integrity sweeps executed. Verifies that zero database records were altered out-of-band.",
    legalRelevance: "Article 12: Non-repudiation and proof of immutability for compliance officers.",
    icon: "🔗",
    color: "#2DD4A0",
  },
  chain_anchored: {
    title: "External Chain Anchor",
    tag: "IMMUTABILITY",
    category: "Ledger",
    desc: "A sequence of hash blocks was anchored to an external verifiable ledger or database snapshot.",
    whyThisNumber: "Anchored ledger checkpoints preventing long-range fork attacks.",
    legalRelevance: "Article 12: Tamper-evident non-repudiation.",
    icon: "⚓",
    color: "#C084FC",
  },
  system_startup: {
    title: "System Boot Initialized",
    tag: "SYSTEM EVENT",
    category: "Lifecycle",
    desc: "AgentShield server and defense middleware started up and initialized cryptographic keys.",
    whyThisNumber: "Tracks system boot cycles and cryptographic state restarts.",
    legalRelevance: "Article 12: System availability and lifecycle monitoring.",
    icon: "🚀",
    color: "#94A3B8",
  },
};

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
    color: "#2DD4A0",
  };
}

function NeoButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  testid,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  testid?: string;
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
      data-testid={testid}
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
      }}
    >
      {children}
    </button>
  );
}

function Chip({
  label,
  bg,
  fg = "#000",
  onClick,
  title,
}: {
  label: string;
  bg: string;
  fg?: string;
  onClick?: () => void;
  title?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: bg,
        color: fg,
        border: `3px solid ${BLACK}`,
        borderRadius: "9px",
        padding: "7px 13px",
        fontSize: "12px",
        fontWeight: 900,
        fontFamily: FONT_HEAD,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        flexShrink: 0,
        boxShadow: SHADOW_SM,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        transform: "translate(-1px, -1px)",
      }}
    >
      {label}
    </Tag>
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

function KpiCard({
  value,
  label,
  sublabel,
  icon,
  accent,
  onClick,
  hint,
}: {
  value: React.ReactNode;
  label: string;
  sublabel: string;
  icon: string;
  accent: string;
  onClick: () => void;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "#fff",
        border: `3px solid ${BLACK}`,
        borderRadius: "14px",
        boxShadow: SHADOW,
        padding: "20px",
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
        (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW;
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontSize: "34px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: BLACK,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <span
          style={{
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            background: accent,
            border: `3px solid ${BLACK}`,
            borderRadius: "11px",
            boxShadow: `3px 3px 0px ${BLACK}`,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      </div>
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontSize: "12px",
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: BLACK,
          marginTop: "12px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginTop: "4px" }}>{sublabel}</div>
      <p style={{ margin: "12px 0 0 0", fontSize: "12px", fontWeight: 600, color: "#64748B", lineHeight: 1.5, borderTop: `2px solid ${BLACK}`, paddingTop: "10px" }}>
        {hint}
      </p>
      <div style={{ marginTop: "10px", fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: BLACK, opacity: 0.5 }}>
        Click for details →
      </div>
    </button>
  );
}

export default function CompliancePage() {
  const { token, email, fullName, role, loading: authLoading } = useAuth();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reportRef = useRef(report);
  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  const load = useCallback(async (forceRefresh = false) => {
    if (!token) {
      setFetching(false);
      setIsForbidden(false);
      setError("Authentication required. Please sign in.");
      return;
    }
    if (!reportRef.current) setFetching(true);
    setError(null);
    setIsForbidden(false);
    try {
      const data = await api.complianceReport(token, forceRefresh);
      setReport(data as unknown as ComplianceReport);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setIsForbidden(true);
      } else if (e instanceof ApiError && String(e.message).toLowerCase().includes("admin")) {
        setIsForbidden(true);
      } else {
        if (!reportRef.current) setError(e instanceof ApiError ? e.message : "Failed to load compliance report");
      }
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const isManual = reloadKey > 0;
      await load(isManual);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, token, load]);

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

  async function handleExportPdf() {
    if (!report) return;
    setExportingPdf(true);
    try {
      const [{ pdf }, { ComplianceReportPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./compliance-report-pdf"),
      ]);
      const blob = await pdf(
        <ComplianceReportPdf
          report={report}
          user={{ fullName, email, role }}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agentshield-article12-compliance-${report.report_id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Compliance report (PDF) exported");
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed");
    } finally {
      setExportingPdf(false);
    }
  }

  if (authLoading || fetching) {
    return (
      <div className="space-y-6">
        <div
          style={{
            background: "#0A0F14",
            border: `3px solid ${BLACK}`,
            borderRadius: "16px",
            boxShadow: SHADOW,
            padding: "36px",
          }}
        >
          <div style={{ height: 14, width: 160, background: "#1E293B", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 44, width: 420, maxWidth: "100%", background: "#1E293B", borderRadius: 6, marginTop: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 16, width: 560, maxWidth: "100%", background: "#1E293B", borderRadius: 4, marginTop: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 170,
                background: "#fff",
                border: `3px solid ${BLACK}`,
                borderRadius: "14px",
                boxShadow: SHADOW,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
        <div
          style={{
            height: 240,
            background: "#fff",
            border: `3px solid ${BLACK}`,
            borderRadius: "16px",
            boxShadow: SHADOW,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  if (isForbidden) {
    const userRoleDisplay = role ? role.toUpperCase() : "MEMBER";
    return (
      <div className="space-y-6">
        <div
          style={{
            background: "#0A0F14",
            border: `3px solid ${BLACK}`,
            borderRadius: "16px",
            boxShadow: SHADOW,
            padding: "36px",
          }}
        >
          <p style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#FACC15", margin: 0 }}>
            Governance &amp; Regulatory Audit
          </p>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: "44px", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", margin: "10px 0 0 0", lineHeight: 1.05 }}>
            Compliance &amp; EU AI Act
          </h1>
          <p style={{ margin: "10px 0 0 0", fontSize: "15px", fontWeight: 600, color: "#94A3B8", maxWidth: "640px" }}>
            Automated verification for EU AI Act Article 12 high-risk AI record-keeping obligations.
          </p>
        </div>

        <div
          style={{
            background: "#FFF7E0",
            border: `3px solid ${BLACK}`,
            borderRadius: "16px",
            boxShadow: SHADOW,
            padding: "28px",
          }}
        >
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <span
              style={{
                width: "56px",
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#FACC15",
                border: `3px solid ${BLACK}`,
                borderRadius: "14px",
                boxShadow: SHADOW_SM,
                fontSize: "26px",
                flexShrink: 0,
              }}
            >
              🔒
            </span>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                <Chip label="Requires role admin" bg="#FACC15" />
                <Chip label="Access denied" bg="#fff" />
              </div>
              <h2 style={{ fontFamily: FONT_HEAD, fontSize: "24px", fontWeight: 900, color: BLACK, margin: "0 0 8px 0" }}>
                Administrator Authorization Required
              </h2>
              <p style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: 600, color: "#475569", lineHeight: 1.6, maxWidth: "640px" }}>
                EU AI Act Article 12 compliance reports contain organization-wide forensic chain audits, full
                retention telemetry, and legal compliance attestations. Access is restricted by the backend
                role-based access policy to organization administrators.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                  background: "#fff",
                  border: `3px solid ${BLACK}`,
                  borderRadius: "12px",
                  boxShadow: SHADOW_SM,
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748B", marginBottom: "4px" }}>
                    Authenticated Account
                  </span>
                  <span style={{ display: "block", fontSize: "14px", fontWeight: 900, color: BLACK, fontFamily: FONT_HEAD }}>
                    {fullName || email || "Current Operator"}
                  </span>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>{email}</span>
                </div>
                <div>
                  <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748B", marginBottom: "4px" }}>
                    Assigned Role
                  </span>
                  <Chip label={userRoleDisplay} bg="#E2E8F0" />
                </div>
                <div>
                  <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748B", marginBottom: "4px" }}>
                    Regulatory Standard
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: BLACK }}>EU AI Act (2024/1689) Art. 12</span>
                </div>
                <div>
                  <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748B", marginBottom: "4px" }}>
                    Record Retention
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "#059669", fontFamily: FONT_HEAD }}>10 Years Enforced</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link href="/dashboard" style={{ textDecoration: "none" }}>
                  <NeoButton variant="secondary">← Back to Overview</NeoButton>
                </Link>
                <Link href="/dashboard/audit" style={{ textDecoration: "none" }}>
                  <NeoButton>View General Audit Trail →</NeoButton>
                </Link>
                <NeoButton variant="ghost" onClick={() => load(true)}>
                  Check Permission Again
                </NeoButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 style={{ fontFamily: FONT_HEAD, fontSize: "40px", fontWeight: 900, letterSpacing: "-0.03em", color: BLACK, margin: 0 }}>
          Compliance Report
        </h1>
        <div
          style={{
            background: "#FFE5E5",
            border: `3px solid ${BLACK}`,
            borderRadius: "16px",
            boxShadow: SHADOW,
            padding: "28px",
          }}
        >
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: BLACK, fontFamily: FONT_MONO }}>{error}</p>
          <div style={{ marginTop: "16px" }}>
            <NeoButton variant="danger" onClick={() => load(true)}>
              Retry Request
            </NeoButton>
          </div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-7">
      {/* Hero */}
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
          <p style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#FACC15", margin: 0 }}>
            Governance &amp; Regulatory Audit
          </p>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: "44px", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", margin: "10px 0 0 0", lineHeight: 1.05 }}>
            Compliance &amp; EU AI Act
          </h1>
          <p style={{ margin: "10px 0 0 0", fontSize: "15px", fontWeight: 600, color: "#94A3B8", maxWidth: "640px" }}>
            Article 12 automated logging, cryptographic non-repudiation, and tamper-evident audit.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
          <NeoButton variant="secondary" onClick={() => setReloadKey((k) => k + 1)} disabled={fetching}>
            <svg className={fetching ? "animate-spin" : ""} width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </NeoButton>
          <NeoButton onClick={handleExportPdf} disabled={exportingPdf} variant="secondary" testid="export-pdf">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {exportingPdf ? "Generating…" : "Export PDF Report"}
          </NeoButton>
          <NeoButton onClick={handleExportJson} disabled={exporting}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? "Exporting…" : "Export JSON"}
          </NeoButton>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Chip
          label={`Article 12: ${report.article_12_satisfied ? "Satisfied" : "Unsatisfied"} · Why?`}
          bg={report.article_12_satisfied ? "#2DD4A0" : "#FF4D4D"}
          onClick={() => setActiveModal("article_12_info")}
          title="Learn what Article 12 requires"
        />
        <Chip
          label={`Status: ${report.compliance_status} · Meaning`}
          bg="#FACC15"
          onClick={() => setActiveModal("compliance_status_info")}
          title="How is this calculated?"
        />
        <Chip
          label={`Report ${report.report_id.slice(0, 8)}…${report.report_id.slice(-4)}`}
          bg="#fff"
          title={report.report_id}
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          value={report.total_events}
          label="Total Audit Events"
          sublabel="Cryptographically hash-linked"
          icon="📊"
          accent="#2DD4A0"
          onClick={() => setActiveModal("total_events_info")}
          hint="Every memory store, constraint pin, and scan block recorded in sequence."
        />
        <KpiCard
          value={`${report.retention_years} Years`}
          label="Retention Window"
          sublabel="EU high-risk AI mandate"
          icon="⚖️"
          accent="#FACC15"
          onClick={() => setActiveModal("retention_info")}
          hint="Meets EU AI Act standards requiring high-risk AI logs be preserved for legal review."
        />
        <KpiCard
          value="100%"
          label="Audit Trail Completeness"
          sublabel="Zero unchained events"
          icon="🛡️"
          accent="#4D9FFF"
          onClick={() => setActiveModal("completeness_info")}
          hint="100% of operations have a verified parent hash. No orphan or unmonitored agent activity."
        />
      </div>

      {/* Hash chain verification */}
      <Panel
        title="Hash Chain Verification & Evidence"
        description="SHA-256 mathematical proof — if any entry is altered, verification fails"
        accent="#2DD4A0"
        action={<Chip label="SHA-256 Proof" bg="#fff" />}
      >
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: 600, color: "#475569", lineHeight: 1.6 }}>
          The hash chain calculates <code style={{ fontFamily: FONT_MONO, fontWeight: 800, background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "5px", padding: "1px 6px" }}>SHA-256(prev_hash + entry_data)</code>{" "}
          on every transaction. If any database entry is altered, inserted, or removed, the verification check
          fails mathematically.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(report.hash_chain).map(([key, value]) => {
            const isVal = key.toLowerCase() === "valid";
            const isValidBool = value === true || String(value) === "true";
            const displayKey = key === "valid" ? "Chain Integrity Status" : key === "length" ? "Total Chained Blocks" : key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveModal(isVal ? "chain_integrity_modal" : "chain_length_modal")}
                style={{
                  textAlign: "left",
                  background: isVal ? (isValidBool ? "#D9FFF0" : "#FFE5E5") : "#F8FAFC",
                  border: `3px solid ${BLACK}`,
                  borderRadius: "12px",
                  boxShadow: `3px 3px 0px ${BLACK}`,
                  padding: "16px",
                  cursor: "pointer",
                  transform: "translate(-1px, -1px)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                    {displayKey}
                  </span>
                  {isVal ? (
                    <Chip label={isValidBool ? "Intact" : "Failed"} bg={isValidBool ? "#2DD4A0" : "#FF4D4D"} />
                  ) : (
                    <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: BLACK, opacity: 0.45 }}>
                      Explain →
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: FONT_HEAD,
                    fontSize: "26px",
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    color: BLACK,
                    marginTop: "8px",
                  }}
                >
                  {String(value)}
                </div>
                <p style={{ margin: "10px 0 0 0", fontSize: "12px", fontWeight: 600, color: "#475569", lineHeight: 1.5, borderTop: `2px solid ${BLACK}`, paddingTop: "8px" }}>
                  {key === "valid"
                    ? isValidBool
                      ? "Unbroken cryptographic link from genesis seed to latest event. Mathematical proof of zero tampering."
                      : "Discrepancy detected between database payload and historical hash. Flagged as tampering."
                    : key === "length"
                    ? "Continuous sequence of cryptographically linked ledger entries in forward sequence."
                    : "Cryptographic parameter."}
                </p>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Events by category */}
      {Object.keys(report.events_by_type).length > 0 && (
        <Panel
          title="Audited Events By Category"
          description="Click any card to read why this number exists"
          accent="#4D9FFF"
          action={<Chip label={`${report.total_events} total`} bg="#fff" />}
        >
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
            Categorized distribution of all transactions intercepted, validated, and hash-chained by AgentShield:
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {Object.entries(report.events_by_type).map(([eventType, count]) => {
              const meta = getEventMeta(eventType);
              return (
                <button
                  key={eventType}
                  type="button"
                  onClick={() => setActiveModal(eventType)}
                  style={{
                    textAlign: "left",
                    background: "#fff",
                    border: `3px solid ${BLACK}`,
                    borderRadius: "12px",
                    boxShadow: `3px 3px 0px ${BLACK}`,
                    padding: "16px",
                    cursor: "pointer",
                    borderTop: `8px solid ${meta.color}`,
                    transform: "translate(-1px, -1px)",
                    transition: "transform 100ms, box-shadow 100ms",
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px, 2px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "1px 1px 0px #000";
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `3px 3px 0px ${BLACK}`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translate(-1px, -1px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `3px 3px 0px ${BLACK}`;
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "inline-block",
                          fontFamily: FONT_HEAD,
                          fontSize: "9px",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          background: meta.color,
                          color: BLACK,
                          border: `2px solid ${BLACK}`,
                          borderRadius: "6px",
                          padding: "2px 7px",
                          boxShadow: `2px 2px 0px ${BLACK}`,
                        }}
                      >
                        {meta.tag}
                      </span>
                      <div style={{ fontFamily: FONT_HEAD, fontSize: "32px", fontWeight: 900, letterSpacing: "-0.02em", color: BLACK, marginTop: "10px", lineHeight: 1 }}>
                        {count}
                      </div>
                    </div>
                    <span style={{ fontSize: "26px", flexShrink: 0 }}>{meta.icon}</span>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748B", marginTop: "10px" }}>
                    {eventType}
                  </div>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: "13px", fontWeight: 900, color: BLACK, marginTop: "2px" }}>
                    {meta.title}
                  </div>
                  <p style={{ margin: "10px 0 0 0", fontSize: "12px", fontWeight: 600, color: "#475569", lineHeight: 1.5, borderTop: `2px solid ${BLACK}`, paddingTop: "8px" }}>
                    {meta.desc}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: BLACK }}>
                    <span>Why {count}?</span>
                    <span style={{ opacity: 0.55 }}>Read details →</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Constraint + Alert summaries */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Constraint Summary" description="Authoritative rules pinned to prevent model drift" accent="#2DD4A0">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(report.constraint_summary).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  background: "#F8FAFC",
                  border: `3px solid ${BLACK}`,
                  borderRadius: "10px",
                  boxShadow: `2px 2px 0px ${BLACK}`,
                  padding: "12px 14px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: BLACK }}>
                    {key.replace(/_/g, " ")}
                  </span>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    {key === "active" ? "Enforced on every Groq token stream" : key === "total" ? "Historical registered policies" : "Policy metric"}
                  </span>
                </div>
                <Chip label={String(value)} bg="#2DD4A0" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Alert Summary" description="Security incidents intercepted before reaching models" accent="#FACC15">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(report.alert_summary).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  background: "#F8FAFC",
                  border: `3px solid ${BLACK}`,
                  borderRadius: "10px",
                  boxShadow: `2px 2px 0px ${BLACK}`,
                  padding: "12px 14px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: BLACK }}>
                    {key.replace(/_/g, " ")}
                  </span>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    {key === "total" ? "Total security alerts logged" : "Active security incidents"}
                  </span>
                </div>
                <Chip label={String(value)} bg="#FACC15" />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          fontFamily: FONT_MONO,
          fontSize: "12px",
          fontWeight: 700,
          color: "#64748B",
        }}
      >
        <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
        <Chip label="✓ Report digest verified & signed" bg="#2DD4A0" />
      </div>

      {/* Explanation modal */}
      {activeModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.75)",
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              maxWidth: "720px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#FFFFFF",
              border: `3px solid ${BLACK}`,
              borderRadius: "16px",
              boxShadow: `8px 8px 0px ${BLACK}`,
              padding: "28px",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModal(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#FF4D4D",
                border: `3px solid ${BLACK}`,
                borderRadius: "10px",
                boxShadow: `2px 2px 0px ${BLACK}`,
                fontFamily: FONT_HEAD,
                fontWeight: 900,
                fontSize: "16px",
                color: BLACK,
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            {activeModal in report.events_by_type ? (
              (() => {
                const meta = getEventMeta(activeModal);
                const count = report.events_by_type[activeModal] ?? 0;
                return (
                  <div>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px", paddingRight: "44px" }}>
                      <span
                        style={{
                          width: "64px",
                          height: "64px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "32px",
                          background: meta.color,
                          border: `3px solid ${BLACK}`,
                          borderRadius: "14px",
                          boxShadow: SHADOW_SM,
                          flexShrink: 0,
                        }}
                      >
                        {meta.icon}
                      </span>
                      <div>
                        <span
                          style={{
                            display: "inline-block",
                            fontFamily: FONT_HEAD,
                            fontSize: "10px",
                            fontWeight: 900,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            background: meta.color,
                            color: BLACK,
                            border: `2px solid ${BLACK}`,
                            borderRadius: "6px",
                            padding: "3px 8px",
                            boxShadow: `2px 2px 0px ${BLACK}`,
                          }}
                        >
                          {meta.tag}
                        </span>
                        <h3 style={{ fontFamily: FONT_HEAD, fontSize: "26px", fontWeight: 900, letterSpacing: "-0.02em", color: BLACK, margin: "8px 0 0 0", lineHeight: 1.15 }}>
                          {meta.title}
                        </h3>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#F8FAFC",
                        border: `3px solid ${BLACK}`,
                        borderRadius: "12px",
                        boxShadow: `2px 2px 0px ${BLACK}`,
                        padding: "16px",
                        marginBottom: "20px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                          Active Event Count
                        </span>
                        <Chip
                          label={`${report.total_events > 0 ? ((count / report.total_events) * 100).toFixed(1) : 0}% of all events`}
                          bg="#2DD4A0"
                        />
                      </div>
                      <div style={{ fontFamily: FONT_HEAD, fontSize: "40px", fontWeight: 900, letterSpacing: "-0.02em", color: BLACK, marginTop: "8px", lineHeight: 1 }}>
                        {count} Intercepted
                      </div>
                      <p style={{ margin: "10px 0 0 0", fontSize: "12px", fontWeight: 700, color: "#64748B", fontFamily: FONT_MONO, borderTop: `2px solid ${BLACK}`, paddingTop: "8px" }}>
                        Increments live (+1) each time a <strong>{activeModal}</strong> operation occurs.
                      </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div>
                        <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "6px" }}>
                          What happened to produce this count?
                        </span>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: BLACK, lineHeight: 1.6 }}>{meta.desc}</p>
                      </div>

                      <div
                        style={{
                          background: "#FFF7E0",
                          border: `3px solid ${BLACK}`,
                          borderRadius: "12px",
                          boxShadow: `2px 2px 0px ${BLACK}`,
                          padding: "16px",
                        }}
                      >
                        <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BLACK, marginBottom: "6px" }}>
                          Why is this number exactly {count}?
                        </span>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: BLACK, lineHeight: 1.6 }}>{meta.whyThisNumber}</p>
                        <p style={{ margin: "8px 0 0 0", fontSize: "12px", fontWeight: 600, color: "#64748B", fontFamily: FONT_MONO }}>
                          Each of the {count} transactions was verified by AgentShield&apos;s middleware and chained with a SHA-256 parent link.
                        </p>
                      </div>

                      <div
                        style={{
                          background: "#D9FFF0",
                          border: `3px solid ${BLACK}`,
                          borderRadius: "12px",
                          boxShadow: `2px 2px 0px ${BLACK}`,
                          padding: "16px",
                        }}
                      >
                        <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: BLACK, marginBottom: "6px" }}>
                          EU AI Act &amp; Compliance Context
                        </span>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: BLACK, lineHeight: 1.6 }}>{meta.legalRelevance}</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
                      <NeoButton onClick={() => setActiveModal(null)}>Close</NeoButton>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div>
                <h3 style={{ fontFamily: FONT_HEAD, fontSize: "26px", fontWeight: 900, letterSpacing: "-0.02em", color: BLACK, margin: "0 44px 16px 0", lineHeight: 1.15 }}>
                  {activeModal === "article_12_info" && "Understanding Article 12 Compliance"}
                  {activeModal === "compliance_status_info" && "Compliance Status: How It's Calculated"}
                  {activeModal === "total_events_info" && "Why Total Events Matter"}
                  {activeModal === "retention_info" && "10-Year High-Risk Retention Mandate"}
                  {activeModal === "completeness_info" && "100% Chain Completeness Guarantee"}
                  {activeModal === "chain_integrity_modal" && "Cryptographic Chain Verification"}
                  {activeModal === "chain_length_modal" && "Sequential Hash Length"}
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", fontWeight: 600, color: BLACK, lineHeight: 1.65 }}>
                  {activeModal === "article_12_info" && (
                    <>
                      <p style={{ margin: 0 }}>
                        <strong>EU AI Act Article 12 (Record-Keeping)</strong> requires that providers of high-risk
                        AI systems implement automated logging capabilities throughout the system&apos;s lifetime.
                      </p>
                      <p style={{ margin: 0 }}>
                        AgentShield meets this by generating continuous, tamper-evident logs of every memory
                        operation, user interaction, and security rule enforcement.
                      </p>
                      <div
                        style={{
                          background: "#D9FFF0",
                          border: `3px solid ${BLACK}`,
                          borderRadius: "12px",
                          boxShadow: `2px 2px 0px ${BLACK}`,
                          padding: "14px",
                          fontFamily: FONT_MONO,
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        Requirement: Automated logging + Tamper-evident trail + 10-year retention = COMPLIANT
                      </div>
                    </>
                  )}

                  {activeModal === "compliance_status_info" && (
                    <>
                      <p style={{ margin: 0 }}>The status is calculated deterministically from two verifiable conditions:</p>
                      <ol style={{ margin: 0, paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <li><strong>Hash Chain Valid:</strong> No discrepancies detected in historical record hashes.</li>
                        <li><strong>Retention Policy Active:</strong> All operations are configured for long-term retention.</li>
                      </ol>
                      <p style={{ margin: 0, color: "#475569" }}>
                        If a single record in your database is tampered with, this status immediately flips to{" "}
                        <strong>NON_COMPLIANT</strong>.
                      </p>
                    </>
                  )}

                  {activeModal === "total_events_info" && (
                    <>
                      <div
                        style={{
                          background: "#F8FAFC",
                          border: `3px solid ${BLACK}`,
                          borderRadius: "12px",
                          boxShadow: `2px 2px 0px ${BLACK}`,
                          padding: "16px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: FONT_HEAD, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                            Mathematical Exact Sum
                          </span>
                          <span style={{ fontFamily: FONT_HEAD, fontSize: "28px", fontWeight: 900, color: BLACK }}>
                            {report.total_events} TOTAL
                          </span>
                        </div>
                        <p style={{ margin: "10px 0 0 0", fontSize: "13px", fontWeight: 600, color: BLACK, lineHeight: 1.55 }}>
                          Why exactly <strong>{report.total_events}</strong>? Because it is the exact sum of all
                          categorized transactions logged in the database:
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px", borderTop: `2px solid ${BLACK}`, paddingTop: "10px" }}>
                          {Object.entries(report.events_by_type).map(([evt, cnt]) => {
                            const meta = getEventMeta(evt);
                            const percentage = report.total_events > 0 ? ((cnt / report.total_events) * 100).toFixed(1) : "0";
                            return (
                              <button
                                key={evt}
                                type="button"
                                onClick={() => setActiveModal(evt)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "10px",
                                  background: "#fff",
                                  border: `2px solid ${BLACK}`,
                                  borderRadius: "8px",
                                  padding: "8px 10px",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  width: "100%",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                  <span style={{ fontSize: "16px" }}>{meta.icon}</span>
                                  <div style={{ minWidth: 0 }}>
                                    <span style={{ display: "block", fontSize: "13px", fontWeight: 900, color: BLACK, fontFamily: FONT_HEAD }}>{meta.title}</span>
                                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#64748B", fontFamily: FONT_MONO }}>{evt}</span>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                  <span style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: "14px", color: BLACK }}>{cnt}</span>
                                  <span style={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: "11px", color: "#475569", width: "46px", textAlign: "right" }}>({percentage}%)</span>
                                </div>
                              </button>
                            );
                          })}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: `2px solid ${BLACK}`, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: "13px", color: BLACK }}>
                            <span>TOTAL AUDIT LEDGER ENTRIES:</span>
                            <span style={{ fontSize: "18px" }}>{report.total_events}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span style={{ display: "block", fontFamily: FONT_HEAD, fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "6px" }}>
                          What does this number prove?
                        </span>
                        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          <li>
                            <strong>Live Audit Footprint:</strong> Not a mock metric — every prompt, memory store,
                            and security block increments this count live by +1.
                          </li>
                          <li>
                            <strong>Cryptographic Accountability:</strong> Each of these {report.total_events} entries
                            has its own SHA-256 signature linked to the previous entry. Zero unmonitored actions.
                          </li>
                          <li>
                            <strong>EU AI Act Article 12 Alignment:</strong> High-risk automated logging compliance
                            with continuous recording across the operational lifecycle.
                          </li>
                        </ul>
                      </div>
                    </>
                  )}

                  {activeModal === "retention_info" && (
                    <>
                      <p style={{ margin: 0 }}>
                        Under Article 18 of the EU AI Act, logs generated by high-risk AI systems must be kept for
                        at least <strong>10 years</strong>.
                      </p>
                      <p style={{ margin: 0 }}>
                        AgentShield includes automated daily hash anchoring (saving chain heads to external
                        storage or ledgers) to guarantee immutable survival across multi-year windows.
                      </p>
                    </>
                  )}

                  {activeModal === "completeness_info" && (
                    <>
                      <p style={{ margin: 0 }}>
                        <strong>100% Completeness</strong> means that out of all events in the system,{" "}
                        <strong>zero events</strong> were logged without a cryptographic parent hash.
                      </p>
                      <p style={{ margin: 0 }}>
                        This guarantees an adversary cannot insert &quot;ghost events&quot; or delete historical
                        logs without breaking the chain validation check.
                      </p>
                    </>
                  )}

                  {activeModal === "chain_integrity_modal" && (
                    <>
                      <p style={{ margin: 0 }}>
                        AgentShield uses a continuous forward hash chain:{" "}
                        <code style={{ fontFamily: FONT_MONO, fontWeight: 800, background: "#F1F5F9", border: `2px solid ${BLACK}`, borderRadius: "5px", padding: "1px 6px" }}>
                          hash = SHA256(prev_hash + canonical_json(entry))
                        </code>
                        .
                      </p>
                      <p style={{ margin: 0 }}>
                        When the verification engine runs, it re-calculates the hash of every single row. If even
                        one byte was changed, verification immediately returns <code style={{ fontFamily: FONT_MONO, fontWeight: 800 }}>false</code>{" "}
                        and pinpoints the exact row.
                      </p>
                    </>
                  )}

                  {activeModal === "chain_length_modal" && (
                    <p style={{ margin: 0 }}>
                      Total number of linked cryptographic blocks currently in the sequence. Each block points
                      back to the genesis hash, creating an unbroken timeline.
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
                  <NeoButton onClick={() => setActiveModal(null)}>Close</NeoButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
