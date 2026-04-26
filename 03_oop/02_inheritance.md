# Python Inheritance — Comprehensive Guide

## 1. Single Inheritance

```python
class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound

    def speak(self):
        return f"{self.name} says {self.sound}"

    def __repr__(self):
        return f"{type(self).__name__}(name={self.name!r})"


class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, "Woof")   # call parent __init__
        self.breed = breed

    def fetch(self):
        return f"{self.name} fetches the ball!"

    # Method overriding
    def speak(self):
        return f"{self.name} barks: Woof woof!"


class Cat(Animal):
    def __init__(self, name, indoor=True):
        super().__init__(name, "Meow")
        self.indoor = indoor

    def speak(self):
        parent_speak = super().speak()   # call parent method
        return f"{parent_speak} (softly)"


dog = Dog("Rex", "German Shepherd")
cat = Cat("Whiskers")

dog.speak()    # "Rex barks: Woof woof!"
cat.speak()    # "Whiskers says Meow (softly)"
dog.fetch()    # "Rex fetches the ball!"

# Inheritance chain
isinstance(dog, Dog)     # True
isinstance(dog, Animal)  # True
issubclass(Dog, Animal)  # True
```

---

## 2. Multiple Inheritance

```python
class Flyable:
    def fly(self):
        return f"{self.name} is flying"

    def move(self):
        return "flying"


class Swimmable:
    def swim(self):
        return f"{self.name} is swimming"

    def move(self):
        return "swimming"


class Duck(Animal, Flyable, Swimmable):
    def __init__(self, name):
        super().__init__(name, "Quack")

    def move(self):
        return f"{self.name} can fly and swim"


duck = Duck("Donald")
duck.fly()    # "Donald is flying"
duck.swim()   # "Donald is swimming"
duck.move()   # "Donald can fly and swim"  — Duck's own method wins
```

---

## 3. MRO — Method Resolution Order (C3 Linearization)

Python uses the **C3 linearization algorithm** to determine the order in which base classes are searched when looking up a method.

```python
class A:
    def method(self):
        return "A"

class B(A):
    def method(self):
        return "B"

class C(A):
    def method(self):
        return "C"

class D(B, C):
    pass


D.mro()
# [<class 'D'>, <class 'B'>, <class 'C'>, <class 'A'>, <class 'object'>]

D().method()   # "B"  — B comes before C in MRO

# Diamond problem — A is only visited once
#     A
#    / \
#   B   C
#    \ /
#     D
```

### C3 Algorithm Rules
1. Start with the class itself.
2. Merge the MROs of base classes + the list of base classes.
3. At each step, take the first element that doesn't appear in the tail of any other list.
4. A class always appears before its parents.
5. If a class appears in multiple bases, it's visited in the order it first appears.

```python
# More complex example
class X: pass
class Y: pass
class Z: pass
class A(X, Y): pass
class B(Y, Z): pass
class C(A, B): pass

C.mro()
# [C, A, X, B, Y, Z, object]

# Verify with __mro__
print(C.__mro__)
```

---

## 4. `super()`

```python
class Base:
    def __init__(self, x):
        self.x = x
        print(f"Base.__init__({x})")

    def method(self):
        return "Base.method"


class Child(Base):
    def __init__(self, x, y):
        super().__init__(x)   # calls Base.__init__
        self.y = y
        print(f"Child.__init__({x}, {y})")

    def method(self):
        base_result = super().method()   # calls Base.method
        return f"Child.method -> {base_result}"


# super() with multiple inheritance — follows MRO
class A:
    def method(self):
        print("A.method")
        super().method()   # calls next in MRO, not necessarily object

class B:
    def method(self):
        print("B.method")
        super().method()

class C(A, B):
    def method(self):
        print("C.method")
        super().method()   # calls A.method (next in MRO)

# C.mro() = [C, A, B, object]
C().method()
# C.method
# A.method
# B.method
# Each super() call goes to the NEXT class in MRO, not the direct parent!
```

---

## 5. Method Overriding

