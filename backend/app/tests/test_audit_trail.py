"""
Tests for Audit Trail Engine

Validates:
- Append-only audit log with hash chain
- Chain verification detects tampering
- Time-travel queries work
- Compliance report generation
- JSON/CSV export
- Event filtering and pagination
"""

from datetime import datetime, timezone, timedelta

from app.core.audit_trail import (
    AuditTrailEngine,
    EventType,
    AuditQuery,
)


def test_record_event():
    """Test basic event recording."""
    engine = AuditTrailEngine()
    entry = engine.record(
        org_id="org-1",
        event_type=EventType.CONSTRAINT_PINNED,
        actor="user-1",
        target="constraint-1",
        action="pin",
        details={"text": "Never delete files"},
    )

    assert entry.entry_id is not None
    assert entry.org_id == "org-1"
    assert entry.event_type == EventType.CONSTRAINT_PINNED
    assert entry.entry_hash is not None
    assert len(entry.entry_hash) == 64
    print("[PASS] test_record_event")


def test_chain_linking():
    """Test that audit entries form a hash chain."""
    engine = AuditTrailEngine()

    e1 = engine.record("org-1", EventType.CONSTRAINT_PINNED, "user-1", "c1", "pin", {})
    e2 = engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})
    e3 = engine.record("org-1", EventType.PATTERN_DETECTED, "system", "scan-1", "detect", {})

    # Chain links
    assert e1.previous_hash is not None  # Links to seed
    assert e2.previous_hash == e1.entry_hash
    assert e3.previous_hash == e2.entry_hash

    # Each hash is unique
    assert e1.entry_hash != e2.entry_hash != e3.entry_hash
    print("[PASS] test_chain_linking")


def test_verify_chain_valid():
    """Test verification of valid chain."""
    engine = AuditTrailEngine()
    for i in range(10):
        engine.record("org-1", EventType.MEMORY_STORED, "user-1", f"m{i}", "store", {})

    result = engine.verify_chain("org-1")
    assert result["valid"] is True
    assert result["total_entries"] == 10
    print("[PASS] test_verify_chain_valid")


def test_verify_chain_broken():
    """Test that tampering breaks chain verification."""
    engine = AuditTrailEngine()
    e1 = engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})
    e2 = engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m2", "store", {})
    e3 = engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m3", "store", {})

    # Tamper with e2's hash
    original_hash = e2.entry_hash
    e2.entry_hash = "tampered"

    result = engine.verify_chain("org-1")
    assert result["valid"] is False
    assert result["broken_at"] == 1

    # Restore
    e2.entry_hash = original_hash
    result = engine.verify_chain("org-1")
    assert result["valid"] is True
    print("[PASS] test_verify_chain_broken")


def test_query_by_event_type():
    """Test filtering by event type."""
    engine = AuditTrailEngine()
    engine.record("org-1", EventType.CONSTRAINT_PINNED, "user-1", "c1", "pin", {})
    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})
    engine.record("org-1", EventType.PATTERN_DETECTED, "system", "s1", "scan", {})
    engine.record("org-1", EventType.CONSTRAINT_UPDATED, "user-1", "c1", "update", {})

    query = AuditQuery(org_id="org-1", event_type=EventType.CONSTRAINT_PINNED)
    results = engine.query(query)
    assert len(results) == 1
    assert results[0].event_type == EventType.CONSTRAINT_PINNED
    print("[PASS] test_query_by_event_type")


def test_query_by_actor():
    """Test filtering by actor."""
    engine = AuditTrailEngine()
    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})
    engine.record("org-1", EventType.MEMORY_STORED, "user-2", "m2", "store", {})
    engine.record("org-1", EventType.PATTERN_DETECTED, "system", "s1", "scan", {})

    query = AuditQuery(org_id="org-1", actor="user-1")
    results = engine.query(query)
    assert len(results) == 1
    print("[PASS] test_query_by_actor")


def test_query_by_time_range():
    """Test filtering by time range."""
    engine = AuditTrailEngine()
    now = datetime.now(timezone.utc)

    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})
    engine.record(
        "org-1",
        EventType.MEMORY_STORED,
        "user-1",
        "m2",
        "store",
        {},
        recorded_at=now - timedelta(hours=2),
    )
    engine.record(
        "org-1",
        EventType.MEMORY_STORED,
        "user-1",
        "m3",
        "store",
        {},
        recorded_at=now - timedelta(hours=1),
    )

    # Query last 90 minutes
    query = AuditQuery(
        org_id="org-1",
        start_time=now - timedelta(minutes=90),
    )
    results = engine.query(query)
    assert len(results) == 2
    print("[PASS] test_query_by_time_range")


def test_query_pagination():
    """Test query pagination."""
    engine = AuditTrailEngine()
    for i in range(25):
        engine.record("org-1", EventType.MEMORY_STORED, "user-1", f"m{i}", "store", {})

    q1 = AuditQuery(org_id="org-1", offset=0, limit=10)
    q2 = AuditQuery(org_id="org-1", offset=10, limit=10)
    q3 = AuditQuery(org_id="org-1", offset=20, limit=10)

    r1 = engine.query(q1)
    r2 = engine.query(q2)
    r3 = engine.query(q3)

    assert len(r1) == 10
    assert len(r2) == 10
    assert len(r3) == 5

    # No overlap
    ids1 = {e.entry_id for e in r1}
    ids2 = {e.entry_id for e in r2}
    ids3 = {e.entry_id for e in r3}
    assert ids1.isdisjoint(ids2)
    assert ids2.isdisjoint(ids3)
    print("[PASS] test_query_pagination")


