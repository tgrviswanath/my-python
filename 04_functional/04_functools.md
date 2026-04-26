# Python `functools` — Comprehensive Guide

## 1. `lru_cache` and `cache`

```python
from functools import lru_cache, cache

# lru_cache — Least Recently Used cache with size limit
@lru_cache(maxsize=128)   # cache up to 128 results
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

fibonacci(50)   # fast — cached results reused
fibonacci.cache_info()
# CacheInfo(hits=48, misses=51, maxsize=128, currsize=51)

fibonacci.cache_clear()   # clear the cache

# maxsize=None — unlimited cache (same as @cache)
@lru_cache(maxsize=None)
def expensive(n):
    return n ** 2

# cache (Python 3.9+) — simpler, unlimited, slightly faster
@cache
def factorial(n):
    return n * factorial(n - 1) if n else 1

# Arguments must be hashable
@lru_cache(maxsize=128)
def process(data):
    return sum(data)

process((1, 2, 3))   # OK — tuple is hashable
# process([1, 2, 3])  # TypeError — list is not hashable

# Practical: memoize expensive computations
@cache
def count_ways(n, coins):
    """Count ways to make change — classic DP"""
    if n == 0:
        return 1
    if n < 0 or not coins:
        return 0
    return count_ways(n - coins[0], coins) + count_ways(n, coins[1:])

count_ways(10, (1, 5, 10))   # 4
```

---

## 2. `partial`

```python
from functools import partial

# partial(func, *args, **kwargs) — fix some arguments of a function
def power(base, exponent):
    return base ** exponent

square = partial(power, exponent=2)
cube = partial(power, exponent=3)

square(5)   # 25
cube(3)     # 27

# Fix positional arguments
def multiply(x, y):
    return x * y

double = partial(multiply, 2)   # fixes first positional arg
double(5)   # 10
double(7)   # 14

# Practical uses
import os
join_with_base = partial(os.path.join, "/home/user")
join_with_base("documents", "file.txt")   # "/home/user/documents/file.txt"

# With sorted
from operator import itemgetter
sort_by_age = partial(sorted, key=itemgetter('age'))
sort_by_age([{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}])

# partial vs lambda
double_lambda = lambda x: multiply(2, x)
double_partial = partial(multiply, 2)
# partial is slightly faster and more introspectable

# Inspect partial
double_partial.func    # <function multiply>
double_partial.args    # (2,)
double_partial.keywords  # {}
```

---

## 3. `reduce`

```python
from functools import reduce

# reduce(function, iterable[, initializer])
# Applies function cumulatively: f(f(f(a,b),c),d)

# Sum
reduce(lambda acc, x: acc + x, [1, 2, 3, 4, 5])   # 15

# Product
reduce(lambda acc, x: acc * x, [1, 2, 3, 4, 5])   # 120

# Max
reduce(lambda a, b: a if a > b else b, [3, 1, 4, 1, 5, 9])   # 9

# With initializer
reduce(lambda acc, x: acc + x, [], 0)   # 0 (without initializer: TypeError)

# Flatten
reduce(lambda acc, x: acc + x, [[1,2],[3,4],[5,6]], [])
# [1, 2, 3, 4, 5, 6]

# Build dict
pairs = [("a", 1), ("b", 2), ("c", 3)]
reduce(lambda d, kv: {**d, kv[0]: kv[1]}, pairs, {})
# {'a': 1, 'b': 2, 'c': 3}

# Compose functions
def compose(*funcs):
    return reduce(lambda f, g: lambda x: f(g(x)), funcs)

add1 = lambda x: x + 1
double = lambda x: x * 2
add1_then_double = compose(double, add1)   # double(add1(x))
add1_then_double(3)   # 8
```

---

## 4. `wraps`

```python
from functools import wraps

def my_decorator(func):
    @wraps(func)   # copies __name__, __doc__, __module__, __qualname__, __annotations__, __dict__
    def wrapper(*args, **kwargs):
        """Wrapper docstring"""
        return func(*args, **kwargs)
    return wrapper


@my_decorator
def add(x, y):
    """Add two numbers and return the result."""
    return x + y


add.__name__      # "add"  (not "wrapper")
add.__doc__       # "Add two numbers and return the result."
add.__wrapped__   # the original add function (set by @wraps)

# Without @wraps:
# add.__name__  # "wrapper"
# add.__doc__   # "Wrapper docstring"

# Access original function
add.__wrapped__(3, 4)   # 7

# wraps is itself a partial application of update_wrapper
# @wraps(func) is equivalent to:
# wrapper = update_wrapper(wrapper, func)
```

