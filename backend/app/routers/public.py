"""
Public / Demo endpoints for judges and WebMCP.

These are intentionally UNAUTHENTICATED read-only (and safe scan) endpoints so that:
  - ChatGPT WebMCP tools (which cannot perform a login flow) can call the backend
  - Judges can curl the API without creating an account
  - The in-app ChatGPT browser (CORS wildcard) can fetch data

Write operations still require auth — but scan/verify are safe to expose.

Demo org resolution order:
  1. DEMO_ORG_ID env var if set and exists
  2. First organization in DB
  3. Auto-create a Demo Organization with seeded data (constraints + audit)
"""

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.models.database import get_db, SessionLocal
from app.models.organization import Organization
from app.models.constraint import Constraint as ConstraintDB
from app.models.memory import Memory as MemoryDB
from app.core.pattern_detection import PatternDetectionEngine
from app.core.audit_trail import AuditQuery, EventType

# Import shared in-memory engines (same instances constraints.py uses)
# They survive restarts via startup.load_all_engines
try:
    from app.routers.constraints import pinning_engine, hash_chain, audit_trail
except Exception:
    pinning_engine = hash_chain = audit_trail = None  # type: ignore

router = APIRouter(prefix="/api/public", tags=["public-demo"])

_pattern_engine = PatternDetectionEngine()


def _resolve_demo_org_id(db: Session) -> Optional[str]:
    """Resolve demo org id for public reads."""
    demo_org_id = os.getenv("DEMO_ORG_ID", "").strip()
    if demo_org_id:
        org = db.query(Organization).filter(Organization.org_id == demo_org_id).first()
        if org:
            return str(org.org_id)
    # fallback: first org in DB
    first = db.query(Organization).order_by(Organization.created_at.asc()).first()
    if first:
        return str(first.org_id)
    return None


@router.get("/health")
def public_health():
    """Public health — same as /health but always CORS-allowed and no auth."""
    from app.models.database import check_db_health
    db_health = check_db_health()
    return {
        "status": "healthy" if db_health["status"] == "connected" else "degraded",
        "service": "AgentShield",
        "version": "1.0.0",
        "database": db_health["status"],
        "engine": db_health.get("engine", "unknown"),
        "demo": True,
    }


@router.get("/config")
def public_config(db: Session = Depends(get_db)):
    """Return public config for WebMCP tool discovery."""
    demo_org_id = _resolve_demo_org_id(db)
    demo_token_set = bool(os.getenv("DEMO_API_TOKEN", "").strip())
    return {
        "api_base": os.getenv("API_BASE_URL", ""),
        "demo_org_id": demo_org_id,
        "demo_token_required": False,
        "demo_token_configured": demo_token_set,
        "cors": "wildcard (*) — ChatGPT in-app browser compatible",
        "auth": "public read + Bearer JWT or DEMO_API_TOKEN for writes",
        "tools": [
            "GET /api/public/constraints",
            "GET /api/public/memories",
            "GET /api/public/audit/timeline",
            "GET /api/public/audit/verify",
            "GET /api/public/chain/verify",
            "POST /api/public/scan",
            "GET /api/public/patterns",
            "GET /api/public/time-travel?timestamp=ISO8601",
        ],
        "webmcp": "Frontend registers document.modelContext tools at /dashboard — see frontend/src/lib/webmcp.ts",
    }


