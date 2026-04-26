# Expert 05 — Testing & Code Quality

## pytest Fundamentals

```python
# test_calculator.py
import pytest
from calculator import add, divide

def test_add_positive():
    assert add(2, 3) == 5

def test_add_negative():
    assert add(-1, -1) == -2

def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)

def test_divide_by_zero_message():
    with pytest.raises(ZeroDivisionError, match="division by zero"):
        divide(10, 0)
```

## Fixtures

```python
import pytest

@pytest.fixture
def sample_user():
    return {'id': 1, 'name': 'Alice', 'email': 'alice@example.com'}

@pytest.fixture
def db_connection():
    conn = create_connection()
    yield conn          # setup
    conn.close()        # teardown (always runs)

@pytest.fixture(scope='module')  # shared across module
def expensive_resource():
    resource = setup_expensive()
    yield resource
    teardown_expensive(resource)

def test_user_name(sample_user):
    assert sample_user['name'] == 'Alice'
```

## Parametrize

```python
@pytest.mark.parametrize('a, b, expected', [
    (1, 2, 3),
    (0, 0, 0),
    (-1, 1, 0),
    (100, -50, 50),
])
def test_add(a, b, expected):
    assert add(a, b) == expected

# Parametrize with IDs
@pytest.mark.parametrize('value,expected', [
    pytest.param('', False, id='empty'),
    pytest.param('hello', True, id='non-empty'),
    pytest.param('  ', False, id='whitespace'),
], )
def test_is_valid(value, expected):
    assert is_valid(value) == expected
```

## Mocking

```python
from unittest.mock import Mock, MagicMock, patch, call

# Mock an object
mock_db = Mock()
mock_db.get_user.return_value = {'id': 1, 'name': 'Alice'}
mock_db.get_user.side_effect = [{'id': 1}, {'id': 2}, Exception('DB error')]

# patch — replace in context
with patch('mymodule.requests.get') as mock_get:
    mock_get.return_value.json.return_value = {'status': 'ok'}
    result = fetch_data('http://api.example.com')
    mock_get.assert_called_once_with('http://api.example.com')

# patch as decorator
@patch('mymodule.send_email')
@patch('mymodule.get_user')
def test_notify(mock_get_user, mock_send_email):
    mock_get_user.return_value = {'email': 'alice@example.com'}
    notify_user(1)
    mock_send_email.assert_called_once_with('alice@example.com', 'Hello!')
```

## Test Coverage

```bash
# Run with coverage
pytest --cov=mypackage --cov-report=html tests/

# Minimum coverage threshold
pytest --cov=mypackage --cov-fail-under=80
```

## Code Quality Tools

```bash
# Formatting
black .                    # auto-format
isort .                    # sort imports

# Linting
ruff check .               # fast linter (replaces flake8)
pylint mypackage/          # comprehensive linter

# Type checking
mypy mypackage/            # static type checker

# Security
bandit -r mypackage/       # security issues
safety check               # known vulnerabilities in deps
```

## Interview Questions

### Q1: What is the difference between a mock and a stub?
**Answer:**
- **Stub**: returns pre-defined responses, doesn't verify calls
- **Mock**: verifies that specific calls were made (behavior verification)
- **Fake**: working implementation (e.g., in-memory DB instead of real DB)
- **Spy**: wraps real object, records calls

```python
# Stub — just returns data
stub_db = Mock()
stub_db.get_user.return_value = {'id': 1}

# Mock — also verifies calls
mock_email = Mock()
send_notification(user_id=1)
mock_email.send.assert_called_once_with(to='alice@example.com')
```

### Q2: What is the difference between `@patch` and dependency injection for testing?
**Answer:**
- `@patch` replaces a name in a module's namespace — good for external dependencies
- **Dependency injection** passes dependencies as arguments — more testable by design

```python
# Hard to test — tight coupling
def send_report():
    import smtplib
    smtp = smtplib.SMTP('smtp.gmail.com')  # hard to mock

# Easy to test — DI
def send_report(smtp_client=None):
    if smtp_client is None:
        import smtplib
        smtp_client = smtplib.SMTP('smtp.gmail.com')
    smtp_client.send(...)

# Test
def test_send_report():
    mock_smtp = Mock()
    send_report(smtp_client=mock_smtp)
    mock_smtp.send.assert_called_once()
```

### Q3: What is test isolation and why does it matter?
**Answer:**
Tests should be **independent** — one test's outcome should not affect another. Violations:
- Shared mutable state (global variables, class variables)
- Tests that depend on execution order
- Tests that leave side effects (files, DB records)

```python
# Bad — shared state
class TestCounter:
    counter = Counter()  # shared between tests!

    def test_increment(self):
        self.counter.increment()
        assert self.counter.value == 1

    def test_reset(self):
        self.counter.reset()
        assert self.counter.value == 0  # may fail if test_increment ran first

# Good — fresh instance per test
class TestCounter:
    def setup_method(self):
        self.counter = Counter()  # fresh each test

    def test_increment(self):
        self.counter.increment()
        assert self.counter.value == 1
```

### Q4: What is property-based testing?
**Answer:**
Instead of specific examples, generate random inputs and verify properties hold.

```python
from hypothesis import given, strategies as st

@given(st.lists(st.integers()))
def test_sort_is_idempotent(lst):
    """Sorting twice gives same result as sorting once."""
    assert sorted(sorted(lst)) == sorted(lst)

@given(st.integers(), st.integers())
def test_add_commutative(a, b):
    assert add(a, b) == add(b, a)
```
