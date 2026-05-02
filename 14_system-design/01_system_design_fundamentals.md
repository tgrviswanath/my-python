# System Design Fundamentals for Python Engineers

## What is System Design?

System design is the process of defining the architecture, components, modules, interfaces, and data flow of a system to satisfy specified requirements. For Python engineers, this means designing scalable, maintainable, and reliable backend systems.

---

## Core Concepts

### Scalability

```
Vertical Scaling (Scale Up):
  Add more CPU/RAM to one machine
  Pros: Simple, no code changes
  Cons: Hardware limits, single point of failure
  Example: Upgrade from 8GB → 64GB RAM

Horizontal Scaling (Scale Out):
  Add more machines
  Pros: Unlimited scale, fault tolerant
  Cons: Requires stateless design, distributed complexity
  Example: 1 server → 10 servers behind load balancer
```

### CAP Theorem

```
Every distributed system can guarantee only 2 of 3:

  Consistency:   Every read gets the latest write
  Availability:  Every request gets a response
  Partition Tolerance: System works despite network failures

Real-world choices:
  CP (Consistent + Partition Tolerant): HBase, Zookeeper, MongoDB
  AP (Available + Partition Tolerant):  Cassandra, CouchDB, DynamoDB
  CA (Consistent + Available):          Single-node PostgreSQL (no partitions)
```

### ACID vs BASE

```
ACID (Relational DBs):              BASE (NoSQL):
  Atomicity                           Basically Available
  Consistency                         Soft state
  Isolation                           Eventually consistent
  Durability

Use ACID for: financial transactions, inventory
Use BASE for: social feeds, analytics, caching
```

---

## Key Components

### Load Balancer

```
Client → Load Balancer → [Server 1, Server 2, Server 3]

Algorithms:
  Round Robin:       Rotate through servers equally
  Least Connections: Route to server with fewest active connections
  IP Hash:           Same client → same server (sticky sessions)
  Weighted:          More traffic to more powerful servers

Python implementation (nginx upstream):
  upstream myapp {
      server 127.0.0.1:8001 weight=3;
      server 127.0.0.1:8002 weight=1;
  }
```

### Caching

```python
# Cache-Aside Pattern (most common)
import redis
import json

cache = redis.Redis(host='localhost', port=6379)

def get_user(user_id: int) -> dict:
    cache_key = f"user:{user_id}"

    # 1. Check cache
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    # 2. Cache miss → query DB
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)

    # 3. Store in cache with TTL
    cache.setex(cache_key, 300, json.dumps(user))  # 5 min TTL
    return user

def update_user(user_id: int, data: dict):
    db.execute("UPDATE users SET ... WHERE id = %s", user_id)
    cache.delete(f"user:{user_id}")  # Invalidate cache
```

### Message Queues

```python
# Producer-Consumer pattern with Redis Queue
import redis
import json
from datetime import datetime

r = redis.Redis()

# Producer: add jobs to queue
def enqueue_email(to: str, subject: str, body: str):
    job = {"to": to, "subject": subject, "body": body,
           "created_at": datetime.utcnow().isoformat()}
    r.lpush("email_queue", json.dumps(job))

# Consumer: process jobs from queue
def process_emails():
    while True:
        _, job_data = r.brpop("email_queue", timeout=5)
        if job_data:
            job = json.loads(job_data)
            send_email(job["to"], job["subject"], job["body"])
```

---

## Design Patterns for Python Systems

### Repository Pattern

```python
from abc import ABC, abstractmethod
from typing import Optional, List

class UserRepository(ABC):
    @abstractmethod
    def get_by_id(self, user_id: int) -> Optional[dict]: ...
    @abstractmethod
    def create(self, user: dict) -> dict: ...
    @abstractmethod
    def update(self, user_id: int, data: dict) -> dict: ...
    @abstractmethod
    def delete(self, user_id: int) -> bool: ...

class PostgresUserRepository(UserRepository):
    def __init__(self, db_connection):
        self.db = db_connection

    def get_by_id(self, user_id: int) -> Optional[dict]:
        return self.db.execute(
            "SELECT * FROM users WHERE id = %s", (user_id,)
        ).fetchone()

    def create(self, user: dict) -> dict:
        result = self.db.execute(
            "INSERT INTO users (name, email) VALUES (%s, %s) RETURNING *",
            (user["name"], user["email"])
        )
        return result.fetchone()

# Easy to swap implementations (e.g., for testing)
class InMemoryUserRepository(UserRepository):
    def __init__(self):
        self._store = {}
        self._next_id = 1

    def get_by_id(self, user_id: int) -> Optional[dict]:
        return self._store.get(user_id)

    def create(self, user: dict) -> dict:
        user["id"] = self._next_id
        self._store[self._next_id] = user
        self._next_id += 1
        return user
```

### Service Layer Pattern

