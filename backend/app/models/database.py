"""
Database configuration.

Supports SQLite (development) and PostgreSQL (production).
Connection pooling, health checks, and session lifecycle.
"""

import os
import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("agentshield.db")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agentshield.db")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
# Demo / WebMCP token — stable value for judges; injected into frontend at build time
DEMO_API_TOKEN = os.getenv("DEMO_API_TOKEN", "")

# For psycopg (v3), SQLAlchemy uses the "postgresql+psycopg" dialect
# For sqlalchemy-cockroachdb, use cockroachdb:// dialect (handles Cockroach version string)
if DATABASE_URL.startswith("postgresql://"):
    # If host is *.cockroachlabs.cloud, switch to cockroachdb dialect for proper version handling
    if "cockroachlabs.cloud" in DATABASE_URL or "cockroachdb" in DATABASE_URL.lower():
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "cockroachdb://", 1)
    else:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("cockroachdb://"):
    pass  # already correct

# Engine kwargs depend on the backend
is_sqlite = "sqlite" in DATABASE_URL
is_postgres = "postgresql" in DATABASE_URL or "cockroachdb" in DATABASE_URL
is_cockroach = "cockroachdb" in DATABASE_URL

engine_kwargs = {
    "pool_pre_ping": True,  # Verify connections before use
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # SQLite doesn't support pooling well in multi-threaded envs
    engine_kwargs["poolclass"] = NullPool
elif is_postgres:
    # Production PostgreSQL connection pool
    engine_kwargs.update({
        "pool_size": int(os.getenv("DB_POOL_SIZE", "20")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),  # Recycle every 30min
        "pool_pre_ping": True,
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)

# Log slow queries in development
if ENVIRONMENT == "development":
    @event.listens_for(engine, "before_cursor_execute")
    def _log_query(conn, cursor, statement, parameters, context, executemany):
        import time
        conn.info.setdefault("query_start_time", []).append(time.monotonic())

    @event.listens_for(engine, "after_cursor_execute")
    def _log_query_end(conn, cursor, statement, parameters, context, executemany):
        import time
        starts = conn.info.get("query_start_time", [])
        if starts:
            elapsed = time.monotonic() - starts.pop()
            if elapsed > 0.1:  # Log queries slower than 100ms
                logger.warning("Slow query (%.3fs): %s", elapsed, statement[:200])

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_db_health() -> dict:
    """Check database connectivity. Returns status dict."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        if "cockroachdb" in DATABASE_URL:
            eng = "cockroachdb"
        elif is_postgres:
            eng = "postgresql"
        else:
            eng = "sqlite"
        return {"status": "connected", "engine": eng}
    except Exception as e:
        logger.error("Database health check failed: %s", e)
        return {"status": "disconnected", "error": str(e)}


def init_db():
    """Create all tables (dev only — use Alembic in production)."""
    if ENVIRONMENT == "production":
        logger.warning("init_db() called in production — skipping. Use Alembic migrations.")
        return
    Base.metadata.create_all(bind=engine)
    if "cockroachdb" in DATABASE_URL:
        eng = "cockroachdb"
    elif is_postgres:
        eng = "postgresql"
    else:
        eng = "sqlite"
    logger.info("Database tables created (engine=%s)", eng)
