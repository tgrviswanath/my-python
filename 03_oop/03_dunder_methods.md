# Python Dunder (Magic) Methods — Comprehensive Guide

Dunder methods (double underscore) let you define how objects behave with Python's built-in operations and syntax.

---

## 1. Object Lifecycle

### `__init__` and `__new__`
```python
class MyClass:
    def __new__(cls, *args, **kwargs):
        """Creates the instance — called before __init__"""
        print(f"__new__ called for {cls.__name__}")
        instance = super().__new__(cls)
        return instance

    def __init__(self, value):
        """Initializes the instance"""
        print(f"__init__ called with {value}")
        self.value = value

    def __del__(self):
        """Called when object is garbage collected — avoid relying on this"""
        print(f"__del__ called for {self.value}")
```

---

## 2. String Representation

### `__repr__` and `__str__`
```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        """Unambiguous, for developers. Used in repr(), containers, REPL."""
        return f"Vector({self.x!r}, {self.y!r})"

    def __str__(self):
        """Human-readable. Used in print(), str(), f-strings."""
        return f"<{self.x}, {self.y}>"

    def __format__(self, format_spec):
        """Called by format() and f-strings with format spec"""
        if format_spec == "polar":
            import math
            r = math.sqrt(self.x**2 + self.y**2)
            theta = math.atan2(self.y, self.x)
            return f"({r:.2f}, {theta:.2f}rad)"
        return str(self)


v = Vector(3, 4)
repr(v)          # "Vector(3, 4)"
str(v)           # "<3, 4>"
f"{v}"           # "<3, 4>"
f"{v:polar}"     # "(5.00, 0.93rad)"
[v]              # [Vector(3, 4)]  — uses __repr__
```

---

## 3. Container Protocol

### `__len__`, `__getitem__`, `__setitem__`, `__delitem__`, `__contains__`
```python
class Stack:
    def __init__(self):
        self._data = []

    def __len__(self):
        """Called by len()"""
        return len(self._data)

    def __getitem__(self, index):
        """Called by obj[index] and obj[start:stop]"""
        return self._data[index]

    def __setitem__(self, index, value):
        """Called by obj[index] = value"""
        self._data[index] = value

    def __delitem__(self, index):
        """Called by del obj[index]"""
        del self._data[index]

    def __contains__(self, item):
        """Called by 'item in obj'"""
        return item in self._data

    def __iter__(self):
        """Called by iter() and for loops"""
        return iter(self._data)

    def __reversed__(self):
        """Called by reversed()"""
        return reversed(self._data)

    def push(self, item):
        self._data.append(item)

    def pop(self):
        return self._data.pop()

    def __repr__(self):
        return f"Stack({self._data!r})"


s = Stack()
s.push(1); s.push(2); s.push(3)
len(s)          # 3
s[0]            # 1
s[-1]           # 3
2 in s          # True
list(s)         # [1, 2, 3]
list(reversed(s))  # [3, 2, 1]
```

---

## 4. Iterator Protocol

### `__iter__` and `__next__`
```python
class CountUp:
    def __init__(self, start, stop):
        self.current = start
        self.stop = stop

    def __iter__(self):
        """Returns the iterator object (self in this case)"""
        return self

    def __next__(self):
        """Returns the next value or raises StopIteration"""
        if self.current >= self.stop:
            raise StopIteration
        value = self.current
        self.current += 1
        return value


counter = CountUp(1, 5)
for n in counter:
    print(n)   # 1, 2, 3, 4

list(CountUp(0, 3))   # [0, 1, 2]

# Iterable vs Iterator
# Iterable: has __iter__ (returns an iterator)
# Iterator: has __iter__ AND __next__
# An iterator is also an iterable (its __iter__ returns self)
```

---

## 5. Context Manager Protocol

### `__enter__` and `__exit__`
```python
class ManagedFile:
    def __init__(self, filename, mode="r"):
        self.filename = filename
        self.mode = mode
        self.file = None

    def __enter__(self):
        """Called at the start of 'with' block. Returns the context value."""
        self.file = open(self.filename, self.mode)
        return self.file

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Called at the end of 'with' block (even if exception occurred).
        Return True to suppress the exception, False/None to propagate it."""
        if self.file:
            self.file.close()
        if exc_type is ValueError:
            print(f"Suppressing ValueError: {exc_val}")
            return True   # suppress ValueError
        return False      # propagate other exceptions


with ManagedFile("test.txt", "w") as f:
    f.write("hello")
# File is automatically closed


class Timer:
    import time

    def __enter__(self):
        import time
        self.start = time.perf_counter()
        return self

    def __exit__(self, *args):
        import time
        self.elapsed = time.perf_counter() - self.start
        print(f"Elapsed: {self.elapsed:.4f}s")
        return False


with Timer() as t:
    sum(range(1_000_000))
# Elapsed: 0.0234s
```

