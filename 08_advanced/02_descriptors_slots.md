# Python Descriptors and __slots__

## 1. Descriptor Protocol

A descriptor is any object that defines `__get__`, `__set__`, or `__delete__`. When a descriptor is a class attribute, Python calls these methods instead of the normal attribute access.

```python
class Descriptor:
    def __get__(self, obj, objtype=None):
        # obj: instance (None if accessed on class)
        # objtype: the class
        if obj is None:
            return self  # accessed on class
        return obj.__dict__.get('_value', None)

    def __set__(self, obj, value):
        obj.__dict__['_value'] = value

    def __delete__(self, obj):
        del obj.__dict__['_value']

class MyClass:
    attr = Descriptor()  # descriptor as class attribute

obj = MyClass()
obj.attr = 42       # calls Descriptor.__set__(obj, 42)
print(obj.attr)     # calls Descriptor.__get__(obj, MyClass)
del obj.attr        # calls Descriptor.__delete__(obj)
```

---

## 2. Data vs Non-Data Descriptors

```python
# Data descriptor: defines __set__ or __delete__
# Non-data descriptor: only defines __get__

# Data descriptors take priority over instance __dict__
# Non-data descriptors are overridden by instance __dict__

class DataDescriptor:
    """Data descriptor — has __set__."""
    def __get__(self, obj, objtype=None):
        if obj is None: return self
        return obj.__dict__.get('_x', 0)

    def __set__(self, obj, value):
        obj.__dict__['_x'] = value

class NonDataDescriptor:
    """Non-data descriptor — only __get__."""
    def __get__(self, obj, objtype=None):
        if obj is None: return self
        return "from descriptor"

class MyClass:
    data = DataDescriptor()
    non_data = NonDataDescriptor()

obj = MyClass()

# Data descriptor: __set__ is called, stored in _x
obj.data = 42
print(obj.data)  # 42 — from descriptor

# Non-data descriptor: instance __dict__ takes priority
obj.__dict__['non_data'] = "from instance"
print(obj.non_data)  # "from instance" — instance wins!

# Lookup order:
# 1. Data descriptors (class)
# 2. Instance __dict__
# 3. Non-data descriptors (class)
# 4. Class __dict__
```

---

## 3. `__set_name__`

```python
# __set_name__ is called when the descriptor is assigned to a class attribute
# Allows the descriptor to know its own name

class TypedAttribute:
    """Descriptor with type validation."""

    def __set_name__(self, owner, name):
        # Called when class is created
        self.name = name
        self.private_name = f'_{name}'

    def __init__(self, expected_type):
        self.expected_type = expected_type

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.private_name, None)

    def __set__(self, obj, value):
        if not isinstance(value, self.expected_type):
            raise TypeError(
                f"'{self.name}' must be {self.expected_type.__name__}, "
                f"got {type(value).__name__}"
            )
        setattr(obj, self.private_name, value)

class Person:
    name = TypedAttribute(str)
    age = TypedAttribute(int)
    salary = TypedAttribute(float)

    def __init__(self, name, age, salary):
        self.name = name
        self.age = age
        self.salary = salary

p = Person("Alice", 30, 95000.0)
print(p.name, p.age, p.salary)

try:
    p.age = "thirty"  # TypeError!
except TypeError as e:
    print(f"TypeError: {e}")
```

---

## 4. Practical Descriptor: Validated Property

