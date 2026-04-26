# Python Lists — Comprehensive Guide

## 1. List Creation

```python
# Empty list
empty = []
empty = list()

# With values
nums = [1, 2, 3, 4, 5]
mixed = [1, "hello", 3.14, True, None]

# From iterable
chars = list("hello")        # ['h', 'e', 'l', 'l', 'o']
from_range = list(range(5))  # [0, 1, 2, 3, 4]

# Nested list
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

# List multiplication
zeros = [0] * 5   # [0, 0, 0, 0, 0]
```

---

## 2. Indexing and Slicing

```python
lst = [10, 20, 30, 40, 50]

# Indexing (0-based, negative from end)
lst[0]    # 10
lst[-1]   # 50
lst[-2]   # 40

# Slicing: lst[start:stop:step]
lst[1:4]    # [20, 30, 40]  — stop is exclusive
lst[:3]     # [10, 20, 30]
lst[2:]     # [30, 40, 50]
lst[::2]    # [10, 30, 50]  — every other element
lst[::-1]   # [50, 40, 30, 20, 10]  — reversed copy

# Slice assignment
lst[1:3] = [200, 300]   # [10, 200, 300, 40, 50]
lst[::2] = [0, 0, 0]    # replaces elements at even indices
```

---

## 3. Core Methods

### append — O(1) amortized
```python
lst = [1, 2, 3]
lst.append(4)       # [1, 2, 3, 4]
lst.append([5, 6])  # [1, 2, 3, 4, [5, 6]]  — adds as single element
```

### extend — O(k) where k = len of iterable
```python
lst = [1, 2, 3]
lst.extend([4, 5])   # [1, 2, 3, 4, 5]
lst.extend("ab")     # [1, 2, 3, 4, 5, 'a', 'b']
# Equivalent: lst += [4, 5]
```

### insert — O(n)
```python
lst = [1, 2, 3]
lst.insert(1, 99)   # [1, 99, 2, 3]  — insert at index 1
lst.insert(0, 0)    # [0, 1, 99, 2, 3]
lst.insert(-1, 88)  # inserts before last element
```

### remove — O(n), removes first occurrence
```python
lst = [1, 2, 3, 2, 4]
lst.remove(2)   # [1, 3, 2, 4]  — removes first 2
# Raises ValueError if not found
```

### pop — O(1) for last, O(n) for arbitrary index
```python
lst = [1, 2, 3, 4]
lst.pop()     # returns 4, lst = [1, 2, 3]
lst.pop(1)    # returns 2, lst = [1, 3]
# Raises IndexError on empty list
```

### sort — O(n log n), in-place, stable (Timsort)
```python
lst = [3, 1, 4, 1, 5, 9]
lst.sort()                        # [1, 1, 3, 4, 5, 9]
lst.sort(reverse=True)            # [9, 5, 4, 3, 1, 1]
lst.sort(key=lambda x: -x)        # same as reverse=True
words = ["banana", "apple", "cherry"]
words.sort(key=len)               # ['apple', 'banana', 'cherry']
words.sort(key=str.lower)         # case-insensitive sort
```

### reverse — O(n), in-place
```python
lst = [1, 2, 3]
lst.reverse()   # [3, 2, 1]
```

### index — O(n)
```python
lst = [10, 20, 30, 20]
lst.index(20)       # 1  — first occurrence
lst.index(20, 2)    # 3  — search from index 2
# Raises ValueError if not found
```

### count — O(n)
```python
lst = [1, 2, 2, 3, 2]
lst.count(2)   # 3
lst.count(9)   # 0
```

### copy — O(n), shallow copy
```python
original = [1, 2, 3]
copy1 = original.copy()
copy2 = original[:]
copy3 = list(original)
# All produce shallow copies
```

---

## 4. List as Stack and Queue

### Stack (LIFO) — use append/pop
```python
stack = []
stack.append(1)   # push
stack.append(2)
stack.append(3)
stack.pop()       # 3 — pop from top (O(1))
stack.pop()       # 2
```

### Queue (FIFO) — use collections.deque (not list!)
```python
from collections import deque

queue = deque()
queue.append(1)     # enqueue
queue.append(2)
queue.append(3)
queue.popleft()     # 1 — dequeue from front (O(1))
# list.pop(0) is O(n) — avoid for queues
```

