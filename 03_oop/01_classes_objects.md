# Python Classes and Objects — Comprehensive Guide

## 1. Class Definition and `__init__`

```python
class Dog:
    # Class variable — shared by all instances
    species = "Canis familiaris"
    count = 0

    def __init__(self, name, age, breed):
        # Instance variables — unique to each instance
        self.name = name
        self.age = age
        self.breed = breed
        Dog.count += 1   # increment class variable

    def __repr__(self):
        return f"Dog(name={self.name!r}, age={self.age}, breed={self.breed!r})"

    def __str__(self):
        return f"{self.name} ({self.breed}, {self.age} years old)"


# Creating instances
rex = Dog("Rex", 3, "German Shepherd")
buddy = Dog("Buddy", 5, "Golden Retriever")

print(repr(rex))   # Dog(name='Rex', age=3, breed='German Shepherd')
print(str(rex))    # Rex (German Shepherd, 3 years old)
print(rex)         # calls __str__
Dog.count          # 2
```

---

## 2. Instance vs Class Variables

```python
class Counter:
    # Class variable
    total = 0

    def __init__(self, name):
        # Instance variable
        self.name = name
        self.count = 0
        Counter.total += 1

    def increment(self):
        self.count += 1


c1 = Counter("c1")
c2 = Counter("c2")

c1.increment()
c1.increment()
c2.increment()

c1.count    # 2  — instance variable
c2.count    # 1  — instance variable
Counter.total  # 2  — class variable

# PITFALL: Mutable class variables are shared!
class Bad:
    items = []   # shared across ALL instances!

    def add(self, item):
        self.items.append(item)

b1 = Bad()
b2 = Bad()
b1.add("x")
b2.items   # ["x"]  — b2 is affected!

# Fix: initialize mutable defaults in __init__
class Good:
    def __init__(self):
        self.items = []   # each instance gets its own list
```

---

## 3. Instance, Class, and Static Methods

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    # Instance method — has access to self (instance)
    def to_fahrenheit(self):
        return self.celsius * 9/5 + 32

    def __repr__(self):
        return f"Temperature({self.celsius}°C)"

    # Class method — has access to cls (the class itself)
    # Used as alternative constructors or factory methods
    @classmethod
    def from_fahrenheit(cls, fahrenheit):
        celsius = (fahrenheit - 32) * 5/9
        return cls(celsius)

    @classmethod
    def from_kelvin(cls, kelvin):
        return cls(kelvin - 273.15)

    # Static method — no access to instance or class
    # Used for utility functions logically related to the class
    @staticmethod
    def is_valid_celsius(value):
        return value >= -273.15


# Usage
t1 = Temperature(100)
t1.to_fahrenheit()              # 212.0

t2 = Temperature.from_fahrenheit(212)   # alternative constructor
t3 = Temperature.from_kelvin(373.15)

Temperature.is_valid_celsius(-300)   # False
t1.is_valid_celsius(25)              # also works, but cls/self not passed
```

---

## 4. `__repr__` and `__str__`

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        # Should be unambiguous, ideally eval()-able
        # Used in: repr(obj), interactive shell, containers
        return f"Point({self.x!r}, {self.y!r})"

    def __str__(self):
        # Should be human-readable
        # Used in: print(), str(), f-strings
        return f"({self.x}, {self.y})"


p = Point(3, 4)
repr(p)    # "Point(3, 4)"
str(p)     # "(3, 4)"
print(p)   # (3, 4)  — uses __str__
[p]        # [Point(3, 4)]  — uses __repr__ in containers

# If only __repr__ is defined, it's used for both repr() and str()
# If only __str__ is defined, repr() falls back to default <Point object at 0x...>
```

---

## 5. The `@property` Decorator

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius   # convention: _ prefix for "private"

    @property
    def radius(self):
        """Getter — accessed like an attribute"""
        return self._radius

    @radius.setter
    def radius(self, value):
        """Setter — called on assignment"""
        if value < 0:
            raise ValueError("Radius cannot be negative")
        self._radius = value

    @radius.deleter
    def radius(self):
        """Deleter — called on del"""
        del self._radius

    @property
    def area(self):
        """Computed property — no setter"""
        import math
        return math.pi * self._radius ** 2

    @property
    def diameter(self):
        return self._radius * 2

    @diameter.setter
    def diameter(self, value):
        self._radius = value / 2


c = Circle(5)
c.radius        # 5  — calls getter
c.radius = 10   # calls setter
c.radius = -1   # ValueError
c.area          # 314.159...  — computed, no setter
c.diameter = 20 # sets radius to 10
del c.radius    # calls deleter
```

---

## 6. `__slots__`

```python
class Point:
    __slots__ = ['x', 'y']   # restrict attributes, save memory

    def __init__(self, x, y):
        self.x = x
        self.y = y

# Benefits:
# - ~40-50% less memory per instance (no __dict__)
# - Slightly faster attribute access
# - Prevents accidental attribute creation

p = Point(3, 4)
# p.z = 5   # AttributeError — z not in __slots__
# p.__dict__  # AttributeError — no __dict__

import sys
class WithDict:
    def __init__(self, x, y): self.x = x; self.y = y

class WithSlots:
    __slots__ = ['x', 'y']
    def __init__(self, x, y): self.x = x; self.y = y