```python
class Validator:
    """Base descriptor for validated attributes."""

    def __set_name__(self, owner, name):
        self.name = name
        self.private_name = f'_{name}'

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.private_name, self.default)

    def __set__(self, obj, value):
        value = self.validate(value)
        setattr(obj, self.private_name, value)

    def validate(self, value):
        return value

    @property
    def default(self):
        return None

class PositiveNumber(Validator):
    def validate(self, value):
        if not isinstance(value, (int, float)):
            raise TypeError(f"'{self.name}' must be a number")
        if value <= 0:
            raise ValueError(f"'{self.name}' must be positive, got {value}")
        return value

class NonEmptyString(Validator):
    def validate(self, value):
        if not isinstance(value, str):
            raise TypeError(f"'{self.name}' must be a string")
        if not value.strip():
            raise ValueError(f"'{self.name}' cannot be empty")
        return value.strip()

class Product:
    name = NonEmptyString()
    price = PositiveNumber()
    quantity = PositiveNumber()

    def __init__(self, name, price, quantity):
        self.name = name
        self.price = price
        self.quantity = quantity

    @property
    def total_value(self):
        return self.price * self.quantity

p = Product("Widget", 9.99, 100)
print(f"{p.name}: ${p.price} x {p.quantity} = ${p.total_value:.2f}")

try:
    p.price = -5  # ValueError
except ValueError as e:
    print(f"ValueError: {e}")
```

---

## 5. `__slots__` — Memory Optimization

```python
# Without __slots__: each instance has a __dict__ (flexible but memory-heavy)
class RegularClass:
    def __init__(self, x, y):
        self.x = x
        self.y = y

# With __slots__: no __dict__, fixed attributes, less memory
class SlottedClass:
    __slots__ = ('x', 'y')

    def __init__(self, x, y):
        self.x = x
        self.y = y

import sys

regular = RegularClass(1, 2)
slotted = SlottedClass(1, 2)

print(f"Regular: {sys.getsizeof(regular)} bytes + {sys.getsizeof(regular.__dict__)} bytes (dict)")
print(f"Slotted: {sys.getsizeof(slotted)} bytes (no dict)")

# Slotted class cannot have arbitrary attributes
try:
    slotted.z = 3  # AttributeError!
except AttributeError as e:
    print(f"AttributeError: {e}")

# Memory comparison with many instances
import tracemalloc

tracemalloc.start()
regular_list = [RegularClass(i, i) for i in range(100000)]
regular_mem = tracemalloc.get_traced_memory()[1]
tracemalloc.stop()

tracemalloc.start()
slotted_list = [SlottedClass(i, i) for i in range(100000)]
slotted_mem = tracemalloc.get_traced_memory()[1]
tracemalloc.stop()

print(f"\n100,000 instances:")
print(f"Regular: {regular_mem / 1024 / 1024:.1f} MB")
print(f"Slotted: {slotted_mem / 1024 / 1024:.1f} MB")
print(f"Savings: {(1 - slotted_mem/regular_mem)*100:.0f}%")
```

---

## 6. `__slots__` vs `__dict__`

```python
# __slots__ trade-offs:

# BENEFITS:
# 1. Less memory (no __dict__ per instance)
# 2. Faster attribute access
# 3. Prevents accidental attribute creation

# DRAWBACKS:
# 1. Cannot add arbitrary attributes
# 2. Cannot use __weakref__ without adding it to __slots__
# 3. Multiple inheritance with __slots__ is tricky
# 4. Pickling requires __getstate__/__setstate__

class Point:
    __slots__ = ('x', 'y', '__weakref__')  # add __weakref__ for weak references

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point({self.x}, {self.y})"

# Inheritance with __slots__
class Point3D(Point):
    __slots__ = ('z',)  # only add NEW slots

    def __init__(self, x, y, z):
        super().__init__(x, y)
        self.z = z

p3 = Point3D(1, 2, 3)
print(p3)  # Point(1, 2)
print(p3.z)  # 3

# If parent doesn't have __slots__, child still has __dict__
class Base:
    pass  # no __slots__ — has __dict__

class Child(Base):
    __slots__ = ('x',)  # still has __dict__ from Base!

c = Child()
c.x = 1
c.y = 2  # works because Base has __dict__
```

---

## 7. Descriptors in the Standard Library

