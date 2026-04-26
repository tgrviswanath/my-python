# Python Testing

## 1. `unittest` — Built-in Testing Framework

```python
import unittest

# Class under test
class Calculator:
    def add(self, a, b):
        return a + b

    def divide(self, a, b):
        if b == 0:
            raise ZeroDivisionError("Cannot divide by zero")
        return a / b

    def factorial(self, n):
        if n < 0:
            raise ValueError("Factorial not defined for negative numbers")
        if n == 0:
            return 1
        return n * self.factorial(n - 1)

# Test class
class TestCalculator(unittest.TestCase):
    def setUp(self):
        """Called before each test method."""
        self.calc = Calculator()

    def tearDown(self):
        """Called after each test method."""
        pass

    def test_add_positive(self):
        self.assertEqual(self.calc.add(2, 3), 5)

    def test_add_negative(self):
        self.assertEqual(self.calc.add(-1, -2), -3)

    def test_add_zero(self):
        self.assertEqual(self.calc.add(0, 5), 5)

    def test_divide_normal(self):
        self.assertAlmostEqual(self.calc.divide(10, 3), 3.333, places=3)

    def test_divide_by_zero(self):
        with self.assertRaises(ZeroDivisionError):
            self.calc.divide(10, 0)

    def test_divide_by_zero_message(self):
        with self.assertRaises(ZeroDivisionError) as ctx:
            self.calc.divide(10, 0)
        self.assertIn("zero", str(ctx.exception).lower())

    def test_factorial(self):
        self.assertEqual(self.calc.factorial(0), 1)
        self.assertEqual(self.calc.factorial(5), 120)

    def test_factorial_negative(self):
        with self.assertRaises(ValueError):
            self.calc.factorial(-1)

    @unittest.skip("Not implemented yet")
    def test_future_feature(self):
        pass

    @unittest.skipIf(True, "Skipping on this platform")
    def test_platform_specific(self):
        pass

if __name__ == '__main__':
    unittest.main(verbosity=2)
```

### unittest Assertions

```python
# Equality
self.assertEqual(a, b)
self.assertNotEqual(a, b)
self.assertAlmostEqual(a, b, places=7)

# Boolean
self.assertTrue(expr)
self.assertFalse(expr)

# None
self.assertIsNone(x)
self.assertIsNotNone(x)

# Identity
self.assertIs(a, b)
self.assertIsNot(a, b)

# Membership
self.assertIn(item, container)
self.assertNotIn(item, container)

# Type
self.assertIsInstance(obj, cls)
self.assertNotIsInstance(obj, cls)

# Exceptions
self.assertRaises(ExcType, callable, *args)
with self.assertRaises(ExcType) as ctx: ...

# Sequences
self.assertListEqual(list1, list2)
self.assertDictEqual(dict1, dict2)
self.assertSetEqual(set1, set2)

# Regex
self.assertRegex(text, pattern)
```

---

## 2. `pytest` — Modern Testing Framework

```python
# pytest — no class required, just functions starting with test_
import pytest

def add(a, b):
    return a + b

def divide(a, b):
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b

# Simple test functions
def test_add():
    assert add(2, 3) == 5

def test_add_negative():
    assert add(-1, -2) == -3

def test_divide():
    assert divide(10, 2) == 5.0

def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)

def test_divide_by_zero_message():
    with pytest.raises(ZeroDivisionError, match="zero"):
        divide(10, 0)

# pytest assert introspection — better error messages
def test_list_equality():
    result = [1, 2, 3]
    expected = [1, 2, 4]
    assert result == expected  # pytest shows diff!
```

---

## 3. Fixtures

```python
import pytest
import tempfile
import os

# Function-scoped fixture (default)
@pytest.fixture
def calculator():
    """Provide a Calculator instance."""
    return Calculator()

# Session-scoped fixture — created once per test session
@pytest.fixture(scope='session')
def database():
    """Create a test database."""
    db = create_test_db()
    yield db  # setup
    db.cleanup()  # teardown

# Module-scoped fixture
@pytest.fixture(scope='module')
def config():
    return {'debug': True, 'timeout': 30}

# Fixture with teardown using yield
@pytest.fixture
def temp_file():
    """Create a temporary file, clean up after test."""
    fd, path = tempfile.mkstemp()
    os.close(fd)
    yield path  # test runs here
    os.unlink(path)  # cleanup

# Fixture using another fixture
@pytest.fixture
def populated_db(database):
    database.insert({'id': 1, 'name': 'Alice'})
    database.insert({'id': 2, 'name': 'Bob'})
    return database

# Using fixtures in tests
def test_add_with_fixture(calculator):
    assert calculator.add(2, 3) == 5

def test_file_operations(temp_file):
    with open(temp_file, 'w') as f:
        f.write('test content')
    with open(temp_file) as f:
        assert f.read() == 'test content'

# conftest.py — shared fixtures across test files
# Place fixtures in conftest.py to share across modules
```

