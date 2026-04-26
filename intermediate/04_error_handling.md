# 04 — Error Handling & Exceptions

## Exception Hierarchy

```
BaseException
├── SystemExit
├── KeyboardInterrupt
├── GeneratorExit
└── Exception
    ├── ArithmeticError (ZeroDivisionError, OverflowError)
    ├── LookupError (IndexError, KeyError)
    ├── ValueError
    ├── TypeError
    ├── AttributeError
    ├── NameError
    ├── IOError / OSError
    ├── RuntimeError
    └── StopIteration
```

## try / except / else / finally

```python
try:
    result = risky_operation()
except ValueError as e:
    print(f"Value error: {e}")
except (TypeError, AttributeError) as e:
    print(f"Type/Attr error: {e}")
except Exception as e:
    print(f"Unexpected: {e}")
    raise   # re-raise
else:
    # runs only if NO exception was raised
    print(f"Success: {result}")
finally:
    # ALWAYS runs — cleanup
    cleanup()
```

## Raising Exceptions

```python
def divide(a, b):
    if b == 0:
        raise ValueError(f"Cannot divide {a} by zero")
    return a / b

# Raise from another exception (chaining)
try:
    int("abc")
except ValueError as e:
    raise RuntimeError("Config parse failed") from e

# Suppress chaining
raise RuntimeError("Failed") from None
```

## Custom Exceptions

```python
class AppError(Exception):
    """Base exception for this application."""

class ValidationError(AppError):
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"Validation failed for '{field}': {message}")

class NotFoundError(AppError):
    def __init__(self, resource: str, id_: int):
        super().__init__(f"{resource} with id={id_} not found")
        self.resource = resource
        self.id = id_

# Usage
try:
    raise ValidationError("email", "invalid format")
except ValidationError as e:
    print(e.field, e.message)
```

## Exception Groups (Python 3.11+)

```python
# Raise multiple exceptions at once
try:
    raise ExceptionGroup("multiple errors", [
        ValueError("bad value"),
        TypeError("bad type"),
    ])
except* ValueError as eg:
    print(f"ValueError(s): {eg.exceptions}")
except* TypeError as eg:
    print(f"TypeError(s): {eg.exceptions}")
```

## Context Managers for Error Handling

```python
from contextlib import suppress, contextmanager

# Suppress specific exceptions
with suppress(FileNotFoundError):
    os.remove('nonexistent.txt')

# contextmanager
@contextmanager
def managed_resource():
    resource = acquire()
    try:
        yield resource
    except SomeError:
        rollback(resource)
        raise
    finally:
        release(resource)
```

## Interview Questions

### Q1: What is the difference between `except Exception` and `except BaseException`?
**Answer:**
- `Exception` catches most errors but NOT `SystemExit`, `KeyboardInterrupt`, `GeneratorExit`
- `BaseException` catches everything including those system-level exceptions

```python
# Good — lets Ctrl+C work
try:
    ...
except Exception as e:
    log(e)

# Bad — catches Ctrl+C, prevents program exit
try:
    ...
except BaseException as e:  # avoid this
    log(e)
```

### Q2: When does `finally` NOT run?
**Answer:**
`finally` almost always runs, but there are edge cases:
- `os._exit()` — bypasses Python cleanup entirely
- Power failure / process kill (`SIGKILL`)
- Infinite loop in `except` block
- Interpreter crash

### Q3: What is exception chaining (`raise X from Y`)?
**Answer:**
```python
try:
    int("abc")
except ValueError as e:
    raise RuntimeError("Config failed") from e
    # Shows: "The above exception was the direct cause of..."

raise RuntimeError("Failed") from None
# Suppresses the original exception context
```

### Q4: How do you create a hierarchy of custom exceptions?
**Answer:**
```python
class AppError(Exception):
    """Base — catch all app errors with except AppError"""

class DatabaseError(AppError):
    pass

class ConnectionError(DatabaseError):
    pass

class QueryError(DatabaseError):
    pass

# Catch all DB errors
try:
    ...
except DatabaseError as e:
    handle_db_error(e)
```

### Q5: What is the `else` clause in try/except?
**Answer:**
The `else` block runs only when **no exception** was raised in the `try` block. It's cleaner than putting success code in `try` (which might accidentally catch exceptions from the success code).

```python
try:
    result = parse(data)
except ParseError:
    handle_error()
else:
    # Only runs if parse() succeeded
    save(result)   # exceptions here are NOT caught by except above
finally:
    cleanup()
```
