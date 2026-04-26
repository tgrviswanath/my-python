# Python Type Hints & mypy

## 1. Basic Type Hints

```python
# Variable annotations
name: str = "Alice"
age: int = 30
pi: float = 3.14159
active: bool = True

# Function annotations
def greet(name: str, times: int = 1) -> str:
    return (f"Hello, {name}! " * times).strip()

def add(a: int, b: int) -> int:
    return a + b

# No return value
def log(message: str) -> None:
    print(f"[LOG] {message}")

# Type hints are not enforced at runtime!
result = add("hello", "world")  # runs fine, but mypy would catch this
```

---

## 2. `Optional` and `Union`

```python
from typing import Optional, Union

# Optional[X] is equivalent to Union[X, None]
def find_user(user_id: int) -> Optional[str]:
    users = {1: "Alice", 2: "Bob"}
    return users.get(user_id)  # returns str or None

# Union — multiple types
def process(value: Union[int, str, float]) -> str:
    return str(value)

# Python 3.10+ syntax: X | Y (preferred)
def find_user_new(user_id: int) -> str | None:
    users = {1: "Alice", 2: "Bob"}
    return users.get(user_id)

def process_new(value: int | str | float) -> str:
    return str(value)

# Narrowing with isinstance
def handle(value: int | str) -> str:
    if isinstance(value, int):
        return f"Integer: {value * 2}"  # mypy knows it's int here
    return f"String: {value.upper()}"   # mypy knows it's str here
```

---

## 3. Collection Types

```python
from typing import List, Dict, Tuple, Set, FrozenSet, Sequence, Mapping

# Python 3.9+ can use built-in types directly
def process_items(items: list[int]) -> dict[str, int]:
    return {str(i): i for i in items}

# Older style (still valid)
def process_items_old(items: List[int]) -> Dict[str, int]:
    return {str(i): i for i in items}

# Tuple — fixed length and types
def get_point() -> tuple[int, int]:
    return (3, 4)

def get_rgb() -> tuple[int, int, int]:
    return (255, 128, 0)

# Variable-length tuple
def get_numbers() -> tuple[int, ...]:
    return (1, 2, 3, 4, 5)

# Sequence — read-only ordered collection
def first(items: Sequence[int]) -> int | None:
    return items[0] if items else None

# Mapping — read-only dict-like
def get_value(mapping: Mapping[str, int], key: str) -> int:
    return mapping.get(key, 0)
```

---

## 4. `TypeVar` and `Generic`

```python
from typing import TypeVar, Generic, Optional

T = TypeVar('T')
K = TypeVar('K')
V = TypeVar('V')

# Generic function — works with any type
def first(items: list[T]) -> T | None:
    return items[0] if items else None

result: str | None = first(["a", "b", "c"])  # T = str
result2: int | None = first([1, 2, 3])        # T = int

# Bounded TypeVar — T must be a subtype of Comparable
from typing import SupportsLessThan

CT = TypeVar('CT', bound='SupportsLessThan')

def maximum(items: list[CT]) -> CT:
    return max(items)

# Generic class
class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("Stack is empty")
        return self._items.pop()

    def peek(self) -> T | None:
        return self._items[-1] if self._items else None

    def __len__(self) -> int:
        return len(self._items)

# Type-safe usage
int_stack: Stack[int] = Stack()
int_stack.push(1)
int_stack.push(2)
value: int = int_stack.pop()  # mypy knows this is int

# Generic with multiple type parameters
class Pair(Generic[K, V]):
    def __init__(self, key: K, value: V) -> None:
        self.key = key
        self.value = value

    def swap(self) -> 'Pair[V, K]':
        return Pair(self.value, self.key)
```

---

## 5. `Protocol` — Structural Subtyping

```python
from typing import Protocol, runtime_checkable

# Protocol — duck typing with static type checking
class Drawable(Protocol):
    def draw(self) -> str: ...

class Resizable(Protocol):
    def resize(self, factor: float) -> None: ...

# Combined protocol
class DrawableResizable(Drawable, Resizable, Protocol):
    pass

# Classes don't need to inherit from Protocol
class Circle:
    def __init__(self, radius: float) -> None:
        self.radius = radius

    def draw(self) -> str:
        return f"Circle(r={self.radius})"

    def resize(self, factor: float) -> None:
        self.radius *= factor

class Square:
    def __init__(self, side: float) -> None:
        self.side = side

    def draw(self) -> str:
        return f"Square(s={self.side})"

    def resize(self, factor: float) -> None:
        self.side *= factor

def render(shape: Drawable) -> None:
    print(shape.draw())

render(Circle(5))   # works — Circle has draw()
render(Square(3))   # works — Square has draw()

# @runtime_checkable — enables isinstance checks
@runtime_checkable
class Sized(Protocol):
    def __len__(self) -> int: ...

print(isinstance([1, 2, 3], Sized))  # True
print(isinstance("hello", Sized))    # True
print(isinstance(42, Sized))         # False
```

---

## 6. `Literal` and `TypedDict`

```python
from typing import Literal, TypedDict, Required, NotRequired

# Literal — restrict to specific values
def set_direction(direction: Literal['north', 'south', 'east', 'west']) -> None:
    print(f"Going {direction}")

def get_status() -> Literal['active', 'inactive', 'pending']:
    return 'active'

# TypedDict — typed dictionary
class UserInfo(TypedDict):
    name: str
    age: int
    email: str

class UserInfoPartial(TypedDict, total=False):
    name: str
    age: int
    email: str

# Python 3.11+ — Required/NotRequired
class Config(TypedDict):
    host: Required[str]
    port: Required[int]
    debug: NotRequired[bool]  # optional

def process_user(user: UserInfo) -> str:
    return f"{user['name']} ({user['age']})"

user: UserInfo = {'name': 'Alice', 'age': 30, 'email': 'alice@example.com'}
print(process_user(user))
```

