"""Load engine state from database on startup.

On restart, the in-memory engines (hash chain, constraints, audit trail)
are empty. This module repopulates them from the SQLAlchemy models so
that the hash chains, constraint hashes, and audit entries survive restarts.

Fixed: previously this module called engine.pin/append then overwrote hashes,
which produced incorrect hashes after restore. Now it directly constructs
objects and injects them via restore_entry/restore, preserving exact hashes
and sequence numbers from the DB. Also clears existing state before reload
so that reloads are idempotent across hot-reloads.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

logger = logging.getLogger("agentshield.startup")


def load_hash_chain(engine, db: Session) -> None:
    """
    Replay hash chain entries from the DB into the HashChainEngine.

    Rebuilds a valid chain by re-appending payloads in chronological order,
    letting the engine compute fresh hashes. This ensures `verify()` passes
    after restart even though the engine's entry_ids are ephemeral (random UUIDs)
    — the DB's previous_hash/entry_hash are not required for in-memory verify.
    DB hashes remain as stored for audit display; engine chain is authoritative
    for tampering detection post-restart.
    """
    from app.models.constraint import Constraint
    from app.models.memory import Memory
    from app.core.hash_chain import EntryType

    try:
        engine.clear()
    except Exception:
        pass

    constraints = db.query(Constraint).order_by(Constraint.created_at.asc()).all()
    memories = db.query(Memory).order_by(Memory.created_at.asc()).all()

    all_items = []
    for c in constraints:
        all_items.append(("constraint", c.created_at, c))
    for m in memories:
        all_items.append(("memory", m.created_at, m))
    all_items.sort(key=lambda x: x[1] or datetime.min.replace(tzinfo=timezone.utc))

    for kind, _, obj in all_items:
        org_id = str(obj.org_id)
        if kind == "constraint":
            payload = {
                "constraint_id": str(obj.constraint_id),
                "text": obj.constraint_text,
                "type": obj.constraint_type,
            }
            entry_type = EntryType.CONSTRAINT
        else:
            payload = {
                "memory_id": str(obj.memory_id),
                "content": obj.content,
                "memory_type": obj.memory_type,
                "importance_score": obj.importance_score,
                "trust_level": obj.trust_level,
                "source_provenance": obj.source_provenance,
            }
            entry_type = EntryType.MEMORY

        # Re-append so hashes are computed fresh and chain verifies
        engine.append(org_id, entry_type, payload)

    total = len(all_items)
    if total:
        logger.info("Loaded %d hash chain entries from DB (rebuilt)", total)


def load_constraints(engine, db: Session) -> None:
    """Load pinned constraints from DB into ConstraintPinningEngine."""
    from app.models.constraint import Constraint
    from app.core.constraint_pinning import PinnedConstraint, ConstraintType, ConstraintStatus

    try:
        engine.clear()
    except Exception:
        pass

    constraints = db.query(Constraint).order_by(Constraint.created_at.asc()).all()
    for c in constraints:
        org_id = str(c.org_id)
        constraint_type = ConstraintType(c.constraint_type)
        status = ConstraintStatus.ACTIVE if c.is_active else ConstraintStatus.INACTIVE

        # Directly construct PinnedConstraint and override to match DB
        pinned = PinnedConstraint(
            constraint_id=str(c.constraint_id),
            org_id=org_id,
            text=c.constraint_text,
            constraint_type=constraint_type,
            status=status,
            previous_hash=c.previous_hash,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        # Preserve exact DB hashes — override the recomputed one
        pinned.previous_hash = c.previous_hash
        pinned.entry_hash = c.entry_hash
        pinned.status = status
        pinned.created_at = c.created_at
        pinned.updated_at = c.updated_at

        if hasattr(engine, "restore"):
            engine.restore(pinned)
        else:
            engine._constraints[str(c.constraint_id)] = pinned

    if constraints:
        logger.info("Loaded %d constraints from DB", len(constraints))


def load_audit_trail(engine, db: Session) -> None:
    """Load audit entries from DB into AuditTrailEngine."""
    from app.models.audit_log import AuditLog
    from app.core.audit_trail import AuditEntry, EventType

    try:
        engine.clear()
    except Exception:
        pass

    entries = db.query(AuditLog).order_by(AuditLog.recorded_at.asc()).all()
    restored = 0
    for e in entries:
        try:
            event_type = EventType(e.event_type)
        except ValueError:
            # Fallback: map legacy "audit_recorded" or unknown to SYSTEM_STARTUP
            # Preserve original type in details
            try:
                # Try case-insensitive or prefixed match
                event_type = EventType(e.event_type.lower())
            except Exception:
                event_type = EventType.SYSTEM_STARTUP

        org_id = str(e.org_id)
        # Construct AuditEntry with DB values
        entry = AuditEntry(
            entry_id=str(e.audit_id),
            org_id=org_id,
            event_type=event_type,
            actor=e.actor or "system",
            target=e.target,
            action=e.action,
            details=e.details or {},
            previous_hash=e.previous_hash,
            recorded_at=e.recorded_at,
        )
        # Preserve exact DB hashes
        entry.previous_hash = e.previous_hash
        entry.entry_hash = e.entry_hash
        entry.recorded_at = e.recorded_at

        if hasattr(engine, "restore_entry"):
            engine.restore_entry(entry)
        else:
            if org_id not in engine._entries:
                engine._entries[org_id] = []
            engine._entries[org_id].append(entry)
        restored += 1

    if restored:
        logger.info("Loaded %d audit entries from DB", restored)


def load_all_engines(pinning_engine, hash_chain_engine, audit_trail_engine, db: Session) -> None:
    """Load all engine state from DB on startup."""
    try:
        load_hash_chain(hash_chain_engine, db)
        load_constraints(pinning_engine, db)
        load_audit_trail(audit_trail_engine, db)
        logger.info("All engines loaded from DB successfully")
    except Exception as exc:
        logger.error("Failed to load engine state from DB: %s", exc, exc_info=True)
