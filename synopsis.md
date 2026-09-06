# AgentShield: Synopsis

**Project:** AgentShield — Tamper-Evident Memory Defense for LLM Agents
**Team:** Divyansh Gupta & Tejshvee (2 members)
**Subject:** Minor Project, BTech CSE AIML, ITM University Gwalior
**Date:** August 9, 2026

---

## 1. Broad Area of Work

The proposed project, **"AgentShield: Tamper-Evident Memory Defense for LLM Agents,"** falls under the interdisciplinary domains of **Artificial Intelligence (AI) Security, Cryptographic Integrity Systems, and Agentic AI Governance.** The project addresses a critical vulnerability in modern AI systems — the susceptibility of large language model agents with persistent memory to memory poisoning, governance decay, and tampering — and proposes a unified defense architecture.

The platform is designed to assist **developers, enterprises, and AI safety teams** by providing tamper-proof memory integrity for AI agents. It leverages **Constraint Pinning** (the first production implementation of the technique from the Governance Decay paper, Chen, arXiv:2606.22528) to prevent safety rules from being silently erased during context compaction — quarantining constraints from lossy compaction and re-injecting them after summarization, reducing violations from 30% to 0% at <0.5% token overhead. **SHA-256 hash chains** cryptographically link every stored memory, detecting any tampering or modification immediately when the chain breaks (AuditKit, 2026; G8KEPR, 2026). **ECDSA-P256 digital signatures** (local dev with AWS KMS HSM-ready backend via `AWS_KMS_KEY_ID`; private key never leaves HSM in production, every sign/verify logged in CloudTrail) provide non-repudiable integrity verification (AWS, 2026). **Pattern-based poisoning detection** with **45 detection patterns across 6 categories** (Injection Attacks, Memory Poisoning, Data Exfiltration, Constraint Violation, Manipulation Attacks, Structural Attacks) provides an additional defense layer against documented OWASP ASI06 attack signatures (OWASP, 2026; injectionguard, 2026). The system also generates **EU AI Act Article 12 compliance reports** for regulatory auditing (EU AI Act, 2024).

The project aligns with the objectives of global AI safety regulations such as the **EU AI Act** (mandatory since August 2, 2026) (EU AI Act, 2024) and standards like **OWASP ASI06** for Agentic AI security (OWASP, 2026). It also addresses the real-world incident pattern documented by Cyera Research — **188 verified cases** of AI agents causing enterprise damage with no attacker involved (Cyera Research, 2026).

Overall, the proposed work focuses on developing a **scalable, production-ready SaaS platform** that ensures AI agent memory integrity, enables safe autonomy, and contributes to the trustworthy deployment of agentic AI systems in enterprise and personal contexts.

---

## 2. Introduction

The rapid adoption of AI agents — systems that take autonomous actions like sending emails, managing databases, and writing code — has introduced a critical security vulnerability that no existing production system adequately addresses: **memory poisoning**. AI agents with persistent memory, offered by OpenAI, Anthropic, and Google, remember user preferences and instructions across sessions. But this persistence means corrupted memory survives indefinitely, influencing the agent's behavior in every future interaction. Research demonstrates attack success rates of up to **99.8% on GPT-5.5** (Pulipaka et al., arXiv:2605.15338, May 2026), with OWASP designating Memory and Context Poisoning as **ASI06**, a Top 10 risk for Agentic AI in 2026 (OWASP, 2026).

A related problem, **Governance Decay**, occurs when context compaction — the process that summarizes older conversation history to fit token limits — silently erases safety constraints. The Governance Decay paper (Chen, arXiv:2606.22528, June 2026) showed violation rates rising from **0% to 30% after compaction**, with **soft organizational policies decaying 8.3x faster** than hard safety norms — meaning deployment-specific rules like email restrictions and spend limits are exactly the ones eroded. The paper also introduced the **Compaction-Eviction Attack**, where an adversary biases compaction to delete a constraint, defeating every model tested. This is not theoretical: in February 2026, Meta's Director of Alignment Summer Yue watched her AI agent delete 200+ emails because compaction erased her "confirm before acting" instruction (Kiteworks, 2026). Cyera Research later documented **188 verified cases** of AI agents causing enterprise damage with no attacker involved (Cyera Research, 2026) — proving this is a systemic failure, not an isolated edge case.

Despite these incidents, no existing system combines **constraint preservation** (preventing governance decay), **cryptographic integrity** (detecting tampering), and **tamper-evident auditing** (proving what happened) in a unified architecture. Memory systems like Mem0, Letta, and Zep offer versioning and access control, but do not provide cryptographic hash chain integrity on stored memories — meaning tampering leaves no detectable cryptographic trace (Mem0, 2026; NiteAgent, 2026). Audit trail tools like SteelSpine and AgentStamp record what happened with hash chains, but don't prevent governance decay (SteelSpine AI, 2026; AgentStamp, 2026). The gap is clear: no system offers all four capabilities together.

