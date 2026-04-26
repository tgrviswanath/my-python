# 02 — Operators

## Arithmetic Operators

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `+` | Addition | `3 + 2` | `5` |
| `-` | Subtraction | `3 - 2` | `1` |
| `*` | Multiplication | `3 * 2` | `6` |
| `/` | True division | `7 / 2` | `3.5` |
| `//` | Floor division | `7 // 2` | `3` |
| `%` | Modulo | `7 % 2` | `1` |
| `**` | Exponentiation | `2 ** 10` | `1024` |

## Comparison Operators

```python
==  !=  <  >  <=  >=
```

Python supports **chained comparisons**:
```python
1 < x < 10       # equivalent to (1 < x) and (x < 10)
0 <= score <= 100
```

## Logical Operators

| Operator | Behavior |
|----------|----------|
| `and` | Returns first falsy value, or last value |
| `or` | Returns first truthy value, or last value |
| `not` | Returns `True`/`False` |

**Short-circuit evaluation:**
```python
x = None
y = x or "default"   # "default" — x is falsy
z = x and x.value    # None — short-circuits, no AttributeError
```

## Bitwise Operators

```python
&   # AND
|   # OR
^   # XOR
~   # NOT (bitwise complement)
<<  # left shift
>>  # right shift

5 & 3   # 1   (101 & 011 = 001)
5 | 3   # 7   (101 | 011 = 111)
5 ^ 3   # 6   (101 ^ 011 = 110)
~5      # -6  (-(5+1))
5 << 1  # 10  (multiply by 2)
5 >> 1  # 2   (divide by 2)
```

## Assignment Operators

```python
x += 1    # x = x + 1
x -= 1
x *= 2
x /= 2
x //= 2
x %= 3
x **= 2
x &= 0xFF
x |= 0x01
x ^= mask
x <<= 1
x >>= 1
```

## Walrus Operator `:=` (Python 3.8+)

Assigns and returns a value in an expression:
```python
# Without walrus
data = get_data()
if data:
    process(data)

# With walrus
if data := get_data():
    process(data)

# Useful in while loops
while chunk := file.read(8192):
    process(chunk)
```

## Operator Precedence (high to low)

1. `()` — parentheses
2. `**` — exponentiation
3. `+x`, `-x`, `~x` — unary
4. `*`, `/`, `//`, `%`
5. `+`, `-`
6. `<<`, `>>`
7. `&`
8. `^`
9. `|`
10. `==`, `!=`, `<`, `>`, `<=`, `>=`, `is`, `is not`, `in`, `not in`
11. `not`
12. `and`
13. `or`

---

## Interview Questions

### Q1: What is the difference between `/` and `//`?
**Answer:**
- `/` is **true division** — always returns `float`
- `//` is **floor division** — returns the largest integer ≤ result

```python
7 / 2    # 3.5
7 // 2   # 3
-7 // 2  # -4  (floor toward -infinity, not truncate)
-7 / 2   # -3.5
```

---

### Q2: How does `and`/`or` work with non-boolean values?
**Answer:**
`and` and `or` don't return `True`/`False` — they return one of their **operands**.
- `a and b` → returns `a` if `a` is falsy, else returns `b`
- `a or b` → returns `a` if `a` is truthy, else returns `b`

```python
0 and "hello"    # 0      (0 is falsy, return it)
1 and "hello"    # "hello" (1 is truthy, return b)
0 or "default"   # "default"
"value" or "default"  # "value"
None or [] or 0 or "found"  # "found"
```

---

### Q3: What is the walrus operator and when would you use it?
**Answer:**
`:=` (walrus/assignment expression, Python 3.8+) assigns a value as part of an expression, avoiding repeated computation.

```python
# Avoid calling expensive_func() twice
if (n := expensive_func()) > 10:
    print(f"Got {n}")

# Clean while loop
while line := file.readline():
    process(line)

# List comprehension with condition
results = [y for x in data if (y := transform(x)) is not None]
```

---

### Q4: What does `**` do and what is its associativity?
**Answer:**
`**` is exponentiation. It is **right-associative**:
```python
2 ** 3 ** 2   # 2 ** (3 ** 2) = 2 ** 9 = 512
(2 ** 3) ** 2 # 8 ** 2 = 64
```

---

### Q5: What is the result of `not not x`?
**Answer:**
`not not x` converts `x` to its boolean equivalent — same as `bool(x)`.
```python
not not 0      # False
not not "hi"   # True
not not []     # False
```

---

### Q6: How do bitwise operators work? Give a practical use case.
**Answer:**
Bitwise operators work on the binary representation of integers.

Practical uses:
```python
# Check if number is even/odd
n & 1 == 0   # even
n & 1 == 1   # odd

# Set a flag
flags = 0b0000
READ  = 0b0001
WRITE = 0b0010
EXEC  = 0b0100

flags |= READ | WRITE   # set READ and WRITE
flags & READ != 0       # check if READ is set
flags &= ~WRITE         # clear WRITE flag
flags ^= EXEC           # toggle EXEC flag

# Fast multiply/divide by powers of 2
x << 3   # x * 8
x >> 2   # x // 4
```

---

### Q7: What is operator overloading?
**Answer:**
Python allows classes to define behavior for operators via **dunder methods**:

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

v1 = Vector(1, 2)
v2 = Vector(3, 4)
print(v1 + v2)   # Vector(4, 6)
print(v1 * 3)    # Vector(3, 6)
```

---

### Q8: What is the difference between `is` and `==` for strings?
**Answer:**
Due to **string interning**, short strings and string literals may share the same object, making `is` return `True`. But this is an implementation detail — always use `==` for string comparison.

```python
a = "hello"
b = "hello"
a is b    # True  — interned (implementation detail)
a == b    # True  — correct way

a = "hello world"
b = "hello world"
a is b    # may be False — longer strings may not be interned
a == b    # True  — always correct
```