def test_time_travel():
    """Test time-travel query."""
    engine = AuditTrailEngine()
    now = datetime.now(timezone.utc)

    engine.record(
        "org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {},
        recorded_at=now - timedelta(hours=3),
    )
    engine.record(
        "org-1", EventType.MEMORY_STORED, "user-1", "m2", "store", {},
        recorded_at=now - timedelta(hours=2),
    )
    engine.record(
        "org-1", EventType.MEMORY_STORED, "user-1", "m3", "store", {},
        recorded_at=now - timedelta(hours=1),
    )

    # What happened 2.5 hours ago?
    result = engine.time_travel("org-1", now - timedelta(hours=2, minutes=30))
    assert len(result) == 1
    assert result[0].details.get("target") == "m1" or result[0].target == "m1"

    # What happened 1.5 hours ago?
    result = engine.time_travel("org-1", now - timedelta(hours=1, minutes=30))
    assert len(result) == 2
    print("[PASS] test_time_travel")


def test_compliance_report():
    """Test Article 12 compliance report generation."""
    engine = AuditTrailEngine()
    engine.record("org-1", EventType.CONSTRAINT_PINNED, "user-1", "c1", "pin", {})
    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})
    engine.record(
        "org-1",
        EventType.PATTERN_DETECTED,
        "system",
        "scan-1",
        "detect",
        {"pattern": "INJ-001"},
    )

    report = engine.generate_compliance_report("org-1")

    assert report.org_id == "org-1"
    assert report.total_events >= 3  # At least 3 + the report generation event
    assert report.hash_chain_valid is True
    assert report.retention_years == 10
    assert "constraint_pinned" in report.events_by_type
    print("[PASS] test_compliance_report")


def test_compliance_report_article_12():
    """Test that report satisfies Article 12 requirements."""
    engine = AuditTrailEngine()
    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})

    report = engine.generate_compliance_report("org-1")
    report_dict = report.to_dict()

    assert report_dict["article_12_satisfied"] is True
    assert report_dict["compliance_status"] == "COMPLIANT"
    assert report_dict["retention_years"] == 10
    print("[PASS] test_compliance_report_article_12")


def test_export_jsonl():
    """Test JSONL export."""
    engine = AuditTrailEngine()
    for i in range(5):
        engine.record("org-1", EventType.MEMORY_STORED, "user-1", f"m{i}", "store", {})

    jsonl = engine.export_jsonl("org-1")
    lines = jsonl.strip().split("\n")
    assert len(lines) == 5

    # Each line should be valid JSON
    for line in lines:
        data = json.loads(line)
        assert "entry_id" in data
        assert "entry_hash" in data
    print("[PASS] test_export_jsonl")


def test_export_csv():
    """Test CSV export."""
    engine = AuditTrailEngine()
    for i in range(3):
        engine.record("org-1", EventType.MEMORY_STORED, "user-1", f"m{i}", "store", {})

    csv_data = engine.export_csv("org-1")
    lines = csv_data.strip().split("\n")
    assert len(lines) == 4  # header + 3 rows
    assert "entry_id" in lines[0]
    print("[PASS] test_export_csv")


def test_multi_tenant_isolation():
    """Test that orgs have isolated audit trails."""
    engine = AuditTrailEngine()
    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})
    engine.record("org-2", EventType.MEMORY_STORED, "user-2", "m2", "store", {})
    engine.record("org-3", EventType.MEMORY_STORED, "user-3", "m3", "store", {})

    assert engine.get_chain_length("org-1") == 1
    assert engine.get_chain_length("org-2") == 1
    assert engine.get_chain_length("org-3") == 1

    r1 = engine.verify_chain("org-1")
    r2 = engine.verify_chain("org-2")
    assert r1["valid"] is True
    assert r2["valid"] is True
    print("[PASS] test_multi_tenant_isolation")


def test_event_counts():
    """Test event count aggregation."""
    engine = AuditTrailEngine()
    engine.record("org-1", EventType.CONSTRAINT_PINNED, "user-1", "c1", "pin", {})
    engine.record("org-1", EventType.CONSTRAINT_PINNED, "user-1", "c2", "pin", {})
    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})

    counts = engine.get_event_counts("org-1")
    assert counts["constraint_pinned"] == 2
    assert counts["memory_stored"] == 1
    print("[PASS] test_event_counts")


def test_event_emission():
    """Test that events are emitted."""
    engine = AuditTrailEngine()
    events = []

    def capture(event_type, data):
        events.append(event_type)

    engine.add_listener(capture)
    engine.record("org-1", EventType.MEMORY_STORED, "user-1", "m1", "store", {})

    assert "audit_recorded" in events
    print("[PASS] test_event_emission")


def test_empty_org():
    """Test querying non-existent org."""
    engine = AuditTrailEngine()
    result = engine.verify_chain("nonexistent")
    assert result["valid"] is True
    assert result["total_entries"] == 0

    entries = engine.get_entries("nonexistent")
    assert len(entries) == 0
    print("[PASS] test_empty_org")


import json

if __name__ == "__main__":
    print("=" * 60)
    print("Audit Trail Engine — Test Suite")
    print("=" * 60)

    test_record_event()
    test_chain_linking()
    test_verify_chain_valid()
    test_verify_chain_broken()
    test_query_by_event_type()
    test_query_by_actor()
    test_query_by_time_range()
    test_query_pagination()
    test_time_travel()
    test_compliance_report()
    test_compliance_report_article_12()
    test_export_jsonl()
    test_export_csv()
    test_multi_tenant_isolation()
    test_event_counts()
    test_event_emission()
    test_empty_org()

    print("=" * 60)
    print("All 17 tests passed!")
    print("=" * 60)
