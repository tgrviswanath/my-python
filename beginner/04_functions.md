# Python Functions — Deep Dive

## Table of Contents
1. [Function Definition & Docstrings](#function-definition--docstrings)
2. [Type Annotations](#type-annotations)
3. [*args and **kwargs](#args-and-kwargs)
4. [Positional-Only and Keyword-Only Parameters](#positional-only-and-keyword-only-parameters)
5. [Default Argument Evaluation](#default-argument-evaluation)
6. [First-Class Functions & Higher-Order Functions](#first-class-functions--higher-order-functions)
7. [Recursion](#recursion)
8. [Lambda Functions](#lambda-functions)
9. [Function Attributes](#function-attributes)
10. [LEGB Scope Rule](#legb-scope-rule)
11. [global and nonlocal](#global-and-nonlocal)
12. [Interview Q&A](#interview-qa)

---

## Function Definition & Docstrings

```python
def greet(name: str, greeting: str = "Hello") -> str:
    """
    Return a greeting string.

    Args:
        name: The person's name.
        greeting: The greeting word (default: "Hello").

    Returns:
        A formatted greeting string.

    Raises:
        ValueError: If name is empty.

    Examples:
        >>> greet("Alice")
        'Hello, Alice!'
        >>> greet("Bob", "Hi")
        'Hi, Bob!'
    """
    if not name:
        raise ValueError("name cannot be empty")
    return f"{greeting}, {name}!"
```

### Docstring Conventions

- **One-liner**: Single line for simple functions.
- **Multi-line**: Summary line, blank line, then details.
- **Formats**: Google style, NumPy style, reStructuredText (Sphinx).
- Access via `help(func)` or `func.__doc__`.

---

## Type Annotations

Type hints (PEP 484) are **not enforced at runtime** — they're metadata for static analysis tools (mypy, pyright) and IDEs.

```python
from typing import Optional, Union, List, Dict, Tuple, Callable, Any
from collections.abc import Sequence, Iterable

def process(
    data: list[int],                    # Python 3.9+ built-in generics
    callback: Callable[[int], str],
    config: dict[str, Any] | None = None  # Python 3.10+ union syntax
) -> tuple[list[str], int]:
    results = [callback(x) for x in data]
    return results, len(results)

# Python 3.12+ type aliases
type Vector = list[float]
type Matrix = list[Vector]

# Runtime access to annotations
print(process.__annotations__)
# {'data': list[int], 'callback': ..., 'return': tuple[...]}
```

---

## *args and **kwargs

### *args — Variable Positional Arguments

```python
def sum_all(*args):
    """args is a tuple of all positional arguments."""
    return sum(args)

sum_all(1, 2, 3)        # 6
sum_all(1, 2, 3, 4, 5)  # 15

# Unpacking into *args
nums = [1, 2, 3]
sum_all(*nums)           # same as sum_all(1, 2, 3)
```

### **kwargs — Variable Keyword Arguments

```python
def configure(**kwargs):
    """kwargs is a dict of all keyword arguments."""
    for key, value in kwargs.items():
        print(f"{key} = {value}")

configure(host="localhost", port=8080, debug=True)

# Unpacking into **kwargs
settings = {"host": "localhost", "port": 8080}
configure(**settings)
```

### Combined Signature

```python
def full_signature(pos1, pos2, *args, kw_only, **kwargs):
    print(f"pos1={pos1}, pos2={pos2}")
    print(f"args={args}")
    print(f"kw_only={kw_only}")
    print(f"kwargs={kwargs}")

full_signature(1, 2, 3, 4, kw_only="x", extra="y")
# pos1=1, pos2=2
# args=(3, 4)
# kw_only=x
# kwargs={'extra': 'y'}
```

---

## Positional-Only and Keyword-Only Parameters

### Positional-Only Parameters (PEP 570, Python 3.8+)

Parameters before `/` can **only** be passed positionally:

```python
def pow(base, exp, /, mod=None):
    """base and exp are positional-only."""
    result = base ** exp
    return result if mod is None else result % mod

pow(2, 10)          # OK
pow(2, 10, mod=7)   # OK — mod can be keyword
# pow(base=2, exp=10)  # TypeError — base, exp are positional-only
```

### Keyword-Only Parameters

Parameters after `*` (or `*args`) can **only** be passed as keywords:

```python
def connect(host, port, *, timeout=30, retries=3):
    """timeout and retries are keyword-only."""
    pass

connect("localhost", 8080)                    # OK
connect("localhost", 8080, timeout=60)        # OK
# connect("localhost", 8080, 60)              # TypeError

# Combined: positional-only, regular, keyword-only
def f(pos_only, /, regular, *, kw_only):
    pass
```

### Why Use These?

- **Positional-only**: Allows renaming parameters without breaking callers. Used in built-ins like `len(obj)` — you can't call `len(obj=mylist)`.
- **Keyword-only**: Forces callers to be explicit, improving readability for boolean flags: `open(file, mode, *, encoding=None)`.

---

## Default Argument Evaluation

### The Mutable Default Bug

Default argument values are evaluated **once at function definition time**, not on each call:

```python
# BUG — mutable default
def append_to(item, lst=[]):
    lst.append(item)
    return lst

print(append_to(1))  # [1]
print(append_to(2))  # [1, 2]  ← BUG: same list reused!
print(append_to(3))  # [1, 2, 3]

# FIX — use None as sentinel
def append_to(item, lst=None):
    if lst is None:
        lst = []
    lst.append(item)
    return lst
```

### Why This Happens

```python
def f(x=[]):
    pass

print(f.__defaults__)  # ([],)  — the list object is stored here
# Every call shares this same list object
```

### Intentional Use of Mutable Defaults

Sometimes the "bug" is intentional — for caching:

```python
def fibonacci(n, _cache={0: 0, 1: 1}):
    """Memoized fibonacci using mutable default as cache."""
    if n not in _cache:
        _cache[n] = fibonacci(n-1) + fibonacci(n-2)
    return _cache[n]
```

---

## First-Class Functions & Higher-Order Functions

Functions in Python are **first-class objects** — they can be assigned to variables, passed as arguments, returned from functions, and stored in data structures.

```python
# Assign to variable
def square(x): return x ** 2
f = square
print(f(5))  # 25

# Pass as argument
def apply(func, value):
    return func(value)

print(apply(square, 4))   # 16
print(apply(abs, -7))     # 7

# Return from function (closure)
def multiplier(factor):
    def multiply(x):
        return x * factor  # captures 'factor' from enclosing scope
    return multiply

double = multiplier(2)
triple = multiplier(3)
print(double(5))   # 10
print(triple(5))   # 15

# Store in data structures
operations = {
    'add': lambda x, y: x + y,
    'sub': lambda x, y: x - y,
    'mul': lambda x, y: x * y,
}
print(operations['add'](3, 4))  # 7
```

### Built-in Higher-Order Functions

```python
data = [3, 1, 4, 1, 5, 9, 2, 6]

# map — apply function to each element (lazy)
squares = list(map(lambda x: x**2, data))

# filter — keep elements where function returns True (lazy)
evens = list(filter(lambda x: x % 2 == 0, data))

# sorted with key function
sorted_by_last_digit = sorted(data, key=lambda x: x % 10)

# functools.reduce
from functools import reduce
product = reduce(lambda acc, x: acc * x, data)

# functools.partial — partial application
from functools import partial
def power(base, exp): return base ** exp
square = partial(power, exp=2)
cube   = partial(power, exp=3)
```

---

## Recursion

### Stack Frames

Each function call creates a **stack frame** on the call stack. Recursive calls stack up frames:

```python
import sys

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# Each call adds a frame to the call stack
# factorial(5) → factorial(4) → factorial(3) → factorial(2) → factorial(1)
```

### Recursion Limit

CPython has a default recursion limit of **1000** to prevent stack overflow:

```python
print(sys.getrecursionlimit())  # 1000

# Increase if needed (use with caution)
sys.setrecursionlimit(10000)

# Deep recursion raises RecursionError
def infinite(n):
    return infinite(n + 1)

try:
    infinite(0)
except RecursionError as e:
    print(f"RecursionError: {e}")
```

### Tail Recursion

Python does **not** optimize tail recursion (unlike Scheme, Haskell). A tail-recursive function still creates a new stack frame for each call. Convert to iteration for deep recursion:

```python
# Tail-recursive (NOT optimized in Python)
def factorial_tail(n, acc=1):
    if n <= 1:
        return acc
    return factorial_tail(n - 1, n * acc)

# Iterative equivalent (preferred for large n)
def factorial_iter(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result
```

### Memoization for Recursive Functions

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n-1) + fib(n-2)

print(fib(100))  # fast — results cached
print(fib.cache_info())  # CacheInfo(hits=98, misses=101, ...)
```

---

## Lambda Functions

Lambdas are **anonymous single-expression functions**:

```python
# Syntax: lambda parameters: expression
square = lambda x: x ** 2
add    = lambda x, y: x + y

# Common use: as key function
data = [('Alice', 30), ('Bob', 25), ('Charlie', 35)]
sorted_by_age = sorted(data, key=lambda person: person[1])

# With map/filter
evens = list(filter(lambda x: x % 2 == 0, range(10)))
```

### Limitations

- **Single expression only** — no statements, no assignments, no `return`.
- **No docstring** — can't document.
- **Harder to debug** — shows as `<lambda>` in tracebacks.
- **No default arguments** (well, technically you can: `lambda x=0: x`).

### When to Use vs When Not To

```python
# Good use — short, inline, throwaway
sorted(items, key=lambda x: x.name)
button.clicked.connect(lambda: self.handle_click())

# Bad use — complex logic (use def instead)
# BAD:
process = lambda x: x**2 if x > 0 else -x**2 if x < 0 else 0
# GOOD:
def process(x):
    if x > 0: return x**2
    if x < 0: return -x**2
    return 0
```

---

## Function Attributes

Every function object has these attributes:

```python
def example(x: int, y: int = 0) -> int:
    """Example function."""
    return x + y

print(example.__name__)         # 'example'
print(example.__qualname__)     # 'example' (or 'Class.method' for methods)
print(example.__doc__)          # 'Example function.'
print(example.__annotations__)  # {'x': int, 'y': int, 'return': int}
print(example.__defaults__)     # (0,)  — default values tuple
print(example.__module__)       # '__main__'
print(example.__code__)         # <code object example at ...>

# Code object attributes
code = example.__code__
print(code.co_varnames)   # ('x', 'y') — local variable names
print(code.co_argcount)   # 2
print(code.co_filename)   # source file
print(code.co_firstlineno)# line number

# Custom attributes
example.version = "1.0"
example.tags = ["math", "utility"]
print(example.version)    # "1.0"
```

### functools.wraps — Preserving Attributes in Decorators

```python
from functools import wraps

def my_decorator(func):
    @wraps(func)  # copies __name__, __doc__, etc. from func
    def wrapper(*args, **kwargs):
        print("Before")
        result = func(*args, **kwargs)
        print("After")
        return result
    return wrapper

@my_decorator
def greet(name):
    """Greet someone."""
    print(f"Hello, {name}!")

print(greet.__name__)  # 'greet' (not 'wrapper' — thanks to @wraps)
print(greet.__doc__)   # 'Greet someone.'
```

---

## LEGB Scope Rule

Python resolves names in this order: **L**ocal → **E**nclosing → **G**lobal → **B**uilt-in

```
Built-in (builtins module: len, print, range, ...)
    Global (module-level names)
        Enclosing (outer function scopes, for closures)
            Local (current function scope)
```

```python
x = "global"

def outer():
    x = "enclosing"

    def inner():
        x = "local"
        print(x)  # "local" — L wins

    inner()
    print(x)  # "enclosing" — E wins (inner's local doesn't affect outer)

outer()
print(x)  # "global" — G wins
```

### Name Resolution in Practice

```python
# Built-in shadowing (avoid!)
list = [1, 2, 3]   # shadows built-in 'list'
# list([1,2,3])    # TypeError — 'list' is now [1,2,3], not the type

# Comprehension scope (Python 3)
result = [x for x in range(5)]
# print(x)  # NameError — x is local to comprehension
```

---

## global and nonlocal

### global — Modify Module-Level Variable

```python
count = 0

def increment():
    global count    # declare intent to modify global
    count += 1

increment()
increment()
print(count)  # 2
```

### nonlocal — Modify Enclosing Scope Variable

```python
def make_counter():
    count = 0

    def increment():
        nonlocal count  # modify enclosing scope's 'count'
        count += 1
        return count

    return increment

counter = make_counter()
print(counter())  # 1
print(counter())  # 2
print(counter())  # 3
```

### When to Use

- `global`: Rarely — prefer returning values or using class attributes.
- `nonlocal`: For closures that need to maintain state (counters, accumulators). Often better replaced by a class.

```python
# Better alternative to nonlocal — use a class
class Counter:
    def __init__(self):
        self.count = 0
    def __call__(self):
        self.count += 1
        return self.count

counter = Counter()
print(counter())  # 1
print(counter())  # 2
```

---

## Interview Q&A

### Q1: What is the mutable default argument bug and how do you fix it?

**A:** Default argument values are evaluated **once when the function is defined**, not on each call. If the default is a mutable object (list, dict, set), all calls share the same object:

```python
def f(lst=[]):
    lst.append(1)
    return lst

f()  # [1]
f()  # [1, 1]  ← same list!
```

**Fix:** Use `None` as the default and create a new object inside the function:

```python
def f(lst=None):
    if lst is None:
        lst = []
    lst.append(1)
    return lst
```

---

### Q2: What is the LEGB rule?

**A:** LEGB is the name resolution order in Python: **Local → Enclosing → Global → Built-in**. When Python encounters a name, it searches these scopes in order and uses the first match. Local is the current function's scope. Enclosing is any outer function scopes (for closures). Global is the module level. Built-in is the `builtins` module (`len`, `print`, etc.).

---

### Q3: What is the difference between `*args` and `**kwargs`?

**A:** `*args` collects extra **positional** arguments into a **tuple**. `**kwargs` collects extra **keyword** arguments into a **dict**. They can be combined: `def f(*args, **kwargs)` accepts any combination of arguments. The names `args` and `kwargs` are conventions — the `*` and `**` are the actual syntax.

---

### Q4: What is a closure and how does it work?

**A:** A closure is a function that **captures variables from its enclosing scope** even after the enclosing function has returned. The captured variables are stored in the function's `__closure__` attribute as cell objects.

```python
def make_adder(n):
    def add(x):
        return x + n  # 'n' is captured from enclosing scope
    return add

add5 = make_adder(5)
print(add5(3))  # 8 — 'n=5' is still accessible
print(add5.__closure__[0].cell_contents)  # 5
```

---

### Q5: Why doesn't Python optimize tail recursion?

**A:** Guido van Rossum deliberately chose **not** to implement tail call optimization (TCO) in CPython. His reasons:
1. Stack traces become harder to read — you lose the call history.
2. Python's debugging tools rely on stack frames.
3. Recursion is not idiomatic Python for deep iteration — use loops instead.
4. TCO would complicate the interpreter for a feature that can be replaced by explicit iteration.

For deep recursion, convert to iteration or use `sys.setrecursionlimit()` carefully.

---

### Q6: What is the difference between positional-only (`/`) and keyword-only (`*`) parameters?

**A:**
- **Positional-only** (before `/`): Must be passed by position. Callers cannot use the parameter name. Useful for parameters whose names are implementation details or to match C extension signatures.
- **Keyword-only** (after `*` or `*args`): Must be passed by keyword. Callers cannot pass them positionally. Useful for optional configuration parameters to improve call-site readability.

```python
def f(pos_only, /, normal, *, kw_only):
    pass

f(1, 2, kw_only=3)      # OK
f(1, normal=2, kw_only=3)  # OK
# f(pos_only=1, ...)    # TypeError
# f(1, 2, 3)            # TypeError
```

---

### Q7: What does `functools.wraps` do and why is it important?

**A:** `@functools.wraps(func)` copies the wrapped function's `__name__`, `__doc__`, `__annotations__`, `__module__`, `__qualname__`, and `__dict__` to the wrapper function. Without it, decorators replace the original function's identity with the wrapper's, breaking introspection, documentation tools, and `help()`. It also updates `__wrapped__` to point to the original function, allowing `functools.unwrap()` to recover it.

---

### Q8: How do `global` and `nonlocal` differ?

**A:** `global` declares that a name refers to the **module-level** (global) scope, allowing assignment to it from inside a function. `nonlocal` declares that a name refers to the **nearest enclosing function scope** (not global, not local), allowing a nested function to modify a variable in its enclosing function. `nonlocal` requires the variable to already exist in an enclosing scope; `global` creates the variable at module level if it doesn't exist.

---

### Q9: What are first-class functions and what does it enable?

**A:** First-class functions means functions are **objects** — they can be assigned to variables, passed as arguments, returned from other functions, and stored in data structures. This enables:
- **Higher-order functions**: `map()`, `filter()`, `sorted(key=...)`.
- **Decorators**: Functions that wrap other functions.
- **Closures**: Functions that capture enclosing state.
- **Callbacks**: Passing behavior as data (event handlers, strategy pattern).
- **Partial application**: `functools.partial` creates specialized versions of functions.

---

### Q10: What is the difference between a lambda and a `def` function?

**A:** Both create function objects, but:
- **Lambda**: Single expression only, no statements, anonymous (shows as `<lambda>` in tracebacks), no docstring, evaluated inline.
- **def**: Full function body with statements, named, supports docstrings, can have multiple return points.

Technically, `lambda x: x**2` is equivalent to `def _(x): return x**2`. Use lambda for short, throwaway functions passed as arguments. Use `def` for anything that needs a name, documentation, or more than one expression.
