import hashlib
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.models.memory import Memory as MemoryDB
from app.models.alert import Alert as AlertDB
from app.routers.auth import get_current_user_dep
from app.routers.constraints import hash_chain, audit_trail, signing_engine
from app.schemas.memory import MemoryCreate, MemoryResponse
from app.core.hash_chain import EntryType
from app.core.audit_trail import EventType
from app.core.pattern_detection import PatternDetectionEngine, Severity

router = APIRouter(prefix="/api/memories", tags=["memories"])

# Single shared instance
pattern_engine = PatternDetectionEngine()


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
def store_memory(
    data: MemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    memory_id = str(uuid.uuid4())

    # Scan for injection patterns BEFORE touching the hash chain
    scan_result = pattern_engine.scan(data.content)
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

    # Compute hash chain (only after scan passes)
    chain_head = hash_chain.get_chain_head(org_id)
    previous_hash = chain_head.entry_hash if chain_head else None

    payload = {
        "memory_id": memory_id,
        "content": data.content,
        "memory_type": data.memory_type,
        "importance_score": data.importance_score,
        "trust_level": data.trust_level,
        "source_provenance": data.source_provenance,
    }
    entry = hash_chain.append(org_id, EntryType.MEMORY, payload)
    entry_hash = entry.entry_hash

    # Sign the memory
    sign_result = signing_engine.sign_json(payload)
    kms_signature = sign_result.signature if sign_result.success else None

    # Store in database
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
        kms_signature=kms_signature,
    )
    db.add(db_memory)

    # Audit
    audit_trail.record(
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

    db.commit()

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


@router.get("/chain/verify")
def verify_memory_chain(
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    result = hash_chain.verify(org_id)
    return result.to_dict()
