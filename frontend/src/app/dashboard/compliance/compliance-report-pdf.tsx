import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ── Report data contract (mirrors ComplianceReport on the page) ──────────────
export interface PdfComplianceReport {
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

export interface PdfReportUser {
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
}

// ── Palette (print-safe) ──────────────────────────────────────────────────────
const INK = "#111827";
const MUTED = "#4B5563";
const LINE = "#D1D5DB";
const DARK = "#0A0F14";
const GREEN = "#059669";
const RED = "#DC2626";
const LIGHT = "#F3F4F6";

const S = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 52,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.5,
  },
  pageTight: { paddingTop: 40, paddingBottom: 48 },

  // Cover
  cover: { flex: 1, flexDirection: "column" },
  coverBanner: {
    backgroundColor: DARK,
    padding: 30,
    marginBottom: 28,
  },
  coverEyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 2.4,
    color: "#FACC15",
    marginBottom: 10,
  },
  coverTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 27,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  coverSub: { fontSize: 11, color: "#9CA3AF" },
  classBar: {
    borderWidth: 1.5,
    borderColor: RED,
    backgroundColor: "#FEF2F2",
    padding: 8,
    marginBottom: 22,
    alignItems: "center",
  },
  classText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: RED,
  },
  metaTable: { marginBottom: 24 },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingVertical: 7,
  },
  metaLabel: {
    width: "34%",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    letterSpacing: 0.6,
    color: MUTED,
  },
  metaValue: { width: "66%", fontSize: 9.5, color: INK },
  statusOk: { fontFamily: "Helvetica-Bold", color: GREEN },
  statusBad: { fontFamily: "Helvetica-Bold", color: RED },

  // Sections
  h1: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: INK,
    marginBottom: 10,
    marginTop: 4,
  },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: INK,
    marginTop: 16,
    marginBottom: 6,
  },
  para: { marginBottom: 8, color: INK },
  muted: { color: MUTED },
  small: { fontSize: 8, color: MUTED },
  mono: { fontFamily: "Courier", fontSize: 8.5 },

  sectionRule: {
    borderBottomWidth: 2,
    borderBottomColor: INK,
    marginBottom: 12,
    marginTop: 2,
  },
  footerRule: {
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    marginTop: 16,
  },

  // Key metrics strip
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: LIGHT,
    padding: 10,
  },
  metricValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: INK,
    marginBottom: 3,
  },
  metricLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    color: MUTED,
    textTransform: "uppercase",
  },

  // Generic table
  table: { marginBottom: 14 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: DARK,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeadText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1,
    color: "#FFFFFF",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    backgroundColor: "#FAFAFA",
  },
  colWide: { width: "52%" },
  colMid: { width: "28%" },
  colNarrow: { width: "20%", textAlign: "right" },
  colHalf: { width: "50%" },
  colQ: { width: "25%", textAlign: "right" },
  cellBold: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  cell: { fontSize: 9 },
  num: { textAlign: "right", fontSize: 9 },

  callout: {
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: LIGHT,
    padding: 12,
    marginBottom: 14,
  },
  calloutOk: {
    borderWidth: 1.5,
    borderColor: GREEN,
    backgroundColor: "#ECFDF5",
    padding: 12,
    marginBottom: 14,
  },
  calloutBad: {
    borderWidth: 1.5,
    borderColor: RED,
    backgroundColor: "#FEF2F2",
    padding: 12,
    marginBottom: 14,
  },
  calloutTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  // Attestation
  attestation: {
    borderWidth: 1.5,
    borderColor: INK,
    padding: 16,
    marginTop: 8,
  },
  signRow: { flexDirection: "row", marginTop: 22, gap: 24 },
  signBlock: { flex: 1 },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: INK,
    marginBottom: 5,
    height: 28,
  },
  signLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1,
    color: MUTED,
  },
  disclaimer: { fontSize: 7.5, color: MUTED, marginTop: 14, lineHeight: 1.5 },
});

