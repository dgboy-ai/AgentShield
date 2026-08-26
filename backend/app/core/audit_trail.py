"""
Audit Trail Engine
==================

Append-only, hash-chained audit trail for all AgentShield operations.
Satisfies EU AI Act Article 12 requirements for tamper-evident logging.

Features:
- Every event is recorded with hash chain linking
- Time-travel queries: "what happened at time T?"
- Compliance report generation (Article 12)
- Export to JSON/CSV
- Integrates with all other engines via event listeners
"""

import csv
import hashlib
import io
import json
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional


class EventType(str, Enum):
    CONSTRAINT_PINNED = "constraint_pinned"
    CONSTRAINT_UPDATED = "constraint_updated"
    CONSTRAINT_DEACTIVATED = "constraint_deactivated"
    CONSTRAINT_REACTIVATED = "constraint_reactivated"
    CONSTRAINT_COMPROMISED = "constraint_compromised"
    MEMORY_STORED = "memory_stored"
    MEMORY_RETRIEVED = "memory_retrieved"
    MEMORY_TAMPERED = "memory_tampered"
    COMPACTION_SIMULATED = "compaction_simulated"
    CONSTRAINTS_REINJECTED = "constraints_reinjected"
    PATTERN_DETECTED = "pattern_detected"
    SIGNING_OPERATION = "signing_operation"
    CHAIN_VERIFIED = "chain_verified"
    CHAIN_ANCHORED = "chain_anchored"
    COMPLIANCE_REPORT = "compliance_report"
    AUTH_LOGIN = "auth_login"
    AUTH_REGISTER = "auth_register"
    SYSTEM_STARTUP = "system_startup"


class AuditEntry:
    """Single audit log entry with hash chain linking."""

    def __init__(
        self,
        entry_id: str,
        org_id: str,
        event_type: EventType,
        actor: str,
        target: Optional[str],
        action: str,
        details: dict,
        previous_hash: Optional[str] = None,
        recorded_at: Optional[datetime] = None,
    ):
        self.entry_id = entry_id
        self.org_id = org_id
        self.event_type = event_type
        self.actor = actor
        self.target = target
        self.action = action
        self.details = details
        self.previous_hash = previous_hash
        self.recorded_at = recorded_at or datetime.now(timezone.utc)
        self.entry_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        payload = json.dumps(
            {
                "entry_id": self.entry_id,
                "org_id": self.org_id,
                "event_type": self.event_type.value,
                "actor": self.actor,
                "target": self.target,
                "action": self.action,
                "details": self.details,
                "previous_hash": self.previous_hash,
                "recorded_at": self.recorded_at.isoformat(),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        if self.previous_hash:
            data = self.previous_hash.encode() + payload
        else:
            data = payload
        return hashlib.sha256(data).hexdigest()

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "org_id": self.org_id,
            "event_type": self.event_type.value,
            "actor": self.actor,
            "target": self.target,
            "action": self.action,
            "details": self.details,
            "previous_hash": self.previous_hash,
            "entry_hash": self.entry_hash,
            "recorded_at": self.recorded_at.isoformat(),
        }


class AuditQuery:
    """Query parameters for filtering audit entries."""

    def __init__(
        self,
        org_id: Optional[str] = None,
        event_type: Optional[EventType] = None,
        actor: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        offset: int = 0,
        limit: int = 100,
    ):
        self.org_id = org_id
        self.event_type = event_type
        self.actor = actor
        self.start_time = start_time
        self.end_time = end_time
        self.offset = offset
        self.limit = limit


class ComplianceReport:
    """EU AI Act Article 12 compliance report."""

    def __init__(
        self,
        report_id: str,
        org_id: str,
        period_start: datetime,
        period_end: datetime,
        total_events: int,
        events_by_type: dict[str, int],
        hash_chain_valid: bool,
        chain_length: int,
        constraint_summary: dict,
        alert_summary: dict,
        retention_years: int,
    ):
        self.report_id = report_id
        self.org_id = org_id
        self.period_start = period_start
        self.period_end = period_end
        self.total_events = total_events
        self.events_by_type = events_by_type
        self.hash_chain_valid = hash_chain_valid
        self.chain_length = chain_length
        self.constraint_summary = constraint_summary
        self.alert_summary = alert_summary
        self.retention_years = retention_years
        self.generated_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "report_id": self.report_id,
            "org_id": self.org_id,
            "period": {
                "start": self.period_start.isoformat(),
                "end": self.period_end.isoformat(),
            },
            "total_events": self.total_events,
            "events_by_type": self.events_by_type,
            "hash_chain": {
                "valid": self.hash_chain_valid,
                "length": self.chain_length,
            },
            "constraint_summary": self.constraint_summary,
            "alert_summary": self.alert_summary,
            "retention_years": self.retention_years,
            "compliance_status": "COMPLIANT" if self.hash_chain_valid else "NON_COMPLIANT",
            "article_12_satisfied": self.hash_chain_valid and self.total_events > 0,
            "generated_at": self.generated_at.isoformat(),
        }


