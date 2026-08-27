"""AgentShield SDK - main client with auto-connect, retry, and config cascade."""

from __future__ import annotations

import json
import logging
import os
import random
import re
import time
from pathlib import Path
from typing import Any

import httpx

from .auth import AuthManager
from .constraints import ConstraintManager
from .memory import MemoryManager
from .scan import ScanManager
from .audit import AuditManager
from .exceptions import (
    AgentShieldError,
    AuthenticationError,
    AuthorizationError,
    BlockedContentError,
    ConnectionError as ASConnectionError,
    IntegrityError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)

logger = logging.getLogger("agentshield")

# Hosted default - zero-config for users who don't self-host
_HOSTED_DEFAULT = "https://agentshield.onrender.com"

# Config file locations (checked in order)
_CONFIG_DIRS = [
    Path.home() / ".config" / "agentshield",
    Path.home() / ".agentshield",
]

_CONFIG_FILENAMES = ["config.json", "config.jsonc"]


def _load_config_file() -> dict | None:
    """Load config from ~/.config/agentshield/config.json or ~/.agentshield/config.json."""
    for config_dir in _CONFIG_DIRS:
        for name in _CONFIG_FILENAMES:
            config_path = config_dir / name
            if config_path.is_file():
                try:
                    with open(config_path) as f:
                        data = json.load(f)
                    if isinstance(data, dict):
                        return data
                except (json.JSONDecodeError, OSError) as e:
                    logger.warning("Malformed config file %s: %s", config_path, e)
                    continue
    return None


def _env_substitute(value: str) -> str:
    """Replace {env:VAR_NAME} with environment variable values."""
    if not isinstance(value, str) or "{env:" not in value:
        return value
    def _replace(m):
        var_name = m.group(1)
        return os.environ.get(var_name, m.group(0))
    return re.sub(r"\{env:([^}]+)\}", _replace, value)


def _validate_url(url: str) -> str:
    """Validate and normalize a URL. Raises AgentShieldError on invalid."""
    url = url.strip()
    if not url:
        raise AgentShieldError("URL cannot be empty")
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise AgentShieldError(
            f"Invalid URL scheme: {url!r}. Must start with http:// or https://"
        )
    return url


def _probe_server(url: str, timeout: float = 2.0) -> bool:
    """Quick health probe to check if a server is reachable."""
    try:
        resp = httpx.get(f"{url.rstrip('/')}/health", timeout=timeout)
        return resp.status_code == 200
    except Exception:
        return False


def _resolve_base_url(explicit: str | None = None) -> str:
    """Resolve the backend URL via the config cascade:

    1. Explicit argument (highest priority)
    2. AGENTSHIELD_URL or AGENTSHIELD_BASE_URL env var
    3. Config file (~/.config/agentshield/config.json)
    4. Local server probe (localhost:8000)
    5. Hosted default (agentshield.onrender.com)
    """
    if explicit:
        return _validate_url(_env_substitute(explicit))

    # Env var
    for var in ("AGENTSHIELD_URL", "AGENTSHIELD_BASE_URL"):
        val = os.environ.get(var)
        if val:
            return _validate_url(_env_substitute(val))

    # Config file
    config = _load_config_file()
    if config and "base_url" in config and isinstance(config["base_url"], str) and config["base_url"].strip():
        return _validate_url(_env_substitute(config["base_url"]))

    # Probe local server (fast - 2s timeout)
    local_url = os.environ.get("AGENTSHIELD_LOCAL_URL", "http://localhost:8000")
    if _probe_server(local_url, timeout=2.0):
        return local_url

    # Hosted fallback
    return _HOSTED_DEFAULT


def _resolve_api_key(explicit: str | None = None) -> str | None:
    """Resolve API key via cascade: explicit -> env -> config file."""
    if explicit:
        return explicit

    for var in ("AGENTSHIELD_API_KEY", "AGENTSHIELD_TOKEN"):
        val = os.environ.get(var)
        if val:
            return val

    config = _load_config_file()
    if config and "api_key" in config and isinstance(config["api_key"], str):
        return config["api_key"]

    return None


