# Python Threading

## 1. The `Thread` Class

```python
import threading
import time

# Method 1: Pass a function
def worker(name, delay):
    print(f"Thread {name} starting")
    time.sleep(delay)
    print(f"Thread {name} done")

t1 = threading.Thread(target=worker, args=("A", 1))
t2 = threading.Thread(target=worker, args=("B", 0.5))

t1.start()
t2.start()

t1.join()  # wait for t1 to finish
t2.join()  # wait for t2 to finish
print("All threads done")

# Method 2: Subclass Thread
class WorkerThread(threading.Thread):
    def __init__(self, name, data):
        super().__init__(name=name)
        self.data = data
        self.result = None

    def run(self):
        # Override run() — called by start()
        self.result = sum(self.data)

t = WorkerThread("summer", [1, 2, 3, 4, 5])
t.start()
t.join()
print(f"Result: {t.result}")  # 15
```

---

## 2. Daemon Threads

```python
import threading
import time

# Daemon threads are killed when the main thread exits
def background_task():
    while True:
        print("Background task running...")
        time.sleep(1)

# Non-daemon (default) — main program waits for it
t = threading.Thread(target=background_task)
t.daemon = True  # or: Thread(target=..., daemon=True)
t.start()

# Main thread exits → daemon thread is killed automatically
time.sleep(2)
print("Main thread done — daemon thread will be killed")

# Use cases for daemon threads:
# - Background monitoring/logging
# - Heartbeat threads
# - Garbage collection helpers
# - Any task that should not prevent program exit
```

---

## 3. `Lock` and `RLock`

```python
import threading

# Lock — mutual exclusion
counter = 0
lock = threading.Lock()

def increment(n):
    global counter
    for _ in range(n):
        with lock:  # acquire and release automatically
            counter += 1

threads = [threading.Thread(target=increment, args=(10000,)) for _ in range(5)]
for t in threads: t.start()
for t in threads: t.join()
print(f"Counter: {counter}")  # 50000 (correct with lock)

# Without lock, counter would be less than 50000 due to race conditions

# RLock — reentrant lock (same thread can acquire multiple times)
rlock = threading.RLock()

def recursive_function(n):
    with rlock:  # can acquire again in same thread
        if n > 0:
            recursive_function(n - 1)

recursive_function(5)  # works with RLock, deadlocks with Lock

# Lock context manager vs acquire/release
lock = threading.Lock()

# Preferred: context manager
with lock:
    # critical section
    pass

# Manual (error-prone — must release in finally)
lock.acquire()
try:
    pass  # critical section
finally:
    lock.release()
```

---

## 4. `Semaphore`

```python
import threading
import time

# Semaphore — limit concurrent access
# Use case: limit concurrent database connections
MAX_CONNECTIONS = 3
semaphore = threading.Semaphore(MAX_CONNECTIONS)

def access_database(thread_id):
    print(f"Thread {thread_id} waiting for connection...")
    with semaphore:
        print(f"Thread {thread_id} got connection")
        time.sleep(0.5)  # simulate DB work
        print(f"Thread {thread_id} releasing connection")

threads = [threading.Thread(target=access_database, args=(i,)) for i in range(7)]
for t in threads: t.start()
for t in threads: t.join()
# At most 3 threads access DB simultaneously

# BoundedSemaphore — raises ValueError if released more than acquired
bounded = threading.BoundedSemaphore(3)
```

---

## 5. `Event`

```python
import threading
import time

# Event — signal between threads
event = threading.Event()

def waiter(name):
    print(f"{name} waiting for event...")
    event.wait()  # blocks until event is set
    print(f"{name} event received!")

def setter():
    time.sleep(2)
    print("Setting event!")
    event.set()  # unblocks all waiters

threads = [threading.Thread(target=waiter, args=(f"Waiter-{i}",)) for i in range(3)]
setter_thread = threading.Thread(target=setter)

for t in threads: t.start()
setter_thread.start()
for t in threads: t.join()
setter_thread.join()

# Event methods:
# event.set()     — set the flag (unblock all waiters)
# event.clear()   — reset the flag
# event.wait(timeout=None)  — block until set
# event.is_set()  — check without blocking
```

---

## 6. `Condition`