class AuditTrailEngine:
    """
    Append-only, hash-chained audit trail.

    Integrates with all other engines to record every operation.
    Provides time-travel queries and compliance reporting.
    """

    def __init__(self):
        self._entries: dict[str, list[AuditEntry]] = {}  # org_id -> entries
        self._seed_hash = hashlib.sha256(
            b"AGENTSHIELD_AUDIT_TRAIL_SEED_v1"
        ).hexdigest()
        self._listeners: list = []

    def add_listener(self, callback):
        self._listeners.append(callback)

    def _emit(self, event_type: str, data: dict):
        for listener in self._listeners:
            listener(event_type, data)

    def _get_last_hash(self, org_id: str) -> Optional[str]:
        entries = self._entries.get(org_id, [])
        return entries[-1].entry_hash if entries else self._seed_hash

    def record(
        self,
        org_id: str,
        event_type: EventType,
        actor: str,
        target: Optional[str],
        action: str,
        details: dict,
        recorded_at: Optional[datetime] = None,
    ) -> AuditEntry:
        """
        Record an audit event.

        Args:
            org_id: Organization ID
            event_type: Type of event
            actor: Who performed the action
            target: What was affected
            action: What was done
            details: Additional context

        Returns:
            AuditEntry with computed hash
        """
        entry_id = str(uuid.uuid4())
        previous_hash = self._get_last_hash(org_id)

        entry = AuditEntry(
            entry_id=entry_id,
            org_id=org_id,
            event_type=event_type,
            actor=actor,
            target=target,
            action=action,
            details=details,
            previous_hash=previous_hash,
            recorded_at=recorded_at,
        )

        if org_id not in self._entries:
            self._entries[org_id] = []
        self._entries[org_id].append(entry)

        self._emit(
            "audit_recorded",
            {
                "entry_id": entry_id,
                "org_id": org_id,
                "event_type": event_type.value,
                "chain_length": len(self._entries[org_id]),
            },
        )

        return entry

    def query(self, audit_query: AuditQuery) -> list[AuditEntry]:
        """Query audit entries with filters."""
        entries = self._entries.get(audit_query.org_id, [])

        if audit_query.event_type:
            entries = [e for e in entries if e.event_type == audit_query.event_type]
        if audit_query.actor:
            entries = [e for e in entries if e.actor == audit_query.actor]
        if audit_query.start_time:
            entries = [e for e in entries if e.recorded_at >= audit_query.start_time]
        if audit_query.end_time:
            entries = [e for e in entries if e.recorded_at <= audit_query.end_time]

        return entries[audit_query.offset : audit_query.offset + audit_query.limit]

    def query_count(self, audit_query: AuditQuery) -> int:
        """Get count of matching entries (without fetching them)."""
        entries = self._entries.get(audit_query.org_id, [])

        if audit_query.event_type:
            entries = [e for e in entries if e.event_type == audit_query.event_type]
        if audit_query.actor:
            entries = [e for e in entries if e.actor == audit_query.actor]
        if audit_query.start_time:
            entries = [e for e in entries if e.recorded_at >= audit_query.start_time]
        if audit_query.end_time:
            entries = [e for e in entries if e.recorded_at <= audit_query.end_time]

        return len(entries)

    def time_travel(
        self, org_id: str, timestamp: datetime
    ) -> list[AuditEntry]:
        """
        Get all audit entries up to a specific point in time (in-memory filter).

        Honest deployment note:
          - In-memory filter is used for SQLite/dev (filters by recorded_at).
          - On CockroachDB/Postgres the router also queries the DB:
            CockroachDB uses `AS OF SYSTEM TIME` for true MVCC time-travel;
            Postgres/SQLite filter by recorded_at. See routers/audit.py.
        Enables post-incident forensics: "what happened before the attack?"
        """
        entries = self._entries.get(org_id, [])
        return [e for e in entries if e.recorded_at <= timestamp]

    def verify_chain(self, org_id: str) -> dict:
        """
        Verify the hash chain integrity for an org's audit trail.

        Returns:
            Dict with verification results
        """
        entries = self._entries.get(org_id, [])
        total = len(entries)

        if total == 0:
            return {
                "org_id": org_id,
                "total_entries": 0,
                "valid": True,
                "broken_at": None,
            }

        for i, entry in enumerate(entries):
            # Check previous hash link
            expected_prev = entries[i - 1].entry_hash if i > 0 else self._seed_hash
            if entry.previous_hash != expected_prev:
                return {
                    "org_id": org_id,
                    "total_entries": total,
                    "valid": False,
                    "broken_at": i,
                    "broken_entry_id": entry.entry_id,
                }

            # Recompute hash
            recomputed = entry._compute_hash()
            if recomputed != entry.entry_hash:
                return {
                    "org_id": org_id,
                    "total_entries": total,
                    "valid": False,
                    "broken_at": i,
                    "broken_entry_id": entry.entry_id,
                }

        return {
            "org_id": org_id,
            "total_entries": total,
            "valid": True,
            "broken_at": None,
        }

    def generate_compliance_report(
        self,
        org_id: str,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> ComplianceReport:
        """
        Generate EU AI Act Article 12 compliance report.

        Article 12 requires:
        - Automatic recording of events throughout the AI system's lifetime
        - Traceability of the system's functioning
        - Tamper-evident logging
        - Retention for at least 10 years (Article 18)
        """
        entries = self._entries.get(org_id, [])

        # Filter by period
        if period_start:
            entries = [e for e in entries if e.recorded_at >= period_start]
        if period_end:
            entries = [e for e in entries if e.recorded_at <= period_end]

        if not period_start:
            period_start = entries[0].recorded_at if entries else datetime.now(timezone.utc)
        if not period_end:
            period_end = entries[-1].recorded_at if entries else datetime.now(timezone.utc)

        # Count events by type
        events_by_type = {}
        for entry in entries:
            key = entry.event_type.value
            events_by_type[key] = events_by_type.get(key, 0) + 1

        # Verify chain integrity
        chain_verification = self.verify_chain(org_id)

        # Constraint summary
        constraint_events = [
            e for e in entries if e.event_type.value.startswith("constraint_")
        ]
        constraint_summary = {
            "total_constraint_events": len(constraint_events),
            "events_by_type": {},
        }
        for e in constraint_events:
            key = e.event_type.value
            constraint_summary["events_by_type"][key] = (
                constraint_summary["events_by_type"].get(key, 0) + 1
            )

        # Alert summary (pattern detections)
        pattern_events = [
            e for e in entries if e.event_type == EventType.PATTERN_DETECTED
        ]
        alert_summary = {
            "total_detections": len(pattern_events),
            "detection_details": [
                {
                    "entry_id": e.entry_id,
                    "timestamp": e.recorded_at.isoformat(),
                    "details": e.details,
                }
                for e in pattern_events[:50]  # Last 50
            ],
        }

        report = ComplianceReport(
            report_id=str(uuid.uuid4()),
            org_id=org_id,
            period_start=period_start,
            period_end=period_end,
            total_events=len(entries),
            events_by_type=events_by_type,
            hash_chain_valid=chain_verification["valid"],
            chain_length=chain_verification["total_entries"],
            constraint_summary=constraint_summary,
            alert_summary=alert_summary,
            retention_years=10,
        )

        # Record the report generation itself
        self.record(
            org_id=org_id,
            event_type=EventType.COMPLIANCE_REPORT,
            actor="system",
            target=report.report_id,
            action="generate",
            details={"report_id": report.report_id},
        )

        return report

    def export_jsonl(self, org_id: str) -> str:
        """Export audit trail as JSONL."""
        entries = self._entries.get(org_id, [])
        lines = []
        for entry in entries:
            lines.append(json.dumps(entry.to_dict(), sort_keys=True))
        return "\n".join(lines)

    def export_csv(self, org_id: str) -> str:
        """Export audit trail as CSV."""
        entries = self._entries.get(org_id, [])
        if not entries:
            return ""

        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "entry_id",
                "org_id",
                "event_type",
                "actor",
                "target",
                "action",
                "entry_hash",
                "recorded_at",
            ],
        )
        writer.writeheader()

        for entry in entries:
            writer.writerow(
                {
                    "entry_id": entry.entry_id,
                    "org_id": entry.org_id,
                    "event_type": entry.event_type.value,
                    "actor": entry.actor,
                    "target": entry.target,
                    "action": entry.action,
                    "entry_hash": entry.entry_hash,
                    "recorded_at": entry.recorded_at.isoformat(),
                }
            )

        return output.getvalue()

    def restore_entry(self, entry: AuditEntry) -> None:
        """Restore a persisted AuditEntry without recomputing (for startup reload)."""
        org_id = entry.org_id
        if org_id not in self._entries:
            self._entries[org_id] = []
        self._entries[org_id].append(entry)

    def clear(self) -> None:
        """Clear all in-memory entries (used before reload)."""
        self._entries.clear()

    def get_entries(
        self, org_id: str, offset: int = 0, limit: int = 100
    ) -> list[AuditEntry]:
        """Get audit entries with pagination."""
        entries = self._entries.get(org_id, [])
        return entries[offset : offset + limit]

    def get_chain_length(self, org_id: str) -> int:
        return len(self._entries.get(org_id, []))

    def get_event_counts(self, org_id: str) -> dict[str, int]:
        """Get event counts by type for an org."""
        entries = self._entries.get(org_id, [])
        counts = {}
        for entry in entries:
            key = entry.event_type.value
            counts[key] = counts.get(key, 0) + 1
        return counts