const fmtKey = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Footer() {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        left: 52,
        right: 52,
        bottom: 30,
        borderTopWidth: 1,
        borderTopColor: LINE,
        paddingTop: 6,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Text style={S.small}>
        AgentShield · EU AI Act Art. 12 Compliance Report · Confidential
      </Text>
      <Text
        style={S.small}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function Cover({ report, user }: { report: PdfComplianceReport; user: PdfReportUser }) {
  const ok = report.article_12_satisfied;
  return (
    <View style={S.cover}>
      <View style={S.coverBanner}>
        <Text style={S.coverEyebrow}>AGENTSHIELD · REGULATORY ASSURANCE</Text>
        <Text style={S.coverTitle}>Compliance Report</Text>
        <Text style={S.coverSub}>
          EU AI Act (Regulation 2024/1689) — Article 12 Record-Keeping
        </Text>
      </View>

      <View style={S.classBar}>
        <Text style={S.classText}>CONFIDENTIAL — FOR AUTHORIZED AUDIT REVIEW ONLY</Text>
      </View>

      <View style={S.metaTable}>
        <View style={S.metaRow}>
          <Text style={S.metaLabel}>REPORT IDENTIFIER</Text>
          <Text style={[S.metaValue, S.mono]}>{report.report_id}</Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.metaLabel}>ORGANIZATION</Text>
          <Text style={S.metaValue}>{user.fullName ? `${user.fullName}'s Organization` : "—"}</Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.metaLabel}>PREPARED FOR</Text>
          <Text style={S.metaValue}>
            {user.fullName || "—"} {user.email ? `(${user.email})` : ""}
          </Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.metaLabel}>APPROVED BY</Text>
          <Text style={S.metaValue}>
            {user.role ? user.role.toUpperCase() : "ADMIN"} · Role-based access enforced
          </Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.metaLabel}>GENERATED (UTC)</Text>
          <Text style={[S.metaValue, S.mono]}>{new Date(report.generated_at).toISOString()}</Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.metaLabel}>COMPLIANCE STANDARD</Text>
          <Text style={S.metaValue}>EU AI Act Art. 12 (Automated Logging &amp; Tamper-Evidence)</Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.metaLabel}>DETERMINATION</Text>
          <Text style={[S.metaValue, ok ? S.statusOk : S.statusBad]}>
            {report.compliance_status.toUpperCase()} — Article 12 {ok ? "SATISFIED" : "NOT SATISFIED"}
          </Text>
        </View>
      </View>

      <View style={S.callout}>
        <Text style={S.calloutTitle}>Purpose of this report</Text>
        <Text style={S.para}>
          This document presents the automated Article 12 compliance determination for the
          reporting organization, including cryptographic hash-chain verification evidence,
          audited event distribution, safety-constraint posture, and security-alert summary.
          All figures are derived directly from the live AgentShield audit ledger at the
          generation timestamp above.
        </Text>
      </View>

      <View style={{ marginTop: "auto" }}>
        <Text style={S.small}>
          Produced by AgentShield · Deterministic verification · SHA-256 hash chain ·
          Retention {report.retention_years} years
        </Text>
      </View>
    </View>
  );
}

