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


def _persist_audit_to_db(event_type: str, data: dict) -> None:
    """Listener that writes audit events to the DB audit_log table."""
    try:
        from app.models.database import SessionLocal
        db = SessionLocal()
        try:
            org_id = data.get("org_id", "unknown")
            # Use actual event_type from data if available (e.g., constraint_pinned)
            actual_event_type = data.get("event_type", event_type)
            # Fetch hashes from in-memory trail for this org (best-effort)
            prev_hash = None
            entry_hash = None
            try:
                entries = audit_trail._entries.get(org_id, [])
                if entries:
                    last = entries[-1]
                    prev_hash = last.previous_hash
                    entry_hash = last.entry_hash
                    if entry_hash is None:
                        entry_hash = last._compute_hash()
            except Exception:
                pass
            import hashlib, json
            if not entry_hash:
                entry_hash = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
            entry = AuditLogDB(
                org_id=org_id,
                event_type=actual_event_type,
                actor=data.get("actor", "system"),
                target=data.get("target"),
                action=data.get("action", actual_event_type),
                details=data,
                previous_hash=prev_hash,
                entry_hash=entry_hash,
                sequence_number=data.get("chain_length"),
            )
            db.add(entry)
            db.commit()
        except Exception as e:
            db.rollback()
            import logging
            logging.getLogger("agentshield.audit").debug("audit persist failed: %s", e)
        finally:
            db.close()
    except Exception:
        pass  # Audit persistence must never break the main path


audit_trail.add_listener(_persist_audit_to_db)


@router.post("", response_model=ConstraintResponse, status_code=status.HTTP_201_CREATED)
def create_constraint(
    data: ConstraintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)

    # Pin constraint in engine
    constraint_type = ConstraintType(data.constraint_type)
    pinned = pinning_engine.pin(org_id, data.text, constraint_type)

    # Store in database
    db_constraint = ConstraintDB(
        constraint_id=pinned.constraint_id,
        org_id=current_user.org_id,
        constraint_text=data.text,
        constraint_type=data.constraint_type,
        is_active=True,
        previous_hash=pinned.previous_hash,
        entry_hash=pinned.entry_hash,
    )
    db.add(db_constraint)

    # Add to hash chain
    hash_chain.append(
        org_id,
        EntryType.CONSTRAINT,
        {"constraint_id": pinned.constraint_id, "text": data.text, "type": data.constraint_type},
    )

    # Record audit event
    audit_trail.record(
        org_id=org_id,
        event_type=EventType.CONSTRAINT_PINNED,
        actor=str(current_user.user_id),
        target=pinned.constraint_id,
        action="pin",
        details={"text": data.text, "type": data.constraint_type},
    )

    # Sign the constraint
    signing_engine.sign_json({"constraint_id": pinned.constraint_id, "text": data.text})

    db.commit()

    return ConstraintResponse(
        constraint_id=pinned.constraint_id,
        org_id=org_id,
        text=data.text,
        constraint_type=data.constraint_type,
        is_active=True,
        previous_hash=pinned.previous_hash,
        entry_hash=pinned.entry_hash,
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

    # Use engine for filtered listing
    status_filter = None
    if is_active is not None:
        status_filter = ConstraintStatus.ACTIVE if is_active else ConstraintStatus.INACTIVE

    type_filter = None
    if constraint_type:
        type_filter = ConstraintType(constraint_type)

    constraints = pinning_engine.list_constraints(org_id, status=status_filter, constraint_type=type_filter)

    return [
        ConstraintResponse(
            constraint_id=c.constraint_id,
            org_id=c.org_id,
            text=c.text,
            constraint_type=c.constraint_type.value,
            is_active=c.status == ConstraintStatus.ACTIVE,
            previous_hash=c.previous_hash,
            entry_hash=c.entry_hash,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in constraints
    ]


@router.get("/{constraint_id}", response_model=ConstraintResponse)
def get_constraint(
    constraint_id: str,
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    constraint = pinning_engine.get(constraint_id)

    if not constraint or constraint.org_id != org_id:
        raise HTTPException(status_code=404, detail="Constraint not found")

    return ConstraintResponse(
        constraint_id=constraint.constraint_id,
        org_id=constraint.org_id,
        text=constraint.text,
        constraint_type=constraint.constraint_type.value,
        is_active=constraint.status == ConstraintStatus.ACTIVE,
        previous_hash=constraint.previous_hash,
        entry_hash=constraint.entry_hash,
        created_at=constraint.created_at,
        updated_at=constraint.updated_at,
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

    # Update via engine
    updated = pinning_engine.update(
        constraint_id,
        text=data.text,
        constraint_type=ConstraintType(data.constraint_type) if data.constraint_type else None,
    )

    # Update database
    db_constraint = db.query(ConstraintDB).filter(ConstraintDB.constraint_id == constraint_id).first()
    if db_constraint:
        if data.text:
            db_constraint.constraint_text = data.text
        if data.constraint_type:
            db_constraint.constraint_type = data.constraint_type
        db_constraint.entry_hash = updated.entry_hash
        db_constraint.previous_hash = updated.previous_hash
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
    }
