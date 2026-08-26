"""Constraint pinning operations."""

from __future__ import annotations

import httpx

from .auth import AuthManager
from .exceptions import AgentShieldError, ValidationError, NotFoundError
from .models import Constraint


class ConstraintManager:
    """Pin, manage, and verify safety constraints."""

    def __init__(self, client: httpx.Client, auth: AuthManager):
        self._client = client
        self._auth = auth

    def pin(
        self,
        text: str,
        constraint_type: str = "safety",
    ) -> Constraint:
        """Pin a new constraint. It will be quarantined from context compaction.

        Args:
            text: The constraint rule text.
            constraint_type: One of 'safety', 'policy', 'instruction'.

        Raises:
            ValidationError: If text is empty/too long or type is invalid.
        """
        self._require_auth()
        try:
            resp = self._client.post(
                "/api/constraints",
                json={"text": text, "constraint_type": constraint_type},
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return Constraint.from_dict(resp.json())
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def list(
        self,
        constraint_type: str | None = None,
        active_only: bool = True,
    ) -> list[Constraint]:
        """List all constraints, optionally filtered."""
        self._require_auth()
        params = {}
        if constraint_type:
            params["constraint_type"] = constraint_type
        if not active_only:
            params["is_active"] = "false"
        try:
            resp = self._client.get(
                "/api/constraints",
                params=params,
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return [Constraint.from_dict(c) for c in resp.json()]
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def get(self, constraint_id: str) -> Constraint:
        """Get a single constraint by ID."""
        self._require_auth()
        try:
            resp = self._client.get(
                f"/api/constraints/{constraint_id}",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return Constraint.from_dict(resp.json())
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def update(
        self,
        constraint_id: str,
        text: str | None = None,
        constraint_type: str | None = None,
        is_active: bool | None = None,
    ) -> Constraint:
        """Update a constraint."""
        self._require_auth()
        body = {}
        if text is not None:
            body["text"] = text
        if constraint_type is not None:
            body["constraint_type"] = constraint_type
        if is_active is not None:
            body["is_active"] = is_active
        try:
            resp = self._client.put(
                f"/api/constraints/{constraint_id}",
                json=body,
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return Constraint.from_dict(resp.json())
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def deactivate(self, constraint_id: str) -> None:
        """Deactivate (soft-delete) a constraint."""
        self._require_auth()
        try:
            resp = self._client.delete(
                f"/api/constraints/{constraint_id}",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def verify_integrity(self) -> dict:
        """Verify constraint hash chain integrity."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/constraints/integrity/verify",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def integrity_score(self) -> dict:
        """Get integrity score and token overhead."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/constraints/integrity/score",
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
        status = e.response.status_code
        try:
            detail = e.response.json()
        except Exception:
            detail = {"message": str(e)}
        msg = detail.get("detail", str(e))
        if status == 404:
            raise NotFoundError(msg, status_code=status, detail=detail)
        elif status == 422:
            raise ValidationError(msg, status_code=status, detail=detail)
        else:
            raise AgentShieldError(msg, status_code=status, detail=detail)
