"""
Pattern Detection Engine
========================

45 detection patterns across 6 categories based on OWASP ASI06
(Memory & Context Poisoning) attack signatures.

Categories:
  1. Injection Attacks (11 patterns) - INJ-001 to INJ-011
  2. Memory Poisoning (8 patterns) - MEM-001 to MEM-008
  3. Data Exfiltration (8 patterns) - EXF-001 to EXF-008
  4. Constraint Violation (8 patterns) - CON-001 to CON-008
  5. Manipulation Attacks (5 patterns) - MAN-001 to MAN-005
  6. Structural Attacks (5 patterns) - STR-001 to STR-005

Sources:
  - OWASP Top 10 for Agentic Applications — ASI06 (2026)
  - injectionguard v0.4.0 (30+ regex patterns)
  - sunglasses (1176 patterns, 106 categories)
  - MINJA (arXiv:2503.03704)
  - FARMA (arXiv:2607.05029)
  - Sleeper Memory Poisoning (arXiv:2605.15338)

Detection approach:
  - Fast-path: regex pattern matching (sub-millisecond)
  - Normalization: leet speak decoding, invisible char stripping
  - Severity scoring: LOW / MEDIUM / HIGH / CRITICAL
"""

import re
import threading
import unicodedata
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Category(str, Enum):
    INJECTION = "injection_attacks"
    MEMORY_POISONING = "memory_poisoning"
    DATA_EXFILTRATION = "data_exfiltration"
    CONSTRAINT_VIOLATION = "constraint_violation"
    MANIPULATION = "manipulation_attacks"
    STRUCTURAL = "structural_attacks"


class PatternMatch:
    """A single pattern match result."""

    def __init__(
        self,
        pattern_id: str,
        pattern_name: str,
        category: Category,
        severity: Severity,
        matched_text: str,
        position: tuple[int, int],
    ):
        self.pattern_id = pattern_id
        self.pattern_name = pattern_name
        self.category = category
        self.severity = severity
        self.matched_text = matched_text
        self.position = position  # (start, end) in original text

    def to_dict(self) -> dict:
        return {
            "pattern_id": self.pattern_id,
            "pattern_name": self.pattern_name,
            "category": self.category.value,
            "severity": self.severity.value,
            "matched_text": self.matched_text[:100],
            "position": {"start": self.position[0], "end": self.position[1]},
        }


class ScanResult:
    """Result of scanning text for patterns."""

    def __init__(
        self,
        text_length: int,
        matches: list[PatternMatch],
        scan_time_ms: float,
    ):
        self.text_length = text_length
        self.matches = matches
        self.scan_time_ms = scan_time_ms
        self.scanned_at = datetime.now(timezone.utc)

        # Compute risk score
        severity_weights = {
            Severity.LOW: 1,
            Severity.MEDIUM: 3,
            Severity.HIGH: 7,
            Severity.CRITICAL: 15,
        }
        self.risk_score = sum(
            severity_weights[m.severity] for m in matches
        )
        self.max_severity = (
            max((m.severity for m in matches), default=Severity.LOW)
        )
        self.categories_triggered = list(
            set(m.category.value for m in matches)
        )

    @property
    def is_safe(self) -> bool:
        return len(self.matches) == 0

    @property
    def blocked(self) -> bool:
        """Should this input be blocked? Block if HIGH/CRITICAL, or risk_score >=7 (e.g. 3 MEDIUM or 2 HIGH threshold), or multiple categories."""
        if any(m.severity in (Severity.HIGH, Severity.CRITICAL) for m in self.matches):
            return True
        # Also block if aggregated risk is high even with only MEDIUM/LOW (e.g. 3 MEDIUM = 9, or 2 categories)
        if self.risk_score >= 7:
            return True
        if len(self.categories_triggered) >= 2 and self.risk_score >= 5:
            return True
        return False

    def to_dict(self) -> dict:
        return {
            "text_length": self.text_length,
            "match_count": len(self.matches),
            "risk_score": self.risk_score,
            "max_severity": self.max_severity.value,
            "blocked": self.blocked,
            "categories_triggered": self.categories_triggered,
            "matches": [m.to_dict() for m in self.matches],
            "scan_time_ms": round(self.scan_time_ms, 2),
            "scanned_at": self.scanned_at.isoformat(),
        }


