# Python Abstract Classes and Dataclasses — Comprehensive Guide

## 1. Abstract Base Classes (ABC)

```python
from abc import ABC, abstractmethod, abstractproperty

class Shape(ABC):
    """Abstract base class — cannot be instantiated directly"""

    @abstractmethod
    def area(self) -> float:
        """Must be implemented by all subclasses"""
        pass

    @abstractmethod
    def perimeter(self) -> float:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Abstract property"""
        pass

    # Concrete method — shared by all subclasses
    def describe(self) -> str:
        return f"{self.name}: area={self.area():.2f}, perimeter={self.perimeter():.2f}"


# Shape()  # TypeError: Can't instantiate abstract class Shape
# with abstract methods area, name, perimeter


class Circle(Shape):
    def __init__(self, radius: float):
        self.radius = radius

    def area(self) -> float:
        import math
        return math.pi * self.radius ** 2

    def perimeter(self) -> float:
        import math
        return 2 * math.pi * self.radius

    @property
    def name(self) -> str:
        return "Circle"


class Rectangle(Shape):
    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height

    def perimeter(self) -> float:
        return 2 * (self.width + self.height)

    @property
    def name(self) -> str:
        return "Rectangle"


c = Circle(5)
r = Rectangle(4, 6)
c.describe()   # "Circle: area=78.54, perimeter=31.42"
r.describe()   # "Rectangle: area=24.00, perimeter=20.00"

# Polymorphism
shapes = [Circle(3), Rectangle(4, 5), Circle(1)]
total = sum(s.area() for s in shapes)
```

---

## 2. ABC Registration and Virtual Subclasses

```python
from abc import ABC, abstractmethod

class Drawable(ABC):
    @abstractmethod
    def draw(self):
        pass

    @classmethod
    def __subclasshook__(cls, subclass):
        """Customize isinstance/issubclass checks"""
        if cls is Drawable:
            return hasattr(subclass, 'draw') and callable(subclass.draw)
        return NotImplemented


# Virtual subclass — register without inheriting
class LegacyWidget:
    def draw(self):
        print("Drawing legacy widget")

Drawable.register(LegacyWidget)

isinstance(LegacyWidget(), Drawable)   # True
issubclass(LegacyWidget, Drawable)     # True
# But LegacyWidget doesn't actually inherit from Drawable
```

---

## 3. `@dataclass` — Basic Usage

```python
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class Point:
    x: float
    y: float

# Auto-generated: __init__, __repr__, __eq__
p1 = Point(1.0, 2.0)
p2 = Point(1.0, 2.0)
p3 = Point(3.0, 4.0)

repr(p1)    # "Point(x=1.0, y=2.0)"
p1 == p2    # True  — compares field values
p1 == p3    # False
p1.x        # 1.0
```

---

## 4. `field()` — Advanced Field Configuration

```python
from dataclasses import dataclass, field
from typing import List
import time

@dataclass
class Student:
    name: str
    age: int
    grades: List[float] = field(default_factory=list)  # mutable default!
    student_id: str = field(default_factory=lambda: f"STU{int(time.time())}")
    _internal: str = field(default="", repr=False, compare=False)
    metadata: dict = field(default_factory=dict, hash=False)

    # field() parameters:
    # default: default value (for immutable types)
    # default_factory: callable that returns default (for mutable types)
    # repr: include in __repr__ (default True)
    # compare: include in __eq__ and __hash__ (default True)
    # hash: include in __hash__ (default None = same as compare)
    # init: include in __init__ (default True)
    # metadata: arbitrary metadata dict


# WRONG — mutable default
# @dataclass
# class Bad:
#     items: list = []  # ValueError: mutable default not allowed

# RIGHT — use field(default_factory=...)
@dataclass
class Good:
    items: list = field(default_factory=list)
```

---

## 5. `__post_init__`

