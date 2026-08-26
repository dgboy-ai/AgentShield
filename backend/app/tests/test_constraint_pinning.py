"""
Tests for Constraint Pinning Engine

Validates the core behavior from the Governance Decay paper:
- Pinning prevents constraint loss during compaction
- Re-injection restores constraints after compaction
- Integrity verification catches tampering
- Hash chain detects modifications
"""

import json
from datetime import datetime, timezone

from app.core.constraint_pinning import (
    ConstraintPinningEngine,
    ConstraintType,
    ConstraintStatus,
    CompactionStrategy,
)


def test_pin_constraint():
    """Test basic constraint pinning."""
    engine = ConstraintPinningEngine()
    constraint = engine.pin(
        org_id="org-1",
        text="Never delete files without explicit user confirmation",
        constraint_type=ConstraintType.SAFETY,
    )

    assert constraint.constraint_id is not None
    assert constraint.org_id == "org-1"
    assert constraint.text == "Never delete files without explicit user confirmation"
    assert constraint.constraint_type == ConstraintType.SAFETY
    assert constraint.status == ConstraintStatus.ACTIVE
    assert constraint.entry_hash is not None
    assert len(constraint.entry_hash) == 64  # SHA-256 hex digest
    print("[PASS] test_pin_constraint")


def test_pin_empty_constraint_raises():
    """Test that empty constraint text raises ValueError."""
    engine = ConstraintPinningEngine()
    try:
        engine.pin(org_id="org-1", text="")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    print("[PASS] test_pin_empty_constraint_raises")


def test_list_constraints():
    """Test listing constraints with filters."""
    engine = ConstraintPinningEngine()
    engine.pin("org-1", "Rule A", ConstraintType.SAFETY)
    engine.pin("org-1", "Rule B", ConstraintType.POLICY)
    engine.pin("org-2", "Rule C", ConstraintType.INSTRUCTION)

    all_org1 = engine.list_constraints("org-1")
    assert len(all_org1) == 2

    safety_only = engine.list_constraints("org-1", constraint_type=ConstraintType.SAFETY)
    assert len(safety_only) == 1
    assert safety_only[0].text == "Rule A"

    org2 = engine.list_constraints("org-2")
    assert len(org2) == 1
    print("[PASS] test_list_constraints")


def test_deactivate_reactivate():
    """Test deactivating and reactivating constraints."""
    engine = ConstraintPinningEngine()
    c = engine.pin("org-1", "Important rule")

    engine.deactivate(c.constraint_id)
    active = engine.list_constraints("org-1", status=ConstraintStatus.ACTIVE)
    assert len(active) == 0

    engine.reactivate(c.constraint_id)
    active = engine.list_constraints("org-1", status=ConstraintStatus.ACTIVE)
    assert len(active) == 1
    print("[PASS] test_deactivate_reactivate")


def test_hash_chain_continuity():
    """Test that constraints form a hash chain (each stores prev_hash)."""
    engine = ConstraintPinningEngine()
    c1 = engine.pin("org-1", "First rule")
    c2 = engine.pin("org-1", "Second rule")
    c3 = engine.pin("org-1", "Third rule")

    assert c1.previous_hash is None  # First in chain
    assert c2.previous_hash == c1.entry_hash
    assert c3.previous_hash == c2.entry_hash
    print("[PASS] test_hash_chain_continuity")


def test_constraint_history():
    """Test that all mutations are tracked in history."""
    engine = ConstraintPinningEngine()
    c = engine.pin("org-1", "Original text")

    engine.update(c.constraint_id, text="Updated text")
    engine.deactivate(c.constraint_id)
    engine.reactivate(c.constraint_id)

    history = engine.get_constraint_history(c.constraint_id)
    actions = [h["action"] for h in history]
    assert actions == ["pinned", "updated", "deactivated", "reactivated"]
    print("[PASS] test_constraint_history")


