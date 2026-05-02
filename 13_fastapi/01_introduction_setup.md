# FastAPI — Introduction & Setup

## What is FastAPI?

FastAPI is a modern, high-performance Python web framework for building APIs. It is built on top of **Starlette** (ASGI framework) and **Pydantic** (data validation), and uses Python type hints to generate automatic documentation and validation.

```
FastAPI Stack:
├── Starlette   → ASGI web framework (routing, middleware, WebSockets)
├── Pydantic    → Data validation and serialization via type hints
├── Uvicorn     → ASGI server (production: Gunicorn + Uvicorn workers)
└── Python 3.8+ → Type hints, async/await
```

---

## Why FastAPI?

| Feature | FastAPI | Flask | Django REST |
|---------|---------|-------|-------------|
| Performance | ⭐⭐⭐⭐⭐ (async) | ⭐⭐⭐ (sync) | ⭐⭐⭐ (sync) |
| Auto docs | ✅ Swagger + ReDoc | ❌ manual | ❌ manual |
| Type safety | ✅ Pydantic | ❌ | ❌ |
| Async support | ✅ native | ⚠️ limited | ⚠️ limited |
| Learning curve | Low | Very Low | High |
| Production use | ✅ | ✅ | ✅ |

**Benchmarks**: FastAPI is one of the fastest Python frameworks — comparable to NodeJS and Go for I/O-bound workloads.

---

## Installation & Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/macOS
venv\Scripts\activate           # Windows

# Install FastAPI + server
pip install fastapi uvicorn[standard]

# Install common extras
pip install fastapi[all]        # includes uvicorn, pydantic, email-validator, etc.

# For production
pip install gunicorn

# requirements.txt
fastapi==0.111.0
uvicorn[standard]==0.30.0
pydantic==2.7.0
python-dotenv==1.0.0
```

---

## Your First FastAPI App

```python
# main.py
from fastapi import FastAPI

app = FastAPI(
    title="My API",
    description="A sample FastAPI application",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc UI
    openapi_url="/openapi.json"
)

@app.get("/")
def root():
    return {"message": "Hello, FastAPI!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

```bash
# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run production server
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Access:
# API:      http://localhost:8000
# Swagger:  http://localhost:8000/docs
# ReDoc:    http://localhost:8000/redoc
# OpenAPI:  http://localhost:8000/openapi.json
```

---

## Project Structure (Production)

```
my-api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app instance, startup/shutdown
│   ├── config.py            # Settings via pydantic-settings
│   ├── dependencies.py      # Shared dependencies (DB session, auth)
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   └── user.py
│   ├── schemas/             # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   └── user.py
│   ├── routers/             # APIRouter modules
│   │   ├── __init__.py
│   │   ├── users.py
│   │   └── items.py
│   ├── services/            # Business logic
│   │   └── user_service.py
│   ├── repositories/        # Database access layer
│   │   └── user_repo.py
│   └── middleware/          # Custom middleware
│       └── logging.py
├── tests/
│   ├── conftest.py
│   └── test_users.py
├── alembic/                 # Database migrations
├── .env
├── requirements.txt
└── Dockerfile
```

---

## Configuration with pydantic-settings

```python
# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "My API"
    debug: bool = False
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 30
    allowed_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()          # Cache settings — only reads .env once
def get_settings() -> Settings:
    return Settings()

# .env file
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost/mydb
# SECRET_KEY=your-secret-key-here
# DEBUG=false
```

---

## Application Lifecycle (Startup / Shutdown)

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import engine, Base
from app.routers import users, items

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: runs before the app starts accepting requests
    print("Starting up...")
    await engine.connect()          # Connect to DB
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: runs when the app is shutting down
    print("Shutting down...")
    await engine.dispose()          # Close DB connections

app = FastAPI(lifespan=lifespan)

app.include_router(users.router, prefix="/api/v1")
app.include_router(items.router, prefix="/api/v1")
```

---

## Interview Q&A

### Q1: What makes FastAPI faster than Flask?
FastAPI is built on **Starlette** (ASGI) and supports **async/await** natively. Flask uses WSGI (synchronous), which blocks on I/O. For I/O-bound workloads (DB queries, HTTP calls), async allows handling thousands of concurrent requests with a single thread. FastAPI also uses Pydantic for validation which is implemented in Rust (v2), making it extremely fast.

### Q2: What is ASGI vs WSGI?
**WSGI** (Web Server Gateway Interface): Synchronous. One request per thread. Flask, Django use this.
**ASGI** (Asynchronous Server Gateway Interface): Asynchronous. Handles concurrent requests with async/await. FastAPI, Starlette use this. ASGI also supports WebSockets and HTTP/2.

### Q3: How does FastAPI generate documentation automatically?
FastAPI reads Python type hints and Pydantic models to generate an OpenAPI schema. It then serves Swagger UI (`/docs`) and ReDoc (`/redoc`) from that schema. No extra code needed — just proper type annotations.

### Q4: What is the difference between `uvicorn` and `gunicorn`?
**Uvicorn**: ASGI server, single process. Use for development (`--reload`) or as a worker class.
**Gunicorn**: Process manager. Spawns multiple worker processes. In production: `gunicorn -k uvicorn.workers.UvicornWorker` — Gunicorn manages multiple Uvicorn worker processes for true parallelism.

### Q5: When would you NOT use FastAPI?
- Simple server-side rendered web apps (use Django)
- Heavy ORM/admin panel needs (use Django)
- Team with no async experience (Flask is simpler)
- Legacy codebase already on Flask/Django
