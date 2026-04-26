# Python Sets — Comprehensive Guide

## 1. Set Creation

```python
# Empty set — MUST use set(), not {} (that creates an empty dict)
empty = set()

# With values
s = {1, 2, 3, 4, 5}
s = {1, 2, 2, 3, 3}   # {1, 2, 3}  — duplicates removed

# From iterable
s = set([1, 2, 3, 2, 1])   # {1, 2, 3}
s = set("hello")            # {'h', 'e', 'l', 'o'}
s = set(range(5))           # {0, 1, 2, 3, 4}

# Sets are unordered — no guaranteed iteration order
# Sets only store hashable elements
s = {1, "hello", (1, 2)}   # OK
# s = {[1, 2]}              # TypeError: unhashable type: 'list'
```

---

## 2. Basic Operations

```python
s = {1, 2, 3}

# Add
s.add(4)          # {1, 2, 3, 4}
s.add(2)          # {1, 2, 3, 4}  — no duplicate, no error

# Remove
s.remove(2)       # removes 2; raises KeyError if not found
s.discard(99)     # removes 99 if present; no error if missing
s.pop()           # removes and returns an arbitrary element
s.clear()         # removes all elements

# Membership — O(1) average
2 in s            # True
99 in s           # False

# Length
len(s)            # O(1)
```

---

## 3. Set Operations

### Union — all elements from both sets
```python
a = {1, 2, 3}
b = {3, 4, 5}

a | b              # {1, 2, 3, 4, 5}
a.union(b)         # {1, 2, 3, 4, 5}
a.union(b, {6, 7}) # multiple sets: {1, 2, 3, 4, 5, 6, 7}

# In-place
a |= b             # a = {1, 2, 3, 4, 5}
a.update(b)        # same as |=
```

### Intersection — elements in both sets
```python
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}

a & b                    # {3, 4}
a.intersection(b)        # {3, 4}
a.intersection(b, {4})   # {4}  — multiple sets

# In-place
a &= b
a.intersection_update(b)
```

### Difference — elements in a but not b
```python
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}

a - b              # {1, 2}
a.difference(b)    # {1, 2}
b - a              # {5, 6}  — order matters!

# In-place
a -= b
a.difference_update(b)
```

### Symmetric Difference — elements in either but not both
```python
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}

a ^ b                         # {1, 2, 5, 6}
a.symmetric_difference(b)     # {1, 2, 5, 6}

# In-place
a ^= b
a.symmetric_difference_update(b)
```

### Subset and Superset
```python
a = {1, 2}
b = {1, 2, 3, 4}

a <= b              # True  — a is subset of b
a.issubset(b)       # True
b >= a              # True  — b is superset of a
b.issuperset(a)     # True

a < b               # True  — proper subset (a != b)
a <= a              # True  — every set is a subset of itself
a < a               # False — not a proper subset

a.isdisjoint(b)     # False — they share elements
{1, 2}.isdisjoint({3, 4})  # True — no common elements
```

---

## 4. Set Comprehension

```python
# Basic
squares = {x**2 for x in range(10)}

# With condition
even_squares = {x**2 for x in range(10) if x % 2 == 0}

# From string — unique characters
unique_chars = {c.lower() for c in "Hello World" if c.isalpha()}

# Practical: unique domains from emails
emails = ["alice@gmail.com", "bob@yahoo.com", "charlie@gmail.com"]
domains = {email.split("@")[1] for email in emails}
# {'gmail.com', 'yahoo.com'}
```

---

## 5. frozenset

```python
# Immutable, hashable version of set
fs = frozenset([1, 2, 3])
fs = frozenset({1, 2, 3})

# Can be used as dict key or set member
d = {frozenset([1, 2]): "pair"}
s = {frozenset([1, 2]), frozenset([3, 4])}

# Supports all non-mutating set operations
fs1 = frozenset([1, 2, 3])
fs2 = frozenset([3, 4, 5])
fs1 | fs2    # frozenset({1, 2, 3, 4, 5})
fs1 & fs2    # frozenset({3})
fs1 - fs2    # frozenset({1, 2})

# Cannot add/remove elements
# fs.add(4)    # AttributeError
# fs.remove(1) # AttributeError

# Use case: representing graph edges (unordered pairs)
edges = {frozenset([1, 2]), frozenset([2, 3]), frozenset([1, 3])}
frozenset([2, 1]) in edges   # True — order doesn't matter
```

---

## 6. Time Complexity

| Operation | Average | Worst Case |
|-----------|---------|------------|
| `x in s` | O(1) | O(n) |
| `s.add(x)` | O(1) | O(n) |
| `s.remove(x)` | O(1) | O(n) |
| `s.discard(x)` | O(1) | O(n) |
| `len(s)` | O(1) | O(1) |
| `s | t` (union) | O(len(s)+len(t)) | — |
| `s & t` (intersection) | O(min(len(s),len(t))) | — |
| `s - t` (difference) | O(len(s)) | — |
| `s <= t` (subset) | O(len(s)) | — |

---

## 7. When to Use Sets

