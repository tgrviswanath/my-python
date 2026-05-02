# FastAPI — Middleware, Error Handling & Background Tasks

## Custom Middleware

```python
import time
import uuid
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
import logging

logger = logging.getLogger(__name__)
app = FastAPI()

# ── CORS Middleware ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://myapp.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
    max_age=600
)

# ── Request ID + Timing Middleware ────────────────────────────────────────────
class RequestMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Assign unique request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        start_time = time.perf_counter()

        # Log incoming request
        logger.info(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else "unknown"
            }
        )

        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"Unhandled exception: {e}", extra={"request_id": request_id})
            raise

        process_time = (time.perf_counter() - start_time) * 1000

        # Add headers to response
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

        logger.info(
            "Request completed",
            extra={
                "request_id": request_id,
                "status_code": response.status_code,
                "duration_ms": round(process_time, 2)
            }
        )
        return response

app.add_middleware(RequestMiddleware)

# ── Rate Limiting Middleware ───────────────────────────────────────────────────
from collections import defaultdict
import asyncio

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls: int = 100, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        async with self._lock:
            # Remove old requests outside the window
            self._requests[client_ip] = [
                t for t in self._requests[client_ip]
                if now - t < self.period
            ]

            if len(self._requests[client_ip]) >= self.calls:
                return Response(
                    content='{"detail": "Rate limit exceeded"}',
                    status_code=429,
                    headers={
                        "Content-Type": "application/json",
                        "Retry-After": str(self.period)
                    }
                )

            self._requests[client_ip].append(now)

        return await call_next(request)

app.add_middleware(RateLimitMiddleware, calls=100, period=60)
```

---

## Exception Handling

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
import traceback

app = FastAPI()

# ── Custom Exception Classes ──────────────────────────────────────────────────
class AppException(Exception):
    def __init__(self, status_code: int, detail: str, code: str = None):
        self.status_code = status_code
        self.detail = detail
        self.code = code or f"ERROR_{status_code}"

class NotFoundError(AppException):
    def __init__(self, resource: str, id: int | str):
        super().__init__(404, f"{resource} with id '{id}' not found", "NOT_FOUND")

class ConflictError(AppException):
    def __init__(self, detail: str):
        super().__init__(409, detail, "CONFLICT")

class ForbiddenError(AppException):
    def __init__(self, detail: str = "Access denied"):
        super().__init__(403, detail, "FORBIDDEN")

# ── Exception Handlers ────────────────────────────────────────────────────────
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.detail,
                "request_id": getattr(request.state, "request_id", None)
            }
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = " → ".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": errors
            }
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail
            }
        },
        headers=exc.headers
    )

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={
            "error": {
                "code": "CONFLICT",
                "message": "Resource already exists or constraint violated"
            }
        }
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception: {exc}",
        extra={"traceback": traceback.format_exc()}
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred"
            }
        }
    )

# ── Usage in routes ───────────────────────────────────────────────────────────
@app.get("/users/{user_id}")
async def get_user(user_id: int, db: DBSession):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User", user_id)
    return user
```

---

## Background Tasks

```python
from fastapi import BackgroundTasks
import asyncio

# ── Simple Background Tasks ───────────────────────────────────────────────────
def send_welcome_email(email: str, username: str):
    """Runs after response is sent — doesn't block the response"""
    # email_client.send(to=email, subject="Welcome!", body=f"Hi {username}!")
    print(f"Sending welcome email to {email}")

async def update_user_stats(user_id: int):
    """Async background task"""
    await asyncio.sleep(0.1)  # Simulate async work
    print(f"Updated stats for user {user_id}")

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: DBSession
):
    user = await UserService(db).create(user_data)

    # These run AFTER the response is sent
    background_tasks.add_task(send_welcome_email, user.email, user.username)
    background_tasks.add_task(update_user_stats, user.id)

    return user  # Response sent immediately

# ── Celery for Heavy Background Work ─────────────────────────────────────────
# For CPU-intensive or long-running tasks, use Celery + Redis/RabbitMQ
# pip install celery redis

# celery_app.py
from celery import Celery

celery = Celery(
    "tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1"
)

@celery.task
def process_video(video_id: int):
    # Long-running task — runs in separate worker process
    pass

# In FastAPI route
@app.post("/videos/{video_id}/process")
async def trigger_processing(video_id: int):
    task = process_video.delay(video_id)
    return {"task_id": task.id, "status": "queued"}

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = celery.AsyncResult(task_id)
    return {"task_id": task_id, "status": task.status, "result": task.result}
```

---

## Lifespan Events (Startup/Shutdown)

```python
from contextlib import asynccontextmanager
import redis.asyncio as redis

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    print("Starting application...")

    # Initialize Redis connection pool
    app.state.redis = redis.Redis(
        host="localhost", port=6379,
        decode_responses=True,
        max_connections=20
    )

    # Warm up DB connection pool
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    print("Application ready")
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("Shutting down...")
    await app.state.redis.aclose()
    await engine.dispose()
    print("Shutdown complete")

app = FastAPI(lifespan=lifespan)
```

---

## Interview Q&A

### Q1: What is the difference between middleware and dependencies?
**Middleware**: Wraps every request/response. Runs before routing. Use for: logging, CORS, rate limiting, request ID injection, timing. Can't access route-specific info easily.
**Dependencies**: Injected into specific routes. Runs after routing. Use for: auth, DB sessions, pagination, route-specific logic. Has access to path/query params.

### Q2: How do background tasks work in FastAPI?
`BackgroundTasks` runs functions after the HTTP response is sent. The client gets the response immediately; the task runs in the same process/event loop. Good for: sending emails, updating caches, logging. Not good for: CPU-intensive work (blocks event loop), tasks that take minutes (use Celery instead).

### Q3: What is the order of middleware execution?
Middleware executes in reverse order of registration (last added = first executed). For a request: Middleware 3 → Middleware 2 → Middleware 1 → Route Handler. For a response: Route Handler → Middleware 1 → Middleware 2 → Middleware 3. Add middleware in order from least to most specific.

### Q4: How do you handle database integrity errors gracefully?
Register an exception handler for `sqlalchemy.exc.IntegrityError`. This catches unique constraint violations, foreign key violations, etc. Return a 409 Conflict with a user-friendly message. Don't expose raw SQL error messages to clients — they may contain sensitive schema information.
