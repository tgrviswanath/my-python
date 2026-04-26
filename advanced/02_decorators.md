# Decorators — Deep Dive

## Table of Contents
1. [Function Decorators](#1-function-decorators)
2. [Preserving Metadata with functools.wraps](#2-preserving-metadata-with-functoolswraps)
3. [Decorators with Arguments (Decorator Factory)](#3-decorators-with-arguments)
4. [Class-Based Decorators](#4-class-based-decorators)
5. [Stacked Decorators](#5-stacked-decorators)
6. [Class Decorators](#6-class-decorators)
7. [Built-in Decorators](#7-built-in-decorators)
8. [Real-World Patterns](#8-real-world-patterns)
9. [Performance Notes](#9-performance-notes)
10. [Common Bugs & Pitfalls](#10-common-bugs--pitfalls)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Function Decorators

A decorator is a callable that takes a function and returns a replacement function. The `@` syntax is pure syntactic sugar:

```python
@decorator
def func():
    pass

# Exactly equivalent to:
def func():
    pass
func = decorator(func)
```

### Basic wrapper pattern

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print(f"Before {func.__name__}")
        result = func(*args, **kwargs)
        print(f"After {func.__name__}")
        return result
    return wrapper

@my_decorator
def greet(name):
    print(f"Hello, {name}!")
    return f"greeted {name}"

greet("Alice")
# Before greet
# Hello, Alice!
# After greet
```

### Why `*args, **kwargs` in the wrapper

Always use `*args, **kwargs` in the wrapper to make the decorator work with any function signature. Without them, the decorator only works for functions with the exact same signature.

---

## 2. Preserving Metadata with functools.wraps

Without `@wraps`, the wrapper replaces the original function's metadata:

```python
def bad_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@bad_decorator
def my_func():
    """My docstring."""
    pass

print(my_func.__name__)   # 'wrapper'  ← WRONG
print(my_func.__doc__)    # None       ← WRONG
```

`functools.wraps` copies `__name__`, `__doc__`, `__annotations__`, `__module__`, `__qualname__`, and `__wrapped__` from the original:

```python
from functools import wraps

def good_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@good_decorator
def my_func():
    """My docstring."""
    pass

print(my_func.__name__)      # 'my_func'      ← correct
print(my_func.__doc__)       # 'My docstring.' ← correct
print(my_func.__wrapped__)   # <function my_func> — access original
```

`__wrapped__` allows introspection tools and `inspect.signature()` to see through the decorator chain.

---

## 3. Decorators with Arguments

A **decorator factory** is a function that *returns* a decorator. It adds an extra layer of nesting:

```python
from functools import wraps

def repeat(n):
    """Decorator factory: repeat function n times."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(n):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(3)
def say_hello():
    print("Hello!")

say_hello()
# Hello!
# Hello!
# Hello!
```

### Optional arguments pattern

Making arguments optional (decorator works with or without parentheses):

```python
from functools import wraps
import inspect

def log(func=None, *, level='INFO'):
    """Works as @log or @log(level='DEBUG')"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            print(f"[{level}] Calling {f.__name__}")
            return f(*args, **kwargs)
        return wrapper

    if func is not None:
        # Called as @log without parentheses
        return decorator(func)
    # Called as @log(...) with parentheses
    return decorator

@log
def func1(): pass

@log(level='DEBUG')
def func2(): pass
```

---

## 4. Class-Based Decorators

A class can be a decorator if it implements `__call__`. Useful when the decorator needs to maintain state.

```python
from functools import wraps, update_wrapper

class CountCalls:
    """Decorator that counts how many times a function is called."""
    def __init__(self, func):
        update_wrapper(self, func)   # equivalent of @wraps for classes
        self.func = func
        self.call_count = 0

    def __call__(self, *args, **kwargs):
        self.call_count += 1
        print(f"{self.func.__name__} called {self.call_count} time(s)")
        return self.func(*args, **kwargs)

@CountCalls
def add(a, b):
    return a + b

add(1, 2)   # add called 1 time(s)
add(3, 4)   # add called 2 time(s)
print(add.call_count)   # 2
```

### Class-based decorator factory

```python
class Retry:
    def __init__(self, max_attempts=3, exceptions=(Exception,)):
        self.max_attempts = max_attempts
        self.exceptions = exceptions

    def __call__(self, func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, self.max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except self.exceptions as e:
                    if attempt == self.max_attempts:
                        raise
                    print(f"Attempt {attempt} failed: {e}. Retrying...")
        return wrapper

@Retry(max_attempts=3, exceptions=(ConnectionError,))
def fetch_data(url):
    # ... network call
    pass
```

---

## 5. Stacked Decorators

When multiple decorators are stacked, they apply **bottom-up** (innermost first), but execute **top-down** at call time:

```python
from functools import wraps

def decorator_A(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        print("A: before")
        result = func(*args, **kwargs)
        print("A: after")
        return result
    return wrapper

def decorator_B(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        print("B: before")
        result = func(*args, **kwargs)
        print("B: after")
        return result
    return wrapper

@decorator_A
@decorator_B
def my_func():
    print("function body")

my_func()
# A: before
# B: before
# function body
# B: after
# A: after
```

**Application order:** `my_func = decorator_A(decorator_B(my_func))`

The call stack is: A's wrapper → B's wrapper → original function → B's wrapper (after) → A's wrapper (after).

---

## 6. Class Decorators

Decorators can also be applied to **classes**, not just functions:

```python
def singleton(cls):
    """Ensure only one instance of a class exists."""
    instances = {}
    @wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@singleton
class DatabaseConnection:
    def __init__(self):
        print("Creating DB connection")

db1 = DatabaseConnection()   # Creating DB connection
db2 = DatabaseConnection()   # (no output)
print(db1 is db2)            # True
```

### Adding methods to a class

```python
def add_repr(cls):
    """Auto-generate __repr__ from __init__ parameters."""
    import inspect
    params = list(inspect.signature(cls.__init__).parameters.keys())[1:]  # skip self

    def __repr__(self):
        attrs = ', '.join(f"{p}={getattr(self, p)!r}" for p in params)
        return f"{cls.__name__}({attrs})"

    cls.__repr__ = __repr__
    return cls

@add_repr
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

print(Point(1, 2))   # Point(x=1, y=2)
```

---

## 7. Built-in Decorators

### @property

```python
class Temperature:
    def __init__(self, celsius=0):
        self._celsius = celsius

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("Temperature below absolute zero!")
        self._celsius = value

    @celsius.deleter
    def celsius(self):
        del self._celsius

    @property
    def fahrenheit(self):
        return self._celsius * 9/5 + 32

t = Temperature(25)
print(t.fahrenheit)   # 77.0
t.celsius = 100
print(t.fahrenheit)   # 212.0
```

### @classmethod and @staticmethod

```python
class Date:
    def __init__(self, year, month, day):
        self.year, self.month, self.day = year, month, day

    @classmethod
    def from_string(cls, date_string):
        """Alternative constructor — receives class, not instance."""
        year, month, day = map(int, date_string.split('-'))
        return cls(year, month, day)

    @staticmethod
    def is_valid(date_string):
        """Utility function — no access to class or instance."""
        parts = date_string.split('-')
        return len(parts) == 3 and all(p.isdigit() for p in parts)

d = Date.from_string('2024-01-15')
print(Date.is_valid('2024-01-15'))   # True
```

### @functools.lru_cache

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

fibonacci(50)   # instant; without cache: 2^50 calls
print(fibonacci.cache_info())
# CacheInfo(hits=48, misses=51, maxsize=128, currsize=51)
fibonacci.cache_clear()   # clear the cache
```

`lru_cache` uses a doubly-linked list + dict for O(1) get/put. Arguments must be hashable.

### @functools.cached_property

```python
from functools import cached_property

class Circle:
    def __init__(self, radius):
        self.radius = radius

    @cached_property
    def area(self):
        import math
        print("Computing area...")
        return math.pi * self.radius ** 2

c = Circle(5)
print(c.area)   # Computing area... 78.539...
print(c.area)   # 78.539... (no recomputation — stored in instance __dict__)
```

`cached_property` stores the result in the instance's `__dict__`, bypassing the descriptor on subsequent access. It's not thread-safe by default.

---

## 8. Real-World Patterns

### Timing decorator

```python
import time
from functools import wraps

def timer(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper
```

### Retry with exponential backoff

```python
import time
from functools import wraps

def retry(max_attempts=3, delay=1.0, backoff=2.0, exceptions=(Exception,)):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            current_delay = delay
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        raise
                    print(f"Attempt {attempt}/{max_attempts} failed: {e}. "
                          f"Retrying in {current_delay:.1f}s...")
                    time.sleep(current_delay)
                    current_delay *= backoff
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.5, exceptions=(ConnectionError, TimeoutError))
def fetch_url(url):
    import urllib.request
    return urllib.request.urlopen(url).read()
```

### Rate limiter

```python
import time
from functools import wraps
from collections import deque

def rate_limit(calls_per_second):
    min_interval = 1.0 / calls_per_second
    def decorator(func):
        last_called = [0.0]
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.monotonic() - last_called[0]
            wait = min_interval - elapsed
            if wait > 0:
                time.sleep(wait)
            last_called[0] = time.monotonic()
            return func(*args, **kwargs)
        return wrapper
    return decorator

@rate_limit(calls_per_second=2)
def api_call(endpoint):
    print(f"Calling {endpoint} at {time.time():.2f}")
```

### Caching decorator (with TTL)

```python
import time
from functools import wraps

def ttl_cache(ttl_seconds=60):
    def decorator(func):
        cache = {}
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            if key in cache:
                result, timestamp = cache[key]
                if time.monotonic() - timestamp < ttl_seconds:
                    return result
            result = func(*args, **kwargs)
            cache[key] = (result, time.monotonic())
            return result
        wrapper.cache_clear = lambda: cache.clear()
        return wrapper
    return decorator
```

### Authentication decorator (Flask-style)

```python
from functools import wraps

def require_auth(func):
    @wraps(func)
    def wrapper(request, *args, **kwargs):
        token = request.headers.get('Authorization')
        if not token or not validate_token(token):
            return {'error': 'Unauthorized'}, 401
        return func(request, *args, **kwargs)
    return wrapper

def require_role(*roles):
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            user_role = get_user_role(request)
            if user_role not in roles:
                return {'error': 'Forbidden'}, 403
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
```

### Logging decorator

```python
import logging
from functools import wraps

def log_calls(logger=None, level=logging.DEBUG):
    def decorator(func):
        _logger = logger or logging.getLogger(func.__module__)
        @wraps(func)
        def wrapper(*args, **kwargs):
            _logger.log(level, f"Calling {func.__name__}({args!r}, {kwargs!r})")
            try:
                result = func(*args, **kwargs)
                _logger.log(level, f"{func.__name__} returned {result!r}")
                return result
            except Exception as e:
                _logger.exception(f"{func.__name__} raised {type(e).__name__}: {e}")
                raise
        return wrapper
    return decorator
```

---

## 9. Performance Notes

- **`@lru_cache`** provides O(1) lookup using a dict. The LRU eviction uses a doubly-linked list. For pure functions with hashable args, it's the fastest caching option.
- **`@cached_property`** has zero overhead after first access — it writes directly to `__dict__`, bypassing the descriptor protocol entirely.
- **Decorator overhead**: Each decorator adds one function call per invocation. For hot paths called millions of times, consider whether the overhead is acceptable.
- **`functools.wraps`** has negligible overhead — it runs once at decoration time, not at call time.
- **Class-based decorators** have slightly higher call overhead than function-based ones due to `__call__` dispatch.
- **Stacked decorators**: Each layer adds a function call. 5 stacked decorators = 5 extra function calls per invocation.

```python
# Measuring decorator overhead
import timeit

def no_op(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@no_op
def fast_func(x):
    return x * 2

# Overhead is typically 100-300ns per decorator layer
```

---

## 10. Common Bugs & Pitfalls

### Bug 1: Missing @wraps — breaks introspection

```python
# Without @wraps, help(), inspect.signature(), and debuggers see 'wrapper'
# Always use @wraps(func) in the inner wrapper function
```

### Bug 2: Mutable default state shared across calls

```python
# WRONG: cache dict is shared across all decorated functions
def bad_cache(func):
    cache = {}   # This is fine — created once per decoration
    @wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    return wrapper

# WRONG: mutable state in decorator factory default argument
def bad_factory(cache={}):   # shared across all calls to bad_factory!
    def decorator(func):
        @wraps(func)
        def wrapper(*args):
            if args not in cache:
                cache[args] = func(*args)
            return cache[args]
        return wrapper
    return decorator
```

### Bug 3: Decorating methods — self gets passed to wrapper

```python
class MyClass:
    @my_decorator   # wrapper receives (self, *args, **kwargs) — usually fine
    def method(self):
        pass

# Problem: class-based decorators that don't handle descriptors
class MyDecorator:
    def __init__(self, func):
        self.func = func
    def __call__(self, *args, **kwargs):
        return self.func(*args, **kwargs)
    # Missing __get__ — won't work as a method decorator!
    def __get__(self, obj, objtype=None):
        from functools import partial
        if obj is None:
            return self
        return partial(self.__call__, obj)
```

### Bug 4: Decorator applied at import time

```python
# Decorators run when the module is imported, not when the function is called
# Side effects in decorators (DB connections, file I/O) happen at import time
@connect_to_db   # runs at import — may fail if DB not available yet
def get_user(id):
    pass
```

### Bug 5: Forgetting to return the result

```python
def bad_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        func(*args, **kwargs)   # BUG: result not returned!
    return wrapper

# Fix:
def good_decorator(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)   # always return!
    return wrapper
```

---

## 11. Interview Q&A

**Q1: What is a decorator and how does `@` syntax work?**

A decorator is a callable that takes a function (or class) and returns a modified version. The `@decorator` syntax is syntactic sugar for `func = decorator(func)`. Decorators are applied at function definition time (import time), not at call time. They're used to add cross-cutting concerns (logging, caching, auth) without modifying the original function.

---

**Q2: Why is `functools.wraps` important?**

Without `@wraps(func)`, the wrapper function replaces the original's `__name__`, `__doc__`, `__annotations__`, and other metadata. This breaks `help()`, `inspect.signature()`, logging, and debugging tools. `@wraps` copies all metadata from the original to the wrapper and sets `__wrapped__` to allow unwrapping the decorator chain.

---

**Q3: What is a decorator factory and when do you need one?**

A decorator factory is a function that returns a decorator. You need one when the decorator requires configuration parameters (e.g., `@retry(max_attempts=3)`). It adds an extra nesting level: `factory(args)` returns `decorator`, which takes `func` and returns `wrapper`.

---

**Q4: What is the execution order of stacked decorators?**

Decorators are applied bottom-up at definition time: `@A @B def f()` → `f = A(B(f))`. At call time, execution is top-down: A's wrapper runs first, then B's wrapper, then the original function, then B's after-code, then A's after-code. Think of it as nested function calls.

---

**Q5: How do you create a decorator that works both with and without arguments?**

Check if the first argument is a callable (the function being decorated) or a configuration value:

```python
def decorator(func=None, *, option=default):
    def actual_decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            return f(*args, **kwargs)
        return wrapper
    if func is not None:
        return actual_decorator(func)
    return actual_decorator
```

---

**Q6: What is the difference between `@classmethod`, `@staticmethod`, and `@property`?**

- `@classmethod`: receives the class (`cls`) as first argument instead of the instance. Used for alternative constructors and factory methods.
- `@staticmethod`: receives no implicit first argument. A regular function namespaced inside a class. No access to class or instance.
- `@property`: turns a method into a computed attribute. Enables getter/setter/deleter with attribute-style access while maintaining encapsulation.

---

**Q7: How does `@lru_cache` work internally?**

`lru_cache` maintains a dict mapping argument tuples to results, and a doubly-linked list for LRU eviction order. On cache hit: O(1) dict lookup + O(1) list reorder. On cache miss: O(1) function call + O(1) dict insert. When `maxsize` is reached, the least recently used entry is evicted. Arguments must be hashable. Thread-safe in CPython due to the GIL.

---

**Q8: Can you decorate a class? What are the use cases?**

Yes. A class decorator receives the class object and returns a modified class (or a replacement). Use cases: singleton pattern, auto-generating `__repr__`/`__eq__`, registering classes in a registry, adding methods or attributes, dataclass-style field processing. Python's `@dataclass` is itself a class decorator.

---

**Q9: What is `functools.cached_property` and how does it differ from `@property` with manual caching?**

`@cached_property` computes the value once and stores it directly in the instance's `__dict__`. On subsequent access, Python finds the value in `__dict__` before consulting the descriptor, so the property method is never called again — zero overhead. Manual caching with `@property` still calls the method every time (to check the cache). Note: `cached_property` requires a writable `__dict__` and is not thread-safe.

---

**Q10: What are the pitfalls of using decorators on class methods?**

1. **Missing `__get__`**: Class-based decorators don't automatically work as method descriptors. They need `__get__` to bind `self`.
2. **`@staticmethod`/`@classmethod` interaction**: These must be the outermost decorator.
3. **`self` in wrapper**: The wrapper receives `self` as the first positional argument — usually fine with `*args, **kwargs`.
4. **`@wraps` with methods**: Works correctly, but `__qualname__` will show the wrapper's qualified name unless `@wraps` is used.
