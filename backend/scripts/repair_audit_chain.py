"""One-time repair of audit_log rows written before recorded_at was persisted.

The old _persist_audit_to_db listener omitted recorded_at, so the DB stored an
insert-time default that differs (by microseconds) from the value the entry
hash was computed from. After a restart, verify_chain's recompute check then
fails on every restored entry.

This script re-chains each org's rows in recorded_at order using the current
hash algorithm (previous_hash = seed for the first entry), rewriting
previous_hash and entry_hash so the persisted chain verifies. recorded_at is
left untouched. Run once, then restart the backend.

Usage:  python scripts/repair_audit_chain.py [--dry-run]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.database import SessionLocal  # noqa: E402
from app.models.audit_log import AuditLog  # noqa: E402
from app.core.audit_trail import AuditEntry, AuditTrailEngine, EventType  # noqa: E402

SEED = AuditTrailEngine()._seed_hash


def main() -> int:
    dry = "--dry-run" in sys.argv
    db = SessionLocal()
    try:
        orgs = [row[0] for row in db.query(AuditLog.org_id).distinct().all()]
        print(f"orgs: {len(orgs)}")
        total_fixed = 0
        for org_id in orgs:
            rows = (
                db.query(AuditLog)
                .filter(AuditLog.org_id == org_id)
                .order_by(AuditLog.recorded_at.asc())
                .all()
            )
            if not rows:
                continue
            prev = SEED
            fixed = 0
            for r in rows:
                try:
                    et = EventType(r.event_type)
                except ValueError:
                    try:
                        et = EventType(r.event_type.lower())
                    except Exception:
                        et = EventType.SYSTEM_STARTUP
                entry = AuditEntry(
                    entry_id=str(r.audit_id),
                    org_id=str(r.org_id),
                    event_type=et,
                    actor=r.actor or "system",
                    target=r.target,
                    action=r.action,
                    details=r.details or {},
                    previous_hash=prev,
                    recorded_at=r.recorded_at,
                )
                if r.previous_hash != prev or r.entry_hash != entry.entry_hash:
                    fixed += 1
                    if not dry:
                        r.previous_hash = prev
                        r.entry_hash = entry.entry_hash
                prev = entry.entry_hash
            total_fixed += fixed
            print(f"  org {org_id}: {len(rows)} entries, {fixed} repaired")
        if dry:
            print(f"dry-run: {total_fixed} rows would be repaired (no writes)")
        else:
            db.commit()
            print(f"committed: {total_fixed} rows repaired")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
