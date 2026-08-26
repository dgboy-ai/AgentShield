"""AgentShield SDK exceptions."""


class AgentShieldError(Exception):
    """Base exception for all AgentShield errors."""

    def __init__(self, message: str, status_code: int | None = None, detail: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail


class AuthenticationError(AgentShieldError):
    """Raised when authentication fails (401)."""


class AuthorizationError(AgentShieldError):
    """Raised when access is denied (403)."""


class NotFoundError(AgentShieldError):
    """Raised when a resource is not found (404)."""


class ValidationError(AgentShieldError):
    """Raised when input validation fails (422)."""


class BlockedContentError(AgentShieldError):
    """Raised when content is blocked by pattern detection (422)."""

    def __init__(self, message: str, scan_result: dict | None = None, **kwargs):
        super().__init__(message, **kwargs)
        self.scan_result = scan_result


class IntegrityError(AgentShieldError):
    """Raised when hash chain integrity check fails."""


class RateLimitError(AgentShieldError):
    """Raised when rate limit is exceeded (429)."""


class ConnectionError(AgentShieldError):
    """Raised when the API server is unreachable."""
