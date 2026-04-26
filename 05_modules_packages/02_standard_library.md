# Python Standard Library — Interview-Focused Guide

## 1. `collections` Module

### Counter

```python
from collections import Counter

# Count elements
words = ['apple', 'banana', 'apple', 'cherry', 'banana', 'apple']
c = Counter(words)
print(c)                    # Counter({'apple': 3, 'banana': 2, 'cherry': 1})
print(c.most_common(2))     # [('apple', 3), ('banana', 2)]
print(c['apple'])           # 3
print(c['missing'])         # 0 (no KeyError!)

# Arithmetic
c1 = Counter(a=3, b=2)
c2 = Counter(a=1, b=4)
print(c1 + c2)              # Counter({'b': 6, 'a': 4})
print(c1 - c2)              # Counter({'a': 2})
print(c1 & c2)              # Counter({'a': 1, 'b': 2}) — min
print(c1 | c2)              # Counter({'b': 4, 'a': 3}) — max

# Count characters
char_count = Counter("mississippi")
print(char_count.most_common(3))  # [('s', 4), ('i', 4), ('p', 2)]
```

### defaultdict

```python
from collections import defaultdict

# No KeyError on missing keys
dd = defaultdict(list)
dd['fruits'].append('apple')
dd['fruits'].append('banana')
dd['veggies'].append('carrot')
print(dict(dd))  # {'fruits': ['apple', 'banana'], 'veggies': ['carrot']}

# Group by first letter
words = ['apple', 'ant', 'banana', 'bear', 'cherry']
grouped = defaultdict(list)
for word in words:
    grouped[word[0]].append(word)
print(dict(grouped))  # {'a': ['apple', 'ant'], 'b': ['banana', 'bear'], 'c': ['cherry']}

# Nested defaultdict
nested = defaultdict(lambda: defaultdict(int))
nested['row1']['col1'] += 1
nested['row1']['col2'] += 2
print(dict(nested['row1']))  # {'col1': 1, 'col2': 2}
```

### OrderedDict

```python
from collections import OrderedDict

# Maintains insertion order (Python 3.7+ dicts also maintain order)
od = OrderedDict()
od['first'] = 1
od['second'] = 2
od['third'] = 3

# move_to_end — unique to OrderedDict
od.move_to_end('first')         # move to end
od.move_to_end('third', last=False)  # move to beginning

# popitem — LIFO by default
od.popitem(last=True)   # removes last item
od.popitem(last=False)  # removes first item

# Equality considers order (unlike regular dict)
od1 = OrderedDict([('a', 1), ('b', 2)])
od2 = OrderedDict([('b', 2), ('a', 1)])
print(od1 == od2)  # False — order matters!
```

### deque

```python
from collections import deque

# O(1) append/pop from both ends (list is O(n) for left operations)
dq = deque([1, 2, 3, 4, 5])
dq.appendleft(0)    # [0, 1, 2, 3, 4, 5]
dq.append(6)        # [0, 1, 2, 3, 4, 5, 6]
dq.popleft()        # returns 0
dq.pop()            # returns 6

# Rotate
dq = deque([1, 2, 3, 4, 5])
dq.rotate(2)        # [4, 5, 1, 2, 3]
dq.rotate(-1)       # [5, 1, 2, 3, 4]

# maxlen — sliding window
window = deque(maxlen=3)
for i in range(6):
    window.append(i)
    print(list(window))  # automatically drops oldest
# [0], [0,1], [0,1,2], [1,2,3], [2,3,4], [3,4,5]
```

### namedtuple

```python
from collections import namedtuple

# Create a lightweight class with named fields
Point = namedtuple('Point', ['x', 'y'])
p = Point(3, 4)
print(p.x, p.y)     # 3 4
print(p[0], p[1])   # 3 4 — still indexable
print(p._asdict())  # {'x': 3, 'y': 4}

# With defaults (Python 3.6.1+)
Employee = namedtuple('Employee', ['name', 'dept', 'salary'], defaults=[50000])
emp = Employee('Alice', 'Engineering')
print(emp)  # Employee(name='Alice', dept='Engineering', salary=50000)

# _replace creates a new instance with some fields changed
p2 = p._replace(x=10)
print(p2)  # Point(x=10, y=4)

# Typed version (Python 3.6+)
from typing import NamedTuple

class Vector(NamedTuple):
    x: float
    y: float
    z: float = 0.0

v = Vector(1.0, 2.0)
print(v)  # Vector(x=1.0, y=2.0, z=0.0)
```

### ChainMap