---

## 6. Comparison Operators

### `__eq__`, `__lt__`, `__le__`, `__gt__`, `__ge__`, `__ne__`
```python
from functools import total_ordering

@total_ordering   # auto-generates missing comparison methods from __eq__ and __lt__
class Student:
    def __init__(self, name, gpa):
        self.name = name
        self.gpa = gpa

    def __eq__(self, other):
        if not isinstance(other, Student):
            return NotImplemented
        return self.gpa == other.gpa

    def __lt__(self, other):
        if not isinstance(other, Student):
            return NotImplemented
        return self.gpa < other.gpa

    def __hash__(self):
        """If you define __eq__, you must define __hash__ to use in sets/dicts"""
        return hash((self.name, self.gpa))

    def __repr__(self):
        return f"Student({self.name!r}, {self.gpa})"


alice = Student("Alice", 3.8)
bob = Student("Bob", 3.5)

alice > bob    # True  — generated by @total_ordering
alice <= bob   # False
sorted([alice, bob])   # [Student('Bob', 3.5), Student('Alice', 3.8)]

# NotImplemented — tells Python to try the reflected operation
# If __eq__ returns NotImplemented, Python tries other.__eq__(self)
```

---

## 7. Arithmetic Operators

### `__add__`, `__sub__`, `__mul__`, `__truediv__`, `__floordiv__`, `__mod__`, `__pow__`
```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        """v1 + v2"""
        if isinstance(other, Vector):
            return Vector(self.x + other.x, self.y + other.y)
        return NotImplemented

    def __radd__(self, other):
        """other + v (reflected — called when left operand doesn't support +)"""
        return self.__add__(other)

    def __sub__(self, other):
        """v1 - v2"""
        return Vector(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar):
        """v * scalar"""
        if isinstance(scalar, (int, float)):
            return Vector(self.x * scalar, self.y * scalar)
        return NotImplemented

    def __rmul__(self, scalar):
        """scalar * v (reflected)"""
        return self.__mul__(scalar)

    def __neg__(self):
        """-v (unary negation)"""
        return Vector(-self.x, -self.y)

    def __abs__(self):
        """abs(v)"""
        return (self.x**2 + self.y**2) ** 0.5

    def __iadd__(self, other):
        """v += other (in-place add)"""
        self.x += other.x
        self.y += other.y
        return self

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"


v1 = Vector(1, 2)
v2 = Vector(3, 4)
v1 + v2     # Vector(4, 6)
v1 * 3      # Vector(3, 6)
3 * v1      # Vector(3, 6)  — uses __rmul__
abs(v2)     # 5.0
-v1         # Vector(-1, -2)
```

---

## 8. `__call__`

```python
class Multiplier:
    def __init__(self, factor):
        self.factor = factor

    def __call__(self, x):
        """Makes the instance callable like a function"""
        return x * self.factor


double = Multiplier(2)
triple = Multiplier(3)

double(5)    # 10
triple(5)    # 15
callable(double)  # True

# Use case: stateful callable (like a closure)
class Counter:
    def __init__(self):
        self.count = 0

    def __call__(self):
        self.count += 1
        return self.count


counter = Counter()
counter()   # 1
counter()   # 2
counter()   # 3
```

---

## 9. `__hash__`

```python
# If you define __eq__, Python sets __hash__ = None (unhashable)
# You must explicitly define __hash__ to use in sets/dicts

class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return isinstance(other, Point) and self.x == other.x and self.y == other.y

    def __hash__(self):
        # Use a tuple of the fields that define equality
        return hash((self.x, self.y))


p1 = Point(1, 2)
p2 = Point(1, 2)
p1 == p2          # True
hash(p1) == hash(p2)  # True
{p1, p2}          # {Point(1, 2)}  — treated as same element
d = {p1: "origin"}
d[p2]             # "origin"  — p2 finds p1's entry
```

---

## 10. Attribute Access

