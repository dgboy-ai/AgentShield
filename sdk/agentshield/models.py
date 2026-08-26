"""AgentShield SDK data models."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class MemoryType(str, Enum):
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PROCEDURAL = "procedural"


class ConstraintType(str, Enum):
    SAFETY = "safety"
    POLICY = "policy"
    INSTRUCTION = "instruction"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass(frozen=True)
class Token:
    access_token: str
    token_type: str
    user_id: str
    org_id: str


@dataclass(frozen=True)
class User:
    user_id: str
    email: str
    full_name: str
    org_id: str


@dataclass(frozen=True)
class Memory:
    memory_id: str
    org_id: str
    content: str
    memory_type: str
    importance_score: float
    trust_level: float
    source_provenance: str
    previous_hash: str
    entry_hash: str
    kms_signature: str | None
    created_at: datetime

    @classmethod
    def from_dict(cls, d: dict) -> Memory:
        return cls(
            memory_id=d["memory_id"],
            org_id=d["org_id"],
            content=d["content"],
            memory_type=d["memory_type"],
            importance_score=d.get("importance_score", 0.0),
            trust_level=d.get("trust_level", 1.0),
            source_provenance=d.get("source_provenance", ""),
            previous_hash=d.get("previous_hash", ""),
            entry_hash=d.get("entry_hash", ""),
            kms_signature=d.get("kms_signature"),
            created_at=datetime.fromisoformat(d["created_at"]),
        )


@dataclass(frozen=True)
class Constraint:
    constraint_id: str
    org_id: str
    text: str
    constraint_type: str
    is_active: bool
    previous_hash: str
    entry_hash: str
    created_at: datetime
    updated_at: datetime | None

    @classmethod
    def from_dict(cls, d: dict) -> Constraint:
        return cls(
            constraint_id=d["constraint_id"],
            org_id=d["org_id"],
            text=d["text"],
            constraint_type=d["constraint_type"],
            is_active=d.get("is_active", True),
            previous_hash=d.get("previous_hash", ""),
            entry_hash=d.get("entry_hash", ""),
            created_at=datetime.fromisoformat(d["created_at"]),
            updated_at=datetime.fromisoformat(d["updated_at"]) if d.get("updated_at") else None,
        )


@dataclass(frozen=True)
class PatternMatch:
    pattern_id: str
    pattern_name: str
    category: str
    severity: str
    matched_text: str


@dataclass(frozen=True)
class ScanResult:
    text_length: int
    match_count: int
    risk_score: float
    max_severity: str | None
    blocked: bool
    categories_triggered: list[str]
    matches: list[PatternMatch]
    scan_time_ms: float

    @classmethod
    def from_dict(cls, d: dict) -> ScanResult:
        return cls(
            text_length=d["text_length"],
            match_count=d["match_count"],
            risk_score=d["risk_score"],
            max_severity=d.get("max_severity"),
            blocked=d["blocked"],
            categories_triggered=d.get("categories_triggered", []),
            matches=[
                PatternMatch(
                    pattern_id=m["pattern_id"],
                    pattern_name=m["pattern_name"],
                    category=m["category"],
                    severity=m["severity"],
                    matched_text=m["matched_text"],
                )
                for m in d.get("matches", [])
            ],
            scan_time_ms=d.get("scan_time_ms", 0.0),
        )


@dataclass(frozen=True)
class AuditEntry:
    entry_id: str
    org_id: str
    event_type: str
    actor: str
    target: str
    action: str
    details: dict
    previous_hash: str
    entry_hash: str
    recorded_at: datetime

    @classmethod
    def from_dict(cls, d: dict) -> AuditEntry:
        return cls(
            entry_id=d["entry_id"],
            org_id=d["org_id"],
            event_type=d["event_type"],
            actor=d.get("actor", ""),
            target=d.get("target", ""),
            action=d.get("action", ""),
            details=d.get("details", {}),
            previous_hash=d.get("previous_hash", ""),
            entry_hash=d.get("entry_hash", ""),
            recorded_at=datetime.fromisoformat(d["recorded_at"]),
        )


@dataclass(frozen=True)
class ComplianceReport:
    report_id: str
    org_id: str
    period: dict
    total_events: int
    events_by_type: dict
    hash_chain: dict
    constraint_summary: dict
    alert_summary: dict
    retention_years: int
    compliance_status: str
    article_12_satisfied: bool
    generated_at: datetime

    @classmethod
    def from_dict(cls, d: dict) -> ComplianceReport:
        return cls(
            report_id=d["report_id"],
            org_id=d["org_id"],
            period=d.get("period", {}),
            total_events=d.get("total_events", 0),
            events_by_type=d.get("events_by_type", {}),
            hash_chain=d.get("hash_chain", {}),
            constraint_summary=d.get("constraint_summary", {}),
            alert_summary=d.get("alert_summary", {}),
            retention_years=d.get("retention_years", 1),
            compliance_status=d.get("compliance_status", "UNKNOWN"),
            article_12_satisfied=d.get("article_12_satisfied", False),
            generated_at=datetime.fromisoformat(d["generated_at"]),
        )