```python
# 1. Membership testing — O(1) vs O(n) for list
valid_users = {"alice", "bob", "charlie"}
if username in valid_users:   # O(1)
    pass

# 2. Removing duplicates
lst = [1, 2, 2, 3, 3, 3]
unique = list(set(lst))   # order not preserved!

# 3. Finding common elements
list1 = [1, 2, 3, 4]
list2 = [3, 4, 5, 6]
common = set(list1) & set(list2)   # {3, 4}

# 4. Finding unique elements
only_in_first = set(list1) - set(list2)   # {1, 2}

# 5. Deduplication while preserving order (Python 3.7+)
seen = set()
unique_ordered = [x for x in lst if not (x in seen or seen.add(x))]

# 6. Graph algorithms — visited nodes
visited = set()
def dfs(node, graph):
    if node in visited:
        return
    visited.add(node)
    for neighbor in graph[node]:
        dfs(neighbor, graph)
```

---

## 8. Practical Examples

```python
# Find duplicates in a list
def find_duplicates(lst):
    seen = set()
    return {x for x in lst if x in seen or seen.add(x)}

# Two-sum problem using set
def two_sum_exists(nums, target):
    seen = set()
    for num in nums:
        if target - num in seen:
            return True
        seen.add(num)
    return False

# Anagram check
def is_anagram(s1, s2):
    return Counter(s1) == Counter(s2)
    # Or: set(s1) == set(s2) only checks unique chars, not counts!

# Intersection of multiple lists
lists = [[1,2,3], [2,3,4], [3,4,5]]
common = set(lists[0]).intersection(*lists[1:])   # {3}
```

---

## Interview Questions & Answers

**Q1: What is the time complexity of `in` for a set vs a list?**

Answer:
- **Set**: O(1) average — uses a hash table for direct lookup.
- **List**: O(n) — requires linear scan.

This makes sets ideal for membership testing when you have many lookups. The tradeoff is that sets use more memory and don't preserve order.

```python
# For 1 million elements:
big_list = list(range(1_000_000))
big_set = set(range(1_000_000))

999_999 in big_list   # ~50ms
999_999 in big_set    # ~0.05ms
```

---

**Q2: What is the difference between `remove()` and `discard()`?**

Answer:
- `remove(x)` raises `KeyError` if `x` is not in the set.
- `discard(x)` silently does nothing if `x` is not in the set.

Use `discard` when you're not sure if the element exists and don't want to handle exceptions. Use `remove` when the element's absence is a bug (fail fast).

```python
s = {1, 2, 3}
s.remove(99)    # KeyError
s.discard(99)   # no error
```

---

**Q3: What is a frozenset and when would you use it?**

Answer: `frozenset` is an immutable, hashable version of `set`. Use it when:
- You need a set as a **dict key** or **set member**.
- You want to represent an **unordered, unique collection** that shouldn't change.
- You're representing graph edges or other unordered pairs.

```python
# Graph edges as frozensets (undirected)
edges = {frozenset([1, 2]), frozenset([2, 3])}
frozenset([2, 1]) in edges   # True
```

---

**Q4: How do you remove duplicates from a list using a set? What's the caveat?**

Answer:
```python
lst = [3, 1, 2, 1, 3]
unique = list(set(lst))   # removes duplicates but ORDER IS NOT PRESERVED
```

To preserve order:
```python
# Python 3.7+ — dict preserves insertion order
unique = list(dict.fromkeys(lst))   # [3, 1, 2]
```

---

**Q5: What is the difference between `|` and `union()`?**

Answer: Both compute the union, but:
- `|` only works with sets (both operands must be sets).
- `union()` accepts any iterable as argument.

```python
s = {1, 2, 3}
s | {4, 5}           # OK
s | [4, 5]           # TypeError
s.union([4, 5])      # OK — accepts any iterable
s.union([4, 5], (6,))  # multiple iterables
```

---

**Q6: How would you find elements that appear in exactly one of two lists?**

Answer: Use symmetric difference:
```python
a = [1, 2, 3, 4]
b = [3, 4, 5, 6]
unique_to_one = set(a) ^ set(b)   # {1, 2, 5, 6}
```

---

**Q7: Can a set contain another set? What about a frozenset?**

Answer:
- A set **cannot** contain another set (sets are mutable, thus unhashable).
- A set **can** contain a `frozenset` (frozensets are immutable and hashable).

```python
s = {frozenset([1, 2]), frozenset([3, 4])}   # OK
# s = {{1, 2}, {3, 4}}   # TypeError: unhashable type: 'set'
```

---

**Q8: How do sets handle hash collisions?**

Answer: Python sets use **open addressing** (like dicts). When two elements hash to the same slot, Python probes for the next available slot using a perturbation-based algorithm. This keeps lookup O(1) average. If the load factor exceeds ~2/3, the internal table is resized (doubled), which is O(n) but amortized O(1) per operation.

The key invariant: if `a == b`, then `hash(a) == hash(b)`. This is why custom objects that override `__eq__` must also override `__hash__`.
