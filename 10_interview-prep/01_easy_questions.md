# Interview Prep — Easy Questions

## Python Fundamentals

### Q1: What is the difference between a list and a tuple?
**Answer:**
| | List | Tuple |
|---|---|---|
| Mutability | Mutable | Immutable |
| Syntax | `[1, 2, 3]` | `(1, 2, 3)` |
| Performance | Slightly slower | Slightly faster |
| Hashable | No | Yes (if elements hashable) |
| Use case | Dynamic collections | Fixed records, dict keys |

```python
lst = [1, 2, 3]
lst[0] = 99       # OK

tup = (1, 2, 3)
tup[0] = 99       # TypeError

# Tuple as dict key
d = {(0, 0): 'origin', (1, 0): 'right'}
```

---

### Q2: What is the difference between `==` and `is`?
**Answer:**
- `==` compares **values** (calls `__eq__`)
- `is` compares **identity** — same object in memory (`id(a) == id(b)`)

```python
a = [1, 2, 3]
b = [1, 2, 3]
a == b    # True  — same value
a is b    # False — different objects

c = a
a is c    # True  — same object

# Always use 'is' for None, True, False
x = None
if x is None:    # correct
    pass
if x == None:    # works but not idiomatic
    pass
```

---

### Q3: What are Python's falsy values?
**Answer:**
```python
falsy = [None, False, 0, 0.0, 0j, '', [], (), {}, set(), b'']
for v in falsy:
    assert not v  # all falsy

# Custom class
class Empty:
    def __bool__(self): return False
    def __len__(self): return 0
```

---

### Q4: What is a decorator?
**Answer:**
A decorator is a function that takes a function and returns a modified version of it. It uses the `@` syntax.

```python
from functools import wraps
import time

def timer(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f'{func.__name__} took {time.perf_counter()-start:.4f}s')
        return result
    return wrapper

@timer
def slow():
    time.sleep(0.1)

slow()  # slow took 0.1001s
```

---

### Q5: What is a list comprehension?
**Answer:**
A concise way to create lists. Syntax: `[expr for item in iterable if condition]`

```python
# Basic
squares = [x**2 for x in range(10)]

# With condition
evens = [x for x in range(20) if x % 2 == 0]

# Nested
flat = [x for row in [[1,2],[3,4]] for x in row]  # [1,2,3,4]

# Dict comprehension
word_len = {w: len(w) for w in ['hello', 'world']}

# Set comprehension
unique = {x % 3 for x in range(10)}
```

---

### Q6: What is the difference between `append()` and `extend()`?
**Answer:**
```python
lst = [1, 2, 3]

lst.append([4, 5])   # adds as single element: [1, 2, 3, [4, 5]]
lst.extend([4, 5])   # adds each element:      [1, 2, 3, 4, 5]

# += is like extend
lst += [6, 7]        # [1, 2, 3, 4, 5, 6, 7]
```

---

### Q7: How do you swap two variables in Python?
**Answer:**
```python
a, b = 1, 2
a, b = b, a   # Pythonic — tuple unpacking
print(a, b)   # 2, 1

# What happens internally:
# 1. Right side evaluated: (b, a) = (2, 1) — tuple created
# 2. Left side unpacked: a=2, b=1
```

---

### Q8: What is `*args` and `**kwargs`?
**Answer:**
```python
def func(*args, **kwargs):
    print(args)    # tuple of positional args
    print(kwargs)  # dict of keyword args

func(1, 2, 3, name='Alice', age=30)
# (1, 2, 3)
# {'name': 'Alice', 'age': 30}

# Unpacking when calling
def add(a, b, c): return a + b + c
add(*[1, 2, 3])          # 6
add(**{'a':1,'b':2,'c':3}) # 6
```

---

### Q9: What is the difference between `range()` and `list(range())`?
**Answer:**
```python
r = range(10)        # lazy range object — O(1) memory
l = list(range(10))  # list — O(n) memory

# range supports O(1) operations
print(len(r))        # 10
print(r[5])          # 5
print(999 in r)      # O(1) — no iteration needed!

# list requires O(n) for 'in'
print(999 in l)      # O(n) — scans entire list
```

---

### Q10: How do you read a file in Python?
**Answer:**
```python
# Best practice — context manager
with open('file.txt', 'r', encoding='utf-8') as f:
    content = f.read()          # entire file
    # OR
    lines = f.readlines()       # list of lines
    # OR
    for line in f:              # lazy — memory efficient
        process(line.rstrip())

# Write
with open('out.txt', 'w', encoding='utf-8') as f:
    f.write('Hello\n')
```

---

### Q11: What is a lambda function?
**Answer:**
An anonymous single-expression function.

