"""
Benchmarking utilities.

Usage:
    from utils.benchmarks import benchmark, compare, profile_memory

    @benchmark(runs=1000)
    def my_function():
        return sum(range(1000))

    compare({
        'list comp': lambda: [x**2 for x in range(1000)],
        'map':       lambda: list(map(lambda x: x**2, range(1000))),
    })
"""

import gc
import sys
import time
import timeit
import tracemalloc
import functools
from typing import Callable, Any
from contextlib import contextmanager


# ── Timer Context Manager ─────────────────────────────────────────────────────

@contextmanager
def timer(label: str = '', precision: int = 3):
    """Context manager that prints elapsed time."""
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        prefix = f'{label}: ' if label else ''
        print(f'{prefix}{elapsed * 1000:.{precision}f}ms')


# ── Benchmark Decorator ───────────────────────────────────────────────────────

def benchmark(runs: int = 1000, warmup: int = 10):
    """Decorator that benchmarks a function."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Warmup
            for _ in range(warmup):
                func(*args, **kwargs)

            # Benchmark
            gc.disable()
            start = time.perf_counter()
            for _ in range(runs):
                result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            gc.enable()

            avg_ms = elapsed * 1000 / runs
            total_ms = elapsed * 1000
            print(f'{func.__name__}: {avg_ms:.4f}ms avg ({runs} runs, {total_ms:.2f}ms total)')
            return result
        return wrapper
    return decorator


# ── Compare Functions ─────────────────────────────────────────────────────────

def compare(
    funcs: dict[str, Callable],
    runs: int = 10000,
    setup: str = 'pass',
    show_relative: bool = True,
) -> dict[str, float]:
    """
    Compare multiple functions by timing them.

    Args:
        funcs:         Dict of {name: callable}
        runs:          Number of runs per function
        show_relative: Show relative performance vs fastest

    Returns:
        Dict of {name: time_ms}
    """
    results = {}
    for name, func in funcs.items():
        t = timeit.timeit(func, number=runs)
        results[name] = t * 1000  # ms total

    # Sort by time
    sorted_results = sorted(results.items(), key=lambda x: x[1])
    fastest_time = sorted_results[0][1]

    print(f'\n{"Function":<30} {"Total(ms)":>12} {"Avg(µs)":>10} {"Relative":>10}')
    print('-' * 65)
    for name, total_ms in sorted_results:
        avg_us = total_ms * 1000 / runs
        relative = total_ms / fastest_time
        marker = ' ← fastest' if relative == 1.0 else ''
        print(f'{name:<30} {total_ms:>12.2f} {avg_us:>10.3f} {relative:>9.2f}x{marker}')

    return results


# ── Memory Profiler ───────────────────────────────────────────────────────────

@contextmanager
def profile_memory(label: str = ''):
    """Context manager that measures peak memory usage."""
    tracemalloc.start()
    try:
        yield
    finally:
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        prefix = f'{label}: ' if label else ''
        print(f'{prefix}current={current/1024:.1f}KB, peak={peak/1024:.1f}KB')


def memory_of(func: Callable, *args, **kwargs) -> tuple[Any, int]:
    """Run a function and return (result, peak_memory_bytes)."""
    tracemalloc.start()
    result = func(*args, **kwargs)
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return result, peak


# ── Size Inspector ────────────────────────────────────────────────────────────

def deep_sizeof(obj: Any, seen: set | None = None) -> int:
    """Recursively calculate total memory size of an object."""
    if seen is None:
        seen = set()
    obj_id = id(obj)
    if obj_id in seen:
        return 0
    seen.add(obj_id)
    size = sys.getsizeof(obj)
    if isinstance(obj, dict):
        size += sum(deep_sizeof(k, seen) + deep_sizeof(v, seen) for k, v in obj.items())
    elif isinstance(obj, (list, tuple, set, frozenset)):
        size += sum(deep_sizeof(item, seen) for item in obj)
    return size


if __name__ == '__main__':
    # Demo timer
    with timer('list comprehension'):
        result = [x**2 for x in range(100_000)]

    # Demo compare
    compare({
        'list comp':    lambda: [x**2 for x in range(1000)],
        'map+lambda':   lambda: list(map(lambda x: x**2, range(1000))),
        'map+pow':      lambda: list(map(pow, range(1000), [2]*1000)),
        'for loop':     lambda: [x**2 for x in range(1000)],
    }, runs=5000)

    # Demo memory
    with profile_memory('list 1M'):
        lst = [x**2 for x in range(1_000_000)]

    with profile_memory('generator 1M'):
        total = sum(x**2 for x in range(1_000_000))

    # Deep size
    d = {'key': [1, 2, 3], 'nested': {'a': 'hello'}}
    print(f'\nDeep size of dict: {deep_sizeof(d)} bytes')