```python
from collections import ChainMap

# Combine multiple dicts — searches in order
defaults = {'color': 'red', 'size': 'medium', 'weight': 'light'}
user_prefs = {'color': 'blue', 'size': 'large'}
config = ChainMap(user_prefs, defaults)

print(config['color'])   # 'blue' — from user_prefs
print(config['weight'])  # 'light' — from defaults

# Writes go to the first map
config['new_key'] = 'value'
print(user_prefs)  # {'color': 'blue', 'size': 'large', 'new_key': 'value'}

# Use case: layered configuration
import os
env_config = ChainMap(os.environ, defaults)
```

---

## 2. `itertools` Module

```python
import itertools

# chain — flatten iterables
result = list(itertools.chain([1, 2], [3, 4], [5]))
print(result)  # [1, 2, 3, 4, 5]

result = list(itertools.chain.from_iterable([[1, 2], [3, 4], [5]]))
print(result)  # [1, 2, 3, 4, 5]

# islice — lazy slicing
gen = (x**2 for x in range(1000000))
first_five = list(itertools.islice(gen, 5))
print(first_five)  # [0, 1, 4, 9, 16]

# product — Cartesian product
suits = ['♠', '♥', '♦', '♣']
ranks = ['A', 'K', 'Q']
cards = list(itertools.product(ranks, suits))
print(cards[:4])  # [('A', '♠'), ('A', '♥'), ('A', '♦'), ('A', '♣')]

# combinations — no repetition, order doesn't matter
combos = list(itertools.combinations([1, 2, 3, 4], 2))
print(combos)  # [(1,2), (1,3), (1,4), (2,3), (2,4), (3,4)]

# permutations — order matters
perms = list(itertools.permutations([1, 2, 3], 2))
print(perms)  # [(1,2), (1,3), (2,1), (2,3), (3,1), (3,2)]

# groupby — group consecutive elements
data = [('a', 1), ('a', 2), ('b', 3), ('b', 4), ('c', 5)]
for key, group in itertools.groupby(data, key=lambda x: x[0]):
    print(key, list(group))
# a [('a', 1), ('a', 2)]
# b [('b', 3), ('b', 4)]
# c [('c', 5)]

# accumulate — running totals
import operator
nums = [1, 2, 3, 4, 5]
running_sum = list(itertools.accumulate(nums))
print(running_sum)  # [1, 3, 6, 10, 15]

running_product = list(itertools.accumulate(nums, operator.mul))
print(running_product)  # [1, 2, 6, 24, 120]

# cycle — infinite cycling
colors = itertools.cycle(['red', 'green', 'blue'])
print([next(colors) for _ in range(7)])
# ['red', 'green', 'blue', 'red', 'green', 'blue', 'red']

# repeat — repeat a value
repeated = list(itertools.repeat(42, 3))
print(repeated)  # [42, 42, 42]
```

---

## 3. `functools` Module

```python
import functools

# lru_cache — memoization
@functools.lru_cache(maxsize=128)
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(50))  # 12586269025 — fast due to caching
print(fibonacci.cache_info())  # CacheInfo(hits=48, misses=51, maxsize=128, currsize=51)

# cache (Python 3.9+) — unbounded cache
@functools.cache
def factorial(n):
    return 1 if n <= 1 else n * factorial(n - 1)

# partial — fix some arguments
def power(base, exponent):
    return base ** exponent

square = functools.partial(power, exponent=2)
cube = functools.partial(power, exponent=3)
print(square(5))  # 25
print(cube(3))    # 27

double = functools.partial(map, lambda x: x * 2)
print(list(double([1, 2, 3])))  # [2, 4, 6]

# reduce — fold left
from functools import reduce
product = reduce(lambda acc, x: acc * x, [1, 2, 3, 4, 5])
print(product)  # 120

# With initial value
total = reduce(lambda acc, x: acc + x, [1, 2, 3], 100)
print(total)  # 106

# wraps — preserve function metadata in decorators
def my_decorator(func):
    @functools.wraps(func)  # preserves __name__, __doc__, etc.
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@my_decorator
def greet(name):
    """Greet someone by name."""
    return f"Hello, {name}!"

print(greet.__name__)  # 'greet' (not 'wrapper')
print(greet.__doc__)   # 'Greet someone by name.'
```

---

## 4. `pathlib` Module

