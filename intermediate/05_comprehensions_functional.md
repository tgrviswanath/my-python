# 05 — Comprehensions & Functional Programming

## List Comprehensions

```python
# [expression for item in iterable if condition]
squares = [x**2 for x in range(10)]
evens   = [x for x in range(20) if x % 2 == 0]
flat    = [x for row in matrix for x in row]  # nested

# With walrus operator (Python 3.8+)
results = [y for x in data if (y := expensive(x)) > 0]
```

## Dict & Set Comprehensions

```python
# Dict comprehension
word_len = {word: len(word) for word in words}
inverted = {v: k for k, v in d.items()}

# Set comprehension
unique_lengths = {len(w) for w in words}
```

## Generator Expressions

```python
# Lazy — values produced on demand
gen = (x**2 for x in range(1_000_000))  # no memory allocated yet
total = sum(x**2 for x in range(1_000_000))  # efficient

# Generator vs list
import sys
lst = [x**2 for x in range(1000)]
gen = (x**2 for x in range(1000))
print(sys.getsizeof(lst))  # ~8856 bytes
print(sys.getsizeof(gen))  # 112 bytes
```

## map / filter / reduce

```python
from functools import reduce

nums = [1, 2, 3, 4, 5]

# map — apply function to each element
doubled = list(map(lambda x: x * 2, nums))
# Prefer: [x * 2 for x in nums]

# filter — keep elements where function returns True
evens = list(filter(lambda x: x % 2 == 0, nums))
# Prefer: [x for x in nums if x % 2 == 0]

# reduce — fold left
product = reduce(lambda a, b: a * b, nums)  # 120
total   = reduce(lambda a, b: a + b, nums, 0)  # 15 (with initial)
```

## sorted / min / max with key

```python
people = [('Alice', 30), ('Bob', 25), ('Carol', 35)]

# Sort by age
sorted(people, key=lambda p: p[1])
sorted(people, key=lambda p: p[1], reverse=True)

# operator module (faster than lambda)
from operator import itemgetter, attrgetter
sorted(people, key=itemgetter(1))

# Sort by multiple keys
sorted(people, key=lambda p: (p[1], p[0]))  # age, then name

# min/max with key
youngest = min(people, key=itemgetter(1))
```

## Interview Questions

### Q1: When should you use a generator expression vs list comprehension?
**Answer:**
- **List comprehension**: when you need to reuse the result, index into it, or know the length
- **Generator expression**: when you only iterate once, especially for large/infinite sequences

```python
# Generator — memory efficient for large data
total = sum(x**2 for x in range(10**8))  # never stores all values

# List — needed when reusing
squares = [x**2 for x in range(100)]
print(squares[50])   # random access
print(len(squares))  # need length
```

### Q2: What is the difference between `map()` and a list comprehension?
**Answer:**
- `map()` returns a **lazy iterator** (like a generator)
- List comprehension returns a **list** immediately
- List comprehensions are generally more **readable** and **Pythonic**
- `map()` with a built-in function (no lambda) can be slightly faster

```python
# map is lazy
m = map(str, range(5))  # no computation yet
list(m)  # ['0', '1', '2', '3', '4']

# Equivalent list comprehension
[str(x) for x in range(5)]
```

### Q3: How do you flatten a nested list?
**Answer:**
```python
nested = [[1, 2], [3, 4], [5, 6]]

# List comprehension
flat = [x for row in nested for x in row]

# itertools.chain
from itertools import chain
flat = list(chain.from_iterable(nested))

# For deeply nested: use recursion
def flatten(lst):
    for item in lst:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item
```

### Q4: What is `reduce()` and when would you use it?
**Answer:**
`reduce(func, iterable, initial)` applies `func` cumulatively: `func(func(func(init, a), b), c)`.

Use cases: product, running total, building a dict from pairs, composing functions.

```python
from functools import reduce

# Product
reduce(lambda a, b: a * b, [1,2,3,4,5])  # 120

# Compose functions
def compose(*funcs):
    return reduce(lambda f, g: lambda x: f(g(x)), funcs)

double = lambda x: x * 2
inc    = lambda x: x + 1
double_then_inc = compose(inc, double)
double_then_inc(5)  # 11
```

### Q5: What are the performance trade-offs of comprehensions?
**Answer:**
```python
import timeit

# List comprehension vs map (with lambda)
t1 = timeit.timeit('[x**2 for x in range(1000)]', number=10000)
t2 = timeit.timeit('list(map(lambda x: x**2, range(1000)))', number=10000)
t3 = timeit.timeit('list(map(pow, range(1000), [2]*1000))', number=10000)

# Typically: list comp ≈ map+lambda, map+builtin is fastest
# Generator expressions use ~8x less memory than list comprehensions
```
