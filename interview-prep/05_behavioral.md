# Interview Prep — Behavioral & Scenario Questions

## Python-Specific Scenarios

### S1: "We have a memory leak in production. How do you debug it?"

**Step-by-step approach:**
```python
# 1. Identify with tracemalloc
import tracemalloc

tracemalloc.start()
# ... run suspicious code ...
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')
for stat in top_stats[:10]:
    print(stat)

# 2. Check for reference cycles
import gc
gc.collect()
print(f'Unreachable objects: {len(gc.garbage)}')

# 3. Use objgraph (pip install objgraph)
import objgraph
objgraph.show_most_common_types(limit=10)
objgraph.show_growth()

# 4. Common causes:
# - Global caches that grow unboundedly
# - Event handlers holding references (use weakref)
# - Circular references with __del__
# - Unclosed file handles / DB connections
```

---

### S2: "Our API is slow. How do you diagnose and fix it?"

```python
# 1. Profile the endpoint
import cProfile
import pstats

with cProfile.Profile() as pr:
    response = handle_request(request)
stats = pstats.Stats(pr).sort_stats('cumulative')
stats.print_stats(20)

# 2. Add timing middleware
import time
from functools import wraps

def timed_endpoint(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = await func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f'{func.__name__}: {elapsed*1000:.1f}ms')
        return result
    return wrapper

# 3. Common fixes:
# - N+1 queries → batch/eager load
# - Missing cache → add lru_cache or Redis
# - Blocking I/O in async → use run_in_executor
# - Unindexed DB queries → add indexes
# - Large response → pagination + compression
```

---

### S3: "How do you handle a breaking change in a shared Python library?"

**Strategy:**
1. **Semantic versioning**: bump major version (2.0.0)
2. **Deprecation warnings** before removal:
```python
import warnings

def old_function(x, y):
    warnings.warn(
        'old_function is deprecated, use new_function instead. '
        'Will be removed in v3.0',
        DeprecationWarning,
        stacklevel=2,
    )
    return new_function(x, y)
```
3. **Migration guide** in CHANGELOG.md
4. **Compatibility shim** for 1 major version
5. **Automated migration script** if possible

---

### S4: "How do you test code that depends on external APIs?"

```python
# Option 1: Mock (unit test)
from unittest.mock import patch, Mock

@patch('mymodule.requests.get')
def test_fetch_user(mock_get):
    mock_get.return_value.json.return_value = {'id': 1, 'name': 'Alice'}
    mock_get.return_value.status_code = 200
    result = fetch_user(1)
    assert result['name'] == 'Alice'

# Option 2: VCR cassettes (record real responses, replay in tests)
# pip install vcrpy
import vcr

@vcr.use_cassette('fixtures/cassettes/fetch_user.yaml')
def test_fetch_user_vcr():
    result = fetch_user(1)  # first run: real HTTP; subsequent: replay
    assert result['name'] == 'Alice'

# Option 3: Dependency injection (most testable)
class UserService:
    def __init__(self, http_client=None):
        self.client = http_client or requests

    def fetch_user(self, user_id):
        return self.client.get(f'/users/{user_id}').json()

# Test
mock_client = Mock()
mock_client.get.return_value.json.return_value = {'id': 1}
service = UserService(http_client=mock_client)
assert service.fetch_user(1)['id'] == 1
```

---

## Top 20 Python Interview Questions (Quick Reference)

| # | Question | Key Points |
|---|----------|------------|
| 1 | What is the GIL? | Mutex in CPython, prevents parallel threads for CPU-bound |
| 2 | Mutable vs immutable | list/dict/set mutable; int/str/tuple immutable |
| 3 | `*args` vs `**kwargs` | tuple of positional; dict of keyword |
| 4 | Decorator | Function wrapping function, `@functools.wraps` |
| 5 | Generator vs list | Lazy vs eager, `yield` vs `return` |
| 6 | `__slots__` | Replaces `__dict__`, saves memory |
| 7 | MRO | C3 linearization, `__mro__`, `super()` |
| 8 | Context manager | `__enter__`/`__exit__`, `with` statement |
| 9 | `deepcopy` vs `copy` | Recursive vs shallow copy |
| 10 | `is` vs `==` | Identity vs equality |
| 11 | `@classmethod` vs `@staticmethod` | cls vs no self/cls |
| 12 | Metaclass | Class of a class, `type` |
| 13 | Descriptor | `__get__`/`__set__`/`__delete__` |
| 14 | `asyncio` | Event loop, coroutines, `await` |
| 15 | `threading` vs `multiprocessing` | GIL: I/O vs CPU bound |
| 16 | `lru_cache` | Memoization, bounded LRU |
| 17 | `dataclass` | Auto `__init__`, `__repr__`, `__eq__` |
| 18 | Type hints | `int`, `str`, `Optional`, `Union`, `TypeVar` |
| 19 | `__new__` vs `__init__` | Creates vs initializes |
| 20 | LEGB rule | Local, Enclosing, Global, Built-in |

---

## Coding Interview Tips

### Before coding:
1. Clarify requirements — ask about edge cases
2. State your approach before writing
3. Discuss time/space complexity upfront

### While coding:
1. Write clean, readable code (not clever)
2. Use meaningful variable names
3. Add brief comments for non-obvious logic
4. Test with examples as you go

### After coding:
1. Walk through with an example
2. Check edge cases: empty input, single element, duplicates
3. Discuss optimizations
4. Mention what you'd add in production (logging, error handling, tests)

### Python-specific tips:
- Use built-ins: `sum()`, `max()`, `sorted()`, `Counter`, `defaultdict`
- Prefer list comprehensions over loops for simple transforms
- Use `enumerate()` instead of `range(len(...))`
- Use `zip()` for parallel iteration
- Use `collections.deque` for O(1) popleft
- Use `heapq` for priority queues
- Use `bisect` for sorted list operations