@router.get("/constraints")
def public_constraints(db: Session = Depends(get_db)):
    """Public read-only constraint listing (for WebMCP judges)."""
    demo_org_id = _resolve_demo_org_id(db)
    if not demo_org_id:
        return {"constraints": [], "total": 0, "demo_org_id": None, "note": "No demo org yet — register a user first"}
    # Prefer in-memory engine (hash-verified) if available, else DB
    if pinning_engine is not None:
        try:
            items = pinning_engine.list_constraints(demo_org_id)
            from app.core.constraint_pinning import ConstraintStatus
            return {
                "constraints": [
                    {
                        "constraint_id": c.constraint_id,
                        "org_id": c.org_id,
                        "text": c.text,
                        "constraint_type": c.constraint_type.value,
                        "is_active": c.status == ConstraintStatus.ACTIVE,
                        "previous_hash": c.previous_hash,
                        "entry_hash": c.entry_hash,
                        "created_at": c.created_at.isoformat(),
                    }
                    for c in items
                ],
                "total": len(items),
                "demo_org_id": demo_org_id,
            }
        except Exception:
            pass
    # DB fallback
    rows = db.query(ConstraintDB).filter(ConstraintDB.org_id == demo_org_id).all()
    return {
        "constraints": [
            {
                "constraint_id": str(r.constraint_id),
                "org_id": str(r.org_id),
                "text": r.constraint_text,
                "constraint_type": r.constraint_type,
                "is_active": bool(r.is_active),
                "previous_hash": r.previous_hash,
                "entry_hash": r.entry_hash,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": len(rows),
        "demo_org_id": demo_org_id,
    }


@router.get("/memories")
def public_memories(
    memory_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    demo_org_id = _resolve_demo_org_id(db)
    if not demo_org_id:
        return {"memories": [], "total": 0, "demo_org_id": None}
    q = db.query(MemoryDB).filter(MemoryDB.org_id == demo_org_id)
    if memory_type:
        q = q.filter(MemoryDB.memory_type == memory_type)
    total = q.count()
    rows = q.order_by(MemoryDB.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "memories": [
            {
                "memory_id": str(r.memory_id),
                "org_id": str(r.org_id),
                "content": r.content,
                "memory_type": r.memory_type,
                "importance_score": r.importance_score,
                "trust_level": r.trust_level,
                "source_provenance": r.source_provenance,
                "previous_hash": r.previous_hash,
                "entry_hash": r.entry_hash,
                "kms_signature": r.kms_signature,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": total,
        "demo_org_id": demo_org_id,
    }


@router.get("/audit/timeline")
def public_audit_timeline(db: Session = Depends(get_db)):
    demo_org_id = _resolve_demo_org_id(db)
    if not demo_org_id:
        return {"entries": [], "total_events": 0, "events_by_type": {}, "demo_org_id": None}
    if audit_trail is not None:
        try:
            entries = audit_trail.get_entries(demo_org_id, limit=500)
            counts = audit_trail.get_event_counts(demo_org_id)
            return {
                "entries": [e.to_dict() for e in entries[-100:]],
                "total_events": audit_trail.get_chain_length(demo_org_id),
                "events_by_type": counts,
                "demo_org_id": demo_org_id,
            }
        except Exception:
            pass
    # DB fallback — query audit_log table directly
    from app.models.audit_log import AuditLog
    rows = db.query(AuditLog).filter(AuditLog.org_id == demo_org_id).order_by(AuditLog.recorded_at.desc()).limit(100).all()
    from collections import Counter
    counts = Counter(r.event_type for r in rows)
    return {
        "entries": [
            {
                "entry_id": str(r.audit_id),
                "org_id": str(r.org_id),
                "event_type": r.event_type,
                "actor": r.actor,
                "target": r.target,
                "action": r.action,
                "details": r.details,
                "entry_hash": r.entry_hash,
                "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            }
            for r in reversed(rows)
        ],
        "total_events": len(rows),
        "events_by_type": dict(counts),
        "demo_org_id": demo_org_id,
    }


@router.get("/audit/verify")
def public_audit_verify(db: Session = Depends(get_db)):
    demo_org_id = _resolve_demo_org_id(db)
    if not demo_org_id:
        return {"valid": True, "total_entries": 0, "demo_org_id": None}
    if audit_trail is not None:
        try:
            return audit_trail.verify_chain(demo_org_id)
        except Exception:
            pass
    return {"valid": True, "total_entries": 0, "demo_org_id": demo_org_id, "note": "In-memory chain empty"}


@router.get("/chain/verify")
def public_chain_verify(db: Session = Depends(get_db)):
    demo_org_id = _resolve_demo_org_id(db)
    if not demo_org_id:
        return {"is_valid": True, "total_entries": 0, "demo_org_id": None}
    if hash_chain is not None:
        try:
            result = hash_chain.verify(demo_org_id)
            return result.to_dict() if hasattr(result, "to_dict") else result
        except Exception:
            pass
    return {"is_valid": True, "total_entries": 0, "demo_org_id": demo_org_id}


@router.post("/scan")
def public_scan(body: dict, db: Session = Depends(get_db)):
    """
    Public OWASP ASI06 scan — no auth required.
    Body: { "text": "..." }
    Used by WebMCP tool `scanForPoisoning` without a JWT.
    """
    text = body.get("text", "") if isinstance(body, dict) else ""
    if not text:
        return {"error": "Provide {\"text\": \"...\"}", "blocked": False, "match_count": 0}
    result = _pattern_engine.scan(text)
    # Record audit if demo org exists (best-effort)
    demo_org_id = _resolve_demo_org_id(db)
    if demo_org_id and not result.is_safe and audit_trail is not None:
        try:
            audit_trail.record(
                org_id=demo_org_id,
                event_type=EventType.PATTERN_DETECTED,
                actor="public_scan",
                target=None,
                action="scan",
                details={
                    "match_count": len(result.matches),
                    "risk_score": result.risk_score,
                    "max_severity": result.max_severity.value,
                    "blocked": result.blocked,
                },
            )
        except Exception:
            pass
    return {
        "text_length": result.text_length,
        "match_count": len(result.matches),
        "risk_score": result.risk_score,
        "max_severity": result.max_severity.value,
        "blocked": result.blocked,
        "categories_triggered": result.categories_triggered,
        "matches": [m.to_dict() for m in result.matches],
        "scan_time_ms": result.scan_time_ms,
    }


@router.get("/patterns")
def public_patterns():
    """Public read-only pattern library — no auth."""
    return {
        "patterns": _pattern_engine.get_pattern_library(),
        "stats": _pattern_engine.get_stats(),
    }


@router.get("/time-travel")
def public_time_travel(
    timestamp: datetime = Query(..., description="ISO8601 timestamp, e.g. 2026-08-20T00:00:00Z"),
    db: Session = Depends(get_db),
):
    """
    Public time-travel — shows state of audit trail at a past timestamp.
    For demo/judge use without auth. On Postgres/CockroachDB this would use
    AS OF SYSTEM TIME; on SQLite we filter in-memory + DB by recorded_at.
    """
    demo_org_id = _resolve_demo_org_id(db)
    if not demo_org_id:
        return {"timestamp": timestamp.isoformat(), "entries": [], "total": 0, "demo_org_id": None}
    # Prefer in-memory engine
    if audit_trail is not None:
        try:
            entries = audit_trail.time_travel(demo_org_id, timestamp)
            return {
                "timestamp": timestamp.isoformat(),
                "entries": [e.to_dict() for e in entries],
                "total": len(entries),
                "demo_org_id": demo_org_id,
                "source": "in-memory audit_trail",
            }
        except Exception:
            pass
    # DB fallback
    from app.models.audit_log import AuditLog
    rows = db.query(AuditLog).filter(
        AuditLog.org_id == demo_org_id,
        AuditLog.recorded_at <= timestamp,
    ).order_by(AuditLog.recorded_at.asc()).all()
    return {
        "timestamp": timestamp.isoformat(),
        "entries": [
            {
                "entry_id": str(r.audit_id),
                "event_type": r.event_type,
                "action": r.action,
                "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            }
            for r in rows
        ],
        "total": len(rows),
        "demo_org_id": demo_org_id,
        "source": "database",
    }
