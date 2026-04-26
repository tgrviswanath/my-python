# Python Modules & Imports

## 1. The `import` Statement

Python's import system loads modules into the current namespace.

```python
import math
import os
import sys

print(math.pi)        # 3.141592653589793
print(os.getcwd())    # current working directory
print(sys.version)    # Python version string
```

## 2. `from ... import`

Import specific names directly into the current namespace.

```python
from math import sqrt, pi, ceil
from os.path import join, exists, dirname

print(sqrt(16))       # 4.0
print(pi)             # 3.141592653589793
print(join('/usr', 'local', 'bin'))  # /usr/local/bin
```

Import everything (generally discouraged — pollutes namespace):

```python
from math import *   # imports all names not starting with _
```

## 3. `as` Alias

Rename imports for brevity or to avoid name collisions.

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from collections import defaultdict as dd
from datetime import datetime as dt

# Common convention in data science
arr = np.array([1, 2, 3])
now = dt.now()
```

## 4. `__name__ == "__main__"`

Every module has a `__name__` attribute. When run directly, it equals `"__main__"`. When imported, it equals the module's filename (without `.py`).

```python
# mymodule.py
def greet(name):
    return f"Hello, {name}!"

def main():
    print(greet("World"))

if __name__ == "__main__":
    # Only runs when executed directly, not when imported
    main()
```

This pattern is essential for:
- Writing reusable modules that also work as scripts
- Preventing side effects on import
- Enabling testability

```python
# test_mymodule.py
import mymodule  # main() does NOT run here

result = mymodule.greet("Alice")  # works fine
assert result == "Hello, Alice!"
```

## 5. Absolute vs Relative Imports

### Absolute Imports (recommended)

```
mypackage/
    __init__.py
    utils.py
    models/
        __init__.py
        user.py
        product.py
```

```python
# In mypackage/models/user.py — absolute import
from mypackage.utils import helper_function
from mypackage.models.product import Product
```

### Relative Imports

Use dot notation relative to the current package.

```python
# In mypackage/models/user.py — relative imports
from ..utils import helper_function   # go up one level, then utils
from .product import Product          # same package
from . import product                 # import the module itself
```

Rules:
- Single dot (`.`) = current package
- Double dot (`..`) = parent package
- Relative imports only work inside packages (not in top-level scripts)

## 6. The Import System: `sys.path` and `sys.modules`

### `sys.path`

Python searches for modules in this ordered list of directories:

```python
import sys

print(sys.path)
# ['', '/usr/lib/python3.11', '/usr/lib/python3.11/lib-dynload', ...]
# '' means current directory

# Add a custom path at runtime
sys.path.insert(0, '/path/to/my/modules')
sys.path.append('/another/path')
```

Search order:
1. Current directory (or script's directory)
2. `PYTHONPATH` environment variable directories
3. Installation-dependent defaults (stdlib, site-packages)

### `sys.modules`

Cache of all imported modules. Prevents re-importing.

```python
import sys
import math

print('math' in sys.modules)   # True
print(sys.modules['math'])     # <module 'math' from '...'>

# Force reimport (rarely needed)
import importlib
importlib.reload(math)

# Check if already imported without importing
if 'heavy_module' not in sys.modules:
    import heavy_module
```

## 7. Circular Imports

Circular imports occur when module A imports B and B imports A.

```python
# a.py
from b import func_b   # imports b, which tries to import a...

def func_a():
    return "from a"

# b.py
from a import func_a   # circular!

def func_b():
    return "from b"
```

### Solutions

**Solution 1: Import inside the function (lazy import)**

```python
# a.py
def func_a():
    from b import func_b   # deferred until called
    return func_b()
```

**Solution 2: Import the module, not the name**

```python
# a.py
import b   # import module object (partially initialized is OK)

def func_a():
    return b.func_b()
```

**Solution 3: Restructure — extract shared code to a third module**

```python
# common.py  — shared utilities
def shared_util():
    return "shared"

# a.py
from common import shared_util

# b.py
from common import shared_util
```

## 8. Lazy Imports

Defer expensive imports until they're actually needed.

```python
# Pattern 1: Import inside function
def process_image(path):
    import cv2          # only imported when function is called
    import numpy as np
    img = cv2.imread(path)
    return np.array(img)

# Pattern 2: importlib for dynamic imports
import importlib

def get_backend(name):
    module = importlib.import_module(f"backends.{name}")
    return module.Backend()

# Pattern 3: TYPE_CHECKING guard (avoids circular imports in type hints)
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mypackage.models import User  # only imported during type checking

def process(user: "User") -> None:    # string annotation avoids runtime import
    pass
```

## 9. `__all__`

Controls what `from module import *` exports. Also serves as documentation of the public API.

```python
# mymodule.py
__all__ = ['PublicClass', 'public_function']  # explicit public API

class PublicClass:
    pass

def public_function():
    pass

def _private_function():   # not exported by *
    pass

class _InternalClass:      # not exported by *
    pass
```

```python
from mymodule import *
# Only PublicClass and public_function are imported
# _private_function and _InternalClass are NOT imported
```

In `__init__.py`, `__all__` controls what the package exposes:

```python
# mypackage/__init__.py
from .models import User, Product
from .utils import helper

