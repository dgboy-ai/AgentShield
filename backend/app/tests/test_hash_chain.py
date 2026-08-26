"""
Tests for Hash Chain Engine

Validates:
- Append-only chain with SHA-256 linking
- Chain verification detects broken links
- Tampering detection works
- Multi-tenant chain isolation
- JSONL export/import
- Daily anchoring
"""

import json
import hashlib

from app.core.hash_chain import HashChainEngine, EntryType


def test_append_entry():
    """Test basic entry append."""
    engine = HashChainEngine()
    entry = engine.append(
        org_id="org-1",
        entry_type=EntryType.MEMORY,
        payload={"content": "User prefers dark mode"},
    )

    assert entry.entry_id is not None
    assert entry.entry_type == EntryType.MEMORY
    assert entry.org_id == "org-1"
    assert entry.previous_hash is not None
    assert entry.entry_hash is not None
    assert len(entry.entry_hash) == 64
    assert entry.sequence_number == 1
    print("[PASS] test_append_entry")


def test_chain_linking():
    """Test that entries link to each other via hashes."""
    engine = HashChainEngine()

    e1 = engine.append("org-1", EntryType.MEMORY, {"content": "First"})
    e2 = engine.append("org-1", EntryType.MEMORY, {"content": "Second"})
    e3 = engine.append("org-1", EntryType.MEMORY, {"content": "Third"})

    # Each entry's previous_hash should match the preceding entry's hash
    seed = hashlib.sha256(b"AGENTSHIELD_HASH_CHAIN_SEED_v1").hexdigest()
    assert e1.previous_hash == seed
    assert e2.previous_hash == e1.entry_hash
    assert e3.previous_hash == e2.entry_hash

    # No two entries should have the same hash
    assert e1.entry_hash != e2.entry_hash != e3.entry_hash
    print("[PASS] test_chain_linking")


def test_chain_head():
    """Test getting the chain head."""
    engine = HashChainEngine()
    assert engine.get_chain_head("org-1") is None

    e1 = engine.append("org-1", EntryType.MEMORY, {"a": 1})
    e2 = engine.append("org-1", EntryType.MEMORY, {"b": 2})

    head = engine.get_chain_head("org-1")
    assert head.entry_id == e2.entry_id
    assert engine.get_chain_length("org-1") == 2
    print("[PASS] test_chain_head")


def test_verify_valid_chain():
    """Test verification of a valid chain."""
    engine = HashChainEngine()
    for i in range(10):
        engine.append("org-1", EntryType.MEMORY, {"step": i})

    result = engine.verify("org-1")
    assert result.is_valid is True
    assert result.total_entries == 10
    assert result.valid_entries == 10
    assert result.broken_at is None
    print("[PASS] test_verify_valid_chain")


def test_verify_empty_chain():
    """Test verification of an empty chain."""
    engine = HashChainEngine()
    result = engine.verify("org-1")
    assert result.is_valid is True
    assert result.total_entries == 0
    print("[PASS] test_verify_empty_chain")


def test_detect_tampering():
    """Test that tampering is detected."""
    engine = HashChainEngine()
    entry = engine.append(
        "org-1", EntryType.MEMORY, {"content": "Original content"}
    )

    result = engine.detect_tampering(
        "org-1", entry.entry_id, {"content": "TAMPERED content"}
    )

    assert result["tampering_detected"] is True
    assert result["original_hash"] != result["tampered_hash"]
    assert result["restored_hash"] == result["original_hash"]
    print("[PASS] test_detect_tampering")


def test_tamper_breaks_chain():
    """Test that modifying an entry breaks the chain verification."""
    engine = HashChainEngine()
    e1 = engine.append("org-1", EntryType.MEMORY, {"content": "First"})
    e2 = engine.append("org-1", EntryType.MEMORY, {"content": "Second"})
    e3 = engine.append("org-1", EntryType.MEMORY, {"content": "Third"})

    # Tamper with e2's hash (simulate database corruption)
    original_hash = e2.entry_hash
    e2.entry_hash = "tampered_hash_value"

    result = engine.verify("org-1")
    assert result.is_valid is False
    assert result.broken_at == 1  # e2 is at index 1
    assert result.broken_entry_id == e2.entry_id

    # Restore
    e2.entry_hash = original_hash
    result = engine.verify("org-1")
    assert result.is_valid is True
    print("[PASS] test_tamper_breaks_chain")


