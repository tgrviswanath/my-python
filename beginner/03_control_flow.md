# Python Control Flow — Deep Dive

## Table of Contents
1. [if / elif / else](#if--elif--else)
2. [for Loops](#for-loops)
3. [while Loops](#while-loops)
4. [break / continue / pass](#break--continue--pass)
5. [for/while else Clause](#forwhile-else-clause)
6. [match/case (Python 3.10+)](#matchcase-python-310)
7. [Comprehensions as Control Flow](#comprehensions-as-control-flow)
8. [Loop Optimization Tips](#loop-optimization-tips)
9. [Interview Q&A](#interview-qa)

---

## if / elif / else

### Basic Syntax

```python
x = 42

if x > 100:
    print("large")
elif x > 10:
    print("medium")   # this branch executes
else:
    print("small")
```

### Truthiness Rules

Python evaluates any object as a boolean in a condition. The following are **falsy**:

| Value | Type |
|-------|------|
| `False` | bool |
| `0`, `0.0`, `0j` | numeric zero |
| `""`, `b""` | empty string/bytes |
| `[]`, `()`, `{}`, `set()` | empty containers |
| `None` | NoneType |
| Objects with `__bool__` returning `False` or `__len__` returning `0` | custom |

Everything else is **truthy**.

```python
# Idiomatic truthiness checks
lst = []
if not lst:          # preferred over: if len(lst) == 0
    print("empty")

name = None
if name is None:     # preferred for None check
    print("no name")

# Ternary (conditional expression)
result = "even" if x % 2 == 0 else "odd"

# Chained comparisons (unique to Python)
if 0 < x < 100:      # equivalent to: 0 < x and x < 100
    print("in range")
```

### Short-Circuit Evaluation

```python
# 'and' stops at first falsy value
x = None
y = x and x.value   # safe — x is falsy, x.value never evaluated

# 'or' stops at first truthy value
name = user_input or "default"  # common pattern for defaults

# Walrus operator := (Python 3.8+) — assign and test
import re
if m := re.search(r'\d+', text):
    print(m.group())  # m is available here
```

---

## for Loops

### range() Internals

`range` is a **lazy sequence** — it doesn't store all values in memory. It's a C object with `start`, `stop`, `step` fields and computes each value on demand.

```python
r = range(0, 10, 2)
print(type(r))          # <class 'range'>
import sys
print(sys.getsizeof(r)) # 48 bytes — regardless of size!
print(sys.getsizeof(range(10**9)))  # still 48 bytes

# range supports O(1) membership test and indexing
print(999_999 in range(1_000_000))  # True — O(1), not O(n)
print(range(10)[5])                 # 5
print(range(10)[-1])                # 9
```

### enumerate()

```python
fruits = ['apple', 'banana', 'cherry']

# Bad — manual index
for i in range(len(fruits)):
    print(i, fruits[i])

# Good — enumerate
for i, fruit in enumerate(fruits):
    print(i, fruit)

# With start index
for i, fruit in enumerate(fruits, start=1):
    print(i, fruit)  # 1-indexed
```

### zip()

```python
names  = ['Alice', 'Bob', 'Charlie']
scores = [95, 87, 92]

for name, score in zip(names, scores):
    print(f"{name}: {score}")

# zip stops at shortest — use zip_longest for full coverage
from itertools import zip_longest
for a, b in zip_longest([1, 2, 3], [10, 20], fillvalue=0):
    print(a, b)  # (1,10), (2,20), (3,0)

# zip to create dict
d = dict(zip(names, scores))
# {'Alice': 95, 'Bob': 87, 'Charlie': 92}
```

### Iterating Over Dicts

```python
d = {'a': 1, 'b': 2, 'c': 3}

for key in d:              # iterates keys (default)
    pass
for key in d.keys():       # explicit keys
    pass
for val in d.values():     # values
    pass
for key, val in d.items(): # key-value pairs
    pass
```

### for with reversed() and sorted()

```python
lst = [3, 1, 4, 1, 5, 9]

for x in reversed(lst):   # O(1) — no copy
    pass

for x in sorted(lst):     # O(n log n) — creates new list
    pass

for x in sorted(lst, key=lambda x: -x):  # descending
    pass
```

---

## while Loops

```python
# Basic while
n = 10
total = 0
while n > 0:
    total += n
    n -= 1

# Infinite loop with break
while True:
    data = input("Enter (q to quit): ")
    if data == 'q':
        break
    process(data)

# while with walrus operator (Python 3.8+)
import io
buf = io.BytesIO(b"hello world")
while chunk := buf.read(4):
    print(chunk)
```

---

## break / continue / pass

### break — Exit Loop Immediately

```python
# Find first match
for i, x in enumerate(data):
    if x == target:
        found_at = i
        break
else:
    found_at = -1  # only runs if loop completed without break
```

### continue — Skip to Next Iteration

```python
# Process only valid items
for item in items:
    if item is None:
        continue        # skip None items
    if not item.is_valid():
        continue
    process(item)       # only reached for valid items
```

### pass — No-Op Placeholder

```python
# Placeholder for future implementation
def todo_function():
    pass

# Empty class
class EmptyBase:
    pass

# Suppress exception
try:
    risky_operation()
except SomeError:
    pass  # intentionally ignored
```

---

## for/while else Clause

The `else` clause on a loop runs **only if the loop completed without hitting `break`**. This is one of Python's most misunderstood features.

```python
# Classic use: search with "not found" fallback
def find_prime_factor(n):
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            print(f"{n} = {i} × {n//i}")
            break
    else:
        print(f"{n} is prime")  # runs only if no break

find_prime_factor(17)   # "17 is prime"
find_prime_factor(15)   # "15 = 3 × 5"

# while else
attempts = 0
while attempts < 3:
    password = input("Password: ")
    if password == "secret":
        print("Access granted")
        break
    attempts += 1
else:
    print("Too many attempts")  # runs if while condition became False
```

---

## match/case (Python 3.10+)

Python's `match` statement is **structural pattern matching** — more powerful than a simple switch/case.

### Basic Value Matching

```python
def http_status(status):
    match status:
        case 200:
            return "OK"
        case 404:
            return "Not Found"
        case 500 | 503:          # OR pattern
            return "Server Error"
        case _:                  # wildcard (default)
            return "Unknown"
```

### Sequence Patterns

```python
def process_command(command):
    match command.split():
        case ["quit"]:
            quit()
        case ["go", direction]:
            go(direction)
        case ["go", direction, speed]:
            go(direction, speed)
        case ["pick", "up", item]:
            pick_up(item)
        case _:
            print(f"Unknown command: {command}")
```

### Mapping Patterns

```python
def handle_event(event):
    match event:
        case {"type": "click", "x": x, "y": y}:
            handle_click(x, y)
        case {"type": "keypress", "key": key}:
            handle_key(key)
        case {"type": str(t)}:
            print(f"Unknown event type: {t}")
```

### Class Patterns

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

def classify_point(point):
    match point:
        case Point(x=0, y=0):
            return "origin"
        case Point(x=0, y=y):
            return f"y-axis at {y}"
        case Point(x=x, y=0):
            return f"x-axis at {x}"
        case Point(x=x, y=y) if x == y:
            return f"diagonal at {x}"
        case Point(x=x, y=y):
            return f"point ({x}, {y})"
```

### Guard Clauses

```python
match value:
    case x if x < 0:
        print("negative")
    case x if x == 0:
        print("zero")
    case x:
        print(f"positive: {x}")
```

---

## Comprehensions as Control Flow

Comprehensions are syntactic sugar for filtered/transformed loops, but they also have their own scope (Python 3+).

### List Comprehension

```python
# [expression for item in iterable if condition]
squares = [x**2 for x in range(10) if x % 2 == 0]
# [0, 4, 16, 36, 64]

# Nested comprehension (matrix flatten)
matrix = [[1,2,3],[4,5,6],[7,8,9]]
flat = [x for row in matrix for x in row]
# [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

### Dict / Set Comprehension

```python
# Dict comprehension
word_lengths = {word: len(word) for word in ["hello", "world", "python"]}

# Set comprehension
unique_lengths = {len(word) for word in ["hello", "world", "hi"]}
# {2, 5}
```

### Generator Expression

```python
# Lazy — doesn't build list in memory
total = sum(x**2 for x in range(1_000_000))  # memory efficient

# Generator vs list comprehension
import sys
gen = (x**2 for x in range(1000))
lst = [x**2 for x in range(1000)]
print(sys.getsizeof(gen))  # ~104 bytes
print(sys.getsizeof(lst))  # ~8856 bytes
```

### Comprehension Scope (Python 3)

```python
# Loop variable does NOT leak in Python 3
[x for x in range(5)]
# print(x)  # NameError in Python 3 (leaked in Python 2)

# But walrus operator DOES leak
[y := x for x in range(5)]
print(y)  # 4 — walrus leaks to enclosing scope
```

---

## Loop Optimization Tips

### 1. Cache Attribute Lookups

```python
# Slow — attribute lookup on every iteration
for i in range(n):
    result.append(compute(i))  # 'append' looked up each time

# Fast — cache the method
append = result.append
for i in range(n):
    append(compute(i))
```

### 2. Use Local Variables

```python
import math

# Slow — global lookup for math.sqrt each iteration
for x in data:
    y = math.sqrt(x)

# Fast — local variable
sqrt = math.sqrt
for x in data:
    y = sqrt(x)
```

### 3. Avoid Repeated Computation in Loop Condition

```python
# Slow — len() called every iteration
for i in range(len(lst)):
    ...

# Fast — range() computed once
n = len(lst)
for i in range(n):
    ...

# Best — iterate directly
for item in lst:
    ...
```

### 4. Use Built-ins Instead of Loops

```python
# Slow
total = 0
for x in data:
    total += x

# Fast — built-in sum() is implemented in C
total = sum(data)

# Similarly: max(), min(), any(), all(), map(), filter()
```

### 5. Prefer Comprehensions Over append() Loops

```python
import timeit

# Loop with append
def loop_append():
    result = []
    for x in range(1000):
        result.append(x**2)
    return result

# List comprehension
def list_comp():
    return [x**2 for x in range(1000)]

# Comprehension is ~30-50% faster
```

### 6. Use itertools for Complex Iteration

```python
from itertools import islice, chain, product, combinations

# Efficient slicing of iterators
first_10 = list(islice(big_generator(), 10))

# Chain multiple iterables without copying
for item in chain(list1, list2, list3):
    process(item)

# Cartesian product
for x, y in product(range(3), range(3)):
    print(x, y)
```

---

## Interview Q&A

### Q1: What is the difference between `break` and `continue`?

**A:** `break` **exits the loop entirely** — execution jumps to the first statement after the loop. `continue` **skips the rest of the current iteration** and jumps to the next iteration (checking the loop condition again for `while`, or advancing the iterator for `for`).

```python
for i in range(5):
    if i == 2: continue  # skip 2
    if i == 4: break     # stop at 4
    print(i)
# Output: 0, 1, 3
```

---

### Q2: What does the `else` clause on a `for` loop do, and when is it useful?

**A:** The `else` clause runs **only if the loop completed without executing `break`**. It's useful for the "search and report not found" pattern — you search in a loop, `break` when found, and the `else` handles the "not found" case without needing a flag variable.

```python
# Without else — needs a flag
found = False
for item in collection:
    if condition(item):
        found = True
        break
if not found:
    handle_not_found()

# With else — cleaner
for item in collection:
    if condition(item):
        break
else:
    handle_not_found()
```

---

### Q3: How does `range()` work internally, and why is `range(10**9)` memory-efficient?

**A:** `range` is a **lazy sequence object** — it stores only `start`, `stop`, and `step` (three integers), not the actual values. Each value is computed on demand during iteration. This means `range(10**9)` uses the same ~48 bytes as `range(10)`. It also supports O(1) `len()`, indexing, and membership testing by arithmetic rather than iteration.

---

### Q4: What is the walrus operator (`:=`) and when should you use it?

**A:** The walrus operator (`:=`, PEP 572, Python 3.8+) is the **assignment expression** — it assigns a value and returns it in a single expression. Use it to avoid computing a value twice when you need both the value and a condition check:

```python
# Without walrus — compute twice
if len(data) > 10:
    print(f"Too long: {len(data)}")

# With walrus — compute once
if (n := len(data)) > 10:
    print(f"Too long: {n}")

# Especially useful in while loops
while chunk := file.read(8192):
    process(chunk)
```

---

### Q5: What is structural pattern matching (`match/case`) and how does it differ from `if/elif`?

**A:** `match/case` (Python 3.10+) is **structural pattern matching** — it can destructure objects, sequences, and mappings, not just compare values. Key differences from `if/elif`:
- Can bind variables during matching: `case Point(x=x, y=y)` extracts `x` and `y`.
- Supports OR patterns: `case 400 | 404 | 410`.
- Supports guard clauses: `case x if x > 0`.
- Works with class instances, dicts, sequences, and literals.
- The `_` wildcard matches anything without binding.

---

### Q6: Why are list comprehensions faster than equivalent `for` loops with `append()`?

**A:** Three reasons:
1. **No attribute lookup**: `append` is looked up on every iteration in a loop; comprehensions avoid this.
2. **Optimized bytecode**: CPython generates `LIST_APPEND` bytecode for comprehensions, which is more efficient than calling the Python-level `append` method.
3. **Local scope**: Comprehensions run in their own scope, and local variable access is faster than global/attribute access.

The speedup is typically 20–50% for simple comprehensions.

---

### Q7: What is the difference between `zip()` and `itertools.zip_longest()`?

**A:** `zip()` stops at the **shortest** iterable — extra elements from longer iterables are silently discarded. `zip_longest()` continues until the **longest** iterable is exhausted, filling missing values with a `fillvalue` (default `None`).

```python
list(zip([1,2,3], [10,20]))           # [(1,10), (2,20)] — 3 dropped
list(zip_longest([1,2,3], [10,20]))   # [(1,10), (2,20), (3,None)]
```

Use `zip_longest` when you need to process all elements from all iterables.

---

### Q8: How can you optimize a loop that calls a method or accesses an attribute repeatedly?

**A:** Cache the method/attribute in a local variable before the loop. Local variable access in CPython uses `LOAD_FAST` (index into a fixed array), while attribute access uses `LOAD_ATTR` (dictionary lookup). The difference is significant in tight loops:

```python
# Slow — LOAD_ATTR on every iteration
for x in data:
    result.append(transform(x))

# Fast — LOAD_FAST on every iteration
_append = result.append
_transform = transform
for x in data:
    _append(_transform(x))
```

This optimization is most valuable in loops with millions of iterations. For most code, readability should take priority.
