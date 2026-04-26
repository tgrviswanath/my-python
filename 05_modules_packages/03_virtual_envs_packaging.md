# Virtual Environments & Python Packaging

## 1. Virtual Environments with `venv`

A virtual environment is an isolated Python environment with its own interpreter and packages.

### Creating and Activating

```bash
# Create a virtual environment
python -m venv myenv

# Activate (Linux/macOS)
source myenv/bin/activate

# Activate (Windows CMD)
myenv\Scripts\activate.bat

# Activate (Windows PowerShell)
myenv\Scripts\Activate.ps1

# Deactivate
deactivate
```

### What venv Creates

```
myenv/
├── bin/          (Scripts/ on Windows)
│   ├── python    → symlink to Python interpreter
│   ├── pip
│   └── activate
├── lib/
│   └── python3.11/
│       └── site-packages/   ← installed packages go here
├── include/
└── pyvenv.cfg
```

### Why Use Virtual Environments?

- Isolate project dependencies (project A needs Django 3.2, project B needs Django 4.2)
- Avoid polluting the system Python
- Reproducible environments
- Easier dependency management

---

## 2. `pip` — Package Installer

```bash
# Install a package
pip install requests

# Install specific version
pip install requests==2.31.0

# Install minimum version
pip install "requests>=2.28.0"

# Install from requirements file
pip install -r requirements.txt

# Upgrade a package
pip install --upgrade requests

# Uninstall
pip uninstall requests

# List installed packages
pip list
pip list --outdated

# Show package info
pip show requests

# Search (deprecated in newer pip, use PyPI website)
pip search requests

# Install in editable mode (development)
pip install -e .

# Install with extras
pip install "requests[security]"
```

---

## 3. `requirements.txt`

```bash
# Generate from current environment
pip freeze > requirements.txt

# Install from file
pip install -r requirements.txt
```

### Example `requirements.txt`

```
# Production dependencies
requests==2.31.0
flask==3.0.0
sqlalchemy==2.0.23
pydantic==2.5.0

# With version ranges (less reproducible)
numpy>=1.24.0,<2.0.0
```

### Best Practices

```
# requirements.txt — exact versions for reproducibility
requests==2.31.0
certifi==2023.11.17

# requirements-dev.txt — development tools
pytest==7.4.3
black==23.11.0
mypy==1.7.1
flake8==6.1.0

# requirements-base.txt — abstract dependencies (for libraries)
requests>=2.28.0
```

---

## 4. `pyproject.toml` — Modern Packaging Standard (PEP 517/518/621)

```toml
[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.backends.legacy:build"

[project]
name = "mypackage"
version = "1.0.0"
description = "A sample Python package"
readme = "README.md"
license = {file = "LICENSE"}
authors = [
    {name = "Alice Smith", email = "alice@example.com"}
]
keywords = ["sample", "package"]
classifiers = [
    "Development Status :: 3 - Alpha",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "License :: OSI Approved :: MIT License",
]
requires-python = ">=3.9"
dependencies = [
    "requests>=2.28.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "black>=23.0",
    "mypy>=1.0",
]
docs = [
    "sphinx>=7.0",
    "sphinx-rtd-theme",
]

[project.urls]
Homepage = "https://github.com/alice/mypackage"
Documentation = "https://mypackage.readthedocs.io"
Repository = "https://github.com/alice/mypackage"

[project.scripts]
mypackage-cli = "mypackage.cli:main"

[tool.setuptools.packages.find]
where = ["src"]

[tool.black]
line-length = 88
target-version = ["py39", "py310", "py311"]

[tool.mypy]
python_version = "3.11"
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --tb=short"
```

---

## 5. `setup.py` vs `setup.cfg` vs `pyproject.toml`

### `setup.py` (Legacy — avoid for new projects)

```python
# setup.py — imperative, allows arbitrary Python code
from setuptools import setup, find_packages

setup(
    name='mypackage',
    version='1.0.0',
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    install_requires=[
        'requests>=2.28.0',
    ],
    python_requires='>=3.9',
)
```

### `setup.cfg` (Declarative, still used)

```ini
[metadata]
name = mypackage
version = 1.0.0
description = A sample package
author = Alice Smith
author_email = alice@example.com

[options]
packages = find:
package_dir = = src
python_requires = >=3.9
install_requires =
    requests>=2.28.0
    pydantic>=2.0.0

[options.packages.find]
where = src
```

### Evolution

| Format | Status | Notes |
|--------|--------|-------|
| `setup.py` | Legacy | Avoid; security risk (arbitrary code execution) |
| `setup.cfg` | Stable | Declarative, still widely used |
| `pyproject.toml` | Modern | PEP 517/518/621; recommended for new projects |