__all__ = ['User', 'Product', 'helper']
```

## 10. `importlib`

The `importlib` module provides the implementation of the import system.

```python
import importlib

# Dynamic import by string name
module_name = "json"
json = importlib.import_module(module_name)
data = json.loads('{"key": "value"}')

# Import submodule
os_path = importlib.import_module("os.path")

# Reload a module (useful in development/REPL)
import mymodule
importlib.reload(mymodule)

# Check if a module can be imported
spec = importlib.util.find_spec("numpy")
if spec is not None:
    numpy = importlib.import_module("numpy")
else:
    print("numpy not installed")

# Load module from file path
import importlib.util

spec = importlib.util.spec_from_file_location(
    "my_module",
    "/path/to/my_module.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
```

## 11. Package `__init__.py`

```python
# mypackage/__init__.py

# 1. Mark directory as a package (can be empty)

# 2. Control public API
from .core import MainClass
from .utils import helper_func

# 3. Set package metadata
__version__ = "1.0.0"
__author__ = "Your Name"

# 4. Lazy submodule loading
def __getattr__(name):
    if name == "heavy_submodule":
        import importlib
        return importlib.import_module(f".{name}", __name__)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
```

---

## Interview Questions

**Q1: What is the difference between `import module` and `from module import name`?**

Answer: `import module` loads the module and binds it to the name `module` in the current namespace. You access its contents via `module.name`. `from module import name` loads the module but only binds the specific `name` in the current namespace. The key difference is namespace pollution and rebinding behavior — if the module later changes `name`, `from module import name` won't see the update (you have a local reference), while `import module; module.name` always reflects the current state.

```python
import math
from math import pi

math.pi = 999   # modifies module attribute
print(math.pi)  # 999
print(pi)       # 3.14159... — local reference unchanged!
```

---

**Q2: What does `if __name__ == "__main__":` do and why is it important?**

Answer: `__name__` is a special variable set by Python. When a file is run directly, `__name__` is `"__main__"`. When imported as a module, `__name__` is the module's name. This guard prevents code from running when the module is imported, enabling the same file to serve as both a reusable module and a runnable script. It's critical for testability — tests can import the module without triggering side effects.

```python
# calculator.py
def add(a, b):
    return a + b

if __name__ == "__main__":
    print(add(2, 3))  # only runs when: python calculator.py
```

---

**Q3: How does Python's import system work? What is `sys.path`?**

Answer: When you `import foo`, Python:
1. Checks `sys.modules` cache — if found, returns cached module
2. Finds the module by searching `sys.path` directories in order
3. Loads and executes the module code
4. Stores the module object in `sys.modules`
5. Binds the name in the current namespace

`sys.path` is a list of directory strings Python searches. It's initialized from: the script's directory (or `''` for interactive), `PYTHONPATH` env var, and installation defaults. You can modify it at runtime with `sys.path.insert()`.

---

**Q4: What are circular imports and how do you resolve them?**

Answer: Circular imports occur when module A imports B and B imports A. Python handles partial initialization — when A starts importing B, B tries to import A but gets the partially-initialized A module, which may be missing names defined later. Solutions:
1. Move the import inside the function (lazy import)
2. Import the module object instead of specific names
3. Restructure code to extract shared dependencies into a third module
4. Use `TYPE_CHECKING` guard for type-hint-only imports

---

**Q5: What is `__all__` and when should you use it?**

Answer: `__all__` is a list of strings defining the public API of a module — specifically, what gets exported when someone does `from module import *`. It also serves as documentation. Best practice: always define `__all__` in modules that are part of a library's public API. Names starting with `_` are excluded from `*` imports even without `__all__`, but `__all__` gives explicit control and documents intent.

```python
__all__ = ['MyClass', 'my_function']  # explicit public API
```

---

**Q6: What is the difference between absolute and relative imports?**

Answer: Absolute imports use the full path from the project root (`from mypackage.models import User`). Relative imports use dot notation relative to the current package (`from .models import User`, `from ..utils import helper`). Absolute imports are recommended (PEP 8) because they're unambiguous and work regardless of where the module is imported from. Relative imports are useful within packages to avoid hardcoding the package name, making the package more portable.

---

**Q7: How do you dynamically import a module by name?**

Answer: Use `importlib.import_module()`:

```python
import importlib

# Import by string name
module = importlib.import_module("json")
data = module.loads('{"key": "value"}')

# Import submodule
submod = importlib.import_module("os.path")

# Conditional import with fallback
try:
    ujson = importlib.import_module("ujson")
except ImportError:
    ujson = importlib.import_module("json")
```

This is useful for plugin systems, optional dependencies, and configuration-driven module loading.

---

**Q8: What is `sys.modules` and how can you use it?**

Answer: `sys.modules` is a dictionary mapping module names to module objects — it's Python's module cache. When you import a module, Python first checks `sys.modules`. If found, it returns the cached object without re-executing the module code. You can use it to: check if a module is loaded (`'numpy' in sys.modules`), get a reference to an already-imported module (`sys.modules['os']`), or mock modules in tests by inserting fake objects. `importlib.reload()` re-executes the module and updates `sys.modules`.