```python
# property is a descriptor
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("Radius cannot be negative")
        self._radius = value

    @property
    def area(self):
        import math
        return math.pi * self._radius ** 2

# property is implemented as a descriptor:
# property.__get__ calls the getter
# property.__set__ calls the setter
# property.__delete__ calls the deleter

# classmethod and staticmethod are also descriptors
class MyClass:
    @classmethod
    def class_method(cls):
        return cls

    @staticmethod
    def static_method():
        return "static"

# These work because classmethod and staticmethod implement __get__
# which returns a bound method with the appropriate first argument
```

---

## Interview Questions

**Q1: What is the descriptor protocol?**

Answer: The descriptor protocol consists of three methods: `__get__(self, obj, objtype)`, `__set__(self, obj, value)`, and `__delete__(self, obj)`. When a class attribute implements any of these, Python calls them instead of normal attribute access. `__get__` is called on attribute read, `__set__` on write, `__delete__` on deletion. `property`, `classmethod`, `staticmethod`, and `functools.cached_property` are all implemented as descriptors.

---

**Q2: What is the difference between data and non-data descriptors?**

Answer: A data descriptor defines `__set__` or `__delete__` (or both). A non-data descriptor only defines `__get__`. The difference is priority: data descriptors take priority over the instance `__dict__`, while non-data descriptors are overridden by instance `__dict__`. This is why `property` (a data descriptor) always calls the getter/setter even if the instance has a same-named key in `__dict__`.

---

**Q3: What is `__set_name__` and why is it useful?**

Answer: `__set_name__(self, owner, name)` is called when a descriptor is assigned to a class attribute. It tells the descriptor its own name and the class it belongs to. This allows the descriptor to use the attribute name for error messages, storage keys, or logging without requiring the name to be passed explicitly to `__init__`.

---

**Q4: What are `__slots__` and when should you use them?**

Answer: `__slots__` is a class variable that lists allowed instance attributes. It prevents creation of `__dict__` per instance, saving memory (typically 40-50% for simple classes). Use `__slots__` when: creating many instances of a class (data classes, value objects), memory is constrained, or you want to prevent accidental attribute creation. Don't use `__slots__` when: you need dynamic attributes, pickling without custom `__getstate__`, or complex multiple inheritance.

---

**Q5: How does `property` work as a descriptor?**

Answer: `property` is a data descriptor (implements `__get__`, `__set__`, `__delete__`). When you access `obj.prop`, Python calls `property.__get__(obj, type(obj))` which calls your getter function. When you set `obj.prop = value`, Python calls `property.__set__(obj, value)` which calls your setter. This is why properties always call the getter/setter — they're data descriptors with higher priority than instance `__dict__`.

---

**Q6: What is the attribute lookup order in Python?**

Answer:
1. Data descriptors from the class (and its MRO)
2. Instance `__dict__`
3. Non-data descriptors and other class attributes

This order explains why `property` (data descriptor) always wins over instance `__dict__`, but regular methods (non-data descriptors) can be overridden by instance attributes.

---

**Q7: What are the drawbacks of `__slots__`?**

Answer:
1. Cannot add arbitrary attributes at runtime
2. No `__weakref__` support unless explicitly added to `__slots__`
3. Multiple inheritance: if any base class lacks `__slots__`, the subclass still has `__dict__`
4. Pickling requires `__getstate__`/`__setstate__` for non-default behavior
5. `__slots__` in subclasses only adds new slots — must also define in parent

---

**Q8: How do you implement a lazy property using descriptors?**

Answer: A lazy property computes its value on first access and caches it:

```python
class lazy_property:
    def __init__(self, func):
        self.func = func
        self.name = None

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        value = self.func(obj)
        setattr(obj, self.name, value)  # cache in instance __dict__
        return value

class Circle:
    def __init__(self, radius):
        self.radius = radius

    @lazy_property
    def area(self):
        import math
        print("Computing area...")
        return math.pi * self.radius ** 2

c = Circle(5)
print(c.area)  # "Computing area..." then result
print(c.area)  # result only — cached!
```
