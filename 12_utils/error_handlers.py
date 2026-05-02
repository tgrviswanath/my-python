"""
Reusable error handling patterns.

Includes: retry, circuit breaker, fallback, timeout, result type.
"""

import asyncio
import functools
import time
import threading
from enum import Enum
from typing import Any, Callable, TypeVar, Generic
from dataclasses import dataclass, field

F = TypeVar('F', bound=Callable)
T = TypeVar('T')


# ── Result Type ───────────────────────────────────────────────────────────────

@dataclass
class Result(Generic[T]):
    """Explicit success/failure type — avoids exceptions for expected failures."""
    _value: T | None = None
    _error: str | None = None

    @classmethod
    def ok(cls, value: T) -> 'Result[T]':
        return cls(_value=value)

    @classmethod
    def err(cls, error: str) -> 'Result[T]':
        return cls(_error=error)

    @property
    def is_ok(self) -> bool:
        return self._error is None

    @property
    def value(self) -> T:
        if not self.is_ok:
            raise ValueError(f'Result is error: {self._error}')
        return self._value

    @property
    def error(self) -> str:
        return self._error or ''

    def unwrap_or(self, default: T) -> T:
        return self._value if self.is_ok else default

    def map(self, func: Callable[[T], Any]) -> 'Result':
        if self.is_ok:
            try:
                return Result.ok(func(self._value))
            except Exception as e:
                return Result.err(str(e))
        return self

    def __repr__(self) -> str:
        if self.is_ok:
            return f'Ok({self._value!r})'
        return f'Err({self._error!r})'


# ── Retry Decorator ───────────────────────────────────────────────────────────

def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,),
    on_retry: Callable | None = None,
):
    """
    Retry decorator with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts
        delay:        Initial delay between retries (seconds)
        backoff:      Multiplier for delay on each retry
        exceptions:   Exception types to catch and retry
        on_retry:     Optional callback(attempt, exception, delay)
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            current_delay = delay
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt == max_attempts:
                        break
                    if on_retry:
                        on_retry(attempt, e, current_delay)
                    time.sleep(current_delay)
                    current_delay *= backoff
            raise last_exc
        return wrapper
    return decorator


def async_retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,),
):
    """Async version of retry decorator."""
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_delay = delay
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt == max_attempts:
                        break
                    await asyncio.sleep(current_delay)
                    current_delay *= backoff
            raise last_exc
        return wrapper
    return decorator


# ── Circuit Breaker ───────────────────────────────────────────────────────────

class CircuitState(Enum):
    CLOSED   = 'closed'    # normal operation
    OPEN     = 'open'      # failing, reject requests
    HALF_OPEN = 'half_open' # testing recovery


class CircuitBreaker:
    """
    Circuit breaker pattern.

    States:
    - CLOSED: normal, requests pass through
    - OPEN: too many failures, requests rejected immediately
    - HALF_OPEN: testing if service recovered
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: float | None = None
        self._lock = threading.Lock()

    @property
    def state(self) -> CircuitState:
        with self._lock:
            if self._state == CircuitState.OPEN:
                if time.time() - self._last_failure_time > self.recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._success_count = 0
            return self._state

    def call(self, func: Callable, *args, **kwargs) -> Any:
        state = self.state
        if state == CircuitState.OPEN:
            raise RuntimeError(f'Circuit breaker is OPEN — service unavailable')

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
            elif self._state == CircuitState.CLOSED:
                self._failure_count = 0

    def _on_failure(self):
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN

    def __call__(self, func: F) -> F:
        """Use as decorator."""
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return self.call(func, *args, **kwargs)
        return wrapper

    def __repr__(self) -> str:
        return f'CircuitBreaker(state={self.state.value}, failures={self._failure_count})'


# ── Timeout ───────────────────────────────────────────────────────────────────

def with_timeout(seconds: float):
    """Decorator: raise TimeoutError if function takes too long."""
    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            result = [None]
            error  = [None]

            def target():
                try:
                    result[0] = func(*args, **kwargs)
                except Exception as e:
                    error[0] = e

            t = threading.Thread(target=target, daemon=True)
            t.start()
            t.join(timeout=seconds)

            if t.is_alive():
                raise TimeoutError(f'{func.__name__} timed out after {seconds}s')
            if error[0]:
                raise error[0]
            return result[0]
        return wrapper
    return decorator


if __name__ == '__main__':
    # Demo Result type
    def safe_divide(a, b) -> Result[float]:
        if b == 0:
            return Result.err('Division by zero')
        return Result.ok(a / b)

    r = safe_divide(10, 2)
    print(r)                          # Ok(5.0)
    print(r.map(lambda x: x * 2))    # Ok(10.0)

    r2 = safe_divide(10, 0)
    print(r2)                         # Err('Division by zero')
    print(r2.unwrap_or(0.0))          # 0.0

    # Demo retry
    attempts = 0

    @retry(max_attempts=3, delay=0.01)
    def flaky():
        global attempts
        attempts += 1
        if attempts < 3:
            raise ConnectionError(f'Failed attempt {attempts}')
        return 'success'

    print(flaky())  # success (after 3 attempts)

    # Demo circuit breaker
    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=1.0)
    fail_count = 0

    def unreliable():
        global fail_count
        fail_count += 1
        if fail_count <= 3:
            raise ConnectionError('Service down')
        return 'ok'

    for i in range(6):
        try:
            result = cb.call(unreliable)
            print(f'Call {i+1}: {result} | {cb}')
        except Exception as e:
            print(f'Call {i+1}: {type(e).__name__}: {e} | {cb}')
