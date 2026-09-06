"""Body size limit middleware to prevent OOM via large payloads (1.2 gap)."""
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("agentshield.body_limit")

# Default max: 1MB for JSON, but memories are 50k + overhead. Keep 256KB for most, 1MB hard.
MAX_BODY_BYTES = 1 * 1024 * 1024  # 1MB
MAX_MEMORY_CONTENT_BYTES = 55_000  # 50k + 5k overhead

class BodyLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Check Content-Length header early
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                length = int(cl)
                if length > MAX_BODY_BYTES:
                    return JSONResponse(status_code=413, content={"detail": f"Payload too large: {length} > {MAX_BODY_BYTES} bytes"})
                # For memories, stricter check if path is /api/memories
                if request.url.path.startswith("/api/memories") and length > MAX_MEMORY_CONTENT_BYTES + 2048:
                    # Allow some JSON overhead, but warn
                    logger.warning(f"Large memory payload: {length} bytes from {request.client.host if request.client else 'unknown'}")
            except ValueError:
                pass
        return await call_next(request)