def _jittered_backoff(attempt: int, base: float, max_wait: float = 30.0) -> float:
    """Exponential backoff with full jitter. Prevents thundering herd."""
    exp = base * (2 ** attempt)
    return min(exp * random.random(), max_wait)


def _safe_json(resp: httpx.Response) -> dict | list | Any:
    """Safely parse JSON from a response. Returns raw text on failure."""
    try:
        content_type = resp.headers.get("content-type", "")
    except (AttributeError, TypeError):
        content_type = ""
    if "json" not in content_type and resp.text.strip():
        return {"_raw": resp.text}
    try:
        return resp.json()
    except Exception:
        return {"_raw": resp.text}


def translate_http_error(e: httpx.HTTPStatusError) -> AgentShieldError:
    """Translate an httpx HTTPStatusError to the appropriate AgentShield exception.

    This is the shared error translation used by all managers.
    """
    status = e.response.status_code
    try:
        detail = e.response.json()
    except Exception:
        detail = {"message": str(e)}

    msg = detail.get("detail", str(e))

    if status == 401:
        return AuthenticationError(msg, status_code=status, detail=detail)
    elif status == 403:
        return AuthorizationError(msg, status_code=status, detail=detail)
    elif status == 404:
        return NotFoundError(msg, status_code=status, detail=detail)
    elif status == 400:
        return ValidationError(msg, status_code=status, detail=detail)
    elif status == 429:
        return RateLimitError(msg, status_code=status, detail=detail)
    elif status == 422:
        # Check if this is a blocked-content response
        inner = detail.get("detail", detail) if isinstance(detail.get("detail"), dict) else detail
        if isinstance(inner, dict) and ("risk_score" in inner or "patterns_matched" in inner or "max_severity" in inner):
            scan = inner.get("scan_result", inner)
            return BlockedContentError(msg, scan_result=scan, status_code=status, detail=detail)
        return ValidationError(msg, status_code=status, detail=detail)
    elif status >= 500:
        return ASConnectionError(msg, status_code=status, detail=detail)
    else:
        return AgentShieldError(msg, status_code=status, detail=detail)


def _wrap_http_error(e: httpx.HTTPStatusError) -> AgentShieldError:
    """Wrap an HTTP error - same as translate_http_error but for use in except blocks."""
    return translate_http_error(e)


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

            except httpx.HTTPError as e:
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

        raise ASConnectionError(
            f"Cannot connect to AgentShield at {request.url.host}. "
            "Start the backend with: agentshield serve",
            status_code=None,
        ) from last_exc


class AgentShield:
    """Tamper-evident memory defense for LLM agents.

    Zero-config: just ``AgentShield()`` and the SDK auto-discovers
    a running backend (local or hosted).

    Usage::

        from agentshield import AgentShield

        # Auto-connect (finds local or hosted backend)
        shield = AgentShield()

        # Or explicit URL
        shield = AgentShield(base_url="http://localhost:8000")

        # Register (first time)
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
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        log_level: int | None = None,
    ):
        self._base_url = _resolve_base_url(base_url).rstrip("/")
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

        # Resolve API key (explicit -> env -> config file)
        resolved_key = _resolve_api_key(api_key)
        if resolved_key:
            self.auth.set_token(resolved_key)

        logger.info("AgentShield client initialized (url=%s, retries=%d)", self._base_url, max_retries)

    @property
    def base_url(self) -> str:
        return self._base_url

    def health(self) -> dict:
        """Check backend health status."""
        try:
            resp = self._client.get("/health")
            resp.raise_for_status()
            return _safe_json(resp)
        except httpx.HTTPStatusError as e:
            raise _wrap_http_error(e) from e
        except httpx.HTTPError as e:
            raise ASConnectionError(
                f"Health check failed: {e}",
                status_code=None,
            ) from e

    def info(self) -> dict:
        """Get system info."""
        try:
            resp = self._client.get("/")
            resp.raise_for_status()
            return _safe_json(resp)
        except httpx.HTTPStatusError as e:
            raise _wrap_http_error(e) from e
        except httpx.HTTPError as e:
            raise ASConnectionError(
                f"Info request failed: {e}",
                status_code=None,
            ) from e

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
