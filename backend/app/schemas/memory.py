from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


_MAX_CONTENT_LENGTH = 50_000


class MemoryCreate(BaseModel):
    content: str
    memory_type: str = "episodic"
    importance_score: float = 5.0
    trust_level: int = 2
    source_provenance: str = "agent_direct"

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("content must not be empty")
        if len(v) > _MAX_CONTENT_LENGTH:
            raise ValueError(f"content too long ({len(v)} > {_MAX_CONTENT_LENGTH})")
        return v

    @field_validator("memory_type")
    @classmethod
    def validate_memory_type(cls, v: str) -> str:
        allowed = {"episodic", "semantic", "procedural"}
        if not v or not v.strip():
            raise ValueError("memory_type must not be empty")
        if v not in allowed:
            raise ValueError(f"memory_type must be one of {allowed}")
        return v

    @field_validator("importance_score")
    @classmethod
    def validate_importance(cls, v: float) -> float:
        if not 0 <= v <= 10:
            raise ValueError("importance_score must be 0-10")
        return v

    @field_validator("trust_level")
    @classmethod
    def validate_trust(cls, v: int) -> int:
        if v not in (0, 1, 2, 3):
            raise ValueError("trust_level must be 0-3")
        return v

    @field_validator("source_provenance")
    @classmethod
    def validate_provenance(cls, v: str) -> str:
        allowed = {"agent_direct", "user_input", "tool_output", "external"}
        if v not in allowed:
            raise ValueError(f"source_provenance must be one of {allowed}")
        return v


class MemoryResponse(BaseModel):
    memory_id: str
    org_id: str
    content: str
    memory_type: str
    importance_score: float
    trust_level: int
    source_provenance: str
    previous_hash: Optional[str]
    entry_hash: str
    kms_signature: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MemorySearch(BaseModel):
    query: str
    limit: int = 10
    memory_type: Optional[str] = None
