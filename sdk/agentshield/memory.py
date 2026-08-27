"""Memory operations."""

from __future__ import annotations

import httpx

from .auth import AuthManager
from .exceptions import AgentShieldError
from .models import Memory


class MemoryManager:
    """Store, retrieve, and verify memories with hash chain integrity."""

    def __init__(self, client: httpx.Client, auth: AuthManager):
        self._client = client
        self._auth = auth

    def store(
        self,
        content: str,
        memory_type: str = "episodic",
        importance_score: float = 0.5,
        trust_level: float = 1.0,
        source_provenance: str = "",
    ) -> Memory:
        """Store a memory. Blocked if pattern detection finds HIGH/CRITICAL matches.

        Raises:
            BlockedContentError: If the content triggers a HIGH/CRITICAL pattern.
            ValidationError: If input is invalid.
        """
        self._require_auth()
        try:
            resp = self._client.post(
                "/api/memories",
                json={
                    "content": content,
                    "memory_type": memory_type,
                    "importance_score": importance_score,
                    "trust_level": trust_level,
                    "source_provenance": source_provenance,
                },
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                raise AgentShieldError(
                    f"Expected dict response, got {type(data).__name__}",
                    status_code=None,
                )
            return Memory.from_dict(data)
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (httpx.JSONDecodeError, KeyError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

    def list(
        self,
        memory_type: str | None = None,
    ) -> list[Memory]:
        """List all memories, optionally filtered by type."""
        self._require_auth()
        params = {}
        if memory_type:
            params["memory_type"] = memory_type
        try:
            resp = self._client.get(
                "/api/memories",
                params=params,
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, list):
                raise AgentShieldError(
                    f"Expected list response, got {type(data).__name__}",
                    status_code=None,
                )
            return [Memory.from_dict(m) for m in data]
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (httpx.JSONDecodeError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

    def get(self, memory_id: str) -> Memory:
        """Get a single memory by ID."""
        self._require_auth()
        try:
            resp = self._client.get(
                f"/api/memories/{memory_id}",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                raise AgentShieldError(
                    f"Expected dict response, got {type(data).__name__}",
                    status_code=None,
                )
            return Memory.from_dict(data)
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (httpx.JSONDecodeError, KeyError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

    def verify_chain(self) -> dict:
        """Verify the memory hash chain integrity."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/memories/chain/verify",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                raise AgentShieldError(
                    f"Expected dict response, got {type(data).__name__}",
                    status_code=None,
                )
            return data
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (httpx.JSONDecodeError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

    def _require_auth(self):
        if not self._auth.token:
            raise AgentShieldError("Not authenticated. Call auth.register() or auth.login() first.")

    def _auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self._auth.token}"}

    @staticmethod
    def _translate_error(e: httpx.HTTPStatusError):
        from .client import translate_http_error
        return translate_http_error(e)