sys.getsizeof(WithDict(1, 2))    # ~48 bytes + dict overhead
sys.getsizeof(WithSlots(1, 2))   # ~56 bytes (no dict)
```

---

## 7. Class Internals

```python
class MyClass:
    class_var = "shared"

    def __init__(self, x):
        self.x = x

obj = MyClass(42)

# Attribute lookup order: instance __dict__ → class __dict__ → bases
obj.__dict__        # {'x': 42}
MyClass.__dict__    # mappingproxy({'class_var': 'shared', '__init__': ..., ...})

# type() and isinstance()
type(obj)           # <class '__main__.MyClass'>
type(obj) is MyClass  # True
isinstance(obj, MyClass)  # True

# dir() — all attributes and methods
dir(obj)

# vars() — instance __dict__
vars(obj)   # {'x': 42}
```

---

## Interview Questions & Answers

**Q1: What is the difference between instance variables and class variables?**

Answer:
- **Instance variables** are defined in `__init__` with `self.var = value`. Each instance has its own copy.
- **Class variables** are defined at class level. They're shared across all instances.

The key pitfall: mutable class variables (lists, dicts) are shared, so modifying them through one instance affects all instances. Always initialize mutable defaults in `__init__`.

```python
class Bad:
    data = []   # shared!

class Good:
    def __init__(self):
        self.data = []   # per-instance
```

---

**Q2: What is the difference between `@classmethod` and `@staticmethod`?**

Answer:
- `@classmethod`: receives `cls` (the class) as first argument. Used for alternative constructors, factory methods, or when you need to access/modify class state.
- `@staticmethod`: receives no implicit first argument. Used for utility functions that are logically related to the class but don't need access to instance or class state.

```python
class Date:
    @classmethod
    def from_string(cls, s):   # alternative constructor
        y, m, d = map(int, s.split("-"))
        return cls(y, m, d)

    @staticmethod
    def is_valid(year, month, day):   # utility, no cls/self needed
        return 1 <= month <= 12 and 1 <= day <= 31
```

---

**Q3: What is the difference between `__repr__` and `__str__`?**

Answer:
- `__repr__`: unambiguous representation, meant for developers. Used by `repr()`, interactive shell, and when objects appear inside containers. Should ideally be eval()-able.
- `__str__`: human-readable representation. Used by `print()`, `str()`, and f-strings.

If only `__repr__` is defined, it serves as fallback for `__str__`. If only `__str__` is defined, `repr()` falls back to the default `<ClassName object at 0x...>`.

---

**Q4: What is `@property` and why use it instead of direct attribute access?**

Answer: `@property` lets you define getter/setter/deleter logic while keeping the attribute access syntax (`obj.attr`). Benefits:
- Add validation in the setter without changing the public API.
- Compute values on-the-fly (computed properties).
- Make attributes read-only (property with no setter).
- Maintain backward compatibility when adding logic to previously plain attributes.

---

**Q5: What is `__slots__` and when should you use it?**

Answer: `__slots__` replaces the instance `__dict__` with a fixed set of slots, reducing memory usage (~40-50%) and slightly improving attribute access speed. Use it when:
- You're creating many instances (thousands+) of a class.
- The set of attributes is fixed and known in advance.
- Memory efficiency is important.

Tradeoffs: can't add arbitrary attributes, doesn't work well with multiple inheritance unless all classes define `__slots__`.

---

**Q6: How does Python's attribute lookup work?**

Answer: Python follows the **MRO (Method Resolution Order)** for attribute lookup:
1. Instance `__dict__`
2. Class `__dict__`
3. Base class `__dict__` (following MRO)
4. Raises `AttributeError` if not found

Data descriptors (like `property`) take priority over instance `__dict__`.

---

**Q7: What is the difference between `type()` and `isinstance()`?**

Answer:
- `type(obj) is MyClass`: exact type check — returns True only if obj is exactly MyClass, not a subclass.
- `isinstance(obj, MyClass)`: checks if obj is an instance of MyClass **or any subclass**. Preferred in most cases because it respects inheritance.

```python
class Animal: pass
class Dog(Animal): pass

d = Dog()
type(d) is Dog      # True
type(d) is Animal   # False
isinstance(d, Dog)    # True
isinstance(d, Animal) # True  — respects inheritance
```

---

**Q8: What happens if you define `__init__` in a subclass without calling `super().__init__()`?**

Answer: The parent class's `__init__` is not called, so any initialization done there (setting instance variables, etc.) is skipped. This can lead to `AttributeError` when accessing attributes set by the parent.

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)   # MUST call this
        self.breed = breed
```

---

**Q9: What is the purpose of `self` in Python?**

Answer: `self` is a reference to the current instance. It's passed automatically as the first argument to instance methods. It's a convention (not a keyword) — you could name it anything, but `self` is universal. It allows methods to access and modify the instance's attributes and call other methods.

---

**Q10: How do you make a class attribute read-only?**

Answer: Define a `@property` with only a getter (no setter). Attempting to set it raises `AttributeError`.

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property
    def radius(self):
        return self._radius
    # No setter defined

c = Circle(5)
c.radius        # 5
c.radius = 10   # AttributeError: can't set attribute
```
