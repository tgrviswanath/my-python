# Python Design Patterns

## 1. Creational Patterns

### Singleton

```python
class SingletonMeta(type):
    _instances = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Config(metaclass=SingletonMeta):
    def __init__(self):
        self.settings = {}

    def set(self, key, value):
        self.settings[key] = value

    def get(self, key, default=None):
        return self.settings.get(key, default)

c1 = Config()
c2 = Config()
print(c1 is c2)  # True

# Alternative: module-level singleton (Pythonic)
# config.py — the module itself is a singleton
```

### Factory Method

```python
from abc import ABC, abstractmethod

class Animal(ABC):
    @abstractmethod
    def speak(self) -> str: ...

    @abstractmethod
    def move(self) -> str: ...

class Dog(Animal):
    def speak(self): return "Woof!"
    def move(self): return "Running"

class Cat(Animal):
    def speak(self): return "Meow!"
    def move(self): return "Sneaking"

class Bird(Animal):
    def speak(self): return "Tweet!"
    def move(self): return "Flying"

# Factory function
def create_animal(animal_type: str) -> Animal:
    animals = {'dog': Dog, 'cat': Cat, 'bird': Bird}
    cls = animals.get(animal_type.lower())
    if cls is None:
        raise ValueError(f"Unknown animal: {animal_type}")
    return cls()

# Factory class
class AnimalFactory:
    _registry = {}

    @classmethod
    def register(cls, name):
        def decorator(animal_cls):
            cls._registry[name] = animal_cls
            return animal_cls
        return decorator

    @classmethod
    def create(cls, name, **kwargs):
        if name not in cls._registry:
            raise ValueError(f"Unknown: {name}")
        return cls._registry[name](**kwargs)

@AnimalFactory.register('dog')
class RegisteredDog(Animal):
    def speak(self): return "Woof!"
    def move(self): return "Running"

dog = AnimalFactory.create('dog')
```

### Builder

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class QueryBuilder:
    """Fluent interface for building SQL queries."""
    _table: str = ''
    _conditions: list = field(default_factory=list)
    _columns: list = field(default_factory=list)
    _order_by: Optional[str] = None
    _limit: Optional[int] = None
    _offset: Optional[int] = None

    def select(self, *columns):
        self._columns = list(columns)
        return self

    def from_table(self, table):
        self._table = table
        return self

    def where(self, condition):
        self._conditions.append(condition)
        return self

    def order_by(self, column, direction='ASC'):
        self._order_by = f"{column} {direction}"
        return self

    def limit(self, n):
        self._limit = n
        return self

    def offset(self, n):
        self._offset = n
        return self

    def build(self):
        cols = ', '.join(self._columns) if self._columns else '*'
        query = f"SELECT {cols} FROM {self._table}"
        if self._conditions:
            query += " WHERE " + " AND ".join(self._conditions)
        if self._order_by:
            query += f" ORDER BY {self._order_by}"
        if self._limit:
            query += f" LIMIT {self._limit}"
        if self._offset:
            query += f" OFFSET {self._offset}"
        return query

query = (QueryBuilder()
    .select('id', 'name', 'email')
    .from_table('users')
    .where('age > 18')
    .where('active = true')
    .order_by('name')
    .limit(10)
    .offset(20)
    .build())

print(query)
# SELECT id, name, email FROM users WHERE age > 18 AND active = true ORDER BY name ASC LIMIT 10 OFFSET 20
```

---

## 2. Structural Patterns

### Decorator

```python
import functools
import time
import logging

