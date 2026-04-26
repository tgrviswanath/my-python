# Python Multiprocessing

## 1. `Process` Class

```python
import multiprocessing
import os
import time

def worker(name, delay):
    pid = os.getpid()
    print(f"Process {name} (PID {pid}) starting")
    time.sleep(delay)
    print(f"Process {name} done")

if __name__ == '__main__':  # REQUIRED on Windows/macOS
    p1 = multiprocessing.Process(target=worker, args=("A", 1))
    p2 = multiprocessing.Process(target=worker, args=("B", 0.5))

    p1.start()
    p2.start()

    p1.join()
    p2.join()
    print("All processes done")

# Process attributes
p = multiprocessing.Process(target=worker, args=("C", 1))
p.start()
print(f"PID: {p.pid}")
print(f"Name: {p.name}")
print(f"Alive: {p.is_alive()}")
p.join(timeout=5)
print(f"Exit code: {p.exitcode}")  # 0 = success
```

---

## 2. `Pool` — Process Pool

```python
import multiprocessing
import time

def square(x):
    return x * x

def cpu_intensive(n):
    """Simulate CPU-bound work."""
    return sum(i * i for i in range(n))

if __name__ == '__main__':
    # Pool.map — parallel map
    with multiprocessing.Pool(processes=4) as pool:
        results = pool.map(square, range(10))
        print(results)  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

    # Pool.map_async — non-blocking
    with multiprocessing.Pool(processes=4) as pool:
        async_result = pool.map_async(square, range(10))
        # do other work while pool processes
        result = async_result.get(timeout=10)

    # Pool.starmap — multiple arguments
    def power(base, exp):
        return base ** exp

    with multiprocessing.Pool(processes=4) as pool:
        results = pool.starmap(power, [(2, 3), (3, 2), (4, 2), (5, 3)])
        print(results)  # [8, 9, 16, 125]

    # Pool.imap — lazy iterator (memory efficient)
    with multiprocessing.Pool(processes=4) as pool:
        for result in pool.imap(square, range(100), chunksize=10):
            pass  # process results as they come

    # Pool.apply_async — submit individual tasks
    with multiprocessing.Pool(processes=4) as pool:
        futures = [pool.apply_async(cpu_intensive, (1_000_000,)) for _ in range(8)]
        results = [f.get() for f in futures]
```

---

## 3. `Queue` and `Pipe` — Inter-Process Communication

```python
import multiprocessing

# Queue — multi-producer, multi-consumer
def producer(q, items):
    for item in items:
        q.put(item)
    q.put(None)  # sentinel

def consumer(q, result_q):
    total = 0
    while True:
        item = q.get()
        if item is None:
            break
        total += item
    result_q.put(total)

if __name__ == '__main__':
    q = multiprocessing.Queue()
    result_q = multiprocessing.Queue()

    p1 = multiprocessing.Process(target=producer, args=(q, range(1, 101)))
    p2 = multiprocessing.Process(target=consumer, args=(q, result_q))

    p1.start(); p2.start()
    p1.join(); p2.join()

    print(f"Sum: {result_q.get()}")  # 5050

# Pipe — two-way communication between two processes
def child_process(conn):
    data = conn.recv()  # receive from parent
    result = [x * 2 for x in data]
    conn.send(result)   # send back to parent
    conn.close()

if __name__ == '__main__':
    parent_conn, child_conn = multiprocessing.Pipe()

    p = multiprocessing.Process(target=child_process, args=(child_conn,))
    p.start()

    parent_conn.send([1, 2, 3, 4, 5])  # send to child
    result = parent_conn.recv()          # receive from child
    p.join()

    print(f"Result: {result}")  # [2, 4, 6, 8, 10]
```

---

## 4. Shared Memory

```python
import multiprocessing
import ctypes

# Value — single shared value
def increment_shared(val, lock, n):
    for _ in range(n):
        with lock:
            val.value += 1

if __name__ == '__main__':
    shared_val = multiprocessing.Value(ctypes.c_int, 0)
    lock = multiprocessing.Lock()

    processes = [
        multiprocessing.Process(target=increment_shared, args=(shared_val, lock, 10000))
        for _ in range(4)
    ]
    for p in processes: p.start()
    for p in processes: p.join()
    print(f"Shared value: {shared_val.value}")  # 40000

# Array — shared array
def fill_array(arr, start, end, value):
    for i in range(start, end):
        arr[i] = value

if __name__ == '__main__':
    shared_arr = multiprocessing.Array(ctypes.c_int, 10)

    p1 = multiprocessing.Process(target=fill_array, args=(shared_arr, 0, 5, 1))
    p2 = multiprocessing.Process(target=fill_array, args=(shared_arr, 5, 10, 2))
    p1.start(); p2.start()
    p1.join(); p2.join()
    print(list(shared_arr))  # [1, 1, 1, 1, 1, 2, 2, 2, 2, 2]

# multiprocessing.shared_memory (Python 3.8+) — zero-copy shared memory
from multiprocessing import shared_memory
import numpy as np

if __name__ == '__main__':
    # Create shared memory block
    shm = shared_memory.SharedMemory(create=True, size=1024)
    # Create numpy array backed by shared memory
    arr = np.ndarray((128,), dtype=np.float64, buffer=shm.buf)
    arr[:] = np.arange(128)
    # Share the name with other processes
    shm_name = shm.name
    # Cleanup
    shm.close()
    shm.unlink()
```

---

## 5. `ProcessPoolExecutor`

