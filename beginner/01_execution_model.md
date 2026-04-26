# 01 — Python Execution Model & CPython Internals

## How Python Code Runs

```
Source (.py)
    ↓  [Lexer + Parser]
AST (Abstract Syntax Tree)
    ↓  [Compiler]
Bytecode (.pyc)
    ↓  [CPython VM / PVM]
Execution
```

### Step 1: Lexing & Parsing
The source file is tokenized and parsed into an **AST**.

```python
import ast
tree = ast.parse("x = 1 + 2")
print(ast.dump(tree, indent=2))
```

### Step 2: Compilation to Bytecode
The AST is compiled to **bytecode** — a platform-independent instruction set for the Python Virtual Machine.

```python
import dis

def add(a, b):
    return a + b

dis.dis(add)
# LOAD_FAST  0 (a)
# LOAD_FAST  1 (b)
# BINARY_OP  0 (+)
# RETURN_VALUE
```

### Step 3: The Python Virtual Machine (PVM)
CPython's PVM is a **stack-based interpreter**. It maintains:
- **Value stack** — operands and results
- **Frame stack** — call frames (one per function call)
- **Code object** — bytecode + constants + names

```python
import inspect

def foo():
    frame = inspect.currentframe()
    print(f"Function: {frame.f_code.co_name}")
    print(f"Locals:   {frame.f_locals}")
    print(f"Bytecode: {frame.f_code.co_code}")

foo()
```

---

## CPython Architecture

```
CPython
├── Objects/          ← All Python objects (PyObject)
├── Python/           ← Compiler, bytecode, eval loop
├── Modules/          ← Built-in modules (os, sys, etc.)
├── Lib/              ← Standard library (Python)
└── Include/          ← C header files
```

### PyObject — Everything is an Object

Every Python object is a C struct with at minimum:
```c
typedef struct _object {
    Py_ssize_t ob_refcnt;   // reference count
    PyTypeObject *ob_type;  // pointer to type
} PyObject;
```

```python
import sys
x = 42
print(sys.getrefcount(x))   # reference count
print(type(x).__mro__)      # method resolution order
print(x.__class__)          # type
```

---

## The Global Interpreter Lock (GIL)

The **GIL** is a mutex that protects CPython's internal state. Only **one thread** executes Python bytecode at a time.

### Why it exists:
- CPython uses **reference counting** for memory management
- Without the GIL, concurrent ref count updates would corrupt memory

### Implications:
- **CPU-bound** threads: GIL prevents true parallelism → use `multiprocessing`
- **I/O-bound** threads: GIL is released during I/O → `threading` works fine
- **C extensions**: can release the GIL (NumPy, Pandas do this)

```python
import threading
import time

# I/O bound — threading helps (GIL released during sleep)
def io_task():
    time.sleep(1)

threads = [threading.Thread(target=io_task) for _ in range(4)]
start = time.time()
for t in threads: t.start()
for t in threads: t.join()
print(f"I/O bound: {time.time()-start:.2f}s")  # ~1s (parallel)
```

---

## Memory Model

