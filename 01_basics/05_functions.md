# 05 — Functions

## Defining Functions

```python
def greet(name, greeting="Hello"):
    """Docstring: describes the function."""
    return f"{greeting}, {name}!"

greet("Alice")           # "Hello, Alice!"
greet("Bob", "Hi")       # "Hi, Bob!"
greet(greeting="Hey", name="Carol")  # keyword args
```

## *args and **kwargs

```python
def func(*args, **kwargs):
    print(args)    # tuple of positional args
    print(kwargs)  # dict of keyword args

func(1, 2, 3, x=4, y=5)
# (1, 2, 3)
# {'x': 4, 'y': 5}

# Unpacking when calling
def add(a, b, c):
    return a + b + c

nums = [1, 2, 3]
add(*nums)          # 6

params = {'a': 1, 'b': 2, 'c': 3}
add(**params)       # 6
```

## Keyword-Only and Positional-Only Parameters

```python
# Keyword-only: after *
def func(a, b, *, c, d=10):
    pass
func(1, 2, c=3)       # OK
func(1, 2, 3)         # TypeError — c must be keyword

# Positional-only: before /  (Python 3.8+)
def func(a, b, /, c, d):
    pass
func(1, 2, 3, 4)      # OK
func(a=1, b=2, c=3, d=4)  # TypeError — a, b must be positional
```

## Return Values

```python
def multi_return():
    return 1, 2, 3   # returns a tuple

a, b, c = multi_return()

# Functions without return return None
def no_return():
    x = 1  # no return statement

print(no_return())  # None
```

## Type Hints

```python
def add(a: int, b: int) -> int:
    return a + b

def greet(name: str, times: int = 1) -> list[str]:
    return [f"Hello, {name}!"] * times

from typing import Optional, Union
def find(lst: list[int], target: int) -> Optional[int]:
    try:
        return lst.index(target)
    except ValueError:
        return None
```

## First-Class Functions

Functions are objects — they can be assigned, passed, and returned:

```python
def square(x): return x ** 2
def cube(x): return x ** 3

ops = [square, cube]
for op in ops:
    print(op(3))   # 9, 27

def apply(func, value):
    return func(value)

apply(square, 5)   # 25
```

---

## Interview Questions

### Q1: What is the difference between `*args` and `**kwargs`?
**Answer:**
- `*args` collects extra **positional** arguments into a **tuple**
- `**kwargs` collects extra **keyword** arguments into a **dict**

```python
def demo(*args, **kwargs):
    print(type(args), args)
    print(type(kwargs), kwargs)

demo(1, 2, 3, name="Alice", age=30)
# <class 'tuple'> (1, 2, 3)
# <class 'dict'> {'name': 'Alice', 'age': 30}
```

---

### Q2: What is a default mutable argument bug?
**Answer:**
Default arguments are evaluated **once** at function definition, not each call. Mutable defaults (like `[]`) are shared across calls.

```python
# Bug
def append_to(item, lst=[]):
    lst.append(item)
    return lst

print(append_to(1))  # [1]
print(append_to(2))  # [1, 2] — same list!

# Fix
def append_to(item, lst=None):
    if lst is None:
        lst = []
    lst.append(item)
    return lst
```

---

### Q3: What is the difference between a function and a method?
**Answer:**
- A **function** is a standalone callable
- A **method** is a function defined inside a class — it receives the instance (`self`) as the first argument

```python
def standalone(x):    # function
    return x * 2

class MyClass:
    def method(self, x):  # method — self is implicit
        return x * 2

obj = MyClass()
obj.method(5)   # 10
```

---

### Q4: What is a recursive function? What is the recursion limit?
**Answer:**
A function that calls itself. Python's default recursion limit is **1000** (set by `sys.setrecursionlimit()`).

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# Tail recursion is NOT optimized in Python
# Use iteration or functools.lru_cache for deep recursion
import sys
print(sys.getrecursionlimit())  # 1000
```

---

### Q5: What is a higher-order function?
**Answer:**
A function that takes a function as argument or returns a function.

```python
# Takes function as argument
def apply_twice(func, x):
    return func(func(x))

apply_twice(lambda x: x + 3, 10)  # 16

# Returns a function
def multiplier(n):
    def multiply(x):
        return x * n
    return multiply

double = multiplier(2)
triple = multiplier(3)
double(5)   # 10
triple(5)   # 15
```

---

### Q6: What is the difference between `return` and `yield`?
**Answer:**
- `return` exits the function and returns a value
- `yield` pauses the function and returns a value, but the function's state is preserved for the next call — making it a **generator**

```python
def regular():
    return [1, 2, 3]  # returns list immediately

def generator():
    yield 1
    yield 2
    yield 3  # lazy — values produced on demand

list(generator())  # [1, 2, 3]
```

---

### Q7: What is `functools.partial`?
**Answer:**
`partial` creates a new function with some arguments pre-filled.

```python
from functools import partial

def power(base, exp):
    return base ** exp

square = partial(power, exp=2)
cube   = partial(power, exp=3)

square(5)  # 25
cube(3)    # 27
```

---

### Q8: What is the difference between positional-only and keyword-only parameters?
**Answer:**
- **Positional-only** (before `/`): must be passed positionally, cannot use keyword syntax
- **Keyword-only** (after `*`): must be passed as keyword arguments

```python
def func(pos_only, /, normal, *, kw_only):
    pass

func(1, 2, kw_only=3)       # OK
func(1, normal=2, kw_only=3) # OK
func(pos_only=1, ...)        # TypeError
func(1, 2, 3)                # TypeError — kw_only needs keyword
```
