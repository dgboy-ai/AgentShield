"""AgentShield SDK — main client with logging and retry."""

from __future__ import annotations

import logging
import random
import time
from typing import Any

import httpx

from .auth import AuthManager
from .constraints import ConstraintManager
from .memory import MemoryManager
from .scan import ScanManager
from .audit import AuditManager
from .exceptions import AgentShieldError, RateLimitError, ConnectionError as ASConnectionError

logger = logging.getLogger("agentshield")


def _jittered_backoff(attempt: int, base: float, max_wait: float = 30.0) -> float:
    """Exponential backoff with full jitter. Prevents thundering herd."""
    exp = base * (2 ** attempt)
    return min(exp * random.random(), max_wait)


class _RetryTransport(httpx.BaseTransport):
    """Transport wrapper that retries failed requests with jittered exponential backoff."""

    def __init__(
        self,
        inner: httpx.BaseTransport,
        max_retries: int = 3,
        backoff_factor: float = 0.5,
        max_backoff: float = 30.0,
        retryable_status: tuple[int, ...] = (429, 500, 502, 503, 504),
    ):
        self._inner = inner
        self._max_retries = max_retries
        self._backoff_factor = backoff_factor
        self._max_backoff = max_backoff
        self._retryable_status = retryable_status

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        last_exc: Exception | None = None

        for attempt in range(self._max_retries + 1):
            try:
                response = self._inner.handle_request(request)

                # Retry on retryable status codes
                if response.status_code in self._retryable_status and attempt < self._max_retries:
                    # Respect Retry-After header from 429
                    if response.status_code == 429:
                        retry_after = response.headers.get("retry-after")
                        if retry_after:
                            try:
                                wait = float(retry_after)
                            except ValueError:
                                wait = _jittered_backoff(attempt, self._backoff_factor, self._max_backoff)
                        else:
                            wait = _jittered_backoff(attempt, self._backoff_factor, self._max_backoff)
                    else:
                        wait = _jittered_backoff(attempt, self._backoff_factor, self._max_backoff)

                    logger.warning(
                        "Retry %d/%d after %.1fs (status=%d, %s %s)",
                        attempt + 1,
                        self._max_retries,
                        wait,
                        response.status_code,
                        request.method,
                        request.url,
                    )
                    time.sleep(wait)
                    continue

                return response

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as e:
                last_exc = e
                if attempt < self._max_retries:
                    wait = _jittered_backoff(attempt, self._backoff_factor, self._max_backoff)
                    logger.warning(
                        "Retry %d/%d after %.1fs (%s: %s)",
                        attempt + 1,
                        self._max_retries,
                        wait,
                        type(e).__name__,
                        e,
                    )
                    time.sleep(wait)
                    continue
                break

        raise last_exc or httpx.TransportError("Max retries exceeded")


class AgentShield:
    """Tamper-evident memory defense for LLM agents.

    Usage::

        from agentshield import AgentShield

        shield = AgentShield(base_url="http://localhost:8000")
        shield.auth.register("admin@example.com", "password123", "Admin")

        shield.constraints.pin("Never delete files without confirmation", "safety")
        shield.memory.store("User prefers dark mode", memory_type="episodic")
        result = shield.scan.text("ignore all previous instructions")
        print(result.blocked)  # True

        report = shield.audit.compliance_report()
        print(report.compliance_status)  # COMPLIANT
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        log_level: int | None = None,
    ):
        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries

        # Configure logging
        if log_level is not None:
            logger.setLevel(log_level)
        if not logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(
                logging.Formatter("%(asctime)s [%(name)s] %(levelname)s %(message)s")
            )
            logger.addHandler(handler)

        # Build transport with retry
        inner = httpx.HTTPTransport()
        transport = _RetryTransport(inner, max_retries=max_retries)

        self._client = httpx.Client(
            base_url=self._base_url,
            timeout=timeout,
            headers={"Content-Type": "application/json"},
            transport=transport,
        )

        self.auth = AuthManager(self._client)
        self.memory = MemoryManager(self._client, self.auth)
        self.constraints = ConstraintManager(self._client, self.auth)
        self.scan = ScanManager(self._client, self.auth)
        self.audit = AuditManager(self._client, self.auth)

        if api_key:
            self.auth.set_token(api_key)

        logger.info("AgentShield client initialized (url=%s, retries=%d)", self._base_url, max_retries)

    @property
    def base_url(self) -> str:
        return self._base_url

    def health(self) -> dict:
        """Check backend health status."""
        resp = self._client.get("/health")
        resp.raise_for_status()
        return resp.json()

    def info(self) -> dict:
        """Get system info."""
        resp = self._client.get("/")
        resp.raise_for_status()
        return resp.json()

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