```python
import threading
import time
from collections import deque

# Condition — complex synchronization (producer-consumer)
condition = threading.Condition()
buffer = deque(maxlen=5)

def producer():
    for i in range(10):
        with condition:
            while len(buffer) == buffer.maxlen:
                condition.wait()  # wait if buffer full
            buffer.append(i)
            print(f"Produced: {i}, buffer: {list(buffer)}")
            condition.notify_all()  # wake up consumers
        time.sleep(0.1)

def consumer(name):
    consumed = 0
    while consumed < 5:
        with condition:
            while not buffer:
                condition.wait()  # wait if buffer empty
            item = buffer.popleft()
            consumed += 1
            print(f"{name} consumed: {item}")
            condition.notify_all()  # wake up producer
```

---

## 7. `ThreadPoolExecutor`

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

def fetch_url(url):
    """Simulate fetching a URL."""
    time.sleep(0.1)
    return f"Content from {url}"

urls = [f"https://example.com/page/{i}" for i in range(10)]

# Submit tasks and get futures
with ThreadPoolExecutor(max_workers=4) as executor:
    # map — simple, ordered results
    results = list(executor.map(fetch_url, urls))
    print(f"Fetched {len(results)} pages")

# submit — more control, unordered completion
with ThreadPoolExecutor(max_workers=4) as executor:
    futures = {executor.submit(fetch_url, url): url for url in urls}

    for future in as_completed(futures):
        url = futures[future]
        try:
            result = future.result()
            print(f"Done: {url}")
        except Exception as e:
            print(f"Error fetching {url}: {e}")

# With timeout
with ThreadPoolExecutor(max_workers=2) as executor:
    future = executor.submit(time.sleep, 10)
    try:
        result = future.result(timeout=1)  # raises TimeoutError
    except TimeoutError:
        print("Task timed out")
```

---

## 8. The GIL (Global Interpreter Lock)

```python
# The GIL is a mutex in CPython that allows only one thread to execute
# Python bytecode at a time.

# IMPACT:
# - CPU-bound tasks: threading does NOT improve performance
#   (threads take turns, no true parallelism)
# - I/O-bound tasks: threading DOES improve performance
#   (GIL is released during I/O operations)

# CPU-bound — threading doesn't help
import threading
import time

def cpu_bound(n):
    """Pure CPU work — GIL prevents true parallelism."""
    return sum(i * i for i in range(n))

# Single thread
start = time.perf_counter()
cpu_bound(10_000_000)
cpu_bound(10_000_000)
single = time.perf_counter() - start

# Two threads (not faster due to GIL!)
start = time.perf_counter()
t1 = threading.Thread(target=cpu_bound, args=(10_000_000,))
t2 = threading.Thread(target=cpu_bound, args=(10_000_000,))
t1.start(); t2.start()
t1.join(); t2.join()
threaded = time.perf_counter() - start

print(f"Single: {single:.2f}s, Threaded: {threaded:.2f}s")
# Threaded may be SLOWER due to GIL contention!

# I/O-bound — threading helps
import urllib.request

def download(url):
    # GIL is released during network I/O
    try:
        urllib.request.urlopen(url, timeout=5)
    except:
        pass

# Use multiprocessing for CPU-bound tasks
# Use threading or asyncio for I/O-bound tasks
```

---

## 9. Thread-Safe Data Structures

```python
import threading
import queue

# queue.Queue — thread-safe FIFO queue
q = queue.Queue(maxsize=10)

def producer(q, items):
    for item in items:
        q.put(item)  # blocks if full
    q.put(None)  # sentinel

def consumer(q, name):
    while True:
        item = q.get()  # blocks if empty
        if item is None:
            q.put(None)  # pass sentinel to other consumers
            break
        print(f"{name} processed: {item}")
        q.task_done()  # signal task completion

q = queue.Queue()
prod = threading.Thread(target=producer, args=(q, range(5)))
cons1 = threading.Thread(target=consumer, args=(q, "Consumer-1"))
cons2 = threading.Thread(target=consumer, args=(q, "Consumer-2"))

prod.start(); cons1.start(); cons2.start()
prod.join(); cons1.join(); cons2.join()

# queue.Queue methods:
# q.put(item, block=True, timeout=None)
# q.get(block=True, timeout=None)
# q.task_done()
# q.join()  — wait until all items processed
# q.empty(), q.full(), q.qsize()