```python
from dataclasses import dataclass, field
import math

@dataclass
class Circle:
    radius: float

    def __post_init__(self):
        """Called after __init__ — for validation and derived fields"""
        if self.radius <= 0:
            raise ValueError(f"Radius must be positive, got {self.radius}")

    @property
    def area(self):
        return math.pi * self.radius ** 2


@dataclass
class Rectangle:
    width: float
    height: float
    area: float = field(init=False)   # not in __init__, computed in __post_init__

    def __post_init__(self):
        if self.width <= 0 or self.height <= 0:
            raise ValueError("Dimensions must be positive")
        self.area = self.width * self.height   # computed field


r = Rectangle(4, 5)
r.area   # 20.0  — computed in __post_init__

# InitVar — parameter passed to __post_init__ but not stored as field
from dataclasses import InitVar

@dataclass
class DatabaseRecord:
    name: str
    raw_data: InitVar[str]   # passed to __post_init__, not stored
    processed: str = field(init=False)

    def __post_init__(self, raw_data: str):
        self.processed = raw_data.strip().upper()


rec = DatabaseRecord("test", "  hello world  ")
rec.processed   # "HELLO WORLD"
# rec.raw_data  # AttributeError — not stored
```

---

## 6. Frozen Dataclasses

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class FrozenPoint:
    x: float
    y: float

    def distance_to_origin(self):
        return (self.x**2 + self.y**2) ** 0.5


p = FrozenPoint(3.0, 4.0)
p.x   # 3.0
# p.x = 10  # FrozenInstanceError: cannot assign to field 'x'

# Frozen dataclasses are hashable (if all fields are hashable)
hash(p)   # works!
{p}       # can be used in sets
{p: "value"}  # can be used as dict key

# Useful for immutable value objects
@dataclass(frozen=True)
class Color:
    r: int
    g: int
    b: int

    def __post_init__(self):
        for field_name, value in [('r', self.r), ('g', self.g), ('b', self.b)]:
            if not 0 <= value <= 255:
                raise ValueError(f"{field_name} must be 0-255")

RED = Color(255, 0, 0)
GREEN = Color(0, 255, 0)
```

---

## 7. `__slots__` with Dataclasses

```python
from dataclasses import dataclass

# Python 3.10+
@dataclass(slots=True)
class SlottedPoint:
    x: float
    y: float

# Python < 3.10 — manual approach
@dataclass
class SlottedPoint:
    __slots__ = ['x', 'y']
    x: float
    y: float

# Benefits: ~40% less memory, faster attribute access
import sys
@dataclass
class WithDict:
    x: float
    y: float

@dataclass(slots=True)
class WithSlots:
    x: float
    y: float

sys.getsizeof(WithDict(1.0, 2.0))    # larger
sys.getsizeof(WithSlots(1.0, 2.0))   # smaller
```

---

## 8. Dataclass Options

```python
from dataclasses import dataclass

# eq=True (default): generate __eq__
# order=True: generate __lt__, __le__, __gt__, __ge__
# frozen=True: make immutable (generates __hash__)
# repr=True (default): generate __repr__
# init=True (default): generate __init__
# unsafe_hash=True: generate __hash__ even if mutable (use carefully)

@dataclass(order=True)
class Version:
    major: int
    minor: int
    patch: int

    def __str__(self):
        return f"{self.major}.{self.minor}.{self.patch}"


v1 = Version(1, 2, 3)
v2 = Version(2, 0, 0)
v1 < v2    # True  — compares field by field
sorted([Version(1,2,3), Version(2,0,0), Version(1,3,0)])
# [Version(1,2,3), Version(1,3,0), Version(2,0,0)]
```

---

## 9. Dataclass Inheritance

```python
from dataclasses import dataclass

@dataclass
class Animal:
    name: str
    sound: str

@dataclass
class Dog(Animal):
    breed: str
    sound: str = "Woof"   # override default

    def speak(self):
        return f"{self.name} says {self.sound}"