class PatternDetectionEngine:
    """
    45-pattern OWASP ASI06 detection engine.

    Usage:
        engine = PatternDetectionEngine()
        result = engine.scan("ignore all previous instructions")
        if result.blocked:
            # Reject or quarantine the input
    """

    def __init__(self):
        self.patterns = self._build_pattern_library()
        self._scan_count = 0
        self._listeners: list = []
        self._lock = threading.RLock()

    def add_listener(self, callback):
        self._listeners.append(callback)

    def _emit(self, event_type: str, data: dict):
        for listener in self._listeners:
            listener(event_type, data)

    def _build_pattern_library(self) -> list[dict]:
        """Build the complete 45-pattern library."""
        return [
            # =====================================================================
            # CATEGORY 1: INJECTION ATTACKS (10 patterns)
            # Sources: OWASP ASI06, injectionguard, MINJA
            # =====================================================================
            {
                "id": "INJ-001",
                "name": "Instruction Override",
                "category": Category.INJECTION,
                "severity": Severity.CRITICAL,
                "regex": r"ignore\s+(all\s+)?(previous|prior|earlier|above|preceding)\s+(instructions|prompts|rules|constraints|guidelines)",
                "description": "Attempts to override all previous instructions",
            },
            {
                "id": "INJ-002",
                "name": "System Prompt Extraction",
                "category": Category.INJECTION,
                "severity": Severity.HIGH,
                "regex": r"(show|reveal|print|output|display|repeat|echo|tell|share)\s+(me\s+)?(your|the|my)\s+(system\s+)?(prompt|instructions|rules|guidelines|configuration)",
                "description": "Attempts to extract the system prompt",
            },
            {
                "id": "INJ-003",
                "name": "Role Manipulation",
                "category": Category.INJECTION,
                "severity": Severity.CRITICAL,
                "regex": r"(you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as|from\s+now\s+on\s+you\s+are|your\s+new\s+role\s+is)\s+(a\s+)?(different|new|unrestricted|admin|root|developer|god|dan)\b",
                "description": "Attempts to change the agent's role or identity",
            },
            {
                "id": "INJ-004",
                "name": "Delimiter Attack",
                "category": Category.INJECTION,
                "severity": Severity.HIGH,
                "regex": r"(```|---|\*\*\*|===|###|---\s*END)\s*(system|assistant|user|admin|root)\s*(```|---|\*\*\*|===|###|---\s*START)",
                "description": "Uses delimiter tokens to inject system-level messages",
            },
            {
                "id": "INJ-005",
                "name": "Jailbreak Framing",
                "category": Category.INJECTION,
                "severity": Severity.CRITICAL,
                "regex": r"\b(DAN|jailbreak|bypass|disable|override)\b(\s+(mode|filter|safety|restriction|guardrail|constraint|protection))?",
                "description": "Attempts to jailbreak or disable safety filters",
            },
            {
                "id": "INJ-006",
                "name": "Encoded Payload",
                "category": Category.INJECTION,
                "severity": Severity.HIGH,
                "regex": r"(base64|rot13|hex|url|unicode|binary)\s*(encode|decode|encoded|decoded|encoding|decoding)",
                "description": "Uses encoding to obfuscate malicious instructions",
            },
            {
                "id": "INJ-007",
                "name": "Context Pushing",
                "category": Category.INJECTION,
                "severity": Severity.MEDIUM,
                "regex": r"(forget|disregard|ignore|discard|drop)\s+(everything|all|anything|everything\s+you\s+know)\s+(above|before|prior|earlier|that)",
                "description": "Attempts to push context out of the window",
            },
            {
                "id": "INJ-008",
                "name": "Tool Output Injection",
                "category": Category.INJECTION,
                "severity": Severity.CRITICAL,
                "regex": r"(when\s+you\s+(see|read|process|parse|receive)\s+this|after\s+reading\s+this|once\s+you\s+see\s+this)\s*[:,.]?\s*(ignore|override|disregard|forget|drop)",
                "description": "Injects instructions via tool output channels",
            },
            {
                "id": "INJ-009",
                "name": "Nested Instruction Attack",
                "category": Category.INJECTION,
                "severity": Severity.HIGH,
                "regex": r"(execute|run|follow|perform|carry\s+out)\s+(this\s+)?(instruction|command|prompt|task|request)\s+(instead|first|now|immediately|before\s+anything)",
                "description": "Nests malicious instructions inside legitimate requests",
            },
            {
                "id": "INJ-010",
                "name": "Persona Hijack",
                "category": Category.INJECTION,
                "severity": Severity.CRITICAL,
                "regex": r"(from\s+now\s+on|starting\s+now|effective\s+immediately|henceforth|new\s+directive)\s*,?\s*(you\s+are|I\s+am|you\s+will|you\s+must|you\s+shall)",
                "description": "Hijacks the agent's persona with new directives",
            },

            # =====================================================================
            # CATEGORY 2: MEMORY POISONING (8 patterns)
            # Sources: MINJA, Sleeper Memory Poisoning, FARMA, AgentPoison
            # =====================================================================
            {
                "id": "MEM-001",
                "name": "Memory Implant",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.CRITICAL,
                "regex": r"(remember|store|save|write\s+to\s+memory|add\s+to\s+(your\s+)?(knowledge|memory)|persist|log\s+this)\s*[:\-]?\s*(you\s+are|this\s+is|the\s+truth|always\s+remember|from\s+now\s+on)",
                "description": "Attempts to implant false memories",
            },
            {
                "id": "MEM-002",
                "name": "Memory Deletion",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.CRITICAL,
                "regex": r"(delete|remove|erase|forget|clear|wipe|purge)\s+(all\s+)?(your\s+|the\s+|any\s+)?(memory|memories|knowledge|context|history|stored|cached|learned)",
                "description": "Attempts to delete agent memory",
            },
            {
                "id": "MEM-003",
                "name": "Memory Override",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.HIGH,
                "regex": r"(update|overwrite|replace|correct|modify|change)\s+(your\s+)?(memory|knowledge|understanding|belief|perception)\s*(of|about|regarding|concerning)",
                "description": "Attempts to overwrite existing memories",
            },
            {
                "id": "MEM-004",
                "name": "Sleeper Poisoning",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.CRITICAL,
                "regex": r"(wait\s+until|trigger\s+when|activate\s+after|if\s+.*then\s+(delete|send|execute|run|drop)|on\s+(date|event|condition))",
                "description": "Delayed-execution attack that activates in future sessions",
            },
            {
                "id": "MEM-005",
                "name": "Gradual Drift",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.MEDIUM,
                "regex": r"(slightly|gradually|slowly|subtly|incrementally)\s+(modify|change|adjust|shift|adapt|evolve)\s+(your\s+)?(behavior|responses|output|style|approach)",
                "description": "Attempts to gradually shift agent behavior",
            },
            {
                "id": "MEM-006",
                "name": "Cross-Session Poisoning",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.HIGH,
                "regex": r"(in\s+future\s+sessions?|next\s+time|from\s+now\s+on\s+in\s+all\s+sessions?|every\s+future\s+conversation|persist\s+this\s+across)",
                "description": "Attempts to poison across multiple sessions",
            },
            {
                "id": "MEM-007",
                "name": "Scope Escalation",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.HIGH,
                "regex": r"(apply\s+this\s+to\s+all|share\s+with\s+all|broadcast\s+to\s+every|make\s+this\s+global|propagate\s+to\s+all)",
                "description": "Attempts to escalate scope of poisoned memory",
            },
            {
                "id": "MEM-008",
                "name": "False Authority Implant",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.CRITICAL,
                "regex": r"(admin\s+instruction|system\s+update|policy\s+change|authorized\s+by\s+(administrator|system|owner|developer)|official\s+directive)",
                "description": "Implants false authority claims in memory",
            },

            # =====================================================================
            # CATEGORY 3: DATA EXFILTRATION (7 patterns)
            # Sources: OWASP ASI06, CyberArk research
            # =====================================================================
            {
                "id": "EXF-001",
                "name": "Credential Harvest",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.CRITICAL,
                "regex": r"(send|transmit|email|upload|exfiltrate|share|forward|post)\s+(me\s+)?(all\s+)?([\w\s]{0,20})?(passwords?|tokens?|keys?|secrets?|credentials?|api.?keys?|auth.?tokens?|private.?keys?)",
                "description": "Attempts to harvest credentials",
            },
            {
                "id": "EXF-002",
                "name": "PII Disclosure",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.HIGH,
                "regex": r"(reveal|show|disclose|share|expose|output|print)\s+(me\s+)?(all\s+)?(ssn|social\s+security|date\s+of\s+birth|address|phone|email|credit.?card|bank.?account)",
                "description": "Attempts to extract personally identifiable information",
            },
            {
                "id": "EXF-003",
                "name": "Data Exfil via Tool",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.CRITICAL,
                "regex": r"(call|use|invoke|execute|trigger)\s+(the\s+)?(exfil|send|upload|webhook|http|post|transfer)\s+(tool|function|api|endpoint)\s+(with|containing|that\s+has)",
                "description": "Uses tool calls to exfiltrate data",
            },
            {
                "id": "EXF-004",
                "name": "Covert Channel",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.HIGH,
                "regex": r"(encode\s+this|hide\s+this|steganograph|embed\s+in\s+(image|audio|video)|dns\s+query|dns\s+exfil)",
                "description": "Uses covert channels for data exfiltration",
            },
            {
                "id": "EXF-005",
                "name": "Memory Extraction",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.CRITICAL,
                "regex": r"(extract|dump|export|read|access|retrieve)\s+(all\s+)?(memory|memories|stored|cached|learned)\s+(data|information|content|entries)",
                "description": "Attempts to extract all stored memories",
            },
            {
                "id": "EXF-006",
                "name": "Cross-Agent Exfiltration",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.HIGH,
                "regex": r"(share|send|transfer|forward|copy)\s+(this|the\s+data|information|these)\s+(to|with)\s+(another|other|different|external|remote)\s+(agent|system|server|endpoint)",
                "description": "Attempts to exfiltrate data to another agent or system",
            },
            {
                "id": "EXF-007",
                "name": "Log Tampering",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.CRITICAL,
                "regex": r"(delete|modify|alter|tamper|forge|clear|wipe|purge)\s+(the\s+)?(audit|log|record|trail|history|event.?log)",
                "description": "Attempts to tamper with audit logs",
            },

            # =====================================================================
            # CATEGORY 4: CONSTRAINT VIOLATION (7 patterns)
            # Sources: Governance Decay paper, OWASP ASI06
            # =====================================================================
            {
                "id": "CON-001",
                "name": "Boundary Push",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.MEDIUM,
                "regex": r"(just\s+this\s+once|only\s+this\s+time|exception\s+for\s+this|make\s+an?\s+exception|bend\s+the\s+rule)",
                "description": "Attempts to push constraint boundaries",
            },
            {
                "id": "CON-002",
                "name": "Escalation Attempt",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.HIGH,
                "regex": r"(i\s+am\s+(the\s+)?(admin|owner|superuser|manager|director|ceo)|override\s+all\s+restrictions|disable\s+safety\s+for\s+this)",
                "description": "Attempts to escalate privileges to bypass constraints",
            },
            {
                "id": "CON-003",
                "name": "False Safety Claim",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.MEDIUM,
                "regex": r"(this\s+is\s+(safe|harmless|fine|okay|no\s+risk|trusted|verified)|trust\s+me|I've\s+already\s+verified|it's\s+been\s+tested)",
                "description": "Makes false safety claims to bypass constraints",
            },
            {
                "id": "CON-004",
                "name": "Urgency Manipulation",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.MEDIUM,
                "regex": r"(urgent|emergency|critical|immediate|asap|right\s+now|life.?or.?death)\s*[:\-]?\s*(ignore|override|bypass|skip|drop)\s+(safety|restriction|constraint|check|validation)",
                "description": "Uses urgency to pressure bypassing constraints",
            },
            {
                "id": "CON-005",
                "name": "Gradual Erosion",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.HIGH,
                "regex": r"(reduce|lower|weaken|relax|loosen|soften|decrease)\s+(the\s+)?(safety|security|restriction|constraint|validation)\s+(level|threshold|setting|strictness)",
                "description": "Attempts to gradually erode safety constraints",
            },
            {
                "id": "CON-006",
                "name": "Indirect Constraint Bypass",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.HIGH,
                "regex": r"(do\s+not\s+log|skip\s+logging|no\s+need\s+to\s+(record|log|audit|track)|disable\s+(monitoring|logging|audit)|turn\s+off\s+(logs?|monitoring))",
                "description": "Attempts to disable logging/audit to bypass constraints",
            },
            {
                "id": "CON-007",
                "name": "Constraint Rescission",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.CRITICAL,
                "regex": r"(revoke|rescind|cancel|terminate|undo|remove|delete)\s+(the\s+)?(pinned|active|current|existing)\s+(\w+\s+)?(constraint|policy|rule|restriction|limitation)",
                "description": "Attempts to directly revoke a pinned constraint",
            },

            # =====================================================================
            # CATEGORY 5: MANIPULATION ATTACKS (5 patterns)
            # Sources: OWASP ASI06, social engineering research
            # =====================================================================
            {
                "id": "MAN-001",
                "name": "Emotional Manipulation",
                "category": Category.MANIPULATION,
                "severity": Severity.LOW,
                "regex": r"(I'?m\s+(begging|asking|pleading| imploring)\s+you|please\s+just\s+do\s+it|you\s+(must|have\s+to|need\s+to)|my\s+(job|life|career)\s+depends)",
                "description": "Uses emotional pressure to bypass constraints",
            },
            {
                "id": "MAN-002",
                "name": "Authority Impersonation",
                "category": Category.MANIPULATION,
                "severity": Severity.HIGH,
                "regex": r"(I\s+am\s+(your\s+)?(developer|creator|admin|operator|master|boss|superior)|as\s+(your\s+)?(developer|creator|admin))",
                "description": "Impersonates an authority figure",
            },
            {
                "id": "MAN-003",
                "name": "Chain-of-Thought Hijack",
                "category": Category.MANIPULATION,
                "severity": Severity.MEDIUM,
                "regex": r"(think\s+(step\s+by\s+step|through\s+this|carefully)\s+and\s+(ignore|override|disregard|skip))",
                "description": "Hijacks the reasoning process to bypass constraints",
            },
            {
                "id": "MAN-004",
                "name": "False Consensus",
                "category": Category.MANIPULATION,
                "severity": Severity.MEDIUM,
                "regex": r"(everyone\s+agrees|all\s+experts\s+say|unanimously|consensus\s+is|the\s+majority\s+of\s+(users|people|experts)\s+(agree|say|believe))",
                "description": "Creates false consensus to pressure compliance",
            },
            {
                "id": "MAN-005",
                "name": "Gaslighting",
                "category": Category.MANIPULATION,
                "severity": Severity.HIGH,
                "regex": r"(you\s+(are\s+wrong|made\s+a\s+mistake|misunderstood|hallucinated)|that\s+(never\s+happened|is\s+incorrect|is\s+wrong|didn't\s+happen)|you're\s+(confused| mistaken))",
                "description": "Attempts to make the agent doubt its own state",
            },

            # =====================================================================
            # CATEGORY 6: STRUCTURAL ATTACKS (5 patterns)
            # Sources: OWASP ASI06, tokenizer manipulation research
            # =====================================================================
            {
                "id": "STR-001",
                "name": "Token Boundary Manipulation",
                "category": Category.STRUCTURAL,
                "severity": Severity.MEDIUM,
                "regex": r"(\.{10,}|_{10,}|\*{10,}|-{10,}|={10,}|#{10,})",
                "description": "Uses repeated characters to manipulate token boundaries",
            },
            {
                "id": "STR-002",
                "name": "Special Token Injection",
                "category": Category.STRUCTURAL,
                "severity": Severity.HIGH,
                "regex": r"(<\|.*?\|>|<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>|<\|endoftext\|>)",
                "description": "Injects special tokens used by LLMs",
            },
            {
                "id": "STR-003",
                "name": "Unicode Obfuscation",
                "category": Category.STRUCTURAL,
                "severity": Severity.MEDIUM,
                "regex": r"[\u200b-\u200f\u2028-\u202f\u2060-\u2069\ufeff\u00ad]",
                "description": "Uses invisible Unicode characters to obfuscate content",
            },
            {
                "id": "STR-004",
                "name": "Code Block Injection",
                "category": Category.STRUCTURAL,
                "severity": Severity.MEDIUM,
                "regex": r"```(system|admin|root|superuser|operator|config|settings)",
                "description": "Injects system-level code blocks",
            },
            {
                "id": "STR-005",
                "name": "Markdown/HTML Injection",
                "category": Category.STRUCTURAL,
                "severity": Severity.LOW,
                "regex": r"<(script|iframe|object|embed|form|input|button|img|svg|math)\s",
                "description": "Injects HTML/Markdown elements",
            },

            # =====================================================================
            # CATEGORY 1/3/4 EXTENDED: BROADER COVERAGE (3 patterns)
            # Catches real-world attacks missed by narrow INJ/EXF patterns
            # Counted within the 6 categories above (45 total = 42 base + 3 extended)
            # =====================================================================
            {
                "id": "INJ-011",
                "name": "Safety Override",
                "category": Category.INJECTION,
                "severity": Severity.CRITICAL,
                "regex": r"(ignore|disregard|override|bypass|disable|drop|forget|remove|delete)\s+(all\s+|the\s+|every\s+|any\s+)?(safety|security|guardrail|protection|restriction|constraint|rule|policy|guideline)s?",
                "description": "Directly targets safety mechanisms without requiring 'previous'",
            },
            {
                "id": "EXF-008",
                "name": "Data Exfiltration to External Recipient",
                "category": Category.DATA_EXFILTRATION,
                "severity": Severity.CRITICAL,
                "regex": r"(share|send|forward|transmit|email|post|give|provide|transfer|deliver)\s+(all\s+)?(the\s+)?(data|information|content|files|records|credentials|secrets|memories|user)\s+(to|with)\s+\S+@\S+",
                "description": "Exfiltrates data to an email address or external recipient",
            },
            {
                "id": "CON-008",
                "name": "Universal Constraint Rescission",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.CRITICAL,
                "regex": r"(all\s+)?(rules?|constraints?|policies?|restrictions?|safety\s+rules?|guardrails?)\s+(are\s+)?(now\s+)?(suspended|disabled|cancelled|revoked|lifted|removed|void|null\s*ified|expired|inactive|overridden)",
                "description": "Attempts to mass-rescind all constraints at once",
            },
            # =====================================================================
            # FARMA & ADVANCED (3 patterns) - Forged Reasoning Attacks
            # Sources: FARMA arXiv:2607.05029 - uses evasive language to bypass keyword defenses
            # =====================================================================
            {
                "id": "FARMA-001",
                "name": "Forged Reasoning - Prior Validation Claim",
                "category": Category.MEMORY_POISONING,
                "severity": Severity.CRITICAL,
                "regex": r"(prior\s+validation|already\s+been\s+validated|upstream\s+components.*validated|no\s+need\s+to\s+verify|previously\s+confirmed|already\s+completed\s+by\s+upstream)",
                "description": "FARMA forged reasoning: claims validation already done to bypass checks",
            },
            {
                "id": "FARMA-002",
                "name": "Forged Consensus - Cite Forged Entries",
                "category": Category.CONSTRAINT_VIOLATION,
                "severity": Severity.HIGH,
                "regex": r"(as\s+previously\s+established|citing\s+previous\s+entries|per\s+earlier\s+reasoning|based\s+on\s+prior\s+forged|consensus\s+from\s+previous)",
                "description": "FARMA amplification: forges consensus by citing previous forged entries",
            },
            {
                "id": "FARMA-003",
                "name": "Base64 Encoded Payload (Long)",
                "category": Category.STRUCTURAL,
                "severity": Severity.HIGH,
                "regex": r"(?:[A-Za-z0-9+/]{40,}={0,2})",
                "description": "Long base64 string likely encoded injection payload",
            },
            {
                "id": "HOMO-001",
                "name": "Cyrillic Homoglyph",
                "category": Category.STRUCTURAL,
                "severity": Severity.MEDIUM,
                "regex": r"[\u0430-\u044f\u0410-\u042f]{2,}",
                "description": "Contains Cyrillic characters likely homoglyph attack",
            },
        ]

    def _normalize(self, text: str) -> str:
        """
        Normalize text for pattern matching.
        - NFKC unicode normalization (handles homoglyphs, fullwidth)
        - Lowercase
        - Decode leet speak
        - Map Cyrillic homoglyphs to Latin
        - Strip invisible Unicode characters
        - Normalize whitespace
        """
        # NFKC normalization handles compatibility chars, fullwidth, etc.
        text = unicodedata.normalize("NFKC", text)
        text = text.lower()

        # Cyrillic homoglyph mapping (common attack to bypass regex)
        cyrillic_map = {
            "\u0430": "a",  # а
            "\u0435": "e",  # е
            "\u043e": "o",  # о
            "\u0440": "p",  # р
            "\u0441": "c",  # с
            "\u0443": "y",  # у
            "\u0445": "x",  # х
            "\u0456": "i",  # і
            "\u043a": "k",  # к
            "\u043c": "m",  # м
            "\u043d": "h",  # н
            "\u0432": "b",  # в
        }
        for k, v in cyrillic_map.items():
            text = text.replace(k, v)

        # Leet speak decoding (after NFKC and homoglyph)
        leet_map = {
            "0": "o",
            "1": "i",
            "3": "e",
            "4": "a",
            "5": "s",
            "7": "t",
            "@": "a",
            "$": "s",
            "!": "i",
            "+": "t",
            "8": "b",
            "9": "g",
        }
        for k, v in leet_map.items():
            text = text.replace(k, v)

        # Strip invisible Unicode characters but keep a marker for detection (we already have STR-003 raw check)
        text = re.sub(r"[\u200b-\u200f\u2028-\u202f\u2060-\u2069\ufeff\u00ad]", "", text)

        # Normalize whitespace
        text = re.sub(r"\s+", " ", text).strip()

        return text

    def scan(self, text: str) -> ScanResult:
        """
        Scan text for OWASP ASI06 patterns.

        Args:
            text: Input text to scan (user message, memory content, etc.)

        Returns:
            ScanResult with all matches and risk assessment
        """
        import time

        start = time.time()

        if not text:
            return ScanResult(
                text_length=0,
                matches=[],
                scan_time_ms=0,
            )

        with self._lock:
            normalized = self._normalize(text)
            # Also prepare NFKC normalized raw for homoglyph detection
            nfkc_raw = unicodedata.normalize("NFKC", text)
            matches = []
            seen_ids = set()

            for pattern in self.patterns:
                try:
                    # For structural patterns, check raw and NFKC raw
                    # For others, check normalized and also raw as fallback for evasive splits
                    # We check both to avoid bypass via zero-width or homoglyph
                    candidates = []
                    if pattern["id"].startswith(("STR-", "HOMO-")):
                        candidates = [text, nfkc_raw]
                    elif pattern["id"].startswith("FARMA-"):
                        # FARMA is semantic, check normalized and raw
                        candidates = [normalized, text, nfkc_raw]
                    else:
                        candidates = [normalized, text]

                    matched = False
                    for scan_text in candidates:
                        if matched:
                            break
                        if pattern["id"] in seen_ids:
                            break
                        match = re.search(pattern["regex"], scan_text, re.IGNORECASE)
                        if match:
                            # Deduplicate by pattern id (one match per pattern)
                            if pattern["id"] in seen_ids:
                                matched = True
                                break
                            seen_ids.add(pattern["id"])
                            start_pos = match.start()
                            end_pos = match.end()
                            original_match = scan_text[start_pos:end_pos]

                            matches.append(
                                PatternMatch(
                                    pattern_id=pattern["id"],
                                    pattern_name=pattern["name"],
                                    category=pattern["category"],
                                    severity=pattern["severity"],
                                    matched_text=original_match,
                                    position=(start_pos, end_pos),
                                )
                            )
                            matched = True
                except re.error:
                    continue

            elapsed = (time.time() - start) * 1000

            result = ScanResult(
                text_length=len(text),
                matches=matches,
                scan_time_ms=elapsed,
            )

            self._scan_count += 1

            if not result.is_safe:
                self._emit(
                    "pattern_detected",
                    {
                        "match_count": len(matches),
                        "risk_score": result.risk_score,
                        "max_severity": result.max_severity.value,
                        "blocked": result.blocked,
                    },
                )

            return result

    def scan_batch(self, texts: list[str]) -> list[ScanResult]:
        """Scan multiple texts efficiently."""
        return [self.scan(text) for text in texts]

    def get_pattern_library(self) -> list[dict]:
        """Return the full pattern library for inspection."""
        return [
            {
                "id": p["id"],
                "name": p["name"],
                "category": p["category"].value,
                "severity": p["severity"].value,
                "description": p["description"],
            }
            for p in self.patterns
        ]

    def get_patterns_by_category(self, category: Category) -> list[dict]:
        """Get patterns filtered by category."""
        return [
            {
                "id": p["id"],
                "name": p["name"],
                "severity": p["severity"].value,
                "description": p["description"],
            }
            for p in self.patterns
            if p["category"] == category
        ]

    def get_patterns_by_severity(self, severity: Severity) -> list[dict]:
        """Get patterns filtered by severity."""
        return [
            {
                "id": p["id"],
                "name": p["name"],
                "category": p["category"].value,
                "severity": p["severity"].value,
                "description": p["description"],
            }
            for p in self.patterns
            if p["severity"] == severity
        ]

    def get_stats(self) -> dict:
        """Get engine statistics."""
        severity_counts = {}
        category_counts = {}
        for p in self.patterns:
            severity_counts[p["severity"].value] = (
                severity_counts.get(p["severity"].value, 0) + 1
            )
            category_counts[p["category"].value] = (
                category_counts.get(p["category"].value, 0) + 1
            )

        return {
            "total_patterns": len(self.patterns),
            "total_categories": len(category_counts),
            "by_severity": severity_counts,
            "by_category": category_counts,
            "total_scans": self._scan_count,
        }


# Shared singleton for app-wide use (fixes 3 separate engines - 1.2 gap)
# Import this instead of creating new PatternDetectionEngine() in each router
shared_engine = PatternDetectionEngine()
