# Python Generators and Iterators — Comprehensive Guide

## 1. Iterator Protocol

An **iterator** is any object that implements:
- `__iter__()`: returns `self`
- `__next__()`: returns the next value or raises `StopIteration`

An **iterable** only needs `__iter__()` (returns an iterator).

```python
class CountDown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self   # iterator returns itself

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value


cd = CountDown(3)
for n in cd:
    print(n)   # 3, 2, 1

# Manual iteration
it = iter([1, 2, 3])   # creates an iterator from a list
next(it)   # 1
next(it)   # 2
next(it)   # 3
next(it)   # StopIteration

# next() with default — no exception
next(it, "exhausted")   # "exhausted"

# Iterable vs Iterator
lst = [1, 2, 3]
it1 = iter(lst)
it2 = iter(lst)   # fresh iterator — lists are re-iterable
it1 is it2        # False — different iterators

gen = (x for x in range(3))
iter(gen) is gen  # True — generators are their own iterators
```

---

## 2. Generator Functions

A generator function uses `yield` to produce values lazily. Calling it returns a **generator object** (which is both an iterator and an iterable).

```python
def count_up(start, stop):
    current = start
    while current < stop:
        yield current   # suspends here, returns value
        current += 1    # resumes here on next()


gen = count_up(1, 5)
next(gen)   # 1
next(gen)   # 2
list(gen)   # [3, 4]  — consumes remaining

# Generator is lazy — no computation until next() is called
def infinite_counter(start=0):
    n = start
    while True:
        yield n
        n += 1

counter = infinite_counter()
[next(counter) for _ in range(5)]   # [0, 1, 2, 3, 4]


# Fibonacci generator
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib = fibonacci()
[next(fib) for _ in range(10)]
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]


# Generator with return — raises StopIteration with value
def gen_with_return():
    yield 1
    yield 2
    return "done"   # StopIteration("done")

g = gen_with_return()
next(g)   # 1
next(g)   # 2
try:
    next(g)
except StopIteration as e:
    print(e.value)   # "done"
```

---

## 3. `yield from`

```python
# yield from — delegate to a sub-generator
def chain(*iterables):
    for it in iterables:
        yield from it   # equivalent to: for item in it: yield item


list(chain([1, 2], [3, 4], [5, 6]))
# [1, 2, 3, 4, 5, 6]


# Flatten nested structure
def flatten(nested):
    for item in nested:
        if isinstance(item, (list, tuple)):
            yield from flatten(item)
        else:
            yield item


list(flatten([1, [2, [3, 4]], [5, 6]]))
# [1, 2, 3, 4, 5, 6]


# yield from also passes send/throw/return values
def inner():
    value = yield "inner"
    return f"inner got: {value}"

def outer():
    result = yield from inner()   # delegates and captures return value
    yield f"outer got: {result}"
```

---

## 4. Generator Expressions

```python
# Syntax: (expression for item in iterable if condition)
# Lazy — computes values on demand

gen = (x**2 for x in range(10))
next(gen)   # 0
sum(gen)    # 1+4+9+...+81 = 284

# Memory comparison
import sys
lst = [x**2 for x in range(10**6)]   # ~8MB
gen = (x**2 for x in range(10**6))   # ~112 bytes

# Passing to functions — no extra parentheses needed
sum(x**2 for x in range(10))
max(len(word) for word in words)
any(x > 5 for x in nums)
all(x > 0 for x in nums)

# Chaining generators — fully lazy pipeline
def read_lines(filename):
    with open(filename) as f:
        yield from f

def filter_comments(lines):
    return (line for line in lines if not line.startswith('#'))

def parse_values(lines):
    return (float(line.strip()) for line in lines)

# Pipeline — nothing computed until consumed
pipeline = parse_values(filter_comments(read_lines("data.txt")))
total = sum(pipeline)
```

---

## 5. `send()`, `throw()`, `close()`

