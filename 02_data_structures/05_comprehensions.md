# Python Comprehensions — Comprehensive Guide

## 1. List Comprehensions

```python
# Syntax: [expression for item in iterable if condition]

# Basic
squares = [x**2 for x in range(10)]
# [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

# With condition (filter)
evens = [x for x in range(20) if x % 2 == 0]

# With transformation and filter
result = [x.upper() for x in ["hello", "world", "python"] if len(x) > 4]

# Calling a function
def double(x): return x * 2
doubled = [double(x) for x in range(5)]

# Multiple operations
processed = [x.strip().lower() for x in ["  Hello  ", " WORLD "]]
```

---

## 2. Dict Comprehensions

```python
# Syntax: {key_expr: value_expr for item in iterable if condition}

# Basic
squares = {x: x**2 for x in range(6)}
# {0: 0, 1: 1, 2: 4, 3: 9, 4: 16, 5: 25}

# Invert a dict
original = {"a": 1, "b": 2, "c": 3}
inverted = {v: k for k, v in original.items()}
# {1: 'a', 2: 'b', 3: 'c'}

# Filter dict entries
scores = {"Alice": 85, "Bob": 92, "Charlie": 78, "Dave": 95}
passing = {name: score for name, score in scores.items() if score >= 80}
# {'Alice': 85, 'Bob': 92, 'Dave': 95}

# Transform keys and values
normalized = {k.lower(): v / 100 for k, v in scores.items()}

# From two lists
keys = ["a", "b", "c"]
values = [1, 2, 3]
d = {k: v for k, v in zip(keys, values)}
```

---

## 3. Set Comprehensions

```python
# Syntax: {expression for item in iterable if condition}

# Basic
squares = {x**2 for x in range(-5, 6)}
# {0, 1, 4, 9, 16, 25}  — duplicates removed automatically

# Unique characters
unique_chars = {c.lower() for c in "Hello World" if c.isalpha()}
# {'h', 'e', 'l', 'o', 'w', 'r', 'd'}

# Unique domains
emails = ["alice@gmail.com", "bob@yahoo.com", "charlie@gmail.com"]
domains = {email.split("@")[1] for email in emails}
# {'gmail.com', 'yahoo.com'}
```

---

## 4. Generator Expressions

```python
# Syntax: (expression for item in iterable if condition)
# Returns a generator object — lazy evaluation, memory efficient

# Basic
gen = (x**2 for x in range(10))
next(gen)   # 0
next(gen)   # 1

# Consume with list(), sum(), max(), etc.
total = sum(x**2 for x in range(1000))   # no intermediate list!
maximum = max(len(word) for word in words)

# Generator vs list comprehension
import sys
lst = [x**2 for x in range(1000)]
gen = (x**2 for x in range(1000))
sys.getsizeof(lst)   # ~8856 bytes
sys.getsizeof(gen)   # ~112 bytes  — constant size!

# Can only be iterated once
gen = (x for x in range(3))
list(gen)   # [0, 1, 2]
list(gen)   # []  — exhausted!

# Passing to functions — no extra parentheses needed
sum(x**2 for x in range(10))   # not sum((x**2 for x in range(10)))
```

---

## 5. Nested Comprehensions

```python
# Nested list comprehension — flatten a matrix
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [x for row in matrix for x in row]
# [1, 2, 3, 4, 5, 6, 7, 8, 9]
# Read as: for row in matrix: for x in row: yield x

# Transpose a matrix
transposed = [[row[i] for row in matrix] for i in range(3)]
# [[1, 4, 7], [2, 5, 8], [3, 6, 9]]

# Cartesian product
pairs = [(x, y) for x in [1, 2, 3] for y in ['a', 'b']]
# [(1,'a'), (1,'b'), (2,'a'), (2,'b'), (3,'a'), (3,'b')]

# With condition on inner loop
filtered = [(x, y) for x in range(5) for y in range(5) if x != y]

# Nested dict comprehension
matrix_dict = {i: {j: i*j for j in range(1, 4)} for i in range(1, 4)}
# {1: {1:1, 2:2, 3:3}, 2: {1:2, 2:4, 3:6}, 3: {1:3, 2:6, 3:9}}
```

---

## 6. Conditional Comprehensions

```python
# Filter (if at end)
evens = [x for x in range(10) if x % 2 == 0]

# Ternary expression (if-else in expression)
labels = ["even" if x % 2 == 0 else "odd" for x in range(6)]
# ['even', 'odd', 'even', 'odd', 'even', 'odd']

# Both filter and ternary
result = [x**2 if x > 0 else 0 for x in range(-3, 4) if x != 0]

# Nested conditions
grade = ["A" if s >= 90 else "B" if s >= 80 else "C" if s >= 70 else "F"
         for s in [95, 85, 72, 60]]
```

---

## 7. Performance Comparison

```python
import timeit

# List comprehension vs for loop
def with_loop():
    result = []
    for x in range(1000):
        result.append(x**2)
    return result

def with_comprehension():
    return [x**2 for x in range(1000)]

# Comprehension is ~30-50% faster (avoids attribute lookup for .append)
timeit.timeit(with_loop, number=10000)           # ~0.45s
timeit.timeit(with_comprehension, number=10000)  # ~0.30s

# map() with named function can be faster than comprehension
import math
timeit.timeit(lambda: list(map(math.sqrt, range(1000))), number=10000)  # fastest
timeit.timeit(lambda: [math.sqrt(x) for x in range(1000)], number=10000)
timeit.timeit(lambda: [x**0.5 for x in range(1000)], number=10000)

# Generator expression for large data — memory wins
# sum() with generator: no intermediate list
sum(x**2 for x in range(10**6))   # uses ~112 bytes
sum([x**2 for x in range(10**6)]) # uses ~8MB
```

