# Python Dictionaries — Comprehensive Guide

## 1. Creation

```python
# Empty dict
d = {}
d = dict()

# With values
d = {"name": "Alice", "age": 30}
d = dict(name="Alice", age=30)          # keyword arguments
d = dict([("name", "Alice"), ("age", 30)])  # from iterable of pairs

# From two lists
keys = ["a", "b", "c"]
values = [1, 2, 3]
d = dict(zip(keys, values))   # {'a': 1, 'b': 2, 'c': 3}

# Dict comprehension
squares = {x: x**2 for x in range(6)}   # {0:0, 1:1, 2:4, 3:9, 4:16, 5:25}

# Nested
config = {
    "database": {"host": "localhost", "port": 5432},
    "cache": {"host": "redis", "port": 6379},
}
```

---

## 2. CRUD Operations

```python
d = {"name": "Alice", "age": 30}

# Create / Update
d["city"] = "NYC"          # add new key
d["age"] = 31              # update existing key

# Read
d["name"]                  # "Alice" — KeyError if missing
d.get("name")              # "Alice"
d.get("missing")           # None (no error)
d.get("missing", "default")  # "default"

# Delete
del d["city"]              # KeyError if missing
d.pop("age")               # returns 30, removes key
d.pop("missing", None)     # returns None, no error
d.popitem()                # removes and returns last inserted (key, value) pair

# Check existence
"name" in d                # True
"missing" in d             # False
"missing" not in d         # True
```

---

## 3. Dict Methods

### keys(), values(), items()
```python
d = {"a": 1, "b": 2, "c": 3}

d.keys()    # dict_keys(['a', 'b', 'c'])   — view object
d.values()  # dict_values([1, 2, 3])       — view object
d.items()   # dict_items([('a',1),('b',2),('c',3)])  — view object

# Views are dynamic — reflect changes to the dict
keys_view = d.keys()
d["d"] = 4
print(keys_view)   # dict_keys(['a', 'b', 'c', 'd'])

# Convert to list
list(d.keys())
list(d.values())
list(d.items())
```

### get() and setdefault()
```python
d = {"a": 1}

# get — safe access with optional default
d.get("a")           # 1
d.get("b")           # None
d.get("b", 0)        # 0

# setdefault — get value if key exists, else set and return default
d.setdefault("a", 99)   # returns 1 (key exists, not changed)
d.setdefault("b", 99)   # returns 99 (key added with value 99)
print(d)                # {"a": 1, "b": 99}

# Common use: grouping
groups = {}
for item in ["apple", "banana", "avocado", "blueberry"]:
    key = item[0]
    groups.setdefault(key, []).append(item)
# {'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry']}
```

### update()
```python
d = {"a": 1, "b": 2}

d.update({"b": 20, "c": 3})   # updates b, adds c
d.update(d=4, e=5)            # keyword arguments
d.update([("f", 6)])          # from iterable of pairs
```

### pop() and popitem()
```python
d = {"a": 1, "b": 2, "c": 3}

d.pop("a")           # returns 1, removes "a"
d.pop("x", None)     # returns None, no KeyError
d.popitem()          # returns ("c", 3) — last inserted item (Python 3.7+)
```

### copy()
```python
d = {"a": 1, "b": [1, 2]}
shallow = d.copy()   # shallow copy
import copy
deep = copy.deepcopy(d)   # deep copy
```

---

## 4. Dict Comprehension

```python
# Basic
squares = {x: x**2 for x in range(6)}

# With condition
even_squares = {x: x**2 for x in range(10) if x % 2 == 0}

# Invert a dict (swap keys and values)
original = {"a": 1, "b": 2, "c": 3}
inverted = {v: k for k, v in original.items()}

# Filter dict
scores = {"Alice": 85, "Bob": 92, "Charlie": 78}
passing = {name: score for name, score in scores.items() if score >= 80}

# Nested dict comprehension
matrix = {i: {j: i*j for j in range(1, 4)} for i in range(1, 4)}
```

---

## 5. collections.defaultdict

```python
from collections import defaultdict

# No KeyError on missing keys — auto-creates with default factory
dd = defaultdict(int)
dd["count"] += 1    # no KeyError, starts at 0

dd = defaultdict(list)
dd["group"].append("item")   # no KeyError, starts with []

dd = defaultdict(set)
dd["tags"].add("python")

# Word frequency counter
from collections import defaultdict
text = "the quick brown fox jumps over the lazy dog"
freq = defaultdict(int)
for word in text.split():
    freq[word] += 1

# Grouping
from collections import defaultdict
groups = defaultdict(list)
data = [("a", 1), ("b", 2), ("a", 3), ("b", 4)]
for key, val in data:
    groups[key].append(val)
# defaultdict(list, {'a': [1, 3], 'b': [2, 4]})

# Nested defaultdict
nested = defaultdict(lambda: defaultdict(int))
nested["row"]["col"] += 1
```

