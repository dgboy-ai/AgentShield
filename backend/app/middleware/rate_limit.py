"""Per-IP sliding-window rate limiter middleware with bounded memory and trusted proxy check."""

import os
import time
import collections
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Max tracked IPs to prevent memory leak (4.1)
MAX_TRACKED_IPS = int(os.getenv("RATE_LIMIT_MAX_IPS", "10000"))
# Trusted proxies that are allowed to set X-Forwarded-For (comma-separated IPs or "all")
TRUSTED_PROXIES = [p.strip() for p in os.getenv("TRUSTED_PROXIES", "").split(",") if p.strip()]


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, collections.deque] = {}
        self._last_cleanup = time.time()

    def _client_ip(self, request: Request) -> str:
        # Only trust X-Forwarded-For if request comes from trusted proxy (4.2)
        # If TRUSTED_PROXIES is empty, we don't trust the header at all (direct client IP)
        # If it contains "all", we trust it (for testing behind proxy)
        client_host = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded and TRUSTED_PROXIES:
            if "all" in TRUSTED_PROXIES or client_host in TRUSTED_PROXIES:
                return forwarded.split(",")[0].strip()
        # Otherwise, use direct client IP
        return client_host

    async def dispatch(self, request: Request, call_next):
        ip = self._client_ip(request)
        now = time.time()
        cutoff = now - self.window_seconds

        # Periodic cleanup of old IPs to prevent memory leak (4.1)
        # Every 60s, remove IPs with empty windows and enforce max size
        if now - self._last_cleanup > 60:
            self._last_cleanup = now
            # Remove expired entries and empty deques
            to_remove = []
            for k, dq in list(self._hits.items()):
                while dq and dq[0] < cutoff:
                    dq.popleft()
                if not dq:
                    to_remove.append(k)
            for k in to_remove:
                del self._hits[k]
            # Enforce max tracked IPs (LRU eviction: remove oldest if over limit)
            if len(self._hits) > MAX_TRACKED_IPS:
                # Remove oldest entries (first inserted)
                excess = len(self._hits) - MAX_TRACKED_IPS
                for k in list(self._hits.keys())[:excess]:
                    del self._hits[k]

        window = self._hits.setdefault(ip, collections.deque())
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= self.max_requests:
            retry_after = int(window[0] + self.window_seconds - now) + 1
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "retry_after": retry_after},
                headers={"Retry-After": str(retry_after)},
            )

        window.append(now)
        # Enforce max size immediately after append
        if len(self._hits) > MAX_TRACKED_IPS:
            # Remove oldest
            oldest = next(iter(self._hits))
            if oldest != ip:
                del self._hits[oldest]

        response = await call_next(request)
        remaining = self.max_requests - len(window)
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        return response