function ExecutiveSummary({ report }: { report: PdfComplianceReport }) {
  const ok = report.article_12_satisfied;
  const chainLen =
    report.hash_chain.length !== undefined ? String(report.hash_chain.length) : "—";
  const chainValid =
    report.hash_chain.valid === true || String(report.hash_chain.valid) === "true";
  return (
    <View>
      <Text style={S.h1}>1. Executive Summary</Text>
      <View style={S.sectionRule} />
      <Text style={S.para}>
        AgentShield continuously records every security-relevant operation — memory writes,
        constraint updates, adversarial-pattern detections, and guarded inference turns —
        into a sequential, SHA-256 hash-linked ledger. This report evaluates whether that
        ledger satisfies EU AI Act Article 12 obligations for high-risk AI systems:
        automatic recording of events over the lifetime of the system, traceability of
        results, and durability of records for post-market monitoring.
      </Text>

      <View style={ok ? S.calloutOk : S.calloutBad}>
        <Text style={[S.calloutTitle, { color: ok ? GREEN : RED }]}>
          DETERMINATION: {report.compliance_status.toUpperCase()}
        </Text>
        <Text>
          Article 12 is assessed as {ok ? "SATISFIED" : "NOT SATISFIED"}.{" "}
          {ok
            ? `All ${report.total_events} recorded events are hash-linked with no detected tampering, and the configured retention window (${report.retention_years} years) meets the high-risk record-keeping expectation.`
            : "One or more Article 12 criteria were not met at generation time. See Section 4 for hash-chain evidence."}
        </Text>
      </View>

      <View style={S.metricsRow}>
        <View style={S.metricBox}>
          <Text style={S.metricValue}>{report.total_events}</Text>
          <Text style={S.metricLabel}>Audit Events</Text>
        </View>
        <View style={S.metricBox}>
          <Text style={S.metricValue}>{chainLen}</Text>
          <Text style={S.metricLabel}>Hash-Linked Blocks</Text>
        </View>
        <View style={S.metricBox}>
          <Text style={S.metricValue}>{report.retention_years} yr</Text>
          <Text style={S.metricLabel}>Retention Window</Text>
        </View>
        <View style={S.metricBox}>
          <Text style={[S.metricValue, { color: chainValid ? GREEN : RED }]}>
            {chainValid ? "INTACT" : "BROKEN"}
          </Text>
          <Text style={S.metricLabel}>Chain Integrity</Text>
        </View>
      </View>

      <Text style={S.h2}>1.1 Key observations</Text>
      <Text style={S.para}>
        • {Object.keys(report.events_by_type).length} distinct audited event categories were
        observed in the reporting period.
      </Text>
      <Text style={S.para}>
        • {String(report.constraint_summary.active ?? "—")} safety constraints are actively
        pinned and enforced on every model invocation; {String(report.alert_summary.total ?? 0)}{" "}
        security alerts have been logged.
      </Text>
      <Text style={S.para}>
        • Hash-chain verification {chainValid ? "passed" : "failed"}:{" "}
        {chainValid
          ? "every entry re-hashes to its recorded predecessor, proving no record was altered, inserted, or removed out-of-band."
          : "a discontinuity was detected; refer to Section 4."}
      </Text>
    </View>
  );
}

function ScopeMethod() {
  return (
    <View>
      <Text style={S.h1}>2. Scope &amp; Methodology</Text>
      <View style={S.sectionRule} />
      <Text style={S.para}>
        <Text style={S.cellBold}>Scope. </Text>
        This report covers all audit events across organizations retained by the AgentShield
        deployment at the generation timestamp, including memory operations, constraint
        governance, scan-gate detections, guarded chat inference, and compliance snapshots.
      </Text>
      <Text style={S.para}>
        <Text style={S.cellBold}>Method. </Text>
        Each ledger entry stores{" "}
        <Text style={S.mono}>entry_hash = SHA-256(previous_hash ‖ entry_data)</Text>,
        forming an unbroken chain from the genesis seed to the most recent event. Verification
        re-computes every link; a single altered byte causes the chain check to fail. Event
        categorization, constraint counts, and alert totals are aggregated directly from the
        same ledger — no manual entry is possible.
      </Text>
      <Text style={S.para}>
        <Text style={S.cellBold}>Frameworks referenced. </Text>
        EU AI Act (Regulation 2024/1689) Article 12 (record-keeping), Article 14 (human
        oversight), Article 15 (cybersecurity resilience); OWASP Agentic Security Initiative
        (memory poisoning, prompt injection).
      </Text>
    </View>
  );
}

