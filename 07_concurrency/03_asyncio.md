# Python asyncio — Asynchronous Programming

## 1. async/await Basics

```python
import asyncio

# A coroutine — defined with async def
async def greet(name, delay):
    print(f"Hello, {name}!")
    await asyncio.sleep(delay)  # non-blocking sleep
    print(f"Goodbye, {name}!")
    return f"Done with {name}"

# Run a single coroutine
result = asyncio.run(greet("Alice", 1))
print(result)

# await — suspends the coroutine until the awaitable completes
# Can only be used inside async functions
async def main():
    result = await greet("Bob", 0.5)
    print(result)

asyncio.run(main())
```

---

## 2. Event Loop

```python
import asyncio

# asyncio.run() — creates and runs an event loop (Python 3.7+)
async def main():
    print("Running in event loop")

asyncio.run(main())  # preferred way

# Low-level event loop access (rarely needed)
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
try:
    loop.run_until_complete(main())
finally:
    loop.close()

# Get current event loop (inside async context)
async def check_loop():
    loop = asyncio.get_event_loop()
    print(f"Loop: {loop}")
    print(f"Running: {loop.is_running()}")
```

---

## 3. Coroutines and Tasks

```python
import asyncio
import time

async def fetch_data(url, delay):
    """Simulate an async HTTP request."""
    print(f"Fetching {url}...")
    await asyncio.sleep(delay)  # simulate network I/O
    return f"Data from {url}"

# Sequential — slow
async def sequential():
    start = time.perf_counter()
    r1 = await fetch_data("url1", 1)
    r2 = await fetch_data("url2", 1)
    r3 = await fetch_data("url3", 1)
    elapsed = time.perf_counter() - start
    print(f"Sequential: {elapsed:.2f}s")  # ~3s

# Concurrent with asyncio.gather — fast
async def concurrent():
    start = time.perf_counter()
    r1, r2, r3 = await asyncio.gather(
        fetch_data("url1", 1),
        fetch_data("url2", 1),
        fetch_data("url3", 1),
    )
    elapsed = time.perf_counter() - start
    print(f"Concurrent: {elapsed:.2f}s")  # ~1s

asyncio.run(concurrent())
```

---

## 4. `asyncio.gather`, `asyncio.wait`, `asyncio.create_task`

```python
import asyncio

async def task(name, delay):
    await asyncio.sleep(delay)
    return f"{name} done"

# asyncio.gather — run concurrently, return all results
async def use_gather():
    results = await asyncio.gather(
        task("A", 1),
        task("B", 0.5),
        task("C", 0.3),
    )
    print(results)  # ['A done', 'B done', 'C done'] — in input order

    # With return_exceptions=True — exceptions don't cancel others
    results = await asyncio.gather(
        task("A", 1),
        asyncio.sleep(0),  # will raise if we make it fail
        task("C", 0.3),
        return_exceptions=True,
    )

# asyncio.create_task — schedule coroutine as Task
async def use_create_task():
    # Tasks start running immediately (not waiting for await)
    t1 = asyncio.create_task(task("A", 1), name="task-A")
    t2 = asyncio.create_task(task("B", 0.5), name="task-B")

    # Do other work while tasks run
    print("Tasks created, doing other work...")
    await asyncio.sleep(0.1)

    # Wait for results
    r1 = await t1
    r2 = await t2
    print(r1, r2)

    # Cancel a task
    t3 = asyncio.create_task(task("C", 10))
    await asyncio.sleep(0.1)
    t3.cancel()
    try:
        await t3
    except asyncio.CancelledError:
        print("Task C was cancelled")

# asyncio.wait — more control over completion
async def use_wait():
    tasks = [asyncio.create_task(task(f"T{i}", i * 0.3)) for i in range(5)]

    # Wait for first to complete
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    print(f"First done: {len(done)}, still pending: {len(pending)}")

    # Cancel remaining
    for t in pending:
        t.cancel()

    # Wait for all
    done, pending = await asyncio.wait(tasks, timeout=5)
```

---

## 5. `asyncio.Queue`

