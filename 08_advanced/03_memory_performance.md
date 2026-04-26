# Python Memory & Performance

## 1. `sys.getsizeof` — Object Size

```python
import sys

# Basic sizes
print(sys.getsizeof(None))      # 16
print(sys.getsizeof(True))      # 28
print(sys.getsizeof(42))        # 28
print(sys.getsizeof(3.14))      # 24
print(sys.getsizeof("hello"))   # 54
print(sys.getsizeof([]))        # 56
print(sys.getsizeof({}))        # 64
print(sys.getsizeof(set()))     # 216

# Note: getsizeof only measures the object itself, not referenced objects
lst = [1, 2, 3, 4, 5]
print(sys.getsizeof(lst))  # 120 — just the list container, not the ints!

# Deep size (recursive)
def deep_size(obj, seen=None):
    """Recursively calculate total memory of an object."""
    if seen is None:
        seen = set()
    obj_id = id(obj)
    if obj_id in seen:
        return 0
    seen.add(obj_id)
    size = sys.getsizeof(obj)
    if isinstance(obj, dict):
        size += sum(deep_size(k, seen) + deep_size(v, seen) for k, v in obj.items())
    elif isinstance(obj, (list, tuple, set, frozenset)):
        size += sum(deep_size(item, seen) for item in obj)
    return size

data = {'key': [1, 2, 3], 'nested': {'a': 'hello'}}
print(f"Shallow: {sys.getsizeof(data)} bytes")
print(f"Deep: {deep_size(data)} bytes")
```

---

## 2. `tracemalloc` — Memory Tracing

```python
import tracemalloc

# Start tracing
tracemalloc.start()

# Code to profile
data = [list(range(1000)) for _ in range(100)]

# Get snapshot
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')

print("Top 5 memory allocations:")
for stat in top_stats[:5]:
    print(f"  {stat}")

# Get current and peak memory
current, peak = tracemalloc.get_traced_memory()
print(f"\nCurrent: {current / 1024:.1f} KB")
print(f"Peak: {peak / 1024:.1f} KB")

tracemalloc.stop()

# Compare two snapshots
tracemalloc.start()
snapshot1 = tracemalloc.take_snapshot()

# Do something
more_data = {i: str(i) for i in range(10000)}

snapshot2 = tracemalloc.take_snapshot()
top_stats = snapshot2.compare_to(snapshot1, 'lineno')

print("\nMemory increase:")
for stat in top_stats[:3]:
    print(f"  {stat}")

tracemalloc.stop()
```

---

## 3. `gc` Module — Garbage Collection

```python
import gc

# Python uses reference counting + cyclic garbage collector
# Reference counting handles most objects
# gc handles reference cycles

# Check gc status
print(gc.isenabled())  # True by default
print(gc.get_threshold())  # (700, 10, 10) — collection thresholds

# Force collection
collected = gc.collect()
print(f"Collected {collected} objects")

# Detect reference cycles
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None

# Create a cycle
a = Node(1)
b = Node(2)
a.next = b
b.next = a  # cycle!

# Without gc, these would never be freed
del a, b
collected = gc.collect()
print(f"Collected cycle: {collected} objects")

# Disable gc (for performance-critical code)
gc.disable()
# ... performance-critical code ...
gc.enable()

# Get all tracked objects
objects = gc.get_objects()
print(f"Tracked objects: {len(objects)}")

# Find referrers
x = [1, 2, 3]
referrers = gc.get_referrers(x)
print(f"Referrers of x: {len(referrers)}")
```

---

## 4. Reference Counting

```python
import sys

# Python uses reference counting for memory management
x = [1, 2, 3]
print(sys.getrefcount(x))  # 2 (x + getrefcount argument)

y = x  # another reference
print(sys.getrefcount(x))  # 3

del y
print(sys.getrefcount(x))  # 2

# When refcount reaches 0, object is immediately freed
# (unless it's part of a cycle)

# Interning — small integers and strings are cached
a = 256
b = 256
print(a is b)  # True — same object (interned)

a = 257
b = 257
print(a is b)  # False — different objects (not interned)

# String interning
s1 = "hello"
s2 = "hello"
print(s1 is s2)  # True — interned

s1 = "hello world"
s2 = "hello world"
print(s1 is s2)  # May be True or False — implementation-dependent
```