# Function decorator
def retry(max_attempts=3, delay=1.0, exceptions=(Exception,)):
    """Retry a function on failure."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts - 1:
                        raise
                    print(f"Attempt {attempt + 1} failed: {e}. Retrying...")
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.1, exceptions=(ConnectionError,))
def fetch_data(url):
    # Simulate flaky network
    import random
    if random.random() < 0.5:
        raise ConnectionError("Network error")
    return f"Data from {url}"

# Class decorator
def singleton(cls):
    instances = {}
    @functools.wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@singleton
class Database:
    def __init__(self, url):
        self.url = url
        print(f"Connecting to {url}")
```

### Adapter

```python
# Adapter — make incompatible interfaces work together

class OldPaymentSystem:
    """Legacy payment system with old interface."""
    def make_payment(self, amount_cents, currency_code):
        return f"Paid {amount_cents} cents in {currency_code}"

class NewPaymentInterface:
    """New interface expected by the application."""
    def pay(self, amount: float, currency: str) -> bool:
        raise NotImplementedError

class PaymentAdapter(NewPaymentInterface):
    """Adapts OldPaymentSystem to NewPaymentInterface."""
    def __init__(self, old_system: OldPaymentSystem):
        self._old = old_system

    def pay(self, amount: float, currency: str) -> bool:
        amount_cents = int(amount * 100)
        result = self._old.make_payment(amount_cents, currency.upper())
        print(result)
        return True

# Usage
old_system = OldPaymentSystem()
adapter = PaymentAdapter(old_system)
adapter.pay(9.99, 'usd')  # works with new interface
```

### Facade

```python
# Facade — simplified interface to a complex subsystem

class VideoEncoder:
    def encode(self, file, format): return f"Encoded {file} to {format}"

class AudioExtractor:
    def extract(self, file): return f"Extracted audio from {file}"

class ThumbnailGenerator:
    def generate(self, file, time): return f"Thumbnail at {time}s"

class MetadataReader:
    def read(self, file): return {'duration': 120, 'fps': 30}

class VideoProcessingFacade:
    """Simplified interface to the video processing subsystem."""
    def __init__(self):
        self._encoder = VideoEncoder()
        self._audio = AudioExtractor()
        self._thumbnail = ThumbnailGenerator()
        self._metadata = MetadataReader()

    def process_video(self, input_file, output_format='mp4'):
        """One-call video processing."""
        metadata = self._metadata.read(input_file)
        audio = self._audio.extract(input_file)
        encoded = self._encoder.encode(input_file, output_format)
        thumbnail = self._thumbnail.generate(input_file, metadata['duration'] // 2)
        return {
            'encoded': encoded,
            'audio': audio,
            'thumbnail': thumbnail,
            'metadata': metadata
        }

facade = VideoProcessingFacade()
result = facade.process_video('movie.avi')
print(result)
```

---

## 3. Behavioral Patterns

### Observer

```python
from abc import ABC, abstractmethod
from typing import Any

class Observer(ABC):
    @abstractmethod
    def update(self, event: str, data: Any) -> None: ...

class EventEmitter:
    """Observable — notifies observers of events."""
    def __init__(self):
        self._listeners: dict[str, list[Observer]] = {}

    def on(self, event: str, observer: Observer) -> None:
        self._listeners.setdefault(event, []).append(observer)

    def off(self, event: str, observer: Observer) -> None:
        if event in self._listeners:
            self._listeners[event].remove(observer)

    def emit(self, event: str, data: Any = None) -> None:
        for observer in self._listeners.get(event, []):
            observer.update(event, data)

class Logger(Observer):
    def update(self, event, data):
        print(f"[LOG] {event}: {data}")

class EmailNotifier(Observer):
    def update(self, event, data):
        print(f"[EMAIL] Sending notification for {event}: {data}")

class UserService(EventEmitter):
    def create_user(self, name, email):
        user = {'name': name, 'email': email, 'id': 1}
        self.emit('user.created', user)
        return user

service = UserService()
service.on('user.created', Logger())
service.on('user.created', EmailNotifier())
service.create_user('Alice', 'alice@example.com')
```

### Strategy

```python
from abc import ABC, abstractmethod
from typing import Protocol

class SortStrategy(Protocol):
    def sort(self, data: list) -> list: ...

class BubbleSortStrategy:
    def sort(self, data):
        data = data[:]
        n = len(data)
        for i in range(n):
            for j in range(0, n-i-1):
                if data[j] > data[j+1]:
                    data[j], data[j+1] = data[j+1], data[j]
        return data

class QuickSortStrategy:
    def sort(self, data):
        if len(data) <= 1:
            return data
        pivot = data[len(data) // 2]
        left = [x for x in data if x < pivot]
        middle = [x for x in data if x == pivot]
        right = [x for x in data if x > pivot]
        return self.sort(left) + middle + self.sort(right)

class PythonSortStrategy:
    def sort(self, data):
        return sorted(data)

class Sorter:
    def __init__(self, strategy: SortStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: SortStrategy):
        self._strategy = strategy

    def sort(self, data):
        return self._strategy.sort(data)

data = [3, 1, 4, 1, 5, 9, 2, 6]
sorter = Sorter(PythonSortStrategy())
print(sorter.sort(data))

sorter.set_strategy(QuickSortStrategy())
print(sorter.sort(data))
```

### Command

```python
from abc import ABC, abstractmethod
from typing import Optional

class Command(ABC):
    @abstractmethod
    def execute(self) -> None: ...

    @abstractmethod
    def undo(self) -> None: ...

class TextEditor:
    def __init__(self):
        self.text = ""

    def insert(self, text, position):
        self.text = self.text[:position] + text + self.text[position:]

    def delete(self, position, length):
        deleted = self.text[position:position + length]
        self.text = self.text[:position] + self.text[position + length:]
        return deleted

class InsertCommand(Command):
    def __init__(self, editor, text, position):
        self.editor = editor
        self.text = text
        self.position = position

    def execute(self):
        self.editor.insert(self.text, self.position)

    def undo(self):
        self.editor.delete(self.position, len(self.text))

class CommandHistory:
    def __init__(self):
        self._history = []
        self._redo_stack = []

    def execute(self, command: Command):
        command.execute()
        self._history.append(command)
        self._redo_stack.clear()

    def undo(self):
        if self._history:
            command = self._history.pop()
            command.undo()
            self._redo_stack.append(command)

editor = TextEditor()
history = CommandHistory()

history.execute(InsertCommand(editor, "Hello", 0))
history.execute(InsertCommand(editor, " World", 5))
print(editor.text)  # "Hello World"

history.undo()
print(editor.text)  # "Hello"
```

### Iterator

```python
class Range:
    """Custom iterator — like Python's range()."""
    def __init__(self, start, stop, step=1):
        self.start = start
        self.stop = stop
        self.step = step

    def __iter__(self):
        return RangeIterator(self.start, self.stop, self.step)