```python
# send() — send a value INTO the generator (resumes and passes value to yield)
def accumulator():
    total = 0
    while True:
        value = yield total   # yield sends total out, receives value in
        if value is None:
            break
        total += value


acc = accumulator()
next(acc)      # 0  — must prime the generator first (advance to first yield)
acc.send(10)   # 10
acc.send(20)   # 30
acc.send(5)    # 35


# throw() — throw an exception into the generator
def safe_gen():
    try:
        while True:
            yield "running"
    except ValueError as e:
        yield f"caught: {e}"
        yield "continuing"


g = safe_gen()
next(g)                    # "running"
g.throw(ValueError, "oops")  # "caught: oops"
next(g)                    # "continuing"


# close() — throw GeneratorExit into the generator
def cleanup_gen():
    try:
        while True:
            yield "working"
    except GeneratorExit:
        print("Cleaning up!")   # runs on close()


g = cleanup_gen()
next(g)    # "working"
g.close()  # "Cleaning up!"
```

---

## 6. `itertools` — Essential Tools

```python
import itertools

# chain — concatenate iterables
list(itertools.chain([1, 2], [3, 4], [5]))
# [1, 2, 3, 4, 5]

itertools.chain.from_iterable([[1,2],[3,4],[5]])
# same as chain(*nested)


# islice — lazy slicing of iterables
gen = itertools.count(0)   # infinite counter
list(itertools.islice(gen, 5))   # [0, 1, 2, 3, 4]
list(itertools.islice(range(100), 10, 20, 2))  # [10, 12, 14, 16, 18]


# product — Cartesian product
list(itertools.product([1, 2], ['a', 'b']))
# [(1,'a'), (1,'b'), (2,'a'), (2,'b')]

list(itertools.product(range(2), repeat=3))
# all 3-bit binary numbers: [(0,0,0),(0,0,1),...,(1,1,1)]


# combinations — r-length combinations (no repetition, order doesn't matter)
list(itertools.combinations([1, 2, 3, 4], 2))
# [(1,2),(1,3),(1,4),(2,3),(2,4),(3,4)]

list(itertools.combinations_with_replacement([1, 2, 3], 2))
# [(1,1),(1,2),(1,3),(2,2),(2,3),(3,3)]


# permutations — r-length permutations (order matters)
list(itertools.permutations([1, 2, 3], 2))
# [(1,2),(1,3),(2,1),(2,3),(3,1),(3,2)]


# groupby — group consecutive elements by key
data = [("a", 1), ("a", 2), ("b", 3), ("b", 4), ("a", 5)]
for key, group in itertools.groupby(data, key=lambda x: x[0]):
    print(key, list(group))
# a [('a', 1), ('a', 2)]
# b [('b', 3), ('b', 4)]
# a [('a', 5)]
# NOTE: must be sorted by key first for complete grouping!


# takewhile / dropwhile
list(itertools.takewhile(lambda x: x < 5, [1, 2, 3, 4, 5, 6, 1]))
# [1, 2, 3, 4]

list(itertools.dropwhile(lambda x: x < 5, [1, 2, 3, 4, 5, 6, 1]))
# [5, 6, 1]


# cycle — repeat iterable indefinitely
colors = itertools.cycle(["red", "green", "blue"])
[next(colors) for _ in range(7)]
# ['red', 'green', 'blue', 'red', 'green', 'blue', 'red']


# repeat
list(itertools.repeat(0, 5))   # [0, 0, 0, 0, 0]
list(map(pow, range(5), itertools.repeat(2)))  # [0, 1, 4, 9, 16]


# starmap — like map but unpacks arguments
list(itertools.starmap(pow, [(2, 3), (3, 2), (4, 1)]))
# [8, 9, 4]


# zip_longest — zip with fill value for unequal lengths
list(itertools.zip_longest([1, 2, 3], ['a', 'b'], fillvalue=None))
# [(1,'a'), (2,'b'), (3, None)]


# accumulate — running totals
import operator
list(itertools.accumulate([1, 2, 3, 4, 5]))
# [1, 3, 6, 10, 15]

list(itertools.accumulate([1, 2, 3, 4, 5], operator.mul))
# [1, 2, 6, 24, 120]  — running product
```

---

## 7. Generator Patterns

```python
# Infinite sequence with islice
def naturals():
    n = 1
    while True:
        yield n
        n += 1

first_10 = list(itertools.islice(naturals(), 10))


# Pipeline pattern
def read_data():
    yield from range(100)

def transform(data):
    return (x * 2 for x in data)

def filter_data(data):
    return (x for x in data if x % 3 == 0)

# Compose pipeline
pipeline = filter_data(transform(read_data()))
result = list(pipeline)


# Chunking
def chunks(iterable, size):
    it = iter(iterable)
    while True:
        chunk = list(itertools.islice(it, size))
        if not chunk:
            break
        yield chunk

list(chunks(range(10), 3))
# [[0,1,2], [3,4,5], [6,7,8], [9]]
```