---

## 5. Weak References

```python
import weakref

class ExpensiveObject:
    def __init__(self, name):
        self.name = name
        print(f"Created {name}")

    def __del__(self):
        print(f"Deleted {name}")

# Strong reference — prevents garbage collection
obj = ExpensiveObject("obj1")
strong_ref = obj  # refcount = 2

# Weak reference — doesn't prevent garbage collection
weak_ref = weakref.ref(obj)
print(f"Weak ref: {weak_ref()}")  # access via ()

del obj
del strong_ref  # refcount = 0 → object deleted
print(f"After deletion: {weak_ref()}")  # None

# WeakValueDictionary — cache that doesn't prevent GC
cache = weakref.WeakValueDictionary()

def get_or_create(key):
    obj = cache.get(key)
    if obj is None:
        obj = ExpensiveObject(key)
        cache[key] = obj
    return obj

obj1 = get_or_create("item1")
obj2 = get_or_create("item1")  # returns cached
print(obj1 is obj2)  # True

del obj1, obj2  # cache entry removed automatically

# WeakSet — set of weak references
ws = weakref.WeakSet()
obj = ExpensiveObject("ws_item")
ws.add(obj)
print(len(ws))  # 1
del obj
print(len(ws))  # 0 — automatically removed
```

---

## 6. `__slots__` for Memory

```python
import sys
import tracemalloc

class WithDict:
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z

class WithSlots:
    __slots__ = ('x', 'y', 'z')

    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z

# Compare memory
N = 100_000

tracemalloc.start()
with_dict = [WithDict(i, i*2, i*3) for i in range(N)]
_, dict_peak = tracemalloc.get_traced_memory()
tracemalloc.stop()

tracemalloc.start()
with_slots = [WithSlots(i, i*2, i*3) for i in range(N)]
_, slots_peak = tracemalloc.get_traced_memory()
tracemalloc.stop()

print(f"{N:,} instances:")
print(f"  With __dict__: {dict_peak / 1024 / 1024:.1f} MB")
print(f"  With __slots__: {slots_peak / 1024 / 1024:.1f} MB")
print(f"  Savings: {(1 - slots_peak/dict_peak)*100:.0f}%")
```

---

## 7. Generators vs Lists — Memory

```python
import sys

# List — all values in memory at once
def squares_list(n):
    return [x**2 for x in range(n)]

# Generator — one value at a time
def squares_gen(n):
    return (x**2 for x in range(n))

n = 1_000_000
lst = squares_list(n)
gen = squares_gen(n)

print(f"List size: {sys.getsizeof(lst) / 1024 / 1024:.1f} MB")
print(f"Generator size: {sys.getsizeof(gen)} bytes")

# Generator function
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# Take first 10 Fibonacci numbers
from itertools import islice
fibs = list(islice(fibonacci(), 10))
print(f"Fibonacci: {fibs}")

# Generator pipeline — memory efficient
def read_large_file(path):
    with open(path) as f:
        for line in f:
            yield line.rstrip()

def filter_lines(lines, keyword):
    for line in lines:
        if keyword in line:
            yield line

def count_words(lines):
    for line in lines:
        yield len(line.split())

# Pipeline processes one line at a time — O(1) memory
# lines = read_large_file('huge.log')
# filtered = filter_lines(lines, 'ERROR')
# word_counts = count_words(filtered)
# total = sum(word_counts)
```

---

## 8. `timeit` — Benchmarking

```python
import timeit

# timeit.timeit — measure execution time
time_list = timeit.timeit(
    '[x**2 for x in range(1000)]',
    number=10000
)
time_gen = timeit.timeit(
    'list(x**2 for x in range(1000))',
    number=10000
)
print(f"List comprehension: {time_list:.3f}s")
print(f"Generator expr:     {time_gen:.3f}s")

# With setup code
setup = "data = list(range(1000))"
time_in = timeit.timeit("500 in data", setup=setup, number=100000)
time_set = timeit.timeit("500 in data_set", setup=setup + "; data_set = set(data)", number=100000)
print(f"\nList 'in': {time_in:.3f}s")
print(f"Set 'in':  {time_set:.3f}s")
print(f"Set is {time_in/time_set:.0f}x faster")

# timeit.repeat — multiple runs
times = timeit.repeat(
    'sorted([3,1,4,1,5,9,2,6])',
    number=100000,
    repeat=5
)
print(f"\nBest of 5: {min(times):.3f}s")

# In Jupyter: use %timeit magic
# %timeit [x**2 for x in range(1000)]
```