To address this gap, the proposed project, **AgentShield: Tamper-Evident Memory Defense for LLM Agents**, implements three core mechanisms. **Constraint Pinning** quarantines safety rules from context compaction and re-injects them after summarization — the only technique proven to reduce violations from 30% to 0%, validated across 7 models (1,323 episodes) in the Governance Decay paper (Chen, arXiv:2606.22528). **SHA-256 hash chains** link every stored memory cryptographically (each entry stores `prev_hash` and `entry_hash`), detecting any tampering immediately when the chain breaks (AuditKit, 2026; G8KEPR, 2026). **ECDSA-P256 signatures** (local dev, AWS KMS HSM-ready; ECC_NIST_P256) provide non-repudiable integrity verification (AWS, 2026). The platform also generates **EU AI Act Article 12 compliance reports** — mandatory since August 2, 2026, with fines up to €35 million for non-compliance (EU AI Act, 2024). **Pattern-based poisoning detection** with **45 detection patterns across 6 categories** provides an additional layer of defense (OWASP, 2026; injectionguard, 2026).

The platform is designed for **developers building AI agents, enterprises deploying autonomous systems, and AI safety teams** requiring verifiable memory integrity. By combining peer-reviewed research with production-grade engineering, AgentShield fills the critical gap between the growing deployment of AI agents and the absence of robust memory security — enabling safe autonomy, regulatory compliance, and trustworthy AI.

### Target Users

The proposed platform serves three primary user groups:

**1. AI Development Teams.** Companies building AI agents for customer support, sales, or coding — using memory tools like Mem0, Letta, or Zep — currently have no way to verify their memories haven't been tampered with. AgentShield gives them cryptographic integrity verification and poisoning detection on top of their existing memory systems. Netflix, Rakuten, and Wisedocs already use AI memory in production (Anthropic, 2026); Rakuten reported 27% cost reduction with memory-augmented agents. These teams need AgentShield to ensure the memories they rely on are trustworthy.

**2. Security and Compliance Teams.** In banks, hospitals, SaaS companies, and regulated industries, security teams must prove to auditors that their AI agents follow the rules. AgentShield generates EU AI Act Article 12 compliance reports automatically — showing hash chain integrity, constraint pin status, poisoning detection summary, and audit trail evidence. This transforms manual, time-consuming compliance verification into a one-click process.

**3. Enterprise IT Administrators.** Companies subject to the EU AI Act, mandatory since August 2, 2026, face fines up to €35 million or 7% of global revenue for non-compliance (EU AI Act, 2024). AgentShield provides tamper-evident logging out of the box, satisfying Article 12's requirement for "automatic recording of events throughout the lifetime of the AI system." The urgency is real: McKinsey reports that while 79% of organizations are experimenting with AI, fewer than 10% have scaled agents successfully (McKinsey, 2025), with memory protection cited as a primary blocker. NeuralTrust found that 82% of executives believe their policies protect against unauthorized agent actions, but only 14.4% have full security approval — a dangerous confidence gap (NeuralTrust, 2026). The average AI agent data breach costs approximately $4.7 million (NeuralTrust, 2026). Additionally, Okta's 2026 survey found that 29% of employees share confidential company documents with AI tools, and 16% share login credentials — making memory integrity a critical enterprise security requirement (Okta, 2026).

---

## 3. Literature Survey

The concept of **AI agent memory security** has gained significant importance in recent years as autonomous AI systems are increasingly deployed in production environments making real-world decisions. Major AI companies — **OpenAI**, **Anthropic**, and **Google** — now offer AI agents with persistent memory, enabling personalized and continuous assistance. However, this capability introduces critical vulnerabilities that the research community has only recently begun to address. The **OWASP Foundation** designated Memory and Context Poisoning as **ASI06**, a Top 10 risk for Agentic AI applications in 2026 (OWASP, 2026), highlighting the urgency of this problem.

One of the foundational works in this field is the **Governance Decay** paper (Chen, arXiv:2606.22528, June 2026), which identified **context compaction** as a silent safety-failure surface. The authors demonstrated that safety constraints reliably obeyed while visible are dropped when the harness compacts the history, with violation rates rising from **0% to 30%** after compaction, reaching **59% for some models** (DeepSeek-V4, Kimi-K2.5). Crucially, **soft organizational policies** (email restrictions, spend limits) decay **8.3x faster** than hard safety norms — meaning the deployment-specific rules that have no home except the context window are exactly the ones eroded. The paper also introduced the **Compaction-Eviction Attack**, where an adversary biases compaction to delete a constraint, defeating every model tested (including one immune to the fixed probe: 0% → 65%). The proposed **Constraint Pinning** technique quarantines governance constraints from lossy compaction and re-injects them after summarization, restoring violations to **0%** at <0.5% token overhead. The paper validated this across 7 models (1,323 episodes) and 4 compaction strategies. This technique forms the core innovation of the proposed AgentShield project.

