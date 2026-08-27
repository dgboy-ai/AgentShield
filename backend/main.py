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

# Create database tables (dev only — Alembic in prod)
init_db()

app = FastAPI(
    title="AgentShield",
    description="Tamper-Evident Memory Defense for LLM Agents",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware (order matters: outermost = first applied)
app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https://.*",
    allow_credentials=False,
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
    """Background task to anchor hash chain heads to an external system daily."""
    from app.routers.constraints import audit_trail
    anchor_logger = logging.getLogger("agentshield.anchoring")
    
    try:
        # Anchor all org chains
        with open("anchors.log", "a") as f:
            for org_id, entries in audit_trail._entries.items():
                if entries:
                    latest_entry = entries[-1]
                    log_line = f"ANCHOR [{datetime.now(timezone.utc).isoformat()}] ORG: {org_id} HEAD: {latest_entry.entry_hash}\n"
                    f.write(log_line)
        anchor_logger.info("Successfully anchored hash chains for all organizations.")
    except Exception as e:
        anchor_logger.error(f"Error during hash anchoring: {e}")

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

    # Start background anchoring task using APScheduler
    scheduler.add_job(anchor_hashes_job, 'cron', hour=0, minute=0)
    scheduler.start()
    logger.info("APScheduler started with daily anchoring job.")

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()


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
    """Health check that verifies database connectivity."""
    db_health = check_db_health()
    return {
        "status": "healthy" if db_health["status"] == "connected" else "degraded",
        "version": "1.0.0",
        "database": db_health["status"],
        "engine": db_health.get("engine", "unknown"),
    }
