# Interview Prep — Hard Questions

## Advanced Python Internals

### Q1: Implement a metaclass that auto-registers subclasses
```python
class PluginMeta(type):
    registry: dict[str, type] = {}

    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        if bases:  # skip the base class itself
            key = namespace.get('plugin_name', name.lower())
            mcs.registry[key] = cls
        return cls

class Plugin(metaclass=PluginMeta):
    def execute(self): raise NotImplementedError

class JSONPlugin(Plugin):
    plugin_name = 'json'
    def execute(self): return 'JSON processing'

class CSVPlugin(Plugin):
    plugin_name = 'csv'
    def execute(self): return 'CSV processing'

# Auto-registered
assert 'json' in PluginMeta.registry
assert 'csv' in PluginMeta.registry
plugin = PluginMeta.registry['json']()
print(plugin.execute())  # JSON processing
```

---

### Q2: Implement a descriptor that validates and caches
```python
class TypedCached:
    """Descriptor: validates type, caches computed value."""

    def __init__(self, type_, compute=None):
        self.type_ = type_
        self.compute = compute

    def __set_name__(self, owner, name):
        self.name = name
        self.private = f'_{name}'

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        if self.private not in obj.__dict__:
            if self.compute:
                obj.__dict__[self.private] = self.compute(obj)
            else:
                return None
        return obj.__dict__[self.private]

    def __set__(self, obj, value):
        if not isinstance(value, self.type_):
            raise TypeError(f'{self.name} must be {self.type_.__name__}, got {type(value).__name__}')
        obj.__dict__[self.private] = value
        # Invalidate cached computed fields
        for attr in list(obj.__dict__):
            if attr.startswith('_computed_'):
                del obj.__dict__[attr]

class Circle:
    radius = TypedCached(float)
    area   = TypedCached(float, compute=lambda self: 3.14159 * self.radius ** 2)

    def __init__(self, r):
        self.radius = r

c = Circle(5.0)
print(c.area)    # computed: 78.53975
print(c.area)    # cached
```

---

### Q3: Implement async context manager
```python
import asyncio

class AsyncDB:
    def __init__(self, url):
        self.url = url
        self._conn = None

    async def __aenter__(self):
        print(f'Connecting to {self.url}')
        await asyncio.sleep(0.01)  # simulate connection
        self._conn = {'url': self.url, 'connected': True}
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        print('Closing connection')
        await asyncio.sleep(0.01)  # simulate cleanup
        self._conn = None
        return False

    async def query(self, sql):
        if not self._conn:
            raise RuntimeError('Not connected')
        await asyncio.sleep(0.01)
        return [{'id': 1, 'sql': sql}]

async def main():
    async with AsyncDB('postgresql://localhost/mydb') as db:
        results = await db.query('SELECT * FROM users')
        print(results)

asyncio.run(main())
```

---

## Hard Algorithms

### Q4: Serialize and Deserialize a Binary Tree
```python
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Codec:
    def serialize(self, root) -> str:
        if not root:
            return 'null'
        result = []
        queue = deque([root])
        while queue:
            node = queue.popleft()
            if node:
                result.append(str(node.val))
                queue.append(node.left)
                queue.append(node.right)
            else:
                result.append('null')
        return ','.join(result)

    def deserialize(self, data: str):
        if data == 'null':
            return None
        vals = data.split(',')
        root = TreeNode(int(vals[0]))
        queue = deque([root])
        i = 1
        while queue and i < len(vals):
            node = queue.popleft()
            if vals[i] != 'null':
                node.left = TreeNode(int(vals[i]))
                queue.append(node.left)
            i += 1
            if i < len(vals) and vals[i] != 'null':
                node.right = TreeNode(int(vals[i]))
                queue.append(node.right)
            i += 1
        return root

codec = Codec()
root = TreeNode(1, TreeNode(2), TreeNode(3, TreeNode(4), TreeNode(5)))
serialized = codec.serialize(root)
print(serialized)  # 1,2,3,null,null,4,5
restored = codec.deserialize(serialized)
print(codec.serialize(restored))  # same
```

---

### Q5: Word Ladder (BFS shortest path)
```python
from collections import deque, defaultdict

def word_ladder(begin: str, end: str, word_list: list[str]) -> int:
    word_set = set(word_list)
    if end not in word_set:
        return 0

    # Build adjacency: *ot -> [hot, dot, lot]
    pattern_map = defaultdict(list)
    for word in word_set:
        for i in range(len(word)):
            pattern = word[:i] + '*' + word[i+1:]
            pattern_map[pattern].append(word)

    queue = deque([(begin, 1)])
    visited = {begin}

    while queue:
        word, steps = queue.popleft()
        for i in range(len(word)):
            pattern = word[:i] + '*' + word[i+1:]
            for neighbor in pattern_map[pattern]:
                if neighbor == end:
                    return steps + 1
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, steps + 1))
    return 0

words = ['hot','dot','dog','lot','log','cog']
assert word_ladder('hit', 'cog', words) == 5
```

