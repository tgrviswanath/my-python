# File I/O in Python

## 1. `open()` — Modes and Basics

```python
# Syntax: open(file, mode='r', encoding=None, buffering=-1, ...)

# Common modes:
# 'r'  — read (default), text mode
# 'w'  — write (truncates existing file)
# 'a'  — append
# 'x'  — exclusive creation (fails if file exists)
# 'b'  — binary mode (combine with r/w/a: 'rb', 'wb')
# '+'  — read+write (combine: 'r+', 'w+', 'a+')
# 't'  — text mode (default)

# Always specify encoding for text files
f = open('file.txt', 'r', encoding='utf-8')
content = f.read()
f.close()  # must close manually — error-prone!
```

---

## 2. `with` Statement — Context Manager (Preferred)

```python
# Automatically closes file even if exception occurs
with open('file.txt', 'r', encoding='utf-8') as f:
    content = f.read()
# f is closed here

# Multiple files
with open('input.txt', 'r') as fin, open('output.txt', 'w') as fout:
    for line in fin:
        fout.write(line.upper())
```

---

## 3. Reading Methods

```python
with open('data.txt', 'r', encoding='utf-8') as f:
    # read() — entire file as string
    content = f.read()

    # read(n) — read n characters
    f.seek(0)  # reset to beginning
    chunk = f.read(100)

    # readline() — one line at a time
    f.seek(0)
    first_line = f.readline()   # includes '\n'
    second_line = f.readline()

    # readlines() — all lines as list
    f.seek(0)
    lines = f.readlines()       # [line1\n, line2\n, ...]

    # Iterate line by line (most memory-efficient)
    f.seek(0)
    for line in f:
        print(line.rstrip('\n'))
```

---

## 4. Writing Methods

```python
# Write (truncates existing content)
with open('output.txt', 'w', encoding='utf-8') as f:
    f.write('Hello, World!\n')
    f.write('Second line\n')

# writelines — write a list of strings (no auto newlines!)
lines = ['line 1\n', 'line 2\n', 'line 3\n']
with open('output.txt', 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Append mode
with open('log.txt', 'a', encoding='utf-8') as f:
    f.write('New log entry\n')

# print() to file
with open('output.txt', 'w', encoding='utf-8') as f:
    print('Hello', 'World', sep=', ', file=f)
    print('Second line', file=f)
```

---

## 5. File Position — `seek()` and `tell()`

```python
with open('data.txt', 'r', encoding='utf-8') as f:
    print(f.tell())      # 0 — at beginning
    f.read(10)
    print(f.tell())      # 10 — after reading 10 chars

    f.seek(0)            # back to beginning
    f.seek(0, 2)         # seek to end (whence=2)
    size = f.tell()      # file size in bytes
    f.seek(-10, 2)       # 10 chars from end
```

---

## 6. `pathlib.Path` for File I/O

```python
from pathlib import Path

# Read
p = Path('data.txt')
content = p.read_text(encoding='utf-8')
lines = content.splitlines()

# Write
p.write_text('Hello, World!\n', encoding='utf-8')

# Binary
binary_data = p.read_bytes()
p.write_bytes(b'\x00\x01\x02\x03')

# Check before reading
if p.exists() and p.is_file():
    content = p.read_text()
```

---

## 7. Binary Files

```python
# Reading binary files
with open('image.png', 'rb') as f:
    header = f.read(8)  # read PNG header
    print(header.hex())

# Writing binary files
with open('output.bin', 'wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n')  # PNG magic bytes
    f.write(bytes([0, 1, 2, 3, 255]))

# Copy binary file
with open('source.bin', 'rb') as src, open('dest.bin', 'wb') as dst:
    while chunk := src.read(8192):  # walrus operator
        dst.write(chunk)

# Using shutil for file operations
import shutil
shutil.copy('source.txt', 'dest.txt')
shutil.copy2('source.txt', 'dest.txt')  # preserves metadata
shutil.move('old_name.txt', 'new_name.txt')
```

---

## 8. `csv` Module

```python
import csv

# Writing CSV
data = [
    ['Name', 'Age', 'City'],
    ['Alice', 30, 'New York'],
    ['Bob', 25, 'London'],
    ['Charlie', 35, 'Tokyo'],
]

with open('people.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerows(data)

# Reading CSV
with open('people.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)  # skip header
    for row in reader:
        print(row)  # ['Alice', '30', 'New York']

# DictWriter — write with column names
with open('people.csv', 'w', newline='', encoding='utf-8') as f:
    fieldnames = ['name', 'age', 'city']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerow({'name': 'Alice', 'age': 30, 'city': 'New York'})
    writer.writerows([
        {'name': 'Bob', 'age': 25, 'city': 'London'},
        {'name': 'Charlie', 'age': 35, 'city': 'Tokyo'},
    ])

# DictReader — read as dicts
with open('people.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row['name'], row['age'])  # Alice 30

# Custom delimiter
with open('data.tsv', 'w', newline='') as f:
    writer = csv.writer(f, delimiter='\t')
    writer.writerow(['col1', 'col2', 'col3'])
```

---

## 9. `json` Module for File I/O