# Other thread-safe options:
# - collections.deque (appendleft/popleft are atomic in CPython)
# - threading.local() — thread-local storage
local_data = threading.local()
local_data.value = 42  # each thread has its own 'value'
```

---

## Interview Questions

**Q1: What is the GIL and how does it affect threading in Python?**

Answer: The Global Interpreter Lock (GIL) is a mutex in CPython that ensures only one thread executes Python bytecode at a time. It exists because CPython's memory management (reference counting) is not thread-safe. Impact: CPU-bound tasks don't benefit from threading (threads take turns, no true parallelism). I/O-bound tasks do benefit because the GIL is released during I/O operations (network, disk, sleep), allowing other threads to run. For CPU-bound parallelism, use `multiprocessing` (separate processes, each with their own GIL).

---

**Q2: What is the difference between `Lock` and `RLock`?**

Answer: `Lock` is a simple mutex — once acquired by a thread, any attempt to acquire it again (even by the same thread) will deadlock. `RLock` (Reentrant Lock) can be acquired multiple times by the same thread — it tracks the acquisition count and only releases when the count reaches zero. Use `RLock` when a function that holds a lock calls another function that also tries to acquire the same lock (e.g., recursive functions, methods calling other methods in the same class).

---

**Q3: What is a race condition and how do you prevent it?**

Answer: A race condition occurs when multiple threads access shared data concurrently and the result depends on the order of execution. Example: two threads both read `counter = 5`, both increment to `6`, both write `6` — the counter should be `7`. Prevention: use `Lock` to make the read-modify-write atomic, use thread-safe data structures (`queue.Queue`), use atomic operations, or use `threading.local()` for thread-local state.

---

**Q4: When should you use `ThreadPoolExecutor` vs manually creating threads?**

Answer: `ThreadPoolExecutor` is almost always preferred. It manages a pool of reusable threads (avoids thread creation overhead), provides a clean `Future`-based API, handles exceptions properly, and integrates with `as_completed()` for processing results as they arrive. Manual thread creation is appropriate only when you need fine-grained control over thread lifecycle, daemon status, or custom thread subclasses.

---

**Q5: What is a daemon thread?**

Answer: A daemon thread runs in the background and is automatically killed when all non-daemon threads (including the main thread) have finished. Non-daemon threads prevent the program from exiting. Use daemon threads for background tasks that should not block program exit: monitoring, heartbeats, background cleanup. Set with `thread.daemon = True` before `start()` or `Thread(daemon=True)`.

---

**Q6: What is `threading.Event` and when would you use it?**

Answer: `Event` is a synchronization primitive for signaling between threads. One thread calls `event.set()` to signal; other threads call `event.wait()` to block until signaled. Use cases: "start signal" (all workers wait until setup is complete), "stop signal" (workers check `event.is_set()` to know when to stop), one-time notifications. For repeated signaling, use `Condition`.

---

**Q7: How does `queue.Queue` ensure thread safety?**

Answer: `queue.Queue` uses internal locks (`threading.Lock`) to protect all operations. `put()` and `get()` are atomic — no race conditions. It also provides `task_done()` and `join()` for tracking when all items have been processed. It's the recommended way to communicate between threads. `queue.LifoQueue` (stack) and `queue.PriorityQueue` are also thread-safe.

---

**Q8: What is `threading.local()` and when is it useful?**

Answer: `threading.local()` creates thread-local storage — each thread gets its own independent copy of the data. Changes in one thread don't affect other threads. Use cases: per-request database connections in web servers, per-thread random number generators, Flask's `g` object (request context). It's the thread-safe alternative to global variables.

```python
local = threading.local()
local.connection = create_db_connection()  # each thread has its own
```

---

**Q9: What is the difference between `thread.join()` and `thread.join(timeout)`?**

Answer: `join()` blocks indefinitely until the thread finishes. `join(timeout)` blocks for at most `timeout` seconds, then returns regardless. After `join(timeout)`, check `thread.is_alive()` to see if the thread actually finished. This is useful for implementing timeouts and graceful shutdown.

---

**Q10: How do you safely stop a thread in Python?**

Answer: Python doesn't have a built-in "kill thread" mechanism. The recommended approach is cooperative cancellation: use a `threading.Event` as a stop signal, and have the thread check it periodically.

```python
stop_event = threading.Event()

def worker():
    while not stop_event.is_set():
        do_work()
        stop_event.wait(timeout=0.1)  # check every 100ms

t = threading.Thread(target=worker)
t.start()
# Later:
stop_event.set()  # signal thread to stop
t.join()
```