```python
import asyncio
import random

async def producer(queue, n):
    for i in range(n):
        item = random.randint(1, 100)
        await queue.put(item)
        print(f"Produced: {item}")
        await asyncio.sleep(0.1)
    await queue.put(None)  # sentinel

async def consumer(queue, name):
    total = 0
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break
        total += item
        print(f"{name} consumed: {item}")
        queue.task_done()
        await asyncio.sleep(0.05)
    return total

async def main():
    queue = asyncio.Queue(maxsize=5)

    prod = asyncio.create_task(producer(queue, 10))
    cons = asyncio.create_task(consumer(queue, "Consumer"))

    await prod
    total = await cons
    print(f"Total: {total}")

asyncio.run(main())
```

---

## 6. aiohttp Pattern

```python
# aiohttp — async HTTP client (install: pip install aiohttp)
import asyncio
import aiohttp

async def fetch(session, url):
    async with session.get(url) as response:
        return await response.text()

async def fetch_all(urls):
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
    return results

# Without aiohttp — using asyncio with urllib (for demo)
import asyncio
import urllib.request
from concurrent.futures import ThreadPoolExecutor

async def fetch_url_async(url, executor):
    loop = asyncio.get_event_loop()
    # Run blocking I/O in thread pool
    response = await loop.run_in_executor(
        executor,
        urllib.request.urlopen,
        url
    )
    return response.read()

async def main():
    urls = ["https://httpbin.org/delay/1"] * 5
    with ThreadPoolExecutor(max_workers=5) as executor:
        tasks = [fetch_url_async(url, executor) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

---

## 7. Async Context Managers

```python
import asyncio

# Implement async context manager
class AsyncDatabase:
    def __init__(self, url):
        self.url = url
        self.connection = None

    async def __aenter__(self):
        print(f"Connecting to {self.url}")
        await asyncio.sleep(0.1)  # simulate connection
        self.connection = {'url': self.url, 'open': True}
        return self.connection

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        print(f"Closing connection to {self.url}")
        await asyncio.sleep(0.05)  # simulate cleanup
        self.connection['open'] = False
        return False

async def main():
    async with AsyncDatabase("postgresql://localhost/mydb") as conn:
        print(f"Connected: {conn}")
        await asyncio.sleep(0.1)  # do work
    print("Connection closed")

asyncio.run(main())

# contextlib.asynccontextmanager
from contextlib import asynccontextmanager

@asynccontextmanager
async def managed_resource(name):
    print(f"Acquiring {name}")
    await asyncio.sleep(0.05)
    try:
        yield {'name': name, 'active': True}
    finally:
        print(f"Releasing {name}")
        await asyncio.sleep(0.05)

async def use_resource():
    async with managed_resource("cache") as res:
        print(f"Using {res['name']}")

asyncio.run(use_resource())
```

---

## 8. Async Generators

```python
import asyncio

# Async generator — yields values asynchronously
async def async_range(start, stop, delay=0.1):
    for i in range(start, stop):
        await asyncio.sleep(delay)
        yield i

# Async for loop
async def consume_async_gen():
    async for value in async_range(0, 5):
        print(f"Got: {value}")

asyncio.run(consume_async_gen())

# Async comprehension
async def async_comprehension():
    results = [x async for x in async_range(0, 5, delay=0.05)]
    print(results)

asyncio.run(async_comprehension())

# Async generator with send/throw
async def async_accumulator():
    total = 0
    while True:
        value = yield total
        if value is None:
            break
        total += value
```

---

## 9. Error Handling in asyncio

```python
import asyncio

async def might_fail(n):
    await asyncio.sleep(0.1)
    if n % 3 == 0:
        raise ValueError(f"Task {n} failed")
    return n * 2

# gather with return_exceptions
async def handle_errors():
    results = await asyncio.gather(
        *[might_fail(i) for i in range(6)],
        return_exceptions=True
    )
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Task {i} error: {result}")
        else:
            print(f"Task {i} result: {result}")

asyncio.run(handle_errors())

# TaskGroup (Python 3.11+) — structured concurrency
async def use_task_group():
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(might_fail(1))
        t2 = tg.create_task(might_fail(2))
        t3 = tg.create_task(might_fail(4))
    # All tasks complete before exiting the block
    print(t1.result(), t2.result(), t3.result())