---

## 4. `@pytest.mark.parametrize`

```python
import pytest

def is_palindrome(s):
    s = s.lower().replace(' ', '')
    return s == s[::-1]

# Parametrize — run test with multiple inputs
@pytest.mark.parametrize("input,expected", [
    ("racecar", True),
    ("hello", False),
    ("A man a plan a canal Panama", True),
    ("", True),
    ("a", True),
    ("ab", False),
])
def test_is_palindrome(input, expected):
    assert is_palindrome(input) == expected

# Multiple parameters
@pytest.mark.parametrize("a,b,expected", [
    (1, 2, 3),
    (-1, 1, 0),
    (0, 0, 0),
    (100, -50, 50),
])
def test_add_parametrized(a, b, expected):
    assert add(a, b) == expected

# Parametrize with IDs
@pytest.mark.parametrize("value,expected", [
    pytest.param(0, True, id="zero"),
    pytest.param(1, False, id="one"),
    pytest.param(-1, False, id="negative"),
], ids=["zero", "one", "negative"])
def test_is_zero(value, expected):
    assert (value == 0) == expected
```

---

## 5. `mock` and `patch`

```python
from unittest.mock import Mock, MagicMock, patch, call
import pytest

# Mock — create a mock object
mock = Mock()
mock.method(1, 2, 3)
mock.method.assert_called_once_with(1, 2, 3)
mock.method.assert_called_with(1, 2, 3)
print(mock.method.call_count)  # 1

# Return values
mock.get_user.return_value = {'id': 1, 'name': 'Alice'}
result = mock.get_user(1)
print(result)  # {'id': 1, 'name': 'Alice'}

# MagicMock — supports magic methods
magic = MagicMock()
magic.__len__.return_value = 5
print(len(magic))  # 5

# patch — replace objects during tests
class UserService:
    def get_user(self, user_id):
        # In real code, this would call a database
        import requests
        response = requests.get(f"https://api.example.com/users/{user_id}")
        return response.json()

# Patch the requests.get call
@patch('requests.get')
def test_get_user(mock_get):
    mock_get.return_value.json.return_value = {'id': 1, 'name': 'Alice'}
    mock_get.return_value.status_code = 200

    service = UserService()
    result = service.get_user(1)

    assert result == {'id': 1, 'name': 'Alice'}
    mock_get.assert_called_once_with("https://api.example.com/users/1")

# patch as context manager
def test_with_context_manager():
    with patch('os.path.exists') as mock_exists:
        mock_exists.return_value = True
        assert os.path.exists('/fake/path')
        mock_exists.assert_called_once_with('/fake/path')

# patch.object — patch a specific object's attribute
class EmailService:
    def send(self, to, subject, body):
        # Real implementation sends email
        pass

def test_email_service():
    service = EmailService()
    with patch.object(service, 'send') as mock_send:
        service.send('alice@example.com', 'Hello', 'World')
        mock_send.assert_called_once_with('alice@example.com', 'Hello', 'World')
```

---

## 6. `side_effect`

```python
from unittest.mock import Mock

# side_effect — raise exception
mock = Mock()
mock.method.side_effect = ValueError("Something went wrong")
try:
    mock.method()
except ValueError as e:
    print(f"Caught: {e}")

# side_effect — return different values on successive calls
mock.get_data.side_effect = [
    {'page': 1, 'data': [1, 2, 3]},
    {'page': 2, 'data': [4, 5, 6]},
    StopIteration,  # raise on third call
]

print(mock.get_data())  # {'page': 1, ...}
print(mock.get_data())  # {'page': 2, ...}

# side_effect — function
def validate_input(value):
    if value < 0:
        raise ValueError(f"Negative value: {value}")
    return value * 2

mock.process.side_effect = validate_input
print(mock.process(5))   # 10
try:
    mock.process(-1)     # raises ValueError
except ValueError as e:
    print(f"Caught: {e}")
```

---

## 7. Assert Patterns

