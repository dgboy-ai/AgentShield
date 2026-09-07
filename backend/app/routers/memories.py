import hashlib
import json
import uuid
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.models.memory import Memory as MemoryDB
from app.models.alert import Alert as AlertDB
from app.routers.auth import get_current_user_dep
from app.routers.constraints import hash_chain, audit_trail, signing_engine
from app.schemas.memory import MemoryCreate, MemoryResponse
from app.core.hash_chain import EntryType, ChainEntry
from app.core.audit_trail import EventType
from app.core.pattern_detection import shared_engine as pattern_engine, Severity

router = APIRouter(prefix="/api/memories", tags=["memories"])

# Use shared singleton (fixes 3 separate engines)


def _verify_db_chain(org_id: str, db: Session) -> dict:
    """
    DB-backed verification for 1.2: recomputes hashes from DB rows and checks
    previous_hash linkage. Detects direct DB tampering (content/previous_hash/entry_hash modified via SQL).
    """
    import hashlib as _hl

    rows = (
        db.query(MemoryDB)
        .filter(MemoryDB.org_id == org_id)
        .order_by(MemoryDB.created_at.asc(), MemoryDB.memory_id.asc())
        .all()
    )
    total = len(rows)
    if total == 0:
        return {"total_entries": 0, "valid": True, "broken_at": None, "checked": "db"}

    seed = hash_chain._seed_hash
    for idx, row in enumerate(rows):
        # Reconstruct payload exactly as stored at write time
        payload = {
            "memory_id": str(row.memory_id),
            "content": row.content,
            "memory_type": row.memory_type,
            "importance_score": row.importance_score,
            "trust_level": row.trust_level,
            "source_provenance": row.source_provenance,
        }
        # Sequence: use stored sequence_number if present, else idx+1 (legacy)
        seq = row.sequence_number if row.sequence_number is not None else idx + 1
        # Expected previous_hash
        expected_prev = seed if idx == 0 else rows[idx - 1].entry_hash
        # Check previous_hash linkage
        if row.previous_hash != expected_prev:
            return {
                "total_entries": total,
                "valid": False,
                "broken_at": idx,
                "broken_entry_id": str(row.memory_id),
                "reason": "previous_hash mismatch",
                "expected_prev": expected_prev,
                "actual_prev": row.previous_hash,
                "checked": "db",
            }
        # Recompute hash using same logic as ChainEntry
        # Need to use stored created_at for determinism
        tmp = ChainEntry(
            entry_id=str(row.memory_id),
            entry_type=EntryType.MEMORY,
            org_id=org_id,
            payload=payload,
            previous_hash=row.previous_hash,
            sequence_number=seq,
            created_at=row.created_at,
        )
        # Override created_at exactly as stored (ensure isoformat matches)
        tmp.created_at = row.created_at
        recomputed = tmp._compute_hash()
        # But ChainEntry.__init__ already computed with row.created_at, so recomputed == tmp.entry_hash
        # Use tmp.entry_hash as recomputed
        if recomputed != row.entry_hash:
            return {
                "total_entries": total,
                "valid": False,
                "broken_at": idx,
                "broken_entry_id": str(row.memory_id),
                "reason": "entry_hash mismatch (content tampered)",
                "expected_hash": recomputed,
                "actual_hash": row.entry_hash,
                "checked": "db",
            }
    return {"total_entries": total, "valid": True, "broken_at": None, "checked": "db"}


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
def store_memory(
    data: MemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    memory_id = str(uuid.uuid4())

    # Scan for injection patterns BEFORE touching the hash chain - scan all user-controlled fields (3.3)
    combined_text = f"{data.content} {data.source_provenance} {data.memory_type}"
    scan_result = pattern_engine.scan(combined_text)
    # Also individually scan source_provenance and memory_type to catch selective bypass
    if not scan_result.blocked:
        for field_name, field_val in [("source_provenance", data.source_provenance), ("memory_type", data.memory_type)]:
            r = pattern_engine.scan(field_val)
            if r.blocked:
                scan_result = r
                break
            # Merge matches for audit
            if r.matches:
                scan_result.matches.extend(r.matches)
                scan_result.risk_score += r.risk_score
    if scan_result.blocked:
        # Persist alert to DB
        alert = AlertDB(
            org_id=current_user.org_id,
            alert_type="memory_injection_blocked",
            severity=scan_result.max_severity.value,
            description=f"Blocked memory store: risk_score={scan_result.risk_score}",
            patterns_matched=[m.to_dict() for m in scan_result.matches],
        )
        db.add(alert)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Memory rejected by OWASP ASI06 guard",
                "risk_score": scan_result.risk_score,
                "max_severity": scan_result.max_severity.value,
                "patterns_matched": [m.to_dict() for m in scan_result.matches],
            },
        )

    # Compute hash chain (only after scan passes) - deterministic entry_id = memory_id for restart idempotency
    payload = {
        "memory_id": memory_id,
        "content": data.content,
        "memory_type": data.memory_type,
        "importance_score": data.importance_score,
        "trust_level": data.trust_level,
        "source_provenance": data.source_provenance,
    }
    entry = hash_chain.append(org_id, EntryType.MEMORY, payload, entry_id=memory_id)
    entry_hash = entry.entry_hash
    previous_hash = entry.previous_hash  # use chain's previous_hash (seed for first) not None

    # Sign the memory - include org_id and chain position to prevent cross-tenant replay (3.2)
    sign_payload = {
        **payload,
        "org_id": org_id,
        "previous_hash": previous_hash,
        "entry_hash": entry_hash,
        "sequence_number": entry.sequence_number,
    }
    sign_result = signing_engine.sign_json(sign_payload)
    kms_signature = sign_result.signature if sign_result.success else None

    # Store in database - use entry's created_at and sequence for deterministic replay
    db_memory = MemoryDB(
        memory_id=memory_id,
        org_id=current_user.org_id,
        content=data.content,
        memory_type=data.memory_type,
        importance_score=data.importance_score,
        trust_level=data.trust_level,
        source_provenance=data.source_provenance,
        previous_hash=previous_hash,
        entry_hash=entry_hash,
        sequence_number=entry.sequence_number,
        kms_signature=kms_signature,
        created_at=entry.created_at,  # sync timestamp for hash determinism
    )
    db.add(db_memory)

    # Audit - keep handle for rollback
    audit_entry = audit_trail.record(
        org_id=org_id,
        event_type=EventType.MEMORY_STORED,
        actor=str(current_user.user_id),
        target=memory_id,
        action="store",
        details={
            "memory_type": data.memory_type,
            "risk_score": scan_result.risk_score,
            "patterns_matched": len(scan_result.matches),
        },
    )

    # Atomic commit: if DB fails, rollback in-memory chain and audit to avoid phantom entry (1.2)
    try:
        db.commit()
        db.refresh(db_memory)
    except Exception as e:
        db.rollback()
        # rollback in-memory structures
        try:
            hash_chain.pop_last(org_id)
        except Exception:
            pass
        try:
            audit_trail.pop_last(org_id)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to store memory: {e}")

    return MemoryResponse(
        memory_id=memory_id,
        org_id=org_id,
        content=data.content,
        memory_type=data.memory_type,
        importance_score=data.importance_score,
        trust_level=data.trust_level,
        source_provenance=data.source_provenance,
        previous_hash=previous_hash,
        entry_hash=entry_hash,
        kms_signature=kms_signature,
        created_at=db_memory.created_at,
    )