```python
from pathlib import Path

# Create path objects
p = Path('/usr/local/bin')
home = Path.home()
cwd = Path.cwd()

# Path operations
p = Path('/home/user/documents/report.pdf')
print(p.name)       # 'report.pdf'
print(p.stem)       # 'report'
print(p.suffix)     # '.pdf'
print(p.parent)     # /home/user/documents
print(p.parts)      # ('/', 'home', 'user', 'documents', 'report.pdf')

# Join paths with /
config = Path.home() / '.config' / 'myapp' / 'settings.json'

# Check existence
print(p.exists())
print(p.is_file())
print(p.is_dir())

# Read/write
text_file = Path('example.txt')
text_file.write_text('Hello, World!')
content = text_file.read_text()

# Glob patterns
src = Path('src')
python_files = list(src.glob('**/*.py'))  # recursive
test_files = list(src.glob('test_*.py'))

# Create directories
Path('new/nested/dir').mkdir(parents=True, exist_ok=True)

# Iterate directory
for item in Path('.').iterdir():
    if item.is_file():
        print(item.name)
```

---

## 5. `datetime` Module

```python
from datetime import date, time, datetime, timedelta, timezone
import datetime as dt

# date
today = date.today()
d = date(2024, 1, 15)
print(d.year, d.month, d.day)  # 2024 1 15
print(d.strftime('%B %d, %Y'))  # January 15, 2024
print(d.isoformat())            # 2024-01-15

# time
t = time(14, 30, 45)
print(t.hour, t.minute, t.second)  # 14 30 45

# datetime
now = datetime.now()
utc_now = datetime.now(timezone.utc)
dt_obj = datetime(2024, 1, 15, 14, 30, 45)

# Formatting and parsing
formatted = now.strftime('%Y-%m-%d %H:%M:%S')
parsed = datetime.strptime('2024-01-15 14:30:45', '%Y-%m-%d %H:%M:%S')
iso = now.isoformat()
from_iso = datetime.fromisoformat(iso)

# timedelta — arithmetic
delta = timedelta(days=7, hours=3, minutes=30)
future = now + delta
past = now - timedelta(days=30)
diff = future - now
print(diff.days, diff.seconds)

# Timezone handling
utc = timezone.utc
eastern = timezone(timedelta(hours=-5))
aware_dt = datetime(2024, 1, 15, 12, 0, tzinfo=utc)
eastern_dt = aware_dt.astimezone(eastern)
```

---

## 6. `json` Module

```python
import json

# dumps — Python to JSON string
data = {
    'name': 'Alice',
    'age': 30,
    'scores': [95, 87, 92],
    'active': True,
    'address': None
}

# Basic
json_str = json.dumps(data)

# Pretty print
pretty = json.dumps(data, indent=2, sort_keys=True)
print(pretty)

# loads — JSON string to Python
parsed = json.loads(json_str)
print(parsed['name'])  # 'Alice'

# File I/O
with open('data.json', 'w') as f:
    json.dump(data, f, indent=2)

with open('data.json') as f:
    loaded = json.load(f)

# Custom serialization with default
from datetime import datetime

def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

data_with_date = {'timestamp': datetime.now(), 'value': 42}
json_str = json.dumps(data_with_date, default=json_serializer)

# Custom decoder
def parse_datetime(dct):
    for key, value in dct.items():
        if isinstance(value, str):
            try:
                dct[key] = datetime.fromisoformat(value)
            except ValueError:
                pass
    return dct

parsed = json.loads(json_str, object_hook=parse_datetime)
```

---

## 7. `re` Module

```python
import re

text = "Hello, my email is alice@example.com and phone is 555-1234"

# match — only at beginning of string
m = re.match(r'Hello', text)
print(m.group())  # 'Hello'

# search — anywhere in string
m = re.search(r'\d{3}-\d{4}', text)
print(m.group())  # '555-1234'

# findall — all non-overlapping matches
emails = re.findall(r'\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b', text)
print(emails)  # ['alice@example.com']

# sub — replace
cleaned = re.sub(r'\d{3}-\d{4}', '[REDACTED]', text)
print(cleaned)

# compile — reuse pattern
email_pattern = re.compile(r'\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b', re.IGNORECASE)
matches = email_pattern.findall(text)

# Groups
date_pattern = re.compile(r'(\d{4})-(\d{2})-(\d{2})')
m = date_pattern.search('Date: 2024-01-15')
if m:
    year, month, day = m.groups()
    print(year, month, day)  # 2024 01 15

# Named groups
pattern = re.compile(r'(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})')
m = pattern.search('Date: 2024-01-15')
if m:
    print(m.group('year'))   # 2024
    print(m.groupdict())     # {'year': '2024', 'month': '01', 'day': '15'}

# Flags
text = "Hello\nWorld"
matches = re.findall(r'^[A-Z]\w+', text, re.MULTILINE)
print(matches)  # ['Hello', 'World']
```

