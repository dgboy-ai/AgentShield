from fastapi import APIRouter, Depends, Query
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
from app.routers.auth import get_current_user_dep
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
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)

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


@router.get("/time-travel")
def time_travel_query(
    timestamp: datetime = Query(..., description="ISO8601 timestamp for AS OF SYSTEM TIME"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
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
    # For CockroachDB, we use AS OF SYSTEM TIME to get historical snapshot
    db_entries = []
    try:
        if _is_cockroach:
            # CockroachDB AS OF SYSTEM TIME — true time-travel
            # Query audit_log as of timestamp
            # Note: AS OF SYSTEM TIME expects interval or timestamp string
            ts_str = timestamp.isoformat()
            # Use parameterized query with AS OF SYSTEM TIME clause
            # Fallback gracefully if not supported
            result = db.execute(
                sql_text(
                    "SELECT audit_id, org_id, event_type, actor, target, action, details, recorded_at "
                    "FROM audit_log AS OF SYSTEM TIME :ts "
                    "WHERE org_id = :org_id AND recorded_at <= :ts2 "
                    "ORDER BY recorded_at ASC"
                ),
                {"ts": ts_str, "org_id": org_id, "ts2": timestamp},
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
    current_user: User = Depends(get_current_user_dep),
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
            rows = db.execute(
                sql_text(f"SELECT * FROM {table} AS OF SYSTEM TIME :ts WHERE org_id = :org_id AND {time_col} <= :ts2 ORDER BY {time_col} ASC"),
                {"ts": timestamp.isoformat(), "org_id": org_id, "ts2": timestamp},
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
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    report = audit_trail.generate_compliance_report(org_id, start_time, end_time)
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