```python
from concurrent.futures import ProcessPoolExecutor, as_completed
import time

def cpu_task(n):
    """CPU-bound task — benefits from multiprocessing."""
    return sum(i * i for i in range(n))

if __name__ == '__main__':
    tasks = [1_000_000] * 8

    # Sequential
    start = time.perf_counter()
    sequential = [cpu_task(n) for n in tasks]
    seq_time = time.perf_counter() - start

    # Parallel with ProcessPoolExecutor
    start = time.perf_counter()
    with ProcessPoolExecutor(max_workers=4) as executor:
        parallel = list(executor.map(cpu_task, tasks))
    par_time = time.perf_counter() - start

    print(f"Sequential: {seq_time:.2f}s")
    print(f"Parallel:   {par_time:.2f}s")
    print(f"Speedup:    {seq_time/par_time:.2f}x")

    # submit + as_completed
    with ProcessPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(cpu_task, n): n for n in tasks}
        for future in as_completed(futures):
            result = future.result()
```

---

## 6. When to Use Multiprocessing vs Threading

```
┌─────────────────────┬──────────────────────┬──────────────────────┐
│ Criterion           │ Threading            │ Multiprocessing      │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ CPU-bound tasks     │ ❌ GIL prevents      │ ✅ True parallelism  │
│                     │    parallelism       │                      │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ I/O-bound tasks     │ ✅ GIL released      │ ✅ Works but         │
│                     │    during I/O        │    overkill          │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Memory sharing      │ ✅ Shared memory     │ ❌ Separate memory   │
│                     │    (careful!)        │    spaces            │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Startup overhead    │ ✅ Low               │ ❌ High (fork/spawn) │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Communication       │ ✅ Easy (shared      │ ❌ Requires Queue/   │
│                     │    objects)          │    Pipe/SharedMemory │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Crash isolation     │ ❌ One thread crash  │ ✅ Process crash      │
│                     │    can kill all      │    doesn't affect    │
│                     │                      │    others            │
└─────────────────────┴──────────────────────┴──────────────────────┘

Use threading for: web scraping, API calls, file I/O, GUI responsiveness
Use multiprocessing for: data processing, ML training, image processing, scientific computing
Use asyncio for: high-concurrency I/O (thousands of connections)
```

---

## Interview Questions

**Q1: Why does Python have the GIL and how does multiprocessing bypass it?**

Answer: The GIL exists in CPython because its memory management (reference counting) is not thread-safe. Making it thread-safe would require fine-grained locking that would slow down single-threaded code. Multiprocessing bypasses the GIL by using separate OS processes — each process has its own Python interpreter and GIL. True CPU parallelism is achieved at the cost of higher memory usage and IPC overhead.

---

**Q2: What is the difference between `Pool.map()` and `Pool.imap()`?**

Answer: `Pool.map()` collects all results into a list before returning — it blocks until all tasks complete and stores all results in memory. `Pool.imap()` returns a lazy iterator — results are yielded as they complete, making it memory-efficient for large datasets. `Pool.imap_unordered()` yields results in completion order (not input order), which can be faster when tasks have variable duration.

---

**Q3: What is the difference between `Queue` and `Pipe` in multiprocessing?**

Answer: `Pipe` creates a two-way connection between exactly two processes — it's faster but limited to two endpoints. `Queue` supports multiple producers and consumers — it's more flexible but has more overhead. Use `Pipe` for simple parent-child communication; use `Queue` for producer-consumer patterns with multiple workers.

---

**Q4: Why must you use `if __name__ == '__main__':` with multiprocessing?**

Answer: On Windows and macOS (with 'spawn' start method), new processes are created by importing the main module. Without the guard, each new process would try to create more processes, causing infinite recursion. On Linux (with 'fork'), it's not strictly required but is still best practice for portability. Always use this guard in scripts that use multiprocessing.

---

**Q5: What are the three start methods for multiprocessing?**

Answer:
- `fork` (Linux default): copies the parent process — fast but can cause issues with threads and file handles
- `spawn` (Windows/macOS default): starts a fresh Python interpreter — safe but slow
- `forkserver`: starts a server process that forks on request — compromise between fork and spawn

```python
import multiprocessing
multiprocessing.set_start_method('spawn')  # set globally
# or
ctx = multiprocessing.get_context('spawn')
p = ctx.Process(target=worker)
```

---

**Q6: How do you share data between processes safely?**

Answer: Options in order of preference:
1. `multiprocessing.Queue` — thread/process-safe, for passing messages
2. `multiprocessing.Pipe` — for two-process communication
3. `multiprocessing.Value`/`Array` with `Lock` — for simple shared state
4. `multiprocessing.Manager()` — for complex shared objects (dict, list) — slower
5. `multiprocessing.shared_memory` (Python 3.8+) — zero-copy for large data (numpy arrays)

---

**Q7: What is the difference between `ProcessPoolExecutor` and `multiprocessing.Pool`?**

Answer: `ProcessPoolExecutor` is the higher-level, modern API from `concurrent.futures`. It provides `Future` objects, integrates with `as_completed()`, and has a cleaner interface. `multiprocessing.Pool` is lower-level with more options (`imap`, `starmap`, `apply_async`). For most use cases, `ProcessPoolExecutor` is preferred. Use `Pool` when you need `imap` for memory-efficient streaming or `starmap` for multiple arguments.

---

**Q8: How do you handle exceptions in child processes?**

Answer: With `Pool.map()`, exceptions are re-raised in the parent when you call `get()`. With `apply_async()`, call `result.get()` to retrieve the exception. With `ProcessPoolExecutor`, exceptions are stored in the `Future` and re-raised when you call `future.result()`. Child process crashes (segfaults) result in `BrokenProcessPool` exception.

```python
with ProcessPoolExecutor() as executor:
    future = executor.submit(risky_function)
    try:
        result = future.result()
    except Exception as e:
        print(f"Child process raised: {e}")
```