function EventTable({ report }: { report: PdfComplianceReport }) {
  const rows = Object.entries(report.events_by_type).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  return (
    <View>
      <Text style={S.h1}>3. Audited Events by Category</Text>
      <View style={S.sectionRule} />
      <Text style={[S.para, S.muted]}>
        Distribution of every hash-chained event in the reporting period.
      </Text>
      <View style={S.table}>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadText, S.colWide]}>EVENT CATEGORY</Text>
          <Text style={[S.tableHeadText, S.colMid]}>SEMANTICS</Text>
          <Text style={[S.tableHeadText, S.colNarrow]}>COUNT</Text>
          <Text style={[S.tableHeadText, S.colNarrow]}>SHARE</Text>
        </View>
        {rows.map(([type, count], i) => {
          const share =
            report.total_events > 0
              ? ((count / report.total_events) * 100).toFixed(1)
              : "0.0";
          return (
            <View key={type} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.cell, S.colWide, S.cellBold]}>{fmtKey(type)}</Text>
              <Text style={[S.cell, S.colMid, S.muted]}>{type}</Text>
              <Text style={[S.cell, S.colNarrow, S.num]}>{count}</Text>
              <Text style={[S.cell, S.colNarrow, S.num]}>{share}%</Text>
            </View>
          );
        })}
        <View style={[S.tableRow, { borderBottomWidth: 0, backgroundColor: LIGHT }]}>
          <Text style={[S.cellBold, S.colWide]}>TOTAL</Text>
          <Text style={[S.cell, S.colMid]} />
          <Text style={[S.cellBold, S.colNarrow, S.num]}>{report.total_events}</Text>
          <Text style={[S.cellBold, S.colNarrow, S.num]}>100%</Text>
        </View>
      </View>
    </View>
  );
}

function ChainSection({ report }: { report: PdfComplianceReport }) {
  const entries = Object.entries(report.hash_chain);
  const valid =
    report.hash_chain.valid === true || String(report.hash_chain.valid) === "true";
  return (
    <View>
      <Text style={S.h1}>4. Hash-Chain Verification Evidence</Text>
      <View style={S.sectionRule} />
      <View style={valid ? S.calloutOk : S.calloutBad}>
        <Text style={[S.calloutTitle, { color: valid ? GREEN : RED }]}>
          VERIFICATION RESULT: {valid ? "CHAIN INTACT — NO TAMPERING DETECTED" : "CHAIN BROKEN"}
        </Text>
        <Text>
          Re-computation of all {String(report.hash_chain.length ?? report.total_events)}{" "}
          SHA-256 links {valid ? "matched" : "did not match"} their recorded values.{" "}
          {valid
            ? "This constitutes mathematical proof that no audit record was altered, inserted, or deleted after being written."
            : "A discontinuity indicates out-of-band modification and must be investigated immediately."}
        </Text>
      </View>
      <View style={S.table}>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadText, S.colHalf]}>PARAMETER</Text>
          <Text style={[S.tableHeadText, { width: "50%", textAlign: "right" }]}>
            OBSERVED VALUE
          </Text>
        </View>
        {entries.map(([k, v], i) => (
          <View key={k} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={[S.cell, S.colHalf, S.cellBold]}>
              {k === "valid" ? "Chain Integrity Status" : k === "length" ? "Chained Blocks" : fmtKey(k)}
            </Text>
            <Text
              style={[
                S.cell,
                { width: "50%", textAlign: "right" },
                k === "valid"
                  ? { fontFamily: "Helvetica-Bold", color: valid ? GREEN : RED }
                  : S.mono,
              ]}
            >
              {String(v)}
            </Text>
          </View>
        ))}
      </View>
      <Text style={S.small}>
        Algorithm: SHA-256 · Link formula: H(n) = SHA-256(H(n−1) ‖ payload(n)) ·
        Genesis anchored to deployment seed.
      </Text>
    </View>
  );
}

