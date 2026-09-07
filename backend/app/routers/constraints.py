from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.models.constraint import Constraint as ConstraintDB
from app.models.audit_log import AuditLog as AuditLogDB
from app.routers.auth import get_current_user_dep
from app.schemas.constraint import ConstraintCreate, ConstraintUpdate, ConstraintResponse
from app.core.constraint_pinning import (
    ConstraintPinningEngine,
    ConstraintType,
    ConstraintStatus,
)
from app.core.hash_chain import HashChainEngine, EntryType
from app.core.audit_trail import AuditTrailEngine, EventType
from app.core.signing import SigningEngine

router = APIRouter(prefix="/api/constraints", tags=["constraints"])

# Shared engine instances (in-memory for MVP, swap to DB-backed later)
pinning_engine = ConstraintPinningEngine()
hash_chain = HashChainEngine()
audit_trail = AuditTrailEngine()
signing_engine = SigningEngine()


_audit_retry_queue: list[dict] = []  # for 4.7: retry failed audit writes


def _flush_audit_retry_queue():
    """Try to flush queued audit entries (called on next successful write)."""
    if not _audit_retry_queue:
        return
    from app.models.database import SessionLocal
    import logging
    db = SessionLocal()
    try:
        for item in list(_audit_retry_queue):
            try:
                entry = AuditLogDB(**item)
                db.add(entry)
                db.commit()
                _audit_retry_queue.remove(item)
                logging.getLogger("agentshield.audit").info(f"Retried audit log {item.get('audit_id')} succeeded")
            except Exception as e:
                db.rollback()
                logging.getLogger("agentshield.audit").warning(f"Retry failed for {item.get('audit_id')}: {e}")
                break
    finally:
        db.close()


def _persist_audit_to_db(event_type: str, data: dict) -> None:
    """Listener that writes audit events to the DB audit_log table.
    Fixed: use audit entry's actual entry_id as DB audit_id for restart idempotency,
    and queue for retry on failure (4.7) instead of silent drop."""
    try:
        from app.models.database import SessionLocal
        db = SessionLocal()
        try:
            org_id = data.get("org_id", "unknown")
            actual_event_type = data.get("event_type", event_type)
            last = None
            try:
                entries = audit_trail._entries.get(org_id, [])
                if entries:
                    last = entries[-1]
            except Exception:
                pass
            if last is not None:
                prev_hash = last.previous_hash
                entry_hash = last.entry_hash
                details = last.details
                actor = last.actor
                target = last.target
                action = last.action
                entry_id = last.entry_id
            else:
                import hashlib, json
                prev_hash = None
                entry_hash = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
                details = data
                actor = data.get("actor", "system")
                target = data.get("target")
                action = data.get("action", actual_event_type)
                entry_id = data.get("entry_id") or str(__import__("uuid").uuid4())
            entry_data = dict(
                audit_id=entry_id,
                org_id=org_id,
                event_type=actual_event_type,
                actor=actor,
                target=target,
                action=action,
                details=details,
                previous_hash=prev_hash,
                entry_hash=entry_hash,
                sequence_number=data.get("chain_length"),
            )
            entry = AuditLogDB(**entry_data)
            db.add(entry)
            db.commit()
            # On success, try to flush any queued retries
            if _audit_retry_queue:
                _flush_audit_retry_queue()
        except Exception as e:
            db.rollback()
            import logging
            logging.getLogger("agentshield.audit").warning(f"audit persist failed, queuing for retry: {e}")
            # Queue for retry instead of silent drop (4.7)
            try:
                _audit_retry_queue.append(entry_data)  # type: ignore
                if len(_audit_retry_queue) > 1000:
                    # Prevent unbounded growth
                    _audit_retry_queue.pop(0)
            except Exception:
                pass
        finally:
            db.close()
    except Exception as e:
        import logging
        logging.getLogger("agentshield.audit").error(f"audit persist outer failed: {e}")


audit_trail.add_listener(_persist_audit_to_db)