---

## 5. Sorting: sort() vs sorted()

| Feature | `list.sort()` | `sorted()` |
|---------|--------------|------------|
| In-place | Yes (returns None) | No (returns new list) |
| Works on | Lists only | Any iterable |
| Memory | O(1) extra | O(n) extra |

```python
lst = [3, 1, 2]

# sort() — modifies in place
lst.sort()
print(lst)   # [1, 2, 3]

# sorted() — returns new list
lst2 = [3, 1, 2]
new = sorted(lst2)
print(lst2)  # [3, 1, 2]  — unchanged
print(new)   # [1, 2, 3]

# key parameter — applied to each element for comparison
people = [("Alice", 30), ("Bob", 25), ("Charlie", 35)]
sorted(people, key=lambda x: x[1])   # sort by age
sorted(people, key=lambda x: x[0])   # sort by name

# Multiple keys
data = [("Alice", 30), ("Bob", 30), ("Alice", 25)]
sorted(data, key=lambda x: (x[0], x[1]))  # name then age

# reverse parameter
sorted([3, 1, 2], reverse=True)   # [3, 2, 1]
```

### Sort Stability
Python's sort is **stable**: equal elements maintain their original relative order.
```python
data = [("Alice", 2), ("Bob", 1), ("Alice", 1)]
sorted(data, key=lambda x: x[0])
# [('Alice', 2), ('Alice', 1), ('Bob', 1)]
# Both Alices keep their original order
```

---

## 6. Shallow vs Deep Copy

```python
import copy

# Shallow copy — copies the list, but nested objects are shared
original = [[1, 2], [3, 4]]
shallow = original.copy()   # or original[:]

shallow[0].append(99)
print(original)   # [[1, 2, 99], [3, 4]]  — MUTATED!
print(shallow)    # [[1, 2, 99], [3, 4]]

# Deep copy — recursively copies all nested objects
original = [[1, 2], [3, 4]]
deep = copy.deepcopy(original)

deep[0].append(99)
print(original)   # [[1, 2], [3, 4]]  — unchanged
print(deep)       # [[1, 2, 99], [3, 4]]
```

**Rule of thumb:** Use deep copy when your list contains mutable objects (lists, dicts, custom objects) and you need full independence.

---

## 7. Time Complexity

| Operation | Average Case | Notes |
|-----------|-------------|-------|
| `lst[i]` | O(1) | Random access |
| `lst[i] = x` | O(1) | Index assignment |
| `append(x)` | O(1) amortized | Occasional O(n) resize |
| `pop()` | O(1) | Remove last |
| `pop(i)` | O(n) | Shift elements |
| `insert(i, x)` | O(n) | Shift elements |
| `remove(x)` | O(n) | Search + shift |
| `x in lst` | O(n) | Linear search |
| `len(lst)` | O(1) | Stored attribute |
| `sort()` | O(n log n) | Timsort |
| `reverse()` | O(n) | In-place |
| `extend(k)` | O(k) | k = len of iterable |
| `copy()` | O(n) | Shallow copy |
| `count(x)` | O(n) | Linear scan |
| `index(x)` | O(n) | Linear scan |

---

## 8. List Comprehensions

```python
# Basic
squares = [x**2 for x in range(10)]

# With condition
evens = [x for x in range(20) if x % 2 == 0]

# Nested
flat = [x for row in matrix for x in row]

# With transformation and condition
result = [x.upper() for x in words if len(x) > 3]

# vs map/filter
squares_map = list(map(lambda x: x**2, range(10)))
evens_filter = list(filter(lambda x: x % 2 == 0, range(20)))
# Comprehensions are generally more readable and slightly faster
```

---

## Interview Questions & Answers

**Q1: What is the difference between a list and a tuple in Python?**

Answer:
- **Mutability**: Lists are mutable (can be changed); tuples are immutable.
- **Syntax**: Lists use `[]`; tuples use `()`.
- **Performance**: Tuples are slightly faster to create and iterate; they use less memory.
- **Use cases**: Use lists for homogeneous, mutable sequences; tuples for heterogeneous, fixed data (e.g., coordinates, DB rows).
- **Hashability**: Tuples of hashable elements can be dict keys or set members; lists cannot.