@router.get("", response_model=list[MemoryResponse])
def list_memories(
    memory_type: str = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    # Enforce upper bound to prevent DoS via ?limit=10000000 (3.4)
    from fastapi import Query
    if limit > 100:
        limit = 100
    if offset < 0:
        offset = 0
    if limit < 1:
        limit = 1
    query = db.query(MemoryDB).filter(MemoryDB.org_id == current_user.org_id)

    if memory_type:
        query = query.filter(MemoryDB.memory_type == memory_type)

    memories = query.order_by(MemoryDB.created_at.desc()).offset(offset).limit(limit).all()

    return [
        MemoryResponse(
            memory_id=str(m.memory_id),
            org_id=str(m.org_id),
            content=m.content,
            memory_type=m.memory_type,
            importance_score=m.importance_score,
            trust_level=m.trust_level,
            source_provenance=m.source_provenance,
            previous_hash=m.previous_hash,
            entry_hash=m.entry_hash,
            kms_signature=m.kms_signature,
            created_at=m.created_at,
        )
        for m in memories
    ]


@router.get("/chain/verify")
def verify_memory_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    mem_result = hash_chain.verify(org_id)
    db_result = _verify_db_chain(org_id, db)
    # Combined verdict: chain is valid only if both in-memory and DB verify
    combined_valid = mem_result.is_valid and db_result["valid"]
    return {
        "in_memory": mem_result.to_dict(),
        "db": db_result,
        "combined_valid": combined_valid,
        # Backward compat for callers expecting is_valid/valid at top level
        "is_valid": combined_valid,
        "valid": combined_valid,
        "total_entries": db_result.get("total_entries", mem_result.total_entries),
        "checked": "both",
    }


@router.get("/{memory_id}", response_model=MemoryResponse)
def get_memory(
    memory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    memory = db.query(MemoryDB).filter(
        MemoryDB.memory_id == memory_id,
        MemoryDB.org_id == current_user.org_id,
    ).first()

    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Read-time tamper check (1.2): recompute hash for this single entry and compare
    # This catches direct DB UPDATE without breaking full chain scan
    try:
        payload = {
            "memory_id": str(memory.memory_id),
            "content": memory.content,
            "memory_type": memory.memory_type,
            "importance_score": memory.importance_score,
            "trust_level": memory.trust_level,
            "source_provenance": memory.source_provenance,
        }
        seq = memory.sequence_number if memory.sequence_number is not None else 0
        # For single check, we recompute with stored previous_hash/seq/created_at
        tmp = ChainEntry(
            entry_id=str(memory.memory_id),
            entry_type=EntryType.MEMORY,
            org_id=str(memory.org_id),
            payload=payload,
            previous_hash=memory.previous_hash,
            sequence_number=seq,
            created_at=memory.created_at,
        )
        if tmp.entry_hash != memory.entry_hash:
            # Log tamper attempt
            import logging

            logging.getLogger("agentshield.tamper").warning(
                "Tamper detected on memory %s org %s: entry_hash mismatch (stored %s vs computed %s)",
                memory.memory_id,
                memory.org_id,
                memory.entry_hash,
                tmp.entry_hash,
            )
        # Verify KMS signature on read (non-repudiation) - with cross-tenant protection (3.2)
        # Try new payload (with org_id+chain) first, fallback to old for backward compat
        if memory.kms_signature:
            try:
                sign_payload_new = {
                    **payload,
                    "org_id": str(memory.org_id),
                    "previous_hash": memory.previous_hash,
                    "entry_hash": memory.entry_hash,
                    "sequence_number": seq,
                }
                vr = signing_engine.verify_json(sign_payload_new, memory.kms_signature)
                if not vr.success:
                    # Fallback try old payload (without org_id) for legacy entries
                    vr_old = signing_engine.verify_json(payload, memory.kms_signature)
                    if not vr_old.success:
                        import logging
                        logging.getLogger("agentshield.tamper").warning(
                            f"Memory signature invalid for {memory.memory_id} org {memory.org_id}: {vr.error} backend={vr.backend.value} (also old payload failed)"
                        )
                    # else legacy valid (pre-3.2) - still log but not as tamper
                # else new payload valid
            except Exception:
                pass
    except Exception:
        pass

    return MemoryResponse(
        memory_id=str(memory.memory_id),
        org_id=str(memory.org_id),
        content=memory.content,
        memory_type=memory.memory_type,
        importance_score=memory.importance_score,
        trust_level=memory.trust_level,
        source_provenance=memory.source_provenance,
        previous_hash=memory.previous_hash,
        entry_hash=memory.entry_hash,
        kms_signature=memory.kms_signature,
        created_at=memory.created_at,
    )
