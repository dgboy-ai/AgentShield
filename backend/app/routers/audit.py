from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse, Response
from typing import Optional
from datetime import datetime, timezone
import os

from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text

from app.models.database import get_db, DATABASE_URL
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.memory import Memory as MemoryDB
from app.models.constraint import Constraint as ConstraintDB
from app.routers.auth import get_current_user_dep, require_role
from app.routers.constraints import audit_trail, pinning_engine, hash_chain
from app.core.audit_trail import AuditQuery, EventType

router = APIRouter(prefix="/api/audit", tags=["audit"])

_is_postgres = "postgresql" in DATABASE_URL or "cockroach" in DATABASE_URL.lower()
_is_cockroach = "cockroach" in DATABASE_URL.lower() or "cockroachlabs" in DATABASE_URL.lower()


@router.get("")
def list_audit_entries(
    event_type: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)

    # For large logs, use DB pagination (O(1) via index) not in-memory O(N) slice.
    # Try DB first (durable), fallback to in-memory for small/legacy.
    try:
        q = db.query(AuditLog).filter(AuditLog.org_id == org_id)
        if event_type:
            q = q.filter(AuditLog.event_type == event_type)
        if actor:
            q = q.filter(AuditLog.actor == actor)
        if start_time:
            q = q.filter(AuditLog.recorded_at >= start_time)
        if end_time:
            q = q.filter(AuditLog.recorded_at <= end_time)
        total = q.count()
        rows = q.order_by(AuditLog.recorded_at.desc()).offset(offset).limit(limit).all()
        # If DB has data, return DB rows (more durable than in-memory)
        if total > 0 or rows:
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
                        "previous_hash": r.previous_hash,
                        "entry_hash": r.entry_hash,
                        "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
                        "source": "db",
                    }
                    for r in rows
                ],
                "total": total,
                "offset": offset,
                "limit": limit,
                "source": "db",
            }
    except Exception:
        pass

    # Fallback to in-memory (for tests with in-memory SQLite or before DB commit)
    event_filter = EventType(event_type) if event_type else None
    query = AuditQuery(
        org_id=org_id,
        event_type=event_filter,
        actor=actor,
        start_time=start_time,
        end_time=end_time,
        offset=offset,
        limit=limit,
    )
    entries = audit_trail.query(query)
    total = audit_trail.query_count(query)
    return {
        "entries": [e.to_dict() for e in entries],
        "total": total,
        "offset": offset,
        "limit": limit,
        "source": "in_memory",
    }


