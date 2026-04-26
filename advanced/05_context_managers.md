# Context Managers — Deep Dive

## Table of Contents
1. [Context Manager Protocol](#1-context-manager-protocol)
2. [contextlib Module](#2-contextlib-module)
3. [Nested Context Managers](#3-nested-context-managers)
4. [Exception Handling in __exit__](#4-exception-handling-in-__exit__)
5. [Async Context Managers](#5-async-context-managers)
6. [Real-World Patterns](#6-real-world-patterns)
7. [Performance Notes](#7-performance-notes)
8. [Common Bugs](#8-common-bugs)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Context Manager Protocol

A context manager implements two methods:

| Method | Called | Purpose |
|--------|--------|---------|
| `__enter__(self)` | On `with` entry | Setup; return value bound to `as` target |
| `__exit__(self, exc_type, exc_val, exc_tb)` | On `with` exit | Cleanup; return truthy to suppress exception |

```python
class ManagedResource:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        print(f"Acquiring {self.name}")
        return self   # value bound to 'as' variable

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Releasing {self.name}")
        if exc_type is not None:
            print(f"Exception occurred: {exc_type.__name__}: {exc_val}")
        return False   # False = don't suppress exceptions

with ManagedResource("DB Connection") as res:
    print(f"Using {res.name}")
    # Acquiring DB Connection
    # Using DB Connection
    # Releasing DB Connection
```

### The `with` statement desugared

```python
with EXPR as VAR:
    BLOCK

# Is exactly equivalent to:
_mgr = EXPR
VAR = _mgr.__enter__()
_exc = True
try:
    try:
        BLOCK
    except:
        _exc = False
        if not _mgr.__exit__(*sys.exc_info()):
            raise
finally:
    if _exc:
        _mgr.__exit__(None, None, None)
```

### __exit__ parameters

```python
def __exit__(self, exc_type, exc_val, exc_tb):
    # exc_type: exception class (e.g., ValueError) or None
    # exc_val:  exception instance or None
    # exc_tb:   traceback object or None
    # Return True to suppress the exception, False/None to propagate
    pass
```

---

## 2. contextlib Module

### @contextmanager — generator-based context managers

The most Pythonic way to write simple context managers:

```python
from contextlib import contextmanager

@contextmanager
def managed_resource(name):
    print(f"Acquiring {name}")
    resource = {"name": name, "active": True}
    try:
        yield resource   # value bound to 'as' variable
    except Exception as e:
        print(f"Error during {name}: {e}")
        raise   # re-raise unless you want to suppress
    finally:
        resource["active"] = False
        print(f"Releasing {name}")

with managed_resource("DB") as res:
    print(f"Using {res['name']}")
```

The generator must yield exactly once. Code before `yield` = `__enter__`. Code after `yield` (in `finally`) = `__exit__`.

### contextlib.suppress — ignore specific exceptions

```python
from contextlib import suppress

# Instead of:
try:
    os.remove("file.txt")
except FileNotFoundError:
    pass

# Use:
with suppress(FileNotFoundError):
    os.remove("file.txt")

# Multiple exception types:
with suppress(FileNotFoundError, PermissionError):
    os.remove("file.txt")
```

### contextlib.redirect_stdout / redirect_stderr

```python
from contextlib import redirect_stdout, redirect_stderr
import io

# Capture stdout
f = io.StringIO()
with redirect_stdout(f):
    print("This goes to f, not console")
    help(len)

output = f.getvalue()
print(f"Captured: {len(output)} chars")

# Redirect to file
with open("output.log", "w") as log:
    with redirect_stdout(log):
        print("This goes to the log file")
```

### contextlib.ExitStack — dynamic context managers

`ExitStack` manages a dynamic number of context managers:

```python
from contextlib import ExitStack

# Open a variable number of files
filenames = ["a.txt", "b.txt", "c.txt"]
with ExitStack() as stack:
    files = [stack.enter_context(open(f)) for f in filenames]
    # All files are open here
    for f in files:
        print(f.read())
# All files closed here, even if an exception occurred

# Register cleanup callbacks
with ExitStack() as stack:
    stack.callback(print, "Cleanup 1")
    stack.callback(print, "Cleanup 2")
    # Callbacks run in LIFO order on exit
    # Cleanup 2
    # Cleanup 1
```

### contextlib.nullcontext (Python 3.7+)

```python
from contextlib import nullcontext

def process(data, lock=None):
    # Use provided lock or a no-op context manager
    ctx = lock if lock is not None else nullcontext()
    with ctx:
        # process data
        pass
```

### contextlib.closing

```python
from contextlib import closing
import urllib.request

# For objects with close() but no __enter__/__exit__
with closing(urllib.request.urlopen("http://example.com")) as page:
    content = page.read()
```

### @asynccontextmanager

```python
from contextlib import asynccontextmanager
import asyncio

@asynccontextmanager
async def async_managed_resource(name):
    print(f"Async acquiring {name}")
    await asyncio.sleep(0.1)   # async setup
    try:
        yield {"name": name}
    finally:
        await asyncio.sleep(0.1)   # async cleanup
        print(f"Async releasing {name}")

async def main():
    async with async_managed_resource("AsyncDB") as res:
        print(f"Using {res['name']}")
```

---

## 3. Nested Context Managers

### Multiple `with` targets (Python 3.1+)

```python
# Old style (still valid):
with open("input.txt") as fin:
    with open("output.txt", "w") as fout:
        fout.write(fin.read())

# Modern style — single with statement:
with open("input.txt") as fin, open("output.txt", "w") as fout:
    fout.write(fin.read())

# With parentheses (Python 3.10+):
with (
    open("input.txt") as fin,
    open("output.txt", "w") as fout,
    open("log.txt", "a") as log,
):
    data = fin.read()
    fout.write(data)
    log.write(f"Processed {len(data)} bytes\n")
```

### Execution order with nested managers

```python
from contextlib import contextmanager

@contextmanager
def cm(name):
    print(f"{name}: enter")
    yield
    print(f"{name}: exit")

with cm("A"), cm("B"), cm("C"):
    print("body")

# Output:
# A: enter
# B: enter
# C: enter
# body
# C: exit
# B: exit
# A: exit
# Exits in reverse order (LIFO)
```

---

## 4. Exception Handling in __exit__

```python
class ExceptionHandler:
    def __init__(self, *exception_types):
        self.exception_types = exception_types
        self.exception = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None and issubclass(exc_type, self.exception_types):
            self.exception = exc_val
            return True   # suppress the exception
        return False      # propagate other exceptions

with ExceptionHandler(ValueError, TypeError) as handler:
    raise ValueError("test error")

print(f"Caught: {handler.exception}")   # Caught: test error
# Execution continues here!
```

### Re-raising with context

```python
@contextmanager
def translate_exception(from_exc, to_exc):
    try:
        yield
    except from_exc as e:
        raise to_exc(str(e)) from e   # chain exceptions

with translate_exception(KeyError, ValueError):
    d = {}
    _ = d['missing']   # KeyError → ValueError
```

### Cleanup regardless of exceptions

```python
@contextmanager
def transaction(db):
    db.begin()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise   # always re-raise after rollback
```

---

## 5. Async Context Managers

Async context managers implement `__aenter__` and `__aexit__`:

```python
import asyncio

class AsyncConnection:
    async def __aenter__(self):
        print("Connecting...")
        await asyncio.sleep(0.1)   # async connection setup
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        print("Disconnecting...")
        await asyncio.sleep(0.1)   # async cleanup
        return False

async def main():
    async with AsyncConnection() as conn:
        print("Using connection")

asyncio.run(main())
```

### Async ExitStack

```python
from contextlib import AsyncExitStack

async def main():
    async with AsyncExitStack() as stack:
        conn1 = await stack.enter_async_context(AsyncConnection())
        conn2 = await stack.enter_async_context(AsyncConnection())
        # Both connections open
    # Both connections closed
```

---

## 6. Real-World Patterns

### Database transaction

```python
from contextlib import contextmanager
import sqlite3

@contextmanager
def db_transaction(db_path):
    conn = sqlite3.connect(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

with db_transaction("mydb.sqlite") as conn:
    conn.execute("INSERT INTO users VALUES (?, ?)", (1, "Alice"))
```

### File lock

```python
import fcntl
from contextlib import contextmanager

@contextmanager
def file_lock(filepath):
    with open(filepath, 'w') as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield f
        except IOError:
            raise RuntimeError(f"Could not acquire lock on {filepath}")
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)
```

### Timing context manager

```python
import time
from contextlib import contextmanager
from dataclasses import dataclass, field

@dataclass
class Timer:
    elapsed: float = 0.0

@contextmanager
def timer():
    t = Timer()
    start = time.perf_counter()
    try:
        yield t
    finally:
        t.elapsed = time.perf_counter() - start

with timer() as t:
    sum(range(1_000_000))
print(f"Elapsed: {t.elapsed:.4f}s")
```

### Temporary directory

```python
import tempfile
import shutil
from contextlib import contextmanager

@contextmanager
def temp_directory():
    tmpdir = tempfile.mkdtemp()
    try:
        yield tmpdir
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

with temp_directory() as tmpdir:
    # work with tmpdir
    pass
# tmpdir automatically deleted

# Or use the built-in:
from tempfile import TemporaryDirectory
with TemporaryDirectory() as tmpdir:
    pass
```

### Mocking / patching (testing)

```python
from unittest.mock import patch

with patch('module.ClassName') as MockClass:
    MockClass.return_value.method.return_value = 42
    result = function_under_test()
    MockClass.assert_called_once()
```

### Environment variable override

```python
import os
from contextlib import contextmanager

@contextmanager
def env_override(**kwargs):
    old_values = {k: os.environ.get(k) for k in kwargs}
    os.environ.update({k: str(v) for k, v in kwargs.items()})
    try:
        yield
    finally:
        for k, v in old_values.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

with env_override(DATABASE_URL="sqlite:///:memory:", DEBUG="1"):
    run_tests()
```

---

## 7. Performance Notes

- **`@contextmanager`** has slightly more overhead than a class-based context manager due to generator machinery, but the difference is negligible for most use cases (~1-2μs).
- **`ExitStack`** is ideal for dynamic numbers of context managers but has higher overhead than static `with` statements.
- **`suppress()`** is slightly faster than a try/except block for the common case of ignoring exceptions.
- **`nullcontext`** has near-zero overhead — it's essentially a no-op.
- For hot paths called millions of times, a class-based context manager is faster than `@contextmanager`.

```python
# Class-based: faster for hot paths
class FastTimer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self
    def __exit__(self, *args):
        self.elapsed = time.perf_counter() - self.start
        return False

# Generator-based: more readable for complex setup/teardown
@contextmanager
def readable_timer():
    start = time.perf_counter()
    yield
    print(f"Elapsed: {time.perf_counter() - start:.4f}s")
```

---

## 8. Common Bugs

### Bug 1: Forgetting to yield in @contextmanager

```python
@contextmanager
def bad_cm():
    print("setup")
    # BUG: no yield! RuntimeError: generator didn't yield

@contextmanager
def good_cm():
    print("setup")
    yield   # must yield exactly once
    print("teardown")
```

### Bug 2: Yielding more than once

```python
@contextmanager
def bad_cm():
    yield 1
    yield 2   # RuntimeError: generator didn't stop after first yield
```

### Bug 3: Swallowing exceptions unintentionally

```python
@contextmanager
def bad_cm():
    try:
        yield
    except Exception:
        pass   # BUG: silently swallows ALL exceptions!

@contextmanager
def good_cm():
    try:
        yield
    except SpecificError:
        handle_it()
    # Other exceptions propagate naturally
```

### Bug 4: Not re-raising in __exit__

```python
class BadCM:
    def __exit__(self, exc_type, exc_val, exc_tb):
        cleanup()
        # BUG: implicitly returns None (falsy) — exception propagates
        # This is actually CORRECT behavior — just be explicit:
        return False   # explicit is better than implicit
```

### Bug 5: Using context manager after `with` block

```python
with open("file.txt") as f:
    data = f.read()

f.read()   # BUG: file is closed! ValueError: I/O operation on closed file
```

---

## 9. Interview Q&A

**Q1: What is the context manager protocol?**

A context manager implements `__enter__()` and `__exit__(exc_type, exc_val, exc_tb)`. `__enter__` is called when entering the `with` block and its return value is bound to the `as` variable. `__exit__` is called when leaving the block (normally or via exception). If `__exit__` returns a truthy value, any exception is suppressed.

---

**Q2: How does `@contextmanager` work?**

`@contextmanager` wraps a generator function. The code before `yield` runs as `__enter__`, the yielded value is the `as` target, and the code after `yield` (typically in `finally`) runs as `__exit__`. The decorator handles exception forwarding: if an exception occurs in the `with` block, it's thrown into the generator at the `yield` point via `generator.throw()`.

---

**Q3: When should you return `True` from `__exit__`?**

Return `True` (or any truthy value) to suppress the exception — execution continues after the `with` block as if no exception occurred. Return `False` or `None` to let the exception propagate. Only suppress exceptions intentionally (e.g., `contextlib.suppress`, retry logic). Accidentally returning `True` is a common bug that silently swallows errors.

---

**Q4: What is `contextlib.ExitStack` and when is it useful?**

`ExitStack` manages a dynamic, variable number of context managers. Use it when: (1) you don't know at write time how many context managers you'll need; (2) you want to conditionally enter context managers; (3) you need to register cleanup callbacks dynamically. It ensures all registered managers are properly exited even if some raise exceptions.

---

**Q5: What is the difference between `contextlib.suppress` and a bare `try/except/pass`?**

Functionally equivalent, but `suppress` is more readable and expressive — it clearly communicates intent ("I'm intentionally ignoring this exception"). It also handles multiple exception types cleanly. The `try/except/pass` pattern is more flexible (you can log before passing), but `suppress` is preferred for simple "ignore this exception" cases.

---

**Q6: How do async context managers differ from regular ones?**

Async context managers implement `__aenter__` and `__aexit__` (both coroutines) and are used with `async with`. They allow `await` expressions in setup and teardown, enabling async I/O (database connections, HTTP sessions, etc.) in the context manager lifecycle. `contextlib.asynccontextmanager` provides the generator-based shortcut for async context managers.

---

**Q7: How would you implement a reentrant context manager?**

Track a nesting counter. Only perform setup/teardown on the outermost enter/exit:

```python
class Reentrant:
    def __init__(self):
        self._depth = 0
    def __enter__(self):
        if self._depth == 0:
            print("Setup")
        self._depth += 1
        return self
    def __exit__(self, *args):
        self._depth -= 1
        if self._depth == 0:
            print("Teardown")
        return False
```

---

**Q8: What happens if an exception is raised in `__enter__`?**

If `__enter__` raises an exception, `__exit__` is NOT called (there's nothing to clean up — the context was never entered). The exception propagates normally. This is why resource acquisition should be atomic in `__enter__`, or you should use `try/finally` within `__enter__` to clean up partial initialization.