```python
square = lambda x: x**2
square(5)  # 25

# Common use: key for sorting
people = [('Alice', 30), ('Bob', 25)]
sorted(people, key=lambda p: p[1])  # sort by age

# When NOT to use lambda:
# - Multi-line logic → use def
# - Reused function → use def (gives it a name for debugging)
```

---

### Q12: What is the difference between `copy()` and `deepcopy()`?
**Answer:**
```python
import copy

original = [[1, 2], [3, 4]]

shallow = copy.copy(original)      # new list, same inner lists
deep    = copy.deepcopy(original)  # new list AND new inner lists

original[0].append(99)
print(shallow[0])  # [1, 2, 99] — affected (shared inner list)
print(deep[0])     # [1, 2]     — not affected (independent copy)
```

---

### Q13: What is `enumerate()`?
**Answer:**
```python
fruits = ['apple', 'banana', 'cherry']

# Without enumerate (bad)
for i in range(len(fruits)):
    print(i, fruits[i])

# With enumerate (good)
for i, fruit in enumerate(fruits):
    print(i, fruit)

# With start index
for i, fruit in enumerate(fruits, start=1):
    print(f'{i}. {fruit}')
```

---

### Q14: What is `zip()`?
**Answer:**
```python
names  = ['Alice', 'Bob', 'Carol']
scores = [95, 87, 92]

for name, score in zip(names, scores):
    print(f'{name}: {score}')

# zip stops at shortest
list(zip([1,2,3], ['a','b']))  # [(1,'a'), (2,'b')]

# Unzip
pairs = [(1,'a'), (2,'b'), (3,'c')]
nums, letters = zip(*pairs)
```

---

### Q15: How do you check if a key exists in a dictionary?
**Answer:**
```python
d = {'a': 1, 'b': 2}

# Best: 'in' operator
if 'a' in d:
    print(d['a'])

# Safe access with default
val = d.get('c', 0)      # 0 if 'c' not found

# Never use try/except for this (too verbose)
# Never use d.keys() — 'a' in d is O(1) already
```

---

## Coding Problems (Easy)

### P1: Reverse a string
```python
def reverse_string(s: str) -> str:
    return s[::-1]

# Alternative
def reverse_string(s: str) -> str:
    return ''.join(reversed(s))
```

### P2: Check if a string is a palindrome
```python
def is_palindrome(s: str) -> bool:
    s = ''.join(c.lower() for c in s if c.isalnum())
    return s == s[::-1]

assert is_palindrome('racecar')
assert is_palindrome('A man a plan a canal Panama')
assert not is_palindrome('hello')
```

### P3: Find duplicates in a list
```python
def find_duplicates(lst: list) -> list:
    seen = set()
    dupes = []
    for x in lst:
        if x in seen:
            dupes.append(x)
        seen.add(x)
    return dupes

# One-liner
from collections import Counter
def find_duplicates(lst):
    return [x for x, c in Counter(lst).items() if c > 1]
```

### P4: FizzBuzz
```python
def fizzbuzz(n: int) -> list[str]:
    result = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            result.append('FizzBuzz')
        elif i % 3 == 0:
            result.append('Fizz')
        elif i % 5 == 0:
            result.append('Buzz')
        else:
            result.append(str(i))
    return result

# Pythonic one-liner
def fizzbuzz(n):
    return [
        'FizzBuzz' if i%15==0 else 'Fizz' if i%3==0 else 'Buzz' if i%5==0 else str(i)
        for i in range(1, n+1)
    ]
```

### P5: Count character frequency
```python
from collections import Counter

def char_frequency(s: str) -> dict:
    return dict(Counter(s))

# Most common
Counter('hello world').most_common(3)
# [('l', 3), ('o', 2), ('h', 1)]
```

### P6: Two Sum
```python
def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}  # value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# O(n) time, O(n) space
assert two_sum([2, 7, 11, 15], 9) == [0, 1]
assert two_sum([3, 2, 4], 6) == [1, 2]
```

### P7: Maximum subarray (Kadane's algorithm)
```python
def max_subarray(nums: list[int]) -> int:
    max_sum = current = nums[0]
    for num in nums[1:]:
        current = max(num, current + num)
        max_sum = max(max_sum, current)
    return max_sum

assert max_subarray([-2,1,-3,4,-1,2,1,-5,4]) == 6
```

### P8: Valid parentheses
```python
def is_valid(s: str) -> bool:
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in ')]}':
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
    return len(stack) == 0

assert is_valid('()')
assert is_valid('()[]{}'  )
assert not is_valid('(]')
assert not is_valid('([)]')
```