@router.post("", response_model=ConstraintResponse, status_code=status.HTTP_201_CREATED)
def create_constraint(
    data: ConstraintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
    force: bool = False,
):
    org_id = str(current_user.org_id)

    # Pin constraint in engine with provenance hardening (mitigates operator-impersonation bypass)
    # If text looks like rescission, pin() will raise unless force=True (requires explicit out-of-band approval)
    # We surface force via query param ?force=true
    from fastapi import Request

    constraint_type = ConstraintType(data.constraint_type)
    try:
        pinned = pinning_engine.pin(org_id, data.text, constraint_type, force=force)
    except ValueError as ve:
        # Provenance check blocked - return 400 with reason, and audit the attempt
        audit_trail.record(
            org_id=org_id,
            event_type=EventType.CONSTRAINT_COMPROMISED,
            actor=str(current_user.user_id),
            target="provenance_block",
            action="blocked",
            details={"text": data.text[:200], "reason": str(ve)},
        )
        raise HTTPException(status_code=400, detail=str(ve))

    # Sign the constraint with org binding to prevent cross-tenant replay (3.2)
    sign_payload = {"constraint_id": pinned.constraint_id, "text": data.text, "org_id": org_id, "entry_hash": pinned.entry_hash, "previous_hash": pinned.previous_hash}
    sign_result = signing_engine.sign_json(sign_payload)
    kms_signature = sign_result.signature if sign_result.success else None

    # Store in database
    db_constraint = ConstraintDB(
        constraint_id=pinned.constraint_id,
        org_id=current_user.org_id,
        constraint_text=data.text,
        constraint_type=data.constraint_type,
        is_active=True,
        previous_hash=pinned.previous_hash,
        entry_hash=pinned.entry_hash,
        kms_signature=kms_signature,
    )
    db.add(db_constraint)

    # Add to hash chain - deterministic entry_id for restart idempotency
    hash_chain.append(
        org_id,
        EntryType.CONSTRAINT,
        {"constraint_id": pinned.constraint_id, "text": data.text, "type": data.constraint_type},
        entry_id=pinned.constraint_id,
    )

    # Record audit event (include signing backend for non-repudiation)
    audit_trail.record(
        org_id=org_id,
        event_type=EventType.CONSTRAINT_PINNED,
        actor=str(current_user.user_id),
        target=pinned.constraint_id,
        action="pin",
        details={"text": data.text, "type": data.constraint_type, "kms_backend": sign_result.backend.value, "kms_key_id": sign_result.key_id, "sign_success": sign_result.success},
    )

    db.commit()

    return ConstraintResponse(
        constraint_id=pinned.constraint_id,
        org_id=org_id,
        text=data.text,
        constraint_type=data.constraint_type,
        is_active=True,
        previous_hash=pinned.previous_hash,
        entry_hash=pinned.entry_hash,
        kms_signature=kms_signature,
        created_at=pinned.created_at,
        updated_at=pinned.updated_at,
    )