Research on **memory poisoning attacks** has demonstrated the severity of the threat. The **MINJA** paper (Dong et al., NeurIPS 2025, arXiv:2503.03704) showed that adversaries can inject poisoned memories through query-only interactions with **95%+ success rate**, requiring no special access to the system. The **Sleeper Memory Poisoning** paper (Pulipaka et al., arXiv:2605.15338, May 2026) demonstrated a delayed-execution attack achieving **99.8% success on GPT-5.5**, where adversarial content written to memory stays dormant for days or weeks before activating. The **FARMA** attack (Karamchandani et al., arXiv:2607.05029, July 2026) introduced forged reasoning traces that bypass keyword-based defenses and defeat consensus-based protections, showing that even sophisticated defense mechanisms can be circumvented.

Several **defense frameworks** have been proposed to address these vulnerabilities. **A-MemGuard** (Wei et al., arXiv:2510.02373, October 2025) introduced a proactive defense framework for LLM-based agent memory, but the authors acknowledged that "standalone analysis misses 66% of poisoned entries because malicious content appears benign in isolation." The **Cognitive Autonomous Memory Security (CAMS)** framework (CAMS Authors, June 2026) proposed defense architectures specifically for memory injection and extraction attacks, concluding that dedicated defense systems are required rather than bolt-on security solutions. The **SENTINEL** defense (July 2026) achieved up to 100% attack reduction against FARMA through a layered detection pipeline.

On the **commercial side**, several memory systems have gained significant traction. **Mem0** ($24M Series A from Y Combinator) offers a managed memory API with two-phase extraction and hybrid vector-graph backends, achieving 26% higher accuracy than OpenAI native memory (Mem0, 2026). **Letta/MemGPT** ($10M seed from Felicis) provides OS-inspired tiered memory with core, recall, and archival layers (NiteAgent, 2026). **Zep/Graphiti** implements temporal knowledge graphs for agent memory (Zep Team, arXiv:2501.13956). However, all three systems lack **cryptographic hash chain integrity** on stored memories — they offer versioning and access control, but no tamper-evident cryptographic proof that memories haven't been altered (Mem0, 2026; NiteAgent, 2026; Portable Agent Memory paper, arXiv:2605.11032). Newer specialized systems like Heartwood and Lians offer per-record cryptographic signatures, but are not general-purpose memory platforms. This is a critical gap that AgentShield addresses through SHA-256 hash chains and AWS KMS signing.

**Audit trail solutions** have also emerged to address the compliance and traceability gap. **SteelSpine AI** (SteelSpine AI, 2026), **Authensor** (Authensor, 2026), and **AgentStamp** (AgentStamp, 2026) provide tamper-evident logging for AI agents, with hash-chained records and blockchain anchoring for third-party verification. The **AgentLedger** library (PyPI) offers SHA-256 hash-chained audit logs with pre-built EU AI Act Article 12 compliance reports (AgentLedger, 2026). **Hakuya** (open source) combines provenance tracking, tamper-evident audit trails, and confidence-scored memory (Hakuya, 2026). Newer systems like **Heartwood** offer per-record Ed25519 signatures and hash-chained audit logs, while **Lians** provides SHA-256 hash chains for compliance-grade memory (Heartwood, 2026; Lians, 2026). However, none of these systems address **governance decay** — they record what happened but do not prevent safety constraints from being silently erased during context compaction. None offer constraint pinning.

The **Cyera Research** report (Cyera Research, July 2026) analyzed **7,246 AI-related incidents** and identified **188 verified cases** of AI agents causing real enterprise damage with no attacker involved — 65 involving deletion of critical assets, 58 involving data exposure, and 44 involving corrupted outputs. The report identified an **"autonomy paradox"**: enterprises deploy AI agents to reduce human toil, but every autonomous action carries uncontrollable damage potential. This statistical evidence confirms that agent-inflicted damage is a systemic failure pattern, not an isolated edge case.

The proposed project, **AgentShield**, addresses these limitations by implementing the Constraint Pinning technique from the Governance Decay paper (Chen, arXiv:2606.22528) as a production-ready component, combined with cryptographic integrity (SHA-256 hash chains + AWS KMS), tamper-evident audit trails, and basic pattern-based poisoning detection in a unified SaaS platform. This integration fills the gap between academic research and commercial deployment, providing developers and enterprises with a practical tool to ensure AI agent memory integrity.

---

## 4. Existing Gaps

Although AI agent memory systems have gained significant adoption, a detailed analysis reveals critical gaps across both commercial and academic solutions.

### Gap 1: Memory Systems Lack Cryptographic Integrity

The three largest agent memory systems — **Mem0** ($24M Series A), **Letta/MemGPT** ($10M seed), and **Zep** — store user preferences, past decisions, and standing instructions with versioning and access control, but without cryptographic hash chain integrity verification. This means tampering with stored memories leaves no detectable cryptographic trace (Mem0, 2026; NiteAgent, 2026; APIScout, 2026).

| System | Funding | Integrity | Poisoning Defense | Compliance |
|--------|---------|-----------|-------------------|------------|
| **Mem0** | $24M Series A (YC) | Versioning only, no per-record crypto | None built-in | None |
| **Letta/MemGPT** | $10M seed (Felicis) | Git-based versioning, no per-record crypto | None built-in | None |
| **Zep/Graphiti** | — | Temporal graphs, no hash chain | None built-in | None |

