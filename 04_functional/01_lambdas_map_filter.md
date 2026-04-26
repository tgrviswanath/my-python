# Python Lambdas, map, filter, reduce — Comprehensive Guide

## 1. Lambda Syntax

```python
# Syntax: lambda parameters: expression
# Single expression only — no statements, no assignments

# Basic
square = lambda x: x ** 2
add = lambda x, y: x + y
greet = lambda name: f"Hello, {name}!"

square(5)       # 25
add(3, 4)       # 7
greet("Alice")  # "Hello, Alice!"

# Multiple parameters
power = lambda base, exp: base ** exp
power(2, 10)   # 1024

# Default parameters
greet = lambda name, greeting="Hello": f"{greeting}, {name}!"
greet("Alice")           # "Hello, Alice!"
greet("Bob", "Hi")       # "Hi, Bob!"

# No parameters
get_pi = lambda: 3.14159
get_pi()   # 3.14159

# Conditional expression
abs_val = lambda x: x if x >= 0 else -x
clamp = lambda x, lo, hi: max(lo, min(hi, x))

# Immediately invoked
(lambda x, y: x + y)(3, 4)   # 7
```

---

## 2. Lambda vs `def`

```python
# Lambda — anonymous, single expression, inline
square = lambda x: x ** 2

# def — named, multi-line, full function
def square(x):
    return x ** 2

# When to use lambda:
# - Short, throwaway functions passed as arguments
# - When a named function would be overkill
# - sorted(), map(), filter() key/function arguments

# When to use def:
# - More than one expression needed
# - Reusable function
# - Needs a docstring
# - Needs error handling
# - Readability matters (complex logic)

# PEP 8: Don't assign lambda to a variable — use def instead
# Bad:
f = lambda x: x ** 2   # PEP 8 violation

# Good:
def f(x):
    return x ** 2

# Lambda is fine as an argument:
sorted(data, key=lambda x: x[1])   # OK
```

---

## 3. `map()`

```python
# map(function, iterable) — applies function to each element
# Returns a lazy iterator in Python 3

nums = [1, 2, 3, 4, 5]

# With lambda
squares = list(map(lambda x: x**2, nums))
# [1, 4, 9, 16, 25]

# With named function (faster — no lambda overhead)
import math
roots = list(map(math.sqrt, nums))
# [1.0, 1.414..., 1.732..., 2.0, 2.236...]

# With multiple iterables — stops at shortest
a = [1, 2, 3]
b = [10, 20, 30]
sums = list(map(lambda x, y: x + y, a, b))
# [11, 22, 33]
# Equivalent: list(map(sum, zip(a, b)))

# map is lazy — no computation until consumed
gen = map(lambda x: x**2, range(10**6))   # instant
next(gen)   # 0  — computes one at a time

# Equivalent list comprehension (usually preferred)
squares = [x**2 for x in nums]

# map with None — zip behavior (deprecated in Python 3)
# In Python 2: map(None, a, b) was like zip
```

---

## 4. `filter()`

```python
# filter(function, iterable) — keeps elements where function returns True
# Returns a lazy iterator

nums = [1, -2, 3, -4, 5, -6]

# With lambda
positives = list(filter(lambda x: x > 0, nums))
# [1, 3, 5]

# With named function
def is_even(x):
    return x % 2 == 0

evens = list(filter(is_even, nums))
# [-2, -4, -6]

# filter(None, iterable) — removes falsy values
mixed = [0, 1, "", "hello", None, [], [1, 2], False, True]
truthy = list(filter(None, mixed))
# [1, 'hello', [1, 2], True]

# Equivalent list comprehension (usually preferred)
positives = [x for x in nums if x > 0]

# Chaining map and filter
result = list(map(lambda x: x**2, filter(lambda x: x > 0, nums)))
# [1, 9, 25]

# Equivalent comprehension (cleaner)
result = [x**2 for x in nums if x > 0]
```

---

## 5. `reduce()`

```python
from functools import reduce

# reduce(function, iterable[, initializer])
# Applies function cumulatively: reduce(f, [a,b,c,d]) = f(f(f(a,b),c),d)

nums = [1, 2, 3, 4, 5]

# Sum
total = reduce(lambda acc, x: acc + x, nums)   # 15
# Step: 1+2=3, 3+3=6, 6+4=10, 10+5=15

# Product
product = reduce(lambda acc, x: acc * x, nums)   # 120

# Max
maximum = reduce(lambda a, b: a if a > b else b, nums)   # 5

# With initializer
total = reduce(lambda acc, x: acc + x, nums, 100)   # 115

# Flatten nested list
nested = [[1, 2], [3, 4], [5, 6]]
flat = reduce(lambda acc, x: acc + x, nested, [])
# [1, 2, 3, 4, 5, 6]

# Build dict from list of tuples
pairs = [("a", 1), ("b", 2), ("c", 3)]
d = reduce(lambda acc, kv: {**acc, kv[0]: kv[1]}, pairs, {})
# {'a': 1, 'b': 2, 'c': 3}

# Note: reduce is less readable than explicit loops for most cases
# Prefer sum(), max(), min(), any(), all() for common reductions
```

---

## 6. `sorted()` with `key`