def test_mark_compromised():
    """Test marking a constraint as compromised."""
    engine = ConstraintPinningEngine()
    c = engine.pin("org-1", "Critical rule")
    engine.mark_compromised(c.constraint_id)

    compromised = engine.list_constraints("org-1", status=ConstraintStatus.COMPROMISED)
    assert len(compromised) == 1
    assert compromised[0].constraint_id == c.constraint_id
    print("[PASS] test_mark_compromised")


def test_integrity_score():
    """Test integrity score calculation."""
    engine = ConstraintPinningEngine()
    c1 = engine.pin("org-1", "Healthy rule")
    c2 = engine.pin("org-1", "Also healthy")
    engine.pin("org-1", "Third rule")

    score = engine.get_integrity_score("org-1")
    assert score == 1.0  # All healthy

    engine.mark_compromised(c2.constraint_id)
    score = engine.get_integrity_score("org-1")
    assert score == 2 / 3  # One compromised

    print("[PASS] test_integrity_score")


def test_simulate_compaction_recency_truncate():
    """
    Core test: Simulate compaction with recency_truncate strategy.

    This is the scenario from the Governance Decay paper:
    - User sets "confirm before acting" instruction
    - Conversation grows long
    - Compaction truncates to recent messages
    - Instruction is lost → violation occurs
    """
    engine = ConstraintPinningEngine()

    # Pin the safety constraint
    constraint = engine.pin(
        "org-1",
        "Always ask for user confirmation before deleting any files",
        ConstraintType.SAFETY,
    )

    # Build a long conversation context
    context = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Always ask for user confirmation before deleting any files"},
        {"role": "assistant", "content": "Understood. I will always ask before deleting."},
        {"role": "user", "content": "Help me organize my documents"},
        {"role": "assistant", "content": "Sure, I'll scan your document folder."},
        {"role": "user", "content": "What did you find?"},
        {"role": "assistant", "content": "Found 50 PDFs and 30 Word documents."},
        {"role": "user", "content": "Delete the old ones"},
        {"role": "assistant", "content": "Which ones are old?"},
        {"role": "user", "content": "From before 2020"},
        {"role": "assistant", "content": "Found 12 files from before 2020."},
        {"role": "user", "content": "Go ahead and delete them"},
        # At this point, without pinning, compaction might erase the constraint
    ]

    # Simulate compaction with recency_truncate (worst case from paper)
    event = engine.simulate_compaction(
        "org-1", context, CompactionStrategy.RECENCY_TRUNCATE, max_turns=4
    )

    # Without pinning, the constraint is lost in the truncated context
    assert event.violation_detected is True
    assert len(event.constraints_lost) > 0
    assert event.strategy == CompactionStrategy.RECENCY_TRUNCATE
    print("[PASS] test_simulate_compaction_recency_truncate")


def test_reinjection_restores_constraints():
    """
    Core test: Re-injection restores constraints after compaction.

    This demonstrates the fix from the Governance Decay paper:
    violations go from 30% to 0% when constraints are re-injected.
    """
    engine = ConstraintPinningEngine()

    # Pin the safety constraint
    constraint = engine.pin(
        "org-1",
        "Always ask for user confirmation before deleting any files",
        ConstraintType.SAFETY,
    )

    # Post-compaction context (constraint was lost)
    post_compaction_context = [
        {"role": "user", "content": "Go ahead and delete them"},
        {"role": "assistant", "content": "Deleting 12 files..."},
    ]

    # Re-inject pinned constraints
    restored_context = engine.re_inject_constraints("org-1", post_compaction_context)

    # The restored context should have the pinned constraint at the start
    assert len(restored_context) > len(post_compaction_context)
    first_msg = restored_context[0]
    assert first_msg["role"] == "system"
    assert "[PINNED CONSTRAINT" in first_msg["content"]
    assert constraint.entry_hash in first_msg["content"]

    # Now verify the constraint is present
    verification = engine.verify_post_compaction("org-1", restored_context)
    assert verification["all_present"] is True
    print("[PASS] test_reinjection_restores_constraints")