### `__getattr__`, `__setattr__`, `__getattribute__`
```python
class DynamicProxy:
    def __init__(self, target):
        # Use object.__setattr__ to avoid infinite recursion
        object.__setattr__(self, '_target', target)

    def __getattr__(self, name):
        """Called ONLY when normal attribute lookup fails"""
        return getattr(self._target, name)

    def __setattr__(self, name, value):
        """Called on EVERY attribute assignment"""
        if name.startswith('_'):
            object.__setattr__(self, name, value)
        else:
            setattr(self._target, name, value)

    def __getattribute__(self, name):
        """Called on EVERY attribute access (use carefully!)"""
        # Intercept all attribute access
        return object.__getattribute__(self, name)
```

---

## Interview Questions & Answers

**Q1: What is the difference between `__repr__` and `__str__`?**

Answer:
- `__repr__`: unambiguous, for developers. Used by `repr()`, REPL, and when objects appear in containers. Should ideally be eval()-able.
- `__str__`: human-readable, for end users. Used by `print()`, `str()`, f-strings.

If only `__repr__` is defined, it serves as fallback for `__str__`. Always define `__repr__` at minimum.

---

**Q2: What is the iterator protocol?**

Answer: An object is an **iterator** if it implements:
- `__iter__()`: returns `self`
- `__next__()`: returns the next value or raises `StopIteration`

An **iterable** only needs `__iter__()` (which returns an iterator). Lists, tuples, dicts are iterables but not iterators — calling `iter()` on them creates a new iterator each time.

---

**Q3: What does `__enter__` and `__exit__` do?**

Answer: They implement the **context manager protocol** for `with` statements.
- `__enter__`: called at the start of the `with` block; its return value is bound to the `as` variable.
- `__exit__(exc_type, exc_val, exc_tb)`: called at the end, even if an exception occurred. Return `True` to suppress the exception.

---

**Q4: Why must you define `__hash__` when you define `__eq__`?**

Answer: Python's rule: objects that compare equal must have the same hash. If you define `__eq__` without `__hash__`, Python sets `__hash__ = None`, making the object unhashable (can't be used in sets or as dict keys). You must explicitly define `__hash__` using the same fields used in `__eq__`.

---

**Q5: What is `NotImplemented` and when should you return it?**

Answer: `NotImplemented` (not `NotImplementedError`) is a special singleton returned from comparison/arithmetic dunder methods to signal "I don't know how to handle this type." Python then tries the reflected operation on the other operand.

```python
def __add__(self, other):
    if not isinstance(other, Vector):
        return NotImplemented  # let Python try other.__radd__(self)
    return Vector(self.x + other.x, self.y + other.y)
```

---

**Q6: What is `__call__` and when would you use it?**

Answer: `__call__` makes an instance callable like a function. Use it when:
- You need a stateful callable (like a closure but with more features).
- You're implementing function-like objects (decorators, callbacks).
- You want to make an object behave like a function while maintaining state.

---

**Q7: What is the difference between `__getattr__` and `__getattribute__`?**

Answer:
- `__getattr__`: called only when normal attribute lookup **fails** (attribute not found). Safe to override.
- `__getattribute__`: called on **every** attribute access. Very easy to cause infinite recursion — must use `object.__getattribute__(self, name)` to access actual attributes.

---

**Q8: What does `@total_ordering` do?**

Answer: `@total_ordering` from `functools` automatically generates the missing comparison methods (`__le__`, `__gt__`, `__ge__`, `__ne__`) from `__eq__` and one of `__lt__`, `__le__`, `__gt__`, or `__ge__`. This avoids writing all 6 comparison methods manually.

---

**Q9: What is `__slots__` and how does it interact with dunder methods?**

Answer: `__slots__` replaces `__dict__` with fixed slots, saving memory. It doesn't affect dunder methods — they still work normally. However, if you use `__slots__` and define `__eq__`, you must also define `__hash__` (same as without slots).

---

**Q10: How do you implement a class that supports `len()`, indexing, and `for` loops?**

Answer: Implement the container protocol:
- `__len__`: for `len()`
- `__getitem__`: for indexing and slicing; also enables `for` loops (Python calls `__getitem__` with 0, 1, 2... until `IndexError`)
- `__iter__`: explicit iterator (preferred over relying on `__getitem__` for iteration)
- `__contains__`: for `in` operator (optional — falls back to iterating if not defined)