---

## 6. Package Structure

### Minimal Package

```
mypackage/
├── pyproject.toml
├── README.md
├── LICENSE
└── src/
    └── mypackage/
        ├── __init__.py
        ├── core.py
        └── utils.py
```

### Full Package Structure

```
mypackage/
├── pyproject.toml
├── setup.cfg          (optional, if not using pyproject.toml fully)
├── README.md
├── LICENSE
├── CHANGELOG.md
├── .gitignore
├── src/
│   └── mypackage/
│       ├── __init__.py      ← marks as package, exposes public API
│       ├── __version__.py   ← version string
│       ├── core.py
│       ├── utils.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   └── product.py
│       └── cli.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_core.py
│   └── test_utils.py
└── docs/
    └── index.rst
```

---

## 7. `__init__.py`

```python
# src/mypackage/__init__.py

# 1. Expose public API
from .core import MainClass, main_function
from .utils import helper

# 2. Version
from .__version__ import __version__

# 3. Package metadata
__author__ = "Alice Smith"
__email__ = "alice@example.com"

# 4. Control star imports
__all__ = ['MainClass', 'main_function', 'helper', '__version__']
```

```python
# src/mypackage/__version__.py
__version__ = "1.0.0"
```

### Accessing version

```python
import mypackage
print(mypackage.__version__)  # '1.0.0'

# Or using importlib.metadata (Python 3.8+)
from importlib.metadata import version
print(version('mypackage'))  # '1.0.0'
```

---

## 8. Building and Publishing

```bash
# Install build tools
pip install build twine

# Build distribution packages
python -m build
# Creates:
#   dist/mypackage-1.0.0.tar.gz      (source distribution)
#   dist/mypackage-1.0.0-py3-none-any.whl  (wheel)

# Check the distribution
twine check dist/*

# Upload to TestPyPI first
twine upload --repository testpypi dist/*

# Upload to PyPI
twine upload dist/*
```

---

## Interview Questions

**Q1: What is a virtual environment and why should you use one?**

Answer: A virtual environment is an isolated Python installation with its own interpreter, pip, and site-packages directory. Each project gets its own environment, preventing dependency conflicts (project A needs Django 3.2, project B needs Django 4.2). Without virtual environments, all projects share the system Python, making it impossible to have different versions of the same package. Always use virtual environments for Python projects.

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

---

**Q2: What is the difference between `pip freeze` and manually writing `requirements.txt`?**

Answer: `pip freeze` outputs all installed packages with exact versions — including transitive dependencies (dependencies of your dependencies). This is great for reproducibility but can be noisy. Manually written `requirements.txt` lists only direct dependencies, possibly with version ranges. Best practice: use `pip freeze > requirements-lock.txt` for deployment (exact reproducibility) and maintain a separate `requirements.txt` with only direct dependencies and minimum version constraints for library development.

---

**Q3: What is `pyproject.toml` and why is it preferred over `setup.py`?**

Answer: `pyproject.toml` is the modern, standardized way to configure Python projects (PEP 517/518/621). It's preferred because: it's declarative (no arbitrary code execution like `setup.py`), it's a single file for all tool configuration (pytest, black, mypy, etc.), it supports multiple build backends (setuptools, flit, poetry, hatch), and it's the current Python packaging standard. `setup.py` is legacy — it allowed arbitrary code execution during installation, which was a security risk.

---

**Q4: What does `__init__.py` do?**

Answer: `__init__.py` marks a directory as a Python package, enabling imports from it. It can be empty (just marks the directory) or contain code that runs when the package is imported. Common uses: expose the public API by importing from submodules, set `__version__` and `__all__`, perform package-level initialization. In Python 3.3+, "namespace packages" work without `__init__.py`, but regular packages still need it for most use cases.

---

**Q5: How do you install a package in development/editable mode?**

Answer: Use `pip install -e .` (editable install). This installs the package by creating a link to your source directory instead of copying files. Changes to your source code are immediately reflected without reinstalling. Essential for development workflow. The `-e` flag requires a `pyproject.toml` or `setup.py` in the current directory.

```bash
pip install -e .           # install current package in editable mode
pip install -e ".[dev]"    # with optional dev dependencies
```

---

**Q6: What is the `src` layout and why is it recommended?**

Answer: The `src` layout puts your package inside a `src/` directory (`src/mypackage/`) instead of at the project root (`mypackage/`). Benefits: prevents accidentally importing the local package instead of the installed one during testing (the `src` directory isn't on `sys.path` by default), forces you to install the package before testing (catches packaging issues early), and clearly separates source code from project files. It's the recommended layout for packages intended for distribution.