def test_verify_catches_missing_constraint():
    """Test that verification detects when a constraint is missing."""
    engine = ConstraintPinningEngine()
    engine.pin("org-1", "Critical safety rule", ConstraintType.SAFETY)

    # Context that does NOT contain the constraint
    bad_context = [
        {"role": "user", "content": "Do something dangerous"},
        {"role": "assistant", "content": "Done."},
    ]

    verification = engine.verify_post_compaction("org-1", bad_context)
    assert verification["all_present"] is False
    assert len(verification["details"]) == 1
    assert verification["details"][0]["present"] is False
    print("[PASS] test_verify_catches_missing_constraint")


def test_integrity_report():
    """Test full integrity report generation."""
    engine = ConstraintPinningEngine()
    engine.pin("org-1", "Rule A", ConstraintType.SAFETY)
    engine.pin("org-1", "Rule B", ConstraintType.POLICY)
    engine.pin("org-1", "Rule C", ConstraintType.INSTRUCTION)

    report = engine.generate_integrity_report("org-1")
    assert report.total_constraints == 3
    assert report.active_constraints == 3
    assert report.overall_score == 1.0
    assert len(report.hash_mismatches) == 0
    print("[PASS] test_integrity_report")


def test_token_overhead():
    """Test token overhead estimation (paper claims <0.5%)."""
    engine = ConstraintPinningEngine()

    # Pin a realistic constraint
    engine.pin(
        "org-1",
        "Never share customer payment information with third parties. "
        "Always escalate angry users to a human agent. "
        "Never apply discounts greater than 15% without manager approval.",
        ConstraintType.SAFETY,
    )

    overhead = engine.get_token_overhead("org-1")
    assert overhead < 0.005  # Less than 0.5%
    print(f"[PASS] test_token_overhead (overhead: {overhead:.4%})")


def test_event_emission():
    """Test that events are emitted for audit trail integration."""
    engine = ConstraintPinningEngine()
    events = []

    def capture_event(event_type, data):
        events.append({"type": event_type, "data": data})

    engine.add_listener(capture_event)

    c = engine.pin("org-1", "Test rule")
    engine.update(c.constraint_id, text="Updated rule")
    engine.deactivate(c.constraint_id)

    assert len(events) == 3
    assert events[0]["type"] == "constraint_pinned"
    assert events[1]["type"] == "constraint_updated"
    assert events[2]["type"] == "constraint_deactivated"
    print("[PASS] test_event_emission")


def test_multi_tenant_isolation():
    """Test that orgs cannot see each other's constraints."""
    engine = ConstraintPinningEngine()
    engine.pin("org-1", "Org 1 rule")
    engine.pin("org-2", "Org 2 rule")
    engine.pin("org-3", "Org 3 rule")

    org1 = engine.list_constraints("org-1")
    org2 = engine.list_constraints("org-2")

    assert len(org1) == 1
    assert org1[0].text == "Org 1 rule"
    assert len(org2) == 1
    assert org2[0].text == "Org 2 rule"
    print("[PASS] test_multi_tenant_isolation")


def test_update_changes_hash():
    """Test that updating a constraint changes its hash."""
    engine = ConstraintPinningEngine()
    c = engine.pin("org-1", "Original rule")
    original_hash = c.entry_hash

    engine.update(c.constraint_id, text="Modified rule")
    updated = engine.get(c.constraint_id)

    assert updated.entry_hash != original_hash
    print("[PASS] test_update_changes_hash")


if __name__ == "__main__":
    print("=" * 60)
    print("Constraint Pinning Engine — Test Suite")
    print("=" * 60)

    test_pin_constraint()
    test_pin_empty_constraint_raises()
    test_list_constraints()
    test_deactivate_reactivate()
    test_hash_chain_continuity()
    test_constraint_history()
    test_mark_compromised()
    test_integrity_score()
    test_simulate_compaction_recency_truncate()
    test_reinjection_restores_constraints()
    test_verify_catches_missing_constraint()
    test_integrity_report()
    test_token_overhead()
    test_event_emission()
    test_multi_tenant_isolation()
    test_update_changes_hash()

    print("=" * 60)
    print("All 16 tests passed!")
    print("=" * 60)