```python
class Shape:
    def area(self):
        raise NotImplementedError("Subclasses must implement area()")

    def describe(self):
        return f"I am a {type(self).__name__} with area {self.area():.2f}"


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):   # override
        return self.width * self.height


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):   # override
        import math
        return math.pi * self.radius ** 2


r = Rectangle(4, 5)
c = Circle(3)

r.describe()   # "I am a Rectangle with area 20.00"
c.describe()   # "I am a Circle with area 28.27"

# Polymorphism
shapes = [Rectangle(3, 4), Circle(5), Rectangle(2, 7)]
total_area = sum(s.area() for s in shapes)
```

---

## 6. `isinstance()` and `issubclass()`

```python
class Animal: pass
class Dog(Animal): pass
class Cat(Animal): pass
class GoldenRetriever(Dog): pass

dog = Dog()
golden = GoldenRetriever()

# isinstance — checks instance type (including inheritance)
isinstance(dog, Dog)             # True
isinstance(dog, Animal)          # True
isinstance(dog, Cat)             # False
isinstance(golden, Dog)          # True
isinstance(golden, Animal)       # True

# isinstance with tuple — check against multiple types
isinstance(dog, (Dog, Cat))      # True — is it a Dog OR Cat?

# issubclass — checks class hierarchy
issubclass(Dog, Animal)          # True
issubclass(GoldenRetriever, Dog) # True
issubclass(GoldenRetriever, Animal)  # True
issubclass(Dog, Dog)             # True — a class is a subclass of itself
issubclass(Animal, Dog)          # False

# type() — exact type check (no inheritance)
type(dog) is Dog      # True
type(dog) is Animal   # False  — dog is NOT exactly an Animal
```

---

## 7. Mixins

Mixins are classes designed to add specific functionality to other classes through multiple inheritance. They typically:
- Don't stand alone (not meant to be instantiated directly)
- Add a specific, focused set of methods
- Don't call `super().__init__()` with arguments (or use `**kwargs`)

```python
class JSONMixin:
    """Mixin to add JSON serialization"""
    def to_json(self):
        import json
        return json.dumps(self.__dict__)

    @classmethod
    def from_json(cls, json_str):
        import json
        data = json.loads(json_str)
        obj = cls.__new__(cls)
        obj.__dict__.update(data)
        return obj


class LogMixin:
    """Mixin to add logging"""
    def log(self, message):
        import logging
        logging.info(f"{type(self).__name__}: {message}")


class ValidateMixin:
    """Mixin to add validation"""
    def validate(self):
        for field, validator in getattr(self, '_validators', {}).items():
            value = getattr(self, field, None)
            if not validator(value):
                raise ValueError(f"Invalid value for {field}: {value}")


class User(JSONMixin, LogMixin, ValidateMixin):
    _validators = {
        'age': lambda x: x is not None and x >= 0,
        'email': lambda x: x and '@' in x,
    }

    def __init__(self, name, age, email):
        self.name = name
        self.age = age
        self.email = email


user = User("Alice", 30, "alice@example.com")
user.to_json()    # '{"name": "Alice", "age": 30, "email": "alice@example.com"}'
user.validate()   # passes
user.log("created")
```

---

## 8. Abstract Base Classes (Preview)

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

    @abstractmethod
    def perimeter(self):
        pass

    def describe(self):
        return f"Area: {self.area()}, Perimeter: {self.perimeter()}"

# Shape()  # TypeError: Can't instantiate abstract class

class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side ** 2

    def perimeter(self):
        return 4 * self.side