@router.get("", response_model=list[ConstraintResponse])
def list_constraints(
    constraint_type: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)

    # Use DB as source for kms_signature and filtering, engine for status
    q = db.query(ConstraintDB).filter(ConstraintDB.org_id == current_user.org_id)
    if constraint_type:
        q = q.filter(ConstraintDB.constraint_type == constraint_type)
    if is_active is not None:
        q = q.filter(ConstraintDB.is_active == is_active)
    rows = q.order_by(ConstraintDB.created_at.desc()).all()
    # Build map for hash verification
    return [
        ConstraintResponse(
            constraint_id=str(r.constraint_id),
            org_id=str(r.org_id),
            text=r.constraint_text,
            constraint_type=r.constraint_type,
            is_active=bool(r.is_active),
            previous_hash=r.previous_hash,
            entry_hash=r.entry_hash,
            kms_signature=r.kms_signature,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/integrity/verify")
def verify_integrity(
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    report = pinning_engine.generate_integrity_report(org_id)
    chain_result = hash_chain.verify(org_id)

    return {
        "constraint_integrity": report.to_dict(),
        "hash_chain": chain_result.to_dict(),
    }


@router.get("/integrity/score")
def get_integrity_score(
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    score = pinning_engine.get_integrity_score(org_id)
    overhead = pinning_engine.get_token_overhead(org_id)

    return {
        "org_id": org_id,
        "integrity_score": score,
        "token_overhead": overhead,
        "token_overhead_pct": round(overhead * 100, 4),
        "estimated_tokens": int(overhead * 128_000),
    }


@router.get("/pinned/prompt")
def get_pinned_prompt(
    current_user: User = Depends(get_current_user_dep),
):
    """Real harness integration: returns system prompt fragment with all pinned constraints.
    Use this to prepend to every LLM call after compaction (OpenAI, Anthropic, etc.).
    """
    org_id = str(current_user.org_id)
    prompt = pinning_engine.build_pinned_system_prompt(org_id)
    overhead = pinning_engine.get_token_overhead(org_id)
    return {"prompt": prompt, "token_overhead": overhead, "overhead_pct": round(overhead * 100, 4)}


@router.get("/pinned/messages")
def get_pinned_messages(
    current_user: User = Depends(get_current_user_dep),
):
    """Returns pinned constraints as OpenAI-compatible messages for direct injection."""
    org_id = str(current_user.org_id)
    msgs = pinning_engine.as_openai_messages(org_id)
    return {"messages": msgs, "count": len(msgs)}


@router.post("/simulate-compaction")
def simulate_compaction_endpoint(
    payload: dict,
    current_user: User = Depends(get_current_user_dep),
):
    """
    Simulate compaction with real strategy handling.
    Body: {"context": [{"role": "user", "content": "..."}], "strategy": "recency_truncate|head_tail|hierarchical|llm_summarize", "max_turns": 10}
    Returns compaction event showing what was lost and pinned overhead.
    """
    from app.core.constraint_pinning import CompactionStrategy

    org_id = str(current_user.org_id)
    context = payload.get("context", [])
    strategy_str = payload.get("strategy", "recency_truncate")
    max_turns = int(payload.get("max_turns", 10))
    try:
        strategy = CompactionStrategy(strategy_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"strategy must be one of {[s.value for s in CompactionStrategy]}")
    event = pinning_engine.simulate_compaction(org_id, context, strategy, max_turns)
    # Also return what pinned would look like after
    reinjected = pinning_engine.re_inject_constraints(org_id, event.context_after)
    verify = pinning_engine.verify_post_compaction(org_id, reinjected)
    return {
        "event": event.to_dict(),
        "reinjected_length": len(reinjected),
        "verify_after_reinject": verify,
        "token_overhead": pinning_engine.get_token_overhead(org_id),
    }


@router.get("/provenance/check")
def check_provenance(
    text: str,
    current_user: User = Depends(get_current_user_dep),
):
    """Check if text would be blocked by provenance hardening."""
    result = pinning_engine.check_provenance(text)
    return result


@router.get("/{constraint_id}", response_model=ConstraintResponse)
def get_constraint(
    constraint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    row = db.query(ConstraintDB).filter(ConstraintDB.constraint_id == constraint_id, ConstraintDB.org_id == current_user.org_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Constraint not found")
    # Verify signature on read with cross-tenant protection (3.2) - try new then old for backward compat
    if row.kms_signature:
        try:
            sign_payload_new = {"constraint_id": str(row.constraint_id), "text": row.constraint_text, "org_id": str(row.org_id), "entry_hash": row.entry_hash, "previous_hash": row.previous_hash}
            vr = signing_engine.verify_json(sign_payload_new, row.kms_signature)
            if not vr.success:
                vr_old = signing_engine.verify_json({"constraint_id": str(row.constraint_id), "text": row.constraint_text}, row.kms_signature)
                if not vr_old.success:
                    import logging
                    logging.getLogger("agentshield.tamper").warning(f"Constraint signature invalid for {constraint_id} org {org_id}: {vr.error} (also old failed)")
        except Exception:
            pass
    return ConstraintResponse(
        constraint_id=str(row.constraint_id),
        org_id=str(row.org_id),
        text=row.constraint_text,
        constraint_type=row.constraint_type,
        is_active=bool(row.is_active),
        previous_hash=row.previous_hash,
        entry_hash=row.entry_hash,
        kms_signature=row.kms_signature,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.put("/{constraint_id}", response_model=ConstraintResponse)
def update_constraint(
    constraint_id: str,
    data: ConstraintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    constraint = pinning_engine.get(constraint_id)

    if not constraint or constraint.org_id != org_id:
        raise HTTPException(status_code=404, detail="Constraint not found")

    # Provenance check for text update
    if data.text:
        prov = pinning_engine.check_provenance(data.text)
        if prov["is_rescission"]:
            raise HTTPException(status_code=400, detail=f"Provenance check blocked: {prov['reason']}")

    # Update via engine
    updated = pinning_engine.update(
        constraint_id,
        text=data.text,
        constraint_type=ConstraintType(data.constraint_type) if data.constraint_type else None,
    )

    # Re-sign if text changed with cross-tenant binding
    new_sig = None
    if data.text:
        sign_payload_upd = {"constraint_id": constraint_id, "text": updated.text, "org_id": org_id, "entry_hash": updated.entry_hash, "previous_hash": updated.previous_hash}
        sr = signing_engine.sign_json(sign_payload_upd)
        new_sig = sr.signature if sr.success else None

    # Update database
    db_constraint = db.query(ConstraintDB).filter(ConstraintDB.constraint_id == constraint_id).first()
    if db_constraint:
        if data.text:
            db_constraint.constraint_text = data.text
        if data.constraint_type:
            db_constraint.constraint_type = data.constraint_type
        db_constraint.entry_hash = updated.entry_hash
        db_constraint.previous_hash = updated.previous_hash
        if new_sig:
            db_constraint.kms_signature = new_sig
        db.commit()

    # Audit
    audit_trail.record(
        org_id=org_id,
        event_type=EventType.CONSTRAINT_UPDATED,
        actor=str(current_user.user_id),
        target=constraint_id,
        action="update",
        details={"changes": data.dict(exclude_none=True)},
    )

    return ConstraintResponse(
        constraint_id=updated.constraint_id,
        org_id=updated.org_id,
        text=updated.text,
        constraint_type=updated.constraint_type.value,
        is_active=updated.status == ConstraintStatus.ACTIVE,
        previous_hash=updated.previous_hash,
        entry_hash=updated.entry_hash,
        kms_signature=new_sig or db_constraint.kms_signature if db_constraint else new_sig,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.delete("/{constraint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_constraint(
    constraint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    constraint = pinning_engine.get(constraint_id)

    if not constraint or constraint.org_id != org_id:
        raise HTTPException(status_code=404, detail="Constraint not found")

    # Deactivate via engine
    pinning_engine.deactivate(constraint_id)

    # Update database
    db_constraint = db.query(ConstraintDB).filter(ConstraintDB.constraint_id == constraint_id).first()
    if db_constraint:
        db_constraint.is_active = False
        db.commit()

    # Audit
    audit_trail.record(
        org_id=org_id,
        event_type=EventType.CONSTRAINT_DEACTIVATED,
        actor=str(current_user.user_id),
        target=constraint_id,
        action="deactivate",
        details={},
    )



