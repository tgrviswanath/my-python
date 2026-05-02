# FastAPI — Dependency Injection

## What is Dependency Injection?

FastAPI's `Depends()` system lets you declare reusable logic (DB sessions, auth, pagination) that gets injected into route handlers automatically.

```
Route Handler
    ↓ Depends()
  Dependency A
    ↓ Depends()
  Dependency B (sub-dependency)
    ↓ Depends()
  Dependency C (shared — called only once per request)
```

---

## Basic Dependencies

```python
from fastapi import FastAPI, Depends, HTTPException, status
from typing import Annotated

app = FastAPI()

# Simple function dependency
def get_pagination(skip: int = 0, limit: int = 20) -> dict:
    return {"skip": skip, "limit": min(limit, 100)}

@app.get("/items")
def list_items(pagination: Annotated[dict, Depends(get_pagination)]):
    return {"pagination": pagination}
# GET /items?skip=0&limit=10 → pagination = {"skip": 0, "limit": 10}

# Class-based dependency (more powerful)
class PaginationParams:
    def __init__(self, page: int = 1, size: int = 20):
        self.skip = (page - 1) * size
        self.limit = min(size, 100)
        self.page = page
        self.size = size

@app.get("/products")
def list_products(
    pagination: Annotated[PaginationParams, Depends(PaginationParams)]
):
    return {"skip": pagination.skip, "limit": pagination.limit}
```

---

## Database Session Dependency

```python
# app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    echo=settings.debug
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# app/dependencies.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# Type alias for cleaner code
DBSession = Annotated[AsyncSession, Depends(get_db)]

# Usage in routes
@app.get("/users/{user_id}")
async def get_user(user_id: int, db: DBSession):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

---

## Authentication Dependency

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.models.user import User
from app.config import get_settings

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DBSession
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# Role-based access control
def require_role(*roles: str):
    async def check_role(
        current_user: Annotated[User, Depends(get_current_active_user)]
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {roles}"
            )
        return current_user
    return check_role

# Type aliases
CurrentUser = Annotated[User, Depends(get_current_active_user)]
AdminUser   = Annotated[User, Depends(require_role("admin"))]

# Usage
@app.get("/profile")
async def get_profile(current_user: CurrentUser):
    return current_user

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: AdminUser, db: DBSession):
    await db.delete(await db.get(User, user_id))
```

---

## Dependency with yield (Resource Management)

```python
# Dependencies with yield act like context managers
# Code before yield = setup, code after yield = teardown

import httpx

async def get_http_client() -> httpx.AsyncClient:
    async with httpx.AsyncClient(timeout=30.0) as client:
        yield client
    # client.aclose() called automatically after request

@app.get("/external-data")
async def fetch_data(client: Annotated[httpx.AsyncClient, Depends(get_http_client)]):
    response = await client.get("https://api.example.com/data")
    return response.json()

# Redis connection
import redis.asyncio as redis

async def get_redis():
    r = redis.Redis(host="localhost", port=6379, decode_responses=True)
    try:
        yield r
    finally:
        await r.aclose()

RedisClient = Annotated[redis.Redis, Depends(get_redis)]
```

---

## Sub-dependencies & Caching

```python
# FastAPI caches dependencies within a single request
# If multiple routes depend on the same dependency, it's called only once

async def get_settings_dep():
    return get_settings()

async def get_db_dep(settings = Depends(get_settings_dep)):
    # settings is cached — get_settings_dep called only once
    async with AsyncSessionLocal() as session:
        yield session

async def get_user_service(db = Depends(get_db_dep)):
    return UserService(db)

async def get_item_service(db = Depends(get_db_dep)):
    # db is the SAME session as above (cached)
    return ItemService(db)

@app.post("/checkout")
async def checkout(
    user_svc = Depends(get_user_service),
    item_svc = Depends(get_item_service)
    # get_db_dep called only ONCE despite two services depending on it
):
    ...

# Disable caching (call dependency fresh each time)
@app.get("/fresh")
async def fresh_data(
    data = Depends(get_data, use_cache=False)
):
    ...
```

---

## Global Dependencies (Applied to All Routes)

```python
from fastapi import FastAPI, Depends, Request
import time

async def log_request(request: Request):
    start = time.time()
    yield
    duration = time.time() - start
    print(f"{request.method} {request.url} — {duration:.3f}s")

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")

# Apply to entire app
app = FastAPI(dependencies=[Depends(log_request)])

# Apply to a router
router = APIRouter(dependencies=[Depends(verify_api_key)])

# Apply to specific route
@app.get("/secure", dependencies=[Depends(verify_api_key)])
def secure_endpoint():
    return {"data": "secret"}
```

---

## Interview Q&A

### Q1: What is dependency injection and why use it?
DI is a pattern where dependencies (DB sessions, auth, config) are declared and injected automatically rather than created inside functions. Benefits: (1) Reusability — write once, use everywhere, (2) Testability — swap real DB with mock in tests, (3) Separation of concerns — routes focus on business logic, (4) Automatic cleanup — `yield` dependencies handle teardown.

### Q2: How does FastAPI's `Depends()` differ from regular function calls?
`Depends()` is resolved by FastAPI's dependency injection system, not by you. FastAPI: (1) resolves the dependency graph, (2) caches results within a request, (3) handles async/sync automatically, (4) runs teardown code after `yield`. Regular function calls don't get any of this.

### Q3: What is the difference between `Depends` with and without `yield`?
**Without yield**: Simple function, returns a value. No cleanup needed. Example: `get_pagination()`.
**With yield**: Acts like a context manager. Code before `yield` = setup (open DB session). Code after `yield` = teardown (close session, rollback on error). Use for resources that need cleanup.

### Q4: How do you test routes that use dependencies?
Use `app.dependency_overrides` to replace real dependencies with mocks:
```python
def override_get_db():
    yield test_db_session

app.dependency_overrides[get_db] = override_get_db
# Now all routes use test_db_session instead of real DB
```
