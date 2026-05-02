# FastAPI — Interview Questions (Basic → Advanced)

## Basic Level

### Q1: What is FastAPI and what are its main advantages?
FastAPI is a modern Python web framework for building APIs. Main advantages:
- **Performance**: One of the fastest Python frameworks (async/await, Starlette)
- **Auto documentation**: Swagger UI and ReDoc generated automatically from type hints
- **Type safety**: Pydantic validation catches errors at request time, not runtime
- **Developer experience**: Less code, fewer bugs, great editor support
- **Standards-based**: OpenAPI, JSON Schema, OAuth2

### Q2: How do you define a GET endpoint that returns a list of items?
```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    id: int
    name: str
    price: float

@app.get("/items", response_model=list[Item])
async def list_items():
    return [{"id": 1, "name": "Widget", "price": 9.99}]
```

### Q3: What is Pydantic and how does FastAPI use it?
Pydantic is a data validation library using Python type hints. FastAPI uses it to:
1. Validate and parse request bodies automatically
2. Serialize response data
3. Generate OpenAPI schema for documentation
4. Provide settings management (`pydantic-settings`)

### Q4: How do you make a query parameter required vs optional?
```python
# Required — no default
@app.get("/search")
def search(q: str): ...

# Optional — has default
@app.get("/items")
def list_items(skip: int = 0, limit: int = 20): ...

# Optional with None
from typing import Optional
@app.get("/filter")
def filter_items(category: Optional[str] = None): ...
```

### Q5: What HTTP status code does FastAPI return for validation errors?
**422 Unprocessable Entity** — automatically returned when Pydantic validation fails. The response body contains detailed error information including which field failed and why.

---

## Intermediate Level

### Q6: Explain FastAPI's dependency injection system.
`Depends()` declares reusable logic injected into route handlers. FastAPI resolves the dependency graph, caches results within a request, and handles cleanup (via `yield`). Common uses: DB sessions, authentication, pagination parameters.

```python
async def get_db():
    async with SessionLocal() as session:
        yield session  # cleanup happens after request

@app.get("/users")
async def list_users(db = Depends(get_db)):
    return await db.execute(select(User))
```

### Q7: What is the difference between `async def` and `def` in FastAPI routes?
- **`async def`**: Runs in the event loop. Non-blocking. Use when making async I/O calls (DB, HTTP, Redis). Correct for most FastAPI routes.
- **`def`**: Runs in a thread pool (FastAPI handles this automatically). Use for CPU-bound or blocking I/O that can't be made async. Don't use `def` with async libraries.

### Q8: How do you handle different response models for the same endpoint?
```python
from fastapi.responses import JSONResponse
from typing import Union

@app.get("/items/{id}", response_model=Union[ItemResponse, ErrorResponse])
async def get_item(id: int):
    item = await db.get(Item, id)
    if not item:
        return JSONResponse(
            status_code=404,
            content={"error": "Not found"}
        )
    return item
```

### Q9: How do you implement pagination in FastAPI?
```python
from fastapi import Query

@app.get("/items")
async def list_items(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: DBSession = Depends()
):
    skip = (page - 1) * size
    total = await db.scalar(select(func.count(Item.id)))
    items = await db.execute(select(Item).offset(skip).limit(size))
    return {
        "items": items.scalars().all(),
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }
```

### Q10: How do you add custom response headers?
```python
from fastapi import Response

@app.get("/items")
async def list_items(response: Response):
    response.headers["X-Total-Count"] = "100"
    response.headers["Cache-Control"] = "max-age=300"
    return items
```

---

## Advanced Level

### Q11: How do you implement JWT authentication in FastAPI?
Full flow:
1. User POSTs credentials to `/auth/token`
2. Verify against DB, create JWT with `python-jose`
3. Return `{access_token, token_type: "bearer"}`
4. Client sends `Authorization: Bearer <token>` on subsequent requests
5. `get_current_user` dependency decodes and validates token on every protected route

