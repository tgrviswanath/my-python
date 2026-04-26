# Context Managers in Python

## 1. The `with` Statement

The `with` statement ensures setup and teardown code runs reliably, even when exceptions occur.

```python
# Without context manager — error-prone
f = open('file.txt')
try:
    data = f.read()
finally:
    f.close()  # must remember to close

# With context manager — clean and safe
with open('file.txt') as f:
    data = f.read()
# f.close() called automatically
```

---

## 2. `__enter__` and `__exit__` Protocol

Any class implementing `__enter__` and `__exit__` can be used as a context manager.

```python
class ManagedResource:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        print(f"Acquiring {self.name}")
        return self  # value bound to 'as' variable

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Releasing {self.name}")
        # exc_type, exc_val, exc_tb are None if no exception
        if exc_type is not None:
            print(f"Exception occurred: {exc_type.__name__}: {exc_val}")
        # Return True to suppress the exception
        # Return False (or None) to propagate it
        return False

with ManagedResource("database connection") as resource:
    print(f"Using {resource.name}")
    # raise ValueError("test error")  # uncomment to test exception handling
```

### Suppressing Exceptions

```python
class SuppressErrors:
    def __init__(self, *exception_types):
        self.exception_types = exception_types

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type and issubclass(exc_type, self.exception_types):
            print(f"Suppressed: {exc_type.__name__}: {exc_val}")
            return True  # suppress the exception
        return False  # propagate other exceptions

with SuppressErrors(ValueError, KeyError):
    raise ValueError("This will be suppressed")

print("Execution continues after suppressed exception")
```

---

## 3. `contextlib.contextmanager` — Generator-Based

The `@contextmanager` decorator turns a generator function into a context manager.

```python
from contextlib import contextmanager
import time

@contextmanager
def timer(label=""):
    """Context manager to time a block of code."""
    start = time.perf_counter()
    try:
        yield  # code in 'with' block runs here
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.4f}s")

with timer("List comprehension"):
    result = [x**2 for x in range(100000)]

# With a value
@contextmanager
def managed_connection(host, port):
    """Simulate a database connection."""
    print(f"Connecting to {host}:{port}")
    conn = {'host': host, 'port': port, 'open': True}
    try:
        yield conn  # value bound to 'as' variable
    except Exception as e:
        print(f"Error during connection: {e}")
        raise
    finally:
        conn['open'] = False
        print(f"Disconnected from {host}:{port}")

with managed_connection("localhost", 5432) as conn:
    print(f"Connected: {conn}")
    # do database work

# Exception handling in contextmanager
@contextmanager
def transaction():
    """Database transaction context manager."""
    print("BEGIN TRANSACTION")
    try:
        yield
        print("COMMIT")
    except Exception:
        print("ROLLBACK")
        raise  # re-raise after rollback

try:
    with transaction():
        print("Executing queries...")
        raise RuntimeError("Query failed!")
except RuntimeError:
    print("Transaction rolled back")
```

---

## 4. `contextlib.suppress`

```python
from contextlib import suppress
import os

# Suppress specific exceptions
with suppress(FileNotFoundError):
    os.remove('nonexistent_file.txt')
# No exception raised — execution continues

# Equivalent to:
try:
    os.remove('nonexistent_file.txt')
except FileNotFoundError:
    pass

# Multiple exception types
with suppress(FileNotFoundError, PermissionError):
    os.remove('protected_file.txt')

# Use case: optional cleanup
def cleanup(temp_files):
    for f in temp_files:
        with suppress(FileNotFoundError, OSError):
            os.remove(f)
```

---

## 5. `contextlib.ExitStack`

`ExitStack` manages a dynamic number of context managers.

```python
from contextlib import ExitStack

# Open multiple files dynamically
filenames = ['file1.txt', 'file2.txt', 'file3.txt']

with ExitStack() as stack:
    files = [stack.enter_context(open(f, 'w')) for f in filenames]
    for i, f in enumerate(files):
        f.write(f"Content of file {i+1}\n")
# All files closed automatically

# Dynamic context managers based on conditions
def process(use_transaction=True, use_lock=True):
    with ExitStack() as stack:
        if use_transaction:
            stack.enter_context(transaction_context())
        if use_lock:
            stack.enter_context(lock_context())
        # do work

# Cleanup callbacks
with ExitStack() as stack:
    stack.callback(print, "Cleanup 1")
    stack.callback(print, "Cleanup 2")
    stack.callback(print, "Cleanup 3")
# Prints in LIFO order: Cleanup 3, Cleanup 2, Cleanup 1

# ExitStack as a reusable cleanup manager
class Server:
    def __init__(self):
        self._cleanup = ExitStack()

    def start(self):
        self._cleanup.enter_context(self._open_socket())
        self._cleanup.enter_context(self._start_workers())

    def stop(self):
        self._cleanup.close()  # runs all cleanup
```

---

## 6. Nested Context Managers

```python
# Multiple context managers in one with statement
with open('input.txt') as fin, open('output.txt', 'w') as fout:
    for line in fin:
        fout.write(line.upper())

# Equivalent to nested with statements
with open('input.txt') as fin:
    with open('output.txt', 'w') as fout:
        for line in fin:
            fout.write(line.upper())

# Parenthesized context managers (Python 3.10+)
with (
    open('input.txt') as fin,
    open('output.txt', 'w') as fout,
    open('log.txt', 'a') as log,
):
    for line in fin:
        processed = line.upper()
        fout.write(processed)
        log.write(f"Processed: {line.rstrip()}\n")
```

---