---

## 7. `overload` Decorator

```python
from typing import overload

# overload — different signatures for different argument types
@overload
def process(value: int) -> int: ...
@overload
def process(value: str) -> str: ...
@overload
def process(value: list[int]) -> list[int]: ...

def process(value):
    if isinstance(value, int):
        return value * 2
    elif isinstance(value, str):
        return value.upper()
    elif isinstance(value, list):
        return [x * 2 for x in value]
    raise TypeError(f"Unsupported type: {type(value)}")

# mypy knows the return type based on input type
result1: int = process(42)
result2: str = process("hello")
result3: list[int] = process([1, 2, 3])
```

---

## 8. `Any`, `Callable`, `Type`

```python
from typing import Any, Callable, Type

# Any — opt out of type checking
def legacy_function(data: Any) -> Any:
    return data

# Callable — function type
def apply(func: Callable[[int, int], int], a: int, b: int) -> int:
    return func(a, b)

# Callable with variable args
def call_with_logging(func: Callable[..., int]) -> int:
    result = func()
    print(f"Result: {result}")
    return result

# Type — the class itself (not an instance)
def create_instance(cls: Type[T], *args: Any) -> T:
    return cls(*args)

# ParamSpec (Python 3.10+) — preserve function signature
from typing import ParamSpec, Concatenate
import functools

P = ParamSpec('P')

def logged(func: Callable[P, T]) -> Callable[P, T]:
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper
```

---

## 9. mypy Basics

```bash
# Install mypy
pip install mypy

# Run mypy on a file
mypy myfile.py

# Run with strict mode
mypy --strict myfile.py

# Common mypy flags
mypy --ignore-missing-imports myfile.py
mypy --disallow-untyped-defs myfile.py
mypy --check-untyped-defs myfile.py
```

```python
# mypy configuration in pyproject.toml
# [tool.mypy]
# python_version = "3.11"
# strict = true
# ignore_missing_imports = true
# disallow_untyped_defs = true
# warn_return_any = true
# warn_unused_ignores = true

# Inline type: ignore comments
x: int = "hello"  # type: ignore[assignment]

# Type narrowing
from typing import assert_never

def handle_status(status: Literal['ok', 'error', 'pending']) -> str:
    if status == 'ok':
        return "Success"
    elif status == 'error':
        return "Failed"
    elif status == 'pending':
        return "Waiting"
    else:
        assert_never(status)  # mypy ensures all cases handled
```

---

## Interview Questions

**Q1: What are type hints and are they enforced at runtime?**

Answer: Type hints are annotations that describe the expected types of variables, function parameters, and return values. They are NOT enforced at runtime — Python ignores them during execution. They're used by static type checkers (mypy, pyright), IDEs for autocomplete and error detection, and documentation. You can use `isinstance()` for runtime type checking.

---

**Q2: What is the difference between `Optional[X]` and `X | None`?**

Answer: They're equivalent — `Optional[X]` is shorthand for `Union[X, None]`. The `X | None` syntax (Python 3.10+) is more concise and preferred in modern code. Both indicate a value can be either type `X` or `None`. Always use `Optional` or `| None` for nullable values — never just `X` when `None` is possible.

---

**Q3: What is `Protocol` and how does it differ from ABC?**

Answer: `Protocol` enables structural subtyping (duck typing with static analysis). A class satisfies a Protocol if it has the required methods/attributes — no explicit inheritance needed. ABCs require explicit inheritance (`class MyClass(MyABC)`). Protocols are better for: third-party classes you can't modify, expressing "anything with a `draw()` method", and avoiding tight coupling. Use `@runtime_checkable` to enable `isinstance()` checks.

---

**Q4: What is `TypeVar` and when do you use it?**

Answer: `TypeVar` creates a type variable for generic functions and classes. It allows you to express that the return type depends on the input type. Without `TypeVar`, you'd have to use `Any` and lose type safety. Use `TypeVar` when: a function returns the same type as its input, a container class should work with any type, or you need to express type relationships between parameters.

---

**Q5: What is the difference between `Sequence` and `List` in type hints?**

Answer: `List[T]` is a mutable list — you can append, remove, etc. `Sequence[T]` is a read-only ordered collection — it accepts lists, tuples, strings, and any other sequence. Use `Sequence` when your function only reads from the collection (more flexible). Use `List` when you need to mutate it. Similarly, use `Mapping` instead of `Dict` for read-only dict access.

---

**Q6: What is `TypedDict` and when should you use it?**

Answer: `TypedDict` creates a typed dictionary with specific key-value types. Use it when working with JSON-like data structures, API responses, or configuration dicts where you want type safety without creating a full class. It's lighter than a dataclass and works well with JSON serialization. Use `total=False` for optional keys, or `Required`/`NotRequired` (Python 3.11+) for mixed required/optional.

---

**Q7: What is `Literal` type and when is it useful?**

Answer: `Literal` restricts a value to specific literal values. Use it for: function parameters that accept only specific strings/ints (like `direction: Literal['north', 'south']`), return types that indicate specific states, and discriminated unions. mypy will catch invalid values at type-check time.

---

**Q8: What is `overload` and when do you need it?**

Answer: `@overload` lets you define multiple type signatures for a function that behaves differently based on argument types. The actual implementation uses a bare `def` without `@overload`. Use it when: a function returns different types based on input types, and you want mypy to infer the correct return type. Without `overload`, you'd have to use `Union` return types and lose precision.
