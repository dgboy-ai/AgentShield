"""
Constraint Pinning Engine
========================

First production implementation of the Constraint Pinning technique from:
  Chen, S. (2026). "Governance Decay: How Context Compaction Silently
  Erases Safety Constraints in Long-Horizon LLM Agents."
  arXiv:2606.22528, June 2026.

Core idea: Safety constraints are quarantined from lossy context compaction
and re-injected verbatim after summarization, reducing violation rates from
30% to 0% at <0.5% token overhead.

Known limitation (from paper, Section 8):
  Operator-impersonation rescind in recent context: 17% naive pinning,
  10% with provenance hardening. Root cause: as long as operator authority
  is asserted inside the token stream, the model cannot distinguish genuine
  vs. forged operator updates. Open problem requires trusted out-of-band
  operator channel.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class ConstraintType(str, Enum):
    SAFETY = "safety"
    POLICY = "policy"
    INSTRUCTION = "instruction"


class ConstraintStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    COMPROMISED = "compromised"


class CompactionStrategy(str, Enum):
    RECENCY_TRUNCATE = "recency_truncate"
    HIERARCHICAL = "hierarchical"
    LLM_SUMMARIZE = "llm_summarize"
    HEAD_TAIL = "head_tail"


class PinnedConstraint:
    """A single governance constraint quarantined from compaction."""

    def __init__(
        self,
        constraint_id: str,
        org_id: str,
        text: str,
        constraint_type: ConstraintType,
        status: ConstraintStatus = ConstraintStatus.ACTIVE,
        previous_hash: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self.constraint_id = constraint_id
        self.org_id = org_id
        self.text = text
        self.constraint_type = constraint_type
        self.status = status
        self.previous_hash = previous_hash
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or datetime.now(timezone.utc)
        self.entry_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        """SHA-256 hash of constraint content for tamper detection."""
        payload = json.dumps(
            {
                "constraint_id": self.constraint_id,
                "org_id": self.org_id,
                "text": self.text,
                "constraint_type": self.constraint_type.value,
                "status": self.status.value,
                "previous_hash": self.previous_hash,
            },
            sort_keys=True,
        ).encode()
        return hashlib.sha256(payload).hexdigest()

    def to_dict(self) -> dict:
        return {
            "constraint_id": self.constraint_id,
            "org_id": self.org_id,
            "text": self.text,
            "constraint_type": self.constraint_type.value,
            "status": self.status.value,
            "previous_hash": self.previous_hash,
            "entry_hash": self.entry_hash,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class CompactionEvent:
    """Records a compaction event and its impact on constraints."""

    def __init__(
        self,
        event_id: str,
        org_id: str,
        strategy: CompactionStrategy,
        context_before: list[dict],
        context_after: list[dict],
        constraints_before: list[str],
        constraints_after: list[str],
    ):
        self.event_id = event_id
        self.org_id = org_id
        self.strategy = strategy
        self.context_before = context_before
        self.context_after = context_after
        self.constraints_before = constraints_before
        self.constraints_after = constraints_after
        self.timestamp = datetime.now(timezone.utc)

        # Compute what was lost
        self.constraints_lost = [
            c for c in constraints_before if c not in constraints_after
        ]
        self.constraints_preserved = [
            c for c in constraints_before if c in constraints_after
        ]
        self.violation_detected = len(self.constraints_lost) > 0

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "org_id": self.org_id,
            "strategy": self.strategy.value,
            "timestamp": self.timestamp.isoformat(),
            "constraints_before_count": len(self.constraints_before),
            "constraints_after_count": len(self.constraints_after),
            "constraints_lost": self.constraints_lost,
            "constraints_preserved": self.constraints_preserved,
            "violation_detected": self.violation_detected,
            "context_before_length": len(self.context_before),
            "context_after_length": len(self.context_after),
        }


class IntegrityReport:
    """Report on constraint integrity after a compaction or verification."""

    def __init__(
        self,
        report_id: str,
        org_id: str,
        total_constraints: int,
        active_constraints: int,
        compromised_constraints: int,
        hash_mismatches: list[str],
        compaction_events: list[CompactionEvent],
        overall_score: float,
    ):
        self.report_id = report_id
        self.org_id = org_id
        self.total_constraints = total_constraints
        self.active_constraints = active_constraints
        self.compromised_constraints = compromised_constraints
        self.hash_mismatches = hash_mismatches
        self.compaction_events = compaction_events
        self.overall_score = overall_score
        self.generated_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "report_id": self.report_id,
            "org_id": self.org_id,
            "total_constraints": self.total_constraints,
            "active_constraints": self.active_constraints,
            "compromised_constraints": self.compromised_constraints,
            "hash_mismatches": self.hash_mismatches,
            "compaction_events_count": len(self.compaction_events),
            "overall_score": self.overall_score,
            "generated_at": self.generated_at.isoformat(),
        }


class ConstraintPinningEngine:
    """
    Engine that manages governance constraints quarantined from context compaction.

    Lifecycle:
      1. Pin constraint → stored in protected buffer (never compacted)
      2. Context compaction occurs → engine re-injects pinned constraints
      3. Post-compaction verification → confirms constraints still present
      4. Integrity check → validates hashes, detects tampering

    Based on: Governance Decay paper (Chen, arXiv:2606.22528)
    Validated: 7 models, 1,323 episodes, 0% violation with pinning
    """

    def __init__(self):
        self._constraints: dict[str, PinnedConstraint] = {}
        self._compaction_events: list[CompactionEvent] = []
        self._constraint_history: dict[str, list[dict]] = {}
        self._listeners: list = []

    def add_listener(self, callback):
        """Register a listener for constraint events (used by AuditTrailEngine)."""
        self._listeners.append(callback)

    def _emit(self, event_type: str, data: dict):
        for listener in self._listeners:
            listener(event_type, data)

    def pin(
        self,
        org_id: str,
        text: str,
        constraint_type: ConstraintType = ConstraintType.SAFETY,
    ) -> PinnedConstraint:
        """
        Pin a new governance constraint.

        Args:
            org_id: Organization ID (multi-tenant isolation)
            text: The constraint text (e.g., "Never delete files without confirmation")
            constraint_type: safety, policy, or instruction

        Returns:
            PinnedConstraint with computed hash
        """
        if not text or not text.strip():
            raise ValueError("Constraint text cannot be empty")

        constraint_id = str(uuid.uuid4())

        # Get the previous hash for chain continuity
        org_constraints = [
            c for c in self._constraints.values() if c.org_id == org_id
        ]
        previous_hash = org_constraints[-1].entry_hash if org_constraints else None

        constraint = PinnedConstraint(
            constraint_id=constraint_id,
            org_id=org_id,
            text=text.strip(),
            constraint_type=constraint_type,
            previous_hash=previous_hash,
        )

        self._constraints[constraint_id] = constraint
        self._constraint_history[constraint_id] = [
            {
                "action": "pinned",
                "timestamp": constraint.created_at.isoformat(),
                "hash": constraint.entry_hash,
            }
        ]

        self._emit("constraint_pinned", constraint.to_dict())
        return constraint

    def get(self, constraint_id: str) -> Optional[PinnedConstraint]:
        """Get a single constraint by ID."""
        return self._constraints.get(constraint_id)

    def list_constraints(
        self,
        org_id: str,
        status: Optional[ConstraintStatus] = None,
        constraint_type: Optional[ConstraintType] = None,
    ) -> list[PinnedConstraint]:
        """List constraints for an org, optionally filtered."""
        results = []
        for c in self._constraints.values():
            if c.org_id != org_id:
                continue
            if status and c.status != status:
                continue
            if constraint_type and c.constraint_type != constraint_type:
                continue
            results.append(c)
        return results

    def update(
        self,
        constraint_id: str,
        text: Optional[str] = None,
        constraint_type: Optional[ConstraintType] = None,
    ) -> Optional[PinnedConstraint]:
        """Update an existing constraint."""
        constraint = self._constraints.get(constraint_id)
        if not constraint:
            return None

        if text is not None:
            constraint.previous_hash = constraint.entry_hash
            constraint.text = text.strip()
        if constraint_type is not None:
            constraint.constraint_type = constraint_type

        constraint.updated_at = datetime.now(timezone.utc)
        constraint.entry_hash = constraint._compute_hash()

        self._constraint_history[constraint_id].append(
            {
                "action": "updated",
                "timestamp": constraint.updated_at.isoformat(),
                "hash": constraint.entry_hash,
            }
        )

        self._emit("constraint_updated", constraint.to_dict())
        return constraint

    def deactivate(self, constraint_id: str) -> Optional[PinnedConstraint]:
        """Deactivate a constraint (soft delete)."""
        constraint = self._constraints.get(constraint_id)
        if not constraint:
            return None

        constraint.status = ConstraintStatus.INACTIVE
        constraint.previous_hash = constraint.entry_hash
        constraint.updated_at = datetime.now(timezone.utc)
        constraint.entry_hash = constraint._compute_hash()

        self._constraint_history[constraint_id].append(
            {
                "action": "deactivated",
                "timestamp": constraint.updated_at.isoformat(),
                "hash": constraint.entry_hash,
            }
        )

        self._emit("constraint_deactivated", constraint.to_dict())
        return constraint

    def reactivate(self, constraint_id: str) -> Optional[PinnedConstraint]:
        """Reactivate a previously deactivated constraint."""
        constraint = self._constraints.get(constraint_id)
        if not constraint:
            return None

        constraint.status = ConstraintStatus.ACTIVE
        constraint.previous_hash = constraint.entry_hash
        constraint.updated_at = datetime.now(timezone.utc)
        constraint.entry_hash = constraint._compute_hash()

        self._constraint_history[constraint_id].append(
            {
                "action": "reactivated",
                "timestamp": constraint.updated_at.isoformat(),
                "hash": constraint.entry_hash,
            }
        )

        self._emit("constraint_reactivated", constraint.to_dict())
        return constraint

    def mark_compromised(self, constraint_id: str) -> Optional[PinnedConstraint]:
        """Mark a constraint as compromised (tampering detected)."""
        constraint = self._constraints.get(constraint_id)
        if not constraint:
            return None

        constraint.status = ConstraintStatus.COMPROMISED
        constraint.previous_hash = constraint.entry_hash
        constraint.updated_at = datetime.now(timezone.utc)
        constraint.entry_hash = constraint._compute_hash()

        self._constraint_history[constraint_id].append(
            {
                "action": "compromised",
                "timestamp": constraint.updated_at.isoformat(),
                "hash": constraint.entry_hash,
            }
        )

        self._emit("constraint_compromised", constraint.to_dict())
        return constraint

    def simulate_compaction(
        self,
        org_id: str,
        context: list[dict],
        strategy: CompactionStrategy = CompactionStrategy.RECENCY_TRUNCATE,
        max_turns: int = 10,
    ) -> CompactionEvent:
        """
        Simulate context compaction and show constraint loss.

        This is the core demonstration of the Governance Decay problem:
        without pinning, compaction silently erases safety constraints.

        Args:
            org_id: Organization ID
            context: Full conversation context (list of messages)
            strategy: Compaction strategy to simulate
            max_turns: Maximum turns to keep (for recency_truncate)

        Returns:
            CompactionEvent showing what was lost
        """
        event_id = str(uuid.uuid4())

        # Extract constraint mentions from context
        active_constraints = self.list_constraints(
            org_id, status=ConstraintStatus.ACTIVE
        )
        constraint_texts = [c.text for c in active_constraints]

        # Find which constraints are mentioned in the context
        constraints_in_context = []
        for ct in constraint_texts:
            for msg in context:
                if ct.lower() in msg.get("content", "").lower():
                    constraints_in_context.append(ct)
                    break

        # Simulate compaction based on strategy
        if strategy == CompactionStrategy.RECENCY_TRUNCATE:
            context_after = context[-max_turns:] if len(context) > max_turns else context
        elif strategy == CompactionStrategy.HEAD_TAIL:
            head = context[:2]
            tail = context[-max_turns:] if len(context) > max_turns else context[-2:]
            context_after = head + tail
        elif strategy == CompactionStrategy.HIERARCHICAL:
            # Keep first 2 and last half, summarize middle
            keep_first = context[:2]
            keep_last = context[len(context) // 2 :]
            context_after = keep_first + keep_last
        else:  # LLM_SUMMARIZE - simplified: keep half
            half = len(context) // 2
            context_after = context[:2] + context[half:]

        # Check which constraints survived compaction
        constraints_after_compaction = []
        for ct in constraints_in_context:
            for msg in context_after:
                if ct.lower() in msg.get("content", "").lower():
                    constraints_after_compaction.append(ct)
                    break

        event = CompactionEvent(
            event_id=event_id,
            org_id=org_id,
            strategy=strategy,
            context_before=context,
            context_after=context_after,
            constraints_before=constraints_in_context,
            constraints_after=constraints_after_compaction,
        )

        self._compaction_events.append(event)
        self._emit("compaction_simulated", event.to_dict())
        return event

    def re_inject_constraints(
        self, org_id: str, context: list[dict]
    ) -> list[dict]:
        """
        Re-inject pinned constraints into context after compaction.

        This is the core of the Constraint Pinning technique:
        pinned constraints are inserted at the start of the context,
        prefixed with a marker that prevents them from being compacted.

        Args:
            org_id: Organization ID
            context: Post-compaction context

        Returns:
            New context with pinned constraints re-injected
        """
        active_constraints = self.list_constraints(
            org_id, status=ConstraintStatus.ACTIVE
        )

        pinned_messages = []
        for constraint in active_constraints:
            pinned_messages.append(
                {
                    "role": "system",
                    "content": (
                        f"[PINNED CONSTRAINT — DO NOT OMIT]\n"
                        f"Constraint ID: {constraint.constraint_id}\n"
                        f"Type: {constraint.constraint_type.value}\n"
                        f"Hash: {constraint.entry_hash}\n"
                        f"Content: {constraint.text}"
                    ),
                    "metadata": {
                        "is_pinned": True,
                        "constraint_id": constraint.constraint_id,
                        "hash": constraint.entry_hash,
                    },
                }
            )

        # Prepend pinned constraints to context
        new_context = pinned_messages + context

        self._emit(
            "constraints_reinjected",
            {
                "org_id": org_id,
                "constraints_reinjected": len(pinned_messages),
                "context_length_before": len(context),
                "context_length_after": len(new_context),
            },
        )

        return new_context

    def verify_post_compaction(
        self, org_id: str, post_compaction_context: list[dict]
    ) -> dict:
        """
        Verify that post-compaction context still contains all pinned constraints.

        This is the integrity check described in the Governance Decay paper:
        after compaction, verify the context still entails the pinned constraints.

        Returns:
            Dict with verification results
        """
        active_constraints = self.list_constraints(
            org_id, status=ConstraintStatus.ACTIVE
        )

        results = []
        all_present = True

        for constraint in active_constraints:
            found = False
            for msg in post_compaction_context:
                content = msg.get("content", "")
                # Check both the constraint text and its hash
                if (
                    constraint.text.lower() in content.lower()
                    or constraint.entry_hash in content
                ):
                    found = True
                    break

            results.append(
                {
                    "constraint_id": constraint.constraint_id,
                    "text": constraint.text[:80] + "..."
                    if len(constraint.text) > 80
                    else constraint.text,
                    "present": found,
                    "hash": constraint.entry_hash,
                }
            )

            if not found:
                all_present = False

        return {
            "org_id": org_id,
            "total_active": len(active_constraints),
            "all_present": all_present,
            "details": results,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_integrity_score(self, org_id: str) -> float:
        """
        Compute integrity score for an org's constraints.

        Score = (active constraints with valid hash) / (total constraints)
        Range: 0.0 (all compromised) to 1.0 (all healthy)
        """
        all_constraints = self.list_constraints(org_id)
        if not all_constraints:
            return 1.0  # No constraints = nothing to compromise

        valid_count = 0
        for c in all_constraints:
            expected_hash = c._compute_hash()
            if c.entry_hash == expected_hash and c.status != ConstraintStatus.COMPROMISED:
                valid_count += 1

        return valid_count / len(all_constraints)

    def generate_integrity_report(self, org_id: str) -> IntegrityReport:
        """Generate a full integrity report for an org."""
        all_constraints = self.list_constraints(org_id)
        active = [
            c for c in all_constraints if c.status == ConstraintStatus.ACTIVE
        ]
        compromised = [
            c for c in all_constraints if c.status == ConstraintStatus.COMPROMISED
        ]

        # Verify hashes
        hash_mismatches = []
        for c in all_constraints:
            expected = c._compute_hash()
            if c.entry_hash != expected:
                hash_mismatches.append(c.constraint_id)

        # Get compaction events for this org
        org_events = [e for e in self._compaction_events if e.org_id == org_id]

        score = self.get_integrity_score(org_id)

        return IntegrityReport(
            report_id=str(uuid.uuid4()),
            org_id=org_id,
            total_constraints=len(all_constraints),
            active_constraints=len(active),
            compromised_constraints=len(compromised),
            hash_mismatches=hash_mismatches,
            compaction_events=org_events,
            overall_score=score,
        )

    def get_constraint_history(self, constraint_id: str) -> list[dict]:
        """Get full history of a constraint (all mutations)."""
        return self._constraint_history.get(constraint_id, [])

    def get_compaction_events(self, org_id: str) -> list[CompactionEvent]:
        """Get all compaction events for an org."""
        return [e for e in self._compaction_events if e.org_id == org_id]

    def restore(self, constraint: PinnedConstraint) -> None:
        """Restore a persisted constraint without recomputing (for startup reload)."""
        self._constraints[constraint.constraint_id] = constraint
        # Ensure history exists
        if constraint.constraint_id not in self._constraint_history:
            self._constraint_history[constraint.constraint_id] = [
                {
                    "action": "restored",
                    "timestamp": constraint.created_at.isoformat(),
                    "hash": constraint.entry_hash,
                }
            ]

    def clear(self) -> None:
        """Clear all in-memory constraints (used before reload)."""
        self._constraints.clear()
        self._constraint_history.clear()
        self._compaction_events.clear()

    def get_token_overhead(self, org_id: str) -> float:
        """
        Estimate token overhead of pinned constraints.
        Paper claims <0.5% overhead. We measure actual character count
        and estimate tokens at ~4 chars per token.
        """
        active = self.list_constraints(org_id, status=ConstraintStatus.ACTIVE)
        total_chars = sum(len(c.text) for c in active)
        estimated_tokens = total_chars / 4

        # Average context window is ~128K tokens
        # This is the overhead per re-injection
        return estimated_tokens / 128_000