---

## Interview Questions & Answers

**Q1: What is the difference between an iterable and an iterator?**

Answer:
- **Iterable**: has `__iter__()` that returns an iterator. Can be iterated multiple times (lists, tuples, strings).
- **Iterator**: has both `__iter__()` (returns self) and `__next__()`. Maintains state, can only be iterated once.

```python
lst = [1, 2, 3]   # iterable
it = iter(lst)    # iterator
iter(lst) is iter(lst)  # False — new iterator each time
iter(it) is it          # True — iterator returns itself
```

---

**Q2: What is a generator and how does it differ from a regular function?**

Answer: A generator function uses `yield` instead of `return`. Calling it returns a **generator object** (lazy iterator) without executing the body. The body executes incrementally — pausing at each `yield` and resuming on the next `next()` call. Benefits: memory efficiency (values computed on demand), infinite sequences, lazy pipelines.

---

**Q3: What is `yield from` and when would you use it?**

Answer: `yield from iterable` delegates iteration to a sub-iterable, yielding each item. It also passes `send()`, `throw()`, and `close()` calls through to the sub-generator, and captures its return value. Use it to:
- Flatten nested generators.
- Compose generators.
- Implement recursive generators.

---

**Q4: How does `send()` work with generators?**

Answer: `send(value)` resumes the generator and passes `value` as the result of the `yield` expression. The generator must be primed first with `next()` (or `send(None)`) to advance to the first `yield`.

```python
def gen():
    x = yield "ready"   # yield sends "ready" out, receives x
    yield f"got {x}"

g = gen()
next(g)        # "ready"  — prime the generator
g.send("hi")   # "got hi"
```

---

**Q5: What is the difference between a generator expression and a list comprehension?**

Answer:
- **List comprehension** `[...]`: eager, creates a list in memory immediately.
- **Generator expression** `(...)`: lazy, computes values on demand, uses O(1) memory.

Use generators when: data is large, you only need to iterate once, or you're passing to `sum()`/`max()`/`any()`/`all()`.

---

**Q6: How do you implement an infinite sequence with a generator?**

Answer:
```python
def count(start=0, step=1):
    n = start
    while True:
        yield n
        n += step

# Use itertools.islice to take a finite slice
import itertools
first_10 = list(itertools.islice(count(), 10))
```

---

**Q7: What does `itertools.groupby` do and what's the common pitfall?**

Answer: `groupby(iterable, key)` groups **consecutive** elements with the same key. The common pitfall: it only groups consecutive elements, so if the data isn't sorted by the key, you'll get multiple groups for the same key.

```python
# Wrong — not sorted
data = [("a", 1), ("b", 2), ("a", 3)]
# groupby gives: a, b, a  — three groups!

# Right — sort first
data.sort(key=lambda x: x[0])
# groupby gives: a, b  — two groups
```

---

**Q8: What is the difference between `itertools.combinations` and `itertools.permutations`?**

Answer:
- `combinations(iterable, r)`: r-length combinations where **order doesn't matter** and no repetition. `(1,2)` and `(2,1)` are the same.
- `permutations(iterable, r)`: r-length arrangements where **order matters**. `(1,2)` and `(2,1)` are different.

```python
list(combinations([1,2,3], 2))   # [(1,2),(1,3),(2,3)]  — 3 items
list(permutations([1,2,3], 2))   # [(1,2),(1,3),(2,1),(2,3),(3,1),(3,2)]  — 6 items
```

---

**Q9: How do generators help with memory efficiency?**

Answer: Generators compute values lazily — only when requested. This means you can process datasets larger than RAM, build infinite sequences, and create processing pipelines without storing intermediate results.

```python
# Process 1 billion numbers without storing them
total = sum(x**2 for x in range(10**9))  # uses ~112 bytes, not 8GB
```

---

**Q10: What happens when a generator function returns a value?**

Answer: A `return value` in a generator raises `StopIteration(value)`. The return value is stored in the exception's `value` attribute. This is used with `yield from` — the delegating generator can capture the sub-generator's return value.

```python
def gen():
    yield 1
    return "final"

g = gen()
next(g)   # 1
try:
    next(g)
except StopIteration as e:
    print(e.value)   # "final"
```
