# Python Exceptions

## 1. try / except / else / finally

```python
def divide(a, b):
    try:
        result = a / b          # code that might raise
    except ZeroDivisionError:
        print("Cannot divide by zero")
        return None
    except TypeError as e:
        print(f"Type error: {e}")
        return None
    else:
        # Runs ONLY if no exception was raised in try
        print(f"Success: {result}")
        return result
    finally:
        # ALWAYS runs — cleanup code
        print("divide() completed")

divide(10, 2)   # Success: 5.0 → divide() completed
divide(10, 0)   # Cannot divide by zero → divide() completed
```

### Multiple Exceptions

```python
try:
    value = int(input("Enter number: "))
    result = 100 / value
except (ValueError, ZeroDivisionError) as e:
    print(f"Error: {e}")
except Exception as e:
    print(f"Unexpected error: {type(e).__name__}: {e}")
    raise  # re-raise the exception
```

---

## 2. Exception Hierarchy

```
BaseException
├── SystemExit
├── KeyboardInterrupt
├── GeneratorExit
└── Exception
    ├── ArithmeticError
    │   ├── ZeroDivisionError
    │   ├── OverflowError
    │   └── FloatingPointError
    ├── LookupError
    │   ├── IndexError
    │   └── KeyError
    ├── ValueError
    ├── TypeError
    ├── AttributeError
    ├── NameError
    ├── OSError (IOError, EnvironmentError)
    │   ├── FileNotFoundError
    │   ├── PermissionError
    │   ├── FileExistsError
    │   └── TimeoutError
    ├── RuntimeError
    │   └── RecursionError
    ├── StopIteration
    ├── ImportError
    │   └── ModuleNotFoundError
    └── ...
```

```python
# Catching base class catches all subclasses
try:
    d = {}
    d['missing']
except LookupError:  # catches both KeyError and IndexError
    print("Lookup failed")

# Never catch BaseException (catches SystemExit, KeyboardInterrupt)
# Never catch bare Exception without re-raising in production
```

---

## 3. Custom Exceptions

```python
# Base custom exception for your application
class AppError(Exception):
    """Base exception for MyApp."""
    pass

# Specific exceptions
class ValidationError(AppError):
    """Raised when input validation fails."""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"Validation error on '{field}': {message}")

class DatabaseError(AppError):
    """Raised when database operations fail."""
    def __init__(self, operation: str, detail: str = ""):
        self.operation = operation
        super().__init__(f"Database error during {operation}: {detail}")

class NotFoundError(AppError):
    """Raised when a resource is not found."""
    def __init__(self, resource: str, identifier):
        self.resource = resource
        self.identifier = identifier
        super().__init__(f"{resource} with id={identifier} not found")

# Usage
def get_user(user_id: int):
    if not isinstance(user_id, int):
        raise ValidationError('user_id', 'must be an integer')
    if user_id <= 0:
        raise ValidationError('user_id', 'must be positive')
    users = {1: 'Alice', 2: 'Bob'}
    if user_id not in users:
        raise NotFoundError('User', user_id)
    return users[user_id]

try:
    user = get_user(99)
except NotFoundError as e:
    print(f"Not found: {e.resource} #{e.identifier}")
except ValidationError as e:
    print(f"Invalid {e.field}: {e.message}")
except AppError as e:
    print(f"App error: {e}")
```

---

## 4. `raise` and `raise from`

```python
# raise — raise an exception
def validate_age(age):
    if age < 0:
        raise ValueError(f"Age cannot be negative: {age}")
    if age > 150:
        raise ValueError(f"Age seems unrealistic: {age}")
    return age

# raise without argument — re-raise current exception
def process():
    try:
        risky_operation()
    except Exception:
        log_error()
        raise  # re-raises the original exception with original traceback

# raise from — exception chaining (explicit cause)
def load_config(path):
    try:
        with open(path) as f:
            import json
            return json.load(f)
    except FileNotFoundError as e:
        raise RuntimeError(f"Config file not found: {path}") from e
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in config: {path}") from e

# raise from None — suppress the original exception context
def get_value(d, key):
    try:
        return d[key]
    except KeyError:
        raise KeyError(f"Required key '{key}' missing") from None
```

