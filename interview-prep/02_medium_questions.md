# Interview Prep — Medium Questions

## OOP & Design

### Q1: Implement a Stack with `min()` in O(1)
```python
class MinStack:
    def __init__(self):
        self._stack = []
        self._min_stack = []  # tracks minimums

    def push(self, val: int) -> None:
        self._stack.append(val)
        min_val = min(val, self._min_stack[-1]) if self._min_stack else val
        self._min_stack.append(min_val)

    def pop(self) -> int:
        self._min_stack.pop()
        return self._stack.pop()

    def top(self) -> int:
        return self._stack[-1]

    def get_min(self) -> int:
        return self._min_stack[-1]

s = MinStack()
s.push(5); s.push(3); s.push(7); s.push(2)
assert s.get_min() == 2
s.pop()
assert s.get_min() == 3
```

---

### Q2: Implement LRU Cache
```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)  # mark as recently used
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)  # evict LRU

cache = LRUCache(2)
cache.put(1, 1); cache.put(2, 2)
assert cache.get(1) == 1
cache.put(3, 3)          # evicts key 2
assert cache.get(2) == -1
```

---

### Q3: Implement a Singleton with thread safety
```python
import threading

class ThreadSafeSingleton:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:  # double-checked locking
                    cls._instance = super().__new__(cls)
        return cls._instance

s1 = ThreadSafeSingleton()
s2 = ThreadSafeSingleton()
assert s1 is s2
```

---

### Q4: What is MRO and how does Python resolve it?
**Answer:**
MRO (Method Resolution Order) determines the order Python searches for methods in inheritance. Python uses the **C3 linearization** algorithm.

```python
class A:
    def method(self): return 'A'

class B(A):
    def method(self): return 'B'

class C(A):
    def method(self): return 'C'

class D(B, C):
    pass

print(D.__mro__)
# (<class 'D'>, <class 'B'>, <class 'C'>, <class 'A'>, <class 'object'>)
print(D().method())  # 'B' — follows MRO left to right

# super() follows MRO
class B(A):
    def method(self):
        return 'B->' + super().method()

class C(A):
    def method(self):
        return 'C->' + super().method()

class D(B, C):
    def method(self):
        return 'D->' + super().method()

print(D().method())  # D->B->C->A
```

---

## Algorithms

### Q5: Binary Search
```python
def binary_search(arr: list[int], target: int) -> int:
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2  # avoids overflow
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

# O(log n) time, O(1) space
arr = list(range(0, 20, 2))  # [0,2,4,...,18]
assert binary_search(arr, 10) == 5
assert binary_search(arr, 7) == -1
```

---

### Q6: Merge Two Sorted Lists
```python
def merge_sorted(l1: list[int], l2: list[int]) -> list[int]:
    result = []
    i = j = 0
    while i < len(l1) and j < len(l2):
        if l1[i] <= l2[j]:
            result.append(l1[i]); i += 1
        else:
            result.append(l2[j]); j += 1
    result.extend(l1[i:])
    result.extend(l2[j:])
    return result

assert merge_sorted([1,3,5], [2,4,6]) == [1,2,3,4,5,6]
assert merge_sorted([], [1,2]) == [1,2]
```

---

### Q7: Group Anagrams
```python
from collections import defaultdict

def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))  # canonical form
        groups[key].append(s)
    return list(groups.values())

result = group_anagrams(['eat','tea','tan','ate','nat','bat'])
# [['eat','tea','ate'], ['tan','nat'], ['bat']]
assert len(result) == 3
```

---

### Q8: Longest Substring Without Repeating Characters
```python
def length_of_longest_substring(s: str) -> int:
    char_index = {}
    max_len = start = 0
    for i, ch in enumerate(s):
        if ch in char_index and char_index[ch] >= start:
            start = char_index[ch] + 1
        char_index[ch] = i
        max_len = max(max_len, i - start + 1)
    return max_len

# O(n) sliding window
assert length_of_longest_substring('abcabcbb') == 3
assert length_of_longest_substring('bbbbb') == 1
assert length_of_longest_substring('pwwkew') == 3
```

---

### Q9: Number of Islands (BFS/DFS)
```python
def num_islands(grid: list[list[str]]) -> int:
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    count = 0

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != '1':
            return
        grid[r][c] = '#'  # mark visited
        for dr, dc in [(0,1),(0,-1),(1,0),(-1,0)]:
            dfs(r+dr, c+dc)

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                dfs(r, c)
                count += 1
    return count

grid = [
    ['1','1','0','0','0'],
    ['1','1','0','0','0'],
    ['0','0','1','0','0'],
    ['0','0','0','1','1'],
]
assert num_islands([row[:] for row in grid]) == 3
```

---

### Q10: Implement a Generator for Infinite Fibonacci
```python
def infinite_fib():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

import itertools

# First 10 Fibonacci numbers
first_10 = list(itertools.islice(infinite_fib(), 10))
assert first_10 == [0,1,1,2,3,5,8,13,21,34]

# First Fibonacci > 1000
gen = infinite_fib()
result = next(x for x in gen if x > 1000)
assert result == 1597
```

---

## Concurrency

### Q11: Thread-safe counter
```python
import threading

class ThreadSafeCounter:
    def __init__(self):
        self._value = 0
        self._lock = threading.Lock()

    def increment(self):
        with self._lock:
            self._value += 1

    def decrement(self):
        with self._lock:
            self._value -= 1

    @property
    def value(self):
        with self._lock:
            return self._value

counter = ThreadSafeCounter()
threads = [threading.Thread(target=counter.increment) for _ in range(1000)]
for t in threads: t.start()
for t in threads: t.join()
assert counter.value == 1000
```

---

### Q12: Producer-Consumer with Queue
```python
import threading
import queue
import time

def producer(q: queue.Queue, items: list):
    for item in items:
        q.put(item)
        time.sleep(0.01)
    q.put(None)  # sentinel

def consumer(q: queue.Queue, results: list):
    while True:
        item = q.get()
        if item is None:
            break
        results.append(item * 2)
        q.task_done()

q = queue.Queue(maxsize=5)
results = []
t1 = threading.Thread(target=producer, args=(q, list(range(10))))
t2 = threading.Thread(target=consumer, args=(q, results))
t1.start(); t2.start()
t1.join(); t2.join()
assert results == [i*2 for i in range(10)]
```