### Stack vs Heap
- **Stack**: function call frames (local variables, return addresses)
- **Heap**: all Python objects (managed by CPython's allocator)

### Small Object Allocator
CPython has a custom allocator for small objects (≤512 bytes) called **pymalloc** — faster than `malloc`.

### Integer Caching
CPython caches integers from **-5 to 256**:
```python
a = 256; b = 256; print(a is b)  # True — cached
a = 257; b = 257; print(a is b)  # False — not cached
```

### String Interning
Short strings that look like identifiers are **interned** (shared):
```python
import sys
a = sys.intern("hello world")
b = sys.intern("hello world")
print(a is b)  # True — explicitly interned
```

---

## Code Objects and Frame Objects

```python
def outer(x):
    def inner(y):
        return x + y
    return inner

# Inspect code object
code = outer.__code__
print(code.co_varnames)    # ('x', 'inner')
print(code.co_freevars)    # ()
print(code.co_consts)      # (None,)

inner_code = outer(1).__code__
print(inner_code.co_freevars)  # ('x',) — closure variable
```

---

## .pyc Files and `__pycache__`

Python caches compiled bytecode in `__pycache__/module.cpython-311.pyc`.
- Regenerated when source changes (based on mtime + size)
- Can be disabled: `python -B script.py`

---

## Interview Questions

### Q1: What is the difference between CPython, PyPy, and Jython?
**Answer:**
| Implementation | Language | Key Feature |
|---|---|---|
| **CPython** | C | Reference implementation, GIL, most compatible |
| **PyPy** | Python/RPython | JIT compiler, 5-10x faster for CPU-bound |
| **Jython** | Java | Runs on JVM, no GIL, Java interop |
| **IronPython** | C# | Runs on .NET CLR |
| **MicroPython** | C | Embedded systems |

---

### Q2: What is the GIL and how does it affect performance?
**Answer:**
The **Global Interpreter Lock** is a mutex in CPython that ensures only one thread executes Python bytecode at a time. It exists because CPython uses reference counting for memory management, which is not thread-safe without synchronization.

**Impact:**
- CPU-bound multithreading: **no speedup** (use `multiprocessing`)
- I/O-bound multithreading: **works fine** (GIL released during I/O)
- NumPy/Pandas: **can release GIL** in C extensions

**Python 3.13+**: Experimental "no-GIL" build available.

---

### Q3: What is bytecode and how can you inspect it?
**Answer:**
Bytecode is a low-level, platform-independent representation of Python code executed by the PVM.

```python
import dis

def example(x, y):
    if x > y:
        return x
    return y

dis.dis(example)
# Shows: LOAD_FAST, COMPARE_OP, POP_JUMP_IF_FALSE, RETURN_VALUE, etc.
```

---

### Q4: How does Python's memory management work?
**Answer:**
1. **Reference counting**: every object has `ob_refcnt`. When it hits 0, memory is freed immediately.
2. **Cyclic garbage collector**: handles reference cycles (objects that reference each other).
3. **pymalloc**: custom allocator for small objects (≤512 bytes), organized in arenas/pools/blocks.
4. **Object pools**: CPython reuses freed objects (e.g., small ints, None, True, False are singletons).

```python
import gc
import sys

x = [1, 2, 3]
print(sys.getrefcount(x))  # 2 (x + getrefcount arg)

y = x
print(sys.getrefcount(x))  # 3

del y
print(sys.getrefcount(x))  # 2

# Force garbage collection
gc.collect()
```

---

### Q5: What happens when you import a module?
**Answer:**
1. Python checks `sys.modules` cache — if found, returns cached module
2. Finds the module file (searches `sys.path`)
3. Compiles to bytecode (or loads `.pyc` if up-to-date)
4. Executes the module code in a new namespace
5. Stores result in `sys.modules`

```python
import sys
import os

print('os' in sys.modules)   # True — already imported
print(sys.modules['os'])     # <module 'os' from ...>
print(sys.path)              # search path
```

---

### Q6: What is the difference between `is` and `==` at the CPython level?
**Answer:**
- `==` calls `__eq__()` — value comparison
- `is` compares `id()` — memory address (pointer comparison in C)

```python
# id() returns memory address
x = [1, 2, 3]
print(id(x))          # e.g., 140234567890
print(hex(id(x)))     # 0x7f8a1b2c3d4e

# is is literally: id(a) == id(b)
a = b = []
print(a is b)         # True — same object
```

---

### Q7: What is a code object vs a function object?
**Answer:**
- **Code object** (`types.CodeType`): immutable, contains bytecode, constants, variable names. Created at compile time.
- **Function object** (`types.FunctionType`): wraps a code object + default args + closure + globals. Created at runtime.

```python
import types

def foo(x):
    return x * 2

print(type(foo))           # <class 'function'>
print(type(foo.__code__))  # <class 'code'>
print(foo.__code__.co_varnames)  # ('x',)
print(foo.__code__.co_consts)    # (None, 2)
```

---

### Q8: How does Python handle circular imports?
**Answer:**
Python partially executes a module when it's first imported. If module A imports B and B imports A, Python returns the **partially initialized** module A to B.

```python
# a.py
from b import b_func   # may fail if b_func not yet defined

# Solution 1: import at function level
def a_func():
    from b import b_func
    return b_func()

# Solution 2: import module, not name
import b
def a_func():
    return b.b_func()
```