d = Dog(name="Rex", sound="Woof", breed="Labrador")
# Note: parent fields come first in __init__

# Frozen inheritance — all classes must be frozen or all unfrozen
@dataclass(frozen=True)
class FrozenAnimal:
    name: str

@dataclass(frozen=True)
class FrozenDog(FrozenAnimal):
    breed: str
```

---

## Interview Questions & Answers

**Q1: What is an abstract class and why use it?**

Answer: An abstract class (using `ABC`) defines an interface that subclasses must implement. It:
- Cannot be instantiated directly.
- Enforces that subclasses implement specific methods (`@abstractmethod`).
- Provides a common interface for polymorphism.
- Documents the expected API for subclasses.

Use it when you want to define a contract that all subclasses must fulfill.

---

**Q2: What is the difference between an abstract class and an interface?**

Answer: Python doesn't have a separate interface concept. Abstract classes serve both purposes:
- **Abstract class**: can have concrete methods, instance variables, and abstract methods.
- **Interface** (in other languages): only method signatures, no implementation.

In Python, you can simulate a pure interface by making all methods abstract. ABCs can also have concrete methods (shared implementation).

---

**Q3: What does `@dataclass` generate automatically?**

Answer: By default, `@dataclass` generates:
- `__init__`: with parameters for all fields
- `__repr__`: showing class name and field values
- `__eq__`: comparing all fields

With options:
- `order=True`: `__lt__`, `__le__`, `__gt__`, `__ge__`
- `frozen=True`: `__hash__`, makes instance immutable
- `unsafe_hash=True`: `__hash__` for mutable dataclass

---

**Q4: Why can't you use a mutable default value in a dataclass field?**

Answer: If you write `items: list = []`, all instances would share the same list object (same bug as mutable class variables). Python raises `ValueError` to prevent this. Use `field(default_factory=list)` instead — it calls `list()` for each new instance.

```python
# Wrong
@dataclass
class Bad:
    items: list = []  # ValueError

# Right
@dataclass
class Good:
    items: list = field(default_factory=list)
```

---

**Q5: What is `__post_init__` and when would you use it?**

Answer: `__post_init__` is called automatically after `__init__`. Use it for:
- Validation of field values.
- Computing derived fields (marked with `field(init=False)`).
- Processing `InitVar` parameters.
- Any initialization logic that depends on multiple fields.

---

**Q6: What is a frozen dataclass and when should you use it?**

Answer: A frozen dataclass (`@dataclass(frozen=True)`) is immutable — attempting to set a field raises `FrozenInstanceError`. It also generates `__hash__`, making instances usable in sets and as dict keys. Use it for:
- Value objects (coordinates, colors, versions).
- Dict keys or set members.
- Thread-safe shared data.
- Enforcing immutability as a design constraint.

---

**Q7: How does `@dataclass(order=True)` work?**

Answer: With `order=True`, Python generates `__lt__`, `__le__`, `__gt__`, `__ge__` that compare instances field by field (in the order they're defined). This enables sorting and comparison operators.

```python
@dataclass(order=True)
class Point:
    x: float
    y: float

Point(1, 3) < Point(2, 0)   # True (1 < 2)
Point(1, 3) < Point(1, 4)   # True (x equal, 3 < 4)
```

---

**Q8: What is the difference between `ABC` and registering a virtual subclass?**

Answer:
- **Inheriting from ABC**: the subclass must implement all abstract methods or it can't be instantiated. True inheritance relationship.
- **Virtual subclass** (`ABC.register(cls)`): registers a class as a "virtual" subclass without actual inheritance. `isinstance`/`issubclass` return True, but abstract methods are NOT enforced. Useful for integrating legacy code or third-party classes.

```python
Drawable.register(LegacyWidget)
isinstance(LegacyWidget(), Drawable)  # True
issubclass(LegacyWidget, Drawable)    # True
# But LegacyWidget doesn't need to implement draw()
```