---

## 5. Exception Chaining

```python
# Implicit chaining — Python automatically chains when exception raised in except
try:
    int("not a number")
except ValueError as e:
    raise RuntimeError("Processing failed") from e
    # RuntimeError.__cause__ = ValueError

# Explicit chaining with 'from'
try:
    open("missing.txt")
except FileNotFoundError as original:
    raise IOError("Cannot load data") from original

# Suppress chaining with 'from None'
try:
    d = {}
    d['key']
except KeyError:
    raise ValueError("Invalid configuration") from None
    # No chaining — cleaner error message

# Access chained exceptions
try:
    try:
        1 / 0
    except ZeroDivisionError as e:
        raise ValueError("Bad value") from e
except ValueError as e:
    print(f"Exception: {e}")
    print(f"Cause: {e.__cause__}")
    print(f"Context: {e.__context__}")
```

---

## 6. ExceptionGroup (Python 3.11+)

```python
# ExceptionGroup — group multiple exceptions (for concurrent code)
# Python 3.11+

# Raise multiple exceptions at once
def validate_form(data):
    errors = []
    if not data.get('name'):
        errors.append(ValueError("name is required"))
    if not data.get('email'):
        errors.append(ValueError("email is required"))
    if data.get('age', 0) < 0:
        errors.append(ValueError("age must be non-negative"))
    if errors:
        raise ExceptionGroup("Form validation failed", errors)

# Handle with except*
try:
    validate_form({'age': -1})
except* ValueError as eg:
    print(f"Validation errors: {len(eg.exceptions)}")
    for exc in eg.exceptions:
        print(f"  - {exc}")

# Nested ExceptionGroup
try:
    raise ExceptionGroup("outer", [
        ValueError("val error"),
        ExceptionGroup("inner", [
            TypeError("type error"),
            KeyError("key error"),
        ])
    ])
except* ValueError as eg:
    print("Caught ValueErrors:", eg.exceptions)
except* TypeError as eg:
    print("Caught TypeErrors:", eg.exceptions)
```

---

## 7. Best Practices

```python
# 1. Be specific — catch the most specific exception
# BAD:
try:
    result = process()
except Exception:
    pass  # silently swallows all errors!

# GOOD:
try:
    result = process()
except ValueError as e:
    logger.warning(f"Invalid value: {e}")
    result = default_value
except IOError as e:
    logger.error(f"IO error: {e}")
    raise

# 2. Don't use exceptions for flow control
# BAD:
try:
    value = my_dict['key']
except KeyError:
    value = 'default'

# GOOD:
value = my_dict.get('key', 'default')

# 3. Always log or handle, never silently ignore
import logging
logger = logging.getLogger(__name__)

try:
    risky_operation()
except SpecificError as e:
    logger.exception("Operation failed")  # logs with traceback
    raise  # or handle gracefully

# 4. Use finally for cleanup
def process_file(path):
    f = None
    try:
        f = open(path)
        return f.read()
    except FileNotFoundError:
        return None
    finally:
        if f:
            f.close()  # always closes

# Better: use context manager
def process_file_better(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        return None

# 5. Custom exceptions should inherit from Exception
class MyError(Exception):
    """Always inherit from Exception, not BaseException."""
    pass

# 6. Include context in exception messages
# BAD:
raise ValueError("Invalid input")

# GOOD:
raise ValueError(f"Invalid input: expected positive int, got {value!r}")
```

---

## Interview Questions

**Q1: What is the difference between `except Exception` and `except BaseException`?**

Answer: `Exception` is the base class for all "normal" exceptions. `BaseException` also includes `SystemExit`, `KeyboardInterrupt`, and `GeneratorExit` — exceptions that should generally not be caught. Catching `BaseException` would prevent Ctrl+C from working and interfere with `sys.exit()`. Always catch `Exception` or more specific subclasses. Only catch `BaseException` in very specific cases like top-level cleanup handlers.

