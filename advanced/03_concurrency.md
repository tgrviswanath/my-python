# Concurrency in Python — Deep Dive

## Table of Contents
1. [The GIL](#1-the-gil)
2. [threading Module](#2-threading-module)
3. [multiprocessing Module](#3-multiprocessing-module)
4. [asyncio](#4-asyncio)
5. [concurrent.futures](#5-concurrentfutures)
6. [Decision Matrix](#6-decision-matrix)
7. [Race Conditions, Deadlocks & Starvation](#7-race-conditions-deadlocks--starvation)
8. [Thread-Safe Data Structures](#8-thread-safe-data-structures)
9. [Performance Notes](#9-performance-notes)
10. [Common Bugs](#10-common-bugs)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The GIL

The **Global Interpreter Lock (GIL)** is a mutex in CPython that ensures only one thread executes Python bytecode at a time. It protects CPython's reference counting memory model from race conditions.

### Internals

- The GIL is implemented as a `PyMutex` (or `pthread_mutex` on POSIX).
- CPython checks whether to release the GIL every **5ms** by default (changed from 100 bytecodes in Python 3.2).
- Check interval: `sys.getswitchinterval()` → `0.005` (5ms). Set with `sys.setswitchinterval(seconds)`.
- The GIL is released during I/O operations, C extension calls, and `time.sleep()`.

```python
import sys
print(sys.getswitchinterval())   # 0.005 (5 milliseconds)
sys.setswitchinterval(0.001)     # switch every 1ms (more context switches)
```

### GIL implications

| Scenario | GIL Impact |
|----------|-----------|
| CPU-bound Python code | Threads don't parallelize — GIL prevents true parallelism |
| I/O-bound code | Threads work well — GIL released during I/O waits |
| NumPy/C extensions | Often release GIL — true parallelism possible |
| multiprocessing | No GIL — each process has its own interpreter |

### Python 3.13: GIL becomes optional

PEP 703 (Python 3.13) introduces a free-threaded build (`--disable-gil`). The `PYTHON_GIL=0` env var or `-X gil=0` flag disables it. This is experimental as of 3.13.

```python
import sys
# Check if running in free-threaded mode (Python 3.13+)
# sys._is_gil_enabled() → False if GIL disabled
```

---

## 2. threading Module

### Thread creation

```python
import threading
import time

def worker(name, delay):
    print(f"Thread {name} starting")
    time.sleep(delay)
    print(f"Thread {name} done")

# Method 1: Thread with target function
t = threading.Thread(target=worker, args=("A", 1), daemon=True)
t.start()
t.join()   # wait for completion

# Method 2: Subclassing Thread
class MyThread(threading.Thread):
    def __init__(self, name):
        super().__init__(name=name, daemon=True)

    def run(self):
        print(f"{self.name} running")

t = MyThread("Worker-1")
t.start()
t.join()
```

### Lock — mutual exclusion

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:   # acquire/release automatically
            counter += 1

threads = [threading.Thread(target=increment) for _ in range(5)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)   # always 500000 with lock; random without
```

### RLock — reentrant lock

```python
# RLock can be acquired multiple times by the same thread
rlock = threading.RLock()

def outer():
    with rlock:
        inner()   # same thread can acquire again

def inner():
    with rlock:   # would deadlock with regular Lock!
        print("inner")
```

### Semaphore — limit concurrent access

```python
# Allow at most 3 concurrent database connections
db_semaphore = threading.Semaphore(3)

def query_db(query_id):
    with db_semaphore:
        print(f"Query {query_id} running")
        time.sleep(0.1)
        print(f"Query {query_id} done")

threads = [threading.Thread(target=query_db, args=(i,)) for i in range(10)]
for t in threads: t.start()
for t in threads: t.join()
```

### Event — thread signaling

```python
event = threading.Event()

def waiter():
    print("Waiting for event...")
    event.wait()   # blocks until event.set()
    print("Event received!")

def setter():
    time.sleep(2)
    print("Setting event")
    event.set()

threading.Thread(target=waiter).start()
threading.Thread(target=setter).start()
```

### Condition — wait/notify pattern

```python
condition = threading.Condition()
items = []

def producer():
    for i in range(5):
        with condition:
            items.append(i)
            print(f"Produced {i}")
            condition.notify()   # wake one waiting consumer
        time.sleep(0.1)

def consumer():
    while True:
        with condition:
            while not items:
                condition.wait()   # release lock and wait
            item = items.pop(0)
            print(f"Consumed {item}")
```

### Barrier — synchronize N threads

```python
barrier = threading.Barrier(3)   # wait for 3 threads

def phase_worker(name):
    print(f"{name}: phase 1 done")
    barrier.wait()   # all 3 must reach here before any continues
    print(f"{name}: phase 2 starting")

threads = [threading.Thread(target=phase_worker, args=(f"T{i}",)) for i in range(3)]
for t in threads: t.start()
for t in threads: t.join()
```

### ThreadPoolExecutor

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch(url):
    import urllib.request
    return urllib.request.urlopen(url).read()[:100]

urls = ['http://example.com', 'http://python.org']

with ThreadPoolExecutor(max_workers=4) as executor:
    # submit returns Future objects
    futures = {executor.submit(fetch, url): url for url in urls}
    for future in as_completed(futures):
        url = futures[future]
        try:
            data = future.result()
            print(f"{url}: {len(data)} bytes")
        except Exception as e:
            print(f"{url} failed: {e}")
```

---

## 3. multiprocessing Module

### Process

```python
from multiprocessing import Process
import os

def worker(name):
    print(f"Worker {name}, PID: {os.getpid()}")

if __name__ == '__main__':   # REQUIRED on Windows/macOS
    p = Process(target=worker, args=("A",))
    p.start()
    p.join()
    print(f"Exit code: {p.exitcode}")
```

### Pool — parallel map

```python
from multiprocessing import Pool
import math

def cpu_task(n):
    return sum(math.sqrt(i) for i in range(n))

if __name__ == '__main__':
    with Pool(processes=4) as pool:
        # map: blocks until all done
        results = pool.map(cpu_task, [100_000] * 8)

        # imap: lazy iterator
        for result in pool.imap(cpu_task, [100_000] * 8):
            print(result)

        # starmap: multiple arguments
        results = pool.starmap(pow, [(2, 10), (3, 5), (4, 3)])
```

### Queue — inter-process communication

```python
from multiprocessing import Process, Queue

def producer(q):
    for i in range(5):
        q.put(i)
    q.put(None)   # sentinel

def consumer(q):
    while True:
        item = q.get()
        if item is None:
            break
        print(f"Got: {item}")

if __name__ == '__main__':
    q = Queue()
    p1 = Process(target=producer, args=(q,))
    p2 = Process(target=consumer, args=(q,))
    p1.start(); p2.start()
    p1.join(); p2.join()
```

### Pipe — bidirectional communication

```python
from multiprocessing import Process, Pipe

def child(conn):
    conn.send("Hello from child")
    msg = conn.recv()
    print(f"Child received: {msg}")
    conn.close()

if __name__ == '__main__':
    parent_conn, child_conn = Pipe()
    p = Process(target=child, args=(child_conn,))
    p.start()
    print(f"Parent received: {parent_conn.recv()}")
    parent_conn.send("Hello from parent")
    p.join()
```

### Manager — shared state

```python
from multiprocessing import Process, Manager

def worker(shared_dict, key, value):
    shared_dict[key] = value

if __name__ == '__main__':
    with Manager() as manager:
        shared = manager.dict()
        processes = [
            Process(target=worker, args=(shared, f"key{i}", i))
            for i in range(5)
        ]
        for p in processes: p.start()
        for p in processes: p.join()
        print(dict(shared))
```

### Shared memory (Python 3.8+)

```python
from multiprocessing import Process
from multiprocessing.shared_memory import SharedMemory
import numpy as np

def modify_array(shm_name, shape, dtype):
    shm = SharedMemory(name=shm_name)
    arr = np.ndarray(shape, dtype=dtype, buffer=shm.buf)
    arr[:] = arr * 2   # modify in-place
    shm.close()

if __name__ == '__main__':
    data = np.array([1, 2, 3, 4, 5], dtype=np.int64)
    shm = SharedMemory(create=True, size=data.nbytes)
    shared_arr = np.ndarray(data.shape, dtype=data.dtype, buffer=shm.buf)
    shared_arr[:] = data

    p = Process(target=modify_array, args=(shm.name, data.shape, data.dtype))
    p.start()
    p.join()
    print(shared_arr)   # [2, 4, 6, 8, 10]
    shm.close()
    shm.unlink()
```

### ProcessPoolExecutor

```python
from concurrent.futures import ProcessPoolExecutor

def heavy_computation(n):
    return sum(i**2 for i in range(n))

if __name__ == '__main__':
    with ProcessPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(heavy_computation, [10**6] * 8))
```

---

## 4. asyncio

### Event loop and coroutines

```python
import asyncio

async def fetch_data(url, delay):
    """Simulated async I/O."""
    print(f"Fetching {url}")
    await asyncio.sleep(delay)   # yields control to event loop
    return f"Data from {url}"

async def main():
    result = await fetch_data("http://example.com", 1)
    print(result)

asyncio.run(main())   # Python 3.7+
```

### Tasks — concurrent coroutines

```python
async def main():
    # gather: run concurrently, wait for all
    results = await asyncio.gather(
        fetch_data("url1", 1),
        fetch_data("url2", 2),
        fetch_data("url3", 0.5),
    )
    # Total time ≈ 2s (max), not 3.5s (sum)
    print(results)

    # create_task: schedule without waiting immediately
    task1 = asyncio.create_task(fetch_data("url1", 1))
    task2 = asyncio.create_task(fetch_data("url2", 2))
    # ... do other work ...
    result1 = await task1
    result2 = await task2
```

### asyncio.wait — fine-grained control

```python
async def main():
    tasks = [asyncio.create_task(fetch_data(f"url{i}", i*0.5)) for i in range(5)]

    # FIRST_COMPLETED: process results as they arrive
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in done:
        print(await task)

    # Cancel remaining
    for task in pending:
        task.cancel()
```

### Timeout

```python
async def main():
    try:
        result = await asyncio.wait_for(fetch_data("slow_url", 10), timeout=2.0)
    except asyncio.TimeoutError:
        print("Request timed out")

    # Python 3.11+: asyncio.timeout context manager
    async with asyncio.timeout(2.0):
        result = await fetch_data("slow_url", 10)
```

### asyncio.Queue — producer/consumer

```python
async def producer(queue, n):
    for i in range(n):
        await queue.put(i)
        await asyncio.sleep(0.1)
    await queue.put(None)   # sentinel

async def consumer(queue):
    while True:
        item = await queue.get()
        if item is None:
            break
        print(f"Processing {item}")
        queue.task_done()

async def main():
    queue = asyncio.Queue(maxsize=5)
    await asyncio.gather(
        producer(queue, 10),
        consumer(queue),
    )
```

### aiohttp pattern

```python
import asyncio
import aiohttp

async def fetch(session, url):
    async with session.get(url) as response:
        return await response.text()

async def fetch_all(urls):
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, url) for url in urls]
        return await asyncio.gather(*tasks)

# asyncio.run(fetch_all(['http://example.com', 'http://python.org']))
```

### Async context managers and iterators

```python
class AsyncDB:
    async def __aenter__(self):
        print("Connecting to DB")
        await asyncio.sleep(0.1)
        return self

    async def __aexit__(self, *args):
        print("Closing DB connection")
        await asyncio.sleep(0.1)

    async def __aiter__(self):
        for i in range(5):
            await asyncio.sleep(0.1)
            yield i   # async generator

async def main():
    async with AsyncDB() as db:
        async for row in db:
            print(row)
```

---

## 5. concurrent.futures

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import time

def task(n):
    time.sleep(n)
    return n * 2

# ThreadPoolExecutor — I/O bound
with ThreadPoolExecutor(max_workers=4) as executor:
    # map: ordered results, blocks until all done
    results = list(executor.map(task, [1, 2, 3]))

    # submit + as_completed: results in completion order
    futures = [executor.submit(task, i) for i in [3, 1, 2]]
    for future in as_completed(futures):
        print(future.result())   # prints 2, 4, 6 in completion order

# ProcessPoolExecutor — CPU bound
with ProcessPoolExecutor(max_workers=4) as executor:
    futures = {executor.submit(task, i): i for i in range(10)}
    for future in as_completed(futures):
        n = futures[future]
        try:
            result = future.result(timeout=5)
        except Exception as e:
            print(f"Task {n} failed: {e}")
```

### Future object

```python
future = executor.submit(task, 5)
print(future.running())    # True if currently executing
print(future.done())       # True if finished
print(future.cancelled())  # True if cancelled
future.cancel()            # attempt to cancel (only if not started)
result = future.result(timeout=10)   # blocks; raises exception if task raised
exception = future.exception()       # returns exception or None
future.add_done_callback(lambda f: print(f.result()))
```

---

## 6. Decision Matrix

| Scenario | Best Choice | Why |
|----------|------------|-----|
| I/O-bound, many connections | `asyncio` | Single thread, no overhead, scales to thousands |
| I/O-bound, simple | `ThreadPoolExecutor` | Simpler code, good for moderate concurrency |
| CPU-bound, pure Python | `ProcessPoolExecutor` / `multiprocessing` | Bypasses GIL |
| CPU-bound, NumPy/C ext | `ThreadPoolExecutor` | C extensions release GIL |
| Mixed I/O + CPU | `asyncio` + `ProcessPoolExecutor` | Run CPU tasks in executor |
| Background tasks | `threading.Thread(daemon=True)` | Simple, low overhead |
| Shared state needed | `threading` + locks | Shared memory space |
| Isolated processes | `multiprocessing` | No shared state, safer |

```python
# Running CPU-bound work from asyncio
import asyncio
from concurrent.futures import ProcessPoolExecutor

def cpu_bound(n):
    return sum(i**2 for i in range(n))

async def main():
    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, cpu_bound, 10**7)
    print(result)
```

---

## 7. Race Conditions, Deadlocks & Starvation

### Race condition

```python
import threading

# UNSAFE: read-modify-write is not atomic
counter = 0
def unsafe_increment():
    global counter
    for _ in range(100_000):
        counter += 1   # 3 bytecodes: LOAD, ADD, STORE — not atomic!

# SAFE: use lock
lock = threading.Lock()
def safe_increment():
    global counter
    for _ in range(100_000):
        with lock:
            counter += 1
```

### Deadlock

```python
import threading

lock_a = threading.Lock()
lock_b = threading.Lock()

def thread1():
    with lock_a:
        time.sleep(0.1)
        with lock_b:   # waits for lock_b
            print("Thread 1 done")

def thread2():
    with lock_b:
        time.sleep(0.1)
        with lock_a:   # waits for lock_a — DEADLOCK!
            print("Thread 2 done")

# Prevention: always acquire locks in the same order
def thread1_safe():
    with lock_a:
        with lock_b:
            print("Thread 1 done")

def thread2_safe():
    with lock_a:   # same order as thread1_safe
        with lock_b:
            print("Thread 2 done")

# Or use threading.Lock with timeout:
def thread_with_timeout():
    if lock_a.acquire(timeout=1):
        try:
            if lock_b.acquire(timeout=1):
                try:
                    pass  # critical section
                finally:
                    lock_b.release()
        finally:
            lock_a.release()
```

### Starvation

Starvation occurs when a thread is perpetually denied access to a resource. Common causes:
- Priority inversion: low-priority thread holds a lock needed by high-priority thread
- Unfair scheduling: some threads always win the lock race

Prevention: use `threading.Semaphore` with fair queuing, or `queue.Queue` for work distribution.

---

## 8. Thread-Safe Data Structures

```python
import queue
import threading

# queue.Queue — thread-safe FIFO
q = queue.Queue(maxsize=10)
q.put(item)           # blocks if full
q.put_nowait(item)    # raises queue.Full if full
item = q.get()        # blocks if empty
item = q.get_nowait() # raises queue.Empty if empty
q.task_done()         # signal item processed
q.join()              # block until all items processed

# queue.LifoQueue — thread-safe stack
# queue.PriorityQueue — thread-safe priority queue

# collections.deque — thread-safe for append/appendleft/pop/popleft
from collections import deque
d = deque(maxlen=100)
d.append(1)    # thread-safe
d.appendleft(0)  # thread-safe

# threading.local — thread-local storage
local_data = threading.local()
def worker():
    local_data.value = threading.current_thread().name
    print(local_data.value)   # each thread sees its own value
```

---

## 9. Performance Notes

- **Thread creation overhead**: ~50-100μs per thread. Use thread pools for many short tasks.
- **Process creation overhead**: ~10-50ms per process (fork on Linux is faster than spawn on Windows/macOS). Use process pools.
- **asyncio overhead**: ~1μs per `await`. Excellent for I/O-bound with thousands of concurrent operations.
- **Lock contention**: High contention on a single lock serializes threads — consider lock striping or lock-free structures.
- **GIL thrashing**: Many threads competing for the GIL can be slower than single-threaded due to context switch overhead.
- **`multiprocessing.Pool.map`** has serialization overhead (pickle). Large data passed between processes is expensive.
- **Shared memory** (`multiprocessing.shared_memory`) avoids pickle overhead for numpy arrays.

```python
# Benchmark: threading vs multiprocessing vs asyncio
import time

# CPU-bound: multiprocessing wins
# I/O-bound: asyncio wins (lowest overhead)
# Mixed: asyncio + ProcessPoolExecutor
```

---

## 10. Common Bugs

### Bug 1: Missing `if __name__ == '__main__'` with multiprocessing

```python
# On Windows/macOS (spawn start method), child processes re-import the module
# Without the guard, this causes infinite process spawning
from multiprocessing import Process

def worker(): pass

# WRONG on Windows:
p = Process(target=worker)
p.start()

# CORRECT:
if __name__ == '__main__':
    p = Process(target=worker)
    p.start()
```

### Bug 2: Sharing non-picklable objects between processes

```python
# Lambdas, local functions, file handles cannot be pickled
from multiprocessing import Pool

# WRONG:
with Pool() as p:
    p.map(lambda x: x**2, range(10))   # PicklingError!

# CORRECT: use a module-level function
def square(x): return x**2
with Pool() as p:
    p.map(square, range(10))
```

### Bug 3: Forgetting to await coroutines

```python
async def main():
    result = fetch_data("url")   # BUG: coroutine object, not result!
    result = await fetch_data("url")   # CORRECT
```

### Bug 4: Blocking the event loop

```python
async def main():
    time.sleep(5)   # BUG: blocks entire event loop!
    await asyncio.sleep(5)   # CORRECT: yields control

    # For blocking I/O in asyncio:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, blocking_function, arg)
```

### Bug 5: Thread-unsafe global state

```python
# WRONG: dict operations are not always atomic
cache = {}
def get_or_compute(key):
    if key not in cache:   # check
        cache[key] = compute(key)   # set — race between check and set!
    return cache[key]

# CORRECT: use lock
lock = threading.Lock()
def get_or_compute(key):
    with lock:
        if key not in cache:
            cache[key] = compute(key)
        return cache[key]
```

---

## 11. Interview Q&A

**Q1: What is the GIL and why does Python have it?**

The Global Interpreter Lock is a mutex in CPython that allows only one thread to execute Python bytecode at a time. Python has it because CPython's memory management (reference counting) is not thread-safe. Without the GIL, concurrent reference count modifications would corrupt memory. The GIL simplifies CPython's implementation and makes single-threaded programs faster (no lock overhead), but prevents true CPU parallelism with threads.

---

**Q2: Does the GIL make Python threading useless?**

No. The GIL is released during I/O operations (network, disk, `time.sleep()`), so threading is effective for I/O-bound workloads. Multiple threads can overlap their I/O waits. The GIL only prevents parallelism for CPU-bound pure Python code. NumPy and other C extensions often release the GIL during computation, enabling true parallelism.

---

**Q3: When should you use threading vs multiprocessing?**

Use **threading** for I/O-bound tasks (network requests, file I/O, database queries) where threads spend most time waiting. Use **multiprocessing** for CPU-bound tasks (numerical computation, image processing, data transformation) where you need true parallelism. Multiprocessing bypasses the GIL by using separate processes with separate memory spaces.

---

**Q4: What is the difference between asyncio and threading?**

Threading uses OS threads with preemptive scheduling — the OS can switch threads at any time. asyncio uses cooperative multitasking — coroutines explicitly yield control at `await` points. asyncio is single-threaded, so no race conditions on shared state. asyncio scales better (thousands of concurrent operations with minimal overhead), while threading is limited by OS thread limits and has higher per-thread overhead.

---

**Q5: How do you prevent a deadlock?**

1. **Lock ordering**: always acquire multiple locks in the same global order.
2. **Lock timeout**: use `lock.acquire(timeout=N)` and handle failure.
3. **`threading.RLock`**: for recursive locking within the same thread.
4. **Avoid nested locks**: redesign to avoid holding multiple locks simultaneously.
5. **Use higher-level abstractions**: `queue.Queue`, `concurrent.futures` — they handle locking internally.

---

**Q6: What is `asyncio.gather()` vs `asyncio.wait()`?**

`gather(*coros)` runs coroutines concurrently and returns results in the same order as input. It cancels all tasks if one raises an exception (unless `return_exceptions=True`). `wait(tasks, return_when=...)` gives more control: `FIRST_COMPLETED`, `FIRST_EXCEPTION`, or `ALL_COMPLETED`. It returns `(done, pending)` sets and doesn't cancel pending tasks automatically. Use `gather` for simple "run all, get all results"; use `wait` for streaming results or partial completion.

---

**Q7: How does `concurrent.futures.as_completed()` work?**

`as_completed(futures)` returns an iterator that yields futures as they complete (in completion order, not submission order). Internally it uses a condition variable that futures signal when done. This is useful for processing results as soon as they're available rather than waiting for all to finish.

---

**Q8: What is a race condition and how do you detect one?**

A race condition occurs when the program's behavior depends on the relative timing of thread execution. Classic example: two threads reading and writing a shared variable without synchronization. Detection: use `threading.Lock` and look for unprotected read-modify-write patterns. Tools: Python's `threading` module doesn't have built-in race detectors, but you can use `ThreadSanitizer` (TSan) with CPython builds, or stress-test with many threads and iterations.

---

**Q9: What is the difference between `Pool.map()` and `Pool.imap()`?**

`Pool.map()` blocks until all results are ready and returns a list. `Pool.imap()` returns a lazy iterator — results are yielded as they complete (in order). `Pool.imap_unordered()` yields results in completion order (faster if order doesn't matter). Use `imap` for large iterables to avoid materializing all results in memory.

---

**Q10: How do you share data between processes safely?**

Options:
1. **`multiprocessing.Queue`**: thread/process-safe FIFO, uses pipes internally.
2. **`multiprocessing.Pipe`**: direct bidirectional channel between two processes.
3. **`multiprocessing.Manager`**: proxy objects (dict, list, etc.) backed by a server process.
4. **`multiprocessing.Value`/`Array`**: shared memory with ctypes, requires explicit locking.
5. **`multiprocessing.shared_memory`** (3.8+): raw shared memory, zero-copy for numpy arrays.
6. **Files/databases**: for persistence across process restarts.

---

**Q11: What happens if an exception is raised in a thread?**

By default, exceptions in threads are silently swallowed (printed to stderr but not propagated to the main thread). To handle them: use `concurrent.futures.Future.result()` which re-raises the exception, or set `threading.excepthook` (Python 3.8+), or use a `queue.Queue` to pass exceptions back to the main thread.

---

**Q12: What is the difference between `Lock` and `RLock`?**

`threading.Lock` is a simple mutex — if a thread tries to acquire a lock it already holds, it deadlocks. `threading.RLock` (reentrant lock) tracks the owning thread and acquisition count — the same thread can acquire it multiple times without deadlocking. Each `acquire()` must be matched by a `release()`. Use `RLock` when a function that holds a lock calls another function that also tries to acquire the same lock.
