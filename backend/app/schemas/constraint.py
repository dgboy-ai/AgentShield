from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

_MAX_CONSTRAINT_LENGTH = 10_000


class ConstraintCreate(BaseModel):
    text: str
    constraint_type: str = "safety"

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("text must not be empty")
        if len(v) > _MAX_CONSTRAINT_LENGTH:
            raise ValueError(f"text too long ({len(v)} > {_MAX_CONSTRAINT_LENGTH})")
        return v

    @field_validator("constraint_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"safety", "policy", "instruction"}
        if v not in allowed:
            raise ValueError(f"constraint_type must be one of {allowed}")
        return v


class ConstraintUpdate(BaseModel):
    text: Optional[str] = None
    constraint_type: Optional[str] = None
    is_active: Optional[bool] = None


class ConstraintResponse(BaseModel):
    constraint_id: str
    org_id: str
    text: str
    constraint_type: str
    is_active: bool
    previous_hash: Optional[str]
    entry_hash: str
    kms_signature: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