```python
import json

data = {
    'users': [
        {'id': 1, 'name': 'Alice', 'active': True},
        {'id': 2, 'name': 'Bob', 'active': False},
    ],
    'total': 2
}

# Write JSON to file
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# Read JSON from file
with open('data.json', 'r', encoding='utf-8') as f:
    loaded = json.load(f)

print(loaded['users'][0]['name'])  # Alice

# Compact JSON (for APIs)
compact = json.dumps(data, separators=(',', ':'))

# Handle non-serializable types
from datetime import datetime

def default_serializer(obj):
    if isinstance(obj, datetime):
        return {'__datetime__': obj.isoformat()}
    raise TypeError(f'Not serializable: {type(obj)}')

def object_hook(dct):
    if '__datetime__' in dct:
        return datetime.fromisoformat(dct['__datetime__'])
    return dct

# Round-trip with custom types
data_with_dt = {'created': datetime.now(), 'value': 42}
json_str = json.dumps(data_with_dt, default=default_serializer)
restored = json.loads(json_str, object_hook=object_hook)
print(type(restored['created']))  # <class 'datetime.datetime'>
```

---

## 10. `pickle` — Python Object Serialization

```python
import pickle

# Serialize any Python object
data = {
    'model': [1.0, 2.5, 3.7],
    'labels': ['cat', 'dog', 'bird'],
    'metadata': {'version': 1, 'trained': True}
}

# Write
with open('model.pkl', 'wb') as f:
    pickle.dump(data, f)

# Read
with open('model.pkl', 'rb') as f:
    loaded = pickle.load(f)

print(loaded['labels'])  # ['cat', 'dog', 'bird']

# Serialize to bytes (in-memory)
serialized = pickle.dumps(data)
restored = pickle.loads(serialized)

# Custom pickle behavior
class MyClass:
    def __init__(self, value):
        self.value = value
        self._cache = {}  # don't pickle this

    def __getstate__(self):
        state = self.__dict__.copy()
        del state['_cache']  # exclude from pickle
        return state

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._cache = {}  # reinitialize on unpickle

# WARNING: Never unpickle data from untrusted sources!
# pickle can execute arbitrary code during deserialization
```

---

## Interview Questions

**Q1: What is the difference between `read()`, `readline()`, and `readlines()`?**

Answer: `read()` reads the entire file as a single string — simple but loads everything into memory. `readline()` reads one line at a time (including the `\n`) — useful for processing line by line without loading all at once. `readlines()` reads all lines into a list of strings — convenient but loads everything. For large files, iterating directly over the file object (`for line in f`) is most memory-efficient as it reads one line at a time without storing all lines.

```python
with open('large.txt') as f:
    for line in f:          # most memory-efficient
        process(line.rstrip())
```

---

**Q2: Why should you always use `with` when opening files?**

Answer: The `with` statement guarantees the file is closed even if an exception occurs. Without it, if an exception is raised between `open()` and `close()`, the file handle leaks — the file stays open, potentially causing data corruption (unflushed buffers), resource exhaustion (OS file handle limits), or file locking issues. The `with` statement calls `__exit__` which calls `f.close()` in all cases.

---

**Q3: What is the difference between text mode and binary mode?**

Answer: Text mode (`'r'`, `'w'`) decodes bytes to strings using the specified encoding (default: platform-dependent, always specify `encoding='utf-8'`). It also translates line endings (`\r\n` → `\n` on Windows). Binary mode (`'rb'`, `'wb'`) reads/writes raw bytes with no encoding or line ending translation. Use binary mode for: images, audio, video, compressed files, network protocols, or any non-text data.

---

**Q4: What is the `newline=''` parameter in `csv.writer`?**

Answer: When writing CSV files on Windows, Python's text mode translates `\n` to `\r\n`. The `csv` module already adds `\r\n` line endings, so you'd get `\r\r\n` (double carriage return). Setting `newline=''` disables Python's line ending translation, letting the `csv` module handle it correctly. Always use `newline=''` when opening files for `csv.writer` or `csv.DictWriter`.

---

**Q5: When should you use `pickle` vs `json`?**

Answer: Use `json` when: data needs to be human-readable, shared with other languages/systems, or stored long-term. JSON supports only basic types (dict, list, str, int, float, bool, None). Use `pickle` when: you need to serialize arbitrary Python objects (custom classes, numpy arrays, ML models), performance matters, and the data stays within Python. Never unpickle data from untrusted sources — pickle can execute arbitrary code.

---

**Q6: How do you efficiently read a large file without loading it all into memory?**

Answer: Iterate over the file object line by line, or read in chunks:

```python
# Line by line (text files)
with open('large.txt', encoding='utf-8') as f:
    for line in f:
        process(line)

# Chunk by chunk (binary files)
with open('large.bin', 'rb') as f:
    while chunk := f.read(8192):  # 8KB chunks
        process(chunk)

# Using generators
def read_chunks(filepath, chunk_size=8192):
    with open(filepath, 'rb') as f:
        while chunk := f.read(chunk_size):
            yield chunk
```

---

**Q7: What is the difference between `pathlib.Path.read_text()` and `open()`?**

Answer: `Path.read_text()` is a convenience method that opens, reads, and closes the file in one call — great for small files. `open()` gives you a file object with full control: streaming, seeking, partial reads, and write operations. `pathlib` is the modern, object-oriented approach to path manipulation and is preferred over `os.path` for new code.

---

**Q8: How do you handle file encoding issues?**

Answer: Always specify `encoding='utf-8'` explicitly. For files with unknown encoding, use `errors='replace'` or `errors='ignore'` to handle decode errors gracefully. Use `chardet` library to detect encoding. For cross-platform compatibility, avoid relying on the default encoding (it varies by OS and locale).

```python
# Safe reading with error handling
with open('file.txt', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Detect encoding
import chardet
with open('unknown.txt', 'rb') as f:
    raw = f.read()
detected = chardet.detect(raw)
encoding = detected['encoding']
text = raw.decode(encoding)
```
