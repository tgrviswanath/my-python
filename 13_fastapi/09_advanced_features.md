# FastAPI — Advanced Features: WebSockets, File Upload, Caching & More

## WebSockets

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Any
import json

app = FastAPI()

# ── Connection Manager ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}  # room → connections

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        self.active.setdefault(room, []).append(websocket)

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active:
            self.active[room].discard(websocket)

    async def send_personal(self, message: Any, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: Any, room: str, exclude: WebSocket = None):
        for ws in self.active.get(room, []):
            if ws != exclude:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

@app.websocket("/ws/{room}/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room: str,
    user_id: int
):
    await manager.connect(websocket, room)
    await manager.broadcast(
        {"type": "join", "user_id": user_id, "room": room},
        room, exclude=websocket
    )
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(
                {"type": "message", "user_id": user_id, "data": data},
                room
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
        await manager.broadcast(
            {"type": "leave", "user_id": user_id},
            room
        )
```

---

## File Upload & Download

```python
from fastapi import UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
import aiofiles
import os
import uuid
import magic  # pip install python-magic

UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "application/pdf"}

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    description: str = Form(default="")
):
    # Validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large (max 10MB)")

    # Validate MIME type (not just extension)
    mime_type = magic.from_buffer(content, mime=True)
    if mime_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"File type not allowed: {mime_type}")

    # Save with unique name
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    return {
        "filename": filename,
        "original_name": file.filename,
        "size": len(content),
        "mime_type": mime_type,
        "description": description
    }

# Multiple files
@app.post("/upload-multiple")
async def upload_multiple(files: list[UploadFile] = File(...)):
    results = []
    for file in files:
        content = await file.read()
        filename = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
        async with aiofiles.open(f"uploads/{filename}", "wb") as f:
            await f.write(content)
        results.append({"filename": filename, "size": len(content)})
    return results

# File download
@app.get("/download/{filename}")
async def download_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "File not found")
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/octet-stream"
    )

# Streaming large files
@app.get("/stream/{filename}")
async def stream_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)

    async def file_generator():
        async with aiofiles.open(filepath, "rb") as f:
            while chunk := await f.read(65536):  # 64KB chunks
                yield chunk

    return StreamingResponse(
        file_generator(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

---

## Caching with Redis

```python
import redis.asyncio as redis
import json
import hashlib
from functools import wraps
from typing import Callable, Any

# ── Cache dependency ──────────────────────────────────────────────────────────
async def get_cache(request: Request) -> redis.Redis:
    return request.app.state.redis

Cache = Annotated[redis.Redis, Depends(get_cache)]

# ── Cache decorator ───────────────────────────────────────────────────────────
def cache_response(ttl: int = 300, key_prefix: str = ""):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from function name + args
            cache_key = f"{key_prefix}{func.__name__}:{hashlib.md5(str(kwargs).encode()).hexdigest()}"

            # Try cache
            r = kwargs.get("cache") or kwargs.get("redis")
            if r:
                cached = await r.get(cache_key)
                if cached:
                    return json.loads(cached)

            # Cache miss
            result = await func(*args, **kwargs)

            # Store in cache
            if r and result is not None:
                await r.setex(cache_key, ttl, json.dumps(result, default=str))

            return result
        return wrapper
    return decorator

# ── Manual caching in routes ──────────────────────────────────────────────────
@app.get("/products/{product_id}")
async def get_product(
    product_id: int,
    db: DBSession,
    cache: Cache
):
    cache_key = f"product:{product_id}"

    # Try cache first
    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    # DB query
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    result = ProductResponse.model_validate(product).model_dump()

    # Cache for 5 minutes
    await cache.setex(cache_key, 300, json.dumps(result, default=str))
    return result

# Invalidate cache on update
@app.put("/products/{product_id}")
async def update_product(
    product_id: int,
    data: ProductUpdate,
    db: DBSession,
    cache: Cache
):
    product = await ProductService(db).update(product_id, data)
    await cache.delete(f"product:{product_id}")  # Invalidate
    return product
```

---

## Pagination with Cursor-Based Approach

```python
from pydantic import BaseModel
from typing import Generic, TypeVar
import base64

T = TypeVar("T")

class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None
    has_more: bool
    total: int | None = None

def encode_cursor(value: Any) -> str:
    return base64.b64encode(str(value).encode()).decode()

def decode_cursor(cursor: str) -> str:
    return base64.b64decode(cursor.encode()).decode()

@app.get("/posts", response_model=CursorPage[PostResponse])
async def list_posts(
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: DBSession = Depends()
):
    query = select(Post).order_by(Post.created_at.desc()).limit(limit + 1)

    if cursor:
        cursor_value = decode_cursor(cursor)
        query = query.where(Post.created_at < cursor_value)

    result = await db.execute(query)
    posts = list(result.scalars().all())

    has_more = len(posts) > limit
    if has_more:
        posts = posts[:limit]

    next_cursor = encode_cursor(posts[-1].created_at) if has_more else None

    return CursorPage(
        items=[PostResponse.model_validate(p) for p in posts],
        next_cursor=next_cursor,
        has_more=has_more
    )
```

---

## Server-Sent Events (SSE)

```python
from fastapi.responses import StreamingResponse
import asyncio

@app.get("/events/{user_id}")
async def event_stream(user_id: int, request: Request):
    async def generate():
        while True:
            if await request.is_disconnected():
                break

            # Check for new events
            events = await get_user_events(user_id)
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"

            await asyncio.sleep(1)  # Poll every second

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
```

---

## Interview Q&A

### Q1: How do WebSockets work in FastAPI?
FastAPI uses Starlette's WebSocket support. The route accepts a `WebSocket` parameter, calls `await websocket.accept()` to upgrade the HTTP connection, then enters a loop receiving/sending messages. Use a `ConnectionManager` class to track active connections and broadcast to rooms. Handle `WebSocketDisconnect` exception for cleanup.

### Q2: How do you validate file uploads securely?
Never trust the file extension or `Content-Type` header — both can be spoofed. Use `python-magic` to detect the actual MIME type from file content (magic bytes). Also validate: file size (prevent DoS), filename (sanitize to prevent path traversal), scan for malware in production. Store files outside the web root or in S3, never serve them directly from the upload path.

### Q3: What is the difference between offset pagination and cursor pagination?
**Offset**: `LIMIT 20 OFFSET 40`. Simple but slow on large datasets (DB must scan all skipped rows). Inconsistent if data changes between pages (items shift).
**Cursor**: Uses a stable value (timestamp, ID) as a bookmark. `WHERE created_at < cursor LIMIT 20`. Consistent even if data changes. Efficient (uses index). Can't jump to arbitrary pages. Best for infinite scroll, feeds, real-time data.

### Q4: How do you implement rate limiting in FastAPI?
Options: (1) **Middleware** — track requests per IP in memory (simple, not distributed), (2) **Redis** — store request counts in Redis with TTL (works across multiple instances), (3) **slowapi** library — decorator-based rate limiting with Redis backend. For production, use Redis-based rate limiting so limits are shared across all API instances.