---

## 9. `cProfile` — CPU Profiling

```python
import cProfile
import pstats
import io

def slow_function():
    total = 0
    for i in range(100000):
        total += i * i
    return total

def fast_function():
    return sum(i * i for i in range(100000))

def main():
    for _ in range(10):
        slow_function()
        fast_function()

# Profile with cProfile
profiler = cProfile.Profile()
profiler.enable()
main()
profiler.disable()

# Print stats
stream = io.StringIO()
stats = pstats.Stats(profiler, stream=stream)
stats.sort_stats('cumulative')
stats.print_stats(10)
print(stream.getvalue())

# Or use decorator
def profile(func):
    import functools
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        pr = cProfile.Profile()
        pr.enable()
        result = func(*args, **kwargs)
        pr.disable()
        s = io.StringIO()
        ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
        ps.print_stats(5)
        print(s.getvalue())
        return result
    return wrapper

@profile
def my_function():
    return [x**2 for x in range(100000)]
```

---

## Interview Questions

**Q1: What is the difference between `sys.getsizeof` and actual memory usage?**

Answer: `sys.getsizeof` returns the size of the object itself in bytes, but doesn't include the size of referenced objects. A list of 1000 integers reports ~8KB for the list container, but the actual memory includes all the integer objects (~28 bytes each = ~28KB more). Use `tracemalloc` or a recursive `deep_size` function for true memory usage.

---

**Q2: How does Python's garbage collection work?**

Answer: Python uses two mechanisms: reference counting (primary) and cyclic garbage collector (secondary). Reference counting tracks how many references point to each object — when it reaches 0, the object is immediately freed. The cyclic GC handles reference cycles (A → B → A) that reference counting can't detect. The GC runs periodically based on allocation thresholds. You can force collection with `gc.collect()`.

---

**Q3: What are weak references and when would you use them?**

Answer: Weak references don't increment an object's reference count, so they don't prevent garbage collection. Use cases: caches (don't keep objects alive just because they're cached), observer patterns (don't prevent observed objects from being GC'd), circular references between objects. `weakref.ref(obj)` creates a weak reference; call it to get the object (returns `None` if collected). `WeakValueDictionary` and `WeakSet` are convenient containers.

---

**Q4: Why are generators more memory-efficient than lists?**

Answer: A list stores all values in memory simultaneously. A generator computes values lazily — one at a time — using O(1) memory regardless of the sequence length. For processing large datasets, generator pipelines can process millions of records with constant memory. The trade-off: generators can only be iterated once and don't support random access.

---

**Q5: How do you profile Python code for performance bottlenecks?**

Answer: Use `cProfile` for CPU profiling (which functions take the most time), `tracemalloc` for memory profiling (which allocations use the most memory), and `timeit` for micro-benchmarks (comparing two implementations). For production, use tools like `py-spy` (sampling profiler, no code changes needed) or `memory_profiler` (line-by-line memory usage).

---

**Q6: What is integer interning in Python?**

Answer: CPython caches small integers (-5 to 256) and some strings as singletons. Multiple variables with the same small integer value point to the same object. This is an implementation detail — don't rely on `is` for value comparison (use `==`). String interning happens for string literals and identifiers; you can force it with `sys.intern()`.

---

**Q7: When should you use `gc.disable()`?**

Answer: Rarely — only in performance-critical code that creates many short-lived objects and you've profiled that GC pauses are a bottleneck. The cyclic GC adds overhead when many objects are allocated. Disabling it means reference cycles won't be collected until you re-enable it or call `gc.collect()`. Always re-enable after the critical section. A better approach is to avoid creating reference cycles in the first place.

---

**Q8: What is the memory overhead of a Python object?**

Answer: Every Python object has a base overhead: 16 bytes for `None`, 28 bytes for `int`, 24 bytes for `float`, 49+ bytes for `str`. A class instance has 56 bytes base + `__dict__` (232+ bytes). Using `__slots__` eliminates `__dict__`, saving ~200 bytes per instance. This is why `__slots__` can save 40-50% memory for classes with many instances.