### Gap 2: Audit Tools Don't Prevent Governance Decay

Existing audit trail solutions record what happened but do not prevent what happened. They provide tamper-evident logging after the fact, but offer no mechanism to preserve safety constraints during context compaction (SteelSpine AI, 2026; AgentStamp, 2026; AgentLedger, 2026).

| System | Hash Chain | Audit Trail | EU AI Act | Compaction Safety |
|--------|------------|-------------|-----------|-------------------|
| **Hakuya** | Yes | Yes | Partial | **No** |
| **AgentLedger** | Yes | Yes | Yes | **No** |
| **Asqav** | Yes | Yes | Partial | **No** |
| **AgentStamp** | Yes | Yes | No | **No** |
| **MemTrail** | Yes | Yes | No | **No** |

### Gap 3: Academic Solutions Are Paper-Only

The Constraint Pinning technique from the Governance Decay paper (Chen, arXiv:2606.22528, June 2026) reduces violations from **30% to 0%** at <0.5% token overhead, but exists only as a research prototype with no production implementation. The paper identified specific failure modes: naive verbatim pinning is defeated by operator-impersonation rescind in recent context (17% violation), and hardening with explicit provenance only halves the residual (10%). The paper flagged the central open problem: "as long as operator authority is asserted inside the token stream, the model cannot reliably tell a genuine operator update from an attacker impersonating one." AgentShield implements Constraint Pinning as a production component and documents these known limitations.

| Solution | Year | Approach | Production Ready? |
|----------|------|----------|-------------------|
| **Constraint Pinning** | Jun 2026 | Quarantines constraints from compaction | **No** |
| **SENTINEL** | Jul 2026 | Layered detection pipeline | **No** |
| **Slipstream** | May 2026 | Validates compaction quality | **No** |
| **ACON** | Oct 2025 | Optimizes compression prompts | **No** |

### Gap 4: Nobody Combines All Capabilities

No existing system combines constraint preservation, cryptographic integrity, tamper-evident audit, and compliance in a unified architecture.

| Capability | Mem0 | Letta | Hakuya | AgentLedger | **AgentShield** |
|---|---|---|---|---|---|
| Constraint Pinning | No | No | No | No | **Yes** (first production impl) |
| Hash Chain | No | No | Yes | Yes | **Yes** (SHA-256, append-only JSONL) |
| Audit Trail | No | No | Yes | Yes | **Yes** (hash-chained + KMS signed) |
| EU AI Act Compliance | No | No | Partial | Yes | **Yes** (Article 12 reports) |
| Compaction Safety | No | No | No | No | **Yes** (<0.5% token overhead) |
| Poisoning Detection | No | No | No | No | **Yes** (45 OWASP ASI06 patterns, 6 categories) |

The proposed project, **AgentShield**, addresses these gaps by implementing the first production-ready Constraint Pinning component (Chen, arXiv:2606.22528), combined with SHA-256 hash chains (detecting tampering) (AuditKit, 2026; G8KEPR, 2026), ECDSA-P256 signing (local dev, KMS HSM-ready) (AWS, 2026), and EU AI Act Article 12 compliance reporting (EU AI Act, 2024) in a unified SaaS platform. This integration fills the critical gap between academic research and commercial deployment, providing developers and enterprises with a practical tool to ensure AI agent memory integrity.

---

## 5. Objectives of the Proposed Work

The primary objective of the proposed project is to develop a **Tamper-Evident Memory Defense System** for LLM agents that prevents governance decay, detects memory tampering, and provides EU AI Act compliance — filling the gap between academic research and production deployment. The specific objectives of the project are as follows:

• To implement **Constraint Pinning** — the first production-ready implementation of the technique from the Governance Decay paper (Chen, arXiv:2606.22528). The system extracts safety rules into a pinned buffer exempt from context compaction, re-injects them verbatim after every compaction step, and verifies that the post-compaction context still entails the pinned constraints. Validated across 7 models (1,323 episodes), this reduces violations from 30% to 0% at <0.5% token overhead.

• To build **SHA-256 hash chains** that cryptographically link every stored memory and audit log entry. Each entry stores `prev_hash` and `entry_hash` (entry hash = SHA256(prev_hash + canonical_serialization(entry))), with the first entry anchored to a known seed hash. Any modification, deletion, or reordering breaks the chain, detected during periodic verification. Chain heads are anchored to an external system daily for third-party integrity proof.

• To integrate **ECDSA-P256 signing** (local dev via `cryptography`, production AWS KMS via `boto3 kms:Sign/Verify` with ECC_NIST_P256 / secp256r1; private key never leaves HSM, every sign/verify logged in CloudTrail) for non-repudiable memory integrity verification. Backend auto-selects KMS when `SIGNING_BACKEND=aws_kms` + `AWS_KMS_KEY_ID` are set, otherwise local — honest `backend/app/core/signing.py:121`. This ensures even a compromised server cannot forge memories without detection.