---

### Q6: Implement a Thread Pool from Scratch
```python
import threading
import queue
from typing import Callable, Any

class ThreadPool:
    def __init__(self, num_threads: int):
        self._queue = queue.Queue()
        self._threads = []
        self._shutdown = False

        for _ in range(num_threads):
            t = threading.Thread(target=self._worker, daemon=True)
            t.start()
            self._threads.append(t)

    def _worker(self):
        while True:
            item = self._queue.get()
            if item is None:
                break
            func, args, kwargs, future = item
            try:
                result = func(*args, **kwargs)
                future['result'] = result
            except Exception as e:
                future['error'] = e
            finally:
                future['done'].set()
                self._queue.task_done()

    def submit(self, func: Callable, *args, **kwargs) -> dict:
        future = {'result': None, 'error': None, 'done': threading.Event()}
        self._queue.put((func, args, kwargs, future))
        return future

    def shutdown(self, wait=True):
        self._shutdown = True
        for _ in self._threads:
            self._queue.put(None)
        if wait:
            for t in self._threads:
                t.join()

import time

pool = ThreadPool(4)
futures = [pool.submit(lambda i=i: i**2, ) for i in range(10)]
# Wait and collect
results = []
for f in futures:
    f['done'].wait()
    results.append(f['result'])
pool.shutdown()
print(sorted(results))  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

---

### Q7: Implement `asyncio.gather` behavior manually
```python
import asyncio

async def gather_with_timeout(*coros, timeout=None):
    """Run coroutines concurrently, with optional timeout."""
    tasks = [asyncio.create_task(c) for c in coros]
    try:
        if timeout:
            done, pending = await asyncio.wait(tasks, timeout=timeout)
            for t in pending:
                t.cancel()
            return [t.result() if not t.cancelled() else None for t in tasks]
        else:
            return await asyncio.gather(*tasks)
    except Exception:
        for t in tasks:
            if not t.done():
                t.cancel()
        raise

async def slow(n, delay):
    await asyncio.sleep(delay)
    return n * 2

async def main():
    results = await gather_with_timeout(
        slow(1, 0.1), slow(2, 0.2), slow(3, 0.3),
        timeout=0.5
    )
    print(results)  # [2, 4, 6]

asyncio.run(main())
```

---

## System Design Questions

### Q8: Design a Rate Limiter
```python
import time
from collections import deque
import threading

class SlidingWindowRateLimiter:
    """Thread-safe sliding window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window = window_seconds
        self._requests: dict[str, deque] = {}
        self._lock = threading.Lock()

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        with self._lock:
            if client_id not in self._requests:
                self._requests[client_id] = deque()

            window = self._requests[client_id]
            # Remove expired timestamps
            while window and window[0] < now - self.window:
                window.popleft()

            if len(window) < self.max_requests:
                window.append(now)
                return True
            return False

limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=1.0)
results = [limiter.is_allowed('user1') for _ in range(5)]
print(results)  # [True, True, True, False, False]
```

---

### Q9: Design an Event System with weak references
```python
import weakref
from typing import Callable

class WeakEventBus:
    """Event bus that doesn't prevent garbage collection of handlers."""

    def __init__(self):
        self._handlers: dict[str, list] = {}

    def subscribe(self, event: str, handler: Callable) -> None:
        if event not in self._handlers:
            self._handlers[event] = []
        # Store weak reference to bound methods
        if hasattr(handler, '__self__'):
            ref = weakref.WeakMethod(handler)
        else:
            ref = weakref.ref(handler)
        self._handlers[event].append(ref)

    def publish(self, event: str, *args, **kwargs) -> None:
        if event not in self._handlers:
            return
        alive = []
        for ref in self._handlers[event]:
            handler = ref()
            if handler is not None:
                handler(*args, **kwargs)
                alive.append(ref)
        self._handlers[event] = alive  # clean up dead refs

bus = WeakEventBus()

class Handler:
    def on_event(self, data):
        print(f'Received: {data}')

h = Handler()
bus.subscribe('data', h.on_event)
bus.publish('data', {'key': 'value'})  # prints

del h  # handler garbage collected
bus.publish('data', {'key': 'value'})  # no output — handler gone
```