---

## 5. `total_ordering`

```python
from functools import total_ordering

@total_ordering
class Student:
    def __init__(self, name, gpa):
        self.name = name
        self.gpa = gpa

    def __eq__(self, other):
        if not isinstance(other, Student):
            return NotImplemented
        return self.gpa == other.gpa

    def __lt__(self, other):
        if not isinstance(other, Student):
            return NotImplemented
        return self.gpa < other.gpa

    # @total_ordering generates: __le__, __gt__, __ge__, __ne__


alice = Student("Alice", 3.8)
bob = Student("Bob", 3.5)

alice > bob    # True  — generated
alice >= bob   # True  — generated
alice <= bob   # False — generated
alice != bob   # True  — generated

sorted([alice, bob])   # [bob, alice]  — uses __lt__

# Requirements: must define __eq__ AND one of __lt__, __le__, __gt__, __ge__
# Note: slightly slower than defining all methods manually (extra function call)
```

---

## 6. `singledispatch`

```python
from functools import singledispatch

# singledispatch — function overloading based on the type of the first argument

@singledispatch
def process(data):
    """Default implementation"""
    raise TypeError(f"Unsupported type: {type(data)}")

@process.register(int)
def _(data):
    return f"Processing integer: {data * 2}"

@process.register(str)
def _(data):
    return f"Processing string: {data.upper()}"

@process.register(list)
def _(data):
    return f"Processing list of {len(data)} items"

@process.register(float)
@process.register(complex)
def _(data):
    return f"Processing number: {abs(data)}"


process(42)          # "Processing integer: 84"
process("hello")     # "Processing string: HELLO"
process([1, 2, 3])   # "Processing list of 3 items"
process(3.14)        # "Processing number: 3.14"

# Dispatch on type
process.dispatch(int)   # returns the int handler
process.registry        # dict of all registered types


# singledispatchmethod (Python 3.8+) — for methods
from functools import singledispatchmethod

class Formatter:
    @singledispatchmethod
    def format(self, data):
        raise TypeError(f"Unsupported: {type(data)}")

    @format.register(int)
    def _(self, data):
        return f"int: {data}"

    @format.register(str)
    def _(self, data):
        return f"str: {data!r}"
```

---

## 7. Other `functools` Utilities

```python
from functools import (
    cached_property,
    cmp_to_key,
    update_wrapper,
)

# cached_property (Python 3.8+) — compute once, cache in instance __dict__
class DataProcessor:
    def __init__(self, data):
        self.data = data

    @cached_property
    def sorted_data(self):
        print("Sorting...")
        return sorted(self.data)

dp = DataProcessor([3, 1, 2])
dp.sorted_data   # "Sorting..." then [1, 2, 3]
dp.sorted_data   # [1, 2, 3]  — cached, no print
# Stored in dp.__dict__['sorted_data']


# cmp_to_key — convert old-style comparison function to key function
# Useful for complex sorting that's hard to express as a key
import locale

def locale_compare(a, b):
    return locale.strcoll(a, b)

sorted(words, key=cmp_to_key(locale_compare))


# update_wrapper — manually apply wraps behavior
def my_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    update_wrapper(wrapper, func)   # same as @wraps(func)
    return wrapper
```

---

## 8. Practical Patterns

```python
from functools import lru_cache, partial, reduce, cache

# Memoized recursive DP
@cache
def longest_common_subsequence(s1, s2):
    if not s1 or not s2:
        return 0
    if s1[-1] == s2[-1]:
        return 1 + longest_common_subsequence(s1[:-1], s2[:-1])
    return max(
        longest_common_subsequence(s1[:-1], s2),
        longest_common_subsequence(s1, s2[:-1])
    )

# Note: strings are hashable, so this works with @cache


# Partial for configuration
import logging

def log_message(level, logger, message):
    logger.log(level, message)

app_logger = logging.getLogger("app")
log_info = partial(log_message, logging.INFO, app_logger)
log_error = partial(log_message, logging.ERROR, app_logger)

log_info("Server started")
log_error("Connection failed")


# Function composition with reduce
def compose(*funcs):
    """Right-to-left function composition"""
    return reduce(lambda f, g: lambda *args, **kwargs: f(g(*args, **kwargs)), funcs)

def pipe(*funcs):
    """Left-to-right function composition"""
    return reduce(lambda f, g: lambda *args, **kwargs: g(f(*args, **kwargs)), funcs)

normalize = pipe(str.strip, str.lower, str.title)
normalize("  hello WORLD  ")   # "Hello World"
```

