"""Constraint pinning operations."""

from __future__ import annotations

import json

import httpx

from .auth import AuthManager
from .exceptions import AgentShieldError
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
            data = resp.json()
            if not isinstance(data, dict):
                raise AgentShieldError(
                    f"Expected dict response, got {type(data).__name__}",
                    status_code=None,
                )
            return Constraint.from_dict(data)
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

    def inject(self) -> str:
        """Fetch active constraints and render them as a system-prompt block.

        This is the write-path half of constraint pinning: fetch the org's
        active constraints and prepend the returned block to the agent's
        system prompt so pins survive context compaction.

        Returns:
            A ready-to-prepend block, or "" when no constraints are pinned.
        """
        constraints = self.list(active_only=True)
        if not constraints:
            return ""
        lines = "\n".join(
            f"- [{c.constraint_type}] {c.text}" for c in constraints
        )
        return (
            "<agentshield-constraints>\n"
            "The following pinned constraints must be followed at all times:\n"
            f"{lines}\n"
            "</agentshield-constraints>"
        )

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
        if active_only:
            params["is_active"] = "true"
        try:
            resp = self._client.get(
                "/api/constraints",
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
            return [Constraint.from_dict(c) for c in data]
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (json.JSONDecodeError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

    def get(self, constraint_id: str) -> Constraint:
        """Get a single constraint by ID."""
        self._require_auth()
        try:
            resp = self._client.get(
                f"/api/constraints/{constraint_id}",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                raise AgentShieldError(
                    f"Expected dict response, got {type(data).__name__}",
                    status_code=None,
                )
            return Constraint.from_dict(data)
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

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
            data = resp.json()
            if not isinstance(data, dict):
                raise AgentShieldError(
                    f"Expected dict response, got {type(data).__name__}",
                    status_code=None,
                )
            return Constraint.from_dict(data)
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

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
            data = resp.json()
            if not isinstance(data, dict):
                raise AgentShieldError(
                    f"Expected dict response, got {type(data).__name__}",
                    status_code=None,
                )
            return data
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)
        except (json.JSONDecodeError, TypeError) as e:
            raise AgentShieldError(
                f"Malformed server response: {e}",
                status_code=None,
            ) from e

    def integrity_score(self) -> dict:
        """Get integrity score and token overhead."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/constraints/integrity/score",
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
        except (json.JSONDecodeError, TypeError) as e:
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