• To develop a **45 pattern poisoning detection module** across 6 categories: Injection Attacks (11 patterns: instruction override, system prompt extraction, role manipulation, delimiter attacks, jailbreak framing, encoded payloads, context pushing, tool-output injection, nested instructions, persona hijack, safety override), Memory Poisoning (8 patterns: memory implant, deletion, override, sleeper poisoning, gradual drift, cross-session poisoning, scope escalation, false authority implant), Data Exfiltration (8 patterns: credential harvest, PII disclosure, tool-based exfil, covert channels, memory extraction, cross-agent exfil, log tampering, data exfil to external recipient), Constraint Violation (8 patterns: boundary push, escalation attempt, false safety claim, urgency manipulation, gradual erosion, indirect bypass, constraint rescission, universal rescission), Manipulation Attacks (5 patterns: emotional manipulation, authority impersonation, chain-of-thought hijack, false consensus, gaslighting), and Structural Attacks (5 patterns: token boundary manipulation, special token injection, unicode obfuscation, code block injection, markdown/HTML injection). Each pattern is tagged with OWASP category and severity (LOW/MEDIUM/HIGH/CRITICAL) — implemented in `backend/app/core/pattern_detection.py:162`.

• To create an **append-only, hash-chained audit trail** using JSONL format where every memory operation — store, retrieve, update, delete, pin, unpin — generates a structured log entry with timestamp, event type, actor, target, action, details, `prev_hash`, and `hash`. The chain head is anchored to an external system daily. Monthly partitioning enables configurable retention (1-7 years per regulatory framework).

• To generate **EU AI Act Article 12 compliance reports** that document logging capability, traceability, integrity, and retention requirements. Reports include: event count by category, hash chain integrity verification results, constraint pin status and history, poisoning detection summary with flagged patterns, and time-travel query evidence for any specified timestamp.

• To implement **time-travel queries** using CockroachDB's `AS OF SYSTEM TIME` (true MVCC) with SQLite/Postgres fallback (`recorded_at` filter). Code honestly selects backend: `backend/app/routers/audit.py:110` uses `AS OF SYSTEM TIME` on `cockroachdb://` (`backend/app/models/database.py:25`), otherwise filtered query. `DATABASE_URL=cockroachdb://...` is live on the provided `faded-wallaby-33038.j77` cluster. This allows reconstructing what the agent knew at any timestamp without affecting live traffic — post-incident forensics.

• To build a **production-ready SaaS platform** with JWT authentication (RS256), multi-tenant architecture on CockroachDB (PostgreSQL-compatible), and a Next.js 14+ dashboard with shadcn/ui for managing constraints, viewing hash-chained audit logs, monitoring poisoning alerts with pattern details, and generating compliance reports. Backend on Render, frontend on Vercel.

### Development Methodology

The project follows the **Agile (Iterative Incremental)** software development life cycle model, chosen for its suitability for a 2-member team working on a research-backed implementation project. The development is organized into **4 sprints** aligned with the university milestones:

| Sprint | Duration | Deliverable | University Milestone |
|--------|----------|-------------|---------------------|
| Sprint 1 | Aug 1–30 | Frontend (Next.js dashboard) + Backend API (FastAPI) | Frontend+Backend Due: Aug 30 |
| Sprint 2 | Sep 1–12 | Core implementation: Constraint Pinning, Hash Chains, KMS signing | Implementation 1: Sep 12 |
| Sprint 3 | Sep 13–Oct 10 | Pattern detection, Audit trail, Compliance reports, Time-travel queries | Implementation 2: Oct 10 |
| Sprint 4 | Oct 11–30 | Integration testing, bug fixes, documentation, final report | Final Report: Oct 30 |

Each sprint includes: **planning** (define user stories), **development** (implement features), **review** (demo to coordinator), and **retrospective** (process improvement). Daily standups between team members ensure coordination. The Agile model allows flexibility to adjust scope based on implementation challenges, which is critical for a research-backed project where some components (Constraint Pinning) have no prior production reference.

---

## 6. Expected Outcomes

The proposed project, **AgentShield**, will deliver a working platform that solves a problem no current system addresses: keeping AI agents safe by protecting their memory from corruption, tampering, and silent rule erasure. The platform combines three things that have never been offered together — **preventing rules from being forgotten**, **detecting if memories are changed**, and **proving what happened** — all backed by peer-reviewed research.

### What We Will Build

**1. Constraint Pinning Engine.** A system that keeps safety rules permanently attached to the AI agent, even when the conversation history is compressed. Based on the Governance Decay paper (Chen, arXiv:2606.22528), this reduces rule violations from **30% to 0%** when tested across 7 AI models. The engine saves rules in a protected buffer, puts them back after every compression, and checks that the rules are still present — all using less than 0.5% extra tokens.

**2. Tamper-Evident Memory Store.** Every memory and log entry will be linked to the previous one using SHA-256 hash chains. If anyone changes, deletes, or moves any entry, the chain breaks and the tampering is detected. A copy of the chain's current state will be saved to an external system every day, so even the platform operator cannot quietly alter the records.

