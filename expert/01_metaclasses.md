# Python Metaclasses — Expert Reference

## Table of Contents
1. [What Is a Metaclass?](#1-what-is-a-metaclass)
2. [type() as the Default Metaclass](#2-type-as-the-default-metaclass)
3. [__class__ vs type()](#3-__class__-vs-type)
4. [Custom Metaclasses](#4-custom-metaclasses)
5. [Metaclass Use Cases](#5-metaclass-use-cases)
6. [__init_subclass__ as a Simpler Alternative](#6-__init_subclass__-as-a-simpler-alternative)
7. [Class Decorators vs Metaclasses](#7-class-decorators-vs-metaclasses)
8. [Abstract Base Classes (ABCMeta)](#8-abstract-base-classes-abcmeta)
9. [Metaclass Conflict in Multiple Inheritance](#9-metaclass-conflict-in-multiple-inheritance)
10. [Performance Notes](#10-performance-notes)
11. [Common Bugs](#11-common-bugs)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What Is a Metaclass?

In Python, **everything is an object** — including classes. A metaclass is the class of a class. Just as an instance is created by its class, a class is created by its metaclass.

```
instance  ←  created by  →  class  ←  created by  →  metaclass
```

The default metaclass for all new-style classes is `type`. You can verify this:

```python
class Foo:
    pass

print(type(Foo))        # <class 'type'>
print(type(type))       # <class 'type'>  — type is its own metaclass
print(type(int))        # <class 'type'>
print(type(str))        # <class 'type'>
```

The metaclass chain:
- `object` is an instance of `type`
- `type` is a subclass of `object`
- `type` is an instance of itself

---

## 2. type() as the Default Metaclass

`type()` has two distinct call signatures:

### Single-argument form — inspect type
```python
type(42)          # <class 'int'>
type("hello")     # <class 'str'>
type(Foo())       # <class '__main__.Foo'>
```

### Three-argument form — create a class dynamically
```python
# type(name, bases, namespace_dict)
MyClass = type('MyClass', (object,), {
    'x': 42,
    'greet': lambda self: f"Hello, I am {self.__class__.__name__}"
})

obj = MyClass()
print(obj.x)        # 42
print(obj.greet())  # Hello, I am MyClass
```

This is exactly what Python does when it processes a `class` statement. The class body is executed as a code block, producing a namespace dict, then `type(name, bases, namespace)` is called.

### Step-by-step class creation
```python
# What Python does internally for:
# class Foo(Base):
#     x = 1

# 1. Determine metaclass (type by default)
# 2. Prepare namespace: namespace = type.__prepare__('Foo', (Base,))
# 3. Execute class body in namespace
# 4. Call: Foo = type('Foo', (Base,), namespace)
```

---

## 3. __class__ vs type()

```python
class Animal:
    pass

class Dog(Animal):
    pass

d = Dog()

print(type(d))          # <class '__main__.Dog'>
print(d.__class__)      # <class '__main__.Dog'>

# They are usually identical, but __class__ can be overridden:
class Trickster:
    @property
    def __class__(self):
        return int   # lie about our class

t = Trickster()
print(type(t))          # <class '__main__.Trickster'>  — always truthful
print(t.__class__)      # <class 'int'>                 — can be faked

# isinstance() uses __class__ first, then type()
print(isinstance(t, int))        # True  (because __class__ says int)
print(isinstance(t, Trickster))  # False (!)
```

**Rule of thumb**: Use `type()` when you need the real type. Use `isinstance()` for type checks in production code (respects inheritance). Avoid overriding `__class__`.

---

## 4. Custom Metaclasses

### 4.1 Basic Structure

```python
class Meta(type):
    # Called to create the class namespace (before class body executes)
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        print(f"__prepare__ called for {name}")
        namespace = super().__prepare__(name, bases, **kwargs)
        # Can return a custom dict-like object
        return namespace

    # Called to create the class object itself
    def __new__(mcs, name, bases, namespace, **kwargs):
        print(f"__new__ called for {name}")
        cls = super().__new__(mcs, name, bases, namespace)
        return cls

    # Called to initialize the class object after creation
    def __init__(cls, name, bases, namespace, **kwargs):
        print(f"__init__ called for {name}")
        super().__init__(name, bases, namespace)

    # Called when the class is used as a callable (to create instances)
    def __call__(cls, *args, **kwargs):
        print(f"Creating instance of {cls.__name__}")
        instance = super().__call__(*args, **kwargs)
        return instance


class MyClass(metaclass=Meta):
    x = 10

obj = MyClass()
```

### 4.2 Execution Order

When Python processes `class Foo(Base, metaclass=Meta): body`:

1. `Meta.__prepare__('Foo', (Base,))` → returns namespace dict
2. Class body executes, populating namespace
3. `Meta.__new__(Meta, 'Foo', (Base,), namespace)` → creates class object
4. `Meta.__init__(Foo, 'Foo', (Base,), namespace)` → initializes class
5. Name `Foo` is bound in the enclosing scope

When `Foo()` is called:
1. `Meta.__call__(Foo, ...)` → orchestrates instance creation
2. Inside: `Foo.__new__(Foo, ...)` → creates instance
3. Inside: `Foo.__init__(instance, ...)` → initializes instance

### 4.3 __prepare__ for Ordered Namespaces

```python
from collections import OrderedDict

class OrderedMeta(type):
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        return OrderedDict()  # preserves definition order

    def __new__(mcs, name, bases, namespace, **kwargs):
        cls = super().__new__(mcs, name, bases, dict(namespace))
        cls._field_order = list(namespace.keys())
        return cls

class Record(metaclass=OrderedMeta):
    first_name = None
    last_name = None
    age = None

print(Record._field_order)
# ['__module__', '__qualname__', 'first_name', 'last_name', 'age']
```

> **Note**: Since Python 3.7, regular dicts preserve insertion order, so `OrderedDict` in `__prepare__` is less necessary. But custom dict subclasses in `__prepare__` are still useful for intercepting attribute assignments.

---

## 5. Metaclass Use Cases

### 5.1 Singleton Pattern

```python
class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]


class Database(metaclass=SingletonMeta):
    def __init__(self, url: str):
        self.url = url
        print(f"Connecting to {url}")


db1 = Database("postgresql://localhost/mydb")
db2 = Database("postgresql://localhost/other")  # __init__ NOT called again
print(db1 is db2)   # True
print(db1.url)      # postgresql://localhost/mydb
```

### 5.2 Class Registry

```python
class PluginMeta(type):
    registry: dict = {}

    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        # Don't register the base class itself
        if bases:
            plugin_name = namespace.get('name', name.lower())
            mcs.registry[plugin_name] = cls
        return cls


class Plugin(metaclass=PluginMeta):
    """Base plugin class."""
    name = 'base'


class CSVPlugin(Plugin):
    name = 'csv'
    def process(self, data): return f"CSV: {data}"


class JSONPlugin(Plugin):
    name = 'json'
    def process(self, data): return f"JSON: {data}"


# Factory function using registry
def get_plugin(name: str) -> Plugin:
    cls = PluginMeta.registry.get(name)
    if cls is None:
        raise ValueError(f"Unknown plugin: {name}")
    return cls()


plugin = get_plugin('csv')
print(plugin.process("hello"))  # CSV: hello
print(PluginMeta.registry)
```

### 5.3 ORM-Style Field Validation

```python
class Field:
    def __init__(self, field_type, required=True):
        self.field_type = field_type
        self.required = required
        self.name = None  # set by metaclass

    def validate(self, value):
        if self.required and value is None:
            raise ValueError(f"Field '{self.name}' is required")
        if value is not None and not isinstance(value, self.field_type):
            raise TypeError(
                f"Field '{self.name}' expects {self.field_type.__name__}, "
                f"got {type(value).__name__}"
            )


class ModelMeta(type):
    def __new__(mcs, name, bases, namespace):
        fields = {}
        for key, value in namespace.items():
            if isinstance(value, Field):
                value.name = key
                fields[key] = value
        namespace['_fields'] = fields
        cls = super().__new__(mcs, name, bases, namespace)
        return cls


class Model(metaclass=ModelMeta):
    def __init__(self, **kwargs):
        for name, field in self._fields.items():
            value = kwargs.get(name)
            field.validate(value)
            setattr(self, name, value)

    def __repr__(self):
        attrs = ', '.join(
            f"{k}={getattr(self, k)!r}" for k in self._fields
        )
        return f"{self.__class__.__name__}({attrs})"


class User(Model):
    username = Field(str)
    age = Field(int)
    email = Field(str, required=False)


u = User(username="alice", age=30)
print(u)  # User(username='alice', age=30, email=None)

try:
    bad = User(username="bob", age="not-an-int")
except TypeError as e:
    print(e)  # Field 'age' expects int, got str
```

### 5.4 Attribute Validation Metaclass

```python
class ValidatedMeta(type):
    def __new__(mcs, name, bases, namespace):
        # Enforce that all public methods have docstrings
        for attr_name, attr_value in namespace.items():
            if callable(attr_value) and not attr_name.startswith('_'):
                if not attr_value.__doc__:
                    raise TypeError(
                        f"Method '{attr_name}' in class '{name}' "
                        f"must have a docstring"
                    )
        return super().__new__(mcs, name, bases, namespace)


class PublicAPI(metaclass=ValidatedMeta):
    def process(self):
        """Process the data."""
        pass

# This would raise TypeError:
# class BadAPI(metaclass=ValidatedMeta):
#     def process(self):  # no docstring!
#         pass
```

---

## 6. __init_subclass__ as a Simpler Alternative

`__init_subclass__` (Python 3.6+) is called on the base class whenever a subclass is created. It's simpler than a metaclass for many use cases.

```python
class Plugin:
    _registry = {}

    def __init_subclass__(cls, plugin_name=None, **kwargs):
        super().__init_subclass__(**kwargs)
        name = plugin_name or cls.__name__.lower()
        Plugin._registry[name] = cls
        print(f"Registered plugin: {name}")

    @classmethod
    def get(cls, name):
        return cls._registry[name]


class CSVPlugin(Plugin, plugin_name='csv'):
    def run(self): return "running CSV"


class JSONPlugin(Plugin, plugin_name='json'):
    def run(self): return "running JSON"


print(Plugin._registry)
p = Plugin.get('csv')()
print(p.run())  # running CSV
```

### When to use __init_subclass__ vs metaclass

| Feature | `__init_subclass__` | Metaclass |
|---|---|---|
| Simplicity | ✅ Simple | ❌ Complex |
| Modify class namespace before creation | ❌ No | ✅ Yes (`__prepare__`) |
| Intercept instance creation | ❌ No | ✅ Yes (`__call__`) |
| Custom `__prepare__` namespace | ❌ No | ✅ Yes |
| Works with existing metaclass | ✅ Yes | ⚠️ Conflict risk |
| Keyword arguments from class statement | ✅ Yes | ✅ Yes |

---

## 7. Class Decorators vs Metaclasses

Class decorators are applied after the class is created. They're simpler but less powerful.

```python
# Class decorator approach
def singleton(cls):
    instances = {}
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@singleton
class Config:
    def __init__(self):
        self.debug = False

c1 = Config()
c2 = Config()
print(c1 is c2)  # True
```

### Key Differences

```python
# Metaclass: affects ALL subclasses automatically
class TrackedMeta(type):
    def __new__(mcs, name, bases, ns):
        cls = super().__new__(mcs, name, bases, ns)
        print(f"Class created: {name}")
        return cls

class Base(metaclass=TrackedMeta): pass
class Child(Base): pass      # Also tracked automatically!
class GrandChild(Child): pass  # Also tracked!

# Decorator: must be applied to EACH class manually
@track
class Base: pass
@track
class Child(Base): pass  # Must remember to decorate
```

| Aspect | Class Decorator | Metaclass |
|---|---|---|
| Timing | After class creation | During class creation |
| Subclass inheritance | ❌ Not inherited | ✅ Inherited |
| Modify class body | ❌ Post-hoc only | ✅ Via `__prepare__` |
| Complexity | Low | High |
| Composability | ✅ Stack multiple | ⚠️ One metaclass |
| Replaces class | ✅ Can return different object | ❌ Must return class |

---

## 8. Abstract Base Classes (ABCMeta)

`ABCMeta` is a metaclass from the `abc` module that enables abstract classes.

```python
from abc import ABCMeta, abstractmethod, ABC

# Using ABCMeta directly
class Shape(metaclass=ABCMeta):
    @abstractmethod
    def area(self) -> float:
        """Return the area of the shape."""
        ...

    @abstractmethod
    def perimeter(self) -> float:
        """Return the perimeter."""
        ...

    def describe(self):
        return f"Area={self.area():.2f}, Perimeter={self.perimeter():.2f}"


# Using ABC convenience class (same thing)
class Shape2(ABC):
    @abstractmethod
    def area(self) -> float: ...


class Circle(Shape):
    def __init__(self, radius: float):
        self.radius = radius

    def area(self) -> float:
        import math
        return math.pi * self.radius ** 2

    def perimeter(self) -> float:
        import math
        return 2 * math.pi * self.radius


c = Circle(5)
print(c.describe())

# Cannot instantiate abstract class
try:
    s = Shape()
except TypeError as e:
    print(e)  # Can't instantiate abstract class Shape with abstract methods area, perimeter
```

### Virtual Subclasses

```python
from abc import ABC, abstractmethod

class Drawable(ABC):
    @abstractmethod
    def draw(self): ...

# Register a class that doesn't inherit from Drawable
class LegacyWidget:
    def draw(self):
        print("Drawing legacy widget")

Drawable.register(LegacyWidget)

w = LegacyWidget()
print(isinstance(w, Drawable))   # True
print(issubclass(LegacyWidget, Drawable))  # True
```

### __subclasshook__ for Custom isinstance Checks

```python
class Sized(ABC):
    @classmethod
    def __subclasshook__(cls, C):
        if cls is Sized:
            # Any class with __len__ is considered a Sized
            if any("__len__" in B.__dict__ for B in C.__mro__):
                return True
        return NotImplemented

print(isinstance([], Sized))    # True
print(isinstance({}, Sized))    # True
print(isinstance(42, Sized))    # False
```

---

## 9. Metaclass Conflict in Multiple Inheritance

Python requires that the metaclass of a derived class be a subclass of the metaclasses of all its bases.

```python
class MetaA(type):
    pass

class MetaB(type):
    pass

class A(metaclass=MetaA): pass
class B(metaclass=MetaB): pass

# This raises TypeError: metaclass conflict
# class C(A, B): pass
# TypeError: metaclass conflict: the metaclass of a derived class must be
# a (non-strict) subclass of the metaclasses of all its bases
```

### Resolution: Create a Combined Metaclass

```python
class MetaC(MetaA, MetaB):
    """Combined metaclass that satisfies both A and B."""
    pass

class C(A, B, metaclass=MetaC):
    pass

print(type(C))  # <class '__main__.MetaC'>
```

### Conflict with ABCMeta

```python
from abc import ABCMeta

class MyMeta(type):
    pass

# Conflict: MyMeta and ABCMeta are both metaclasses
# class Bad(metaclass=MyMeta, ABC): pass  # TypeError

# Solution: combine them
class MyABCMeta(MyMeta, ABCMeta):
    pass

from abc import abstractmethod

class GoodBase(metaclass=MyABCMeta):
    @abstractmethod
    def process(self): ...

class Concrete(GoodBase):
    def process(self):
        return "done"
```

---

## 10. Performance Notes

- **Metaclass overhead is at class creation time**, not at instance creation time. Once a class is created, using it is no different from a regular class.
- `__prepare__` returning a custom dict-like object can slow down class body execution if the custom dict has expensive `__setitem__`.
- Metaclass `__call__` intercepts every `ClassName()` call — keep it lean.
- For singleton patterns, the `_instances` dict lookup in `__call__` is O(1) but adds a small overhead per instantiation attempt.
- `__init_subclass__` is faster and simpler than metaclasses for registration patterns.
- Avoid deep metaclass hierarchies — they increase MRO complexity.

```python
import timeit

# Metaclass singleton vs module-level singleton
# Module-level is ~3x faster for instance "creation"
setup = """
class Meta(type):
    _inst = {}
    def __call__(cls, *a, **kw):
        if cls not in cls._inst:
            cls._inst[cls] = super().__call__(*a, **kw)
        return cls._inst[cls]

class S(metaclass=Meta):
    pass
"""
print(timeit.timeit("S()", setup=setup, number=1_000_000))
```

---

## 11. Common Bugs

### Bug 1: Forgetting to pass **kwargs through the chain

```python
# WRONG — kwargs from class statement are lost
class BadMeta(type):
    def __new__(mcs, name, bases, namespace, **kwargs):
        return super().__new__(mcs, name, bases, namespace)
        # Missing **kwargs in super().__new__ call — but type.__new__ doesn't
        # accept kwargs, so this is actually correct for __new__

# WRONG — __init__ must consume or pass kwargs
class BadMeta2(type):
    def __init__(cls, name, bases, namespace, my_param=None):
        super().__init__(name, bases, namespace)  # OK, type.__init__ takes no extra kwargs
        # But if you forget my_param, it silently disappears

# CORRECT pattern
class GoodMeta(type):
    def __new__(mcs, name, bases, namespace, **kwargs):
        kwargs.pop('my_param', None)  # consume before passing up
        return super().__new__(mcs, name, bases, namespace)

    def __init__(cls, name, bases, namespace, my_param=None, **kwargs):
        super().__init__(name, bases, namespace)
        cls._my_param = my_param
```

### Bug 2: Metaclass not inherited when using type() directly

```python
class Meta(type):
    pass

class Base(metaclass=Meta): pass

# This subclass correctly uses Meta
class Child(Base): pass
print(type(Child))  # <class '__main__.Meta'>  ✅

# But dynamic creation with type() bypasses Meta!
Dynamic = type('Dynamic', (Base,), {})
print(type(Dynamic))  # <class 'type'>  ❌ — should be Meta

# Fix: use the metaclass explicitly
Dynamic = Meta('Dynamic', (Base,), {})
print(type(Dynamic))  # <class '__main__.Meta'>  ✅
```

### Bug 3: Singleton metaclass shared across unrelated classes

```python
class SingletonMeta(type):
    _instances = {}  # Class-level dict shared by ALL metaclass instances

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class A(metaclass=SingletonMeta): pass
class B(metaclass=SingletonMeta): pass

# This works correctly because the dict key is `cls`
a1, a2 = A(), A()
b1, b2 = B(), B()
print(a1 is a2)  # True ✅
print(b1 is b2)  # True ✅
print(a1 is b1)  # False ✅
```

### Bug 4: __prepare__ return value ignored

```python
# WRONG: __prepare__ must be a classmethod
class BadMeta(type):
    def __prepare__(name, bases):  # Missing @classmethod and mcs
        return {}

# CORRECT
class GoodMeta(type):
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        return {}
```

---

## 12. Interview Q&A

**Q1: What is a metaclass in Python, and what is the default metaclass?**

A: A metaclass is the class of a class — it defines how classes themselves are created and behave. The default metaclass is `type`. When you write `class Foo: pass`, Python internally calls `type('Foo', (), {})`. You can verify this with `type(Foo)` which returns `<class 'type'>`. Every class in Python is an instance of `type` (or a subclass of it).

---

**Q2: What is the difference between `__new__` and `__init__` in a metaclass?**

A: In a metaclass, `__new__` creates and returns the class object itself, while `__init__` initializes it after creation. `__new__` receives the metaclass as its first argument (`mcs`) and must return the new class. `__init__` receives the already-created class (`cls`) and is used for post-creation setup. If you need to modify the class namespace or bases before the class object exists, use `__new__`. If you just need to set attributes on the class after creation, `__init__` is sufficient.

---

**Q3: What does `__prepare__` do and when would you use it?**

A: `__prepare__` is a classmethod on the metaclass called before the class body is executed. It returns the namespace dict (or dict-like object) that the class body will be executed in. Use cases: (1) returning an `OrderedDict` to track definition order, (2) returning a custom dict that intercepts `__setitem__` to validate or transform attributes as they're defined, (3) pre-populating the namespace with certain values. Since Python 3.7, regular dicts preserve insertion order, so `OrderedDict` is less needed, but custom namespace objects are still useful.

---

**Q4: How do you resolve a metaclass conflict in multiple inheritance?**

A: When class `C` inherits from `A` (metaclass `MetaA`) and `B` (metaclass `MetaB`), Python requires the metaclass of `C` to be a subclass of both `MetaA` and `MetaB`. The solution is to create a combined metaclass: `class MetaC(MetaA, MetaB): pass` and then declare `class C(A, B, metaclass=MetaC): pass`. Python will raise `TypeError: metaclass conflict` if you don't resolve this explicitly.

---

**Q5: When would you use a metaclass vs `__init_subclass__` vs a class decorator?**

A: 
- **Metaclass**: When you need to intercept class creation at the deepest level — modifying the namespace before the class body runs (`__prepare__`), intercepting instance creation (`__call__`), or when the behavior must be inherited by all subclasses automatically.
- **`__init_subclass__`**: When you need to react to subclass creation (registration, validation) but don't need to modify the namespace. Simpler and avoids metaclass conflicts.
- **Class decorator**: When you need to transform a class after creation, and the transformation doesn't need to be inherited. Can return a completely different object. Easier to compose (stack multiple decorators).

---

**Q6: How is `ABCMeta` implemented, and how does `@abstractmethod` work?**

A: `ABCMeta` is a metaclass that overrides `__new__` to collect all methods decorated with `@abstractmethod` into a `__abstractmethods__` frozenset on the class. The `@abstractmethod` decorator simply sets `func.__isabstractmethod__ = True`. `ABCMeta.__new__` scans the namespace and bases for methods with `__isabstractmethod__ = True` and stores them. `type.__call__` (which creates instances) checks if `cls.__abstractmethods__` is non-empty and raises `TypeError` if so, preventing instantiation of abstract classes.

---

**Q7: Can you implement a thread-safe singleton using a metaclass?**

A:
```python
import threading

class ThreadSafeSingletonMeta(type):
    _instances = {}
    _lock = threading.Lock()

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            with cls._lock:
                # Double-checked locking
                if cls not in cls._instances:
                    cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]
```
The double-checked locking pattern avoids acquiring the lock on every call after the instance is created, while still being thread-safe during initial creation.

---

**Q8: What is the MRO (Method Resolution Order) for metaclasses?**

A: Metaclasses follow the same C3 linearization MRO as regular classes. When Python looks up an attribute on a class, it searches: the class itself, then its metaclass chain (not the class's MRO). For instance attribute lookup on a class `C`, Python uses `type(C).__mro__` (the metaclass MRO). This is why metaclass methods like `__call__` are found on `type` — it's in the metaclass MRO. The class's own `__mro__` is used for instance attribute lookup on instances of that class.

---

**Q9: How does Python determine which metaclass to use for a class?**

A: Python uses this algorithm:
1. If `metaclass` keyword is explicitly provided, use it.
2. Otherwise, if there are base classes, use the "most derived" metaclass among all base class metaclasses (the one that is a subclass of all others).
3. Otherwise, use `type`.

If no single metaclass is the most derived (i.e., there's a conflict), Python raises `TypeError`. This is why combining metaclasses requires explicit resolution.

---

**Q10: What are the practical risks of using metaclasses in production code?**

A: 
1. **Complexity**: Metaclasses are hard to understand and debug. Future maintainers may not be familiar with them.
2. **Metaclass conflicts**: Using multiple libraries that each define metaclasses can cause conflicts that are hard to resolve.
3. **Performance**: While class creation overhead is minimal, metaclass `__call__` runs on every instantiation.
4. **Debugging difficulty**: Stack traces involving metaclasses are harder to read.
5. **Testing**: Classes with metaclasses can be harder to mock or patch.
6. **Alternatives exist**: Most metaclass use cases can be handled by `__init_subclass__`, class decorators, or `__class_getitem__`. The Python core developers themselves recommend using metaclasses only when truly necessary.