```python
# Separates business logic from HTTP/DB concerns
class UserService:
    def __init__(self, repo: UserRepository, cache: redis.Redis,
                 email_service: EmailService):
        self.repo = repo
        self.cache = cache
        self.email = email_service

    def register(self, name: str, email: str, password: str) -> dict:
        # Business logic here, not in route handler
        if self.repo.get_by_email(email):
            raise ValueError("Email already registered")

        hashed = hash_password(password)
        user = self.repo.create({"name": name, "email": email,
                                  "password": hashed})
        self.email.send_welcome(email, name)
        return user

    def get_profile(self, user_id: int) -> dict:
        cache_key = f"profile:{user_id}"
        cached = self.cache.get(cache_key)
        if cached:
            return json.loads(cached)

        user = self.repo.get_by_id(user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")

        self.cache.setex(cache_key, 300, json.dumps(user))
        return user
```

---

## Designing a URL Shortener (Classic Interview Question)

```
Requirements:
  - Shorten long URLs to short codes (e.g., bit.ly/abc123)
  - Redirect short URL to original
  - 100M URLs/day write, 1B reads/day
  - URLs expire after 1 year

Estimation:
  Writes: 100M/day = 1,157/sec
  Reads:  1B/day   = 11,574/sec (read-heavy)
  Storage: 100M × 500 bytes = 50GB/day

Architecture:
  Client → CDN → Load Balancer → API Servers → Cache (Redis)
                                              → DB (PostgreSQL)

Short code generation:
  Option 1: MD5(long_url)[:7]  — deterministic, collision risk
  Option 2: Base62(auto_increment_id)  — unique, predictable
  Option 3: Random 7-char Base62  — unpredictable, need uniqueness check

Database schema:
  CREATE TABLE urls (
      id          BIGSERIAL PRIMARY KEY,
      short_code  VARCHAR(10) UNIQUE NOT NULL,
      long_url    TEXT NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW(),
      expires_at  TIMESTAMP,
      click_count BIGINT DEFAULT 0
  );
  CREATE INDEX idx_short_code ON urls(short_code);
```

```python
import hashlib
import string
import random

BASE62 = string.ascii_letters + string.digits  # 62 chars

def encode_base62(num: int) -> str:
    """Convert integer to base62 string."""
    if num == 0:
        return BASE62[0]
    result = []
    while num:
        result.append(BASE62[num % 62])
        num //= 62
    return ''.join(reversed(result))

def shorten_url(long_url: str, db, cache) -> str:
    # Check if already shortened
    existing = db.get_by_long_url(long_url)
    if existing:
        return existing["short_code"]

    # Generate unique short code
    record = db.create({"long_url": long_url})
    short_code = encode_base62(record["id"])
    db.update(record["id"], {"short_code": short_code})

    # Cache for fast reads
    cache.setex(f"url:{short_code}", 86400, long_url)
    return short_code

def redirect(short_code: str, db, cache) -> str:
    # Check cache first
    long_url = cache.get(f"url:{short_code}")
    if long_url:
        return long_url.decode()

    # Cache miss → DB
    record = db.get_by_short_code(short_code)
    if not record:
        raise NotFoundError("URL not found")

    cache.setex(f"url:{short_code}", 86400, record["long_url"])
    return record["long_url"]
```

---

## Interview Q&A

### Q1: How do you design a rate limiter in Python?
```python
import redis
import time

class RateLimiter:
    """Token bucket rate limiter using Redis."""
    def __init__(self, redis_client, limit: int, window: int):
        self.redis = redis_client
        self.limit = limit    # Max requests
        self.window = window  # Time window in seconds

    def is_allowed(self, identifier: str) -> bool:
        key = f"rate_limit:{identifier}"
        pipe = self.redis.pipeline()
        now = time.time()
        window_start = now - self.window

        pipe.zremrangebyscore(key, 0, window_start)  # Remove old entries
        pipe.zcard(key)                               # Count current
        pipe.zadd(key, {str(now): now})               # Add current request
        pipe.expire(key, self.window)
        results = pipe.execute()

        request_count = results[1]
        return request_count < self.limit
```

### Q2: How do you handle database connection pooling in Python?
Use SQLAlchemy's connection pool. Key settings: `pool_size` (persistent connections), `max_overflow` (extra connections under load), `pool_pre_ping` (verify connections before use). For async: use `asyncpg` with `asyncpg.create_pool()`. Never create a new connection per request — always use a pool.

### Q3: What is the difference between synchronous and asynchronous Python for web services?
**Sync (Flask/Django)**: One thread per request. Simple but blocks on I/O. Scale by adding threads/processes. Good for CPU-bound or simple apps.
**Async (FastAPI/aiohttp)**: Single thread handles many requests via event loop. Non-blocking I/O. Excellent for I/O-bound workloads (DB queries, HTTP calls). 10-100x more concurrent connections per server.