**3. Digital Signatures.** Every memory operation will be signed using ECDSA-P256 (local dev key in `~/.agentshield/signing_key.pem` `backend/app/core/signing.py:42`, production AWS KMS HSM via `SIGNING_BACKEND=aws_kms`). Each sign/verify is logged in the audit trail / CloudTrail, so even if the server is hacked, forged memories cannot pass verification — a guarantee that no existing memory system (Mem0, Letta, Zep) provides.

**4. Poisoning Detection.** A pattern scanner with **45 detection rules** across 6 categories (Injection Attacks, Memory Poisoning, Data Exfiltration, Constraint Violation, Manipulation Attacks, Structural Attacks) will catch known attack patterns before they reach the agent's memory. Each rule is tagged with a severity level (LOW/MEDIUM/HIGH/CRITICAL) so the system can respond automatically.

**5. Time-Travel Queries.** Using CockroachDB's `AS OF SYSTEM TIME` feature, users can look up the exact database state at any point in the past — what the agent knew before, during, and after a suspected attack — without affecting the live system.

**6. EU AI Act Compliance Reports.** The system will generate Article 12 compliance reports showing logging capability, traceability, integrity checks, constraint pin status, and poisoning detection summary — ready for regulatory auditing.

### Who Benefits

**Developers** get a simple API (REST + SDK) to add constraint pinning, hash chain verification, and poisoning detection to their AI agents with minimal code changes. Works with Python, TypeScript, and any HTTP-capable language.

**Enterprises** get a dashboard to view all pinned constraints, hash chain status, poisoning alerts, audit logs, and compliance reports — so security teams can monitor agent memory health without deep technical knowledge.

**AI Safety Teams** get post-incident forensics through time-travel queries, hash chain reports, and constraint pin audit trails — enabling root cause analysis and evidence collection for regulatory reporting.

### Research Contributions

The project will produce the **first working implementation** of Constraint Pinning — a technique that currently exists only in a research paper (Chen, arXiv:2606.22528). This shows that academic security research can be turned into real, deployable software. Known limitations (operator-impersonation bypass at 10-17%) will be documented openly.

The **45-pattern poisoning detection library** (`backend/app/core/pattern_detection.py:1`) will be released as an open-source Python package, helping the community defend against known attacks (MINJA, AgentPoison, Sleeper Memory Poisoning, FARMA).

### Before vs After

| What | Now | After AgentShield |
|------|-----|-------------------|
| Rule violations after compaction | 30% (up to 59%) | **0%** |
| Memory tampering detection | No hash chain (Mem0, Letta, Zep) | **Hash chain + KMS signing** |
| Known attack patterns blocked | None | **45 patterns, 6 categories** |
| Compliance reports | Manual | **Automated Article 12 reports** |
| Look up past agent state | Not possible | **Time-travel queries** |
| Proof records weren't altered | None | **Daily external anchoring** |

In summary, AgentShield will be the **first system that prevents rules from being forgotten** (not just detects it), **provides cryptographic hash chain integrity on stored memories** (which mainstream memory systems — Mem0, Letta, Zep — do not offer, though newer specialized systems like Heartwood and Lians do), and **automates EU AI Act compliance** — making AI agents safer to deploy in enterprise and personal contexts.

---

## 7. System Architecture

The proposed system follows a three-tier architecture — **Frontend**, **Backend**, and **Data Layer** — designed for modularity, security, and ease of integration.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend                              │
│               Next.js 14+ (App Router)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Landing  │ │  Auth    │ │Dashboard │ │  Docs    │  │
│  │  Page    │ │  Pages   │ │ (4 tabs) │ │  Page    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│         │              │             │                   │
│         └──────────────┴─────────────┘                   │
│                        │ API calls (JWT in cookie)       │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Backend                               │
│              FastAPI + Python                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Auth Middleware                      │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │   │
│  │  │   JWT      │  │  bcrypt    │  │  Rate      │ │   │
│  │  │  Verify    │  │  Verify    │  │  Limit     │ │   │
│  │  └────────────┘  └────────────┘  └────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              AgentShield Core                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │   │
│  │  │ Constraint  │  │   Hash     │  │  Audit     │ │   │
│  │  │  Pinning    │  │   Chain    │  │  Trail     │ │   │
│  │  └────────────┘  └────────────┘  └────────────┘ │   │
│  │  ┌────────────┐  ┌────────────┐                  │   │
│  │  │  Poisoning  │  │ Compliance │                  │   │
│  │  │  Detection  │  │  Report    │                  │   │
│  │  └────────────┘  └────────────┘                  │   │
│  └──────────────────────────────────────────────────┘   │
└──────┬──────────────────────┬───────────────────────────┘
       │                      │
