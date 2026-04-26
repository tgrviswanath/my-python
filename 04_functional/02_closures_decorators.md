# Python Closures and Decorators — Comprehensive Guide

## 1. Closures

A closure is a function that **remembers the variables from its enclosing scope** even after that scope has finished executing.

```python
def make_counter(start=0):
    count = start   # free variable — captured by the closure

    def counter():
        nonlocal count   # needed to modify (not just read) the free variable
        count += 1
        return count

    return counter   # return the inner function (closure)


c1 = make_counter()
c2 = make_counter(10)

c1()   # 1
c1()   # 2
c1()   # 3
c2()   # 11  — independent state
c2()   # 12
```

---

## 2. Free Variables and `__closure__`

```python
def make_multiplier(n):
    def multiply(x):
        return x * n   # n is a free variable
    return multiply


double = make_multiplier(2)
triple = make_multiplier(3)

double(5)   # 10
triple(5)   # 15

# Inspect the closure
double.__closure__                    # (<cell at 0x...>,)
double.__closure__[0].cell_contents  # 2  — the captured value of n

# __code__.co_freevars — names of free variables
double.__code__.co_freevars   # ('n',)
```

---

## 3. `nonlocal` vs `global`

```python
x = 0   # global

def outer():
    y = 0   # enclosing scope

    def inner():
        nonlocal y   # modify enclosing scope variable
        global x     # modify global variable
        y += 1
        x += 1
        return y, x

    return inner


f = outer()
f()   # (1, 1)
f()   # (2, 2)

# Without nonlocal — reading is fine, assignment creates a new local
def outer():
    count = 0
    def inner():
        # count += 1  # UnboundLocalError — Python sees assignment, treats as local
        return count  # reading is fine
    return inner
```

---

## 4. Decorator Basics

A decorator is a function that takes a function and returns a modified version of it.

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print(f"Before {func.__name__}")
        result = func(*args, **kwargs)
        print(f"After {func.__name__}")
        return result
    return wrapper


# Using @ syntax (syntactic sugar)
@my_decorator
def greet(name):
    print(f"Hello, {name}!")
    return f"Greeted {name}"


# Equivalent to:
# greet = my_decorator(greet)

greet("Alice")
# Before greet
# Hello, Alice!
# After greet
```

---

## 5. `functools.wraps`

Without `@wraps`, the wrapper function loses the original function's metadata.

```python
import functools

def my_decorator(func):
    @functools.wraps(func)   # preserves __name__, __doc__, __module__, etc.
    def wrapper(*args, **kwargs):
        """Wrapper docstring"""
        return func(*args, **kwargs)
    return wrapper


@my_decorator
def add(x, y):
    """Add two numbers"""
    return x + y


# Without @wraps:
# add.__name__  # "wrapper"
# add.__doc__   # "Wrapper docstring"

# With @wraps:
add.__name__   # "add"
add.__doc__    # "Add two numbers"
add.__wrapped__  # the original function
```

---

## 6. Practical Decorators

### Timing
```python
import functools
import time

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper


@timer
def slow_function():
    time.sleep(0.1)
    return "done"
```

### Retry
```python
def retry(max_attempts=3, exceptions=(Exception,)):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        raise
                    print(f"Attempt {attempt} failed: {e}. Retrying...")
        return wrapper
    return decorator


@retry(max_attempts=3, exceptions=(ConnectionError,))
def fetch_data(url):
    pass
```

### Logging
```python
def log_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        args_repr = [repr(a) for a in args]
        kwargs_repr = [f"{k}={v!r}" for k, v in kwargs.items()]
        signature = ", ".join(args_repr + kwargs_repr)
        print(f"Calling {func.__name__}({signature})")
        result = func(*args, **kwargs)
        print(f"{func.__name__} returned {result!r}")
        return result
    return wrapper
```

---

## 7. Stacked Decorators

```python
@decorator_a
@decorator_b
@decorator_c
def my_func():
    pass

# Equivalent to:
my_func = decorator_a(decorator_b(decorator_c(my_func)))
# Applied bottom-up, executed top-down

@timer
@log_calls
def add(x, y):
    return x + y

