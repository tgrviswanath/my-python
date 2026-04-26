# Python Data Types — Deep Dive

## Table of Contents
1. [int](#int)
2. [float](#float)
3. [bool](#bool)
4. [str](#str)
5. [bytes / bytearray](#bytes--bytearray)
6. [list](#list)
7. [tuple](#tuple)
8. [dict](#dict)
9. [set / frozenset](#set--frozenset)
10. [NoneType](#nonetype)
11. [Mutability Table](#mutability-table)
12. [Memory Sizes](#memory-sizes)
13. [Type Conversion Rules](#type-conversion-rules)
14. [Interview Q&A](#interview-qa)

---

## int

### CPython Internals

Python integers are **arbitrary precision** — they never overflow. Under the hood, CPython represents them as a C struct:

```c
// Objects/longobject.c (CPython)
typedef struct _longobject {
    PyObject_VAR_HEAD       // ob_refcnt, *ob_type, ob_size
    digit ob_digit[1];      // array of 30-bit "digits"
} PyLongObject;
```

- Each `digit` is a 30-bit chunk (on 64-bit systems). A Python int stores its value across an array of these digits.
- `ob_size` encodes both the number of digits and the sign (negative = negative ob_size).
- Small integers: CPython **caches** integers from **-5 to 256** at interpreter startup. Any reference to these values returns the same object — no allocation.

```python
a = 256
b = 256
print(a is b)   # True  — same cached object

a = 257
b = 257
print(a is b)   # False — new objects allocated (CPython REPL may differ)
```

### Performance Notes
- Arithmetic on small ints (cached) is faster — no heap allocation.
- Very large integers (hundreds of digits) are slow because operations iterate over the `ob_digit` array.
- Use `int.bit_length()` to understand storage size.

```python
import sys
print(sys.getsizeof(0))    # 24 bytes
print(sys.getsizeof(1))    # 28 bytes
print(sys.getsizeof(2**30))# 32 bytes — needs 2 digits
print(sys.getsizeof(2**60))# 36 bytes — needs 3 digits
```

### Common Bugs
```python
# Integer division vs float division
print(7 / 2)   # 3.5  (float)
print(7 // 2)  # 3    (floor division)
print(-7 // 2) # -4   (floors toward -infinity, not zero!)

# Overflow? No — but performance degrades
x = 10 ** 10_000  # valid, just slow
```

---

## float

### IEEE 754 Double Precision

Python `float` maps directly to a C `double` — 64 bits:
- 1 sign bit
- 11 exponent bits
- 52 mantissa bits

This gives ~15–17 significant decimal digits of precision.

```python
# Classic precision issue
print(0.1 + 0.2)          # 0.30000000000000004
print(0.1 + 0.2 == 0.3)   # False

# Why? 0.1 in binary is 0.0001100110011... (repeating)
import struct
bits = struct.pack('d', 0.1)
print(bits.hex())  # shows the actual IEEE 754 bytes
```

### Fixes

```python
# 1. math.isclose for comparisons
import math
print(math.isclose(0.1 + 0.2, 0.3))  # True

# 2. decimal module for exact decimal arithmetic
from decimal import Decimal, getcontext
getcontext().prec = 50
print(Decimal('0.1') + Decimal('0.2'))  # 0.3 exactly

# 3. fractions module for exact rational arithmetic
from fractions import Fraction
print(Fraction(1, 10) + Fraction(2, 10))  # 3/10
```

### Special Values
```python
float('inf')   # positive infinity
float('-inf')  # negative infinity
float('nan')   # Not a Number
import math
math.isinf(float('inf'))  # True
math.isnan(float('nan'))  # True
```

### Memory
```python
import sys
print(sys.getsizeof(3.14))  # 24 bytes — always fixed
```

---

## bool

### Subclass of int

`bool` is a **subclass of `int`**. `True` and `False` are singletons.

```python
print(isinstance(True, int))   # True
print(True == 1)               # True
print(False == 0)              # True
print(True + True)             # 2
print(True * 5)                # 5

# Identity — always singletons
print(True is True)            # True
print(bool(1) is True)         # True
```

### Truthiness Rules

| Value | bool() |
|-------|--------|
| `0`, `0.0`, `0j` | `False` |
| `""`, `[]`, `()`, `{}`, `set()` | `False` |
| `None` | `False` |
| Everything else | `True` |

```python
# Custom truthiness via __bool__ or __len__
class MyList:
    def __init__(self, data):
        self.data = data
    def __bool__(self):
        return len(self.data) > 0

print(bool(MyList([])))    # False
print(bool(MyList([1])))   # True
```

---

## str

### Unicode Internals (PEP 393 — Flexible String Representation)

Since Python 3.3, CPython uses one of three internal encodings depending on the highest code point in the string:

| Encoding | Code point range | Bytes per char |
|----------|-----------------|----------------|
| Latin-1 (UCS-1) | U+0000–U+00FF | 1 |
| UCS-2 | U+0000–U+FFFF | 2 |
| UCS-4 | U+0000–U+10FFFF | 4 |

```python
import sys
s1 = "hello"          # Latin-1: 5 chars × 1 byte = 5 bytes data
s2 = "héllo"          # Latin-1 still (é is U+00E9)
s3 = "你好"            # UCS-2: 2 chars × 2 bytes = 4 bytes data
s4 = "😀"             # UCS-4: 1 char × 4 bytes = 4 bytes data

print(sys.getsizeof(s1))  # 54 bytes (50 overhead + 5×1)
print(sys.getsizeof(s3))  # 76 bytes (50 overhead + 2×2 + padding... varies)
print(sys.getsizeof(s4))  # 80 bytes (50 overhead + 1×4 + padding)
```

### Immutability

Strings are **immutable** — any "modification" creates a new object.

```python
s = "hello"
# s[0] = 'H'  # TypeError: 'str' object does not support item assignment

# Concatenation creates new objects
s = s + " world"  # new string allocated
```

### String Interning

CPython **interns** (caches) string literals that look like identifiers (alphanumeric + underscore, no spaces):

```python
a = "hello"
b = "hello"
print(a is b)       # True — interned

a = "hello world"
b = "hello world"
print(a is b)       # False — not interned (has space)

# Force interning
import sys
a = sys.intern("hello world")
b = sys.intern("hello world")
print(a is b)       # True
```

### Common String Methods

```python
s = "  Hello, World!  "
s.strip()           # "Hello, World!"
s.lower()           # "  hello, world!  "
s.upper()           # "  HELLO, WORLD!  "
s.replace("World", "Python")
s.split(", ")       # ["  Hello", "World!  "]
", ".join(["a", "b", "c"])  # "a, b, c"
s.startswith("  H") # True
s.find("World")     # 9
s.count("l")        # 3
```

---

## bytes / bytearray

### bytes — Immutable Sequence of Bytes

```python
b = b"hello"
b = bytes([72, 101, 108, 108, 111])
b = "hello".encode("utf-8")

print(b[0])         # 72 (int, not char)
print(b[1:3])       # b'el'
# b[0] = 65         # TypeError — immutable
```

### bytearray — Mutable Sequence of Bytes

```python
ba = bytearray(b"hello")
ba[0] = 72          # OK — mutable
ba.append(33)       # bytearray(b'Hello!')
ba.extend(b" world")
```

### Use Cases

| Type | Use Case |
|------|----------|
| `bytes` | Network data, file I/O, cryptography, immutable binary data |
| `bytearray` | In-place binary manipulation, building binary protocols |

```python
# Encoding/decoding
text = "café"
encoded = text.encode("utf-8")   # b'caf\xc3\xa9'
decoded = encoded.decode("utf-8") # "café"

# bytes vs str — never mix without explicit conversion
# b"hello" + "world"  # TypeError
```

---

## list

### Dynamic Array with Over-Allocation

CPython's list is a **dynamic array** (`PyListObject`):

```c
typedef struct {
    PyObject_VAR_HEAD
    PyObject **ob_item;   // pointer to array of pointers
    Py_ssize_t allocated; // total allocated slots
} PyListObject;
```

`len(lst)` = number of items stored  
`allocated` = number of slots reserved (always ≥ len)

### Over-Allocation Strategy

When a list grows beyond its allocated capacity, CPython uses this formula:

```c
// Objects/listobject.c
new_allocated = (size_t)newsize + (newsize >> 3) + (newsize < 9 ? 3 : 6);
```

This gives the growth sequence: **0 → 4 → 8 → 16 → 25 → 35 → 46 → 58 → 72 → 88...**

```python
import sys

lst = []
prev_size = sys.getsizeof(lst)
for i in range(20):
    lst.append(i)
    size = sys.getsizeof(lst)
    if size != prev_size:
        print(f"len={len(lst)}, size={size} bytes")
        prev_size = size
```

### Amortized O(1) Append

Although individual appends occasionally trigger O(n) reallocation, the **amortized** cost per append is O(1) because the over-allocation doubles capacity, so reallocations happen exponentially less often.

### Performance Notes

```python
# List comprehension is faster than append loop
squares = [x**2 for x in range(1000)]  # faster
squares = []
for x in range(1000):
    squares.append(x**2)               # slower (attribute lookup each iter)

# Pre-allocate if size is known
lst = [None] * 1000  # avoids repeated reallocation

# Avoid insert(0, x) — O(n) shift
from collections import deque
dq = deque()
dq.appendleft(x)  # O(1)
```

---

## tuple

### Fixed-Size Array

Tuples are **immutable sequences** stored as a fixed-size C array of pointers:

```c
typedef struct {
    PyObject_VAR_HEAD
    PyObject *ob_item[1];  // fixed array
} PyTupleObject;
```

No `allocated` field — no over-allocation. Memory is exactly `sizeof(pointer) × n`.

```python
import sys
lst = [1, 2, 3, 4, 5]
tpl = (1, 2, 3, 4, 5)

print(sys.getsizeof(lst))  # 104 bytes (with over-allocation)
print(sys.getsizeof(tpl))  # 80 bytes  (exact)
```

### Why Tuples Are Faster

1. **Creation**: CPython has a **tuple constant folding** optimization — tuple literals of constants are stored as code constants, not built at runtime.
2. **Iteration**: Slightly faster due to simpler internal structure.
3. **Memory**: No over-allocation overhead.
4. **Hashing**: Tuples are hashable (can be dict keys / set members); lists are not.

```python
import timeit
print(timeit.timeit("(1,2,3,4,5)", number=10_000_000))  # ~0.05s
print(timeit.timeit("[1,2,3,4,5]", number=10_000_000))  # ~0.15s
```

### Tuple Packing / Unpacking

```python
point = (3, 4)
x, y = point           # unpacking
a, *rest = (1, 2, 3, 4)  # extended unpacking: a=1, rest=[2,3,4]
```

---

## dict

### Hash Table with Open Addressing

Python dicts are **hash tables**. Each entry stores `(hash, key, value)`.

```
Index:  0    1    2    3    4    5    6    7
        --   --  key2  --  key1  --  key3  --
```

**Collision resolution**: Open addressing with **pseudo-random probing** (not linear probing):

```c
// Simplified probe sequence
i = hash % size
if slot[i] is occupied:
    i = (5*i + 1 + perturb) % size
    perturb >>= 5
```

### Load Factor & Resizing

- Dict resizes when **2/3 full** (load factor = 0.67).
- Resize doubles the table size.
- Resize is O(n) but amortized O(1) per insertion.

### Python 3.7+ Ordered

Since Python 3.7, dicts maintain **insertion order** as a language guarantee (CPython 3.6 had it as implementation detail).

The internal structure was redesigned in CPython 3.6 to use a compact array + separate index table, reducing memory by ~20%.

```python
d = {}
d['a'] = 1
d['b'] = 2
d['c'] = 3
print(list(d.keys()))  # ['a', 'b', 'c'] — guaranteed order

# Common operations
d.get('x', 0)          # safe get with default
d.setdefault('y', [])  # insert if missing
d.update({'d': 4})
{**d, 'e': 5}          # merge (Python 3.5+)
d | {'e': 5}           # merge operator (Python 3.9+)
```

### Memory

```python
import sys
print(sys.getsizeof({}))        # 64 bytes (empty)
print(sys.getsizeof({'a': 1}))  # 232 bytes (first entry triggers allocation)
```

---

## set / frozenset

### Hash Table Without Values

Sets use the same hash table mechanism as dicts but store only keys (no values). Each slot holds `(hash, key)`.

```python
s = {1, 2, 3, 2, 1}
print(s)              # {1, 2, 3} — duplicates removed

# Set operations
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}
a | b    # union:        {1, 2, 3, 4, 5, 6}
a & b    # intersection: {3, 4}
a - b    # difference:   {1, 2}
a ^ b    # symmetric diff: {1, 2, 5, 6}

# Membership test: O(1) average
print(3 in a)   # True — hash lookup, not linear scan
```

### frozenset — Immutable Set

```python
fs = frozenset([1, 2, 3])
# fs.add(4)  # AttributeError — immutable
print(hash(fs))  # hashable — can be dict key or set member
```

### Performance Notes

```python
# Membership test: set O(1) vs list O(n)
import timeit
lst = list(range(10000))
st = set(range(10000))

timeit.timeit("9999 in lst", globals=globals())  # ~100µs
timeit.timeit("9999 in st",  globals=globals())  # ~0.05µs
```

---

## NoneType

`None` is a **singleton** — there is exactly one `None` object in a Python process.

```python
print(type(None))       # <class 'NoneType'>
print(None is None)     # True — always use 'is', not '=='
print(id(None))         # same address every time

# Common pattern: sentinel value
def find(lst, val):
    for i, x in enumerate(lst):
        if x == val:
            return i
    return None  # explicit "not found"

result = find([1, 2, 3], 5)
if result is None:      # correct
    print("not found")
```

---

## Mutability Table

| Type | Mutable | Hashable | Ordered | Duplicates |
|------|---------|----------|---------|------------|
| `int` | No | Yes | — | — |
| `float` | No | Yes | — | — |
| `bool` | No | Yes | — | — |
| `str` | No | Yes | Yes | Yes |
| `bytes` | No | Yes | Yes | Yes |
| `bytearray` | Yes | No | Yes | Yes |
| `list` | Yes | No | Yes | Yes |
| `tuple` | No | Yes* | Yes | Yes |
| `dict` | Yes | No | Yes (3.7+) | Keys: No |
| `set` | Yes | No | No | No |
| `frozenset` | No | Yes | No | No |
| `NoneType` | No | Yes | — | — |

*Tuple is hashable only if all elements are hashable.

---

## Memory Sizes

```python
import sys

types_and_values = [
    ("int(0)",       0),
    ("int(256)",     256),
    ("int(257)",     257),
    ("int(2**30)",   2**30),
    ("float",        3.14),
    ("bool",         True),
    ("str('')",      ""),
    ("str('hello')", "hello"),
    ("bytes(5)",     b"hello"),
    ("bytearray(5)", bytearray(5)),
    ("list([])",     []),
    ("list([1..5])", [1,2,3,4,5]),
    ("tuple(())",    ()),
    ("tuple(1..5)",  (1,2,3,4,5)),
    ("dict({})",     {}),
    ("set(set())",   set()),
    ("None",         None),
]

for name, val in types_and_values:
    print(f"{name:20s}: {sys.getsizeof(val):4d} bytes")
```

Sample output (CPython 3.11, 64-bit):
```
int(0)              :   24 bytes
int(256)            :   28 bytes
int(257)            :   28 bytes
int(2**30)          :   32 bytes
float               :   24 bytes
bool                :   28 bytes
str('')             :   49 bytes
str('hello')        :   54 bytes
bytes(5)            :   38 bytes
bytearray(5)        :   61 bytes
list([])            :   56 bytes
list([1..5])        :  104 bytes
tuple(())           :   40 bytes
tuple(1..5)         :   80 bytes
dict({})            :   64 bytes
set(set())          :  216 bytes
None                :   16 bytes
```

---

## Type Conversion Rules

### Implicit (Coercion)
Python does **not** do implicit type coercion between unrelated types (unlike JavaScript). Exceptions:
- `bool` → `int` in arithmetic: `True + 1 == 2`
- `int` → `float` in mixed arithmetic: `1 + 2.0 == 3.0`

### Explicit Conversion

```python
# To int
int("42")        # 42
int(3.9)         # 3  (truncates, does NOT round)
int(True)        # 1
int("0xFF", 16)  # 255

# To float
float("3.14")    # 3.14
float(42)        # 42.0

# To str
str(42)          # "42"
str(3.14)        # "3.14"
repr([1,2,3])    # "[1, 2, 3]"

# To list/tuple/set
list("abc")      # ['a', 'b', 'c']
tuple([1,2,3])   # (1, 2, 3)
set([1,2,2,3])   # {1, 2, 3}

# To bool
bool(0)          # False
bool("")         # False
bool([])         # False
bool(None)       # False
bool(42)         # True
```

### Conversion Gotchas

```python
int(3.9)    # 3  — truncation, not rounding
round(3.9)  # 4  — use round() for rounding

int("3.14") # ValueError — can't convert float string directly
int(float("3.14"))  # 3 — two-step conversion

# None conversions
int(None)   # TypeError
str(None)   # "None" (the string)
bool(None)  # False
```

---

## Interview Q&A

### Q1: Why does `0.1 + 0.2 != 0.3` in Python?

**A:** Python `float` uses IEEE 754 double-precision binary floating point. The decimal value `0.1` cannot be represented exactly in binary (it's a repeating fraction: `0.0001100110011...`). When stored, it's rounded to the nearest representable value. Adding two such approximations accumulates the rounding error, giving `0.30000000000000004` instead of `0.3`.

**Fix:** Use `math.isclose()` for comparisons, or `decimal.Decimal` for exact decimal arithmetic.

---

### Q2: What is the small integer cache in CPython, and why does it exist?

**A:** CPython pre-allocates integer objects for values **-5 to 256** at interpreter startup. Any reference to these values returns the same cached object rather than allocating a new one. This optimization exists because small integers are used extremely frequently (loop counters, indices, boolean-like values), so caching them avoids millions of heap allocations and garbage collections in typical programs.

```python
a = 100; b = 100; print(a is b)  # True — cached
a = 300; b = 300; print(a is b)  # False — not cached
```

---

### Q3: How does Python's list handle dynamic resizing, and what is the amortized complexity of `append()`?

**A:** Python lists are dynamic arrays. When `append()` would exceed the allocated capacity, CPython reallocates with extra space using the formula `new = old + (old >> 3) + (3 or 6)`. This gives a growth sequence of roughly 0→4→8→16→25→35... The key insight is that each element is "charged" a small constant for future reallocation work. Because capacity roughly grows by 12.5% each time, the total work across n appends is O(n), making the **amortized cost per append O(1)**.

---

### Q4: How does Python's dict handle hash collisions?

**A:** Python dicts use **open addressing** with pseudo-random probing. When two keys hash to the same slot, the collision is resolved by probing subsequent slots using the formula `i = (5*i + 1 + perturb) % size` where `perturb` starts as the full hash value and is right-shifted by 5 each step. This spreads collisions across the table better than linear probing. The dict resizes (doubles) when 2/3 full to keep collisions rare.

---

### Q5: Why are tuples faster than lists for creation and iteration?

**A:** Three reasons:
1. **Constant folding**: Tuple literals of constants (`(1, 2, 3)`) are stored as a single constant in the bytecode and loaded with one `LOAD_CONST` instruction. List literals always execute `BUILD_LIST` at runtime.
2. **No over-allocation**: Tuples allocate exactly the memory needed; lists allocate extra capacity.
3. **Simpler structure**: No `allocated` field to maintain; the C struct is smaller and cache-friendlier.

---

### Q6: What is string interning and when does CPython do it automatically?

**A:** String interning means storing only one copy of each distinct string value and reusing it. CPython automatically interns strings that look like Python identifiers (contain only letters, digits, underscores, and are not too long). This is done because identifier-like strings appear frequently as attribute names, variable names, and dictionary keys — interning makes identity comparisons (`is`) O(1) instead of O(n) character comparison. You can force interning with `sys.intern()`.

---

### Q7: What is the difference between `bytes` and `bytearray`?

**A:** Both represent sequences of bytes (integers 0–255), but:
- `bytes` is **immutable** — like `str` for binary data. It's hashable and can be a dict key.
- `bytearray` is **mutable** — supports item assignment, `append()`, `extend()`, etc.

Use `bytes` when you have fixed binary data (network packets, file contents you won't modify). Use `bytearray` when you need to build or modify binary data in place (e.g., constructing a binary protocol message byte by byte).

---

### Q8: Why is `None` compared with `is` rather than `==`?

**A:** `None` is a singleton — there is exactly one `None` object per Python process. Using `is None` checks **object identity** (same memory address), which is guaranteed to work correctly and is slightly faster than `==`. Using `==` calls `__eq__`, which could be overridden by a custom class to return `True` when compared to `None`, giving a false positive. PEP 8 explicitly recommends `is None` / `is not None`.

---

### Q9: How does Python's `bool` type relate to `int`, and what are the implications?

**A:** `bool` is a **subclass of `int`** (`True == 1`, `False == 0`). This means:
- Booleans can be used in arithmetic: `sum([True, False, True, True])` → `3` (counts `True` values).
- `True` and `False` are singletons, so `bool(x) is True` works.
- `isinstance(True, int)` returns `True`.
- Implication: never use `if x == True:` — use `if x:`. The former fails for `x = 1` (which equals `True` but isn't `True`).

---

### Q10: What is the memory layout difference between `list` and `tuple` for the same data?

**A:** For `[1, 2, 3, 4, 5]` vs `(1, 2, 3, 4, 5)`:
- **list**: `PyListObject` has `ob_item` (pointer to heap array) + `allocated` field. The heap array may have extra slots. On 64-bit CPython: 56 bytes (object) + 8×allocated bytes (pointer array on heap).
- **tuple**: `PyTupleObject` embeds the pointer array directly in the struct. No `allocated` field. On 64-bit CPython: 40 bytes + 8×n bytes.

For 5 elements: list ≈ 104 bytes (with over-allocation), tuple = 80 bytes. The tuple is also more cache-friendly since the data is contiguous with the object header.
