# FastAPI — Production Deployment & Best Practices

## Docker Setup

```dockerfile
# Dockerfile
FROM python:3.12-slim

# Security: run as non-root
RUN addgroup --system app && adduser --system --group app

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=app:app . .

USER app

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

# Production: Gunicorn + Uvicorn workers
CMD ["gunicorn", "app.main:app",
     "--workers", "4",
     "--worker-class", "uvicorn.workers.UvicornWorker",
     "--bind", "0.0.0.0:8000",
     "--timeout", "120",
     "--keepalive", "5",
     "--access-logfile", "-",
     "--error-logfile", "-"]
```

```yaml
# docker-compose.yml
version: "3.9"

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/mydb
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=false
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## Nginx Configuration

```nginx
# nginx.conf
upstream api {
    server api:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name myapi.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name myapi.com;

    ssl_certificate     /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
        client_max_body_size 10M;
    }

    location /ws/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

---

## Structured Logging

```python
# app/logging_config.py
import logging
import json
import sys
from datetime import datetime, timezone

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        return json.dumps(log_data)

def setup_logging(level: str = "INFO"):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    root_logger.handlers = [handler]

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
```

---

## Health Check Endpoint

```python
from fastapi import FastAPI
from sqlalchemy import text
import redis.asyncio as redis

@app.get("/health", tags=["health"])
async def health_check(request: Request):
    checks = {}
    status = "healthy"

    # Database check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
        status = "unhealthy"

    # Redis check
    try:
        r = request.app.state.redis
        await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"
        # Redis failure might be non-critical

    return {
        "status": status,
        "checks": checks,
        "version": app.version
    }

@app.get("/ready", tags=["health"])
async def readiness_check():
    """Kubernetes readiness probe — is app ready to serve traffic?"""
    return {"status": "ready"}

@app.get("/live", tags=["health"])
async def liveness_check():
    """Kubernetes liveness probe — is app alive?"""
    return {"status": "alive"}
```

---

## Performance Best Practices

```python
# 1. Use async everywhere for I/O
@app.get("/data")
async def get_data(db: DBSession):          # ✅ async
    return await db.execute(select(Item))   # ✅ async query

# 2. Connection pooling — already handled by SQLAlchemy engine
# pool_size=10, max_overflow=20

# 3. Select only needed columns
result = await db.execute(
    select(User.id, User.username, User.email)  # ✅ not select(User)
    .where(User.is_active == True)
)

# 4. Use indexes on frequently queried columns
class User(Base):
    email: Mapped[str] = mapped_column(String(255), index=True)  # ✅

# 5. Avoid N+1 — use selectinload
result = await db.execute(
    select(User).options(selectinload(User.posts))  # ✅ 2 queries
)

# 6. Cache expensive queries
@app.get("/stats")
async def get_stats(cache: Cache, db: DBSession):
    cached = await cache.get("global_stats")
    if cached:
        return json.loads(cached)
    stats = await compute_expensive_stats(db)
    await cache.setex("global_stats", 60, json.dumps(stats))
    return stats

# 7. Use response_model_exclude_unset to reduce payload size
@app.get("/users/{id}", response_model=UserResponse)
async def get_user(id: int, db: DBSession):
    return await db.get(User, id)
```

---

## Security Checklist

```python
# ✅ 1. HTTPS only (enforced by Nginx)
# ✅ 2. CORS configured with specific origins
# ✅ 3. Rate limiting (Nginx + middleware)
# ✅ 4. Input validation (Pydantic)
# ✅ 5. SQL injection prevention (SQLAlchemy ORM)
# ✅ 6. JWT with short expiry
# ✅ 7. Passwords hashed with bcrypt
# ✅ 8. Secrets in environment variables, not code
# ✅ 9. File upload validation (MIME type, size)
# ✅ 10. Security headers (Nginx)

# Disable docs in production
app = FastAPI(
    docs_url=None if not settings.debug else "/docs",
    redoc_url=None if not settings.debug else "/redoc",
    openapi_url=None if not settings.debug else "/openapi.json"
)
```

---

## Interview Q&A

### Q1: How many Gunicorn workers should you use?
Rule of thumb: `(2 × CPU cores) + 1`. For a 4-core machine: 9 workers. Each worker is a separate process with its own event loop. More workers = more memory usage. For I/O-bound FastAPI apps, fewer workers with async is often better than many sync workers.

### Q2: What is the difference between `uvicorn` and `gunicorn -k uvicorn.workers.UvicornWorker`?
**Uvicorn alone**: Single process, single event loop. Good for development. No process management.
**Gunicorn + Uvicorn workers**: Gunicorn manages multiple Uvicorn worker processes. If one worker crashes, Gunicorn restarts it. Multiple processes = true parallelism on multi-core machines. Use in production.

### Q3: How do you handle database migrations in production with zero downtime?
1. Write backward-compatible migrations (add columns, don't rename/delete)
2. Deploy in phases: (1) deploy code that works with old AND new schema, (2) run migration, (3) deploy code that uses new schema only
3. Use Alembic with `--autogenerate` to detect changes
4. Test migrations on a copy of production data
5. Have a rollback migration ready
6. Run migrations as part of deployment, not application startup

### Q4: How do you scale a FastAPI application?
**Vertical**: More CPU/RAM on the server, more Gunicorn workers.
**Horizontal**: Multiple instances behind a load balancer (Nginx, AWS ALB). Requires: stateless app (no in-memory state), shared session store (Redis), shared DB (PostgreSQL), shared file storage (S3).
**Async**: FastAPI's async nature handles thousands of concurrent I/O-bound requests per instance — often more effective than adding instances.