def test_multi_tenant_isolation():
    """Test that orgs have isolated chains."""
    engine = HashChainEngine()
    engine.append("org-1", EntryType.MEMORY, {"org": "1"})
    engine.append("org-2", EntryType.MEMORY, {"org": "2"})
    engine.append("org-3", EntryType.MEMORY, {"org": "3"})

    assert engine.get_chain_length("org-1") == 1
    assert engine.get_chain_length("org-2") == 1
    assert engine.get_chain_length("org-3") == 1

    r1 = engine.verify("org-1")
    r2 = engine.verify("org-2")
    assert r1.is_valid is True
    assert r2.is_valid is True
    print("[PASS] test_multi_tenant_isolation")


def test_entry_type_filtering():
    """Test filtering entries by type."""
    engine = HashChainEngine()
    engine.append("org-1", EntryType.MEMORY, {"a": 1})
    engine.append("org-1", EntryType.CONSTRAINT, {"b": 2})
    engine.append("org-1", EntryType.MEMORY, {"c": 3})
    engine.append("org-1", EntryType.AUDIT, {"d": 4})

    memories = engine.get_entries("org-1", entry_type=EntryType.MEMORY)
    assert len(memories) == 2

    constraints = engine.get_entries("org-1", entry_type=EntryType.CONSTRAINT)
    assert len(constraints) == 1

    all_entries = engine.get_entries("org-1")
    assert len(all_entries) == 4
    print("[PASS] test_entry_type_filtering")


def test_jsonl_export_import():
    """Test JSONL export and re-import."""
    engine = HashChainEngine()
    for i in range(5):
        engine.append("org-1", EntryType.MEMORY, {"step": i})

    # Export
    jsonl = engine.get_chain_as_jsonl("org-1")
    lines = jsonl.strip().split("\n")
    assert len(lines) == 5

    # Import into fresh engine
    engine2 = HashChainEngine()
    count = engine2.import_from_jsonl("org-1", jsonl)
    assert count == 5

    # Verify imported chain
    result = engine2.verify("org-1")
    assert result.is_valid is True
    assert result.total_entries == 5
    print("[PASS] test_jsonl_export_import")


def test_anchoring():
    """Test daily chain anchoring."""
    engine = HashChainEngine()
    for i in range(3):
        engine.append("org-1", EntryType.MEMORY, {"step": i})

    anchor = engine.anchor("org-1", anchor_target="aws_s3")
    assert anchor.org_id == "org-1"
    assert anchor.chain_head_hash == engine.get_chain_head("org-1").entry_hash
    assert anchor.sequence_number == 3

    anchors = engine.get_anchors("org-1")
    assert len(anchors) == 1
    print("[PASS] test_anchoring")


def test_anchoring_empty_chain_raises():
    """Test that anchoring an empty chain raises."""
    engine = HashChainEngine()
    try:
        engine.anchor("org-1")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    print("[PASS] test_anchoring_empty_chain_raises")


def test_event_emission():
    """Test that events are emitted."""
    engine = HashChainEngine()
    events = []

    def capture(event_type, data):
        events.append(event_type)

    engine.add_listener(capture)

    engine.append("org-1", EntryType.MEMORY, {"a": 1})
    engine.verify("org-1")
    engine.anchor("org-1")

    assert "entry_appended" in events
    assert "chain_verified" in events
    assert "chain_anchored" in events
    print("[PASS] test_event_emission")


def test_deterministic_hashing():
    """Test that re-computing hash on same entry yields same result."""
    engine = HashChainEngine()
    e1 = engine.append("org-1", EntryType.MEMORY, {"content": "test"})
    hash1 = e1.entry_hash
    recomputed = e1._compute_hash()
    assert hash1 == recomputed
    print("[PASS] test_deterministic_hashing")


def test_large_payload():
    """Test chain with large payloads."""
    engine = HashChainEngine()
    large_content = "x" * 100000  # 100KB content

    for i in range(3):
        engine.append("org-1", EntryType.MEMORY, {"content": large_content, "idx": i})

    result = engine.verify("org-1")
    assert result.is_valid is True
    assert result.total_entries == 3
    print("[PASS] test_large_payload")


if __name__ == "__main__":
    print("=" * 60)
    print("Hash Chain Engine — Test Suite")
    print("=" * 60)

    test_append_entry()
    test_chain_linking()
    test_chain_head()
    test_verify_valid_chain()
    test_verify_empty_chain()
    test_detect_tampering()
    test_tamper_breaks_chain()
    test_multi_tenant_isolation()
    test_entry_type_filtering()
    test_jsonl_export_import()
    test_anchoring()
    test_anchoring_empty_chain_raises()
    test_event_emission()
    test_deterministic_hashing()
    test_large_payload()

    print("=" * 60)
    print("All 15 tests passed!")
    print("=" * 60)
