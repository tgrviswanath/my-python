# 01 — Variables & Data Types

## Concepts

Python is **dynamically typed** — variables don't need type declarations.
The interpreter infers the type at runtime.

### Built-in Types

| Type | Example | Notes |
|------|---------|-------|
| `int` | `42`, `-7` | Arbitrary precision |
| `float` | `3.14`, `1e-5` | IEEE 754 double |
| `complex` | `3+4j` | Real + imaginary |
| `bool` | `True`, `False` | Subclass of `int` |
| `str` | `"hello"` | Immutable, Unicode |
| `bytes` | `b"data"` | Immutable byte sequence |
| `NoneType` | `None` | Singleton null value |

### Variable Assignment

```python
x = 10          # simple assignment
a = b = c = 0   # chained assignment
x, y = 1, 2     # tuple unpacking
x, *rest = [1, 2, 3, 4]  # starred unpacking
```

### Type Checking

```python
type(42)         # <class 'int'>
isinstance(42, int)   # True
isinstance(True, int) # True — bool IS an int
```

### Type Conversion

```python
int("42")    # 42
float("3.14") # 3.14
str(100)     # "100"
bool(0)      # False — falsy values: 0, "", [], {}, None
```

### id() and Memory

```python
a = 256
b = 256
a is b   # True  — CPython caches small ints (-5 to 256)

a = 1000
b = 1000
a is b   # False — different objects
```

---

## Interview Questions

### Q1: What is the difference between `==` and `is`?
**Answer:**
- `==` compares **values** (calls `__eq__`)
- `is` compares **identity** — whether both variables point to the **same object in memory** (same `id()`)

```python
a = [1, 2, 3]
b = [1, 2, 3]
a == b   # True  — same value
a is b   # False — different objects

c = a
a is c   # True  — same object
```

---

### Q2: Why is `True == 1` and `False == 0` in Python?
**Answer:**
`bool` is a **subclass of `int`**. `True` has integer value `1`, `False` has value `0`.

```python
True + True   # 2
True * 5      # 5
False + 1     # 1
isinstance(True, int)  # True
```

---

### Q3: What are Python's falsy values?
**Answer:**
The following evaluate to `False` in a boolean context:
- `None`
- `False`
- `0`, `0.0`, `0j`
- `""` (empty string)
- `[]`, `()`, `{}`, `set()` (empty collections)
- Objects whose `__bool__` returns `False` or `__len__` returns `0`

---

### Q4: What is the difference between `int` and `float` division?
**Answer:**
- `/` always returns `float` (true division)
- `//` returns `int` (floor division — rounds toward negative infinity)
- `%` is modulo

```python
7 / 2    # 3.5
7 // 2   # 3
-7 // 2  # -4  (floor, not truncate!)
7 % 2    # 1
```

---

### Q5: How does Python handle large integers?
**Answer:**
Python `int` has **arbitrary precision** — it can represent integers of any size, limited only by available memory. There is no overflow.

```python
2 ** 1000  # works fine — a very large number
```

---

### Q6: What is `None` and how is it different from `0`, `""`, or `False`?
**Answer:**
`None` is a **singleton** of type `NoneType` representing the absence of a value. It is falsy but distinct from other falsy values.

```python
None == 0      # False
None == False  # False
None == ""     # False
None is None   # True — always use `is` to check for None
```

---

### Q7: What is variable scope in Python? (LEGB rule)
**Answer:**
Python resolves names using the **LEGB** rule:
1. **L**ocal — inside the current function
2. **E**nclosing — in enclosing function scopes (closures)
3. **G**lobal — module-level
4. **B**uilt-in — Python's built-in namespace

```python
x = "global"

def outer():
    x = "enclosing"
    def inner():
        x = "local"
        print(x)  # "local"
    inner()
    print(x)  # "enclosing"

outer()
print(x)  # "global"
```

---

### Q8: What does `global` and `nonlocal` do?
**Answer:**
- `global x` — declares that `x` refers to the module-level variable
- `nonlocal x` — declares that `x` refers to the nearest enclosing scope variable

```python
count = 0
def increment():
    global count
    count += 1

def make_counter():
    n = 0
    def inc():
        nonlocal n
        n += 1
        return n
    return inc
```

---

### Q9: What is the difference between mutable and immutable types?
**Answer:**
- **Immutable**: `int`, `float`, `bool`, `str`, `tuple`, `frozenset`, `bytes` — cannot be changed after creation
- **Mutable**: `list`, `dict`, `set`, `bytearray` — can be modified in place

```python
s = "hello"
s[0] = "H"  # TypeError — strings are immutable

lst = [1, 2, 3]
lst[0] = 99  # OK — lists are mutable
```

---

### Q10: What is dynamic typing vs duck typing?
**Answer:**
- **Dynamic typing**: type is checked at runtime, not compile time
- **Duck typing**: "if it walks like a duck and quacks like a duck, it's a duck" — Python cares about what an object *can do* (its methods/attributes), not what *type* it is

```python
def add(a, b):
    return a + b  # works for int, float, str, list — anything with __add__

add(1, 2)       # 3
add("a", "b")   # "ab"
add([1], [2])   # [1, 2]
```