---

**Q2: What is the difference between `raise` and `raise e`?**

Answer: Bare `raise` re-raises the current exception with the original traceback intact. `raise e` raises the exception but resets the traceback to the current line, losing the original location. Always use bare `raise` when re-raising in an except block.

```python
try:
    risky()
except Exception as e:
    log(e)
    raise    # GOOD: preserves original traceback
    # raise e  # BAD: loses original traceback location
```

---

**Q3: What does `raise X from Y` do?**

Answer: It explicitly chains exceptions — sets `X.__cause__ = Y` and `X.__suppress_context__ = True`. When printed, Python shows "The above exception was the direct cause of the following exception." Use it when catching a low-level exception and raising a higher-level one, to preserve the original cause for debugging. `raise X from None` suppresses the chain entirely, showing only the new exception.

---

**Q4: When does the `else` clause in try/except run?**

Answer: The `else` clause runs only if the `try` block completed without raising any exception. It's useful for code that should only run on success but shouldn't be inside the `try` block (to avoid accidentally catching exceptions from the success code). `finally` always runs regardless.

```python
try:
    result = risky_operation()
except SpecificError:
    handle_error()
else:
    # Only runs if no exception — process result safely
    process_result(result)
finally:
    cleanup()  # always runs
```

---

**Q5: What is exception chaining and why is it useful?**

Answer: Exception chaining preserves the original exception when raising a new one. Python automatically chains exceptions when you raise inside an except block (implicit chaining via `__context__`). Explicit chaining with `from` sets `__cause__`. This is crucial for debugging — you can see the full chain of what caused what. Without chaining, you'd lose the root cause.

---

**Q6: How do you create a custom exception hierarchy?**

Answer: Create a base exception for your application, then subclass it for specific errors. This lets callers catch all app errors with one except clause or specific ones individually.

```python
class AppError(Exception): pass
class ValidationError(AppError):
    def __init__(self, field, msg):
        self.field = field
        super().__init__(f"{field}: {msg}")
class NotFoundError(AppError): pass

# Caller can catch broadly or specifically
try:
    process()
except ValidationError as e:
    return 400, str(e)
except NotFoundError:
    return 404, "Not found"
except AppError as e:
    return 500, str(e)
```

---

**Q7: What is `ExceptionGroup` in Python 3.11+?**

Answer: `ExceptionGroup` allows raising and handling multiple exceptions simultaneously — primarily useful for concurrent code (asyncio, threading) where multiple tasks can fail at once. Use `except*` (note the asterisk) to handle exception groups. Each `except*` clause receives an `ExceptionGroup` containing all matching exceptions.

---

**Q8: What are the best practices for exception handling?**

Answer:
1. Catch specific exceptions, not bare `except` or `except Exception` without re-raising
2. Never silently swallow exceptions (`except: pass`)
3. Use `finally` for cleanup (or better, context managers)
4. Include context in error messages
5. Use `raise` (not `raise e`) to preserve traceback
6. Use `raise X from Y` when translating exceptions
7. Create custom exception hierarchies for your application
8. Log exceptions with `logger.exception()` to capture the traceback

---

**Q9: What happens if an exception is raised in `finally`?**

Answer: If an exception is raised in `finally`, it replaces the original exception. The original exception is lost (unless you explicitly handle it). This is a common gotcha — be careful about code that can raise in `finally`.

```python
try:
    raise ValueError("original")
finally:
    raise RuntimeError("in finally")  # ValueError is lost!
```

---

**Q10: How do you handle exceptions in a context where you want to collect all errors?**

Answer: Collect errors in a list and raise at the end, or use `ExceptionGroup` (Python 3.11+):

```python
def validate(data):
    errors = []
    if not data.get('name'):
        errors.append(ValueError("name required"))
    if not data.get('email'):
        errors.append(ValueError("email required"))
    if errors:
        raise ExceptionGroup("Validation failed", errors)
        # Or for older Python:
        # raise ValueError("; ".join(str(e) for e in errors))
```