Key: use `OAuth2PasswordBearer` for Swagger UI integration, short-lived access tokens (15-60 min), longer refresh tokens (7 days).

### Q12: How do you handle database transactions in FastAPI?
```python
# The get_db dependency handles transactions automatically:
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()    # Commit on success
        except Exception:
            await session.rollback()  # Rollback on error
            raise

# For explicit transactions:
async def transfer_funds(from_id: int, to_id: int, amount: float, db: AsyncSession):
    async with db.begin():  # Explicit transaction
        from_account = await db.get(Account, from_id, with_for_update=True)
        to_account = await db.get(Account, to_id, with_for_update=True)
        from_account.balance -= amount
        to_account.balance += amount
        # Commits automatically at end of `async with db.begin()`
```

### Q13: How do you test FastAPI applications?
```python
# Use httpx.AsyncClient with ASGITransport (no server needed)
# Override dependencies with test versions
# Use in-memory SQLite for test DB
# Roll back after each test

async def test_create_user(client: AsyncClient):
    response = await client.post("/users", json={...})
    assert response.status_code == 201
```

### Q14: How do you implement background tasks vs Celery?
**BackgroundTasks**: Runs after response is sent, in the same process/event loop. Good for: sending emails, updating caches, logging. Not for: CPU-intensive work, tasks > a few seconds.
**Celery**: Separate worker processes. Good for: video processing, report generation, scheduled tasks, retry logic. Requires Redis/RabbitMQ as broker.

### Q15: How do you handle N+1 queries in FastAPI + SQLAlchemy?
```python
# BAD: N+1 — 1 query for users + N queries for each user's posts
users = await db.execute(select(User))
for user in users.scalars():
    posts = user.posts  # Triggers a new query each time!

# GOOD: selectinload — 2 queries total
users = await db.execute(
    select(User).options(selectinload(User.posts))
)
```

---

## Scenario-Based Questions

### Q16: Design a rate-limited API endpoint
```python
# Redis-based rate limiting (works across multiple instances)
async def rate_limit(
    request: Request,
    cache: Cache,
    limit: int = 100,
    window: int = 60
):
    key = f"rate:{request.client.host}:{request.url.path}"
    count = await cache.incr(key)
    if count == 1:
        await cache.expire(key, window)
    if count > limit:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(window)}
        )
```

### Q17: How would you implement soft delete?
```python
class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

# Filter out deleted records in all queries
select(User).where(User.deleted_at.is_(None))

# Soft delete
user.deleted_at = datetime.now(timezone.utc)
await db.commit()
```

### Q18: How do you implement API versioning?
```python
# Option 1: URL prefix (most common)
app.include_router(v1_router, prefix="/api/v1")
app.include_router(v2_router, prefix="/api/v2")

# Option 2: Header-based
@app.get("/users")
async def get_users(api_version: str = Header(default="v1")):
    if api_version == "v2":
        return v2_response()
    return v1_response()

# Option 3: Separate apps mounted
from fastapi import FastAPI
v1 = FastAPI()
v2 = FastAPI()
app = FastAPI()
app.mount("/v1", v1)
app.mount("/v2", v2)
```

---

## Quick Reference

| Topic | Key Points |
|-------|-----------|
| Path params | `{id}` in path, type-validated automatically |
| Query params | After `?`, optional with defaults |
| Request body | Pydantic model, auto-validated |
| Response model | Filters response fields, generates docs |
| Dependencies | `Depends()` — reusable, cached, with cleanup |
| Auth | `OAuth2PasswordBearer` + JWT + `Depends` |
| DB | SQLAlchemy async + `yield` dependency |
| Testing | `AsyncClient` + `dependency_overrides` |
| Middleware | `BaseHTTPMiddleware` — wraps all requests |
| Background | `BackgroundTasks` — runs after response |
| WebSockets | `WebSocket` parameter + `accept()` + loop |
| Files | `UploadFile` — validate MIME, size |
| Caching | Redis + `get/setex` in routes |
| Deployment | Gunicorn + Uvicorn workers + Nginx |