# add = timer(log_calls(add))
# Calling add: timer wraps log_calls wraps original add
# Execution: timer → log_calls → original add → log_calls → timer
```

---

## 8. Decorators with Arguments

```python
# Three levels of nesting needed
def repeat(n):
    """Decorator factory — returns a decorator"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(n):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator


@repeat(3)
def greet(name):
    print(f"Hello, {name}!")

greet("Alice")
# Hello, Alice!
# Hello, Alice!
# Hello, Alice!

# Equivalent to:
# greet = repeat(3)(greet)


# Decorator that works with or without arguments
def optional_args_decorator(func=None, *, option=False):
    if func is None:
        # Called with arguments: @decorator(option=True)
        return functools.partial(optional_args_decorator, option=option)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if option:
            print("Option enabled")
        return func(*args, **kwargs)
    return wrapper


@optional_args_decorator
def f1(): pass

@optional_args_decorator(option=True)
def f2(): pass
```

---

## 9. Class-Based Decorators

```python
import functools

class CountCalls:
    """Class-based decorator that counts function calls"""
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.call_count = 0

    def __call__(self, *args, **kwargs):
        self.call_count += 1
        print(f"{self.func.__name__} called {self.call_count} times")
        return self.func(*args, **kwargs)


@CountCalls
def say_hello():
    print("Hello!")


say_hello()   # say_hello called 1 times
say_hello()   # say_hello called 2 times
say_hello.call_count   # 2


# Class-based decorator with arguments
class Retry:
    def __init__(self, max_attempts=3):
        self.max_attempts = max_attempts

    def __call__(self, func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(self.max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == self.max_attempts - 1:
                        raise
        return wrapper


@Retry(max_attempts=5)
def unreliable_function():
    pass
```

---

## 10. Common Decorator Patterns

```python
# Memoization (manual)
def memoize(func):
    cache = {}
    @functools.wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    return wrapper

# Singleton
def singleton(cls):
    instances = {}
    @functools.wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@singleton
class Config:
    def __init__(self):
        self.debug = False

# Type checking
def type_check(**type_map):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import inspect
            sig = inspect.signature(func)
            bound = sig.bind(*args, **kwargs)
            for param, value in bound.arguments.items():
                if param in type_map and not isinstance(value, type_map[param]):
                    raise TypeError(f"{param} must be {type_map[param].__name__}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

@type_check(x=int, y=int)
def add(x, y):
    return x + y
```

---

## Interview Questions & Answers

**Q1: What is a closure?**

Answer: A closure is an inner function that captures and remembers variables from its enclosing scope, even after the enclosing function has returned. The captured variables are called **free variables** and are stored in the function's `__closure__` attribute.

```python
def make_adder(n):
    def add(x):
        return x + n   # n is a free variable
    return add

add5 = make_adder(5)
add5(3)   # 8  — n=5 is remembered
```

---

**Q2: What is the difference between `nonlocal` and `global`?**

Answer:
- `global x`: declares that `x` refers to the module-level global variable.
- `nonlocal x`: declares that `x` refers to the nearest enclosing scope (not global).

Both are needed when you want to **assign** to a variable in an outer scope (reading doesn't require them).

---

**Q3: What is a decorator and how does it work?**

Answer: A decorator is a callable that takes a function and returns a modified version. The `@decorator` syntax is syntactic sugar for `func = decorator(func)`. Decorators are used to add cross-cutting concerns (logging, timing, caching, authentication) without modifying the original function.

---

**Q4: Why should you use `@functools.wraps`?**

Answer: Without `@wraps`, the wrapper function replaces the original function's metadata (`__name__`, `__doc__`, `__module__`, `__qualname__`, `__annotations__`, `__dict__`). This breaks introspection, documentation tools, and debugging. `@wraps` copies all this metadata from the original function to the wrapper.

---

**Q5: How do you write a decorator that accepts arguments?**

Answer: You need three levels of nesting: the outermost function accepts the decorator arguments and returns a decorator, which accepts the function and returns a wrapper.

```python
def repeat(n):          # level 1: accepts decorator args
    def decorator(func):  # level 2: accepts the function
        @wraps(func)
        def wrapper(*args, **kwargs):  # level 3: wraps the call
            for _ in range(n):
                func(*args, **kwargs)
        return wrapper
    return decorator

@repeat(3)
def hello(): print("hi")
```

---

**Q6: What is the execution order of stacked decorators?**

Answer: Decorators are applied **bottom-up** (innermost first), but execute **top-down** (outermost first).

```python
@A
@B
def f(): pass
# f = A(B(f))
# Calling f(): A's wrapper runs first, then B's, then original f
```

---

**Q7: What is the difference between a function-based and class-based decorator?**

Answer:
- **Function-based**: simpler, uses closures for state.
- **Class-based**: uses `__init__` for setup and `__call__` for the wrapping logic. Better when you need to maintain state (call count, cache) or when the decorator itself needs methods.

---

**Q8: How does a closure differ from a class with state?**

Answer: Both can maintain state, but:
- Closures are simpler and more lightweight.
- Classes are more explicit, support multiple methods, and are easier to inspect/test.
- Closures use `nonlocal` to modify state; classes use `self`.

```python
# Closure
def make_counter():
    count = 0
    def counter():
        nonlocal count
        count += 1
        return count
    return counter

# Class equivalent
class Counter:
    def __init__(self):
        self.count = 0
    def __call__(self):
        self.count += 1
        return self.count
```

---

**Q9: What is a decorator factory?**

Answer: A decorator factory is a function that returns a decorator. It's used when you want to parameterize a decorator. The factory accepts arguments and returns a decorator that uses those arguments.

---

**Q10: Can decorators be applied to classes?**

Answer: Yes. Class decorators receive the class as their argument and return a modified class (or a different callable).

```python
def add_repr(cls):
    def __repr__(self):
        attrs = ', '.join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"{cls.__name__}({attrs})"
    cls.__repr__ = __repr__
    return cls

@add_repr
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

Point(1, 2)   # Point(x=1, y=2)
```
