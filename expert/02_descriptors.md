# Python Descriptors — Expert Reference

## Table of Contents
1. [The Descriptor Protocol](#1-the-descriptor-protocol)
2. [Data vs Non-Data Descriptors](#2-data-vs-non-data-descriptors)
3. [How @property Is a Descriptor](#3-how-property-is-a-descriptor)
4. [How Functions Become Methods](#4-how-functions-become-methods)
5. [Reusable Validation Descriptors](#5-reusable-validation-descriptors)
6. [cached_property Implementation](#6-cached_property-implementation)
7. [__slots__ as Descriptors](#7-__slots__-as-descriptors)
8. [Attribute Lookup Order](#8-attribute-lookup-order)
9. [Performance Notes](#9-performance-notes)
10. [Common Bugs](#10-common-bugs)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Descriptor Protocol

A descriptor is any object that defines at least one of these methods:

| Method | Signature | Called when |
|---|---|---|
| `__get__` | `(self, obj, objtype=None)` | Attribute is read |
| `__set__` | `(self, obj, value)` | Attribute is written |
| `__delete__` | `(self, obj)` | Attribute is deleted |
| `__set_name__` | `(self, owner, name)` | Class is created (Python 3.6+) |

```python
class Descriptor:
    def __set_name__(self, owner, name):
        """Called when the descriptor is assigned to a class attribute."""
        self.name = name
        self.storage_name = f'_{name}'
        print(f"Descriptor '{name}' assigned to class '{owner.__name__}'")

    def __get__(self, obj, objtype=None):
        """
        obj: the instance (None if accessed from the class)
        objtype: the class
        """
        if obj is None:
            return self  # accessed from class, return descriptor itself
        return getattr(obj, self.storage_name, None)

    def __set__(self, obj, value):
        setattr(obj, self.storage_name, value)

    def __delete__(self, obj):
        delattr(obj, self.storage_name)


class MyClass:
    attr = Descriptor()

obj = MyClass()
obj.attr = 42
print(obj.attr)   # 42
del obj.attr
print(MyClass.attr)  # <__main__.Descriptor object>
```

### __set_name__ in Detail

`__set_name__` was added in Python 3.6. Before it, descriptors had to be told their name manually or use metaclasses.

```python
# Before Python 3.6 — manual name assignment
class OldDescriptor:
    def __init__(self, name):
        self.name = name  # had to pass name explicitly

class MyClass:
    attr = OldDescriptor('attr')  # redundant!

# Python 3.6+ — automatic
class NewDescriptor:
    def __set_name__(self, owner, name):
        self.name = name  # automatically called with 'attr'

class MyClass:
    attr = NewDescriptor()  # clean!
```

---

## 2. Data vs Non-Data Descriptors

This distinction determines priority in attribute lookup.

### Non-Data Descriptor
Defines only `__get__` (no `__set__` or `__delete__`).

```python
class NonDataDescriptor:
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return 42

class MyClass:
    x = NonDataDescriptor()

obj = MyClass()
print(obj.x)       # 42 — descriptor called
obj.x = 100        # instance __dict__ entry created, SHADOWS descriptor
print(obj.x)       # 100 — instance dict wins!
print(obj.__dict__)  # {'x': 100}
```

### Data Descriptor
Defines `__set__` (and optionally `__delete__`).

```python
class DataDescriptor:
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return obj.__dict__.get(f'_{self.name}', 0)

    def __set__(self, obj, value):
        obj.__dict__[f'_{self.name}'] = value

    def __set_name__(self, owner, name):
        self.name = name

class MyClass:
    x = DataDescriptor()

obj = MyClass()
obj.x = 100
print(obj.x)       # 100 — descriptor __get__ called
# Cannot shadow with instance dict because __set__ intercepts all writes
obj.__dict__['x'] = 999  # direct dict write
print(obj.x)       # 100 — data descriptor WINS over instance dict!
```

### Priority Summary

```
Data descriptor > Instance __dict__ > Non-data descriptor > Class __dict__
```

---

## 3. How @property Is a Descriptor

`property` is a built-in data descriptor implemented in C. Here's a pure Python equivalent:

```python
class property_:
    """Pure Python implementation of the built-in property descriptor."""

    def __init__(self, fget=None, fset=None, fdel=None, doc=None):
        self.fget = fget
        self.fset = fset
        self.fdel = fdel
        self.__doc__ = doc or (fget.__doc__ if fget else None)

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        if self.fget is None:
            raise AttributeError(f"unreadable attribute '{self.name}'")
        return self.fget(obj)

    def __set__(self, obj, value):
        if self.fset is None:
            raise AttributeError(f"can't set attribute '{self.name}'")
        self.fset(obj, value)

    def __delete__(self, obj):
        if self.fdel is None:
            raise AttributeError(f"can't delete attribute '{self.name}'")
        self.fdel(obj)

    def getter(self, fget):
        return type(self)(fget, self.fset, self.fdel, self.__doc__)

    def setter(self, fset):
        return type(self)(self.fget, fset, self.fdel, self.__doc__)

    def deleter(self, fdel):
        return type(self)(self.fget, self.fset, fdel, self.__doc__)


class Temperature:
    def __init__(self, celsius=0):
        self._celsius = celsius

    @property_
    def celsius(self):
        """Temperature in Celsius."""
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("Temperature below absolute zero!")
        self._celsius = value

    @property_
    def fahrenheit(self):
        """Temperature in Fahrenheit."""
        return self._celsius * 9/5 + 32

    @fahrenheit.setter
    def fahrenheit(self, value):
        self.celsius = (value - 32) * 5/9


t = Temperature(25)
print(t.celsius)     # 25
print(t.fahrenheit)  # 77.0
t.fahrenheit = 32
print(t.celsius)     # 0.0
```

### Why property is a Data Descriptor

`property` defines both `__get__` and `__set__` (even if no setter is provided — the `__set__` raises `AttributeError`). This means it takes priority over the instance `__dict__`, which is why you can't accidentally shadow a property with an instance attribute.

---

## 4. How Functions Become Methods

Functions are non-data descriptors. Their `__get__` method implements the binding mechanism.

```python
# Functions have __get__
def greet(self):
    return f"Hello, I am {self.name}"

class Person:
    name = "Alice"
    greet = greet  # assign function as class attribute

p = Person()

# Accessing from instance triggers __get__
bound_method = greet.__get__(p, Person)
print(bound_method)        # <bound method greet of <__main__.Person object>>
print(bound_method())      # Hello, I am Alice

# Accessing from class returns the function itself
unbound = greet.__get__(None, Person)
print(unbound)             # <function greet at 0x...>

# Python's attribute lookup does this automatically:
print(p.greet())           # Hello, I am Alice
print(p.greet is bound_method)  # False — new bound method created each time!
```

### Pure Python Function Descriptor

```python
import types

class Function:
    """Simplified version of how Python functions work as descriptors."""

    def __init__(self, func):
        self.func = func

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self.func
        # Return a bound method
        return types.MethodType(self.func, obj)
```

### staticmethod and classmethod as Descriptors

```python
class staticmethod_:
    def __init__(self, func):
        self.func = func

    def __get__(self, obj, objtype=None):
        return self.func  # never binds — returns raw function


class classmethod_:
    def __init__(self, func):
        self.func = func

    def __get__(self, obj, objtype=None):
        cls = objtype if objtype is not None else type(obj)
        return types.MethodType(self.func, cls)  # binds to class, not instance
```

---

## 5. Reusable Validation Descriptors

Descriptors shine when you need the same validation logic across multiple attributes.

```python
class Validated:
    """Abstract base for validated descriptors."""

    def __set_name__(self, owner, name):
        self.public_name = name
        self.private_name = f'_{name}'

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.private_name, self.default)

    def __set__(self, obj, value):
        value = self.validate(value)
        setattr(obj, self.private_name, value)

    def validate(self, value):
        raise NotImplementedError

    @property
    def default(self):
        return None


class PositiveNumber(Validated):
    default = 0.0

    def validate(self, value):
        if not isinstance(value, (int, float)):
            raise TypeError(f"Expected number, got {type(value).__name__}")
        if value <= 0:
            raise ValueError(f"Expected positive number, got {value}")
        return float(value)


class NonEmptyString(Validated):
    default = ''

    def validate(self, value):
        if not isinstance(value, str):
            raise TypeError(f"Expected str, got {type(value).__name__}")
        value = value.strip()
        if not value:
            raise ValueError("String cannot be empty or whitespace")
        return value


class RangedInt(Validated):
    def __init__(self, min_val, max_val):
        self.min_val = min_val
        self.max_val = max_val

    def validate(self, value):
        if not isinstance(value, int):
            raise TypeError(f"Expected int, got {type(value).__name__}")
        if not (self.min_val <= value <= self.max_val):
            raise ValueError(
                f"Expected {self.min_val} <= value <= {self.max_val}, got {value}"
            )
        return value


class Product:
    name = NonEmptyString()
    price = PositiveNumber()
    quantity = RangedInt(0, 10_000)

    def __init__(self, name, price, quantity):
        self.name = name
        self.price = price
        self.quantity = quantity

    def __repr__(self):
        return f"Product({self.name!r}, ${self.price:.2f}, qty={self.quantity})"


p = Product("Widget", 9.99, 100)
print(p)  # Product('Widget', $9.99, qty=100)

try:
    p.price = -5
except ValueError as e:
    print(e)  # Expected positive number, got -5
```

---

## 6. cached_property Implementation

`functools.cached_property` (Python 3.8+) is a non-data descriptor that computes a value once and caches it in the instance `__dict__`.

```python
class cached_property:
    """
    A property that is only computed once per instance and then cached
    as a normal attribute. Deleting the attribute resets the cache.
    """

    def __init__(self, func):
        self.func = func
        self.attrname = None
        self.__doc__ = func.__doc__

    def __set_name__(self, owner, name):
        self.attrname = name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        if self.attrname is None:
            raise TypeError("Cannot use cached_property without __set_name__")

        # Check instance dict first
        val = obj.__dict__.get(self.attrname, _MISSING := object())
        if val is _MISSING:
            # Compute and cache
            val = self.func(obj)
            obj.__dict__[self.attrname] = val
        return val


class DataProcessor:
    def __init__(self, data: list):
        self.data = data

    @cached_property
    def sorted_data(self):
        print("Computing sorted_data...")
        return sorted(self.data)

    @cached_property
    def statistics(self):
        print("Computing statistics...")
        n = len(self.data)
        mean = sum(self.data) / n
        variance = sum((x - mean) ** 2 for x in self.data) / n
        return {'n': n, 'mean': mean, 'variance': variance}


dp = DataProcessor([3, 1, 4, 1, 5, 9, 2, 6])
print(dp.sorted_data)    # Computing sorted_data... [1, 1, 2, 3, 4, 5, 6, 9]
print(dp.sorted_data)    # (no recomputation)
print(dp.statistics)     # Computing statistics... {'n': 8, ...}

# Reset cache by deleting
del dp.sorted_data
print(dp.sorted_data)    # Computing sorted_data... (recomputed)
```

### Why cached_property is a Non-Data Descriptor

It only defines `__get__`, not `__set__`. This means the instance `__dict__` takes priority after the first access — the cached value in `__dict__` shadows the descriptor. This is the key mechanism: first access goes through `__get__` (descriptor), which writes to `__dict__`, and subsequent accesses find the value in `__dict__` directly (bypassing the descriptor entirely).

---

## 7. __slots__ as Descriptors

When you define `__slots__`, Python creates **member descriptors** (also called slot descriptors) for each slot name.

```python
class Point:
    __slots__ = ('x', 'y')

    def __init__(self, x, y):
        self.x = x
        self.y = y


# Slots are data descriptors on the class
print(type(Point.x))   # <class 'member_descriptor'>
print(Point.x)         # <member 'x' of 'Point' objects>

p = Point(1, 2)
print(p.x)  # 1

# No instance __dict__
try:
    print(p.__dict__)
except AttributeError as e:
    print(e)  # 'Point' object has no attribute '__dict__'

# Cannot add arbitrary attributes
try:
    p.z = 3
except AttributeError as e:
    print(e)  # 'Point' object has no attribute 'z'
```

### Memory Comparison

```python
import sys

class WithDict:
    def __init__(self, x, y):
        self.x = x
        self.y = y

class WithSlots:
    __slots__ = ('x', 'y')
    def __init__(self, x, y):
        self.x = x
        self.y = y

d = WithDict(1, 2)
s = WithSlots(1, 2)

print(sys.getsizeof(d))           # ~48 bytes (object)
print(sys.getsizeof(d.__dict__))  # ~232 bytes (dict overhead)
print(sys.getsizeof(s))           # ~56 bytes (object + slots)
# Total: WithDict ~280 bytes vs WithSlots ~56 bytes
```

### __slots__ Inheritance Gotchas

```python
class Base:
    __slots__ = ('x',)

class Child(Base):
    __slots__ = ('y',)  # Only add NEW slots

class BadChild(Base):
    pass  # No __slots__ — gets __dict__ anyway!

bc = BadChild(1)  # Wait, Base.__init__ not defined here
# The point: if any class in the MRO lacks __slots__, instances get __dict__
```

---

## 8. Attribute Lookup Order

Python's attribute lookup for `obj.attr` follows this algorithm (simplified from `object.__getattribute__`):

```
1. type(obj).__mro__ is searched for a DATA descriptor named 'attr'
   → If found: call descriptor.__get__(obj, type(obj))

2. obj.__dict__ is checked for 'attr'
   → If found: return obj.__dict__['attr']

3. type(obj).__mro__ is searched for a NON-DATA descriptor or plain value named 'attr'
   → If descriptor: call descriptor.__get__(obj, type(obj))
   → If plain value: return it

4. If nothing found: raise AttributeError
   (unless __getattr__ is defined, which is called as a fallback)
```

```python
class Meta(type):
    pass

class Base:
    class_var = "base class var"

    def method(self):
        return "method"

class Child(Base):
    pass

obj = Child()
obj.instance_var = "instance var"

# Lookup order demonstration
print(obj.instance_var)   # Step 2: instance __dict__
print(obj.class_var)      # Step 3: class __dict__ (non-data)
print(obj.method())       # Step 3: function descriptor __get__
```

### __getattr__ vs __getattribute__

```python
class SmartObject:
    def __init__(self):
        self.real = "I exist"

    def __getattribute__(self, name):
        """Called for EVERY attribute access — use with extreme care."""
        print(f"__getattribute__({name!r})")
        return super().__getattribute__(name)

    def __getattr__(self, name):
        """Called ONLY when normal lookup fails (AttributeError fallback)."""
        print(f"__getattr__({name!r}) — attribute not found normally")
        return f"dynamic_{name}"


obj = SmartObject()
print(obj.real)       # __getattribute__('real') → "I exist"
print(obj.missing)    # __getattribute__('missing') → AttributeError
                      # → __getattr__('missing') → "dynamic_missing"
```

### Full Lookup Chain Visualization

```
obj.attr
    │
    ▼
type(obj).__mro__ scan for DATA descriptor
    │ found?  → descriptor.__get__(obj, type(obj))
    │ not found?
    ▼
obj.__dict__.get('attr')
    │ found?  → return value
    │ not found?
    ▼
type(obj).__mro__ scan for NON-DATA descriptor or value
    │ found descriptor? → descriptor.__get__(obj, type(obj))
    │ found value?      → return value
    │ not found?
    ▼
__getattr__(name) if defined
    │ not defined?
    ▼
AttributeError
```

---

## 9. Performance Notes

- **Descriptor `__get__` is called on every attribute access** — keep it fast. Avoid I/O, complex computation, or locks in `__get__`.
- **`cached_property` is ~2x slower than a plain attribute** on first access (due to dict write), but subsequent accesses are as fast as a plain attribute (dict lookup).
- **`property` without caching** is called every time — if the computation is expensive, cache manually or use `cached_property`.
- **`__slots__` reduces memory by 40-60%** for objects with many instances. Also slightly faster attribute access (no dict lookup).
- **Non-data descriptors can be shadowed** by instance dict — this is the mechanism `cached_property` exploits for zero-overhead subsequent access.
- **Avoid `__getattribute__` overrides** — it's called on every single attribute access and can dramatically slow down code.

```python
import timeit

class WithProperty:
    @property
    def x(self): return self._x
    @x.setter
    def x(self, v): self._x = v
    def __init__(self): self._x = 0

class WithSlot:
    __slots__ = ('x',)
    def __init__(self): self.x = 0

class Plain:
    def __init__(self): self.x = 0

# Benchmark reads
for cls, name in [(Plain, 'plain'), (WithProperty, 'property'), (WithSlot, 'slot')]:
    obj = cls()
    t = timeit.timeit(lambda: obj.x, number=1_000_000)
    print(f"{name}: {t:.3f}s")
# Typical: plain ~0.05s, slot ~0.06s, property ~0.12s
```

---

## 10. Common Bugs

### Bug 1: Forgetting to handle obj=None in __get__

```python
# WRONG — crashes when accessed from class
class BadDescriptor:
    def __get__(self, obj, objtype=None):
        return obj.some_attr  # AttributeError when obj is None!

# CORRECT
class GoodDescriptor:
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self  # return descriptor itself for class access
        return obj.some_attr
```

### Bug 2: Storing state on the descriptor instead of the instance

```python
# WRONG — all instances share the same value!
class SharedDescriptor:
    def __get__(self, obj, objtype=None):
        if obj is None: return self
        return self.value  # stored on descriptor, shared!

    def __set__(self, obj, value):
        self.value = value  # BUG: overwrites for all instances

class MyClass:
    x = SharedDescriptor()

a, b = MyClass(), MyClass()
a.x = 1
b.x = 2
print(a.x)  # 2 — WRONG! Should be 1

# CORRECT — store on the instance
class CorrectDescriptor:
    def __set_name__(self, owner, name):
        self.storage = f'_{name}'

    def __get__(self, obj, objtype=None):
        if obj is None: return self
        return getattr(obj, self.storage, None)

    def __set__(self, obj, value):
        setattr(obj, self.storage, value)  # stored on instance
```

### Bug 3: cached_property with __slots__

```python
# cached_property needs __dict__ to cache values
# It DOESN'T work with __slots__ unless __dict__ is in slots

class Broken:
    __slots__ = ('_data',)  # no __dict__!

    @cached_property  # won't work!
    def computed(self):
        return expensive()

# Fix: add __dict__ to slots (defeats some memory savings)
class Fixed:
    __slots__ = ('_data', '__dict__')  # allow __dict__

    @cached_property
    def computed(self):
        return expensive()
```

### Bug 4: Descriptor not triggered via __dict__ direct access

```python
class Validated:
    def __set_name__(self, owner, name):
        self.name = f'_{name}'

    def __get__(self, obj, objtype=None):
        if obj is None: return self
        return obj.__dict__.get(self.name)

    def __set__(self, obj, value):
        if not isinstance(value, int):
            raise TypeError("Must be int")
        obj.__dict__[self.name] = value

class MyClass:
    x = Validated()

obj = MyClass()
obj.x = 42       # goes through descriptor ✅
obj.__dict__['_x'] = "not an int"  # bypasses descriptor! ❌
print(obj.x)     # "not an int" — validation bypassed
```

---

## 11. Interview Q&A

**Q1: What is the descriptor protocol, and what methods does it involve?**

A: The descriptor protocol is a set of special methods that, when defined on an object, allow it to customize attribute access on another object (its owner). The methods are: `__get__(self, obj, objtype)` for reads, `__set__(self, obj, value)` for writes, `__delete__(self, obj)` for deletion, and `__set_name__(self, owner, name)` called at class creation time. A descriptor must be a class attribute (not an instance attribute) to be invoked by the protocol.

---

**Q2: What is the difference between a data descriptor and a non-data descriptor?**

A: A data descriptor defines `__set__` (and optionally `__delete__`), while a non-data descriptor defines only `__get__`. The critical difference is priority: data descriptors take precedence over the instance `__dict__`, while non-data descriptors are shadowed by instance `__dict__` entries. `property` is a data descriptor (even without a setter — the setter raises `AttributeError`). Functions are non-data descriptors, which is why you can shadow a method with an instance attribute.

---

**Q3: How does `@property` work under the hood?**

A: `property` is a built-in data descriptor. When you write `@property def x(self): ...`, Python creates a `property` object stored as a class attribute. Its `__get__` calls the getter function, `__set__` calls the setter (or raises `AttributeError` if none), and `__delete__` calls the deleter. The `@x.setter` syntax calls `property.setter(fset)` which returns a new `property` object with the setter added. Because `property` defines `__set__`, it's a data descriptor and takes priority over instance `__dict__`.

---

**Q4: How do functions become bound methods?**

A: Functions implement the descriptor protocol with `__get__`. When you access `obj.method`, Python finds the function in the class `__dict__` and calls `function.__get__(obj, type(obj))`, which returns a bound method object. A bound method wraps the function and the instance, so calling it automatically passes `obj` as the first argument. When accessed from the class (`MyClass.method`), `__get__` is called with `obj=None` and returns the function itself (unbound in Python 3).

---

**Q5: Implement a descriptor that validates that a value is a positive integer.**

A:
```python
class PositiveInt:
    def __set_name__(self, owner, name):
        self.name = name
        self.private = f'_{name}'

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.private, 0)

    def __set__(self, obj, value):
        if not isinstance(value, int) or value <= 0:
            raise ValueError(f"{self.name} must be a positive integer, got {value!r}")
        setattr(obj, self.private, value)

class Order:
    quantity = PositiveInt()
    price_cents = PositiveInt()
```

---

**Q6: Why does `cached_property` work without a `__set__` method?**

A: `cached_property` is a non-data descriptor (only `__get__`, no `__set__`). On first access, `__get__` computes the value and writes it to the instance's `__dict__` under the same attribute name. On subsequent accesses, Python's attribute lookup finds the value in the instance `__dict__` before reaching the non-data descriptor (because instance dict beats non-data descriptors). So the descriptor is effectively bypassed after the first call — zero overhead for cached reads.

---

**Q7: What is `__set_name__` and why was it added?**

A: `__set_name__(self, owner, name)` is called on a descriptor when the class containing it is created, passing the owner class and the attribute name. Before Python 3.6, descriptors had to be told their name explicitly (e.g., `x = MyDescriptor('x')`) or use metaclasses to inject names. `__set_name__` eliminates this redundancy, allowing descriptors to know their own name automatically. This is essential for storing per-instance data under a unique key (e.g., `_x`) without hardcoding names.

---

**Q8: What happens to descriptors in subclasses?**

A: Descriptors defined in a base class are inherited by subclasses and work normally — the MRO search finds them in the base class `__dict__`. However, `__set_name__` is only called once, when the descriptor is first assigned to the base class. If a subclass overrides the attribute with a new descriptor, `__set_name__` is called again for the new descriptor. If a subclass overrides with a plain value, the descriptor is shadowed for that class and its instances.

---

**Q9: How do `__slots__` relate to descriptors?**

A: When you define `__slots__ = ('x', 'y')`, Python creates member descriptors (data descriptors) for each slot name on the class. These descriptors store data in a fixed-size array on the instance (not in `__dict__`), which is why `__slots__` saves memory. The member descriptors implement `__get__`, `__set__`, and `__delete__`. Because they're data descriptors, they take priority over any instance `__dict__` (which doesn't exist for slotted classes anyway).

---

**Q10: What is the attribute lookup order in Python, and how do descriptors fit in?**

A: Python's `object.__getattribute__` follows this order for `obj.attr`:
1. Search `type(obj).__mro__` for a **data descriptor** named `attr` → call its `__get__`
2. Check `obj.__dict__` for `attr` → return it directly
3. Search `type(obj).__mro__` for a **non-data descriptor** or plain class attribute → call `__get__` if descriptor, else return value
4. If nothing found, call `__getattr__` if defined, else raise `AttributeError`

Data descriptors win over instance dict; instance dict wins over non-data descriptors. This ordering is fundamental to how `property`, `classmethod`, `staticmethod`, `__slots__`, and `cached_property` all work.
