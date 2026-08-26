from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import init_db, check_db_health, SessionLocal
from app.routers import auth_router, constraints_router, memories_router, audit_router, scan_router, public_router
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
# Public/demo first — no auth, wildcard CORS, for ChatGPT WebMCP + judges
app.include_router(public_router)
app.include_router(auth_router)
app.include_router(constraints_router)
app.include_router(memories_router)
app.include_router(audit_router)
app.include_router(scan_router)

# Versioned routes (same handlers, /v1 prefix)
app.include_router(v1_router)


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