---

## 8. `os` and `sys` Modules

```python
import os
import sys

# Environment variables
home = os.environ.get('HOME', '/tmp')
path = os.environ['PATH']
os.environ['MY_VAR'] = 'my_value'

# Path operations (prefer pathlib for new code)
joined = os.path.join('/usr', 'local', 'bin')
dirname = os.path.dirname('/usr/local/bin/python')
basename = os.path.basename('/usr/local/bin/python')
exists = os.path.exists('/usr/local/bin')
abspath = os.path.abspath('relative/path')

# Directory operations
os.makedirs('new/nested/dir', exist_ok=True)
files = os.listdir('.')
for root, dirs, files in os.walk('.'):
    for f in files:
        print(os.path.join(root, f))

# Process info
print(os.getpid())   # current process ID
print(os.getcwd())   # current working directory

# sys module
print(sys.argv)          # command-line arguments
print(sys.version)       # Python version
print(sys.platform)      # 'linux', 'win32', 'darwin'
print(sys.executable)    # path to Python interpreter
print(sys.maxsize)       # max int size
sys.exit(0)              # exit with code (don't run in notebook!)
```

---

## 9. `typing` Module

```python
from typing import (
    List, Dict, Optional, Union, Tuple, Any, Callable,
    TypeVar, Generic, Set, FrozenSet, Sequence, Mapping,
    Iterator, Generator, Type, ClassVar
)

# Basic annotations
def greet(name: str) -> str:
    return f"Hello, {name}!"

def process(items: List[int]) -> Dict[str, int]:
    return {'sum': sum(items), 'count': len(items)}

# Optional — value or None
def find_user(user_id: int) -> Optional[str]:
    users = {1: 'Alice', 2: 'Bob'}
    return users.get(user_id)  # returns str or None

# Union — multiple types
def stringify(value: Union[int, float, str]) -> str:
    return str(value)

# Python 3.10+ syntax: X | Y
def new_stringify(value: int | float | str) -> str:
    return str(value)

# Callable
def apply(func: Callable[[int, int], int], a: int, b: int) -> int:
    return func(a, b)

# TypeVar — generic functions
T = TypeVar('T')

def first(items: List[T]) -> Optional[T]:
    return items[0] if items else None

# Generic classes
class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: List[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def peek(self) -> Optional[T]:
        return self._items[-1] if self._items else None

# TypedDict
from typing import TypedDict

class UserDict(TypedDict):
    name: str
    age: int
    email: str

def process_user(user: UserDict) -> str:
    return f"{user['name']} ({user['age']})"

# Protocol — structural subtyping (duck typing with types)
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...

class Circle:
    def draw(self) -> None:
        print("Drawing circle")

def render(shape: Drawable) -> None:
    shape.draw()  # works with any object that has draw()

# Literal
from typing import Literal

def set_direction(direction: Literal['north', 'south', 'east', 'west']) -> None:
    print(f"Going {direction}")
```

---

## Interview Questions

**Q1: What is the difference between `Counter` and `defaultdict(int)`?**

Answer: Both count occurrences, but `Counter` is purpose-built for counting with extra features: `most_common()`, arithmetic operations (`+`, `-`, `&`, `|`), and it returns `0` for missing keys without creating them. `defaultdict(int)` creates the key with value `0` on first access. Use `Counter` when you need counting-specific operations; use `defaultdict` for general grouping/accumulation.

```python
from collections import Counter, defaultdict

c = Counter('aabbc')
print(c.most_common(2))  # [('a', 2), ('b', 2)]
print(c['z'])            # 0, key NOT created

dd = defaultdict(int)
dd['a'] += 1
print(dd['z'])           # 0, key IS created
```

---

**Q2: When would you use `deque` over a `list`?**

Answer: Use `deque` when you need O(1) operations at both ends. `list.insert(0, x)` and `list.pop(0)` are O(n) because they shift all elements. `deque.appendleft()` and `deque.popleft()` are O(1). Use `deque` for: queues (FIFO), sliding windows (`maxlen`), BFS algorithms, and any scenario requiring frequent left-side operations. Use `list` when you need random access by index (O(1) for list, O(n) for deque).

---

**Q3: How does `lru_cache` work and when should you use it?**

Answer: `lru_cache` (Least Recently Used cache) memoizes function results. It stores up to `maxsize` results; when full, it evicts the least recently used entry. It uses the function arguments as the cache key (arguments must be hashable). Use it for: pure functions with expensive computation, recursive algorithms (Fibonacci, dynamic programming), and repeated calls with the same arguments. Avoid it for functions with side effects or mutable arguments.

