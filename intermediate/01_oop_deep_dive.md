# OOP Deep Dive — Python Intermediate

## Table of Contents
1. [Class Anatomy](#1-class-anatomy)
2. [Instance / Class / Static Methods](#2-instance--class--static-methods)
3. [MRO & C3 Linearization](#3-mro--c3-linearization)
4. [Dunder Methods](#4-dunder-methods)
5. [@property — getter / setter / deleter](#5-property--getter--setter--deleter)
6. [Class Decorators](#6-class-decorators)
7. [Metaclasses](#7-metaclasses)
8. [__slots__](#8-__slots__)
9. [Mixin Pattern](#9-mixin-pattern)
10. [Abstract Base Classes (ABC)](#10-abstract-base-classes-abc)
11. [Dataclasses](#11-dataclasses)
12. [Performance Notes](#12-performance-notes)
13. [Common Bugs](#13-common-bugs)
14. [Interview Q&A](#14-interview-qa)

---

## 1. Class Anatomy

### `__dict__` — the namespace dictionary

Every class and every instance carries a `__dict__` that stores its own attributes.

```python
class Dog:
    species = "Canis lupus familiaris"   # class attribute

    def __init__(self, name):
        self.name = name                  # instance attribute

d = Dog("Rex")

print(Dog.__dict__)   # mappingproxy({'species': ..., '__init__': ..., ...})
print(d.__dict__)     # {'name': 'Rex'}
```

Attribute lookup order (simplified):
1. Instance `__dict__`
2. Class `__dict__`
3. Base-class `__dict__` (following MRO)

### Class vs Instance Namespace

```python
class Counter:
    count = 0           # shared across all instances

    def __init__(self):
        Counter.count += 1
        self.id = Counter.count

a = Counter()
b = Counter()
print(Counter.count)   # 2
print(a.id, b.id)      # 1 2
```

Mutating a mutable class attribute through an instance modifies the shared object:

```python
class Bag:
    items = []          # DANGER: shared list

b1 = Bag(); b2 = Bag()
b1.items.append("apple")
print(b2.items)         # ['apple']  ← shared mutation!
```

Fix: initialise mutable defaults in `__init__`.

### `__slots__`

Declaring `__slots__` replaces the per-instance `__dict__` with a fixed set of slot descriptors, saving memory and speeding up attribute access.

```python
class Point:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y

p = Point(1, 2)
# p.__dict__  → AttributeError
# p.z = 3    → AttributeError
```

---

## 2. Instance / Class / Static Methods

| Decorator | First arg | Receives | Typical use |
|-----------|-----------|----------|-------------|
| *(none)*  | `self`    | instance + class | normal behaviour |
| `@classmethod` | `cls` | class only | alternative constructors, factory methods |
| `@staticmethod` | *(none)* | nothing | utility functions logically grouped with class |

```python
import json
from datetime import date

class Person:
    def __init__(self, name, birth_year):
        self.name = name
        self.birth_year = birth_year

    # instance method
    def age(self):
        return date.today().year - self.birth_year

    # classmethod — alternative constructor
    @classmethod
    def from_dict(cls, data: dict):
        return cls(data["name"], data["birth_year"])

    # staticmethod — pure utility
    @staticmethod
    def is_adult(age: int) -> bool:
        return age >= 18

p = Person.from_dict({"name": "Alice", "birth_year": 1990})
print(p.age())
print(Person.is_adult(20))
```

**When to use `@classmethod` vs `@staticmethod`:**
- Use `@classmethod` when the method needs to create or inspect the class itself (e.g., factory methods, `__init_subclass__`).
- Use `@staticmethod` when the logic belongs conceptually to the class but doesn't need `self` or `cls`.

---

## 3. MRO & C3 Linearization

Python uses the **C3 linearization** algorithm (introduced in Python 2.3) to determine the Method Resolution Order (MRO) for multiple inheritance.

### The Algorithm

Given class `C(B1, B2, ...)`, the MRO is:

```
L[C] = C + merge(L[B1], L[B2], ..., [B1, B2, ...])
```

`merge` takes the first element of each list that does not appear in the *tail* of any other list, appends it to the result, and removes it from all lists. Repeat until all lists are empty.

### Diamond Problem

```
    A
   / \
  B   C
   \ /
    D
```

```python
class A:
    def greet(self): print("A")

class B(A):
    def greet(self): print("B"); super().greet()

class C(A):
    def greet(self): print("C"); super().greet()

class D(B, C):
    def greet(self): print("D"); super().greet()

D().greet()
# D → B → C → A   (each printed once)
print(D.__mro__)
# (<class 'D'>, <class 'B'>, <class 'C'>, <class 'A'>, <class 'object'>)
```

`super()` does **not** mean "call my parent"; it means "call the next class in the MRO". This is what makes cooperative multiple inheritance work.

### Inspecting MRO

```python
print(D.mro())          # list form
print(D.__mro__)        # tuple form
```

### Inconsistent MRO

Python raises `TypeError` if a consistent linearization is impossible:

```python
class X(A, B): pass   # may raise TypeError depending on A/B hierarchy
```

---

## 4. Dunder Methods

### Object Lifecycle

| Method | Called when |
|--------|-------------|
| `__new__(cls, ...)` | Object is *created* (before `__init__`) |
| `__init__(self, ...)` | Object is *initialised* |
| `__del__(self)` | Object is about to be garbage-collected |

```python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, value):
        self.value = value

a = Singleton(1)
b = Singleton(2)
print(a is b)       # True
print(a.value)      # 2  (re-initialised)
```

### String Representation

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __repr__(self):
        return f"Vector({self.x!r}, {self.y!r})"   # unambiguous, for devs

    def __str__(self):
        return f"({self.x}, {self.y})"              # readable, for users
```

Rule of thumb: `__repr__` should ideally be valid Python that recreates the object; `__str__` is for human display. If only `__repr__` is defined, `str()` falls back to it.

### Container Protocol

```python
class NumberList:
    def __init__(self, *nums):
        self._data = list(nums)

    def __len__(self):          return len(self._data)
    def __getitem__(self, idx): return self._data[idx]
    def __setitem__(self, idx, val): self._data[idx] = val
    def __contains__(self, item):   return item in self._data
    def __iter__(self):         return iter(self._data)
```

Implementing `__getitem__` alone gives you iteration and `in` for free (Python falls back to sequential scan), but explicit `__iter__` and `__contains__` are faster.

### Iterator Protocol

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self          # the object is its own iterator

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        val = self.current
        self.current -= 1
        return val

list(Countdown(5))   # [5, 4, 3, 2, 1]
```

### Context Manager Protocol

```python
class ManagedFile:
    def __init__(self, path, mode="r"):
        self.path = path
        self.mode = mode

    def __enter__(self):
        self.file = open(self.path, self.mode)
        return self.file

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()
        return False   # don't suppress exceptions

with ManagedFile("data.txt") as f:
    content = f.read()
```

`__exit__` receives exception info if an exception occurred inside the `with` block. Return `True` to suppress it.

### Comparison & Hashing

```python
from functools import total_ordering

@total_ordering
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def __eq__(self, other):
        if not isinstance(other, Temperature):
            return NotImplemented
        return self.celsius == other.celsius

    def __lt__(self, other):
        if not isinstance(other, Temperature):
            return NotImplemented
        return self.celsius < other.celsius

    def __hash__(self):
        return hash(self.celsius)   # required when __eq__ is defined
```

`@total_ordering` fills in `__le__`, `__gt__`, `__ge__` from `__eq__` + `__lt__`.

**Why `__hash__` when you define `__eq__`?**  
Python sets `__hash__ = None` automatically when you define `__eq__`, making instances unhashable. You must explicitly define `__hash__` if you want them in sets/dicts.

### Callable Objects

```python
class Multiplier:
    def __init__(self, factor):
        self.factor = factor

    def __call__(self, x):
        return x * self.factor

double = Multiplier(2)
print(double(5))    # 10
print(callable(double))  # True
```

### Arithmetic Operators

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __rmul__(self, scalar):   # scalar * vector
        return self.__mul__(scalar)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

v = Vector(1, 2) + Vector(3, 4)   # Vector(4, 6)
v2 = 3 * Vector(1, 2)             # Vector(3, 6)
```

---

## 5. @property — getter / setter / deleter

`@property` turns a method into a managed attribute, enabling validation and computed values without changing the public API.

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius   # private by convention

    @property
    def radius(self):
        """Radius of the circle (read)."""
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("Radius cannot be negative")
        self._radius = value

    @radius.deleter
    def radius(self):
        del self._radius

    @property
    def area(self):
        import math
        return math.pi * self._radius ** 2

c = Circle(5)
print(c.area)       # 78.53...
c.radius = 10
del c.radius        # triggers deleter
```

Properties are implemented as **descriptors** under the hood — they live in the class `__dict__` and implement `__get__`, `__set__`, `__delete__`.

---

## 6. Class Decorators

A class decorator is a callable that receives a class and returns a (possibly modified) class.

```python
def add_repr(cls):
    """Automatically generate __repr__ from __init__ signature."""
    import inspect
    params = list(inspect.signature(cls.__init__).parameters.keys())[1:]

    def __repr__(self):
        args = ", ".join(f"{p}={getattr(self, p)!r}" for p in params)
        return f"{cls.__name__}({args})"

    cls.__repr__ = __repr__
    return cls

@add_repr
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

print(Point(1, 2))   # Point(x=1, y=2)
```

Class decorators are simpler than metaclasses for post-creation modifications. Use them when you don't need to intercept class *creation* itself.

---

## 7. Metaclasses

### `type` is the default metaclass

```python
# These two are equivalent:
class Foo:
    pass

Foo = type("Foo", (), {})
```

`type(name, bases, namespace)` creates a new class object.

### Custom Metaclass

```python
class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Database(metaclass=SingletonMeta):
    def __init__(self, url):
        self.url = url

db1 = Database("postgres://localhost/mydb")
db2 = Database("postgres://localhost/other")
print(db1 is db2)   # True
print(db1.url)      # postgres://localhost/mydb
```

### `__init_subclass__` — lighter alternative

```python
class PluginBase:
    _registry = {}

    def __init_subclass__(cls, plugin_name=None, **kwargs):
        super().__init_subclass__(**kwargs)
        if plugin_name:
            PluginBase._registry[plugin_name] = cls

class CSVPlugin(PluginBase, plugin_name="csv"):
    pass

class JSONPlugin(PluginBase, plugin_name="json"):
    pass

print(PluginBase._registry)
# {'csv': <class 'CSVPlugin'>, 'json': <class 'JSONPlugin'>}
```

### When to use metaclasses
- Enforcing class-level constraints (e.g., all methods must be documented)
- Auto-registering subclasses
- ORM field collection (Django models)
- API validation frameworks

---

## 8. `__slots__`

### Memory savings

```python
import sys

class WithDict:
    def __init__(self, x, y):
        self.x = x
        self.y = y

class WithSlots:
    __slots__ = ("x", "y")
    def __init__(self, x, y):
        self.x = x
        self.y = y

a = WithDict(1, 2)
b = WithSlots(1, 2)

print(sys.getsizeof(a.__dict__))   # ~232 bytes (dict overhead)
print(sys.getsizeof(b))            # ~56 bytes
```

### Limitations
- Cannot add arbitrary attributes at runtime
- Inheritance: if a parent doesn't use `__slots__`, the child still has `__dict__`
- Pickling requires `__getstate__`/`__setstate__` in some cases
- Multiple inheritance with `__slots__` in multiple bases can be tricky

### When to use
- Large numbers of small objects (e.g., millions of data points)
- Performance-critical inner loops
- When you want to prevent accidental attribute creation

---

## 9. Mixin Pattern

Mixins are classes designed to be mixed into other classes via multiple inheritance. They provide reusable behaviour without being standalone.

```python
class JSONMixin:
    """Adds JSON serialisation to any class with a __dict__."""
    import json as _json

    def to_json(self):
        return self._json.dumps(self.__dict__, default=str)

    @classmethod
    def from_json(cls, json_str):
        data = cls._json.loads(json_str)
        obj = cls.__new__(cls)
        obj.__dict__.update(data)
        return obj

class LogMixin:
    """Adds simple logging to any class."""
    def log(self, msg):
        print(f"[{self.__class__.__name__}] {msg}")

class User(JSONMixin, LogMixin):
    def __init__(self, name, email):
        self.name = name
        self.email = email

u = User("Alice", "alice@example.com")
u.log("Created")
print(u.to_json())
```

**Conventions:**
- Name mixins with `Mixin` suffix
- Mixins should not call `super().__init__()` unless they're cooperative
- Keep mixins focused on a single concern

---

## 10. Abstract Base Classes (ABC)

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        """Return the area of the shape."""
        ...

    @abstractmethod
    def perimeter(self) -> float:
        ...

    def describe(self):
        return f"{self.__class__.__name__}: area={self.area():.2f}"

class Rectangle(Shape):
    def __init__(self, w, h):
        self.w = w
        self.h = h

    def area(self):
        return self.w * self.h

    def perimeter(self):
        return 2 * (self.w + self.h)

# Shape()       → TypeError: Can't instantiate abstract class
r = Rectangle(3, 4)
print(r.describe())   # Rectangle: area=12.00
```

### Virtual subclasses

```python
from abc import ABC

class Drawable(ABC):
    @abstractmethod
    def draw(self): ...

class LegacyWidget:
    def draw(self):
        print("drawing legacy widget")

Drawable.register(LegacyWidget)
print(isinstance(LegacyWidget(), Drawable))   # True
```

### `__subclasshook__`

```python
class Sized(ABC):
    @classmethod
    def __subclasshook__(cls, C):
        if cls is Sized:
            return hasattr(C, "__len__")
        return NotImplemented

print(isinstance([], Sized))    # True (list has __len__)
print(isinstance({}, Sized))    # True
```

---

## 11. Dataclasses

```python
from dataclasses import dataclass, field, KW_ONLY
from typing import ClassVar

@dataclass(order=True, frozen=False)
class Employee:
    # sort_index is used for ordering (order=True generates __lt__ etc.)
    sort_index: float = field(init=False, repr=False)

    name: str
    department: str
    salary: float
    skills: list[str] = field(default_factory=list)

    _headcount: ClassVar[int] = 0   # class variable, not a field

    def __post_init__(self):
        self.sort_index = self.salary
        Employee._headcount += 1

    def give_raise(self, amount: float):
        self.salary += amount
        self.sort_index = self.salary

e1 = Employee("Alice", "Engineering", 90_000)
e2 = Employee("Bob", "Marketing", 75_000)
print(sorted([e1, e2]))   # Bob first (lower salary)
print(Employee._headcount)  # 2
```

### `frozen=True` — immutable dataclass

```python
@dataclass(frozen=True)
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
# p.x = 3.0  → FrozenInstanceError
hash(p)       # works because frozen implies __hash__
```

### `__post_init__` for validation

```python
@dataclass
class PositiveInt:
    value: int

    def __post_init__(self):
        if self.value <= 0:
            raise ValueError(f"value must be positive, got {self.value}")
```

---

## 12. Performance Notes

| Technique | Impact |
|-----------|--------|
| `__slots__` | 40–60% memory reduction for small objects; ~10% faster attribute access |
| `@property` | Slight overhead vs direct attribute access; negligible unless in tight loops |
| `@lru_cache` on methods | Cache is per-instance if used with `self`; use `functools.cached_property` instead |
| `__eq__` without `__hash__` | Makes objects unhashable — can't use in sets/dict keys |
| Deep inheritance chains | Each attribute lookup traverses MRO; keep hierarchies shallow |
| `dataclass(slots=True)` | Python 3.10+: generates `__slots__` automatically |

```python
# functools.cached_property — computed once, stored as instance attribute
from functools import cached_property
import math

class Circle:
    def __init__(self, r):
        self.r = r

    @cached_property
    def area(self):
        return math.pi * self.r ** 2

c = Circle(5)
c.area   # computed
c.area   # returned from instance __dict__, no recomputation
```

---

## 13. Common Bugs

### 1. Mutable default argument in `__init__`

```python
# BAD
class Bag:
    def __init__(self, items=[]):   # shared across all instances!
        self.items = items

# GOOD
class Bag:
    def __init__(self, items=None):
        self.items = items if items is not None else []
```

### 2. Forgetting `super().__init__()` in cooperative inheritance

```python
class A:
    def __init__(self):
        self.a = "A"

class B(A):
    def __init__(self):
        super().__init__()   # must call super
        self.b = "B"
```

### 3. `__eq__` without `__hash__`

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y
    def __eq__(self, other):
        return (self.x, self.y) == (other.x, other.y)
    # Missing __hash__ → Point instances can't be used in sets/dicts

# Fix:
    def __hash__(self):
        return hash((self.x, self.y))
```

### 4. Modifying class attribute through instance

```python
class Config:
    debug = False

c = Config()
c.debug = True          # creates INSTANCE attribute, doesn't change class
print(Config.debug)     # False — class attribute unchanged
Config.debug = True     # this changes the class attribute
```

### 5. `__del__` is unreliable

`__del__` is called when the reference count drops to zero, but this is not guaranteed (circular references, interpreter shutdown). Use context managers for resource cleanup instead.

### 6. `isinstance` vs `type`

```python
class Animal: pass
class Dog(Animal): pass

d = Dog()
type(d) is Animal       # False — exact type check
isinstance(d, Animal)   # True  — checks inheritance chain
```

---

## 14. Interview Q&A

**Q1. Explain Python's MRO and how C3 linearization works.**

A: Python uses C3 linearization to compute a consistent method resolution order for multiple inheritance. For `class D(B, C)`, the MRO is computed as `D + merge(MRO(B), MRO(C), [B, C])`. The merge algorithm repeatedly takes the first element of the first list that doesn't appear in the tail of any other list. This guarantees monotonicity (a class always appears before its parents) and local precedence (left-to-right order of bases is respected). You can inspect it with `ClassName.__mro__` or `ClassName.mro()`.

---

**Q2. What is the difference between `__new__` and `__init__`?**

A: `__new__` is a static method that *creates* and returns a new instance of the class — it's called before `__init__`. `__init__` *initialises* an already-created instance. You override `__new__` when you need to control object creation itself, such as implementing singletons, immutable types (subclassing `int`, `str`, `tuple`), or custom memory allocation. `__init__` is for setting up the object's state after creation.

---

**Q3. Why must you define `__hash__` when you define `__eq__`?**

A: Python's data model requires that objects that compare equal must have the same hash (the hash contract). When you define `__eq__`, Python automatically sets `__hash__ = None`, making instances unhashable, because it can't guarantee the contract is maintained. If your `__eq__` is based on value semantics and you want instances to be usable in sets or as dict keys, you must explicitly define `__hash__` using the same fields used in `__eq__`.

---

**Q4. What are the benefits and limitations of `__slots__`?**

A: Benefits: reduces per-instance memory (no `__dict__` overhead, ~40–60% savings for small objects), slightly faster attribute access, prevents accidental attribute creation. Limitations: can't add arbitrary attributes at runtime, doesn't work well with multiple inheritance if multiple bases define `__slots__`, complicates pickling, and doesn't save memory if a parent class doesn't also use `__slots__` (the parent's `__dict__` is still created).

---

**Q5. What are metaclasses and when would you use them?**

A: A metaclass is the class of a class — it controls how classes are created. `type` is the default metaclass. You create a custom metaclass by subclassing `type` and overriding `__new__` or `__call__`. Use cases: enforcing coding standards (e.g., all methods must have docstrings), auto-registering subclasses, ORM field collection (Django's `ModelBase`), and API validation. For simpler cases, prefer `__init_subclass__` or class decorators.

---

**Q6. How does `super()` work in multiple inheritance?**

A: `super()` returns a proxy that delegates method calls to the *next class in the MRO*, not necessarily the direct parent. This enables cooperative multiple inheritance: each class in the chain calls `super()`, ensuring every class in the MRO gets a chance to run. Without `super()`, you'd have to hardcode parent class names, breaking the cooperative chain and potentially calling a grandparent method twice.

---

**Q7. What is the difference between `@classmethod` and `@staticmethod`?**

A: `@classmethod` receives the class (`cls`) as its first argument and can access/modify class state. It's inherited and works correctly with subclasses (the `cls` argument is the actual subclass). `@staticmethod` receives no implicit first argument — it's just a regular function namespaced inside the class. Use `@classmethod` for factory methods and operations that need the class; use `@staticmethod` for utility functions that logically belong to the class but don't need class or instance access.

---

**Q8. How do `__enter__` and `__exit__` work in context managers?**

A: `__enter__` is called when entering a `with` block and its return value is bound to the `as` variable. `__exit__(exc_type, exc_val, exc_tb)` is called when leaving the block, whether normally or due to an exception. If an exception occurred, the three arguments describe it; if not, they're all `None`. Returning `True` from `__exit__` suppresses the exception; returning `False` or `None` lets it propagate.

---

**Q9. What is the difference between `__repr__` and `__str__`?**

A: `__repr__` should return an unambiguous string representation, ideally valid Python that recreates the object — it's for developers and debugging. `__str__` should return a human-readable string — it's for end users. `str()` calls `__str__` first, falling back to `__repr__`. `repr()` always calls `__repr__`. In containers (lists, dicts), Python uses `__repr__` for elements.

---

**Q10. Explain the descriptor protocol.**

A: A descriptor is any object that defines `__get__`, `__set__`, or `__delete__`. When an attribute is accessed on an instance, Python checks if the class attribute is a descriptor. Data descriptors (define `__set__` or `__delete__`) take priority over instance `__dict__`. Non-data descriptors (only `__get__`) are overridden by instance attributes. `property`, `classmethod`, `staticmethod`, and `__slots__` are all implemented as descriptors.

---

**Q11. What are dataclasses and how do they differ from namedtuples?**

A: `@dataclass` auto-generates `__init__`, `__repr__`, `__eq__` (and optionally `__lt__`, `__hash__`, `__slots__`) from class-level field annotations. Unlike `namedtuple`, dataclasses are mutable by default, support inheritance naturally, allow default factories, support `__post_init__` for validation, and can be made immutable with `frozen=True`. `namedtuple` instances are tuples (immutable, iterable, unpackable, memory-efficient); dataclasses are regular class instances.

---

**Q12. What is the Mixin pattern and when should you use it?**

A: A mixin is a class that provides reusable behaviour to be combined via multiple inheritance, without being a standalone base class. Mixins should be focused on a single concern (e.g., JSON serialisation, logging, validation), should not define `__init__` (or call `super().__init__()` cooperatively), and are named with a `Mixin` suffix by convention. Use them to compose behaviour orthogonally — e.g., `class APIView(JSONMixin, AuthMixin, View)` — rather than building deep inheritance hierarchies.