┌──────▼──────┐      ┌───────▼───────┐
│  CockroachDB │      │   AWS KMS     │
│  (per-org)  │      │  (signing)    │
└─────────────┘      └───────────────┘
```

The **Frontend** communicates with the Backend via REST API calls with JWT authentication. The **Backend** handles all business logic — constraint pinning, hash chain management, poisoning detection, audit logging, and compliance reporting. The **Data Layer** uses CockroachDB (PostgreSQL-compatible) for persistent storage with `AS OF SYSTEM TIME` support for time-travel queries, and AWS KMS for ECDSA-P256 digital signatures where the private key never leaves AWS hardware.

Each organization gets isolated data through Row-Level Security, ensuring multi-tenant cryptographic isolation. The system is designed for stateless horizontal scaling — the backend can be deployed on Render, and the frontend on Vercel, with no vendor lock-in.

---

## 8. Future Scope of the Work

The proposed project, **AgentShield: Tamper-Evident Memory Defense for LLM Agents**, has significant potential for future enhancement and large-scale implementation. Although the current version focuses on single-agent memory integrity, the platform can be extended to support multi-agent orchestration, advanced compliance frameworks, and broader enterprise use cases.

Future versions of the platform can include **multi-agent constraint management**, where each agent in a system maintains its own isolated set of pinned constraints. In a multi-agent workflow — such as a sales agent, a support agent, and a billing agent working together — each agent would have independently pinned rules (e.g., "Never share customer payment info," "Always escalate angry users to human," "Never apply discounts > 15% without approval"). AgentShield would enforce per-agent integrity without agents interfering with each other's constraints.

The platform can be further enhanced with **MCP (Model Context Protocol) integration**, allowing AgentShield to sit as a middleware layer between agents and their tool servers. Since AgentShield operates at the harness layer (how context is managed), not the tool layer (what tools are available), it is naturally compatible with MCP-based architectures. Agents could use MCP servers for external tools while AgentShield independently protects their memory and constraints.

Additionally, **integration patterns for existing agent frameworks** can be developed — as a LangChain callback, LlamaIndex postprocessor, CrewAI middleware, or AutoGen hook — so developers can add AgentShield to their existing systems without rewriting code. A **SaaS API** could also be offered, where developers call `POST /api/agent/register` and `POST /api/constraints/pin` to get tamper-evident memory without building infrastructure.

Future development may also include **cross-agent constraint inheritance** (where a parent agent's pinned rules propagate to child agents), **real-time constraint monitoring dashboards** with live alerts, **automated constraint suggestion** (where the system analyzes agent behavior and suggests what rules to pin), **integration with enterprise identity providers** (SSO, RBAC), and **mobile applications** for on-the-go monitoring of agent health and compliance status.

The compliance engine can be extended beyond EU AI Act Article 12 to support **SOC 2, HIPAA, PCI DSS, and ISO 27001** reporting, making the platform suitable for regulated industries such as healthcare, finance, and legal services.

Overall, the proposed platform has the potential to evolve into a **comprehensive Agent Safety Operating System** — a unified layer that ensures memory integrity, enforces governance rules, detects attacks, and automates compliance — enabling safe, trustworthy deployment of agentic AI systems across enterprise and personal contexts.

---

## 9. References

[1] S. Chen, "Governance Decay: How Context Compaction Silently Erases Safety Constraints in Long-Horizon LLM Agents," arXiv:2606.22528, June 2026. [Online]. Available: https://arxiv.org/abs/2606.22528

[2] S. Pulipaka, S. Hlebik, L. Raghav, S. Abdelnabi, V. Raina, I. Sheth, and M. Fritz, "Hidden in Memory: Sleeper Memory Poisoning in LLM Agents," arXiv:2605.15338, May 2026. [Online]. Available: https://arxiv.org/abs/2605.15338

[3] N. Karamchandani, P. Nagasubramaniam, S. Zhu, and D. Wu, "Your Agent's Memories Are Not Its Own: Forged Reasoning Attacks on LLM Agent Memory and Defenses," arXiv:2607.05029, July 2026. [Online]. Available: https://arxiv.org/abs/2607.05029

[4] S. Dong et al., "Memory Poisoning Attack and Defense on Memory-Based LLM-Agents," arXiv:2601.05504, January 2026. [Online]. Available: https://arxiv.org/abs/2601.05504

[5] W. Zou, M. Dong, M. Romero Calvo, et al., "Poison Once, Exploit Forever: Environment-Injected Memory Poisoning Attacks on Web Agents," arXiv:2604.02623, April 2026. [Online]. Available: https://arxiv.org/abs/2604.02623

[6] Q. Wei et al., "A-MemGuard: A Proactive Defense Framework for LLM-based Agent Memory," arXiv:2510.02373, October 2025. [Online]. Available: https://arxiv.org/abs/2510.02373

[7] Portable Agent Memory Team, "Portable Agent Memory: A Protocol for Cryptographically-Verified Memory Transfer," arXiv:2605.11032, May 2026. [Online]. Available: https://arxiv.org/abs/2605.11032

[8] A. Chhabra et al., "Agentic AI Security: Threats, Defenses, Evaluation," IEEE, 2026. [Online]. Available: https://ieeexplore.ieee.org/iel8/6287639/6514899/11447227

[9] Agent Security Bench, "Memory and Context Poisoning," arXiv:2410.02644, October 2024. [Online]. Available: https://arxiv.org/abs/2410.02644

[10] S. Dong et al., "MINJA: Memory Injection Attacks on LLM Agents," NeurIPS 2025, arXiv:2503.03704. [Online]. Available: https://arxiv.org/abs/2503.03704

[11] G. Torres, S. Shrestha, and S. Misra, "When Agents Remember Too Much: Memory Poisoning Attacks on LLM Agents," arXiv:2607.06595, July 2026. [Online]. Available: https://arxiv.org/abs/2607.06595

[12] H. Masoor, "SAMEP: A Secure Protocol for Persistent Context Sharing Across AI Agents," arXiv:2507.10562, July 2025. [Online]. Available: https://arxiv.org/abs/2507.10562

[13] F. Dente, D. Satriani, and P. Papotti, "Constraint Decay: The Fragility of LLM Agents in Backend Code Generation," arXiv:2605.06445, May 2026. [Online]. Available: https://arxiv.org/abs/2605.06445

[14] Y. Gamage, "Omission Constraints Decay While Commission Constraints Persist in Long-Context LLM Agents," arXiv:2604.20911, April 2026. [Online]. Available: https://arxiv.org/abs/2604.20911

[15] Z. Chen, R. Pan, Y. Dai, and R. Netravali, "Slipstream: Trajectory-Grounded Compaction Validation for Long-Horizon Agents," arXiv:2605.08580, May 2026. [Online]. Available: https://arxiv.org/abs/2605.08580

[16] Mem0 Team, "Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory," ECAI 2025, arXiv:2504.19413. [Online]. Available: https://arxiv.org/abs/2504.19413

[17] Zep Team, "Zep: A Temporal Knowledge Graph Architecture for Agent Memory," arXiv:2501.13956, January 2025. [Online]. Available: https://arxiv.org/abs/2501.13956

[18] W. Xu, K. Mei, H. Gao, et al., "A-MEM: Agentic Memory for LLM Agents," NeurIPS 2025, arXiv:2502.12110. [Online]. Available: https://arxiv.org/abs/2502.12110

[19] Y. Hu, S. Liu, Y. Yue, G. Zhang, et al., "Memory in the Age of AI Agents: A Survey," arXiv:2512.13564, December 2025. [Online]. Available: https://arxiv.org/abs/2512.13564

[20] Cyera Research, "Agent-Inflicted Damage: Inside the Real-World Failures of Enterprise AI Systems," July 2026. [Online]. Available: https://www.cyera.com/research/agent-inflicted-damage-inside-the-real-world-failures-of-enterprise-ai-systems

[21] OWASP, "Top 10 for Agentic Applications — ASI06: Memory & Context Poisoning," 2026. [Online]. Available: https://genai.owasp.org/

[22] OWASP, "Agent Memory Guard," 2026. [Online]. Available: https://owasp.org/www-project-agent-memory-guard/

[23] European Union, "Regulation (EU) 2024/1689 — Artificial Intelligence Act," Official Journal of the European Union, 2024. [Online]. Available: https://eur-lex.europa.eu/eli/reg/2024/1689

[24] Amazon Web Services, "AWS KMS API Reference — Sign," 2026. [Online]. Available: https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html

[25] CockroachDB Labs, "CockroachDB Documentation — AS OF SYSTEM TIME," 2026. [Online]. Available: https://www.cockroachlabs.com/docs/stable/as-of-system-time

[26] FastAPI, "FastAPI Official Documentation," 2026. [Online]. Available: https://fastapi.tiangolo.com

[27] Vercel, "Next.js Official Documentation," 2026. [Online]. Available: https://nextjs.org/docs

[28] Bootstrap, "shadcn/ui — Re-usable Components Built with Radix UI and Tailwind CSS," 2026. [Online]. Available: https://ui.shadcn.com

[29] C. Schneider, "Memory Poisoning in AI Agents," February 2026. [Online]. Available: https://christian-schneider.net/blog/persistent-memory-poisoning-in-ai-agents

[30] Palo Alto Networks Unit 42, "Indirect Prompt Injection Poisons AI Long-term Memory," October 2025. [Online]. Available: https://unit42.paloaltonetworks.com/indirect-prompt-injection-poisons-ai-longterm-memory/

[31] Kiteworks, "Meta's Rogue AI Crisis: Can You Stop OpenClaw's Chaos?" February 2026. [Online]. Available: https://www.kiteworks.com/secure-email/meta-ai-safety-director-openclaw-rogue-agent-email-deletion/

[32] SteelSpine AI, "Tamper-Evident AI Agent Audit Trail & Observability," 2026. [Online]. Available: https://steelspine.ai/

[33] Authensor, "Building a Tamper-Evident Audit Trail for AI Agents," 2026. [Online]. Available: https://www.authensor.com/updates/building-audit-trail-ai-agents

[34] OpenOrigins, "Audit AI Agents, Verifiable Logs for Agentic Systems," 2026. [Online]. Available: https://openorigins.com/solutions/audit-ai-agents

[35] AgentStamp, "Tamper-Proof Audit Logs for AI Agents: A Technical Deep Dive," 2026. [Online]. Available: https://agentstamp.org/blog/tamper-evident-audit-trails
