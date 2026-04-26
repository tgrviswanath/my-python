# Modules & Packages — Python Intermediate

## Table of Contents
1. [The Module System](#1-the-module-system)
2. [Package Structure](#2-package-structure)
3. [Relative vs Absolute Imports](#3-relative-vs-absolute-imports)
4. [importlib — Dynamic Imports](#4-importlib--dynamic-imports)
5. [The `__name__ == '__main__'` Pattern](#5-the-__name__--__main__-pattern)
6. [Namespace Packages (PEP 420)](#6-namespace-packages-pep-420)
7. [Virtual Environments & Packaging](#7-virtual-environments--packaging)
8. [Key Standard Library Modules](#8-key-standard-library-modules)
9. [Performance Notes](#9-performance-notes)
10. [Common Bugs](#10-common-bugs)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Module System

### What is a module?

A module is any Python file (`.py`) or compiled extension (`.so`/`.pyd`). When imported, Python executes the file top-to-bottom and stores the resulting namespace as a module object in `sys.modules`.

### Import machinery

```
import spam
```

Python's import system follows these steps:

1. **Check `sys.modules`** — if `spam` is already there, return the cached module object.
2. **Find the module** — use the list of *finders* in `sys.meta_path`:
   - `BuiltinImporter` — built-in modules (`sys`, `builtins`)
   - `FrozenImporter` — frozen modules
   - `PathFinder` — searches `sys.path` using *path hooks*
3. **Load the module** — the finder returns a *loader* that reads and executes the source.
4. **Cache in `sys.modules`** — the module object is stored so subsequent imports are instant.

```python
import sys

# See all currently imported modules
print(list(sys.modules.keys())[:10])

# See where Python looks for modules
for p in sys.path:
    print(p)
```

### `sys.path` manipulation

```python
import sys

# Prepend a custom directory (affects current session only)
sys.path.insert(0, "/path/to/my/libs")

# Or use PYTHONPATH environment variable before starting Python
# export PYTHONPATH=/path/to/my/libs:$PYTHONPATH
```

### Module attributes

```python
import os

print(os.__name__)    # 'os'
print(os.__file__)    # path to os.py
print(os.__spec__)    # ModuleSpec object
print(os.__doc__[:60])
```

### Reloading a module

```python
import importlib
import mymodule

# Force re-execution of the module file
importlib.reload(mymodule)
```

---

## 2. Package Structure

A **package** is a directory containing an `__init__.py` file (regular package) or no `__init__.py` (namespace package).

### Typical layout

```
mypackage/
├── __init__.py          # executed on import; defines package's public API
├── core.py
├── utils.py
└── subpkg/
    ├── __init__.py
    └── helpers.py
```

### `__init__.py`

```python
# mypackage/__init__.py

# 1. Re-export key names for a clean public API
from .core import Engine
from .utils import format_output

# 2. Define __all__ to control `from mypackage import *`
__all__ = ["Engine", "format_output"]

# 3. Package metadata
__version__ = "1.2.0"
__author__ = "Alice"
```

### `__all__`

```python
# utils.py
__all__ = ["public_func"]   # only this is exported by `import *`

def public_func(): pass
def _private_func(): pass   # underscore convention: private
```

`__all__` only affects `from module import *`. Explicit imports (`from module import _private_func`) still work.

### Lazy imports in `__init__.py`

For large packages, avoid importing everything in `__init__.py` — it slows startup. Use lazy loading:

```python
# __init__.py
def get_engine():
    from .core import Engine   # imported only when called
    return Engine()
```

---

## 3. Relative vs Absolute Imports

### Absolute imports (recommended)

```python
# Always works regardless of where the file is
import mypackage.core
from mypackage.utils import format_output
```

### Relative imports

```python
# mypackage/subpkg/helpers.py

from .. import core           # go up one level to mypackage, import core
from ..utils import format_output  # go up one level, import from utils
from . import sibling         # same package level
```

Relative imports only work inside packages (not in scripts run directly). They use the `__package__` attribute to determine the anchor.

### When to use which

| Situation | Use |
|-----------|-----|
| Application code | Absolute (clearer, refactor-safe) |
| Library internals | Relative (package can be renamed without changing internals) |
| Scripts run directly | Absolute only |

---

## 4. importlib — Dynamic Imports

```python
import importlib

# Dynamic import by string name
module_name = "json"
json = importlib.import_module(module_name)
print(json.dumps({"key": "value"}))

# Import a submodule
pathlib = importlib.import_module("pathlib")

# Import relative to a package
# importlib.import_module(".utils", package="mypackage")
```

### Plugin loader pattern

```python
import importlib
from typing import Type

def load_plugin(module_path: str, class_name: str) -> Type:
    """Dynamically load a class from a dotted module path."""
    module = importlib.import_module(module_path)
    return getattr(module, class_name)

# Usage:
# cls = load_plugin("mypackage.plugins.csv_plugin", "CSVPlugin")
# instance = cls()
```

### `importlib.util` — inspect without importing

```python
import importlib.util

spec = importlib.util.find_spec("numpy")
if spec is not None:
    print(f"numpy found at: {spec.origin}")
else:
    print("numpy not installed")
```

---

## 5. The `__name__ == '__main__'` Pattern

Every module has a `__name__` attribute. When run directly (`python script.py`), `__name__` is `'__main__'`. When imported, `__name__` is the module's dotted name.

```python
# calculator.py

def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

if __name__ == "__main__":
    # This block only runs when the file is executed directly
    print("Running calculator tests...")
    assert add(2, 3) == 5
    assert subtract(10, 4) == 6
    print("All tests passed!")
```

### Best practice: `main()` function

```python
def main():
    import argparse
    parser = argparse.ArgumentParser(description="My tool")
    parser.add_argument("input", help="Input file")
    args = parser.parse_args()
    process(args.input)

if __name__ == "__main__":
    main()
```

This makes the entry point testable (you can call `main()` from tests) and importable.

---

## 6. Namespace Packages (PEP 420)

A namespace package is a package without `__init__.py`. It allows a single logical package to be split across multiple directories or distributions.

```
# Directory 1 (installed package A):
site-packages/
└── myns/
    └── module_a.py

# Directory 2 (installed package B):
site-packages/
└── myns/
    └── module_b.py

# Both are accessible as:
import myns.module_a
import myns.module_b
```

Python merges all `myns/` directories found on `sys.path` into a single namespace package.

```python
import myns
print(myns.__path__)   # _NamespacePath(['/path/a/myns', '/path/b/myns'])
```

**Use case:** Large organisations split a namespace (e.g., `company.utils`, `company.models`) across separate repos/packages.

---

## 7. Virtual Environments & Packaging

### Creating and using venv

```bash
# Create
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Unix/macOS)
source .venv/bin/activate

# Deactivate
deactivate
```

### pip essentials

```bash
pip install requests                    # install latest
pip install requests==2.31.0            # pin version
pip install "requests>=2.28,<3"         # version range
pip install -r requirements.txt         # install from file
pip freeze > requirements.txt           # capture current env
pip list --outdated                     # show outdatable packages
pip show requests                       # package metadata
pip uninstall requests                  # remove
```

### requirements.txt

```
# requirements.txt
requests==2.31.0
numpy>=1.24.0,<2.0
pandas==2.0.3
python-dotenv==1.0.0
```

### pyproject.toml (modern standard — PEP 517/518/621)

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mypackage"
version = "1.0.0"
description = "A sample package"
requires-python = ">=3.11"
dependencies = [
    "requests>=2.28",
    "click>=8.0",
]

[project.optional-dependencies]
dev = ["pytest>=7.0", "black", "mypy"]

[project.scripts]
mytool = "mypackage.cli:main"
```

### Installing in editable mode

```bash
pip install -e .   # installs package in development mode (changes reflected immediately)
```

---

## 8. Key Standard Library Modules

### `os` — operating system interface

```python
import os

# Paths
os.getcwd()                          # current working directory
os.path.join("dir", "subdir", "file.txt")
os.path.exists("/tmp/data.csv")
os.path.basename("/home/user/file.txt")  # 'file.txt'
os.path.dirname("/home/user/file.txt")   # '/home/user'

# Directory operations
os.makedirs("a/b/c", exist_ok=True)
os.listdir(".")
os.walk(".")                         # recursive directory tree

# Environment variables
os.environ.get("HOME", "/tmp")
os.getenv("DATABASE_URL")

# Process
os.getpid()
os.cpu_count()
```

### `pathlib` — modern path handling

```python
from pathlib import Path

p = Path("/home/user/data")
p / "file.txt"                       # Path('/home/user/data/file.txt')
p.exists()
p.is_dir()
p.mkdir(parents=True, exist_ok=True)

# File operations
text = Path("readme.txt").read_text(encoding="utf-8")
Path("output.txt").write_text("hello", encoding="utf-8")

# Glob
for f in Path(".").glob("**/*.py"):
    print(f)

# Path parts
p = Path("/home/user/data/file.txt")
p.name        # 'file.txt'
p.stem        # 'file'
p.suffix      # '.txt'
p.parent      # Path('/home/user/data')
p.parts       # ('/', 'home', 'user', 'data', 'file.txt')
```

### `collections` — specialised containers

```python
from collections import (
    defaultdict, Counter, OrderedDict,
    namedtuple, deque, ChainMap
)

# defaultdict — auto-initialises missing keys
word_count = defaultdict(int)
for word in "the quick brown fox the fox".split():
    word_count[word] += 1

# Counter — frequency counting
c = Counter("abracadabra")
print(c.most_common(3))   # [('a', 5), ('b', 2), ('r', 2)]

# namedtuple — lightweight immutable record
Point = namedtuple("Point", ["x", "y"])
p = Point(1, 2)
print(p.x, p.y)

# deque — O(1) append/pop from both ends
dq = deque([1, 2, 3], maxlen=5)
dq.appendleft(0)
dq.rotate(1)

# ChainMap — layered dict lookup
defaults = {"color": "red", "size": "medium"}
overrides = {"color": "blue"}
config = ChainMap(overrides, defaults)
print(config["color"])   # 'blue'
print(config["size"])    # 'medium'
```

### `itertools` — iterator building blocks

```python
import itertools

# chain — flatten iterables
list(itertools.chain([1, 2], [3, 4], [5]))   # [1, 2, 3, 4, 5]

# islice — lazy slicing
list(itertools.islice(range(100), 5, 15, 2))  # [5, 7, 9, 11, 13]

# product — cartesian product
list(itertools.product("AB", [1, 2]))
# [('A', 1), ('A', 2), ('B', 1), ('B', 2)]

# combinations / permutations
list(itertools.combinations("ABC", 2))
# [('A', 'B'), ('A', 'C'), ('B', 'C')]

# groupby — group consecutive elements
data = [("a", 1), ("a", 2), ("b", 3), ("b", 4)]
for key, group in itertools.groupby(data, key=lambda x: x[0]):
    print(key, list(group))

# accumulate — running totals
list(itertools.accumulate([1, 2, 3, 4, 5]))   # [1, 3, 6, 10, 15]

# cycle / repeat
list(itertools.islice(itertools.cycle("AB"), 6))  # ['A','B','A','B','A','B']
list(itertools.repeat(0, 3))                       # [0, 0, 0]
```

### `functools` — higher-order functions

```python
import functools

# lru_cache — memoisation
@functools.lru_cache(maxsize=128)
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

# partial — fix some arguments
from functools import partial
power_of_2 = partial(pow, 2)
print(power_of_2(10))   # 1024

# reduce — fold left
from functools import reduce
product = reduce(lambda a, b: a * b, [1, 2, 3, 4, 5])  # 120

# wraps — preserve metadata in decorators
def my_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

### `contextlib` — context manager utilities

```python
from contextlib import contextmanager, suppress, redirect_stdout
import io

# contextmanager — generator-based context manager
@contextmanager
def temp_directory():
    import tempfile, shutil
    tmpdir = tempfile.mkdtemp()
    try:
        yield tmpdir
    finally:
        shutil.rmtree(tmpdir)

with temp_directory() as d:
    print(f"Working in {d}")

# suppress — silently ignore specific exceptions
with suppress(FileNotFoundError):
    open("nonexistent.txt")

# redirect_stdout — capture print output
buffer = io.StringIO()
with redirect_stdout(buffer):
    print("captured!")
output = buffer.getvalue()
print(repr(output))   # 'captured!\n'
```

---

## 9. Performance Notes

| Technique | Impact |
|-----------|--------|
| `sys.modules` cache | Subsequent imports are O(1) dict lookups — essentially free |
| `__all__` | No performance impact; purely for namespace control |
| Lazy imports | Moves import cost to first use; reduces startup time for large packages |
| `importlib.util.find_spec` | Check existence without importing — avoids side effects |
| `from x import y` vs `import x` | `from x import y` binds the name locally — slightly faster in tight loops (one fewer attribute lookup) |
| `lru_cache` | Dramatic speedup for pure functions with repeated inputs; uses memory |

```python
# Lazy import pattern for optional heavy dependencies
def get_numpy():
    try:
        import numpy as np
        return np
    except ImportError:
        raise ImportError("numpy is required for this feature: pip install numpy")
```

---

## 10. Common Bugs

### 1. Circular imports

```
# a.py imports b.py, b.py imports a.py → ImportError or partial module
```

Fix: move the import inside the function, use `importlib.import_module` lazily, or restructure to extract shared code into a third module.

### 2. Shadowing stdlib modules

```python
# Don't name your file 'os.py', 'json.py', 'random.py', etc.
# It will shadow the stdlib module for the entire project.
```

### 3. Mutable default in module-level code

```python
# config.py
DEFAULT_OPTIONS = {"debug": False}   # shared mutable dict

# If someone does: from config import DEFAULT_OPTIONS; DEFAULT_OPTIONS["debug"] = True
# they mutate the module-level object for everyone
```

### 4. `import *` pollution

```python
from os.path import *   # imports dozens of names into local namespace
# Use explicit imports instead
from os.path import join, exists, dirname
```

### 5. `__init__.py` import order

If `__init__.py` imports from submodules that themselves import from `__init__.py`, you get circular import errors. Keep `__init__.py` thin.

### 6. `sys.path` modification side effects

Inserting into `sys.path` affects all subsequent imports in the process. Prefer virtual environments and proper packaging over `sys.path` hacks.

---

## 11. Interview Q&A

**Q1. What happens when you `import` a module in Python?**

A: Python first checks `sys.modules` — if the module is already there, it returns the cached object immediately. Otherwise, it searches `sys.meta_path` finders (built-in, frozen, path-based). The path finder searches directories in `sys.path` for a matching `.py` file, package directory, or compiled extension. Once found, a loader executes the module code in a fresh namespace, stores the resulting module object in `sys.modules`, and returns it. This means module-level code runs exactly once per interpreter session.

---

**Q2. What is the difference between a package and a module?**

A: A module is a single `.py` file. A package is a directory that contains an `__init__.py` (regular package) or no `__init__.py` (namespace package). Packages can contain subpackages and modules. When you import a package, Python executes its `__init__.py`. The package object's `__path__` attribute lists the directories Python searches for submodules.

---

**Q3. What is `__all__` and when should you use it?**

A: `__all__` is a list of strings that defines the public API of a module — specifically, what gets exported when someone does `from module import *`. It doesn't restrict explicit imports. You should define `__all__` in library code to clearly communicate the intended public interface and prevent internal helpers from leaking into user namespaces. Without `__all__`, `import *` exports all names that don't start with an underscore.

---

**Q4. What are relative imports and when should you use them?**

A: Relative imports use dots to indicate the package hierarchy: `.` means the current package, `..` means the parent package. They only work inside packages (not in scripts run directly). Use them in library internals so the package can be renamed or moved without updating every internal import. For application code, absolute imports are clearer and less fragile.

---

**Q5. How do you handle optional dependencies?**

A: Wrap the import in a try/except and raise a helpful error at the point of use:

```python
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

def compute(data):
    if not HAS_NUMPY:
        raise ImportError("numpy required: pip install numpy")
    return np.array(data)
```

---

**Q6. What is the difference between `venv` and `virtualenv`?**

A: `venv` is the built-in virtual environment module (Python 3.3+). `virtualenv` is a third-party tool that predates `venv`, supports Python 2, and has more features (faster creation, more configuration options). For modern Python 3 projects, `venv` is sufficient. Both create isolated Python environments with their own `site-packages`, preventing dependency conflicts between projects.

---

**Q7. What is `pyproject.toml` and why is it replacing `setup.py`?**

A: `pyproject.toml` is the modern standard (PEP 517/518/621) for Python project configuration. It separates build system requirements (`[build-system]`) from project metadata (`[project]`), supports multiple build backends (hatchling, flit, setuptools), and is declarative (no executable code). `setup.py` was imperative Python code that ran during installation, creating security and reproducibility concerns. `pyproject.toml` is static, tool-agnostic, and supported by all modern packaging tools.

---

**Q8. How does `sys.modules` caching affect module reloading?**

A: Once a module is in `sys.modules`, subsequent `import` statements return the cached object without re-executing the file. This means changes to the source file are not reflected until you call `importlib.reload(module)` or restart the interpreter. `reload()` re-executes the module code in the existing namespace (it doesn't create a new namespace), so objects that were imported with `from module import name` before the reload still point to the old objects. In production, module reloading is generally avoided; use process restart instead.