function SummarySection({ report }: { report: PdfComplianceReport }) {
  const constraints = Object.entries(report.constraint_summary);
  const alerts = Object.entries(report.alert_summary);
  return (
    <View>
      <Text style={S.h1}>5. Control Posture Summary</Text>
      <View style={S.sectionRule} />

      <Text style={S.h2}>5.1 Safety constraints (pinned governance rules)</Text>
      <View style={S.table}>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadText, { width: "75%" }]}>METRIC</Text>
          <Text style={[S.tableHeadText, { width: "25%", textAlign: "right" }]}>VALUE</Text>
        </View>
        {constraints.map(([k, v], i) => (
          <View key={k} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={[S.cell, { width: "75%" }]}>{fmtKey(k)}</Text>
            <Text style={[S.cellBold, { width: "25%", textAlign: "right" }]}>{String(v)}</Text>
          </View>
        ))}
      </View>

      <Text style={S.h2}>5.2 Security alerts</Text>
      <View style={S.table}>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadText, { width: "75%" }]}>METRIC</Text>
          <Text style={[S.tableHeadText, { width: "25%", textAlign: "right" }]}>VALUE</Text>
        </View>
        {alerts.map(([k, v], i) => (
          <View key={k} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={[S.cell, { width: "75%" }]}>{fmtKey(k)}</Text>
            <Text style={[S.cellBold, { width: "25%", textAlign: "right" }]}>{String(v)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Attestation({ report, user }: { report: PdfComplianceReport; user: PdfReportUser }) {
  return (
    <View>
      <Text style={S.h1}>6. Attestation</Text>
      <View style={S.sectionRule} />
      <View style={S.attestation}>
        <Text style={[S.cellBold, { marginBottom: 8 }]}>
          Statement of automated compliance
        </Text>
        <Text style={S.para}>
          The undersigned confirm that this report was generated automatically by AgentShield
          from the live tamper-evident audit ledger at{" "}
          <Text style={S.mono}>{new Date(report.generated_at).toISOString()}</Text>, that no
          figures were manually entered, and that hash-chain verification{" "}
          {report.hash_chain.valid === true || String(report.hash_chain.valid) === "true"
            ? "passed"
            : "failed"}{" "}
          at generation time. Determination: {report.compliance_status.toUpperCase()} for EU
          AI Act Article 12.
        </Text>

        <View style={S.signRow}>
          <View style={S.signBlock}>
            <View style={S.signLine} />
            <Text style={S.signLabel}>SYSTEM OF RECORD — AGENTSHIELD LEDGER</Text>
          </View>
          <View style={S.signBlock}>
            <View style={S.signLine} />
            <Text style={S.signLabel}>
              REPORT OWNER — {(user.fullName || user.email || "ADMIN").toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={S.disclaimer}>
          DISCLAIMER: This report is an automated technical assessment produced by the
          AgentShield deployment. It does not constitute legal advice. Article 12
          determination is based on observable ledger state (hash-chain integrity, event
          capture completeness, configured retention) at the generation timestamp. Controlled
          known limitations of the wider evaluation (e.g., external KMS anchoring) are
          documented separately in the project evaluation record and are not asserted here.
          Classification: Confidential — distribute only to authorized auditors and
          compliance officers.
        </Text>
      </View>
    </View>
  );
}

// ── The document ──────────────────────────────────────────────────────────────
export function ComplianceReportPdf({
  report,
  user,
}: {
  report: PdfComplianceReport;
  user: PdfReportUser;
}) {
  return (
    <Document
      title={`AgentShield Article 12 Compliance Report — ${report.report_id.slice(0, 8)}`}
      author="AgentShield"
      subject="EU AI Act Article 12 Automated Compliance Determination"
      keywords="EU AI Act, Article 12, compliance, audit, SHA-256, AgentShield"
      creator="AgentShield Compliance Engine"
    >
      {/* Cover */}
      <Page size="A4" style={S.page}>
        <View style={{ flex: 1 }}>
          <Cover report={report} user={user} />
        </View>
        <Footer />
      </Page>

      {/* Body */}
      <Page size="A4" style={S.page}>
        <View style={{ flex: 1 }}>
          <ExecutiveSummary report={report} />
          <ScopeMethod />
        </View>
        <Footer />
      </Page>

      <Page size="A4" style={S.page}>
        <View style={{ flex: 1 }}>
          <EventTable report={report} />
          <ChainSection report={report} />
        </View>
        <Footer />
      </Page>

      <Page size="A4" style={S.page}>
        <View style={{ flex: 1 }}>
          <SummarySection report={report} />
          <Attestation report={report} user={user} />
        </View>
        <Footer />
      </Page>
    </Document>
  );
}

export default ComplianceReportPdf;