class RangeIterator:
    def __init__(self, start, stop, step):
        self.current = start
        self.stop = stop
        self.step = step

    def __iter__(self):
        return self

    def __next__(self):
        if (self.step > 0 and self.current >= self.stop) or \
           (self.step < 0 and self.current <= self.stop):
            raise StopIteration
        value = self.current
        self.current += self.step
        return value

for x in Range(0, 10, 2):
    print(x, end=' ')  # 0 2 4 6 8
```

---

## 4. Python-Specific Patterns

### Context Manager Pattern

```python
from contextlib import contextmanager
import time

@contextmanager
def timer(label=''):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.4f}s")

@contextmanager
def transaction(db):
    db.begin()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
```

### Descriptor Pattern

```python
class Validated:
    """Reusable validation descriptor."""
    def __set_name__(self, owner, name):
        self.name = name
        self.private = f'_{name}'

    def __get__(self, obj, objtype=None):
        if obj is None: return self
        return getattr(obj, self.private, None)

    def __set__(self, obj, value):
        setattr(obj, self.private, self.validate(value))

    def validate(self, value):
        return value

class PositiveInt(Validated):
    def validate(self, value):
        if not isinstance(value, int) or value <= 0:
            raise ValueError(f"'{self.name}' must be a positive int")
        return value
```

---

## Interview Questions

**Q1: What is the Singleton pattern and how do you implement it in Python?**

Answer: Singleton ensures only one instance of a class exists. In Python: use a metaclass overriding `__call__`, a class variable, or simply a module (modules are singletons by nature). The metaclass approach is most robust for class-based singletons. For most use cases, a module-level instance is the Pythonic approach.

---

**Q2: What is the difference between Factory Method and Abstract Factory?**

Answer: Factory Method defines an interface for creating one type of object, with subclasses deciding which class to instantiate. Abstract Factory provides an interface for creating families of related objects. Factory Method is about one product; Abstract Factory is about multiple related products (e.g., a UI factory that creates buttons AND checkboxes for a specific OS theme).

---

**Q3: What is the Observer pattern and how does Python's event system relate to it?**

Answer: Observer defines a one-to-many dependency — when one object changes state, all dependents are notified. Python's `signal` module, Django's signals, and event-driven frameworks all implement this pattern. The key components are: Subject (emitter), Observer (listener), and the notification mechanism. Python's `__setattr__` and descriptors can also implement reactive/observable properties.

---

**Q4: What is the Strategy pattern and how does Python's duck typing simplify it?**

Answer: Strategy defines a family of algorithms, encapsulates each one, and makes them interchangeable. In Python, duck typing means you don't need an abstract base class — any object with the right method works as a strategy. You can even use plain functions as strategies (they're first-class objects). This makes Strategy much simpler in Python than in Java/C++.

---

**Q5: What is the Decorator pattern vs Python's `@decorator` syntax?**

Answer: The Decorator design pattern wraps an object to add behavior while maintaining the same interface. Python's `@decorator` syntax is a language feature that applies a function to another function/class. They're related but different: Python decorators can implement the Decorator pattern, but they're more general — they can also implement Singleton, memoization, logging, etc. Python decorators are functions that take and return callables.

---

**Q6: What is the Command pattern and what problems does it solve?**

Answer: Command encapsulates a request as an object, allowing: parameterization of operations, queuing/logging of requests, and undo/redo functionality. In Python, simple functions or lambdas often replace Command objects for basic use cases. The full pattern is valuable when you need undo/redo, transaction logs, or deferred execution.

---

**Q7: What is the Builder pattern and when is it useful?**

Answer: Builder separates the construction of a complex object from its representation, allowing the same construction process to create different representations. Use it when: an object has many optional parameters (avoids telescoping constructors), construction involves multiple steps, or you want a fluent interface. Python's `dataclass` with keyword arguments often replaces Builder for simple cases.

---

**Q8: What is the Adapter pattern?**

Answer: Adapter converts the interface of a class into another interface that clients expect. Use it when: integrating legacy code with new code, using third-party libraries with incompatible interfaces, or making classes work together that couldn't otherwise. In Python, you can also use monkey-patching or `__getattr__` for simple adaptation.

---

**Q9: What is the Facade pattern?**

Answer: Facade provides a simplified interface to a complex subsystem. It doesn't add new functionality — it makes the subsystem easier to use. Use it when: a subsystem has many classes and complex interactions, you want to layer your subsystem, or you want to decouple clients from implementation details.

---

**Q10: What is the difference between Composition and Inheritance for implementing patterns?**

Answer: Inheritance creates tight coupling — subclasses depend on parent implementation details. Composition ("has-a" vs "is-a") is more flexible — you can change behavior at runtime by swapping components. Most design patterns favor composition over inheritance. In Python, duck typing and protocols make composition even more powerful — you don't need interfaces to compose behaviors.
