# 03 — File I/O & Serialization

## File I/O Basics

```python
# Open modes
# 'r'  — read (default)
# 'w'  — write (truncates)
# 'a'  — append
# 'x'  — exclusive create (fails if exists)
# 'b'  — binary mode
# 't'  — text mode (default)
# '+'  — read+write

# Always use context manager
with open('file.txt', 'r', encoding='utf-8') as f:
    content = f.read()          # entire file as string
    # OR
    lines = f.readlines()       # list of lines
    # OR
    for line in f:              # lazy line-by-line (memory efficient)
        process(line.rstrip())
```

## Reading Strategies

```python
# read() — entire file into memory (bad for large files)
with open('big.txt') as f:
    data = f.read()

# readline() — one line at a time
with open('big.txt') as f:
    while line := f.readline():
        process(line)

# Chunked reading — best for large binary files
def read_chunks(path, size=8192):
    with open(path, 'rb') as f:
        while chunk := f.read(size):
            yield chunk
```

## Writing

```python
with open('out.txt', 'w', encoding='utf-8') as f:
    f.write('Hello\n')
    f.writelines(['line1\n', 'line2\n'])

# print() to file
with open('out.txt', 'w') as f:
    print('Hello', file=f)
    print('World', file=f, end='')
```

## pathlib (Modern Path Handling)

```python
from pathlib import Path

p = Path('data') / 'input.txt'
p.parent.mkdir(parents=True, exist_ok=True)

# Read/write
text = p.read_text(encoding='utf-8')
p.write_text('content', encoding='utf-8')
data = p.read_bytes()
p.write_bytes(b'\x00\x01')

# Navigation
print(p.name)       # 'input.txt'
print(p.stem)       # 'input'
print(p.suffix)     # '.txt'
print(p.parent)     # data/
print(p.resolve())  # absolute path

# Glob
for f in Path('.').glob('**/*.py'):
    print(f)
```

## JSON

```python
import json

data = {'name': 'Alice', 'scores': [95, 87, 92], 'active': True}

# Serialize
json_str = json.dumps(data, indent=2, sort_keys=True)
with open('data.json', 'w') as f:
    json.dump(data, f, indent=2)

# Deserialize
obj = json.loads(json_str)
with open('data.json') as f:
    obj = json.load(f)

# Custom encoder
class DateEncoder(json.JSONEncoder):
    def default(self, obj):
        from datetime import date, datetime
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)

json.dumps({'date': datetime.now()}, cls=DateEncoder)
```

## Pickle

```python
import pickle

data = {'key': [1, 2, 3], 'nested': {'a': 1}}

# Serialize
with open('data.pkl', 'wb') as f:
    pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)

# Deserialize
with open('data.pkl', 'rb') as f:
    loaded = pickle.load(f)

# In-memory
blob = pickle.dumps(data)
obj  = pickle.loads(blob)
```

⚠️ **Security**: Never unpickle data from untrusted sources — it can execute arbitrary code.

## CSV

```python
import csv

# Write
with open('data.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['name', 'score'])
    writer.writeheader()
    writer.writerows([
        {'name': 'Alice', 'score': 95},
        {'name': 'Bob',   'score': 87},
    ])

# Read
with open('data.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row['name'], row['score'])
```

## Interview Questions

### Q1: What is the difference between `read()`, `readline()`, and `readlines()`?
**Answer:**
- `read()` — reads entire file into one string. Bad for large files.
- `readline()` — reads one line. Good for streaming.
- `readlines()` — reads all lines into a list. Loads everything into memory.
- Iterating the file object directly is most memory-efficient.

```python
# Most memory-efficient for large files
with open('large.txt') as f:
    for line in f:   # lazy iteration
        process(line)
```

### Q2: What is the difference between JSON and Pickle?
**Answer:**
| | JSON | Pickle |
|---|---|---|
| Format | Text (human-readable) | Binary |
| Types | str, int, float, bool, list, dict, None | Any Python object |
| Cross-language | Yes | Python only |
| Security | Safe | **Unsafe** (arbitrary code execution) |
| Speed | Slower | Faster |
| Use case | APIs, config, data exchange | Caching Python objects |

### Q3: How do you handle large files efficiently?
**Answer:**
```python
# Generator-based chunked processing
def process_large_file(path):
    with open(path, encoding='utf-8') as f:
        for line in f:          # lazy — one line at a time
            yield line.strip()

# Binary chunked reading
def read_binary_chunks(path, chunk_size=65536):
    with open(path, 'rb') as f:
        while chunk := f.read(chunk_size):
            yield chunk
```

### Q4: What is `newline=''` in CSV writing?
**Answer:**
On Windows, Python's text mode adds `\r\n` line endings. The `csv` module also adds `\r\n`. Without `newline=''`, you get `\r\r\n` (double carriage return). Always use `newline=''` when writing CSV files.

### Q5: How do you atomically write a file?
**Answer:**
Write to a temp file, then rename — rename is atomic on most OS:
```python
import os
import tempfile
from pathlib import Path

def atomic_write(path, content):
    dir_ = Path(path).parent
    with tempfile.NamedTemporaryFile('w', dir=dir_, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    os.replace(tmp_path, path)  # atomic on POSIX
```
