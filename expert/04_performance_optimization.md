# Expert 04 — Performance Optimization

## Profiling Tools

```python
# cProfile — function-level profiling
import cProfile
cProfile.run('my_function()', sort='cumulative')

# line_profiler — line-level (requires pip install line-profiler)
# @profile decorator, then: kernprof -l -v script.py

# memory_profiler — memory usage (pip install memory-profiler)
# @profile decorator, then: python -m memory_profiler script.py

# timeit — micro-benchmarks
import timeit
timeit.timeit('"-".join(str(n) for n in range(100))', number=10000)
```

## Key Optimization Techniques

### 1. Use Built-ins and C Extensions
```python
# Slow: Python loop
total = 0
for x in data:
    total += x

# Fast: built-in sum (C implementation)
total = sum(data)

# Faster: numpy for numerical data
import numpy as np
total = np.sum(data)
```

### 2. Avoid Repeated Attribute Lookup
```python
# Slow
for i in range(1000):
    result.append(i)  # looks up 'append' each iteration

# Fast
append = result.append
for i in range(1000):
    append(i)
```

### 3. Use Local Variables in Loops
```python
import math

# Slow — global lookup each iteration
for x in data:
    y = math.sqrt(x)

# Fast — local reference
sqrt = math.sqrt
for x in data:
    y = sqrt(x)
```

### 4. String Building
```python
# O(n²) — creates new string each time
result = ""
for s in strings:
    result += s

# O(n) — join
result = "".join(strings)
```

### 5. __slots__ for Memory
```python
class WithSlots:
    __slots__ = ('x', 'y', 'z')
    def __init__(self, x, y, z):
        self.x, self.y, self.z = x, y, z

class WithoutSlots:
    def __init__(self, x, y, z):
        self.x, self.y, self.z = x, y, z

import sys
a = WithSlots(1, 2, 3)
b = WithoutSlots(1, 2, 3)
print(sys.getsizeof(a))  # ~56 bytes
print(sys.getsizeof(b))  # ~48 bytes + dict overhead
```

### 6. lru_cache / cache
```python
from functools import lru_cache, cache

@cache  # Python 3.9+ — unbounded cache
def fib(n):
    if n <= 1: return n
    return fib(n-1) + fib(n-2)

@lru_cache(maxsize=128)  # bounded LRU cache
def expensive(x, y):
    return x ** y
```

### 7. Generators for Memory
```python
# Memory: O(n) — stores all values
def get_squares_list(n):
    return [x**2 for x in range(n)]

# Memory: O(1) — lazy
def get_squares_gen(n):
    return (x**2 for x in range(n))
```

### 8. NumPy Vectorization
```python
import numpy as np

data = np.array([1.0, 2.0, 3.0, 4.0, 5.0])

# Vectorized — no Python loop
result = np.sqrt(data) * 2 + 1

# vs Python loop (100x slower for large arrays)
result = [x**0.5 * 2 + 1 for x in data]
```

## Interview Questions

### Q1: How do you profile a Python program?
**Answer:**
```python
# Quick: cProfile
import cProfile
with cProfile.Profile() as pr:
    my_function()
pr.print_stats(sort='cumulative')

# Detailed: line_profiler
# pip install line_profiler
# @profile on function, then: kernprof -l -v script.py

# Memory: memory_profiler
# pip install memory_profiler
# @profile on function, then: python -m memory_profiler script.py

# In Jupyter: %timeit, %prun, %lprun, %memit
```

### Q2: What is the time complexity of common Python operations?
**Answer:**
| Operation | list | dict | set |
|---|---|---|---|
| Access by index | O(1) | — | — |
| Search (in) | O(n) | O(1) avg | O(1) avg |
| Insert at end | O(1) amortized | O(1) avg | O(1) avg |
| Insert at start | O(n) | — | — |
| Delete by value | O(n) | O(1) avg | O(1) avg |
| Sort | O(n log n) | — | — |

### Q3: When should you use `__slots__`?
**Answer:**
Use `__slots__` when:
- Creating millions of instances (saves ~40-50% memory)
- You know all attributes at class definition time
- You want to prevent accidental attribute creation

Downsides:
- Cannot add new attributes dynamically
- Multiple inheritance with slots is complex
- Breaks `__dict__` and `__weakref__` by default

### Q4: What is the GIL's impact on CPU-bound code?
**Answer:**
The GIL prevents true parallel execution of Python bytecode. For CPU-bound work:
- `threading` → no speedup (GIL prevents parallel execution)
- `multiprocessing` → true parallelism (separate processes, no GIL)
- `concurrent.futures.ProcessPoolExecutor` → easy multiprocessing
- NumPy/Pandas → release GIL in C extensions

### Q5: How does Python's `list.append()` achieve O(1) amortized?
**Answer:**
Python lists use **dynamic arrays**. When capacity is exceeded, a new array is allocated with ~1.125x the current size (growth factor). The occasional O(n) resize is amortized over many O(1) appends, giving O(1) amortized.

```python
import sys
lst = []
prev_size = sys.getsizeof(lst)
for i in range(20):
    lst.append(i)
    size = sys.getsizeof(lst)
    if size != prev_size:
        print(f'Resize at len={len(lst)}: {prev_size} -> {size} bytes')
        prev_size = size
```
