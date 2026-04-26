# Python Tuples — Comprehensive Guide

## 1. Tuple Creation

```python
# Empty tuple
empty = ()
empty = tuple()

# Single element — trailing comma is required!
single = (42,)      # tuple
not_tuple = (42)    # just an int!
single = 42,        # also a tuple (parentheses optional)

# Multiple elements
coords = (10, 20)
rgb = (255, 128, 0)
mixed = (1, "hello", 3.14, True)

# From iterable
t = tuple([1, 2, 3])
t = tuple(range(5))
t = tuple("abc")    # ('a', 'b', 'c')

# Nested
nested = ((1, 2), (3, 4), (5, 6))

# Packing (implicit tuple creation)
point = 3, 4        # (3, 4)
```

---

## 2. Indexing and Slicing

```python
t = (10, 20, 30, 40, 50)

# Indexing
t[0]    # 10
t[-1]   # 50

# Slicing — returns a tuple
t[1:4]   # (20, 30, 40)
t[::-1]  # (50, 40, 30, 20, 10)

# Tuples support all the same indexing as lists
# but you CANNOT assign to an index
# t[0] = 99  # TypeError: 'tuple' object does not support item assignment
```

---

## 3. Tuple Unpacking

```python
# Basic unpacking
x, y = (10, 20)
a, b, c = (1, 2, 3)

# Swap variables (no temp variable needed)
a, b = b, a

# Extended unpacking with *
first, *rest = (1, 2, 3, 4, 5)
# first = 1, rest = [2, 3, 4, 5]

*init, last = (1, 2, 3, 4, 5)
# init = [1, 2, 3, 4], last = 5

first, *middle, last = (1, 2, 3, 4, 5)
# first = 1, middle = [2, 3, 4], last = 5

# Nested unpacking
(a, b), c = (1, 2), 3
# a=1, b=2, c=3

# Unpacking in loops
points = [(1, 2), (3, 4), (5, 6)]
for x, y in points:
    print(f"x={x}, y={y}")

# Ignoring values with _
_, important, _ = (1, 42, 3)
```

---

## 4. Named Tuples

Named tuples give tuple fields meaningful names, improving readability without sacrificing performance.

### collections.namedtuple
```python
from collections import namedtuple

# Define
Point = namedtuple('Point', ['x', 'y'])
Person = namedtuple('Person', 'name age email')  # space-separated string also works

# Create instances
p = Point(3, 4)
alice = Person('Alice', 30, 'alice@example.com')

# Access by name or index
p.x          # 3
p[0]         # 3
alice.name   # 'Alice'
alice[1]     # 30

# Immutable — cannot assign
# p.x = 10  # AttributeError

# _replace — returns a new namedtuple with some fields changed
p2 = p._replace(x=10)   # Point(x=10, y=4)

# _asdict — convert to OrderedDict
p._asdict()   # {'x': 3, 'y': 4}

# _fields — tuple of field names
Point._fields   # ('x', 'y')

# Unpack like a regular tuple
x, y = p
```

### typing.NamedTuple (modern, type-annotated)
```python
from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
    z: float = 0.0   # default value

p = Point(1.0, 2.0)
p.z   # 0.0

# Can add methods
class Circle(NamedTuple):
    center: Point
    radius: float

    def area(self):
        import math
        return math.pi * self.radius ** 2
```

---

## 5. When to Use Tuple vs List

| Scenario | Use |
|----------|-----|
| Fixed collection of heterogeneous items | Tuple |
| Homogeneous sequence that may change | List |
| Dict key or set member | Tuple (must be hashable) |
| Return multiple values from function | Tuple |
| Iteration-only, no mutation needed | Tuple |
| Need append/remove/sort | List |
| Semantic meaning of "record" | Tuple / NamedTuple |

```python
# Tuple — heterogeneous, fixed meaning
employee = ("Alice", 30, "Engineering")

# List — homogeneous, may grow
scores = [95, 87, 92, 78]

# Tuple as dict key
cache = {}
cache[(0, 0)] = "origin"
cache[(1, 2)] = "point"

# Return multiple values
def min_max(lst):
    return min(lst), max(lst)   # returns a tuple

lo, hi = min_max([3, 1, 4, 1, 5])
```

---

## 6. Immutability Benefits

```python
# 1. Hashable — can be used as dict keys and set members
t = (1, 2, 3)
d = {t: "value"}   # OK
s = {t}            # OK

# 2. Thread-safe — no need for locks when sharing between threads
# 3. Slightly faster creation and iteration than lists
import timeit
timeit.timeit("(1,2,3,4,5)", number=10_000_000)   # ~0.05s
timeit.timeit("[1,2,3,4,5]", number=10_000_000)   # ~0.12s

# 4. Protects data from accidental mutation
def process(config):
    # If config is a tuple, caller knows it won't be modified
    pass

# 5. Memory efficient
import sys
lst = [1, 2, 3, 4, 5]
tup = (1, 2, 3, 4, 5)
sys.getsizeof(lst)   # 120 bytes
sys.getsizeof(tup)   # 80 bytes

# CAVEAT: Immutability is shallow!
t = ([1, 2], [3, 4])
t[0].append(99)   # This works! The list inside is still mutable
print(t)          # ([1, 2, 99], [3, 4])
```

---

