import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.models.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserCreate, UserLogin, Token, TokenData

router = APIRouter(prefix="/api/auth", tags=["auth"])

_SECRET_KEY_RAW = os.getenv("JWT_SECRET_KEY", "")
_IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")

if _IS_PRODUCTION and not _SECRET_KEY_RAW:
    raise RuntimeError(
        "CRITICAL: JWT_SECRET_KEY must be set in production. "
        "A missing or hardcoded secret allows token forgery."
    )

if not _SECRET_KEY_RAW:
    _SECRET_KEY_RAW = secrets.token_hex(32)
    import logging
    logging.getLogger("agentshield.auth").warning(
        "JWT_SECRET_KEY not set — using ephemeral random key. "
        "Tokens will be invalid after restart. Set JWT_SECRET_KEY in .env for production."
    )

SECRET_KEY = _SECRET_KEY_RAW
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

_MIN_PASSWORD_LENGTH = 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


security = HTTPBearer(auto_error=False)
optional_security = HTTPBearer(auto_error=False)


def get_current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # --- Demo token bypass for WebMCP / judges ---
    # If Authorization: Bearer <DEMO_API_TOKEN> and DEMO_API_TOKEN is set, treat as demo user
    demo_token = os.getenv("DEMO_API_TOKEN", "").strip()
    if demo_token and credentials is not None and credentials.credentials == demo_token:
        demo_email = os.getenv("DEMO_USER_EMAIL", "demo@agentshield.local")
        demo_user = db.query(User).filter(User.email == demo_email).first()
        if demo_user and demo_user.is_active:
            return demo_user
        raise credentials_exception

    if credentials is None or not credentials.credentials:
        raise credentials_exception
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def get_optional_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Optional auth — returns None instead of 401, for public endpoints that enhance when logged in."""
    if credentials is None or not credentials.credentials:
        return None
    # Demo token path
    demo_token = os.getenv("DEMO_API_TOKEN", "").strip()
    if demo_token and credentials.credentials == demo_token:
        demo_email = os.getenv("DEMO_USER_EMAIL", "demo@agentshield.local")
        demo_user = db.query(User).filter(User.email == demo_email).first()
        if demo_user and demo_user.is_active:
            return demo_user
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            return None
    except (JWTError, ValueError):
        return None
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None or not user.is_active:
        return None
    return user


@router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    if len(user_data.password) < _MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {_MIN_PASSWORD_LENGTH} characters",
        )
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    org = Organization(org_name=f"{user_data.full_name}'s Organization")
    db.add(org)
    db.flush()

    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        org_id=org.org_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.user_id), "org_id": str(org.org_id)})

    return Token(
        access_token=access_token,
        user_id=str(user.user_id),
        org_id=str(org.org_id),
    )


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    access_token = create_access_token(
        data={"sub": str(user.user_id), "org_id": str(user.org_id)}
    )

    return Token(
        access_token=access_token,
        user_id=str(user.user_id),
        org_id=str(user.org_id),
    )


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user_dep)):
    return {
        "user_id": str(current_user.user_id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "org_id": str(current_user.org_id),
    }
