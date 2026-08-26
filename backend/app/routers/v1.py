"""
API versioning.

All existing routes are available at both /api/* (unversioned) and /v1/api/*.
The versioned routes are identical — same handlers, same logic.
This lets us deprecate unversioned routes later without breaking clients.
"""

from fastapi import APIRouter
from app.routers import (
    auth_router,
    constraints_router,
    memories_router,
    audit_router,
    scan_router,
)

v1_router = APIRouter(prefix="/v1")

# Mount all existing routers under /v1
v1_router.include_router(auth_router)
v1_router.include_router(constraints_router)
v1_router.include_router(memories_router)
v1_router.include_router(audit_router)
v1_router.include_router(scan_router)
