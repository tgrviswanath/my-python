# Python Strings & I/O — Deep Dive

## Table of Contents
1. [String Internals](#string-internals)
2. [String Methods](#string-methods)
3. [String Formatting](#string-formatting)
4. [Regular Expressions](#regular-expressions)
5. [Input / Output](#input--output)
6. [String Algorithms](#string-algorithms)
7. [encode / decode](#encode--decode)
8. [Interview Q&A](#interview-qa)

---

## String Internals

### Unicode and PEP 393

Python 3 strings are **Unicode** by default. Since Python 3.3 (PEP 393), CPython uses a **flexible string representation** — the internal encoding depends on the highest code point in the string:

| Kind | Code point range | Bytes/char | C type |
|------|-----------------|------------|--------|
| Latin-1 (UCS-1) | U+0000–U+00FF | 1 | `Py_UCS1` |
| UCS-2 | U+0000–U+FFFF | 2 | `Py_UCS2` |
| UCS-4 | U+0000–U+10FFFF | 4 | `Py_UCS4` |

```python
import sys

s1 = "hello"          # Latin-1: 5 × 1 = 5 bytes data
s2 = "héllo"          # Latin-1: é = U+00E9, still 1 byte/char
s3 = "你好世界"         # UCS-2: 4 × 2 = 8 bytes data
s4 = "😀🎉"            # UCS-4: 2 × 4 = 8 bytes data

for name, s in [("ASCII", s1), ("Latin-1", s2), ("UCS-2", s3), ("UCS-4", s4)]:
    print(f"{name:8s}: {sys.getsizeof(s):3d} bytes, len={len(s)}")
```

### Why This Matters

- Adding a single emoji to a Latin-1 string **quadruples** its memory usage (1→4 bytes/char).
- `len()` returns the number of **Unicode code points**, not bytes.
- `sys.getsizeof()` returns the Python object size, not the encoded byte size.

### Immutability

Strings are immutable — every "modification" creates a new object:

```python
s = "hello"
id_before = id(s)
s += " world"
print(id(s) == id_before)  # False — new object

# Efficient string building: use join() or io.StringIO
parts = []
for word in words:
    parts.append(word)
result = " ".join(parts)  # O(n) — one allocation

# Or io.StringIO for complex building
import io
buf = io.StringIO()
for word in words:
    buf.write(word)
    buf.write(" ")
result = buf.getvalue()
```

---

## String Methods

### Case Methods

```python
s = "Hello, World!"
s.lower()          # "hello, world!"
s.upper()          # "HELLO, WORLD!"
s.title()          # "Hello, World!"
s.capitalize()     # "Hello, world!"  (only first char)
s.swapcase()       # "hELLO, wORLD!"
s.casefold()       # "hello, world!"  (aggressive, handles ß→ss)
```

### Search and Test Methods

```python
s = "Hello, World!"
s.find("World")        # 7  (index of first occurrence, -1 if not found)
s.rfind("l")           # 10 (rightmost occurrence)
s.index("World")       # 7  (like find but raises ValueError if not found)
s.count("l")           # 3
s.startswith("Hello")  # True
s.endswith("!")        # True
s.startswith(("Hi", "Hello"))  # True — tuple of prefixes

# Test character types
"abc123".isalnum()     # True
"abc".isalpha()        # True
"123".isdigit()        # True
"123".isnumeric()      # True (also handles ², ³, etc.)
"   ".isspace()        # True
"Hello World".istitle()# True
"HELLO".isupper()      # True
"hello".islower()      # True
```

### Modification Methods

```python
s = "  Hello, World!  "
s.strip()              # "Hello, World!"  (both ends)
s.lstrip()             # "Hello, World!  " (left only)
s.rstrip()             # "  Hello, World!" (right only)
s.strip("!H")          # strips chars in the set, not substring

s.replace("World", "Python")          # "  Hello, Python!  "
s.replace("l", "L", 2)               # replace max 2 occurrences

"hello".center(11)     # "   hello   "
"hello".ljust(10, '-') # "hello-----"
"hello".rjust(10, '-') # "-----hello"
"42".zfill(5)          # "00042"
```

### Split and Join

```python
"a,b,c".split(",")          # ['a', 'b', 'c']
"a,b,c".split(",", 1)       # ['a', 'b,c']  (max 1 split)
"a  b  c".split()           # ['a', 'b', 'c']  (any whitespace)
"line1\nline2\nline3".splitlines()  # ['line1', 'line2', 'line3']

# rsplit — split from right
"a.b.c.d".rsplit(".", 1)    # ['a.b.c', 'd']

# partition — split into 3 parts
"key=value".partition("=")  # ('key', '=', 'value')
"no-sep".partition("=")     # ('no-sep', '', '')

# join — the inverse of split
", ".join(["a", "b", "c"])  # "a, b, c"
"".join(["h","e","l","l","o"])  # "hello"
```

### Encoding Methods

```python
"hello".encode("utf-8")     # b'hello'
"café".encode("utf-8")      # b'caf\xc3\xa9'
"café".encode("latin-1")    # b'caf\xe9'
b"hello".decode("utf-8")    # "hello"
```

---

## String Formatting

### f-strings (Python 3.6+) — Fastest

```python
name = "Alice"
score = 95.678

# Basic
f"Hello, {name}!"

# Expressions
f"Score: {score:.2f}"          # "Score: 95.68"
f"Double: {score * 2}"
f"Upper: {name.upper()}"

# Format spec
f"{42:08b}"                    # "00101010"  (binary, zero-padded)
f"{3.14159:.3f}"               # "3.142"
f"{1000000:,}"                 # "1,000,000"
f"{0.75:.1%}"                  # "75.0%"
f"{'left':<10}|"               # "left      |"
f"{'right':>10}|"              # "     right|"
f"{'center':^10}|"             # "  center  |"

# Debugging (Python 3.8+)
x = 42
f"{x=}"                        # "x=42"
f"{x = :.2f}"                  # "x = 42.00"

# Nested f-strings
width = 10
f"{'hello':>{width}}"          # "     hello"
```

### str.format() — Flexible

```python
"{} {}".format("Hello", "World")
"{0} {1} {0}".format("ha", "ho")   # "ha ho ha"
"{name} is {age}".format(name="Alice", age=30)

# Format spec
"{:.2f}".format(3.14159)
"{:>10}".format("right")
"{:0>5}".format(42)             # "00042"

# With dict unpacking
data = {"name": "Alice", "score": 95}
"{name}: {score}".format(**data)
```

### % Formatting — Legacy

```python
"Hello, %s!" % "World"
"Score: %.2f" % 95.678
"%d items at $%.2f each" % (5, 3.99)
"%(name)s: %(score)d" % {"name": "Alice", "score": 95}
```

### Performance Comparison

```python
import timeit

name, score = "Alice", 95.678
N = 1_000_000

t_fstr   = timeit.timeit(lambda: f"Hello, {name}! Score: {score:.2f}", number=N)
t_format = timeit.timeit(lambda: "Hello, {}! Score: {:.2f}".format(name, score), number=N)
t_pct    = timeit.timeit(lambda: "Hello, %s! Score: %.2f" % (name, score), number=N)

print(f"f-string:   {t_fstr:.3f}s")    # fastest
print(f".format():  {t_format:.3f}s")  # ~2x slower
print(f"% format:   {t_pct:.3f}s")     # ~1.5x slower than f-string
```

**f-strings are fastest** because they're compiled to bytecode that directly calls `format()` on each expression — no string parsing at runtime.

---

## Regular Expressions

### re Module Basics

```python
import re

text = "Contact us at support@example.com or sales@company.org"

# re.search — find first match anywhere in string
m = re.search(r'\b\w+@\w+\.\w+\b', text)
if m:
    print(m.group())    # "support@example.com"
    print(m.start())    # start index
    print(m.end())      # end index
    print(m.span())     # (start, end)

# re.match — match only at beginning of string
m = re.match(r'Contact', text)  # matches
m = re.match(r'support', text)  # None — not at start

# re.fullmatch — entire string must match
re.fullmatch(r'\d+', "12345")   # match
re.fullmatch(r'\d+', "123abc")  # None

# re.findall — return all matches as list
emails = re.findall(r'\b[\w.]+@[\w.]+\.\w+\b', text)
# ['support@example.com', 'sales@company.org']

# re.finditer — return iterator of match objects
for m in re.finditer(r'\b\w+@\w+\.\w+\b', text):
    print(m.group(), m.span())

# re.sub — replace matches
result = re.sub(r'\b\w+@\w+\.\w+\b', '[REDACTED]', text)

# re.split — split on pattern
parts = re.split(r'[,;\s]+', "one, two;  three four")
# ['one', 'two', 'three', 'four']
```

### Compiled Patterns

```python
# Compile for reuse — faster when used many times
email_pattern = re.compile(r'\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b')

for line in lines:
    if email_pattern.search(line):
        process(line)
```

### Groups and Named Groups

```python
# Capturing groups
m = re.search(r'(\d{4})-(\d{2})-(\d{2})', "Date: 2024-01-15")
print(m.group(0))   # "2024-01-15"  (full match)
print(m.group(1))   # "2024"
print(m.group(2))   # "01"
print(m.groups())   # ('2024', '01', '15')

# Named groups
m = re.search(r'(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})', "2024-01-15")
print(m.group('year'))   # "2024"
print(m.groupdict())     # {'year': '2024', 'month': '01', 'day': '15'}

# Non-capturing group (?:...)
re.findall(r'(?:Mr|Ms|Dr)\. (\w+)', "Dr. Smith and Ms. Jones")
# ['Smith', 'Jones']
```

### Common Patterns

```python
patterns = {
    'email':    r'\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b',
    'url':      r'https?://[\w/:%#\$&\?\(\)~\.=\+\-]+',
    'phone_us': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
    'ipv4':     r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
    'date_iso': r'\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b',
    'integer':  r'-?\d+',
    'float':    r'-?\d+\.?\d*(?:[eE][+-]?\d+)?',
    'hex':      r'0[xX][0-9a-fA-F]+',
    'word':     r'\b\w+\b',
    'whitespace': r'\s+',
}
```

### Flags

```python
re.search(r'hello', "Hello World", re.IGNORECASE)  # case-insensitive
re.search(r'^hello', "line1\nhello", re.MULTILINE)  # ^ matches line start
re.search(r'.+', "line1\nline2", re.DOTALL)         # . matches newline
re.compile(r'''
    \d{4}   # year
    -
    \d{2}   # month
    -
    \d{2}   # day
''', re.VERBOSE)  # ignore whitespace and comments
```

---

## Input / Output

### print()

```python
print("Hello", "World")              # "Hello World" (sep=' ')
print("Hello", "World", sep=", ")    # "Hello, World"
print("Hello", end="")               # no newline
print("Hello", file=sys.stderr)      # write to stderr
print(*[1, 2, 3], sep="-")           # "1-2-3"

# Flush for real-time output
import sys
print("Loading...", end="", flush=True)
```

### input()

```python
name = input("Enter your name: ")   # always returns str
age  = int(input("Enter age: "))    # convert explicitly

# Safe input with validation
while True:
    try:
        n = int(input("Enter a number: "))
        break
    except ValueError:
        print("Invalid input, try again.")
```

### sys.stdin / sys.stdout / sys.stderr

```python
import sys

# Read all stdin (useful for competitive programming)
data = sys.stdin.read()
lines = sys.stdin.readlines()

# Read line by line
for line in sys.stdin:
    process(line.rstrip('\n'))

# Write to stdout/stderr
sys.stdout.write("Hello\n")
sys.stderr.write("Error: something went wrong\n")

# Redirect stdout
import io
old_stdout = sys.stdout
sys.stdout = io.StringIO()
print("captured")
output = sys.stdout.getvalue()
sys.stdout = old_stdout
```

### File I/O

```python
# Reading
with open("file.txt", "r", encoding="utf-8") as f:
    content = f.read()          # entire file as string
    lines = f.readlines()       # list of lines
    for line in f:              # memory-efficient line iteration
        process(line)

# Writing
with open("output.txt", "w", encoding="utf-8") as f:
    f.write("Hello\n")
    f.writelines(["line1\n", "line2\n"])

# Append
with open("log.txt", "a", encoding="utf-8") as f:
    f.write("new entry\n")

# Binary
with open("image.png", "rb") as f:
    data = f.read()
```

---

## String Algorithms

### Reverse a String

```python
def reverse_string(s: str) -> str:
    return s[::-1]

# Or using reversed()
def reverse_string_v2(s: str) -> str:
    return "".join(reversed(s))

# Benchmark: slicing is faster
import timeit
s = "hello world" * 100
t1 = timeit.timeit(lambda: s[::-1], number=100_000)
t2 = timeit.timeit(lambda: "".join(reversed(s)), number=100_000)
print(f"Slicing: {t1:.3f}s, reversed+join: {t2:.3f}s")
```

### Palindrome Check

```python
def is_palindrome(s: str) -> bool:
    """Check if string is a palindrome (ignoring case and non-alphanumeric)."""
    cleaned = "".join(c.lower() for c in s if c.isalnum())
    return cleaned == cleaned[::-1]

# Two-pointer approach (more memory efficient)
def is_palindrome_v2(s: str) -> bool:
    cleaned = [c.lower() for c in s if c.isalnum()]
    left, right = 0, len(cleaned) - 1
    while left < right:
        if cleaned[left] != cleaned[right]:
            return False
        left += 1
        right -= 1
    return True

print(is_palindrome("A man, a plan, a canal: Panama"))  # True
print(is_palindrome("race a car"))                       # False
```

### Anagram Check

```python
from collections import Counter

def is_anagram(s1: str, s2: str) -> bool:
    """Check if two strings are anagrams."""
    return Counter(s1.lower()) == Counter(s2.lower())

# Alternative: sort-based (O(n log n) vs O(n) for Counter)
def is_anagram_sort(s1: str, s2: str) -> bool:
    return sorted(s1.lower()) == sorted(s2.lower())

print(is_anagram("listen", "silent"))   # True
print(is_anagram("hello", "world"))     # False
```

### Most Frequent Character

```python
from collections import Counter

def most_frequent_char(s: str) -> tuple[str, int]:
    """Return (char, count) of most frequent character."""
    if not s:
        raise ValueError("Empty string")
    counter = Counter(s)
    return counter.most_common(1)[0]

# Manual approach
def most_frequent_manual(s: str) -> str:
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    return max(freq, key=freq.get)

print(most_frequent_char("hello world"))  # ('l', 3)
```

### String Compression

```python
def compress(s: str) -> str:
    """Run-length encoding: 'aaabbc' → 'a3b2c1'."""
    if not s:
        return s
    result = []
    count = 1
    for i in range(1, len(s)):
        if s[i] == s[i-1]:
            count += 1
        else:
            result.append(s[i-1] + str(count))
            count = 1
    result.append(s[-1] + str(count))
    compressed = "".join(result)
    return compressed if len(compressed) < len(s) else s

print(compress("aaabbc"))    # "a3b2c1"
print(compress("abcd"))      # "abcd" (no compression benefit)
```

### Find All Permutations

```python
from itertools import permutations

def get_permutations(s: str) -> list[str]:
    return ["".join(p) for p in permutations(s)]

print(get_permutations("abc"))
# ['abc', 'acb', 'bac', 'bca', 'cab', 'cba']
```

---

## encode / decode

### Encoding Basics

```python
# str → bytes: encode
text = "café"
utf8  = text.encode("utf-8")    # b'caf\xc3\xa9'  (2 bytes for é)
latin = text.encode("latin-1")  # b'caf\xe9'       (1 byte for é)
ascii_enc = text.encode("ascii", errors="ignore")   # b'caf'
ascii_rep = text.encode("ascii", errors="replace")  # b'caf?'
ascii_xml = text.encode("ascii", errors="xmlcharrefreplace")  # b'caf&#233;'

# bytes → str: decode
utf8.decode("utf-8")    # "café"
latin.decode("latin-1") # "café"

# Detect encoding (requires chardet library)
# import chardet
# chardet.detect(unknown_bytes)
```

### Common Encodings

| Encoding | Description | Bytes for ASCII | Bytes for é |
|----------|-------------|-----------------|-------------|
| UTF-8 | Variable-width, ASCII-compatible | 1 | 2 |
| UTF-16 | Variable-width, BOM | 2 | 2 |
| UTF-32 | Fixed 4 bytes | 4 | 4 |
| Latin-1 | Western European | 1 | 1 |
| ASCII | 7-bit only | 1 | N/A |

```python
# Always specify encoding explicitly
with open("file.txt", "r", encoding="utf-8") as f:
    content = f.read()

# Base64 encoding (for binary data in text contexts)
import base64
encoded = base64.b64encode(b"Hello, World!")  # b'SGVsbG8sIFdvcmxkIQ=='
decoded = base64.b64decode(encoded)           # b'Hello, World!'
```

---

## Interview Q&A

### Q1: Why are Python strings immutable, and what are the performance implications?

**A:** Strings are immutable for several reasons:
1. **Safety**: Strings used as dict keys or set members can't change their hash value.
2. **Interning**: Immutability allows safe sharing of string objects.
3. **Thread safety**: No locking needed for concurrent reads.

Performance implication: String concatenation with `+` in a loop is O(n²) because each `+` creates a new string. Use `"".join(parts)` for O(n) performance, or `io.StringIO` for complex building.

---

### Q2: What is the difference between `str.find()` and `str.index()`?

**A:** Both search for a substring and return its index. The difference is in failure behavior:
- `find()` returns **-1** if not found.
- `index()` raises **ValueError** if not found.

Use `find()` when "not found" is a normal case you'll handle. Use `index()` when the substring must be present and absence is a programming error.

---

### Q3: How do f-strings work internally, and why are they faster than `.format()`?

**A:** f-strings are processed at **compile time** — the Python parser converts `f"Hello, {name}!"` into bytecode that calls `FORMAT_VALUE` and `BUILD_STRING` instructions directly. There's no string parsing at runtime. `.format()` parses the format string at runtime on every call, which adds overhead. `%` formatting also parses at runtime. f-strings are typically 2–3× faster than `.format()` for simple cases.

---

### Q4: What is the difference between `re.match()`, `re.search()`, and `re.fullmatch()`?

**A:**
- `re.match()`: Matches only at the **beginning** of the string.
- `re.search()`: Searches for a match **anywhere** in the string.
- `re.fullmatch()`: The **entire** string must match the pattern.

```python
re.match(r'\d+', "abc123")    # None — not at start
re.search(r'\d+', "abc123")   # match "123"
re.fullmatch(r'\d+', "123")   # match
re.fullmatch(r'\d+', "123abc")# None — not full match
```

---

### Q5: How do you efficiently build a large string in Python?

**A:** Avoid `+=` in a loop — it's O(n²) because each concatenation creates a new string. Use:
1. **`"".join(parts)`**: Collect parts in a list, join once — O(n).
2. **`io.StringIO`**: For complex building with mixed writes.
3. **f-strings or format()**: For simple templating.

```python
# O(n²) — BAD
result = ""
for word in words:
    result += word + " "

# O(n) — GOOD
result = " ".join(words)

# O(n) — GOOD for complex cases
import io
buf = io.StringIO()
for word in words:
    buf.write(word)
    buf.write(" ")
result = buf.getvalue()
```

---

### Q6: What is the difference between `bytes` and `str` in Python 3?

**A:** In Python 3, `str` is a **Unicode text** type (sequence of code points), while `bytes` is a **binary data** type (sequence of integers 0–255). They are completely separate types and cannot be mixed:
- `"hello" + b"world"` → `TypeError`
- You must explicitly encode/decode: `"hello".encode("utf-8")` → `b"hello"`, `b"hello".decode("utf-8")` → `"hello"`.

This is a deliberate design choice to prevent the encoding bugs that plagued Python 2, where `str` was bytes and `unicode` was text.

---

### Q7: What are the most common regex flags and when do you use them?

**A:**
- `re.IGNORECASE` (`re.I`): Case-insensitive matching.
- `re.MULTILINE` (`re.M`): `^` and `$` match start/end of each line, not just the string.
- `re.DOTALL` (`re.S`): `.` matches any character including newline.
- `re.VERBOSE` (`re.X`): Allows whitespace and comments in the pattern for readability.
- `re.ASCII` (`re.A`): `\w`, `\d`, etc. match only ASCII characters.

---

### Q8: How do you check if a string is a palindrome efficiently?

**A:** The most Pythonic approach uses slicing:

```python
def is_palindrome(s):
    return s == s[::-1]
```

For the interview variant (ignore case and non-alphanumeric):

```python
def is_palindrome(s):
    cleaned = "".join(c.lower() for c in s if c.isalnum())
    return cleaned == cleaned[::-1]
```

Time complexity: O(n). Space complexity: O(n) for the reversed copy. For O(1) space, use two pointers.

---

### Q9: What is string interning and how does it affect performance?

**A:** String interning stores only one copy of each distinct string value. CPython automatically interns strings that look like identifiers. Interned strings can be compared with `is` (O(1) pointer comparison) instead of `==` (O(n) character comparison). This matters for dict key lookups — Python uses `is` first before `==` when comparing keys, so interned strings as dict keys are faster to look up.

---

### Q10: What is the difference between `encode()` errors modes: `ignore`, `replace`, `xmlcharrefreplace`, `backslashreplace`?

**A:** When encoding a string to bytes and a character can't be represented in the target encoding:
- `'ignore'`: Silently drops the character.
- `'replace'`: Substitutes `?` (for encoding) or `\ufffd` (for decoding).
- `'xmlcharrefreplace'`: Replaces with XML character reference (`&#233;`).
- `'backslashreplace'`: Replaces with Python backslash escape (`\xe9`).
- `'strict'` (default): Raises `UnicodeEncodeError`.

Use `'ignore'` or `'replace'` for lossy processing, `'xmlcharrefreplace'` for HTML output, `'strict'` when data integrity matters.
