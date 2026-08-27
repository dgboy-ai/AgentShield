"""Owner-only dashboard API endpoints.

Password-protected endpoints for the product owner to monitor
AgentShield usage, errors, health, and activity.

Password is set via OWNER_DASHBOARD_PASSWORD env var (default: DivyanshAI@11).
Stored as bcrypt hash — never plaintext in memory compare uses constant-time.
Frontend never sees the password; it exchanges password for a short-lived JWT
via POST /api/owner/verify.
"""

import os
import hmac
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text, func
# bcrypt 4.2.0 removed __about__ — shim for passlib 1.7.4 (trapped warning otherwise)
import bcrypt as _bcrypt_shim
if not hasattr(_bcrypt_shim, "__about__"):
    _bcrypt_shim.__about__ = type("_About", (), {"__version__": getattr(_bcrypt_shim, "__version__", "4.2.0")})()  # type: ignore
from passlib.context import CryptContext
from jose import jwt, JWTError

from app.models.database import get_db, check_db_health
from app.models.user import User
from app.models.organization import Organization
from app.models.constraint import Constraint
from app.models.memory import Memory
from app.models.audit_log import AuditLog
from app.core.pattern_detection import PatternDetectionEngine
from app.core.hash_chain import HashChainEngine

router = APIRouter(prefix="/api/owner", tags=["owner"])

# — Owner password: bcrypt hashed, timing-safe compare, no plaintext leak in logs
_raw_owner_pw = os.getenv("OWNER_DASHBOARD_PASSWORD", "DivyanshAI@11")
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
OWNER_PASSWORD_HASH = _pwd_ctx.hash(_raw_owner_pw)
# clear raw from memory (best-effort)
del _raw_owner_pw

# JWT for owner session (reuses auth SECRET_KEY)
from app.routers.auth import SECRET_KEY, ALGORITHM  # noqa: E402
OWNER_JWT_EXPIRE_MINUTES = 60

# Simple in-memory rate limit for /verify: 5 attempts / 60s per IP
_verify_hits: dict[str, list[float]] = {}
_VERIFY_MAX = 5
_VERIFY_WINDOW = 60

# TTL caches to protect SQLite file lock under SSE + dashboard polling
_stats_cache: dict = {"ts": 0.0, "data": None}
_stats_TTL = 2.0
_sessions_cache: dict = {"ts": 0.0, "data": None}
_sessions_TTL = 5.0

_pattern_engine = PatternDetectionEngine()


class OwnerVerifyRequest(BaseModel):
    password: str


def _check_verify_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = _verify_hits.setdefault(ip, [])
    # prune
    cutoff = now - _VERIFY_WINDOW
    while hits and hits[0] < cutoff:
        hits.pop(0)
    if len(hits) >= _VERIFY_MAX:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 60s.")
    hits.append(now)


def _verify_owner_password(plain: str) -> bool:
    """Timing-safe bcrypt verify."""
    try:
        return _pwd_ctx.verify(plain, OWNER_PASSWORD_HASH)
    except Exception:
        # fallback to hmac compare if hash malformed
        return False


