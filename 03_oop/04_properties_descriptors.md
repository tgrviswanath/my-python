# Python Properties and Descriptors — Comprehensive Guide

## 1. `@property` — Getter

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius   # _ prefix = "private by convention"

    @property
    def radius(self):
        """Getter — accessed like an attribute, not a method call"""
        return self._radius

    @property
    def area(self):
        """Computed/derived property — no setter needed"""
        import math
        return math.pi * self._radius ** 2

    @property
    def diameter(self):
        return self._radius * 2


c = Circle(5)
c.radius    # 5  — no parentheses!
c.area      # 78.539...
c.diameter  # 10

# c.radius = 10  # AttributeError: can't set attribute (no setter defined)
```

---

## 2. Getter, Setter, Deleter

```python
class Temperature:
    def __init__(self, celsius=0):
        self._celsius = celsius

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError(f"Temperature below absolute zero: {value}")
        self._celsius = value

    @celsius.deleter
    def celsius(self):
        print("Deleting temperature")
        del self._celsius

    @property
    def fahrenheit(self):
        return self._celsius * 9/5 + 32

    @fahrenheit.setter
    def fahrenheit(self, value):
        self.celsius = (value - 32) * 5/9   # reuse celsius setter (with validation)


t = Temperature(25)
t.celsius           # 25
t.celsius = 100     # calls setter
t.celsius = -300    # ValueError
t.fahrenheit        # 212.0
t.fahrenheit = 32   # sets celsius to 0 via setter
del t.celsius       # calls deleter
```

---

## 3. Property Without Decorator Syntax

```python
class MyClass:
    def __init__(self, value):
        self._value = value

    def _get_value(self):
        return self._value

    def _set_value(self, val):
        self._value = val

    def _del_value(self):
        del self._value

    # Explicit property() call — equivalent to @property
    value = property(_get_value, _set_value, _del_value, "The value property")


obj = MyClass(42)
obj.value        # 42
obj.value = 99   # calls setter
MyClass.value.__doc__  # "The value property"
```

---

## 4. Descriptors

A **descriptor** is any object that defines `__get__`, `__set__`, or `__delete__`. When a descriptor is assigned as a class attribute, Python calls these methods instead of normal attribute access.

### Non-Data Descriptor (only `__get__`)
```python
class CachedProperty:
    """Non-data descriptor: computes value once and caches it"""
    def __init__(self, func):
        self.func = func
        self.attrname = None
        self.__doc__ = func.__doc__

    def __set_name__(self, owner, name):
        """Called when descriptor is assigned to a class attribute"""
        self.attrname = name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self   # accessed on class, not instance
        if self.attrname not in obj.__dict__:
            obj.__dict__[self.attrname] = self.func(obj)
        return obj.__dict__[self.attrname]


class Circle:
    def __init__(self, radius):
        self.radius = radius

    @CachedProperty
    def area(self):
        import math
        print("Computing area...")
        return math.pi * self.radius ** 2


c = Circle(5)
c.area   # "Computing area..." then 78.539...
c.area   # 78.539... (cached, no print)
```

### Data Descriptor (`__get__` and `__set__`)
```python
class Validated:
    """Data descriptor: validates attribute values"""
    def __set_name__(self, owner, name):
        self.name = name
        self.storage_name = f"_{name}"

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.storage_name, None)

    def __set__(self, obj, value):
        self.validate(value)
        setattr(obj, self.storage_name, value)

    def validate(self, value):
        pass  # override in subclasses


class PositiveNumber(Validated):
    def validate(self, value):
        if not isinstance(value, (int, float)) or value <= 0:
            raise ValueError(f"{self.name} must be a positive number, got {value!r}")


class NonEmptyString(Validated):
    def validate(self, value):
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{self.name} must be a non-empty string")


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
p.price = -5   # ValueError: price must be a positive number
p.name = ""    # ValueError: name must be a non-empty string
```

---

## 5. Data vs Non-Data Descriptors

| Type | Methods | Priority |
|------|---------|----------|
| Data descriptor | `__get__` + `__set__` (or `__delete__`) | Higher than instance `__dict__` |
| Non-data descriptor | Only `__get__` | Lower than instance `__dict__` |

```python
class DataDesc:
    def __get__(self, obj, objtype=None):
        return "data descriptor"
    def __set__(self, obj, value):
        pass

class NonDataDesc:
    def __get__(self, obj, objtype=None):
        return "non-data descriptor"

class MyClass:
    data = DataDesc()
    nondata = NonDataDesc()

obj = MyClass()
obj.__dict__['data'] = "instance value"
obj.__dict__['nondata'] = "instance value"

obj.data     # "data descriptor"  — descriptor wins over instance dict
obj.nondata  # "instance value"   — instance dict wins over non-data descriptor
```

---

## 6. `__set_name__`

```python
class TypeChecked:
    def __init__(self, expected_type):
        self.expected_type = expected_type
        self.name = None

    def __set_name__(self, owner, name):
        """Called automatically when descriptor is assigned to class attribute"""
        self.name = name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return obj.__dict__.get(self.name)

    def __set__(self, obj, value):
        if not isinstance(value, self.expected_type):
            raise TypeError(
                f"{self.name} must be {self.expected_type.__name__}, "
                f"got {type(value).__name__}"
            )
        obj.__dict__[self.name] = value


