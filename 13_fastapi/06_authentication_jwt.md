# FastAPI — Authentication & JWT Security

## Setup

```bash
pip install python-jose[cryptography] passlib[bcrypt] python-multipart
```

---

## JWT Token Flow

```
1. POST /auth/token  {username, password}
        ↓
2. Verify credentials against DB
        ↓
3. Create JWT: {sub: user_id, exp: now+30min}
        ↓
4. Return {access_token, token_type: "bearer"}
        ↓
5. Client sends: Authorization: Bearer <token>
        ↓
6. FastAPI verifies token on every protected route
```

---

## Auth Router

```python
# app/routers/auth.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.dependencies import DBSession
from app.models.user import User
from app.config import get_settings
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

# ── Schemas ───────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenData(BaseModel):
    user_id: int | None = None

# ── Helpers ───────────────────────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

def create_access_token(user_id: int) -> str:
    return create_token(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes)
    )

def create_refresh_token(user_id: int) -> str:
    return create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=7)
    )

# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/token", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: DBSession = Depends()
):
    # Find user
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60
    )

@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: DBSession = Depends()
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token"
    )
    try:
        payload = jwt.decode(refresh_token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError):
        raise credentials_exception

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exception

    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60
    )

@router.post("/logout")
async def logout():
    # With JWT, logout is client-side (delete token)
    # For server-side: add token to a blocklist (Redis)
    return {"message": "Successfully logged out"}
```

---

## Auth Dependencies

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.models.user import User
from app.config import get_settings
from typing import Annotated

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DBSession
) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        user_id = int(payload["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_current_active_user(
    user: Annotated[User, Depends(get_current_user)]
) -> User:
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

# Role-based access
def require_roles(*roles: str):
    async def _check(user: Annotated[User, Depends(get_current_active_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _check

# Convenient type aliases
CurrentUser = Annotated[User, Depends(get_current_active_user)]
AdminOnly   = Annotated[User, Depends(require_roles("admin"))]
```

---

## API Key Authentication

```python
from fastapi import Security
from fastapi.security import APIKeyHeader, APIKeyQuery

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
api_key_query  = APIKeyQuery(name="api_key", auto_error=False)

async def get_api_key(
    header_key: str | None = Security(api_key_header),
    query_key:  str | None = Security(api_key_query),
    db: DBSession = Depends()
) -> str:
    key = header_key or query_key
    if not key:
        raise HTTPException(status_code=403, detail="API key required")

    # Validate against DB
    api_key = await db.execute(
        select(APIKey).where(APIKey.key == key, APIKey.is_active == True)
    )
    if not api_key.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Invalid API key")
    return key

@app.get("/data", dependencies=[Depends(get_api_key)])
async def get_data():
    return {"data": "protected"}
```

---

## Password Reset Flow

```python
import secrets
from datetime import datetime, timedelta, timezone

@router.post("/forgot-password")
async def forgot_password(email: str, db: DBSession, background_tasks: BackgroundTasks):
    user = await get_user_by_email(db, email)
    if not user:
        # Don't reveal if email exists
        return {"message": "If that email exists, a reset link was sent"}

    # Generate secure token
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)

    # Store token in DB
    await store_reset_token(db, user.id, token, expires)

    # Send email in background
    background_tasks.add_task(send_reset_email, user.email, token)
    return {"message": "If that email exists, a reset link was sent"}

@router.post("/reset-password")
async def reset_password(token: str, new_password: str, db: DBSession):
    reset = await get_reset_token(db, token)
    if not reset or reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    await update_password(db, reset.user_id, hash_password(new_password))
    await delete_reset_token(db, token)
    return {"message": "Password updated successfully"}
```

---

## Interview Q&A

### Q1: What is JWT and how does it work?
JWT (JSON Web Token) is a self-contained token with three parts: **Header** (algorithm), **Payload** (claims: user_id, expiry), **Signature** (HMAC of header+payload with secret key). The server verifies the signature on every request — no DB lookup needed. Stateless authentication. Downside: can't invalidate before expiry without a blocklist.

### Q2: What is the difference between access tokens and refresh tokens?
**Access token**: Short-lived (15-60 min). Used to authenticate API requests. If stolen, expires quickly.
**Refresh token**: Long-lived (7-30 days). Used only to get new access tokens. Stored securely (httpOnly cookie). If stolen, can be revoked in DB.
Pattern: access token expires → client uses refresh token to get new access token → user stays logged in without re-entering password.

### Q3: How do you implement token revocation with JWT?
JWT is stateless — you can't invalidate a token without a blocklist. Options: (1) **Redis blocklist** — store revoked token JTI (JWT ID) in Redis with TTL = token expiry, (2) **Short expiry** — 15-minute access tokens limit damage window, (3) **Refresh token rotation** — invalidate refresh token on use, store in DB, (4) **Version field** — store `token_version` in user DB, increment on logout, reject tokens with old version.

### Q4: What is `OAuth2PasswordRequestForm` and when do you use it?
It's a FastAPI form dependency that reads `username` and `password` from a form body (not JSON). Required by the OAuth2 spec for the token endpoint. The Swagger UI `/docs` uses this to provide a login form. For JSON-based login (non-OAuth2), use a regular Pydantic model instead.
