# Python Metaclasses

## 1. `type()` as Metaclass

In Python, everything is an object — including classes. Classes are instances of `type`.

```python
# type() with 3 args creates a class dynamically
# type(name, bases, namespace)

MyClass = type('MyClass', (object,), {
    'class_var': 42,
    'greet': lambda self: f"Hello from {self.__class__.__name__}",
})

obj = MyClass()
print(obj.greet())       # Hello from MyClass
print(MyClass.class_var) # 42
print(type(MyClass))     # <class 'type'>

# Verify: classes are instances of type
class Foo:
    pass

print(type(Foo))         # <class 'type'>
print(type(Foo()))       # <class '__main__.Foo'>
print(isinstance(Foo, type))  # True

# The metaclass chain
print(type(type))        # <class 'type'> — type is its own metaclass!
print(type(object))      # <class 'type'>
```

---

## 2. `__new__` vs `__init__` in Metaclasses

```python
# __new__ creates the instance (or class)
# __init__ initializes it

class Meta(type):
    def __new__(mcs, name, bases, namespace):
        # Called when the class is CREATED
        print(f"Creating class: {name}")
        # Can modify namespace before class is created
        namespace['created_by'] = 'Meta'
        cls = super().__new__(mcs, name, bases, namespace)
        return cls

    def __init__(cls, name, bases, namespace):
        # Called after class is created
        print(f"Initializing class: {name}")
        super().__init__(name, bases, namespace)

class MyClass(metaclass=Meta):
    pass

# Output:
# Creating class: MyClass
# Initializing class: MyClass

print(MyClass.created_by)  # 'Meta'
```

---

## 3. Custom Metaclass

```python
class ValidatedMeta(type):
    """Metaclass that validates class attributes."""

    def __new__(mcs, name, bases, namespace):
        # Enforce: all methods must have docstrings
        for attr_name, attr_value in namespace.items():
            if callable(attr_value) and not attr_name.startswith('_'):
                if not attr_value.__doc__:
                    raise TypeError(
                        f"Method '{attr_name}' in class '{name}' must have a docstring"
                    )

        # Enforce: class must define 'version'
        if not attr_name.startswith('_') and 'version' not in namespace:
            namespace['version'] = '0.0.0'

        return super().__new__(mcs, name, bases, namespace)

class MyAPI(metaclass=ValidatedMeta):
    version = '1.0.0'

    def process(self, data):
        """Process the given data."""
        return data

# This would raise TypeError:
# class BadAPI(metaclass=ValidatedMeta):
#     def process(self, data):  # no docstring!
#         return data
```

---

## 4. `__init_subclass__`

A simpler alternative to metaclasses for customizing subclass creation.

```python
class Plugin:
    """Base class that tracks all subclasses."""
    _registry = {}

    def __init_subclass__(cls, plugin_name=None, **kwargs):
        super().__init_subclass__(**kwargs)
        name = plugin_name or cls.__name__.lower()
        Plugin._registry[name] = cls
        print(f"Registered plugin: {name} -> {cls.__name__}")

class JSONPlugin(Plugin, plugin_name='json'):
    def process(self, data):
        import json
        return json.dumps(data)

class CSVPlugin(Plugin, plugin_name='csv'):
    def process(self, data):
        return ','.join(str(x) for x in data)

class XMLPlugin(Plugin):  # uses class name
    def process(self, data):
        return f"<data>{data}</data>"

print(Plugin._registry)
# {'json': JSONPlugin, 'csv': CSVPlugin, 'xmlplugin': XMLPlugin}

# Factory function
def get_plugin(name):
    return Plugin._registry[name]()

plugin = get_plugin('json')
print(plugin.process({'key': 'value'}))
```

---

## 5. Class Decorators vs Metaclasses

```python
# Class decorator — simpler, preferred for most use cases
def add_repr(cls):
    """Add __repr__ to a class."""
    def __repr__(self):
        attrs = ', '.join(f'{k}={v!r}' for k, v in self.__dict__.items())
        return f"{cls.__name__}({attrs})"
    cls.__repr__ = __repr__
    return cls

@add_repr
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

p = Point(3, 4)
print(p)  # Point(x=3, y=4)

# When to use metaclass vs class decorator:
# - Class decorator: modify a single class, simple transformations
# - Metaclass: affect all subclasses, enforce class-level constraints,
#              modify class creation process itself

# Metaclass for the same effect (more powerful but complex)
class ReprMeta(type):
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        def __repr__(self):
            attrs = ', '.join(f'{k}={v!r}' for k, v in self.__dict__.items())
            return f"{name}({attrs})"
        cls.__repr__ = __repr__
        return cls
```

---

## 6. Singleton Pattern with Metaclass

