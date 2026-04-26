# Memory Management in Python — Deep Dive

## Table of Contents
1. [Reference Counting](#1-reference-counting)
2. [Cyclic Garbage Collector](#2-cyclic-garbage-collector)
3. [Memory Allocator: pymalloc](#3-memory-allocator-pymalloc)
4. [Memory Profiling Tools](#4-memory-profiling-tools)
5. [__del__ and Finalizers](#5-__del__-and-finalizers)
6. [Weak References](#6-weak-references)
7. [Memory Leaks](#7-memory-leaks)
8. [__slots__ Optimization](#8-__slots__-optimization)
9. [Copy Semantics](#9-copy-semantics)
10. [Performance Notes](#10-performance-notes)
11. [Common Bugs](#11-common-bugs)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Reference Counting

CPython uses **reference counting** as its primary memory management strategy. Every Python object has a `ob_refcnt` field. When it reaches 0, the object is immediately deallocated.

```python
import sys

x = [1, 2, 3]
print(sys.getrefcount(x))   # 2: one for x, one for getrefcount's argument

y = x
print(sys.getrefcount(x))   # 3: x, y, getrefcount arg

del y
print(sys.getrefcount(x))   # 2 again
```

### What increments the reference count (Py_INCREF)

- Assigning to a variable: `y = x`
- Passing as a function argument
- Appending to a list: `lst.append(x)`
- Storing as a dict value: `d['key'] = x`
- Returning from a function

### What decrements the reference count (Py_DECREF)

- `del x`
- Variable goes out of scope
- Reassignment: `x = something_else`
- Removing from a container: `lst.remove(x)`, `del d['key']`

### Immediate deallocation

```python
# When refcount hits 0, __del__ is called and memory freed immediately
class Tracked:
    def __del__(self):
        print(f"Deleting {id(self)}")

t = Tracked()
del t   # prints "Deleting ..." immediately — no GC needed
```

### sys.getrefcount quirk

`sys.getrefcount(obj)` always returns at least 1 more than expected because passing `obj` to the function creates a temporary reference.

```python
a = "hello"
print(sys.getrefcount(a))   # may be very high — string interning!
print(sys.getrefcount([]))  # 1 (new list, only the arg reference)
```

---

## 2. Cyclic Garbage Collector

Reference counting cannot handle **reference cycles**:

```python
# Cycle: a → b → a
a = {}
b = {'ref': a}
a['ref'] = b
del a, b
# Both objects still have refcount=1 (from each other) — never freed by refcounting!
```

Python's **cyclic GC** (`gc` module) detects and collects these cycles.

### Generations

The GC uses a **generational** approach with 3 generations:

| Generation | Threshold | Rationale |
|-----------|-----------|-----------|
| 0 (young) | 700 allocations | Most objects die young |
| 1 (middle) | 10 gen-0 collections | Survivors are longer-lived |
| 2 (old) | 10 gen-1 collections | Long-lived objects |

```python
import gc

print(gc.get_threshold())   # (700, 10, 10) — default thresholds
gc.set_threshold(1000, 15, 15)   # tune for your workload

print(gc.get_count())   # (n0, n1, n2) — current counts per generation

# Manual collection
gc.collect(0)   # collect generation 0 only
gc.collect(1)   # collect generations 0 and 1
gc.collect()    # collect all generations (default: 2)

# Get all tracked objects
all_objects = gc.get_objects()

# Find what's referencing an object
referrers = gc.get_referrers(some_object)
referents = gc.get_referents(some_object)
```

### Disabling the GC

```python
gc.disable()   # disable automatic collection (manual only)
gc.enable()    # re-enable
gc.isenabled() # check status

# Use case: batch processing where you control object lifetimes
gc.disable()
try:
    # process large batch — no GC pauses
    process_batch()
finally:
    gc.enable()
    gc.collect()
```

### gc callbacks

```python
def gc_callback(phase, info):
    if phase == 'start':
        print(f"GC starting: gen {info['generation']}")
    elif phase == 'stop':
        print(f"GC done: collected {info['collected']}, uncollectable {info['uncollectable']}")

gc.callbacks.append(gc_callback)
```

---

## 3. Memory Allocator: pymalloc

CPython uses a custom allocator called **pymalloc** for objects ≤ 512 bytes (the vast majority of Python objects).

### Hierarchy

```
Arena (256 KB)
  └── Pool (4 KB, one page)
        └── Block (8, 16, 24, ... 512 bytes — size classes)
```

- **Arena**: 256 KB chunk from `malloc()`. CPython maintains a list of arenas.
- **Pool**: 4 KB page within an arena. Each pool serves one size class.
- **Block**: Fixed-size unit within a pool. Size classes are multiples of 8 bytes up to 512 bytes.

### Why pymalloc is fast

- Avoids `malloc()`/`free()` system calls for small objects.
- Blocks within a pool are reused immediately — no fragmentation.
- Size classes mean no wasted space for alignment.
- Objects > 512 bytes go directly to `malloc()`.

```python
import sys

# Small objects use pymalloc
small = [1, 2, 3]
print(sys.getsizeof(small))   # 88 bytes (list overhead + 3 pointers)

# Integer caching: -5 to 256 are pre-allocated singletons
a = 256; b = 256
print(a is b)   # True — same object

a = 257; b = 257
print(a is b)   # False (usually) — different objects
```

---

## 4. Memory Profiling Tools

### tracemalloc (built-in, Python 3.4+)

```python
import tracemalloc

tracemalloc.start()

# ... code to profile ...
data = [i**2 for i in range(100_000)]

snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')

print("Top 5 memory consumers:")
for stat in top_stats[:5]:
    print(stat)

# Compare two snapshots
snapshot1 = tracemalloc.take_snapshot()
# ... more code ...
snapshot2 = tracemalloc.take_snapshot()
top_stats = snapshot2.compare_to(snapshot1, 'lineno')
for stat in top_stats[:5]:
    print(stat)

tracemalloc.stop()
```

### memory_profiler (third-party)

```python
# pip install memory-profiler
from memory_profiler import profile

@profile
def my_function():
    a = [1] * 1_000_000
    b = [2] * 2_000_000
    del a
    return b

# Run: python -m memory_profiler script.py
# Output shows line-by-line memory usage
```

### objgraph (third-party)

```python
# pip install objgraph
import objgraph

# Show most common types
objgraph.show_most_common_types(limit=10)

# Show growth since last call
objgraph.show_growth()

# Find what's keeping an object alive
objgraph.show_backrefs(some_object, max_depth=3)

# Find reference chains to an object
objgraph.find_backref_chain(some_object, objgraph.is_proper_module)
```

### sys.getsizeof

```python
import sys

print(sys.getsizeof(42))          # 28 bytes (int)
print(sys.getsizeof("hello"))     # 54 bytes (str)
print(sys.getsizeof([1,2,3]))     # 88 bytes (list — does NOT include elements!)
print(sys.getsizeof((1,2,3)))     # 72 bytes (tuple)
print(sys.getsizeof({'a': 1}))    # 232 bytes (dict)

# Deep size (including referenced objects):
def deep_size(obj, seen=None):
    if seen is None:
        seen = set()
    obj_id = id(obj)
    if obj_id in seen:
        return 0
    seen.add(obj_id)
    size = sys.getsizeof(obj)
    if isinstance(obj, dict):
        size += sum(deep_size(k, seen) + deep_size(v, seen) for k, v in obj.items())
    elif hasattr(obj, '__dict__'):
        size += deep_size(obj.__dict__, seen)
    elif hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes)):
        size += sum(deep_size(i, seen) for i in obj)
    return size
```

---

## 5. __del__ and Finalizers

`__del__` is called when an object's reference count reaches 0 (or when the GC collects it).

```python
class Resource:
    def __init__(self, name):
        self.name = name
        print(f"Acquired: {self.name}")

    def __del__(self):
        print(f"Released: {self.name}")
        # WARNING: don't rely on this for critical cleanup!

r = Resource("DB Connection")
del r   # prints "Released: DB Connection" immediately
```

### Pitfalls of __del__

1. **Not guaranteed to run**: if the interpreter exits with cycles, `__del__` may not be called.
2. **Resurrection**: `__del__` can create new references to the object, preventing deallocation.
3. **Exception suppression**: exceptions in `__del__` are printed to stderr and ignored.
4. **Ordering**: when the interpreter shuts down, global variables may already be `None`.
5. **Cycles**: objects in reference cycles with `__del__` were uncollectable before Python 3.4.

```python
# WRONG: relying on __del__ for cleanup
class FileWrapper:
    def __init__(self, path):
        self.f = open(path)
    def __del__(self):
        self.f.close()   # may never run!

# CORRECT: use context manager
class FileWrapper:
    def __init__(self, path):
        self.f = open(path)
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.f.close()   # guaranteed to run
```

### weakref.finalize — safer alternative

```python
import weakref

class Resource:
    pass

def cleanup(name):
    print(f"Cleaning up {name}")

r = Resource()
finalizer = weakref.finalize(r, cleanup, "my resource")
del r   # triggers cleanup immediately
# finalizer.alive → False after cleanup
```

---

## 6. Weak References

A **weak reference** doesn't increment the reference count. The referenced object can be garbage collected even if weak references exist.

```python
import weakref

class MyObject:
    def __init__(self, name):
        self.name = name

obj = MyObject("test")
weak = weakref.ref(obj)

print(weak())        # <MyObject object> — dereference
print(weak().name)   # "test"

del obj
print(weak())        # None — object was collected
```

### WeakValueDictionary — cache without preventing GC

```python
import weakref

cache = weakref.WeakValueDictionary()

def get_object(key):
    if key not in cache:
        obj = MyObject(key)
        cache[key] = obj
        return obj
    return cache[key]

obj = get_object("item1")
print(len(cache))   # 1
del obj
print(len(cache))   # 0 — automatically removed when obj collected
```

### WeakKeyDictionary and WeakSet

```python
# WeakKeyDictionary: keys are weak references
wkd = weakref.WeakKeyDictionary()
key = MyObject("key")
wkd[key] = "value"
del key   # entry automatically removed

# WeakSet: set of weak references
ws = weakref.WeakSet()
obj = MyObject("item")
ws.add(obj)
del obj   # automatically removed from set
```

---

## 7. Memory Leaks

### Common causes

1. **Global containers accumulating data**
```python
# LEAK: cache grows forever
_cache = {}
def process(key, data):
    _cache[key] = data   # never evicted!
    return data

# Fix: use functools.lru_cache or implement eviction
```

2. **Circular references with __del__** (pre-Python 3.4)
```python
# Python 3.4+ handles this, but still avoid unnecessary cycles
class Node:
    def __init__(self):
        self.children = []
        self.parent = None   # creates cycle: parent → child → parent
```

3. **Event listeners / callbacks not removed**
```python
class EventEmitter:
    def __init__(self):
        self._listeners = []   # strong references!

    def on(self, callback):
        self._listeners.append(callback)   # keeps callback alive

# Fix: use weakref for listeners
import weakref
class EventEmitter:
    def __init__(self):
        self._listeners = weakref.WeakSet()
```

4. **Thread-local storage**
```python
import threading
local = threading.local()
# local.data accumulates per thread and is never cleaned up
```

5. **Unclosed file handles / sockets**
```python
# LEAK: file handle not closed
def read_file(path):
    f = open(path)
    return f.read()   # f never closed!

# Fix: use context manager
def read_file(path):
    with open(path) as f:
        return f.read()
```

### Detecting leaks with tracemalloc

```python
import tracemalloc
import gc

tracemalloc.start()
snapshot1 = tracemalloc.take_snapshot()

# Run suspected leaky code
for _ in range(1000):
    leaky_function()

gc.collect()
snapshot2 = tracemalloc.take_snapshot()

stats = snapshot2.compare_to(snapshot1, 'traceback')
for stat in stats[:10]:
    print(stat)
    for line in stat.traceback.format():
        print(line)
```

---

## 8. __slots__ Optimization

By default, Python instances store attributes in a `__dict__` (a hash table). `__slots__` replaces this with a fixed-size array, saving memory and improving attribute access speed.

```python
import sys

class WithDict:
    def __init__(self, x, y):
        self.x = x
        self.y = y

class WithSlots:
    __slots__ = ('x', 'y')
    def __init__(self, x, y):
        self.x = x
        self.y = y

d = WithDict(1, 2)
s = WithSlots(1, 2)

print(sys.getsizeof(d))           # 48 bytes (instance)
print(sys.getsizeof(d.__dict__))  # 232 bytes (dict overhead!)
print(sys.getsizeof(s))           # 56 bytes (no __dict__)
# Total: WithDict ≈ 280 bytes, WithSlots ≈ 56 bytes — ~5x savings
```

### __slots__ rules and limitations

```python
class Base:
    __slots__ = ('x',)

class Child(Base):
    __slots__ = ('y',)   # must redeclare slots; don't include parent slots

# Limitations:
# 1. Cannot add arbitrary attributes
s = WithSlots(1, 2)
s.z = 3   # AttributeError: 'WithSlots' object has no attribute 'z'

# 2. Multiple inheritance with __slots__ is tricky
# 3. __weakref__ not available unless explicitly included
class Slotted:
    __slots__ = ('x', '__weakref__', '__dict__')  # add __dict__ to allow dynamic attrs
```

### When to use __slots__

- Classes instantiated millions of times (e.g., nodes in a tree, records in a dataset)
- Memory-constrained environments
- When attribute access speed is critical (slots use direct offset, not hash lookup)

---

## 9. Copy Semantics

### Assignment — reference, not copy

```python
a = [1, 2, [3, 4]]
b = a           # b is the same object
b.append(5)
print(a)        # [1, 2, [3, 4], 5] — a is modified!
```

### Shallow copy

```python
import copy

a = [1, 2, [3, 4]]
b = copy.copy(a)    # or a.copy() or a[:] or list(a)
b.append(5)
print(a)            # [1, 2, [3, 4]] — a unchanged

b[2].append(99)
print(a)            # [1, 2, [3, 4, 99]] — nested list IS shared!
```

### Deep copy

```python
a = [1, 2, [3, 4]]
b = copy.deepcopy(a)
b[2].append(99)
print(a)   # [1, 2, [3, 4]] — completely independent
```

### Deep copy with custom objects

```python
class Node:
    def __init__(self, value, children=None):
        self.value = value
        self.children = children or []

    def __copy__(self):
        # Custom shallow copy
        new = Node(self.value)
        new.children = self.children   # shared reference
        return new

    def __deepcopy__(self, memo):
        # Custom deep copy
        new = Node(self.value)
        memo[id(self)] = new   # register before recursing (handles cycles)
        new.children = copy.deepcopy(self.children, memo)
        return new
```

### Performance comparison

```python
import copy, timeit

data = list(range(1000))
nested = [list(range(100)) for _ in range(100)]

# Shallow copy: O(n) — copies top-level container
timeit.timeit(lambda: copy.copy(data), number=10000)

# Deep copy: O(n*m) — recursively copies everything
timeit.timeit(lambda: copy.deepcopy(nested), number=1000)
# deepcopy is 10-100x slower than copy for nested structures
```

---

## 10. Performance Notes

| Technique | Memory Savings | Speed Impact |
|-----------|---------------|-------------|
| `__slots__` | 40-80% per instance | +10-20% attribute access |
| Generators vs lists | Up to 99% for large sequences | Slight overhead per yield |
| `array.array` vs list | 4-8x for numeric data | Faster for numeric ops |
| `numpy` arrays | 8-10x vs Python lists | Much faster for math |
| `weakref` | Prevents retention | Slight dereferencing overhead |
| `gc.disable()` | No GC pauses | Risk of uncollected cycles |

```python
# array.array: typed, compact storage
import array
arr = array.array('i', range(1_000_000))   # 4 MB
lst = list(range(1_000_000))               # 35 MB
```

---

## 11. Common Bugs

### Bug 1: Assuming __del__ runs deterministically

```python
# WRONG: relying on __del__ for resource cleanup
# It may not run if there are cycles, or may run at interpreter shutdown
# CORRECT: always use context managers (with statement)
```

### Bug 2: Modifying a list while iterating

```python
lst = [1, 2, 3, 4, 5]
for item in lst:
    if item % 2 == 0:
        lst.remove(item)   # BUG: skips elements!
print(lst)   # [1, 3, 5] — but 4 was skipped!

# Fix: iterate over a copy
for item in lst[:]:
    if item % 2 == 0:
        lst.remove(item)
# Or: use list comprehension
lst = [item for item in lst if item % 2 != 0]
```

### Bug 3: Integer identity vs equality

```python
a = 1000
b = 1000
print(a == b)   # True
print(a is b)   # False (outside -5..256 cache)
# Never use 'is' for value comparison — use '=='
```

### Bug 4: Forgetting that sys.getsizeof doesn't include referenced objects

```python
lst = [list(range(1000)) for _ in range(1000)]
print(sys.getsizeof(lst))   # ~8056 bytes — just the list container!
# Actual memory: ~8 MB (1000 inner lists × ~8 KB each)
```

---

## 12. Interview Q&A

**Q1: How does Python manage memory?**

CPython uses two mechanisms: (1) **Reference counting** — every object has a `ob_refcnt` field; when it reaches 0, the object is immediately deallocated. (2) **Cyclic garbage collector** — handles reference cycles that reference counting can't detect. The GC uses a generational approach (3 generations) and runs periodically based on allocation thresholds.

---

**Q2: What is a reference cycle and how does Python handle it?**

A reference cycle occurs when objects reference each other, preventing their reference counts from reaching 0. Example: `a = {}; b = {'ref': a}; a['ref'] = b; del a, b` — both objects have refcount=1 from each other. Python's cyclic GC detects these by traversing the object graph and identifying unreachable cycles. It then breaks the cycles and deallocates the objects.

---

**Q3: What are Python's GC generations and why are there three?**

The generational hypothesis: most objects die young. Generation 0 (young) is collected most frequently (every 700 allocations). Objects that survive gen-0 collection move to gen-1, collected every 10 gen-0 collections. Survivors move to gen-2, collected every 10 gen-1 collections. This reduces GC overhead — long-lived objects are rarely scanned.

---

**Q4: What is `__slots__` and when should you use it?**

`__slots__` replaces the instance `__dict__` with a fixed-size array of slots. Benefits: 40-80% memory reduction per instance, faster attribute access (direct offset vs hash lookup). Use it when creating millions of instances of a class with a fixed set of attributes. Limitations: can't add arbitrary attributes, complicates multiple inheritance, no `__weakref__` by default.

---

**Q5: What is the difference between `copy.copy()` and `copy.deepcopy()`?**

`copy.copy()` creates a shallow copy — a new container object, but the elements are the same objects (shared references). Modifying a nested mutable object affects both copies. `copy.deepcopy()` recursively copies all objects, creating a completely independent copy. Deep copy handles cycles via a `memo` dict. Deep copy is significantly slower (10-100x) for nested structures.

---

**Q6: What are weak references and when do you use them?**

A weak reference doesn't increment the reference count, so the referenced object can be garbage collected. Use cases: (1) caches — `WeakValueDictionary` automatically removes entries when values are collected; (2) observer/event patterns — listeners don't prevent the observed object from being collected; (3) breaking reference cycles. Access via `weakref.ref(obj)()` — returns `None` if the object was collected.

---

**Q7: How does `tracemalloc` work and what can it tell you?**

`tracemalloc` hooks into Python's memory allocator to track every allocation with its traceback. `take_snapshot()` captures the current state. `compare_to()` shows what grew between two snapshots. It reports size, count, and the exact line of code responsible for each allocation. It's the best built-in tool for finding memory leaks and understanding memory usage patterns.

---

**Q8: Why is `__del__` unreliable and what should you use instead?**

`__del__` is unreliable because: (1) it may not run if the interpreter exits with cycles; (2) at interpreter shutdown, global variables may be `None`; (3) exceptions are silently ignored; (4) it can resurrect objects. Use context managers (`__enter__`/`__exit__`) for deterministic cleanup, or `weakref.finalize()` for cleanup when an object is collected.

---

**Q9: What is `sys.getrefcount()` and why does it return a higher number than expected?**

`sys.getrefcount(obj)` returns the reference count of `obj`. It always returns at least 1 more than the "real" count because passing `obj` to `getrefcount` creates a temporary reference (the function argument). For interned strings and small integers, the count may be very high due to Python's internal caching.

---

**Q10: How would you detect and fix a memory leak in a Python application?**

1. **Detect**: use `tracemalloc` to compare snapshots before and after suspected leaky code; use `objgraph.show_growth()` to see which types are accumulating.
2. **Common causes**: global caches without eviction, event listeners holding references, unclosed resources, circular references.
3. **Fix**: add cache eviction (LRU), use `weakref` for listeners, use context managers for resources, break cycles with `weakref`.
4. **Verify**: re-run profiling after fix to confirm memory stabilizes.