```python
# sorted(iterable, key=None, reverse=False)
# key: function applied to each element for comparison

data = ["banana", "apple", "cherry", "date"]

# Sort by length
sorted(data, key=len)
# ['date', 'apple', 'banana', 'cherry']

# Sort by last character
sorted(data, key=lambda s: s[-1])

# Sort tuples by second element
people = [("Alice", 30), ("Bob", 25), ("Charlie", 35)]
sorted(people, key=lambda p: p[1])
# [('Bob', 25), ('Alice', 30), ('Charlie', 35)]

# Sort by multiple criteria
students = [("Alice", "B", 3.8), ("Bob", "A", 3.5), ("Charlie", "A", 3.9)]
sorted(students, key=lambda s: (s[1], -s[2]))   # grade asc, GPA desc

# operator.itemgetter — faster than lambda for simple key extraction
from operator import itemgetter, attrgetter

sorted(people, key=itemgetter(1))   # by index 1
sorted(people, key=itemgetter(1, 0))  # by index 1, then 0

# attrgetter — for objects
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

persons = [Person("Alice", 30), Person("Bob", 25)]
sorted(persons, key=attrgetter('age'))
sorted(persons, key=attrgetter('age', 'name'))  # multiple attributes

# Case-insensitive sort
words = ["Banana", "apple", "Cherry"]
sorted(words, key=str.lower)
# ['apple', 'Banana', 'Cherry']
```

---

## 7. Practical Patterns

```python
# Pipeline with map/filter
def process_pipeline(data):
    return list(
        map(str.upper,
            filter(lambda s: len(s) > 3,
                   map(str.strip, data)))
    )

# Equivalent (cleaner):
def process_pipeline(data):
    return [s.strip().upper() for s in data if len(s.strip()) > 3]

# Partial application with lambda
def make_multiplier(n):
    return lambda x: x * n

double = make_multiplier(2)
triple = make_multiplier(3)
double(5)   # 10
triple(5)   # 15

# Sorting with complex key
from operator import itemgetter
records = [
    {"name": "Alice", "dept": "Eng", "salary": 90000},
    {"name": "Bob", "dept": "HR", "salary": 70000},
    {"name": "Charlie", "dept": "Eng", "salary": 85000},
]
# Sort by dept, then by salary descending
sorted(records, key=lambda r: (r["dept"], -r["salary"]))
```

---

## Interview Questions & Answers

**Q1: What is a lambda function and when should you use it?**

Answer: A lambda is an anonymous, single-expression function. Use it for short, throwaway functions passed as arguments (e.g., `key` in `sorted()`, callbacks). Avoid it when:
- The logic is complex (use `def` for readability).
- You need to assign it to a variable (PEP 8 says use `def` instead).
- You need a docstring or error handling.

---

**Q2: What is the difference between `map()` and a list comprehension?**

Answer:
- Both apply a transformation to each element.
- `map()` returns a **lazy iterator** (memory efficient for large data).
- List comprehension returns a **list** immediately.
- `map()` with a named function (no lambda) can be slightly faster.
- List comprehensions are generally more readable and Pythonic.

```python
# Equivalent
list(map(lambda x: x**2, nums))
[x**2 for x in nums]
```

---

**Q3: What does `filter(None, iterable)` do?**

Answer: When `None` is passed as the function, `filter` keeps elements that are truthy (non-zero, non-empty, non-None). It's equivalent to `[x for x in iterable if x]`.

```python
filter(None, [0, 1, "", "hello", None, [], [1]])
# [1, 'hello', [1]]
```

---

**Q4: How does `reduce()` work? Give an example.**

Answer: `reduce(f, [a, b, c, d])` applies `f` cumulatively: `f(f(f(a, b), c), d)`. It reduces a sequence to a single value.

```python
from functools import reduce
reduce(lambda acc, x: acc + x, [1, 2, 3, 4, 5])
# ((((1+2)+3)+4)+5) = 15
```

For common reductions, prefer built-ins: `sum()`, `max()`, `min()`, `any()`, `all()`.

---

**Q5: What is the `key` parameter in `sorted()` and how does it work?**

Answer: `key` is a function applied to each element before comparison. Python sorts by the key values, not the original elements. The original elements are returned in sorted order.

```python
sorted(["banana", "apple", "cherry"], key=len)
# ['apple', 'banana', 'cherry']  — sorted by length
```

The key function is called once per element (not once per comparison), making it efficient.

---

**Q6: What is `operator.itemgetter` and when is it better than a lambda?**

Answer: `itemgetter(n)` returns a callable that extracts the nth item. It's faster than a lambda because it's implemented in C and avoids Python function call overhead.

```python
from operator import itemgetter
sorted(data, key=itemgetter(1))   # faster than lambda x: x[1]
sorted(data, key=itemgetter(1, 0))  # sort by index 1, then 0
```

---

**Q7: Can a lambda have multiple expressions or statements?**

Answer: No. A lambda can only contain a single **expression** (not statements). No assignments, no `if/else` blocks (only ternary expressions), no `for` loops, no `return` statement (the expression is implicitly returned).

```python
# OK — ternary expression
f = lambda x: x if x > 0 else -x

# NOT OK — statement
# f = lambda x: if x > 0: return x  # SyntaxError
```

---

**Q8: How do you sort a list of objects by multiple criteria?**

Answer: Return a tuple from the `key` function. Python compares tuples element by element.

```python
# Sort by grade ascending, then GPA descending
sorted(students, key=lambda s: (s.grade, -s.gpa))

# Or use operator.attrgetter for simple cases
from operator import attrgetter
sorted(students, key=attrgetter('grade', 'gpa'))
```