---

## Interview Questions & Answers

**Q1: What is `lru_cache` and how does it work?**

Answer: `lru_cache` is a decorator that caches function results based on arguments. It uses a **Least Recently Used** eviction policy — when the cache is full (`maxsize`), the least recently used entry is discarded. It's implemented as a hash table + doubly linked list for O(1) access and eviction.

Arguments must be **hashable** (tuples, strings, ints — not lists or dicts).

```python
@lru_cache(maxsize=128)
def fib(n):
    return n if n < 2 else fib(n-1) + fib(n-2)
```

---

**Q2: What is the difference between `lru_cache` and `cache`?**

Answer:
- `lru_cache(maxsize=N)`: bounded cache with LRU eviction. When full, discards least recently used.
- `lru_cache(maxsize=None)`: unbounded cache, never evicts.
- `cache` (Python 3.9+): equivalent to `lru_cache(maxsize=None)` but simpler and slightly faster (no LRU tracking overhead).

Use `cache` for pure functions where you want to cache all results. Use `lru_cache` with a size limit when memory is a concern.

---

**Q3: What is `functools.partial` and when would you use it?**

Answer: `partial(func, *args, **kwargs)` creates a new callable with some arguments pre-filled. Use it for:
- Creating specialized versions of general functions.
- Adapting function signatures for callbacks/APIs.
- Avoiding repetitive argument passing.

```python
double = partial(multiply, 2)   # fixes first arg
double(5)   # 10
```

---

**Q4: What does `@total_ordering` do and what are its requirements?**

Answer: `@total_ordering` automatically generates the missing comparison methods (`__le__`, `__gt__`, `__ge__`, `__ne__`) from `__eq__` and one of the ordering methods. Requirements: define `__eq__` AND at least one of `__lt__`, `__le__`, `__gt__`, `__ge__`. Note: slightly slower than defining all methods manually due to extra function call overhead.

---

**Q5: What is `singledispatch` and how does it differ from method overloading?**

Answer: `singledispatch` enables **function overloading** based on the type of the first argument. Unlike traditional overloading (compile-time), it's resolved at runtime. It's useful for implementing type-specific behavior without `isinstance` chains.

```python
@singledispatch
def process(data): raise TypeError(...)

@process.register(int)
def _(data): return data * 2

@process.register(str)
def _(data): return data.upper()
```

---

**Q6: Why must `lru_cache` arguments be hashable?**

Answer: `lru_cache` stores results in a dictionary keyed by the function arguments. Dictionary keys must be hashable. Lists, dicts, and sets are not hashable. Use tuples instead of lists when you need to cache results for sequence arguments.

---

**Q7: What is `functools.wraps` and why is it important?**

Answer: `@wraps(func)` copies the wrapped function's metadata (`__name__`, `__doc__`, `__module__`, `__qualname__`, `__annotations__`, `__dict__`) to the wrapper. Without it, introspection tools, documentation generators, and debugging tools see the wrapper instead of the original function. It also sets `__wrapped__` to the original function, enabling unwrapping.

---

**Q8: How does `cached_property` differ from `lru_cache` on a method?**

Answer:
- `@cached_property`: stores the result in the **instance's `__dict__`**. Computed once per instance. No size limit. Works only on instance methods. The cached value can be deleted (`del obj.prop`).
- `@lru_cache` on a method: stores results in a **class-level cache** keyed by `(self, *args)`. Keeps a reference to `self`, preventing garbage collection. Can cause memory leaks.

```python
# cached_property — per-instance, no memory leak
@cached_property
def expensive(self): ...

# lru_cache on method — class-level, can leak
@lru_cache(maxsize=None)
def expensive(self): ...  # self is kept in cache!
```