```

---

## Interview Questions

**Q1: What is the difference between threading and asyncio?**

Answer: Both handle concurrency, but differently. Threading uses OS threads — the OS switches between them (preemptive multitasking). asyncio uses a single thread with cooperative multitasking — coroutines explicitly yield control with `await`. asyncio is better for high-concurrency I/O (thousands of connections) with lower overhead. Threading is simpler for moderate concurrency and works with blocking libraries. asyncio requires async-compatible libraries throughout.

---

**Q2: What is a coroutine and how does it differ from a regular function?**

Answer: A coroutine is a function defined with `async def` that can be suspended and resumed. When called, it returns a coroutine object (not the result) — it doesn't execute until awaited. Regular functions execute to completion when called. Coroutines can `await` other awaitables (coroutines, Tasks, Futures), suspending execution without blocking the thread.

```python
async def coro():
    return 42

obj = coro()      # returns coroutine object, doesn't run!
result = await obj  # runs and returns 42
```

---

**Q3: What is the difference between `asyncio.gather` and `asyncio.create_task`?**

Answer: `create_task` schedules a coroutine as a Task immediately — it starts running in the background. `gather` takes multiple awaitables and runs them concurrently, returning all results. `gather` is higher-level and more convenient. `create_task` gives you a `Task` object you can cancel, check status, or add callbacks to. Use `gather` for simple concurrent execution; use `create_task` when you need task management.

---

**Q4: What does `await asyncio.sleep(0)` do?**

Answer: It yields control back to the event loop for one iteration, allowing other tasks to run. It's the asyncio equivalent of `time.sleep(0)` — a "checkpoint" that lets the event loop process other pending tasks. Use it in CPU-intensive async code to prevent starving other coroutines.

---

**Q5: What is the difference between `asyncio.wait` and `asyncio.gather`?**

Answer: `gather` takes coroutines/awaitables and returns results in input order. `wait` takes Task objects and returns sets of done/pending tasks. `wait` supports `return_when` parameter: `FIRST_COMPLETED`, `FIRST_EXCEPTION`, `ALL_COMPLETED`. `gather` is simpler; `wait` gives more control over partial completion and cancellation.

---

**Q6: How do you run blocking code in an async context?**

Answer: Use `loop.run_in_executor()` to run blocking code in a thread pool without blocking the event loop:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def main():
    loop = asyncio.get_event_loop()
    # Run blocking function in thread pool
    result = await loop.run_in_executor(None, blocking_function, arg1, arg2)
    # Or with explicit executor:
    with ThreadPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, blocking_function)
```

---

**Q7: What is an async context manager?**

Answer: An async context manager implements `__aenter__` and `__aexit__` (both async methods) and is used with `async with`. It allows awaiting during setup and teardown — essential for async resources like database connections, HTTP sessions, and file handles. Use `@asynccontextmanager` from `contextlib` for generator-based async context managers.

---

**Q8: What is an async generator?**

Answer: An async generator is defined with `async def` and uses `yield`. It can `await` between yields. Consumed with `async for` or async comprehensions. Use cases: streaming data from async sources, paginated API responses, real-time data feeds.

```python
async def stream_data():
    for i in range(10):
        await asyncio.sleep(0.1)
        yield i

async for item in stream_data():
    process(item)
```

---

**Q9: What is `asyncio.TaskGroup` (Python 3.11+)?**

Answer: `TaskGroup` provides structured concurrency — all tasks created within the group must complete before the `async with` block exits. If any task raises an exception, all other tasks are cancelled and an `ExceptionGroup` is raised. It's safer than `gather` because it ensures no tasks are left running after the block exits.

---

**Q10: When should you use asyncio vs threading vs multiprocessing?**

Answer:
- **asyncio**: High-concurrency I/O (web servers, API clients, chat servers) — thousands of concurrent connections with low overhead. Requires async-compatible libraries.
- **threading**: Moderate I/O concurrency, when you need to use blocking libraries, GUI applications. Simpler than asyncio.
- **multiprocessing**: CPU-bound tasks (data processing, ML, image processing) — bypasses the GIL for true parallelism.
- **Rule of thumb**: asyncio > threading for I/O; multiprocessing for CPU.