@router.get("/timeline")
def get_audit_timeline(
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    entries = audit_trail.get_entries(org_id, limit=500)
    counts = audit_trail.get_event_counts(org_id)
    chain_length = audit_trail.get_chain_length(org_id)

    return {
        "entries": [e.to_dict() for e in entries[-100:]],  # Last 100
        "total_events": chain_length,
        "events_by_type": counts,
    }


@router.get("/verify")
def verify_audit_chain(
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    return audit_trail.verify_chain(org_id)


@router.get("/anchors")
def list_anchors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """List durable chain anchors (DB + external) for this org - proves external anchoring."""
    from app.models.chain_anchor import ChainAnchor

    org_id = str(current_user.org_id)
    try:
        rows = (
            db.query(ChainAnchor)
            .filter(ChainAnchor.org_id == org_id)
            .order_by(ChainAnchor.created_at.desc())
            .limit(100)
            .all()
        )
        return {
            "org_id": org_id,
            "total": len(rows),
            "anchors": [
                {
                    "anchor_id": str(r.anchor_id),
                    "chain_type": r.chain_type,
                    "chain_head_hash": r.chain_head_hash,
                    "chain_length": r.chain_length,
                    "anchor_target": r.anchor_target,
                    "external_ref": r.external_ref,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
        }
    except Exception as e:
        # Table may not exist if migration not yet applied (dev with old DB)
        return {"org_id": org_id, "total": 0, "anchors": [], "note": f"anchors table not yet migrated: {e}"}


@router.post("/anchors/trigger")
def trigger_anchor(
    current_user: User = Depends(get_current_user_dep),
):
    """Manually trigger anchoring for this org (for demo/testing)."""
    from app.main import anchor_hashes_job

    anchor_hashes_job()
    return {"status": "anchored", "org_id": str(current_user.org_id)}


@router.get("/time-travel")
def time_travel_query(
    timestamp: datetime = Query(..., description="ISO8601 timestamp for AS OF SYSTEM TIME"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Time-travel query with honest backend selection:

    - CockroachDB / Postgres (Cockroach): uses `AS OF SYSTEM TIME` for true
      MVCC time-travel without affecting live traffic (honest claim).
    - SQLite / dev: filters in-memory engine + DB by recorded_at <= timestamp.
      The synopsis claim "CockroachDB AS OF SYSTEM TIME" is only true when
      DATABASE_URL points at CockroachDB; otherwise this fallback is used.

    Returns the union of in-memory + DB entries up to timestamp.
    """
    org_id = str(current_user.org_id)

    # 1. In-memory trail (fast, always works)
    mem_entries = audit_trail.time_travel(org_id, timestamp)
    mem_ids = {e.entry_id for e in mem_entries}

    # 2. DB-backed query for persistence across restarts
    # For CockroachDB, we use AS OF SYSTEM TIME to get historical snapshot (true MVCC, no lock)
    db_entries = []
    try:
        if _is_cockroach:
            # CockroachDB AS OF SYSTEM TIME requires timestamp literal, not bound parameter for AS OF clause
            # Use string interpolation for AS OF, parameterized for WHERE (safe, org_id is UUID)
            ts_literal = timestamp.astimezone(timezone.utc).isoformat().replace("'", "''")
            # Use literal for AS OF, keep WHERE parameterized
            result = db.execute(
                sql_text(
                    f"SELECT audit_id, org_id, event_type, actor, target, action, details, recorded_at "
                    f"FROM audit_log AS OF SYSTEM TIME '{ts_literal}' "
                    f"WHERE org_id = :org_id AND recorded_at <= :ts2 "
                    f"ORDER BY recorded_at ASC"
                ),
                {"org_id": org_id, "ts2": timestamp},
            ).fetchall()
            db_entries = [
                {
                    "entry_id": str(r[0]),
                    "org_id": str(r[1]),
                    "event_type": r[2],
                    "actor": r[3],
                    "target": r[4],
                    "action": r[5],
                    "details": r[6],
                    "recorded_at": r[7].isoformat() if r[7] else None,
                    "source": "cockroachdb_as_of_system_time",
                }
                for r in result
                if str(r[0]) not in mem_ids
            ]
        elif _is_postgres:
            # Standard Postgres — no AS OF SYSTEM TIME, filter by recorded_at
            rows = (
                db.query(AuditLog)
                .filter(AuditLog.org_id == org_id, AuditLog.recorded_at <= timestamp)
                .order_by(AuditLog.recorded_at.asc())
                .all()
            )
            db_entries = [
                {
                    "entry_id": str(r.audit_id),
                    "org_id": str(r.org_id),
                    "event_type": r.event_type,
                    "actor": r.actor,
                    "target": r.target,
                    "action": r.action,
                    "details": r.details,
                    "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
                    "entry_hash": r.entry_hash,
                    "source": "postgres_filtered",
                }
                for r in rows
                if str(r.audit_id) not in mem_ids
            ]
        else:
            # SQLite dev — filter by recorded_at
            rows = (
                db.query(AuditLog)
                .filter(AuditLog.org_id == org_id, AuditLog.recorded_at <= timestamp)
                .order_by(AuditLog.recorded_at.asc())
                .all()
            )
            db_entries = [
                {
                    "entry_id": str(r.audit_id),
                    "org_id": str(r.org_id),
                    "event_type": r.event_type,
                    "actor": r.actor,
                    "target": r.target,
                    "action": r.action,
                    "details": r.details,
                    "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
                    "entry_hash": r.entry_hash,
                    "source": "sqlite_filtered",
                }
                for r in rows
                if str(r.audit_id) not in mem_ids
            ]
    except Exception as e:
        # Fallback: just return in-memory if DB query fails
        db_entries = []

    mem_dicts = [e.to_dict() for e in mem_entries]
    # Mark source for transparency
    for d in mem_dicts:
        d["source"] = "in_memory_chain"

    all_entries = mem_dicts + db_entries
    # Sort by recorded_at
    all_entries.sort(key=lambda x: x.get("recorded_at") or "")

    backend_used = "cockroachdb_as_of_system_time" if _is_cockroach else ("postgres_filtered" if _is_postgres else "sqlite_filtered_in_memory")

    return {
        "timestamp": timestamp.isoformat(),
        "entries": all_entries,
        "total": len(all_entries),
        "backend": backend_used,
        "note": "On CockroachDB uses AS OF SYSTEM TIME; on SQLite/Postgres filters by recorded_at. "
                "Set DATABASE_URL to CockroachDB for true MVCC time-travel.",
    }


@router.get("/db-time-travel")
def db_time_travel_query(
    timestamp: datetime = Query(...),
    table: str = Query("audit_log", description="Table to query: audit_log, memories, constraints"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Raw DB time-travel for any table — demonstrates CockroachDB capability.
    On CockroachDB: SELECT ... AS OF SYSTEM TIME '<timestamp>'
    On SQLite: SELECT ... WHERE created_at/recorded_at <= timestamp
    """
    org_id = str(current_user.org_id)
    allowed = {"audit_log", "memories", "constraints"}
    if table not in allowed:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"table must be one of {allowed}")

    time_col = "recorded_at" if table == "audit_log" else "created_at"

    try:
        if _is_cockroach:
            ts_literal = timestamp.astimezone(timezone.utc).isoformat().replace("'", "''")
            rows = db.execute(
                sql_text(f"SELECT * FROM {table} AS OF SYSTEM TIME '{ts_literal}' WHERE org_id = :org_id AND {time_col} <= :ts2 ORDER BY {time_col} ASC"),
                {"org_id": org_id, "ts2": timestamp},
            ).fetchall()
            # Return raw count for demo
            return {
                "table": table,
                "timestamp": timestamp.isoformat(),
                "backend": "cockroachdb_as_of_system_time",
                "rows": len(rows),
                "sample": [dict(r._mapping) if hasattr(r, "_mapping") else str(r) for r in rows[:5]],
            }
        else:
            model = {"audit_log": AuditLog, "memories": MemoryDB, "constraints": ConstraintDB}[table]
            col = getattr(model, time_col)
            rows = db.query(model).filter(model.org_id == org_id, col <= timestamp).order_by(col.asc()).all()
            backend = "postgres_filtered" if _is_postgres else "sqlite_filtered"
            return {
                "table": table,
                "timestamp": timestamp.isoformat(),
                "backend": backend,
                "rows": len(rows),
                "sample": [r.__dict__ for r in rows[:5]],
            }
    except Exception as e:
        return {
            "table": table,
            "timestamp": timestamp.isoformat(),
            "backend": "fallback",
            "error": str(e),
            "rows": 0,
        }


@router.get("/compliance/report")
def generate_compliance_report(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    current_user: User = Depends(require_role("admin")),
):
    org_id = str(current_user.org_id)
    report = audit_trail.generate_compliance_report(org_id, start_time, end_time)
    # Log admin access
    import logging
    logging.getLogger("agentshield.audit").info(f"Compliance report generated by admin {current_user.user_id} org {org_id}")
    return report.to_dict()


@router.get("/export/jsonl")
def export_jsonl(
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    jsonl = audit_trail.export_jsonl(org_id)
    return PlainTextResponse(content=jsonl, media_type="application/jsonl")


@router.get("/export/csv")
def export_csv(
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    csv_data = audit_trail.export_csv(org_id)
    return PlainTextResponse(content=csv_data, media_type="text/csv")


# 2.1 Real-time SSE for dashboard (fixes polling)
import asyncio as _asyncio

_audit_stream_cache: dict = {"ts": None, "data": None}
_audit_stream_lock = _asyncio.Lock()

async def _refresh_audit_snapshot(org_id: str):
    try:
        from app.routers.constraints import audit_trail as _at, hash_chain as _hc
        # Get latest audit and hash chain status
        entries = _at.get_entries(org_id, limit=100)
        counts = _at.get_event_counts(org_id)
        chain = _at.verify_chain(org_id)
        hc = _hc.verify(org_id)
        data = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "total_events": len(entries),
            "events_by_type": counts,
            "audit_valid": chain.get("valid", True),
            "hash_valid": hc.is_valid,
            "entries": [e.to_dict() for e in entries[-5:]],
        }
        async with _audit_stream_lock:
            _audit_stream_cache[org_id] = data
        return data
    except Exception as e:
        return {"error": str(e)}


@router.get("/stream")
async def stream_audit(
    request: Request,
    current_user: User = Depends(get_current_user_dep),
):
    """SSE stream for real-time audit updates - pushes every 3s, single DB poll per org."""
    from fastapi.responses import StreamingResponse
    import json as _json
    org_id = str(current_user.org_id)

    async def gen():
        while True:
            if await request.is_disconnected():
                break
            data = await _refresh_audit_snapshot(org_id)
            yield f"data: {_json.dumps(data)}\n\n"
            await _asyncio.sleep(3)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
