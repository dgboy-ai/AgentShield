"""AgentShield — Tamper-evident memory defense for LLM agents."""

from .client import AgentShield
from .models import (
    Memory,
    Constraint,
    ScanResult,
    PatternMatch,
    AuditEntry,
    ComplianceReport,
    Token,
    User,
    MemoryType,
    ConstraintType,
    Severity,
)
from .exceptions import (
    AgentShieldError,
    AuthenticationError,
    AuthorizationError,
    BlockedContentError,
    ConnectionError,
    IntegrityError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)

__version__ = "1.0.0"

__all__ = [
    "AgentShield",
    "Memory",
    "Constraint",
    "ScanResult",
    "PatternMatch",
    "AuditEntry",
    "ComplianceReport",
    "Token",
    "User",
    "MemoryType",
    "ConstraintType",
    "Severity",
    "AgentShieldError",
    "AuthenticationError",
    "AuthorizationError",
    "BlockedContentError",
    "ConnectionError",
    "IntegrityError",
    "NotFoundError",
    "RateLimitError",
    "ValidationError",
]


def __getattr__(name: str):
    """Lazy import for langgraph subpackage."""
    if name == "langgraph":
        from . import langgraph
        return langgraph
    raise AttributeError(f"module 'agentshield' has no attribute {name!r}")
