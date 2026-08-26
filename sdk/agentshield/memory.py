"""Memory operations."""

from __future__ import annotations

import httpx

from .auth import AuthManager
from .exceptions import BlockedContentError, AgentShieldError
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
            return Memory.from_dict(resp.json())
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

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
            return [Memory.from_dict(m) for m in resp.json()]
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def get(self, memory_id: str) -> Memory:
        """Get a single memory by ID."""
        self._require_auth()
        try:
            resp = self._client.get(
                f"/api/memories/{memory_id}",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return Memory.from_dict(resp.json())
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def verify_chain(self) -> dict:
        """Verify the memory hash chain integrity."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/memories/chain/verify",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def _require_auth(self):
        if not self._auth.token:
            raise AgentShieldError("Not authenticated. Call auth.register() or auth.login() first.")

    def _auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self._auth.token}"}

    @staticmethod
    def _translate_error(e: httpx.HTTPStatusError):
        from .exceptions import (
            BlockedContentError,
            ValidationError,
            NotFoundError,
            AgentShieldError,
        )

        status = e.response.status_code
        try:
            detail = e.response.json()
        except Exception:
            detail = {"message": str(e)}

        msg = detail.get("detail", str(e))
        inner = detail.get("detail", detail) if isinstance(detail.get("detail"), dict) else detail

        if status == 422 and ("risk_score" in inner or "patterns_matched" in inner or "max_severity" in inner):
            scan = inner.get("scan_result", inner)
            raise BlockedContentError(msg, scan_result=scan, status_code=status, detail=detail)
        elif status == 422:
            raise ValidationError(msg, status_code=status, detail=detail)
        elif status == 404:
            raise NotFoundError(msg, status_code=status, detail=detail)
        else:
            raise AgentShieldError(msg, status_code=status, detail=detail)
