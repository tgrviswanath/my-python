# Iterators & Generators — Deep Dive

## Table of Contents
1. [Iterator Protocol](#1-iterator-protocol)
2. [Generator Functions](#2-generator-functions)
3. [Generator Expressions vs List Comprehensions](#3-generator-expressions-vs-list-comprehensions)
4. [Generator Methods: send(), throw(), close()](#4-generator-methods)
5. [Coroutines via Generators](#5-coroutines-via-generators)
6. [itertools Deep Dive](#6-itertools-deep-dive)
7. [Infinite Iterators](#7-infinite-iterators)
8. [Custom Iterator Classes](#8-custom-iterator-classes)
9. [Lazy Evaluation & Memory Efficiency](#9-lazy-evaluation--memory-efficiency)
10. [Performance Notes](#10-performance-notes)
11. [Common Bugs](#11-common-bugs)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Iterator Protocol

An **iterator** is any object that implements two dunder methods:

| Method | Purpose |
|--------|---------|
| `__iter__()` | Returns the iterator object itself |
| `__next__()` | Returns the next value; raises `StopIteration` when exhausted |

An **iterable** only needs `__iter__()` — it returns an iterator. Lists, tuples, dicts, sets, and strings are iterables but not iterators themselves.

```python
# Manually driving the iterator protocol
nums = [10, 20, 30]
it = iter(nums)          # calls nums.__iter__()
print(next(it))          # 10  — calls it.__next__()
print(next(it))          # 20
print(next(it))          # 30
next(it)                 # raises StopIteration
```

### How `for` loops work under the hood

```python
# This for loop:
for x in [1, 2, 3]:
    print(x)

# Is exactly equivalent to:
_iter = iter([1, 2, 3])
while True:
    try:
        x = next(_iter)
        print(x)
    except StopIteration:
        break
```

### Iterable vs Iterator distinction

```python
my_list = [1, 2, 3]
print(hasattr(my_list, '__iter__'))   # True  — iterable
print(hasattr(my_list, '__next__'))   # False — NOT an iterator

my_iter = iter(my_list)
print(hasattr(my_iter, '__iter__'))   # True
print(hasattr(my_iter, '__next__'))   # True  — iterator

# Iterators are their own iterables
print(my_iter is iter(my_iter))       # True
```

### StopIteration propagation

In Python 3.7+ (PEP 479), if a `StopIteration` is raised *inside* a generator, it is converted to a `RuntimeError`. This prevents accidental generator termination from nested iterators.

```python
def bad_gen():
    raise StopIteration   # RuntimeError in Python 3.7+

def safe_gen():
    return
    yield  # makes it a generator; return causes StopIteration cleanly
```

---

## 2. Generator Functions

A **generator function** contains at least one `yield` statement. Calling it returns a **generator object** — a lazy iterator that computes values on demand.

### Generator state machine

A generator has four states (accessible via `inspect.getgeneratorstate()`):

| State | Meaning |
|-------|---------|
| `GEN_CREATED` | Suspended at start, never resumed |
| `GEN_RUNNING` | Currently executing |
| `GEN_SUSPENDED` | Suspended at a `yield` expression |
| `GEN_CLOSED` | Finished or explicitly closed |

```python
import inspect

def countdown(n):
    print("Starting countdown")
    while n > 0:
        yield n
        n -= 1
    print("Done")

gen = countdown(3)
print(inspect.getgeneratorstate(gen))   # GEN_CREATED

next(gen)   # prints "Starting countdown", yields 3
print(inspect.getgeneratorstate(gen))   # GEN_SUSPENDED

list(gen)   # exhausts: yields 2, 1, prints "Done"
print(inspect.getgeneratorstate(gen))   # GEN_CLOSED
```

### yield from

`yield from` delegates to a sub-generator, transparently forwarding `send()`, `throw()`, and `close()` calls, and captures the sub-generator's return value.

```python
def inner():
    yield 1
    yield 2
    return "inner done"

def outer():
    result = yield from inner()   # delegates; result = "inner done"
    yield f"outer got: {result}"

list(outer())   # [1, 2, 'outer got: inner done']
```

`yield from` also works with any iterable:

```python
def flatten(nested):
    for item in nested:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item

list(flatten([1, [2, [3, 4]], 5]))   # [1, 2, 3, 4, 5]
```

### Generator return value

Generators can `return` a value. It becomes the `value` attribute of the `StopIteration` exception:

```python
def gen_with_return():
    yield 1
    yield 2
    return "final"

g = gen_with_return()
next(g)   # 1
next(g)   # 2
try:
    next(g)
except StopIteration as e:
    print(e.value)   # "final"
```

---

## 3. Generator Expressions vs List Comprehensions

```python
import sys

# List comprehension — builds entire list in memory
squares_list = [x**2 for x in range(1_000_000)]
print(sys.getsizeof(squares_list))   # ~8 MB

# Generator expression — lazy, O(1) memory
squares_gen = (x**2 for x in range(1_000_000))
print(sys.getsizeof(squares_gen))    # ~112 bytes
```

### When to use which

| Scenario | Use |
|----------|-----|
| Need to iterate once | Generator expression |
| Need random access / indexing | List comprehension |
| Need `len()` | List comprehension |
| Chaining multiple transformations | Generator pipeline |
| Result used multiple times | List comprehension |

### Generator pipeline (lazy ETL)

```python
import csv

def read_rows(filename):
    with open(filename) as f:
        yield from csv.DictReader(f)

def filter_active(rows):
    return (r for r in rows if r['status'] == 'active')

def extract_names(rows):
    return (r['name'] for r in rows)

# Nothing executes until we consume:
# pipeline = extract_names(filter_active(read_rows('users.csv')))
# for name in pipeline: ...
```

---

## 4. Generator Methods

### send(value)

`send()` resumes the generator AND injects a value as the result of the current `yield` expression. The first call must be `send(None)` or `next()` to advance to the first yield.

```python
def accumulator():
    total = 0
    while True:
        value = yield total   # yield sends total out; receives value in
        if value is None:
            break
        total += value

acc = accumulator()
next(acc)          # prime: advance to first yield, returns 0
acc.send(10)       # total = 10, returns 10
acc.send(20)       # total = 30, returns 30
acc.send(5)        # total = 35, returns 35
```

### throw(type, value=None, traceback=None)

Raises an exception at the point where the generator is suspended:

```python
def resilient_gen():
    while True:
        try:
            value = yield
        except ValueError as e:
            print(f"Caught: {e}")
        except GeneratorExit:
            print("Generator closing")
            return

g = resilient_gen()
next(g)
g.throw(ValueError, "bad input")   # prints "Caught: bad input"
g.close()                           # prints "Generator closing"
```

### close()

Throws `GeneratorExit` into the generator. The generator should either handle it and return, or let it propagate. If the generator yields again after `GeneratorExit`, a `RuntimeError` is raised.

```python
def resource_gen():
    print("Acquiring resource")
    try:
        yield 1
        yield 2
    finally:
        print("Releasing resource")   # always runs on close()

g = resource_gen()
next(g)
g.close()   # prints "Releasing resource"
```

---

## 5. Coroutines via Generators

Before `async/await` (PEP 492), coroutines were implemented using generators with `send()`. This pattern is the conceptual foundation of modern asyncio.

```python
def coroutine(func):
    """Decorator to auto-prime a coroutine generator."""
    from functools import wraps
    @wraps(func)
    def wrapper(*args, **kwargs):
        gen = func(*args, **kwargs)
        next(gen)   # prime
        return gen
    return wrapper

@coroutine
def grep(pattern):
    print(f"Looking for {pattern!r}")
    while True:
        line = yield
        if pattern in line:
            print(line)

g = grep("python")
g.send("I love python programming")   # prints the line
g.send("Java is also fine")           # no output
g.send("python is great")             # prints the line
```

### Generator-based pipeline with coroutines

```python
@coroutine
def printer():
    while True:
        line = yield
        print(line)

@coroutine
def broadcast(*targets):
    while True:
        item = yield
        for t in targets:
            t.send(item)

@coroutine
def grep_filter(pattern, target):
    while True:
        line = yield
        if pattern in line:
            target.send(line)

p = printer()
g = grep_filter("error", p)
g.send("info: all good")
g.send("error: something failed")   # printed
```

---

## 6. itertools Deep Dive

```python
import itertools
```

### Chaining & Slicing

```python
# chain — concatenate iterables lazily
list(itertools.chain([1,2], [3,4], [5]))   # [1, 2, 3, 4, 5]
list(itertools.chain.from_iterable([[1,2],[3,4]]))  # [1, 2, 3, 4]

# islice — lazy slicing (works on infinite iterators!)
list(itertools.islice(range(100), 5, 15, 2))   # [5, 7, 9, 11, 13]
```

### Combinatorics

```python
# product — cartesian product (nested loops)
list(itertools.product('AB', repeat=2))
# [('A','A'),('A','B'),('B','A'),('B','B')]

list(itertools.product([1,2], [3,4]))
# [(1,3),(1,4),(2,3),(2,4)]

# combinations — ordered subsets, no repetition
list(itertools.combinations('ABCD', 2))
# [('A','B'),('A','C'),('A','D'),('B','C'),('B','D'),('C','D')]

# combinations_with_replacement
list(itertools.combinations_with_replacement('AB', 2))
# [('A','A'),('A','B'),('B','B')]

# permutations — all orderings
list(itertools.permutations('ABC', 2))
# [('A','B'),('A','C'),('B','A'),('B','C'),('C','A'),('C','B')]
```

### Grouping & Accumulation

```python
# groupby — groups consecutive elements with same key
# IMPORTANT: input must be sorted by the key first!
data = [('a', 1), ('a', 2), ('b', 3), ('b', 4), ('a', 5)]
data.sort(key=lambda x: x[0])
for key, group in itertools.groupby(data, key=lambda x: x[0]):
    print(key, list(group))
# a [('a', 1), ('a', 2)]
# b [('b', 3), ('b', 4)]
# a [('a', 5)]  ← new group because not consecutive before sort

# accumulate — running totals (like reduce but yields intermediates)
import operator
list(itertools.accumulate([1,2,3,4,5]))                    # [1,3,6,10,15]
list(itertools.accumulate([1,2,3,4,5], operator.mul))      # [1,2,6,24,120]
list(itertools.accumulate([3,1,4,1,5], max))               # [3,3,4,4,5]
```

### Splitting & Zipping

```python
# tee — create n independent iterators from one
# WARNING: memory grows if iterators diverge significantly
gen = (x**2 for x in range(5))
a, b = itertools.tee(gen, 2)
list(a)   # [0, 1, 4, 9, 16]
list(b)   # [0, 1, 4, 9, 16]  — independent copy

# zip_longest — zip with fill value for unequal lengths
list(itertools.zip_longest([1,2,3], ['a','b'], fillvalue='-'))
# [(1,'a'), (2,'b'), (3,'-')]

# compress — filter by boolean selector
list(itertools.compress('ABCDE', [1,0,1,0,1]))   # ['A','C','E']

# dropwhile / takewhile
list(itertools.dropwhile(lambda x: x < 3, [1,2,3,4,1]))  # [3,4,1]
list(itertools.takewhile(lambda x: x < 3, [1,2,3,4,1]))  # [1,2]

# starmap — map with argument unpacking
list(itertools.starmap(pow, [(2,3),(3,2),(4,2)]))   # [8, 9, 16]

# pairwise (Python 3.10+)
list(itertools.pairwise([1,2,3,4]))   # [(1,2),(2,3),(3,4)]
```

---

## 7. Infinite Iterators

```python
import itertools

# count(start=0, step=1) — infinite arithmetic sequence
for i in itertools.islice(itertools.count(10, 2), 5):
    print(i)   # 10, 12, 14, 16, 18

# cycle(iterable) — infinite repetition of iterable
colors = itertools.cycle(['red', 'green', 'blue'])
[next(colors) for _ in range(7)]
# ['red','green','blue','red','green','blue','red']

# repeat(object, times=None) — repeat object N times or infinitely
list(itertools.repeat(42, 3))   # [42, 42, 42]

# Practical: zip with count for enumeration
data = ['a', 'b', 'c']
list(zip(itertools.count(1), data))   # [(1,'a'),(2,'b'),(3,'c')]

# Practical: round-robin scheduler
def roundrobin(*iterables):
    nexts = itertools.cycle(iter(it).__next__ for it in iterables)
    pending = len(iterables)
    while pending:
        try:
            yield next(nexts)()
        except StopIteration:
            pending -= 1
            nexts = itertools.cycle(itertools.islice(nexts, pending))

list(roundrobin('ABC', 'D', 'EF'))   # ['A','D','E','B','F','C']
```

---

## 8. Custom Iterator Classes

### Basic iterator

```python
class Range:
    """Custom range-like iterator."""
    def __init__(self, start, stop, step=1):
        self.current = start
        self.stop = stop
        self.step = step

    def __iter__(self):
        return self   # iterator is its own iterable

    def __next__(self):
        if self.current >= self.stop:
            raise StopIteration
        value = self.current
        self.current += self.step
        return value

list(Range(0, 10, 2))   # [0, 2, 4, 6, 8]
```

### Separating iterable from iterator (reusable)

```python
class NumberSequence:
    """Iterable — can be iterated multiple times."""
    def __init__(self, data):
        self.data = data

    def __iter__(self):
        return NumberIterator(self.data)   # new iterator each time

class NumberIterator:
    """Iterator — single-use."""
    def __init__(self, data):
        self.data = data
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.index >= len(self.data):
            raise StopIteration
        value = self.data[self.index]
        self.index += 1
        return value

seq = NumberSequence([1, 2, 3])
print(list(seq))   # [1, 2, 3]
print(list(seq))   # [1, 2, 3]  — works again!
```

### Fibonacci iterator

```python
class Fibonacci:
    def __init__(self, limit):
        self.limit = limit
        self.a, self.b = 0, 1

    def __iter__(self):
        return self

    def __next__(self):
        if self.a > self.limit:
            raise StopIteration
        value = self.a
        self.a, self.b = self.b, self.a + self.b
        return value

list(Fibonacci(100))   # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
```

---

## 9. Lazy Evaluation & Memory Efficiency

### Memory comparison

```python
import sys
import tracemalloc

# List: all values in memory at once
tracemalloc.start()
data = [x**2 for x in range(1_000_000)]
snapshot = tracemalloc.take_snapshot()
list_mem = sum(s.size for s in snapshot.statistics('lineno'))
tracemalloc.stop()

# Generator: O(1) memory
tracemalloc.start()
data = (x**2 for x in range(1_000_000))
snapshot = tracemalloc.take_snapshot()
gen_mem = sum(s.size for s in snapshot.statistics('lineno'))
tracemalloc.stop()

# list_mem ≈ 8 MB, gen_mem ≈ a few hundred bytes
```

### Lazy file processing

```python
def read_large_file(filepath):
    """Process a multi-GB file without loading it into memory."""
    with open(filepath) as f:
        for line in f:           # file object is itself an iterator
            yield line.strip()

def parse_json_lines(lines):
    import json
    for line in lines:
        if line:
            yield json.loads(line)

def filter_records(records, key, value):
    return (r for r in records if r.get(key) == value)

# Pipeline — only one record in memory at a time:
# pipeline = filter_records(parse_json_lines(read_large_file('big.jsonl')), 'status', 'active')
# for record in pipeline: process(record)
```

---

## 10. Performance Notes

| Operation | Time Complexity | Memory |
|-----------|----------------|--------|
| `next()` on generator | O(1) | O(1) |
| `list()` from generator | O(n) | O(n) |
| `itertools.chain` | O(1) setup | O(1) |
| `itertools.tee` | O(n) total | O(n) divergence |
| Generator expression | O(1) creation | O(1) |
| List comprehension | O(n) | O(n) |

**Key performance insights:**

- Generators avoid materializing intermediate collections in pipelines — critical for large datasets.
- `itertools` functions are implemented in C — significantly faster than equivalent Python loops.
- `tee()` uses internal deque buffers; if one iterator races far ahead of the other, memory usage grows proportionally.
- `groupby()` only groups *consecutive* equal elements — always sort first if you want all groups.
- Generator function call overhead is slightly higher than a regular function call due to frame creation, but amortized over many yields it's negligible.
- For CPU-bound tight loops, a list comprehension can be faster than a generator due to reduced frame switching overhead.

---

## 11. Common Bugs

### Bug 1: Exhausted generator used twice

```python
gen = (x for x in range(5))
print(list(gen))   # [0, 1, 2, 3, 4]
print(list(gen))   # []  ← BUG: generator is exhausted!

# Fix: use a function that returns a new generator each time
def make_gen():
    return (x for x in range(5))
```

### Bug 2: Forgetting to prime a coroutine

```python
def my_coroutine():
    while True:
        x = yield
        print(x)

c = my_coroutine()
c.send(42)   # TypeError: can't send non-None value to a just-started generator
# Fix: next(c) or c.send(None) first
next(c)
c.send(42)   # works
```

### Bug 3: groupby without sorting

```python
data = ['b', 'a', 'b', 'a']
# Wrong:
for k, g in itertools.groupby(data):
    print(k, list(g))   # b ['b'], a ['a'], b ['b'], a ['a']  ← 4 groups!

# Correct:
for k, g in itertools.groupby(sorted(data)):
    print(k, list(g))   # a ['a', 'a'], b ['b', 'b']
```

### Bug 4: Consuming a tee iterator unevenly

```python
a, b = itertools.tee(range(1_000_000))
list(a)   # consumes all — tee buffers 1M items for b!
# Fix: consume both iterators at similar rates, or just use list()
```

### Bug 5: StopIteration inside generator (Python 3.7+)

```python
def gen():
    next(iter([]))   # raises StopIteration internally
    yield 1

list(gen())   # RuntimeError: generator raised StopIteration
# Fix: catch StopIteration explicitly
def gen():
    try:
        next(iter([]))
    except StopIteration:
        pass
    yield 1
```

### Bug 6: Mutable default in generator

```python
def gen(data=[]):
    yield from data

# data=[] is shared across calls — classic mutable default bug
# Fix: use None sentinel
def gen(data=None):
    if data is None:
        data = []
    yield from data
```

---

## 12. Interview Q&A

**Q1: What is the difference between `yield` and `return` in Python?**

`return` terminates a function and sends a single value back to the caller. `yield` suspends the function, saves its entire state (local variables, instruction pointer), and sends a value to the caller. The function can be resumed from where it left off. A function with any `yield` statement becomes a generator function; calling it returns a generator object rather than executing the body.

---

**Q2: What is the difference between a generator and an iterator?**

An **iterator** is any object implementing `__iter__()` and `__next__()`. A **generator** is a specific type of iterator created either by a generator function (using `yield`) or a generator expression. All generators are iterators, but not all iterators are generators. Generators automatically implement the iterator protocol and manage their own state.

---

**Q3: How does `send()` work and what is a practical use case?**

`send(value)` resumes a suspended generator and injects `value` as the result of the `yield` expression the generator is paused at. The generator must be primed first with `next()` or `send(None)`. Practical use cases: implementing coroutines for cooperative multitasking, building data pipelines where downstream stages push configuration upstream, and implementing stateful stream processors (e.g., running averages, accumulators).

---

**Q4: Why are generators memory-efficient?**

Generators produce values one at a time on demand (lazy evaluation) rather than computing and storing all values upfront. A generator expression for `range(1_000_000)` uses ~112 bytes regardless of range size, while a list comprehension uses ~8 MB. This is critical for processing large files, infinite sequences, or multi-stage data pipelines.

---

**Q5: What does `yield from` do that a simple `for/yield` loop doesn't?**

`yield from subgen` transparently delegates the full generator protocol: it forwards `send()` values, `throw()` exceptions, and `close()` calls to the sub-generator. It also captures the sub-generator's `return` value. A manual `for x in subgen: yield x` loop cannot forward `send()` or `throw()` and loses the return value.

---

**Q6: What happens when `StopIteration` is raised inside a generator in Python 3.7+?**

PEP 479 (active by default in Python 3.7+) converts any `StopIteration` raised inside a generator into a `RuntimeError`. This prevents accidental generator termination when a nested iterator is exhausted. Before 3.7, a `StopIteration` inside a generator would silently terminate it, causing subtle bugs.

---

**Q7: Explain `itertools.tee()` and its memory implications.**

`tee(iterable, n)` creates `n` independent iterators from a single iterable. Internally it uses a shared deque buffer. If one iterator advances far ahead of another, all intermediate values are buffered in memory — O(k) where k is the divergence. For large iterables where iterators are consumed at very different rates, it's better to convert to a list first.

---

**Q8: How would you implement an infinite Fibonacci sequence generator?**

```python
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# Take first 10:
import itertools
list(itertools.islice(fibonacci(), 10))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

---

**Q9: What is the difference between an iterable and an iterator? Can an object be both?**

An **iterable** has `__iter__()` which returns an iterator. An **iterator** has both `__iter__()` and `__next__()`. Yes, an object can be both — in fact, iterators *must* be their own iterables (their `__iter__()` returns `self`). This is required so iterators can be used directly in `for` loops. Lists are iterables but not iterators; `iter(list)` returns a separate `list_iterator` object.

---

**Q10: How does `itertools.groupby()` work and what is the most common mistake?**

`groupby(iterable, key)` groups *consecutive* elements that share the same key value. It returns `(key, group_iterator)` pairs. The most common mistake is using it on unsorted data — it creates a new group every time the key changes, so non-consecutive equal elements end up in separate groups. Always sort by the grouping key first: `groupby(sorted(data, key=keyfunc), keyfunc)`. Also, group iterators are invalidated when the outer iterator advances, so consume each group before calling `next()` on the outer iterator.
