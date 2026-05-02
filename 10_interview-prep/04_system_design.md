# Interview Prep — System Design (Python-Focused)

## SD1: Design a URL Shortener

### Requirements
- Shorten long URLs to short codes (e.g. `https://short.ly/abc123`)
- Redirect short → long
- Track click counts
- Handle 100M URLs, 10K req/s

### Python Implementation (Core Logic)

```python
import hashlib
import string
import random
from dataclasses import dataclass, field
from datetime import datetime

BASE62 = string.ascii_letters + string.digits  # 62 chars

@dataclass
class URLRecord:
    short_code: str
    long_url: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    clicks: int = 0

class URLShortener:
    def __init__(self):
        self._short_to_long: dict[str, URLRecord] = {}
        self._long_to_short: dict[str, str] = {}

    def _generate_code(self, url: str, length: int = 6) -> str:
        # Hash-based: deterministic for same URL
        hash_val = int(hashlib.md5(url.encode()).hexdigest(), 16)
        code = []
        while hash_val and len(code) < length:
            code.append(BASE62[hash_val % 62])
            hash_val //= 62
        return ''.join(code).ljust(length, BASE62[0])

    def shorten(self, long_url: str) -> str:
        if long_url in self._long_to_short:
            return self._long_to_short[long_url]
        code = self._generate_code(long_url)
        # Handle collision
        while code in self._short_to_long:
            code = ''.join(random.choices(BASE62, k=6))
        record = URLRecord(short_code=code, long_url=long_url)
        self._short_to_long[code] = record
        self._long_to_short[long_url] = code
        return code

    def resolve(self, code: str) -> str | None:
        record = self._short_to_long.get(code)
        if record:
            record.clicks += 1
            return record.long_url
        return None

    def stats(self, code: str) -> dict | None:
        record = self._short_to_long.get(code)
        if record:
            return {'code': code, 'url': record.long_url, 'clicks': record.clicks}
        return None

shortener = URLShortener()
code = shortener.shorten('https://www.example.com/very/long/url?param=value')
print(f'Short code: {code}')
print(f'Resolves to: {shortener.resolve(code)}')
shortener.resolve(code)
print(f'Stats: {shortener.stats(code)}')
```

### Scaling Considerations
- **Storage**: Redis for hot URLs, PostgreSQL for persistence
- **Collision**: Use counter-based ID → Base62 encode (no collision)
- **Read-heavy**: Cache in Redis with TTL
- **Rate limiting**: Sliding window per IP
- **Analytics**: Async write to Kafka → ClickHouse

---

## SD2: Design a Cache System

```python
import time
import threading
from dataclasses import dataclass, field
from typing import Any, Optional

@dataclass
class CacheEntry:
    value: Any
    expires_at: float | None  # None = no expiry
    hits: int = 0

    @property
    def is_expired(self) -> bool:
        return self.expires_at is not None and time.time() > self.expires_at

class TTLCache:
    """Thread-safe TTL cache with LRU eviction."""

    def __init__(self, max_size: int = 1000, default_ttl: float = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._store: dict[str, CacheEntry] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if entry.is_expired:
                del self._store[key]
                return None
            entry.hits += 1
            return entry.value

    def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        with self._lock:
            if len(self._store) >= self.max_size:
                self._evict()
            expires_at = time.time() + (ttl or self.default_ttl)
            self._store[key] = CacheEntry(value=value, expires_at=expires_at)

    def delete(self, key: str) -> bool:
        with self._lock:
            return self._store.pop(key, None) is not None

    def _evict(self) -> None:
        # Remove expired first
        expired = [k for k, v in self._store.items() if v.is_expired]
        for k in expired:
            del self._store[k]
        # If still full, remove least-hit
        if len(self._store) >= self.max_size:
            lru_key = min(self._store, key=lambda k: self._store[k].hits)
            del self._store[lru_key]

    def stats(self) -> dict:
        with self._lock:
            return {
                'size': len(self._store),
                'max_size': self.max_size,
                'hit_rate': sum(e.hits for e in self._store.values()),
            }

cache = TTLCache(max_size=100, default_ttl=60)
cache.set('user:1', {'name': 'Alice', 'age': 30})
cache.set('user:2', {'name': 'Bob'}, ttl=5)
print(cache.get('user:1'))
print(cache.stats())
```