## 7. Practical Context Manager Examples

```python
from contextlib import contextmanager
import threading
import tempfile
import os

# 1. Temporary directory
@contextmanager
def temp_directory():
    """Create and clean up a temporary directory."""
    import tempfile
    import shutil
    tmpdir = tempfile.mkdtemp()
    try:
        yield tmpdir
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

with temp_directory() as tmpdir:
    # work with temp files
    path = os.path.join(tmpdir, 'data.txt')
    with open(path, 'w') as f:
        f.write('temporary data')
# tmpdir deleted automatically

# 2. Redirect stdout
@contextmanager
def redirect_stdout(new_target):
    import sys
    old = sys.stdout
    sys.stdout = new_target
    try:
        yield new_target
    finally:
        sys.stdout = old

import io
buffer = io.StringIO()
with redirect_stdout(buffer):
    print("This goes to buffer")
print("Captured:", buffer.getvalue())

# 3. Thread lock
lock = threading.Lock()

@contextmanager
def locked(lock):
    lock.acquire()
    try:
        yield
    finally:
        lock.release()

# Or just use the lock directly (it's already a context manager)
with lock:
    # critical section
    pass

# 4. Environment variable override
@contextmanager
def env_override(**kwargs):
    """Temporarily override environment variables."""
    old_values = {}
    for key, value in kwargs.items():
        old_values[key] = os.environ.get(key)
        os.environ[key] = value
    try:
        yield
    finally:
        for key, old_value in old_values.items():
            if old_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old_value

with env_override(DATABASE_URL='sqlite:///:memory:', DEBUG='true'):
    print("DB URL:", os.environ['DATABASE_URL'])
print("DB URL restored:", os.environ.get('DATABASE_URL', 'not set'))
```

---

## Interview Questions

**Q1: What is a context manager and what protocol does it implement?**

Answer: A context manager is an object that defines setup and teardown behavior for use with the `with` statement. It implements the context manager protocol: `__enter__()` (called on entry, its return value is bound to the `as` variable) and `__exit__(exc_type, exc_val, exc_tb)` (called on exit, receives exception info if one occurred). Returning `True` from `__exit__` suppresses the exception; returning `False` or `None` propagates it.

---

**Q2: What are the advantages of `@contextmanager` over implementing `__enter__`/`__exit__`?**

Answer: `@contextmanager` is more concise — you write a single generator function instead of a class with two methods. The code before `yield` is `__enter__`, the code after is `__exit__`. Exception handling is natural with try/finally. Use the class-based approach when you need to store state across multiple uses, or when the context manager is complex enough to warrant a class.

```python
# Class-based (verbose)
class Timer:
    def __enter__(self): self.start = time.time(); return self
    def __exit__(self, *args): self.elapsed = time.time() - self.start

# Generator-based (concise)
@contextmanager
def timer():
    start = time.time()
    yield
    print(f"Elapsed: {time.time() - start:.3f}s")
```

---

**Q3: How do you suppress exceptions in a context manager?**

Answer: Return `True` from `__exit__`. With `@contextmanager`, catch the exception in the generator. `contextlib.suppress` is the cleanest way for simple suppression.

```python
# Method 1: __exit__ returns True
class Suppress:
    def __exit__(self, exc_type, exc_val, exc_tb):
        return exc_type is not None  # suppress all exceptions

# Method 2: contextmanager
@contextmanager
def suppress_value_error():
    try:
        yield
    except ValueError:
        pass  # suppress

# Method 3: contextlib.suppress (best for simple cases)
from contextlib import suppress
with suppress(ValueError):
    raise ValueError("suppressed")
```

---

**Q4: What is `ExitStack` and when would you use it?**

Answer: `ExitStack` manages a dynamic number of context managers. Use it when: the number of context managers isn't known at compile time (e.g., opening N files), you want to conditionally enter context managers, or you need to register cleanup callbacks. It processes cleanups in LIFO order (last in, first out).

---

**Q5: What happens if `__exit__` raises an exception?**

Answer: If `__exit__` raises an exception, it replaces the original exception (if any). The original exception is lost. This is a gotcha — be careful about code that can raise in `__exit__`. With `@contextmanager`, if the `finally` block raises, it replaces the original exception.

---

**Q6: How does `contextlib.contextmanager` handle exceptions?**

Answer: When an exception occurs in the `with` block, it's thrown into the generator at the `yield` point. If the generator doesn't handle it (no try/except around yield), the exception propagates normally. If the generator catches it and doesn't re-raise, the exception is suppressed. If the generator raises a different exception, that replaces the original.

```python
@contextmanager
def example():
    try:
        yield
    except ValueError:
        print("Caught ValueError — suppressed")
        # not re-raising = suppressed
    except Exception:
        print("Other exception — re-raising")
        raise
    finally:
        print("Cleanup always runs")
```

---

**Q7: What is the difference between `contextlib.suppress` and a bare `try/except: pass`?**

Answer: Functionally equivalent, but `suppress` is more readable and expressive — it clearly communicates intent ("I'm intentionally ignoring this exception"). It also handles multiple exception types cleanly. The `try/except: pass` pattern is considered a code smell because it's easy to accidentally suppress too broadly.

---

**Q8: Can you use a context manager without the `with` statement?**

Answer: Yes — you can call `__enter__` and `__exit__` manually, but this defeats the purpose. The `with` statement guarantees `__exit__` is called even if an exception occurs. Manual calls don't provide this guarantee. The only legitimate use case is when you need to enter a context manager and exit it at a different point in the code — use `ExitStack` for this instead.
