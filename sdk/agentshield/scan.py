"""Pattern scanning operations."""

from __future__ import annotations

import httpx

from .auth import AuthManager
from .exceptions import AgentShieldError
from .models import ScanResult


class ScanManager:
    """Scan text for injection and poisoning patterns."""

    def __init__(self, client: httpx.Client, auth: AuthManager):
        self._client = client
        self._auth = auth

    def text(self, content: str) -> ScanResult:
        """Scan text for known attack patterns.

        Returns a ScanResult with matches, risk score, and whether
        the content would be blocked.
        """
        self._require_auth()
        try:
            resp = self._client.post(
                "/api/scan",
                json={"text": content},
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return ScanResult.from_dict(resp.json())
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def patterns(self) -> dict:
        """Get the full pattern library and stats."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/scan/patterns",
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
        raise AgentShieldError(msg, status_code=status, detail=detail)