```python
import functools

@functools.lru_cache(maxsize=None)  # None = unlimited
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

fib(100)  # instant
print(fib.cache_info())  # hits, misses, size
fib.cache_clear()        # clear the cache
```

---

**Q4: What is the difference between `re.match()`, `re.search()`, and `re.findall()`?**

Answer: `re.match()` only matches at the beginning of the string. `re.search()` scans the entire string and returns the first match anywhere. `re.findall()` returns all non-overlapping matches as a list of strings (or tuples if groups are used). For most use cases, `re.search()` is more useful than `re.match()`. Use `re.compile()` when reusing a pattern multiple times for better performance.

---

**Q5: What is `functools.partial` and when is it useful?**

Answer: `partial` creates a new callable with some arguments pre-filled. It's useful for: creating specialized versions of generic functions, adapting function signatures for callbacks/APIs that expect specific signatures, and avoiding lambda when partially applying arguments.

```python
from functools import partial

# Instead of: lambda x: pow(x, 2)
square = partial(pow, exp=2)

# Adapt for map
double = partial(map, lambda x: x * 2)
print(list(double([1, 2, 3])))  # [2, 4, 6]

# Fix keyword arguments
import json
compact_json = partial(json.dumps, separators=(',', ':'))
print(compact_json({'a': 1}))  # '{"a":1}'
```

---

**Q6: How do you handle timezone-aware datetimes in Python?**

Answer: Use `datetime.now(timezone.utc)` for UTC-aware datetimes. Never use `datetime.utcnow()` — it returns a naive datetime that looks like UTC but has no timezone info. For timezone conversions, use `astimezone()`. For production code, use the `zoneinfo` module (Python 3.9+) or `pytz` for named timezones.

```python
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo  # Python 3.9+

utc_now = datetime.now(timezone.utc)
eastern = utc_now.astimezone(ZoneInfo('America/New_York'))
print(eastern.isoformat())
```

---

**Q7: What is `itertools.groupby` and what's the common gotcha?**

Answer: `groupby` groups consecutive elements with the same key. The gotcha: it only groups consecutive elements, so the input must be sorted by the key first if you want all elements with the same key grouped together. Also, the group iterator is consumed when you advance to the next group.

```python
from itertools import groupby

data = [1, 1, 2, 2, 1, 1]  # NOT sorted
for key, group in groupby(data):
    print(key, list(group))
# 1 [1, 1]
# 2 [2, 2]
# 1 [1, 1]  ← separate group because not consecutive!

# Fix: sort first
for key, group in groupby(sorted(data)):
    print(key, list(group))
# 1 [1, 1, 1, 1]
# 2 [2, 2]
```

---

**Q8: What is `typing.Protocol` and how does it differ from ABC?**

Answer: `Protocol` enables structural subtyping (duck typing with static type checking). A class satisfies a Protocol if it has the required methods/attributes — no explicit inheritance needed. ABCs require explicit inheritance (`class MyClass(MyABC)`). Protocols are better for third-party classes you can't modify and for expressing "anything with a `draw()` method" without forcing inheritance.

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...

class Circle:  # no inheritance from Drawable!
    def draw(self) -> None:
        print("circle")

def render(shape: Drawable) -> None:
    shape.draw()

render(Circle())  # type-checks correctly
```

---

**Q9: What is `ChainMap` and when would you use it?**

Answer: `ChainMap` combines multiple dictionaries into a single view without copying. Lookups search each map in order; writes go to the first map. Use cases: layered configuration (command-line args → env vars → config file → defaults), scope chains (like Python's own variable lookup), and temporary overrides without modifying the original dict.

---

**Q10: What is the difference between `namedtuple` and a dataclass?**

Answer: `namedtuple` creates immutable, tuple-based classes — memory-efficient, hashable, unpackable, but immutable. Dataclasses (`@dataclass`) create regular classes with mutable fields by default, support default values, `__post_init__`, inheritance, and can be made frozen (immutable). Use `namedtuple` for simple immutable records; use `dataclass` when you need mutability, methods, or more complex initialization.

```python
from collections import namedtuple
from dataclasses import dataclass

Point = namedtuple('Point', ['x', 'y'])
p = Point(1, 2)
# p.x = 3  # AttributeError — immutable

@dataclass
class MutablePoint:
    x: float
    y: float

mp = MutablePoint(1, 2)
mp.x = 3  # OK
```
