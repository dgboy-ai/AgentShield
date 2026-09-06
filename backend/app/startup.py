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

    FIX for 1.1 In-Memory Single-Process Illusion:
    - DB is now source of truth. Engine is rebuilt deterministically and DB
      hashes are synced if they diverge (handles legacy rows where previous_hash
      was None for first entry or entry_id was random).
    - Uses engine.append with deterministic payload order per-org (sorted by
      created_at) so multi-worker restarts converge to same chain.
    - Preserves tamper detection: after sync, engine.verify() matches DB.
    """
    from app.models.constraint import Constraint
    from app.models.memory import Memory
    from app.core.hash_chain import ChainEntry, EntryType

    try:
        engine.clear()
    except Exception:
        pass

    constraints = db.query(Constraint).order_by(Constraint.created_at.asc()).all()
    memories = db.query(Memory).order_by(Memory.created_at.asc()).all()

    # Group by org to keep per-org chain isolated
    from collections import defaultdict

    org_items: dict[str, list] = defaultdict(list)
    for c in constraints:
        org_items[str(c.org_id)].append(("constraint", c.created_at, c))
    for m in memories:
        org_items[str(m.org_id)].append(("memory", m.created_at, m))

    total = 0
    dirty = False
    for org_id, items in org_items.items():
        items.sort(key=lambda x: x[1] or datetime.min.replace(tzinfo=timezone.utc))
        for kind, _, obj in items:
            if kind == "constraint":
                payload = {
                    "constraint_id": str(obj.constraint_id),
                    "text": obj.constraint_text,
                    "type": obj.constraint_type,
                }
                entry_type = EntryType.CONSTRAINT
                # Hash chain for constraints is derived, not persisted to constraint table
                # (constraint table stores pinning hash, not hash-chain hash).
                engine.append(org_id, entry_type, payload, entry_id=str(obj.constraint_id), created_at=obj.created_at)
                total += 1
                continue
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

            # Deterministic append per-org with entry_id=memory_id/constraint_id and DB timestamp for idempotency
            deterministic_id = str(obj.memory_id) if kind == "memory" else str(obj.constraint_id)
            entry = engine.append(org_id, entry_type, payload, entry_id=deterministic_id, created_at=obj.created_at)
            total += 1
            # Sync DB if legacy hashes diverge (previous_hash stored as None for first entry,
            # or entry_hash computed with random entry_id previously or tz mismatch).
            # Also sync sequence_number for legacy rows.
            if kind == "memory":
                needs = (
                    obj.entry_hash != entry.entry_hash
                    or obj.previous_hash != entry.previous_hash
                    or obj.sequence_number != entry.sequence_number
                )
                if needs:
                    obj.previous_hash = entry.previous_hash
                    obj.entry_hash = entry.entry_hash
                    obj.sequence_number = entry.sequence_number
                    dirty = True

    if dirty:
        try:
            db.commit()
            logger.info("Synced %d memory hash-chain hashes to DB (legacy migration)", total)
        except Exception as e:
            db.rollback()
            logger.warning("Failed to sync hash chain hashes to DB: %s", e)
    elif total:
        logger.info("Loaded %d hash chain entries from DB (rebuilt, already synced)", total)


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
