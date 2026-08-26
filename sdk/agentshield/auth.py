"""Authentication manager."""

from __future__ import annotations

import httpx

from .exceptions import AuthenticationError, AgentShieldError
from .models import Token, User


class AuthManager:
    """Handles registration, login, and token management."""

    def __init__(self, client: httpx.Client):
        self._client = client
        self._token: str | None = None
        self._user_id: str | None = None
        self._org_id: str | None = None

    def set_token(self, token: str):
        """Set a JWT token directly (e.g., from a previous session)."""
        self._token = token
        self._client.headers["Authorization"] = f"Bearer {token}"

    @property
    def token(self) -> str | None:
        return self._token

    @property
    def user_id(self) -> str | None:
        return self._user_id

    @property
    def org_id(self) -> str | None:
        return self._org_id

    def register(self, email: str, password: str, full_name: str) -> Token:
        """Register a new user and organization. Returns JWT token."""
        try:
            resp = self._client.post(
                "/api/auth/register",
                json={"email": email, "password": password, "full_name": full_name},
            )
            resp.raise_for_status()
            data = resp.json()
            token = Token(
                access_token=data["access_token"],
                token_type=data["token_type"],
                user_id=data["user_id"],
                org_id=data["org_id"],
            )
            self._token = token.access_token
            self._user_id = token.user_id
            self._org_id = token.org_id
            self._client.headers["Authorization"] = f"Bearer {token.access_token}"
            return token
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def login(self, email: str, password: str) -> Token:
        """Login with existing credentials. Returns JWT token."""
        try:
            resp = self._client.post(
                "/api/auth/login",
                json={"email": email, "password": password},
            )
            resp.raise_for_status()
            data = resp.json()
            token = Token(
                access_token=data["access_token"],
                token_type=data["token_type"],
                user_id=data["user_id"],
                org_id=data["org_id"],
            )
            self._token = token.access_token
            self._user_id = token.user_id
            self._org_id = token.org_id
            self._client.headers["Authorization"] = f"Bearer {token.access_token}"
            return token
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    def me(self) -> User:
        """Get current user info."""
        try:
            resp = self._client.get("/api/auth/me")
            resp.raise_for_status()
            data = resp.json()
            return User(
                user_id=data["user_id"],
                email=data["email"],
                full_name=data["full_name"],
                org_id=data["org_id"],
            )
        except httpx.HTTPStatusError as e:
            raise self._translate_error(e)

    @staticmethod
    def _translate_error(e: httpx.HTTPStatusError) -> AgentShieldError:
        from .exceptions import (
            AuthenticationError,
            ValidationError,
            RateLimitError,
        )

        status = e.response.status_code
        try:
            detail = e.response.json()
        except Exception:
            detail = {"message": str(e)}

        msg = detail.get("detail", str(e))

        if status == 401:
            return AuthenticationError(msg, status_code=status, detail=detail)
        elif status == 400:
            return ValidationError(msg, status_code=status, detail=detail)
        elif status == 422:
            return ValidationError(msg, status_code=status, detail=detail)
        elif status == 429:
            return RateLimitError(msg, status_code=status, detail=detail)
        else:
            return AgentShieldError(msg, status_code=status, detail=detail)