```

---

## Interview Questions & Answers

**Q1: What is the MRO and why does Python use C3 linearization?**

Answer: MRO (Method Resolution Order) defines the order in which Python searches base classes when looking up a method. Python uses **C3 linearization** to handle multiple inheritance consistently. It guarantees:
1. A class always appears before its parents.
2. The order of base classes in the class definition is preserved.
3. Each class appears only once.

This solves the **diamond problem** — when a class inherits from two classes that share a common ancestor, the ancestor is only visited once.

```python
class D(B, C): pass
D.mro()  # [D, B, C, A, object]
```

---

**Q2: What does `super()` actually do?**

Answer: `super()` returns a proxy object that delegates method calls to the **next class in the MRO**, not necessarily the direct parent. This is crucial for cooperative multiple inheritance — each class in the chain calls `super()`, ensuring all classes in the MRO get a chance to run.

```python
# In Python 3, super() with no arguments is equivalent to:
# super(CurrentClass, self)
```

---

**Q3: What is the difference between `isinstance()` and `type()`?**

Answer:
- `isinstance(obj, cls)` returns True if obj is an instance of cls **or any subclass** — respects inheritance.
- `type(obj) is cls` returns True only if obj is **exactly** that type — ignores inheritance.

Prefer `isinstance()` in most cases because it's more flexible and Pythonic (duck typing).

---

**Q4: What is a mixin and how does it differ from regular inheritance?**

Answer: A mixin is a class that provides methods to be "mixed in" to other classes via multiple inheritance. Unlike regular base classes:
- Mixins are not meant to be instantiated alone.
- They add a specific, focused capability (logging, serialization, validation).
- They don't represent an "is-a" relationship.
- They're designed to be combined with other classes.

---

**Q5: What is the diamond problem and how does Python solve it?**

Answer: The diamond problem occurs when class D inherits from B and C, both of which inherit from A. Without a clear rule, it's ambiguous which A's method to call. Python solves it with C3 linearization — A appears only once in the MRO, after both B and C.

```python
#     A
#    / \
#   B   C
#    \ /
#     D
D.mro()  # [D, B, C, A, object]  — A visited once, after B and C
```

---

**Q6: When should you use `super().__init__()` vs calling the parent class directly?**

Answer: Always prefer `super().__init__()` because:
- It works correctly with multiple inheritance (follows MRO).
- Calling `ParentClass.__init__(self, ...)` directly breaks cooperative multiple inheritance.

```python
# Bad — breaks with multiple inheritance
class Dog(Animal):
    def __init__(self, name):
        Animal.__init__(self, name)  # hardcoded, breaks MRO

# Good
class Dog(Animal):
    def __init__(self, name):
        super().__init__(name)  # follows MRO
```

---

**Q7: What is method overriding and how does it relate to polymorphism?**

Answer: Method overriding is when a subclass provides its own implementation of a method defined in the parent class. Polymorphism means that the same method call on different objects produces different behavior based on the object's actual type. Together, they enable writing code that works with any object that has the expected interface.

```python
shapes = [Circle(5), Rectangle(3, 4), Triangle(3, 4, 5)]
for shape in shapes:
    print(shape.area())  # calls the correct area() for each type
```

---

**Q8: What is the difference between `__init__` and `__new__`?**

Answer:
- `__new__` creates the instance (allocates memory, returns the new object). Called first.
- `__init__` initializes the instance (sets attributes). Called after `__new__`.

You rarely need to override `__new__`. Use cases: implementing singletons, immutable types (like subclassing `int` or `str`), metaclasses.

```python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

---

**Q9: How does Python handle method resolution with `super()` in cooperative multiple inheritance?**

Answer: Each class in the MRO calls `super()`, which passes control to the next class in the MRO. This creates a chain where every class gets to run its method. The key is that `super()` doesn't call the direct parent — it calls the next class in the MRO of the **original** object's class.

```python
class A:
    def method(self):
        print("A"); super().method()

class B:
    def method(self):
        print("B"); super().method()

class C(A, B):
    def method(self):
        print("C"); super().method()

# C.mro() = [C, A, B, object]
C().method()  # prints: C, A, B
```

---

**Q10: What is the difference between `issubclass()` and checking `__bases__`?**

Answer:
- `issubclass(A, B)` checks the entire inheritance chain (transitive).
- `A.__bases__` only shows direct parent classes (not transitive).

```python
class A: pass
class B(A): pass
class C(B): pass

issubclass(C, A)   # True  — transitive
C.__bases__        # (<class 'B'>,)  — only direct parent
A in C.__bases__   # False
```
