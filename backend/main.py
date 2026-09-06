from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging
from datetime import datetime, timezone

logger = logging.getLogger("agentshield.main")
scheduler = AsyncIOScheduler()

from app.models.database import init_db, check_db_health, SessionLocal
from app.routers import auth_router, constraints_router, memories_router, audit_router, scan_router, public_router, owner_router
from app.routers.v1 import v1_router
from app.middleware import RateLimitMiddleware, RequestIDMiddleware
from app.middleware.body_limit import BodyLimitMiddleware
import os
# Structured logging: JSON formatter if python-json-logger available, else standard
try:
    from pythonjsonlogger import jsonlogger  # type: ignore
    _has_json_logger = True
except ImportError:
    _has_json_logger = False

# Prometheus metrics (simple in-memory counters)
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST  # type: ignore
    _has_prom = True
    REQUEST_COUNT = Counter("agentshield_requests_total", "Total requests", ["method", "endpoint", "status"])
    REQUEST_LATENCY = Histogram("agentshield_request_duration_seconds", "Request latency")
except ImportError:
    _has_prom = False
    REQUEST_COUNT = None
    REQUEST_LATENCY = None

# Create database tables (dev only — Alembic in prod)
init_db()

app = FastAPI(
    title="AgentShield",
    description="Tamper-Evident Memory Defense for LLM Agents",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Structured logging setup
if _has_json_logger:
    _handler = logging.StreamHandler()
    _formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    _handler.setFormatter(_formatter)
    logging.getLogger("agentshield").addHandler(_handler)
    logging.getLogger("agentshield").setLevel(logging.INFO)

# Middleware (order matters: outermost = first applied)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)
app.add_middleware(RequestIDMiddleware)
# CORS: allow credentials for httpOnly cookies (refresh flow) while keeping WebMCP wildcard for public routes
# For credentialed requests, browser requires explicit origin, not "*". We allow localhost and vercel + regex for https.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers (unversioned for backward compatibility)
# Public/demo first - no auth, wildcard CORS, for ChatGPT WebMCP + judges
app.include_router(public_router)
app.include_router(auth_router)
app.include_router(constraints_router)
app.include_router(memories_router)
app.include_router(audit_router)
app.include_router(scan_router)
app.include_router(owner_router)

# Versioned routes (same handlers, /v1 prefix)
app.include_router(v1_router)

def anchor_hashes_job():
    """Background task to anchor hash chain heads daily — durable DB + file + optional external.

    Fix for 1.4: previously only ephemeral anchors.log. Now:
    - 1) Durable DB table chain_anchors (survives restarts, multi-worker, Cockroach external)
    - 2) Audit trail CHAIN_ANCHORED event (existing)
    - 3) File anchor to ANCHOR_FILE (default data/anchors.log, persistent volume if mounted)
    - 4) Optional external: S3 (ANCHOR_S3_BUCKET) and webhook (ANCHOR_WEBHOOK_URL)
    """
    from app.routers.constraints import audit_trail, hash_chain
    import os
    anchor_logger = logging.getLogger("agentshield.anchoring")
    try:
        now = datetime.now(timezone.utc)
        # Collect orgs from both engines + DB to avoid missing orgs after cold start
        org_ids = set(list(audit_trail._entries.keys()) + list(hash_chain._chains.keys()))
        # Also include orgs from DB if engines empty (cold start before any in-memory entry)
        try:
            from app.models.database import SessionLocal as _SL2
            from app.models.organization import Organization as _Org
            _db = _SL2()
            try:
                for (oid,) in _db.query(_Org.org_id).all():
                    org_ids.add(str(oid))
            finally:
                _db.close()
        except Exception:
            pass

        # 1. Durable DB anchor table chain_anchors
        try:
            from app.models.database import SessionLocal as _SL
            from app.models.chain_anchor import ChainAnchor as _CA
            from app.core.audit_trail import EventType as _ET
            db2 = _SL()
            try:
                for org_id in org_ids:
                    # audit chain
                    audit_entries = audit_trail._entries.get(org_id, [])
                    if audit_entries:
                        head = audit_entries[-1]
                        db2.add(_CA(org_id=org_id, chain_type="audit", chain_head_hash=head.entry_hash, chain_length=len(audit_entries), anchor_target="db", external_ref=None, created_at=now))
                        # also record in audit trail for compliance timeline
                        try:
                            audit_trail.record(org_id=org_id, event_type=_ET.CHAIN_ANCHORED, actor="system", target=head.entry_hash, action="anchor", details={"head": head.entry_hash, "len": len(audit_entries), "target": "db"})
                        except Exception:
                            pass
                    # hash_chain
                    h_head = hash_chain.get_chain_head(org_id)
                    if h_head:
                        db2.add(_CA(org_id=org_id, chain_type="hash_chain", chain_head_hash=h_head.entry_hash, chain_length=hash_chain.get_chain_length(org_id), anchor_target="db", external_ref=None, created_at=now))
                db2.commit()
            except Exception as be:
                db2.rollback()
                anchor_logger.warning(f"DB chain_anchors commit failed: {be}")
            finally:
                db2.close()
        except Exception as be:
            anchor_logger.warning(f"DB anchor fallback skip: {be}")

        # 2. File anchor (configurable, durable if ANCHOR_FILE points to persistent volume)
        try:
            anchor_file = os.getenv("ANCHOR_FILE", "data/anchors.log")
            # also keep legacy anchors.log for backward compat
            files_to_write = [anchor_file, "anchors.log"] if anchor_file != "anchors.log" else [anchor_file]
            for fpath in files_to_write:
                try:
                    parent = os.path.dirname(fpath)
                    if parent:
                        os.makedirs(parent, exist_ok=True)
                    with open(fpath, "a") as f:
                        for org_id in org_ids:
                            ae = audit_trail._entries.get(org_id, [])
                            if ae:
                                f.write(f"ANCHOR [{now.isoformat()}] ORG: {org_id} HEAD: {ae[-1].entry_hash} LEN: {len(ae)} TARGET: db\n")
                            h = hash_chain.get_chain_head(org_id)
                            if h:
                                f.write(f"ANCHOR-HASH [{now.isoformat()}] ORG: {org_id} HEAD: {h.entry_hash} LEN: {hash_chain.get_chain_length(org_id)} TARGET: db\n")
                except Exception as fe:
                    if fpath == anchor_file:
                        anchor_logger.debug(f"File anchor skip {fpath}: {fe}")
        except Exception as fe:
            anchor_logger.debug(f"File anchor outer skip: {fe}")

        # 3. Optional external: S3
        s3_bucket = os.getenv("ANCHOR_S3_BUCKET", "").strip()
        if s3_bucket:
            try:
                import boto3  # type: ignore
                s3 = boto3.client("s3")
                for org_id in org_ids:
                    ae = audit_trail._entries.get(org_id, [])
                    if ae:
                        key = f"agentshield/anchors/{org_id}/{now.strftime('%Y/%m/%d')}/audit-{ae[-1].entry_hash[:16]}.json"
                        body = f'{{"org_id":"{org_id}","head":"{ae[-1].entry_hash}","len":{len(ae)},"at":"{now.isoformat()}"}}'
                        s3.put_object(Bucket=s3_bucket, Key=key, Body=body.encode(), ContentType="application/json")
                        # also update chain_anchors with external_ref
                        try:
                            from app.models.database import SessionLocal as _SL3
                            from app.models.chain_anchor import ChainAnchor as _CA3
                            db3 = _SL3()
                            try:
                                db3.add(_CA3(org_id=org_id, chain_type="audit", chain_head_hash=ae[-1].entry_hash, chain_length=len(ae), anchor_target="s3", external_ref=f"s3://{s3_bucket}/{key}", created_at=now))
                                db3.commit()
                            finally:
                                db3.close()
                        except Exception:
                            pass
            except Exception as se:
                anchor_logger.warning(f"S3 anchor failed: {se}")

        # 4. Optional external: webhook
        webhook = os.getenv("ANCHOR_WEBHOOK_URL", "").strip()
        if webhook:
            try:
                import httpx
                for org_id in org_ids:
                    ae = audit_trail._entries.get(org_id, [])
                    if ae:
                        try:
                            httpx.post(webhook, json={"org_id": org_id, "head": ae[-1].entry_hash, "len": len(ae), "at": now.isoformat()}, timeout=5.0)
                            from app.models.database import SessionLocal as _SL4
                            from app.models.chain_anchor import ChainAnchor as _CA4
                            db4 = _SL4()
                            try:
                                db4.add(_CA4(org_id=org_id, chain_type="audit", chain_head_hash=ae[-1].entry_hash, chain_length=len(ae), anchor_target="webhook", external_ref=webhook, created_at=now))
                                db4.commit()
                            finally:
                                db4.close()
                        except Exception:
                            pass
            except Exception as we:
                anchor_logger.warning(f"Webhook anchor failed: {we}")

        anchor_logger.info(f"Successfully anchored hash chains for {len(org_ids)} org(s) to DB + file + external (if configured).")
    except Exception as e:
        anchor_logger.error(f"Error during hash anchoring: {e}", exc_info=True)

@app.on_event("startup")
def _load_engines_from_db():
    """Populate in-memory engines from DB so state survives restarts."""
    from app.startup import load_all_engines
    from app.routers.constraints import pinning_engine, hash_chain, audit_trail

    db = SessionLocal()
    try:
        load_all_engines(pinning_engine, hash_chain, audit_trail, db)
    finally:
        db.close()

    # Start background anchoring task using APScheduler - single instance, no double-run on multi-worker
    import os

    if os.getenv("ENABLE_SCHEDULER", "true").lower() == "true":
        if not scheduler.running:
            scheduler.add_job(
                anchor_hashes_job,
                'cron',
                hour=0,
                minute=0,
                id="daily_anchor",
                max_instances=1,
                coalesce=True,
                replace_existing=True,
                misfire_grace_time=3600,  # 1h grace for missed runs (e.g. deploy downtime)
                jitter=300,  # spread load 5m
            )
            scheduler.start()
            logger.info("APScheduler started with daily anchoring job (single-instance, misfire 1h).")
        else:
            logger.info("APScheduler already running - skipping duplicate start (multi-worker safe).")
    else:
        logger.info("APScheduler disabled via ENABLE_SCHEDULER=false")

@app.on_event("shutdown")
def shutdown_scheduler():
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception:
        pass


@app.get("/")
def root():
    return {
        "name": "AgentShield",
        "version": "1.0.0",
        "description": "Tamper-Evident Memory Defense for LLM Agents",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    """Health check that verifies database connectivity and signing backend."""
    db_health = check_db_health()
    try:
        from app.routers.constraints import signing_engine
        sig_stats = signing_engine.get_stats()
    except Exception:
        sig_stats = {"backend": "unknown"}
    return {
        "status": "healthy" if db_health["status"] == "connected" else "degraded",
        "version": "1.0.0",
        "database": db_health["status"],
        "engine": db_health.get("engine", "unknown"),
        "signing": sig_stats,
    }


@app.get("/metrics")
def metrics():
    """Prometheus metrics endpoint (if prometheus_client installed) or JSON fallback."""
    if _has_prom:
        from fastapi.responses import Response
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
    # Fallback: simple JSON counters
    return {
        "backend": "metrics",
        "note": "Install prometheus_client for Prometheus format; using JSON fallback",
        "requests_total": "N/A (install prometheus_client)",
    }


@app.middleware("http")
async def metrics_middleware(request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    if _has_prom and REQUEST_COUNT is not None:
        try:
            REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, status=response.status_code).inc()
            if REQUEST_LATENCY is not None:
                REQUEST_LATENCY.observe(time.time() - start)
        except Exception:
            pass
    return response