---

## 6. collections.OrderedDict

```python
from collections import OrderedDict

# In Python 3.7+, regular dicts maintain insertion order
# OrderedDict is still useful for:
# 1. move_to_end()
# 2. Equality comparison that considers order

od = OrderedDict([("a", 1), ("b", 2), ("c", 3)])
od.move_to_end("a")          # move "a" to end
od.move_to_end("c", last=False)  # move "c" to front

# Order-sensitive equality
od1 = OrderedDict([("a", 1), ("b", 2)])
od2 = OrderedDict([("b", 2), ("a", 1)])
od1 == od2   # False (order matters)

d1 = {"a": 1, "b": 2}
d2 = {"b": 2, "a": 1}
d1 == d2     # True (regular dicts ignore order in comparison)

# LRU Cache implementation
class LRUCache:
    def __init__(self, capacity):
        self.cache = OrderedDict()
        self.capacity = capacity

    def get(self, key):
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
```

---

## 7. collections.Counter

```python
from collections import Counter

# Count elements
c = Counter("abracadabra")
# Counter({'a': 5, 'b': 2, 'r': 2, 'c': 1, 'd': 1})

c = Counter([1, 2, 2, 3, 3, 3])
# Counter({3: 3, 2: 2, 1: 1})

c = Counter({"a": 3, "b": 1})

# Most common
c.most_common(2)   # [('a', 5), ('b', 2)]

# Arithmetic
c1 = Counter("aab")
c2 = Counter("abc")
c1 + c2   # Counter({'a': 3, 'b': 2, 'c': 1})
c1 - c2   # Counter({'a': 1})  — only positive counts
c1 & c2   # Counter({'a': 1, 'b': 1})  — min
c1 | c2   # Counter({'a': 2, 'b': 1, 'c': 1})  — max

# elements() — expand back to list
list(Counter("aab").elements())   # ['a', 'a', 'b']

# Update
c = Counter("hello")
c.update("world")   # adds counts

# Subtract
c.subtract("hello")   # subtracts counts (can go negative)
```

---

## 8. collections.ChainMap

```python
from collections import ChainMap

# Combines multiple dicts into a single view (no copying)
defaults = {"color": "red", "size": "medium"}
user_prefs = {"color": "blue"}
config = ChainMap(user_prefs, defaults)

config["color"]   # "blue"  — user_prefs takes priority
config["size"]    # "medium"  — falls back to defaults

# Writes go to the first map
config["weight"] = "heavy"
user_prefs   # {"color": "blue", "weight": "heavy"}

# Common use: layered configuration
import os
env_vars = dict(os.environ)
app_defaults = {"DEBUG": "False", "PORT": "8000"}
settings = ChainMap(env_vars, app_defaults)
```

---

## 9. Merging Dicts

```python
d1 = {"a": 1, "b": 2}
d2 = {"b": 3, "c": 4}

# Python 3.9+ — merge operator |
merged = d1 | d2          # {"a": 1, "b": 3, "c": 4}  — d2 wins on conflict

# Python 3.9+ — update operator |=
d1 |= d2                  # d1 is updated in place

# Python 3.5+ — unpacking
merged = {**d1, **d2}     # {"a": 1, "b": 3, "c": 4}

# update() method
merged = d1.copy()
merged.update(d2)

# dict() constructor
merged = dict(list(d1.items()) + list(d2.items()))  # old style, avoid
```

---

## 10. Iteration Patterns

```python
d = {"a": 1, "b": 2, "c": 3}

# Iterate over keys (default)
for key in d:
    print(key)

# Iterate over values
for value in d.values():
    print(value)

# Iterate over key-value pairs
for key, value in d.items():
    print(f"{key}: {value}")

# Safe deletion during iteration — iterate over a copy
for key in list(d.keys()):
    if d[key] < 2:
        del d[key]

# Sorted iteration
for key in sorted(d):
    print(key, d[key])

# Reverse iteration (Python 3.8+)
for key in reversed(d):
    print(key)
```

---

## 11. Hash Table Internals

Python dicts are implemented as **hash tables**:

1. **Hashing**: `hash(key)` computes an integer hash value.
2. **Slot selection**: `hash(key) % table_size` determines the slot.
3. **Collision handling**: Open addressing with probing (not chaining).
4. **Load factor**: When ~2/3 full, the table is resized (doubled).
5. **Ordering**: Since Python 3.7, insertion order is guaranteed (implementation detail since 3.6).

```python
# Keys must be hashable (immutable)
hash("string")    # works
hash(42)          # works
hash((1, 2))      # works
hash([1, 2])      # TypeError: unhashable type: 'list'

# Equal objects must have equal hashes
# If a == b, then hash(a) == hash(b)
hash(1) == hash(1.0)   # True (1 == 1.0)
```