---

## SD3: Design a Message Queue

```python
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable, Awaitable

class MessageStatus(str, Enum):
    PENDING    = 'pending'
    PROCESSING = 'processing'
    DONE       = 'done'
    FAILED     = 'failed'

@dataclass
class Message:
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    topic: str = ''
    payload: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: MessageStatus = MessageStatus.PENDING
    retries: int = 0
    max_retries: int = 3

class MessageQueue:
    def __init__(self):
        self._topics: dict[str, asyncio.Queue] = {}
        self._handlers: dict[str, list[Callable]] = {}
        self._messages: dict[str, Message] = {}

    def create_topic(self, topic: str, max_size: int = 0) -> None:
        if topic not in self._topics:
            self._topics[topic] = asyncio.Queue(maxsize=max_size)

    async def publish(self, topic: str, payload: dict) -> Message:
        if topic not in self._topics:
            self.create_topic(topic)
        msg = Message(topic=topic, payload=payload)
        self._messages[msg.id] = msg
        await self._topics[topic].put(msg)
        return msg

    def subscribe(self, topic: str, handler: Callable) -> None:
        if topic not in self._handlers:
            self._handlers[topic] = []
        self._handlers[topic].append(handler)

    async def consume(self, topic: str, num_workers: int = 1) -> None:
        if topic not in self._topics:
            return
        workers = [self._worker(topic) for _ in range(num_workers)]
        await asyncio.gather(*workers)

    async def _worker(self, topic: str) -> None:
        queue = self._topics[topic]
        handlers = self._handlers.get(topic, [])
        while True:
            msg = await queue.get()
            msg.status = MessageStatus.PROCESSING
            try:
                for handler in handlers:
                    await handler(msg)
                msg.status = MessageStatus.DONE
            except Exception as e:
                msg.retries += 1
                if msg.retries < msg.max_retries:
                    msg.status = MessageStatus.PENDING
                    await queue.put(msg)
                else:
                    msg.status = MessageStatus.FAILED
            finally:
                queue.task_done()

# Demo
async def demo():
    mq = MessageQueue()
    mq.create_topic('orders')

    processed = []

    async def order_handler(msg: Message):
        print(f'Processing order: {msg.payload}')
        processed.append(msg.id)

    mq.subscribe('orders', order_handler)

    # Publish messages
    for i in range(3):
        await mq.publish('orders', {'order_id': i, 'amount': (i+1)*10})

    # Consume with timeout
    try:
        await asyncio.wait_for(mq.consume('orders'), timeout=1.0)
    except asyncio.TimeoutError:
        pass

    print(f'Processed {len(processed)} orders')

asyncio.run(demo())
```

---

## Behavioral Questions

### B1: Tell me about a time you optimized Python code for performance.
**Framework: STAR (Situation, Task, Action, Result)**

*Example answer structure:*
- **Situation**: Data pipeline processing 10M records took 4 hours
- **Task**: Reduce to under 30 minutes
- **Action**: Profiled with cProfile → found O(n²) nested loop. Replaced with dict lookup. Added `__slots__`. Used `multiprocessing.Pool` for CPU-bound transforms. Switched string concatenation to `join()`.
- **Result**: Reduced to 18 minutes (13x speedup)

### B2: How do you handle technical debt in Python projects?
- Prioritize by impact: security > correctness > performance > readability
- Use `# TODO:`, `# FIXME:` with ticket numbers
- Refactor incrementally — never "big bang" rewrites
- Add tests before refactoring (characterization tests)
- Track with tools: `ruff`, `mypy`, `bandit`

### B3: How do you ensure code quality in a Python team?
- Pre-commit hooks: `black`, `ruff`, `mypy`
- CI/CD: pytest with coverage threshold (≥80%)
- Code review checklist: type hints, docstrings, tests, error handling
- Architecture Decision Records (ADRs) for major decisions
- Regular dependency updates with `dependabot`