## 7. Tuple as Dict Key

```python
# Tuples of hashable elements are hashable
grid = {}
grid[(0, 0)] = "start"
grid[(3, 4)] = "end"

# Useful for memoization
from functools import lru_cache

@lru_cache(maxsize=None)
def distance(point1, point2):
    return ((point1[0]-point2[0])**2 + (point1[1]-point2[1])**2) ** 0.5

# Multi-dimensional indexing
memo = {}
memo[(i, j)] = value   # common in DP problems

# Tuple with mutable element is NOT hashable
t = ([1, 2], 3)
# hash(t)  # TypeError: unhashable type: 'list'
```

---

## 8. Additional Operations

```python
t = (1, 2, 3)

# Concatenation
t + (4, 5)    # (1, 2, 3, 4, 5)

# Repetition
t * 2         # (1, 2, 3, 1, 2, 3)

# Membership
2 in t        # True

# Length
len(t)        # 3

# Min/Max/Sum
min(t), max(t), sum(t)   # 1, 3, 6

# Count and index (same as list)
t.count(2)    # 1
t.index(3)    # 2

# Sorting returns a list
sorted((3, 1, 2))   # [1, 2, 3]  — returns list, not tuple
tuple(sorted(t))    # (1, 2, 3)  — back to tuple
```

---

## Interview Questions & Answers

**Q1: What is the key difference between a list and a tuple?**

Answer: The primary difference is **mutability**. Lists are mutable (elements can be added, removed, or changed); tuples are immutable (cannot be modified after creation). This leads to several consequences:
- Tuples are **hashable** (if all elements are hashable) and can be used as dict keys or set members.
- Tuples are slightly **faster** and use **less memory**.
- Tuples signal **intent**: "this data should not change."

---

**Q2: Why is a tuple faster than a list?**

Answer:
1. **Creation**: Python can optimize tuple literals at compile time (constant folding). `(1, 2, 3)` is stored as a constant; `[1, 2, 3]` allocates a new list each time.
2. **Memory**: Tuples don't over-allocate; lists reserve extra space for future appends.
3. **Iteration**: Slightly faster due to simpler internal structure.

```python
import timeit
# Tuple creation ~2-3x faster
timeit.timeit("(1,2,3)", number=10_000_000)
timeit.timeit("[1,2,3]", number=10_000_000)
```

---

**Q3: Can a tuple contain mutable objects? Is it still immutable?**

Answer: Yes, a tuple can contain mutable objects (like lists), but the tuple's **references** are immutable — you can't replace what the tuple points to. However, the mutable objects themselves can still be modified.

```python
t = ([1, 2], [3, 4])
# t[0] = [9, 9]   # TypeError — can't reassign
t[0].append(99)   # OK — modifying the list object itself
print(t)          # ([1, 2, 99], [3, 4])

# Such a tuple is NOT hashable because it contains a list
hash(t)   # TypeError
```

---

**Q4: What is the difference between `(1)` and `(1,)`?**

Answer: `(1)` is just the integer `1` with parentheses — the parentheses are grouping, not tuple syntax. `(1,)` is a single-element tuple. The trailing comma is what makes it a tuple.

```python
type((1))    # <class 'int'>
type((1,))   # <class 'tuple'>
type(1,)     # SyntaxError
x = 1,       # x = (1,) — tuple without parentheses
```

---

**Q5: How does tuple unpacking work with `*`?**

Answer: The `*` operator in unpacking captures "the rest" as a list. It can appear at any position but only once.

```python
first, *rest = (1, 2, 3, 4)
# first=1, rest=[2, 3, 4]

*init, last = (1, 2, 3, 4)
# init=[1, 2, 3], last=4

a, *b, c = (1, 2, 3, 4, 5)
# a=1, b=[2, 3, 4], c=5
```

---

**Q6: When would you use a namedtuple over a regular class?**

Answer: Use `namedtuple` when:
- You need a **lightweight, immutable** data container.
- You want **named field access** without the overhead of a full class.
- You need **tuple compatibility** (unpacking, indexing, hashing).
- You're representing simple records (coordinates, DB rows, config values).

Use a regular class when you need mutability, methods with complex logic, inheritance, or `__slots__`.

```python
# namedtuple — lightweight, immutable
Point = namedtuple('Point', ['x', 'y'])

# dataclass — mutable, more features
from dataclasses import dataclass
@dataclass
class Point:
    x: float
    y: float
```

---

**Q7: How do you convert between lists and tuples?**

Answer:
```python
lst = [1, 2, 3]
tup = tuple(lst)   # list → tuple

tup = (1, 2, 3)
lst = list(tup)    # tuple → list

# Common pattern: sort a tuple
sorted_tup = tuple(sorted(tup))
```

---

**Q8: Why can't you use a list as a dictionary key?**

Answer: Dictionary keys must be **hashable**. Lists are mutable, so their hash value could change if the list is modified — this would break the dictionary's internal hash table. Python enforces this by making lists unhashable (`TypeError: unhashable type: 'list'`).

Tuples of hashable elements are hashable because they're immutable — their hash value is stable.

```python
d = {}
d[(1, 2)] = "tuple key"   # OK
# d[[1, 2]] = "list key"  # TypeError

# Frozenset is also hashable
d[frozenset([1, 2])] = "frozenset key"   # OK
```
