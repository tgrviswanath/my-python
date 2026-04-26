# 04 — Control Flow

## if / elif / else

```python
x = 10

if x > 0:
    print("positive")
elif x < 0:
    print("negative")
else:
    print("zero")

# Ternary (conditional expression)
sign = "positive" if x > 0 else "non-positive"
```

## for Loops

```python
# Iterate over sequence
for i in range(5):          # 0, 1, 2, 3, 4
    print(i)

for i in range(2, 10, 2):  # 2, 4, 6, 8
    print(i)

# enumerate — index + value
for i, val in enumerate(['a', 'b', 'c']):
    print(i, val)

# zip — parallel iteration
for a, b in zip([1, 2, 3], ['x', 'y', 'z']):
    print(a, b)

# zip_longest — unequal lengths
from itertools import zip_longest
for a, b in zip_longest([1, 2], ['x', 'y', 'z'], fillvalue=0):
    print(a, b)
```

## while Loops

```python
n = 10
while n > 0:
    print(n)
    n -= 1

# while with else
i = 0
while i < 5:
    i += 1
else:
    print("loop finished normally")  # runs if no break
```

## break, continue, pass

```python
# break — exit loop
for i in range(10):
    if i == 5:
        break
    print(i)  # 0 1 2 3 4

# continue — skip iteration
for i in range(10):
    if i % 2 == 0:
        continue
    print(i)  # 1 3 5 7 9

# pass — placeholder (no-op)
def todo():
    pass  # implement later

class Empty:
    pass
```

## for/while else

The `else` block runs **only if the loop completed without `break`**:

```python
def find_prime(n):
    for i in range(2, n):
        if n % i == 0:
            print(f"{n} is not prime")
            break
    else:
        print(f"{n} is prime")  # only if no break

find_prime(7)   # 7 is prime
find_prime(9)   # 9 is not prime
```

## match / case (Python 3.10+)

```python
command = "quit"

match command:
    case "quit":
        print("Quitting")
    case "go" | "move":
        print("Moving")
    case _:
        print("Unknown command")

# Structural pattern matching
point = (1, 0)
match point:
    case (0, 0):
        print("Origin")
    case (x, 0):
        print(f"On x-axis at {x}")
    case (0, y):
        print(f"On y-axis at {y}")
    case (x, y):
        print(f"Point at ({x}, {y})")
```

---

## Interview Questions

### Q1: What is the difference between `break` and `continue`?
**Answer:**
- `break` — **exits** the loop entirely
- `continue` — **skips** the rest of the current iteration and moves to the next

```python
for i in range(5):
    if i == 3:
        break       # stops at 3: prints 0, 1, 2
    print(i)

for i in range(5):
    if i == 3:
        continue    # skips 3: prints 0, 1, 2, 4
    print(i)
```

---

### Q2: What does the `else` clause on a loop do?
**Answer:**
The `else` block executes when the loop **completes normally** (without hitting `break`). Useful for search patterns.

```python
# Search for a value
target = 7
for n in [1, 3, 5, 9]:
    if n == target:
        print("Found!")
        break
else:
    print("Not found")  # runs because no break
```

---

### Q3: How does `range()` work? What does it return?
**Answer:**
`range()` returns a **lazy range object** (not a list). It generates numbers on demand.

```python
r = range(0, 10, 2)
print(type(r))    # <class 'range'>
print(list(r))    # [0, 2, 4, 6, 8]
print(len(r))     # 5
print(7 in r)     # False — O(1) membership test!
```

---

### Q4: What is the difference between `range()` and `enumerate()`?
**Answer:**
- `range(n)` generates indices `0..n-1`
- `enumerate(iterable)` yields `(index, value)` pairs from any iterable

```python
# Don't do this
for i in range(len(lst)):
    print(i, lst[i])

# Do this
for i, val in enumerate(lst):
    print(i, val)

# With start index
for i, val in enumerate(lst, start=1):
    print(i, val)
```

---

### Q5: How do you iterate over two lists simultaneously?
**Answer:**
Use `zip()`. It stops at the shortest iterable.

```python
names = ["Alice", "Bob", "Charlie"]
scores = [95, 87, 92]

for name, score in zip(names, scores):
    print(f"{name}: {score}")

# zip returns tuples — can unzip with *
pairs = list(zip(names, scores))
names2, scores2 = zip(*pairs)  # unzip
```

---

### Q6: What is a ternary expression in Python?
**Answer:**
```python
# Syntax: value_if_true if condition else value_if_false
x = 10
result = "even" if x % 2 == 0 else "odd"

# Nested (avoid for readability)
grade = "A" if score >= 90 else "B" if score >= 80 else "C"
```

---

### Q7: How does `match/case` differ from `if/elif`?
**Answer:**
`match/case` (Python 3.10+) supports **structural pattern matching** — it can destructure objects, sequences, and mappings, not just compare values.

```python
# match can destructure
def process(event):
    match event:
        case {"type": "click", "x": x, "y": y}:
            print(f"Click at ({x}, {y})")
        case {"type": "key", "key": k}:
            print(f"Key pressed: {k}")
        case _:
            print("Unknown event")

process({"type": "click", "x": 10, "y": 20})
```

---

### Q8: What is the most Pythonic way to check if a list is empty?
**Answer:**
```python
lst = []

# Pythonic — uses truthiness
if not lst:
    print("empty")

# Less Pythonic
if len(lst) == 0:
    print("empty")

# Also works but verbose
if lst == []:
    print("empty")
```
