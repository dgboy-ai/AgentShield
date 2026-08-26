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


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    org_id: Optional[str] = None