---

## Interview Questions & Answers

**Q1: How does a Python dict work internally?**

Answer: Python dicts use a **hash table**. When you set `d[key] = value`:
1. Python calls `hash(key)` to get an integer.
2. The hash is used to find a slot in the internal array.
3. If the slot is occupied (collision), Python probes for the next available slot.
4. The key-value pair is stored in that slot.

Lookup is O(1) average because hashing directly computes the slot. Worst case is O(n) if many collisions occur (rare with good hash functions).

---

**Q2: What is the time complexity of dict operations?**

Answer:

| Operation | Average | Worst Case |
|-----------|---------|------------|
| `d[key]` | O(1) | O(n) |
| `d[key] = val` | O(1) | O(n) |
| `del d[key]` | O(1) | O(n) |
| `key in d` | O(1) | O(n) |
| `len(d)` | O(1) | O(1) |
| Iteration | O(n) | O(n) |

Worst case O(n) occurs with many hash collisions (adversarial inputs). Python 3.6+ uses hash randomization to mitigate this.

---

**Q3: Are Python dicts ordered? Since when?**

Answer: Yes, as of **Python 3.7**, dicts officially maintain **insertion order** as part of the language specification. In CPython 3.6, this was an implementation detail. Before 3.6, dicts were unordered.

```python
d = {}
d["c"] = 3
d["a"] = 1
d["b"] = 2
list(d.keys())   # ['c', 'a', 'b']  — insertion order preserved
```

---

**Q4: What is the difference between `d[key]` and `d.get(key)`?**

Answer:
- `d[key]` raises `KeyError` if the key doesn't exist.
- `d.get(key)` returns `None` (or a specified default) if the key doesn't exist — never raises.

```python
d = {"a": 1}
d["b"]           # KeyError
d.get("b")       # None
d.get("b", 0)    # 0

# Use [] when missing key is a bug (fail fast)
# Use .get() when missing key is expected/normal
```

---

**Q5: What does `setdefault` do and when would you use it?**

Answer: `d.setdefault(key, default)` returns `d[key]` if the key exists; otherwise sets `d[key] = default` and returns `default`. It's atomic — the check and set happen together.

```python
# Without setdefault
if key not in d:
    d[key] = []
d[key].append(value)

# With setdefault (cleaner)
d.setdefault(key, []).append(value)

# Common use: grouping items
groups = {}
for item in items:
    groups.setdefault(item.category, []).append(item)
```

---

**Q6: What is the difference between `defaultdict` and a regular dict with `setdefault`?**

Answer:
- `defaultdict(factory)` automatically creates a default value using `factory()` for any missing key on access.
- `setdefault` requires you to explicitly call it each time.
- `defaultdict` is cleaner for repeated grouping/accumulation patterns.
- `defaultdict` can cause bugs if you accidentally access a missing key (it silently creates it).

```python
from collections import defaultdict

# defaultdict — auto-creates on access
dd = defaultdict(list)
dd["key"].append(1)   # no need for setdefault

# Regular dict — explicit
d = {}
d.setdefault("key", []).append(1)
```

---

**Q7: How do you merge two dicts? What happens with duplicate keys?**

Answer:
```python
d1 = {"a": 1, "b": 2}
d2 = {"b": 3, "c": 4}

# Python 3.9+ — rightmost dict wins on conflict
merged = d1 | d2   # {"a": 1, "b": 3, "c": 4}

# Python 3.5+ — same behavior
merged = {**d1, **d2}   # {"a": 1, "b": 3, "c": 4}
```
The rightmost dict's values win for duplicate keys.

---

**Q8: How does Counter work and what are its use cases?**

Answer: `Counter` is a dict subclass that counts hashable objects. It's ideal for:
- Word/character frequency counting
- Finding most common elements
- Multiset arithmetic (add, subtract, intersect, union)

```python
from collections import Counter
c = Counter("mississippi")
c.most_common(3)   # [('s', 4), ('i', 4), ('p', 2)]
```

---

**Q9: What is ChainMap and when would you use it?**

Answer: `ChainMap` groups multiple dicts into a single view without copying. Lookups search each dict in order. Writes go to the first dict. Use it for:
- Layered configuration (env vars > user config > defaults)
- Scoped variable lookup (like Python's own scope chain)
- Temporary overrides without modifying the original dict

---

**Q10: Why can't you use a list as a dict key?**

Answer: Dict keys must be **hashable**. Lists are mutable — their contents can change, which would change their hash value and break the hash table invariant. Python enforces this by making lists unhashable.

Use a tuple instead (if the elements are hashable), or `frozenset` for unordered collections.

```python
d = {}
d[(1, 2, 3)] = "tuple key"    # OK
d[frozenset([1, 2])] = "ok"   # OK
# d[[1, 2, 3]] = "list key"   # TypeError
```