```python
class SingletonMeta(type):
    """Metaclass that ensures only one instance per class."""
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class DatabaseConnection(metaclass=SingletonMeta):
    def __init__(self, url):
        self.url = url
        print(f"Creating connection to {url}")

    def query(self, sql):
        return f"Result of: {sql}"

# Only one instance created
db1 = DatabaseConnection("postgresql://localhost/mydb")
db2 = DatabaseConnection("postgresql://localhost/mydb")
print(db1 is db2)  # True — same instance!

# Thread-safe singleton
import threading

class ThreadSafeSingleton(type):
    _instances = {}
    _lock = threading.Lock()

    def __call__(cls, *args, **kwargs):
        with cls._lock:
            if cls not in cls._instances:
                cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]
```

---

## 7. Registry Pattern with Metaclass

```python
class RegistryMeta(type):
    """Metaclass that maintains a registry of all subclasses."""
    _registry = {}

    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        # Don't register the base class itself
        if bases:
            key = namespace.get('_type', name.lower())
            mcs._registry[key] = cls
        return cls

    @classmethod
    def get(mcs, name):
        return mcs._registry.get(name)

class Shape(metaclass=RegistryMeta):
    """Base shape class."""
    def area(self):
        raise NotImplementedError

class Circle(Shape):
    _type = 'circle'
    def __init__(self, radius):
        self.radius = radius
    def area(self):
        import math
        return math.pi * self.radius ** 2

class Rectangle(Shape):
    _type = 'rectangle'
    def __init__(self, width, height):
        self.width = width
        self.height = height
    def area(self):
        return self.width * self.height

# Factory using registry
def create_shape(shape_type, **kwargs):
    cls = RegistryMeta.get(shape_type)
    if cls is None:
        raise ValueError(f"Unknown shape: {shape_type}")
    return cls(**kwargs)

circle = create_shape('circle', radius=5)
rect = create_shape('rectangle', width=4, height=6)
print(f"Circle area: {circle.area():.2f}")
print(f"Rectangle area: {rect.area()}")
```

---

## Interview Questions

**Q1: What is a metaclass in Python?**

Answer: A metaclass is the class of a class — it defines how classes are created and behave. Just as objects are instances of classes, classes are instances of metaclasses. The default metaclass is `type`. When you define a class, Python calls the metaclass to create it. Metaclasses let you customize class creation: add/modify attributes, enforce constraints, register subclasses, or implement patterns like Singleton.

---

**Q2: What is the difference between `__new__` and `__init__` in a metaclass?**

Answer: In a metaclass, `__new__(mcs, name, bases, namespace)` is called first and creates the class object — it can modify the namespace before the class is created. `__init__(cls, name, bases, namespace)` is called after the class is created and can perform additional initialization. `__new__` is where you modify what the class will be; `__init__` is where you configure the already-created class.

---

**Q3: When should you use a metaclass vs a class decorator?**

Answer: Use a class decorator when you want to modify a single class after it's created — it's simpler and more readable. Use a metaclass when: you need to affect all subclasses automatically, you need to modify the class creation process itself (before the class exists), you need to intercept `__call__` (instance creation), or you're implementing framework-level features. In practice, `__init_subclass__` covers most metaclass use cases more simply.

---

**Q4: What is `__init_subclass__` and how does it compare to metaclasses?**

Answer: `__init_subclass__` is a class method called whenever the class is subclassed. It's a simpler alternative to metaclasses for customizing subclass creation. It receives the subclass as `cls` and any keyword arguments from the class definition. It's preferred over metaclasses for plugin registration, validation, and other subclass-level customization because it's simpler and avoids metaclass conflicts.

---

**Q5: How do you implement a Singleton using a metaclass?**

Answer: Override `__call__` in the metaclass to check if an instance already exists before creating a new one:

```python
class SingletonMeta(type):
    _instances = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]
```

`__call__` is invoked when you call `MyClass()` — it controls instance creation.

---

**Q6: What is the metaclass resolution order?**

Answer: Python determines the metaclass by: explicit `metaclass=` keyword, the metaclass of the first base class, or `type` as default. If multiple bases have different metaclasses, Python uses the most derived metaclass (the one that is a subclass of all others). Metaclass conflicts (two unrelated metaclasses) raise `TypeError`.

---

**Q7: What is the difference between `type.__new__` and `object.__new__`?**

Answer: `type.__new__` creates a new class object — it takes `(mcs, name, bases, namespace)` and returns a class. `object.__new__` creates a new instance of a class — it takes `(cls)` and returns an instance. When you define a class, Python calls `type.__new__` (or your metaclass's `__new__`). When you instantiate a class, Python calls `object.__new__` (or your class's `__new__`).

---

**Q8: How do you avoid metaclass conflicts when using multiple inheritance?**

Answer: Metaclass conflicts occur when two base classes have incompatible metaclasses. Solutions: create a combined metaclass that inherits from both, use `__init_subclass__` instead of metaclasses, or restructure the class hierarchy. The combined metaclass approach:

```python
class CombinedMeta(MetaA, MetaB):
    pass

class MyClass(ClassA, ClassB, metaclass=CombinedMeta):
    pass
```