---

## 8. Common Patterns and Pitfalls

```python
# PITFALL: Walrus operator in comprehension (Python 3.8+)
# Useful when you need to use a computed value in both condition and expression
results = [y for x in data if (y := expensive(x)) is not None]

# PITFALL: Side effects in comprehensions — avoid!
# Bad: using comprehension just for side effects
[print(x) for x in range(5)]   # works but bad style
# Good: use a for loop for side effects
for x in range(5):
    print(x)

# PITFALL: Variable leakage — comprehension variables are scoped
x = 10
result = [x for x in range(5)]
print(x)   # 10  — x is NOT leaked (unlike Python 2)

# PATTERN: Flatten with condition
nested = [[1, -2, 3], [-4, 5, -6], [7, 8, -9]]
positives = [x for row in nested for x in row if x > 0]

# PATTERN: Multiple assignment with walrus
import re
lines = ["name: Alice", "age: 30", "invalid line"]
parsed = [m.group(1) for line in lines if (m := re.match(r"name: (.+)", line))]
# ['Alice']
```

---

## Interview Questions & Answers

**Q1: What is a list comprehension and how does it differ from a for loop?**

Answer: A list comprehension is a concise, readable way to create a list by applying an expression to each item in an iterable, optionally filtering with a condition. It's equivalent to a for loop with `append`, but:
- ~30-50% faster (avoids repeated `.append()` attribute lookup)
- More readable for simple transformations
- Creates the list in a single expression

```python
# Equivalent
result = []
for x in range(10):
    if x % 2 == 0:
        result.append(x**2)

result = [x**2 for x in range(10) if x % 2 == 0]
```

---

**Q2: What is the difference between a list comprehension and a generator expression?**

Answer:
- **List comprehension** `[...]`: evaluates eagerly, stores all results in memory, can be indexed.
- **Generator expression** `(...)`: evaluates lazily, generates values one at a time, uses O(1) memory, can only be iterated once.

Use generators when:
- The dataset is large (memory efficiency)
- You only need to iterate once
- You're passing to `sum()`, `max()`, `any()`, `all()` etc.

```python
lst = [x**2 for x in range(10**6)]   # 8MB in memory
gen = (x**2 for x in range(10**6))   # ~112 bytes

sum(gen)   # efficient — no intermediate list
```

---

**Q3: Can you use a comprehension with multiple for clauses? What's the order?**

Answer: Yes. Multiple `for` clauses create a Cartesian product. The order is left-to-right, same as nested for loops:

```python
[(x, y) for x in [1, 2] for y in ['a', 'b']]
# [(1,'a'), (1,'b'), (2,'a'), (2,'b')]

# Equivalent to:
result = []
for x in [1, 2]:
    for y in ['a', 'b']:
        result.append((x, y))
```

---

**Q4: What is the difference between `[x for x in lst if condition]` and `[x if condition else y for x in lst]`?**

Answer:
- `[x for x in lst if condition]` — **filters**: only includes elements where condition is True.
- `[x if condition else y for x in lst]` — **transforms**: includes all elements, replacing with `y` when condition is False.

```python
lst = [1, 2, 3, 4, 5]
[x for x in lst if x > 2]          # [3, 4, 5]  — filtered
[x if x > 2 else 0 for x in lst]   # [0, 0, 3, 4, 5]  — all included
```

---

**Q5: When should you use `map()`/`filter()` instead of comprehensions?**

Answer:
- Use `map()` with a **named function** (no lambda) — can be faster than a comprehension.
- Use `filter()` when you already have a predicate function.
- Use comprehensions for readability in most other cases.
- Use `map`/`filter` when you need a **lazy iterator** without the generator expression syntax.

```python
import math
list(map(math.sqrt, nums))   # faster than [math.sqrt(x) for x in nums]
list(map(lambda x: x**2, nums))   # slower — lambda overhead
[x**2 for x in nums]   # cleaner than map with lambda
```

---

**Q6: Are comprehension variables scoped?**

Answer: Yes, in Python 3, comprehension variables are **scoped to the comprehension** and do not leak into the enclosing scope. This is different from Python 2 where loop variables leaked.

```python
x = "outer"
result = [x for x in range(5)]
print(x)   # "outer"  — not affected by comprehension variable
```

---

**Q7: What is the walrus operator (`:=`) and how is it used in comprehensions?**

Answer: The walrus operator (Python 3.8+) assigns a value as part of an expression. In comprehensions, it's useful when you need to use a computed value in both the condition and the expression, avoiding double computation:

```python
# Without walrus — expensive() called twice
result = [expensive(x) for x in data if expensive(x) is not None]

# With walrus — expensive() called once
result = [y for x in data if (y := expensive(x)) is not None]
```

---

**Q8: How do you create a nested list comprehension to transpose a matrix?**

Answer:
```python
matrix = [[1, 2, 3],
          [4, 5, 6],
          [7, 8, 9]]

# Transpose: rows become columns
transposed = [[row[i] for row in matrix] for i in range(len(matrix[0]))]
# [[1, 4, 7], [2, 5, 8], [3, 6, 9]]

# Equivalent using zip
transposed = [list(row) for row in zip(*matrix)]
```
