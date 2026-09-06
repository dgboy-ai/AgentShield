from pydantic import BaseModel, EmailStr
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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
