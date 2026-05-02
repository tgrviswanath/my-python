# Scalable Python Architectures

## Microservices vs Monolith

```
Monolith:                          Microservices:
┌──────────────────┐               ┌──────┐ ┌──────┐ ┌──────┐
│   Single App     │               │ Auth │ │Order │ │Email │
│  ├── Auth        │      →        │ Svc  │ │ Svc  │ │ Svc  │
│  ├── Orders      │               └──────┘ └──────┘ └──────┘
│  ├── Payments    │                   ↕         ↕        ↕
│  └── Email       │               ┌──────┐ ┌──────┐
└──────────────────┘               │ Pay  │ │ User │
                                   │ Svc  │ │ Svc  │
                                   └──────┘ └──────┘

When to use Monolith:   Small team, early stage, simple domain
When to use Microservices: Large team, independent scaling needs, clear domain boundaries
```

---

## Event-Driven Architecture with Python

```python
# Using Celery for async task processing
from celery import Celery
from kombu import Queue

app = Celery('tasks', broker='redis://localhost:6379/0',
             backend='redis://localhost:6379/1')

app.conf.task_queues = (
    Queue('high_priority'),
    Queue('default'),
    Queue('low_priority'),
)

@app.task(queue='high_priority', max_retries=3, default_retry_delay=60)
def send_payment_confirmation(order_id: int, email: str):
    try:
        order = get_order(order_id)
        send_email(email, "Payment confirmed", render_template(order))
    except Exception as exc:
        raise send_payment_confirmation.retry(exc=exc)

@app.task(queue='low_priority')
def generate_monthly_report(month: str):
    # Long-running task — runs in background
    data = aggregate_monthly_data(month)
    upload_to_s3(data, f"reports/{month}.pdf")

# Trigger from FastAPI
@router.post("/orders/{order_id}/pay")
async def process_payment(order_id: int, payment: PaymentRequest):
    result = await charge_card(payment)
    if result.success:
        # Don't block the HTTP response — queue the email
        send_payment_confirmation.delay(order_id, payment.email)
        return {"status": "paid"}
```

---

## Designing a Chat System

```
Requirements:
  - Real-time messaging between users
  - Message history
  - Online/offline status
  - 10M daily active users

Architecture:
  Client (WebSocket) → Load Balancer → Chat Servers
                                            ↓
                                       Redis Pub/Sub (fan-out)
                                            ↓
                                       Message Queue (Kafka)
                                            ↓
                                       Message DB (Cassandra)
                                       User DB (PostgreSQL)
```

```python
# FastAPI WebSocket chat server
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import redis.asyncio as redis
import json

app = FastAPI()
r = redis.Redis()

class ConnectionManager:
    def __init__(self):
        # user_id → set of WebSocket connections (multiple devices)
        self.connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, set()).add(ws)
        await r.set(f"online:{user_id}", "1", ex=300)

    async def disconnect(self, user_id: int, ws: WebSocket):
        self.connections.get(user_id, set()).discard(ws)
        if not self.connections.get(user_id):
            await r.delete(f"online:{user_id}")

    async def send_to_user(self, user_id: int, message: dict):
        for ws in self.connections.get(user_id, set()):
            try:
                await ws.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(ws: WebSocket, user_id: int):
    await manager.connect(user_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            recipient_id = data["to"]
            message = {
                "from": user_id,
                "text": data["text"],
                "timestamp": datetime.utcnow().isoformat()
            }
            # Save to DB
            await save_message(user_id, recipient_id, message)
            # Deliver to recipient
            await manager.send_to_user(recipient_id, message)
    except WebSocketDisconnect:
        await manager.disconnect(user_id, ws)
```

---

## Designing a Notification System

```
Requirements:
  - Send push, email, SMS notifications
  - 1M notifications/day
  - Retry on failure
  - User preferences (opt-out per channel)

Architecture:
  API → Notification Service → Router
                                  ├── Email Queue → Email Worker → SendGrid
                                  ├── SMS Queue   → SMS Worker   → Twilio
                                  └── Push Queue  → Push Worker  → FCM/APNs

Key design decisions:
  1. Decouple channels — each has its own queue and worker
  2. Retry with exponential backoff
  3. Dead letter queue for permanently failed notifications
  4. User preference check before sending
  5. Rate limiting per user (don't spam)
```

```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional

class Channel(Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

@dataclass
class Notification:
    user_id: int
    channel: Channel
    title: str
    body: str
    data: Optional[dict] = None

class NotificationRouter:
    def __init__(self, email_svc, sms_svc, push_svc, prefs_repo):
        self.handlers = {
            Channel.EMAIL: email_svc,
            Channel.SMS: sms_svc,
            Channel.PUSH: push_svc,
        }
        self.prefs = prefs_repo

    async def send(self, notification: Notification) -> bool:
        # Check user preferences
        prefs = await self.prefs.get(notification.user_id)
        if not prefs.is_enabled(notification.channel):
            return False  # User opted out

        handler = self.handlers[notification.channel]
        return await handler.send(notification)
```

---

## Performance Optimization Patterns

```python
# 1. Database query optimization
# BAD: N+1 queries
users = db.query("SELECT * FROM users LIMIT 100")
for user in users:
    orders = db.query(f"SELECT * FROM orders WHERE user_id = {user['id']}")

# GOOD: Single JOIN query
users_with_orders = db.query("""
    SELECT u.*, COUNT(o.id) as order_count
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    LIMIT 100
""")

# 2. Async I/O for concurrent operations
import asyncio
import aiohttp

async def fetch_all(urls: list[str]) -> list[dict]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_one(session, url) for url in urls]
        return await asyncio.gather(*tasks)  # All concurrent!

# 3. Generator for memory efficiency
def process_large_file(filepath: str):
    with open(filepath) as f:
        for line in f:  # Reads one line at a time
            yield process_line(line)

# 4. Caching expensive computations
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_exchange_rate(from_currency: str, to_currency: str) -> float:
    return fetch_from_api(from_currency, to_currency)
```

---

## Interview Q&A

### Q1: Design a job scheduler (like cron) in Python
```
Components:
  1. Job Store: PostgreSQL table (job_id, cron_expr, handler, last_run, next_run)
  2. Scheduler Loop: Check every minute for due jobs
  3. Worker Pool: ThreadPoolExecutor for parallel execution
  4. Distributed Lock: Redis SETNX to prevent duplicate runs

Key considerations:
  - Idempotency: jobs must be safe to run twice
  - Missed jobs: what happens if server was down?
  - Long-running jobs: timeout handling
  - Monitoring: track success/failure, duration
```

### Q2: How do you design a Python service for 10,000 concurrent users?
1. **Async framework**: FastAPI + uvicorn (handles 10K+ concurrent connections)
2. **Connection pooling**: asyncpg pool for DB (50-100 connections shared)
3. **Caching**: Redis for hot data (reduce DB load by 80%)
4. **Horizontal scaling**: 4 uvicorn workers × N servers behind nginx
5. **CDN**: Static assets served from edge, not your servers
6. **Background tasks**: Celery for heavy work (don't block HTTP responses)

### Q3: What is the difference between a queue and a pub/sub system?
**Queue**: One producer, one consumer per message. Message deleted after consumption. Use for: task distribution, work queues (Celery, SQS).
**Pub/Sub**: One publisher, many subscribers. Each subscriber gets a copy. Use for: event broadcasting, real-time notifications, fan-out (Redis Pub/Sub, Kafka topics).
