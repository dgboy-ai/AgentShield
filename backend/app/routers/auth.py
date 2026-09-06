import os
import secrets
import time
import collections
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.models.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserCreate, UserLogin, Token, TokenData, RefreshRequest

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
_MAX_PASSWORD_BYTES = 72  # bcrypt truncates at 72 bytes

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Per-endpoint rate limiter for auth (5/min for login/register, 10/min for refresh)
_auth_hits: dict[str, collections.deque] = {}

def _auth_rate_limit(request: Request, max_req: int = 5, window: int = 60):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() if request.headers.get("x-forwarded-for") else (request.client.host if request.client else "unknown")
    key = f"{ip}:{request.url.path}"
    now = time.time()
    dq = _auth_hits.setdefault(key, collections.deque())
    while dq and dq[0] < now - window:
        dq.popleft()
    if len(dq) >= max_req:
        raise HTTPException(status_code=429, detail=f"Too many requests on {request.url.path}, try again in {int(dq[0] + window - now)}s", headers={"Retry-After": str(int(dq[0] + window - now))})
    dq.append(now)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    # Enforce 72 bytes limit explicitly (bcrypt truncates silently)
    if len(password.encode("utf-8")) > _MAX_PASSWORD_BYTES:
        raise ValueError(f"Password too long: bcrypt truncates at {_MAX_PASSWORD_BYTES} bytes, use shorter password or argon2")
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

def _extract_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    # Try Authorization header first, then httpOnly cookie
    if credentials and credentials.credentials:
        return credentials.credentials
    # Fallback to cookie (for httpOnly)
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
    return None

def get_current_user_dep(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = _extract_token(request, credentials)
    # --- Demo token bypass for WebMCP / judges (scoped to read-only) ---
    demo_token = os.getenv("DEMO_API_TOKEN", "").strip()
    if demo_token and token == demo_token:
        # Scope demo token to GET only (read-only) to prevent exfiltration via POST
        if request.method != "GET":
            raise HTTPException(status_code=403, detail="Demo token is read-only (GET only)")
        demo_email = os.getenv("DEMO_USER_EMAIL", "demo@agentshield.local")
        demo_user = db.query(User).filter(User.email == demo_email).first()
        if demo_user and demo_user.is_active:
            return demo_user
        raise credentials_exception

    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(optional_security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Optional auth — returns None instead of 401, for public endpoints that enhance when logged in."""
    token = _extract_token(request, credentials)
    if not token:
        return None
    demo_token = os.getenv("DEMO_API_TOKEN", "").strip()
    if demo_token and token == demo_token:
        demo_email = os.getenv("DEMO_USER_EMAIL", "demo@agentshield.local")
        demo_user = db.query(User).filter(User.email == demo_email).first()
        if demo_user and demo_user.is_active:
            return demo_user
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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

def require_role(required_role: str):
    def _check(user: User = Depends(get_current_user_dep)):
        if user.role != required_role and user.role != "admin":
            raise HTTPException(status_code=403, detail=f"Requires role {required_role}")
        return user
    return _check

@router.post("/register", response_model=Token)
def register(request: Request, response: Response, user_data: UserCreate, db: Session = Depends(get_db)):
    _auth_rate_limit(request, max_req=5, window=60)
    if len(user_data.password) < _MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {_MIN_PASSWORD_LENGTH} characters",
        )
    if len(user_data.password.encode("utf-8")) > _MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password too long: bcrypt truncates at {_MAX_PASSWORD_BYTES} bytes",
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
    refresh_token = create_refresh_token(data={"sub": str(user.user_id), "org_id": str(org.org_id)})
    # Set httpOnly cookies (secure in production)
    is_secure = _IS_PRODUCTION
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=is_secure, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=is_secure, samesite="lax", max_age=REFRESH_TOKEN_EXPIRE_DAYS*24*3600, path="/")

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.user_id),
        org_id=str(org.org_id),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES*60,
    )

@router.post("/login", response_model=Token)
def login(request: Request, response: Response, credentials: UserLogin, db: Session = Depends(get_db)):
    _auth_rate_limit(request, max_req=5, window=60)
    if len(credentials.password.encode("utf-8")) > _MAX_PASSWORD_BYTES:
        # Still check but don't leak that password is too long - treat as invalid
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
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
    refresh_token = create_refresh_token(
        data={"sub": str(user.user_id), "org_id": str(user.org_id)}
    )
    is_secure = _IS_PRODUCTION
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=is_secure, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=is_secure, samesite="lax", max_age=REFRESH_TOKEN_EXPIRE_DAYS*24*3600, path="/")

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.user_id),
        org_id=str(user.org_id),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES*60,
    )

@router.post("/refresh", response_model=Token)
def refresh(request: Request, response: Response, body: Optional[RefreshRequest] = None, db: Session = Depends(get_db)):
    _auth_rate_limit(request, max_req=10, window=60)
    # Try body, then cookie, then Authorization header
    token = None
    if body and body.refresh_token:
        token = body.refresh_token
    if not token:
        token = request.cookies.get("refresh_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token required")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user_id = payload.get("sub")
        org_id = payload.get("org_id")
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    new_access = create_access_token(data={"sub": str(user.user_id), "org_id": str(org_id)})
    new_refresh = create_refresh_token(data={"sub": str(user.user_id), "org_id": str(org_id)})
    is_secure = _IS_PRODUCTION
    response.set_cookie(key="access_token", value=new_access, httponly=True, secure=is_secure, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60, path="/")
    response.set_cookie(key="refresh_token", value=new_refresh, httponly=True, secure=is_secure, samesite="lax", max_age=REFRESH_TOKEN_EXPIRE_DAYS*24*3600, path="/")
    return Token(access_token=new_access, refresh_token=new_refresh, user_id=str(user.user_id), org_id=str(org_id), expires_in=ACCESS_TOKEN_EXPIRE_MINUTES*60)

@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user_dep)):
    # Clear cookies (httpOnly)
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"status": "logged out"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user_dep)):
    return {
        "user_id": str(current_user.user_id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "org_id": str(current_user.org_id),
    }