```python
lst = [1, 2, 3]
tup = (1, 2, 3)
lst[0] = 99    # OK
# tup[0] = 99  # TypeError
d = {tup: "value"}   # OK
# d = {lst: "value"} # TypeError: unhashable type
```

---

**Q2: Is Python's sort stable? Why does it matter?**

Answer: Yes, Python uses **Timsort**, which is a stable sorting algorithm. Stability means that when two elements compare as equal, their original relative order is preserved. This matters when sorting by multiple criteria sequentially:

```python
# Sort by grade first, then by name (stable sort preserves name order within same grade)
students = [("Alice", "B"), ("Bob", "A"), ("Charlie", "B"), ("Dave", "A")]
students.sort(key=lambda x: x[1])
# [('Bob', 'A'), ('Dave', 'A'), ('Alice', 'B'), ('Charlie', 'B')]
# Within grade A: Bob before Dave (original order preserved)
```

---

**Q3: What is the difference between sort() and sorted()?**

Answer:
- `list.sort()` sorts **in-place**, returns `None`, only works on lists.
- `sorted()` returns a **new sorted list**, works on any iterable, leaves original unchanged.

```python
lst = [3, 1, 2]
result = lst.sort()   # result is None, lst is [1, 2, 3]
result = sorted(lst)  # result is [1, 2, 3], lst unchanged
```

Common mistake: `lst = lst.sort()` sets `lst` to `None`.

---

**Q4: What is the time complexity of `append` vs `insert`?**

Answer:
- `append(x)`: **O(1) amortized**. Python over-allocates memory, so most appends are O(1). Occasionally triggers a resize (O(n)), but amortized over many operations it's O(1).
- `insert(i, x)`: **O(n)**. All elements from index `i` onward must be shifted right by one position.

---

**Q5: What is the time complexity of `remove` and `in` operator?**

Answer: Both are **O(n)** because they require a linear scan through the list.
- `remove(x)` finds the first occurrence (O(n)) then shifts elements (O(n)).
- `x in lst` scans from left until found or exhausted.

For O(1) membership testing, use a `set` or `dict`.

---

**Q6: What is the difference between shallow and deep copy?**

Answer:
- **Shallow copy** (`list.copy()`, `lst[:]`, `list(lst)`) creates a new list object but the elements themselves are not copied — nested mutable objects are shared.
- **Deep copy** (`copy.deepcopy()`) recursively copies all nested objects, creating fully independent copies.

Use deep copy when your list contains mutable nested objects and you need complete independence.

---

**Q7: How does list comprehension compare to `map()` and `filter()`?**

Answer:
- List comprehensions are generally **more readable** and **slightly faster** than `map`/`filter` with lambdas.
- `map`/`filter` return **lazy iterators** in Python 3 (memory efficient for large data).
- For simple transformations, comprehensions are preferred (PEP 8 style).
- `map` with a named function (no lambda) can be faster than a comprehension.

```python
# Equivalent — comprehension preferred
[x**2 for x in range(10)]
list(map(lambda x: x**2, range(10)))
```

---

**Q8: What happens when you do `a = b = []` vs `a, b = [], []`?**

Answer:
```python
# Both a and b point to the SAME list object
a = b = []
a.append(1)
print(b)   # [1]  — b is affected!

# a and b are DIFFERENT list objects
a, b = [], []
a.append(1)
print(b)   # []  — b is unaffected
```

---

**Q9: How do you remove duplicates from a list while preserving order?**

Answer:
```python
lst = [3, 1, 2, 1, 3, 4]

# Python 3.7+ — dict preserves insertion order
unique = list(dict.fromkeys(lst))   # [3, 1, 2, 4]

# Using a seen set
seen = set()
unique = [x for x in lst if not (x in seen or seen.add(x))]
```

---

**Q10: What is the difference between `del`, `remove()`, and `pop()`?**

Answer:
```python
lst = [10, 20, 30, 40]

# del — removes by index or slice, no return value
del lst[1]        # lst = [10, 30, 40]
del lst[0:2]      # removes slice

# remove(x) — removes first occurrence by VALUE, raises ValueError if missing
lst.remove(30)    # removes 30

# pop(i) — removes by INDEX, returns the removed element
val = lst.pop(0)  # returns 10, removes it from list
val = lst.pop()   # removes and returns last element
```
