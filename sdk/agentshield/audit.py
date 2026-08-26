"""Audit trail operations."""

from __future__ import annotations

import httpx

from .auth import AuthManager
from .exceptions import AgentShieldError
from .models import AuditEntry, ComplianceReport


class AuditManager:
    """Query the tamper-evident audit trail and compliance reports."""

    def __init__(self, client: httpx.Client, auth: AuthManager):
        self._client = client
        self._auth = auth

    def entries(
        self,
        event_type: str | None = None,
        actor: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """List audit entries with optional filters."""
        self._require_auth()
        params = {"limit": limit, "offset": offset}
        if event_type:
            params["event_type"] = event_type
        if actor:
            params["actor"] = actor
        try:
            resp = self._client.get(
                "/api/audit",
                params=params,
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def timeline(self) -> dict:
        """Get the audit timeline (last 100 events + event counts)."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/audit/timeline",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def verify_chain(self) -> dict:
        """Verify audit trail hash chain integrity."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/audit/verify",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def compliance_report(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> ComplianceReport:
        """Generate an EU AI Act Article 12 compliance report.

        Args:
            start_date: ISO format start date (optional).
            end_date: ISO format end date (optional).
        """
        self._require_auth()
        params = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        try:
            resp = self._client.get(
                "/api/audit/compliance/report",
                params=params,
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return ComplianceReport.from_dict(resp.json())
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def export_jsonl(self) -> str:
        """Export audit trail as JSONL."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/audit/export/jsonl",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return resp.text
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def export_csv(self) -> str:
        """Export audit trail as CSV."""
        self._require_auth()
        try:
            resp = self._client.get(
                "/api/audit/export/csv",
                headers=self._auth_headers(),
            )
            resp.raise_for_status()
            return resp.text
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