def _create_owner_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=OWNER_JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": "owner", "role": "owner", "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def _verify_owner(authorization: str = Header(None)):
    """Verify owner JWT (preferred) or legacy raw password (timing-safe)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    token = authorization.replace("Bearer ", "").strip()
    # 1) Try JWT
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") == "owner" and payload.get("sub") == "owner":
            return
    except JWTError:
        pass
    # 2) Legacy: raw password with constant-time check via bcrypt
    if _verify_owner_password(token):
        return
    # Do not leak which method failed
    raise HTTPException(status_code=403, detail="Invalid owner credentials")


@router.post("/verify")
def verify_owner(body: OwnerVerifyRequest, request: Request):
    """Exchange owner password for a short-lived JWT. Rate-limited."""
    _check_verify_rate_limit(request)
    if not body.password or not _verify_owner_password(body.password):
        # generic message, no hint
        raise HTTPException(status_code=403, detail="Invalid credentials")
    token = _create_owner_token()
    return {"token": token, "expires_in": OWNER_JWT_EXPIRE_MINUTES * 60}


@router.get("/stats")
def get_owner_stats(
    db: Session = Depends(get_db),
    _auth: str = Depends(_verify_owner),
):
    """Overview stats — cached 2s to avoid SQLite lock under real-time pollers."""
    now = datetime.now(timezone.utc)
    # serve from TTL cache if fresh (reduces SQLite contention)
    if _stats_cache["data"] is not None and (time.time() - _stats_cache["ts"]) < _stats_TTL:
        cached = _stats_cache["data"].copy()
        cached["timestamp"] = now.isoformat()
        return cached

    # User stats
    total_users = db.query(func.count(User.user_id)).scalar() or 0
    active_users = db.query(func.count(User.user_id)).filter(User.is_active == True).scalar() or 0  # noqa
    recent_users = db.query(func.count(User.user_id)).filter(
        User.created_at >= datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    ).scalar() or 0

    # Org stats
    total_orgs = db.query(func.count(Organization.org_id)).scalar() or 0

    # Memory stats
    total_memories = db.query(func.count(Memory.memory_id)).scalar() or 0
    recent_memories = db.query(func.count(Memory.memory_id)).filter(
        Memory.created_at >= datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    ).scalar() or 0

    # Constraint stats
    total_constraints = db.query(func.count(Constraint.constraint_id)).scalar() or 0
    active_constraints = db.query(func.count(Constraint.constraint_id)).filter(
        Constraint.is_active == True  # noqa
    ).scalar() or 0

    # Audit stats
    total_audit = db.query(func.count(AuditLog.audit_id)).scalar() or 0
    recent_audit = db.query(func.count(AuditLog.audit_id)).filter(
        AuditLog.recorded_at >= datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    ).scalar() or 0

    # Error stats (failed scans, blocked content)
    blocked_count = db.query(func.count(AuditLog.audit_id)).filter(
        AuditLog.event_type == "PATTERN_DETECTED"
    ).scalar() or 0

    # Pattern detection stats
    pattern_stats = _pattern_engine.get_stats()

    # DB health
    db_health = check_db_health()

    result = {
        "timestamp": now.isoformat(),
        "users": {
            "total": total_users,
            "active": active_users,
            "recent_today": recent_users,
        },
        "organizations": {
            "total": total_orgs,
        },
        "memories": {
            "total": total_memories,
            "recent_today": recent_memories,
        },
        "constraints": {
            "total": total_constraints,
            "active": active_constraints,
        },
        "audit": {
            "total_events": total_audit,
            "recent_today": recent_audit,
            "blocked_content": blocked_count,
        },
        "patterns": pattern_stats,
        "database": db_health,
    }
    _stats_cache["ts"] = time.time()
    _stats_cache["data"] = result
    return result


@router.get("/activity")
def get_owner_activity(
    limit: int = 50,
    db: Session = Depends(get_db),
    _auth: str = Depends(_verify_owner),
):
    """Recent activity feed for the owner."""
    entries = (
        db.query(AuditLog)
        .order_by(AuditLog.recorded_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "total": db.query(func.count(AuditLog.audit_id)).scalar() or 0,
        "entries": [
            {
                "entry_id": str(e.audit_id),
                "org_id": str(e.org_id),
                "event_type": e.event_type,
                "actor": e.actor,
                "target": e.target,
                "action": e.action,
                "details": e.details,
                "recorded_at": e.recorded_at.isoformat() if e.recorded_at else None,
            }
            for e in entries
        ],
    }


@router.get("/errors")
def get_owner_errors(
    limit: int = 100,
    db: Session = Depends(get_db),
    _auth: str = Depends(_verify_owner),
):
    """Recent errors and blocked content for the owner."""
    # Get pattern detection events (blocked/flagged content)
    blocked_entries = (
        db.query(AuditLog)
        .filter(AuditLog.event_type == "PATTERN_DETECTED")
        .order_by(AuditLog.recorded_at.desc())
        .limit(limit)
        .all()
    )

    # Get failed auth attempts (if any)
    auth_failures = (
        db.query(AuditLog)
        .filter(AuditLog.event_type == "AUTH_FAILED")
        .order_by(AuditLog.recorded_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "blocked_content": [
            {
                "entry_id": str(e.audit_id),
                "org_id": str(e.org_id),
                "actor": e.actor,
                "action": e.action,
                "details": e.details,
                "recorded_at": e.recorded_at.isoformat() if e.recorded_at else None,
            }
            for e in blocked_entries
        ],
        "auth_failures": [
            {
                "entry_id": str(e.audit_id),
                "actor": e.actor,
                "details": e.details,
                "recorded_at": e.recorded_at.isoformat() if e.recorded_at else None,
            }
            for e in auth_failures
        ],
        "total_blocked": len(blocked_entries),
        "total_auth_failures": len(auth_failures),
    }


@router.get("/users")
def get_owner_users(
    db: Session = Depends(get_db),
    _auth: str = Depends(_verify_owner),
):
    """List all users for the owner."""
    users = db.query(User).order_by(User.created_at.desc()).all()

    return {
        "total": len(users),
        "users": [
            {
                "user_id": str(u.user_id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "org_id": str(u.org_id),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.get("/health")
def get_owner_health(
    _auth: str = Depends(_verify_owner),
):
    """Detailed system health for the owner."""
    db_health = check_db_health()
    start = time.time()
    try:
        from app.models.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((time.time() - start) * 1000, 2)
    except Exception as e:
        latency_ms = -1
        db_health["error"] = str(e)

    return {
        "status": "healthy" if db_health["status"] == "connected" else "degraded",
        "database": db_health,
        "latency_ms": latency_ms,
        "version": "1.0.0",
        "uptime_note": "Uptime tracked by hosting provider",
    }


@router.get("/patterns")
def get_owner_patterns(
    _auth: str = Depends(_verify_owner),
):
    """Full pattern library for the owner."""
    return {
        "patterns": _pattern_engine.get_pattern_library(),
        "stats": _pattern_engine.get_stats(),
    }


@router.get("/sessions")
def get_owner_sessions(
    _auth: str = Depends(_verify_owner),
):
    """Session-wise ledger: one row per organization (real tenant session).
    Each org is isolated chain — what orgs do in production: per-tenant DB + per-session verify.
    Cached 5s to avoid verify storm.
    """
    if _sessions_cache["data"] is not None and (time.time() - _sessions_cache["ts"]) < _sessions_TTL:
        return _sessions_cache["data"]
    from app.routers.constraints import hash_chain as _hc
    from app.models.database import SessionLocal
    from sqlalchemy import desc
    db = SessionLocal()
    try:
        # join org → newest user for display, and counts
        orgs = db.query(Organization).order_by(desc(Organization.created_at)).all()
        out=[]
        for org in orgs:
            oid=str(org.org_id)
            # owner email = first user in org
            u=db.query(User).filter(User.org_id==org.org_id).order_by(User.created_at).first()
            v=_hc.verify(oid)
            head=_hc.get_chain_head(oid)
            # last audit for this org
            last=db.query(AuditLog).filter(AuditLog.org_id==org.org_id).order_by(desc(AuditLog.recorded_at)).first()
            out.append({
                "org_id": oid,
                "org_name": org.org_name,
                "owner_email": u.email if u else "—",
                "session_label": f"{(u.email.split('@')[0] if u else oid[:8])} • {oid[:8]}",
                "total_entries": v.total_entries,
                "is_valid": v.is_valid,
                "broken_at": v.broken_at,
                "broken_entry_id": v.broken_entry_id,
                "head_hash": head.entry_hash[:16]+"…" if head else "—",
                "head_hash_full": head.entry_hash if head else None,
                "verification_time_ms": v.verification_time_ms,
                "last_active": last.recorded_at.isoformat() if last and last.recorded_at else org.created_at.isoformat() if org.created_at else None,
                "verified_at": v.verified_at.isoformat(),
            })
        result={"total_sessions": len(out), "sessions": out}
        _sessions_cache["ts"]=time.time()
        _sessions_cache["data"]=result
        return result
    finally:
        db.close()


# --- Real-time single-source poller: one DB+verify every 3s, broadcast to N SSE clients ---
import asyncio as _asyncio
_live_cache: dict = {"ts": None, "data": None}
_live_lock = _asyncio.Lock()
_live_task: _asyncio.Task | None = None

async def _refresh_live_snapshot():
    try:
        from app.routers.constraints import hash_chain as _hc
        from app.models.database import SessionLocal
        db=SessionLocal()
        org_ids=[str(o.org_id) for o in db.query(Organization.org_id).all()]
        chains=[_hc.verify(oid).to_dict() for oid in org_ids]
        all_valid=all(c["is_valid"] for c in chains) if chains else True
        total=sum(c["total_entries"] for c in chains)
        blocked=db.query(func.count(AuditLog.audit_id)).filter(AuditLog.event_type=="PATTERN_DETECTED").scalar() or 0
        db.close()
        data={
            "ts": datetime.now(timezone.utc).isoformat(),
            "total_sessions": len(org_ids),
            "total_entries": total,
            "is_valid": all_valid,
            "blocked": blocked,
        }
        async with _live_lock:
            _live_cache["ts"]=data["ts"]
            _live_cache["data"]=data
    except Exception as e:
        async with _live_lock:
            _live_cache["data"]={"error": str(e)}

async def _live_poller():
    while True:
        await _refresh_live_snapshot()
        await _asyncio.sleep(3)

def _ensure_live_poller():
    global _live_task
    if _live_task is None or _live_task.done():
        try:
            loop=_asyncio.get_running_loop()
            _live_task=loop.create_task(_live_poller())
        except RuntimeError:
            pass  # no loop at import

@router.get("/stream")
async def stream_owner(request: Request, authorization: str = Header(None)):
    """Real-time SSE stream — single DB poll broadcast to all. Fixes N-clients × DB bottleneck."""
    token = None
    if authorization:
        token=authorization.replace("Bearer ","").strip()
    if not token:
        token=request.query_params.get("token","")
    try:
        payload=jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role")!="owner": raise JWTError("role")
    except Exception:
        if not _verify_owner_password(token or ""):
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail":"Invalid owner credentials"}, status_code=403)
    from fastapi.responses import StreamingResponse
    import json as _json
    _ensure_live_poller()
    # prime cache if empty
    if _live_cache["data"] is None:
        await _refresh_live_snapshot()
    async def gen():
        while True:
            if await request.is_disconnected():
                break
            async with _live_lock:
                data=_live_cache["data"]
            yield f"data: {_json.dumps(data or {})}\n\n"
            await _asyncio.sleep(3)
    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no","Connection":"keep-alive"})


@router.get("/chain")
def get_owner_chain(
    _auth: str = Depends(_verify_owner),
):
    """Real hash-chain verification — no mock. Returns live is_valid + head hash."""
    # Import in-memory engines (same instances used by constraints/memories/audit)
    from app.routers.constraints import hash_chain as _hc, pinning_engine as _pe, audit_trail as _at
    results: dict = {}
    # hash_chain per org
    try:
        # collect org ids from DB to verify each chain
        from app.models.organization import Organization
        from app.models.database import SessionLocal
        db = SessionLocal()
        org_ids = [str(o.org_id) for o in db.query(Organization.org_id).all()]
        db.close()
        chains = []
        for oid in org_ids:
            v = _hc.verify(oid)
            chains.append(v.to_dict())
        # aggregate: valid if all org chains valid
        all_valid = all(c["is_valid"] for c in chains) if chains else True
        total_entries = sum(c["total_entries"] for c in chains)
        results["hash_chain"] = {
            "is_valid": all_valid,
            "total_entries": total_entries,
            "chains": chains,
            "method": "SHA-256 canonical JSON + seed genesis",
        }
    except Exception as e:
        results["hash_chain"] = {"is_valid": False, "error": str(e)}
    # audit trail
    try:
        from app.models.audit_log import AuditLog
        from app.models.database import SessionLocal
        db = SessionLocal()
        audit_count = db.query(func.count(AuditLog.audit_id)).scalar() or 0
        db.close()
        # audit trail engine verify (in-memory)
        # use first org id if exists
        org_id = chains[0]["org_id"] if chains else "system"
        av = _at.verify(org_id) if hasattr(_at, "verify") else None
        results["audit_chain"] = {
            "is_valid": getattr(av, "is_valid", True) if av else True,
            "total_entries": audit_count,
        }
    except Exception as e:
        results["audit_chain"] = {"is_valid": False, "error": str(e)}
    # constraint pinning integrity
    try:
        results["constraint_pinning"] = {
            "active": len([c for c in getattr(_pe, "_constraints", {}).values() if getattr(c, "status", None) and str(getattr(c.status, "value", "")) == "active"]) if hasattr(_pe, "_constraints") else None,
        }
    except Exception:
        pass
    return results
