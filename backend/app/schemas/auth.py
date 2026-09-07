from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v) > 128:
            raise ValueError("Password too long (max 128 characters)")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password too long: bcrypt truncates at 72 bytes (use shorter)")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v) > 128:
            raise ValueError("Password too long (max 128 characters)")
        return v


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    org_id: str
    refresh_token: Optional[str] = None
    expires_in: int = 900  # 15 minutes


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    org_id: Optional[str] = None