class Person:
    name = TypeChecked(str)
    age = TypeChecked(int)

    def __init__(self, name, age):
        self.name = name
        self.age = age


p = Person("Alice", 30)
p.age = "thirty"   # TypeError: age must be int, got str
```

---

## 7. `property` is a Descriptor

```python
# property is itself a data descriptor
# This is how @property works under the hood:

class property_impl:
    def __init__(self, fget=None, fset=None, fdel=None, doc=None):
        self.fget = fget
        self.fset = fset
        self.fdel = fdel
        self.__doc__ = doc

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        if self.fget is None:
            raise AttributeError("unreadable attribute")
        return self.fget(obj)

    def __set__(self, obj, value):
        if self.fset is None:
            raise AttributeError("can't set attribute")
        self.fset(obj, value)

    def __delete__(self, obj):
        if self.fdel is None:
            raise AttributeError("can't delete attribute")
        self.fdel(obj)

    def getter(self, fget):
        return type(self)(fget, self.fset, self.fdel, self.__doc__)

    def setter(self, fset):
        return type(self)(self.fget, fset, self.fdel, self.__doc__)

    def deleter(self, fdel):
        return type(self)(self.fget, self.fset, fdel, self.__doc__)
```

---

## Interview Questions & Answers

**Q1: What is `@property` and why use it?**

Answer: `@property` is a built-in descriptor that lets you define getter/setter/deleter logic while keeping attribute access syntax (`obj.attr` instead of `obj.get_attr()`). Benefits:
- Add validation without changing the public API.
- Compute values on-the-fly.
- Make attributes read-only.
- Maintain backward compatibility when adding logic to previously plain attributes.

---

**Q2: What is a descriptor?**

Answer: A descriptor is any object that defines `__get__`, `__set__`, or `__delete__`. When assigned as a class attribute, Python calls these methods instead of normal attribute access. `property`, `classmethod`, `staticmethod`, and `function` objects are all descriptors.

---

**Q3: What is the difference between a data descriptor and a non-data descriptor?**

Answer:
- **Data descriptor**: defines `__get__` AND `__set__` (or `__delete__`). Takes priority over the instance `__dict__`.
- **Non-data descriptor**: defines only `__get__`. The instance `__dict__` takes priority.

This is why you can shadow a method (non-data descriptor) by setting an instance attribute with the same name, but you can't shadow a `property` (data descriptor) that way.

---

**Q4: How does `@property` work under the hood?**

Answer: `property` is a data descriptor class. When you write `@property`, Python creates a `property` object and assigns it as a class attribute. When you access `obj.attr`, Python's attribute lookup finds the `property` object in the class `__dict__`, sees it has `__get__`, and calls `property.__get__(obj, type(obj))`, which calls your getter function.

---

**Q5: What is `__set_name__` and when is it called?**

Answer: `__set_name__(self, owner, name)` is called automatically when a descriptor is assigned to a class attribute (at class creation time). It receives the owner class and the attribute name. This lets the descriptor know its own name without requiring it to be passed explicitly.

```python
class MyDescriptor:
    def __set_name__(self, owner, name):
        self.name = name  # now knows it's called "x" in MyClass

class MyClass:
    x = MyDescriptor()  # __set_name__(MyClass, 'x') called here
```

---

**Q6: How do you create a read-only property?**

Answer: Define a `@property` with only a getter (no setter). Attempting to set it raises `AttributeError`.

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property
    def radius(self):
        return self._radius
    # No @radius.setter defined

c = Circle(5)
c.radius        # 5
c.radius = 10   # AttributeError: can't set attribute
```

---

**Q7: What is a cached property and how would you implement one?**

Answer: A cached property computes its value on first access and caches it in the instance `__dict__`. Subsequent accesses return the cached value without recomputation. Python 3.8+ includes `functools.cached_property`.

```python
from functools import cached_property

class DataProcessor:
    def __init__(self, data):
        self.data = data

    @cached_property
    def processed(self):
        print("Processing...")
        return sorted(set(self.data))  # expensive operation

dp = DataProcessor([3, 1, 2, 1, 3])
dp.processed  # "Processing..." then [1, 2, 3]
dp.processed  # [1, 2, 3]  — cached, no print
```

---

**Q8: How do descriptors enable reusable validation?**

Answer: By defining validation logic in a descriptor class, you can reuse it across multiple attributes and classes without repeating code. The descriptor's `__set__` method validates the value before storing it.

```python
class PositiveNumber:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, obj, objtype=None):
        return obj.__dict__.get(self.name) if obj else self

    def __set__(self, obj, value):
        if value <= 0:
            raise ValueError(f"{self.name} must be positive")
        obj.__dict__[self.name] = value

class Rectangle:
    width = PositiveNumber()
    height = PositiveNumber()
    # Reused the same descriptor for both attributes
```