```python
import pytest

# pytest.approx — floating point comparison
def test_float_equality():
    assert 0.1 + 0.2 == pytest.approx(0.3)
    assert 1.0 / 3.0 == pytest.approx(0.333, rel=1e-3)

# Custom assertion messages
def test_with_message():
    result = compute_something()
    assert result > 0, f"Expected positive result, got {result}"

# Assert on exceptions
def test_exception_type_and_message():
    with pytest.raises(ValueError, match=r"must be positive"):
        validate(-1)

# Assert on warnings
import warnings
def test_deprecation_warning():
    with pytest.warns(DeprecationWarning, match="deprecated"):
        old_function()

# Soft assertions with pytest-check (third-party)
# import pytest_check as check
# def test_multiple():
#     check.equal(result.status, 200)
#     check.is_in('key', result.json())
#     check.greater(result.json()['count'], 0)
```

---

## 8. Coverage and TDD

```bash
# Install pytest-cov
pip install pytest-cov

# Run tests with coverage
pytest --cov=mypackage --cov-report=html tests/

# Coverage report
pytest --cov=mypackage --cov-report=term-missing tests/

# Minimum coverage threshold
pytest --cov=mypackage --cov-fail-under=80 tests/
```

```python
# TDD — Test-Driven Development
# 1. Write a failing test
# 2. Write minimal code to pass
# 3. Refactor

# Step 1: Write test first
def test_fizzbuzz():
    assert fizzbuzz(1) == "1"
    assert fizzbuzz(3) == "Fizz"
    assert fizzbuzz(5) == "Buzz"
    assert fizzbuzz(15) == "FizzBuzz"

# Step 2: Implement
def fizzbuzz(n):
    if n % 15 == 0:
        return "FizzBuzz"
    elif n % 3 == 0:
        return "Fizz"
    elif n % 5 == 0:
        return "Buzz"
    return str(n)

# Step 3: Refactor if needed
```

---

## Interview Questions

**Q1: What is the difference between `unittest` and `pytest`?**

Answer: `unittest` is the built-in framework — requires test classes inheriting from `TestCase`, uses `self.assert*` methods, and has more boilerplate. `pytest` is a third-party framework — tests are plain functions, uses plain `assert` statements (with better error messages via introspection), has powerful fixtures, parametrize, and a rich plugin ecosystem. `pytest` can also run `unittest` tests. For new projects, `pytest` is strongly preferred.

---

**Q2: What is a fixture in pytest?**

Answer: A fixture is a function decorated with `@pytest.fixture` that provides test dependencies. Tests declare fixtures as parameters — pytest injects them automatically. Fixtures support setup/teardown via `yield`, scoping (`function`, `class`, `module`, `session`), and can depend on other fixtures. They replace `setUp`/`tearDown` from `unittest` with a more composable, reusable approach.

---

**Q3: What is `@pytest.mark.parametrize` and why is it useful?**

Answer: `parametrize` runs the same test function with multiple sets of inputs. It eliminates code duplication, makes test cases explicit and readable, and each parameter set appears as a separate test in the output. It's essential for testing edge cases, boundary conditions, and multiple valid inputs without writing separate test functions.

---

**Q4: What is the difference between `Mock` and `MagicMock`?**

Answer: `Mock` is a basic mock object that records calls and allows setting return values. `MagicMock` is a subclass that also supports magic methods (`__len__`, `__iter__`, `__enter__`, `__exit__`, etc.). Use `MagicMock` when the code under test uses magic methods (e.g., context managers, iteration, comparison operators). For most cases, `MagicMock` is the safer default.

---

**Q5: What is `patch` and how does it work?**

Answer: `patch` temporarily replaces an object in a module's namespace during a test. It can be used as a decorator, context manager, or called directly. The key is to patch where the object is used, not where it's defined. For example, if `mymodule.py` imports `requests`, patch `mymodule.requests`, not `requests.get`.

```python
# Patch where it's USED, not where it's defined
@patch('mymodule.requests.get')  # correct
def test_something(mock_get): ...

# NOT: @patch('requests.get')  # may not work
```

---

**Q6: What is `side_effect` in mocking?**

Answer: `side_effect` makes a mock do something when called: raise an exception, return different values on successive calls, or call a function. It's more powerful than `return_value` for testing error handling, pagination, and stateful behavior.

---

**Q7: What is TDD and what are its benefits?**

Answer: Test-Driven Development: write a failing test first, then write minimal code to pass it, then refactor. Benefits: forces you to think about the API before implementation, ensures 100% test coverage for new code, provides a safety net for refactoring, and produces more modular, testable code. The cycle is Red → Green → Refactor.

---

**Q8: How do you test code that has external dependencies (database, API)?**

Answer: Use mocking to replace external dependencies with controlled fakes. For databases, use an in-memory database (SQLite) or a test database. For APIs, mock the HTTP client. For file I/O, use `tempfile`. For time-dependent code, mock `datetime.now()`. The goal is fast, deterministic, isolated tests that don't require external services.
