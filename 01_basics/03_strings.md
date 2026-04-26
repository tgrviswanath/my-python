# 03 — Strings

## String Basics

Strings are **immutable** sequences of Unicode characters.

```python
s1 = 'single quotes'
s2 = "double quotes"
s3 = '''triple
quoted'''
s4 = r"raw\nstring"    # raw — backslashes not escaped
s5 = b"bytes"          # bytes literal
s6 = f"value={42}"     # f-string (Python 3.6+)
```

## String Methods (Most Important)

```python
s = "  Hello, World!  "

# Case
s.upper()        # "  HELLO, WORLD!  "
s.lower()        # "  hello, world!  "
s.title()        # "  Hello, World!  "
s.swapcase()     # "  hELLO, wORLD!  "

# Strip
s.strip()        # "Hello, World!"
s.lstrip()       # "Hello, World!  "
s.rstrip()       # "  Hello, World!"

# Search
s.find("World")  # 9 (index), -1 if not found
s.index("World") # 9, raises ValueError if not found
s.count("l")     # 3
s.startswith("  Hello")  # True
s.endswith("!  ")        # True

# Replace & Split
s.replace("World", "Python")
"a,b,c".split(",")       # ['a', 'b', 'c']
"a,b,c".split(",", 1)    # ['a', 'b,c'] — max 1 split
" ".join(["a", "b"])     # "a b"

# Check
"abc123".isalnum()   # True
"abc".isalpha()      # True
"123".isdigit()      # True
"  ".isspace()       # True
```

## String Formatting

```python
name, age = "Alice", 30

# f-strings (preferred, Python 3.6+)
f"Name: {name}, Age: {age}"
f"{3.14159:.2f}"          # "3.14"
f"{1000000:,}"            # "1,000,000"
f"{42:08b}"               # "00101010" (binary, zero-padded)
f"{name!r}"               # "'Alice'" (repr)
f"{name!s}"               # "Alice" (str)
f"{name!a}"               # "'Alice'" (ascii)

# format() method
"{} is {}".format(name, age)
"{name} is {age}".format(name=name, age=age)
"{0} {1} {0}".format("a", "b")  # "a b a"

# % formatting (old style)
"%s is %d" % (name, age)
```

## String Slicing

```python
s = "Hello, World!"
#    0123456789...

s[0]      # 'H'
s[-1]     # '!'
s[0:5]    # 'Hello'
s[7:]     # 'World!'
s[:5]     # 'Hello'
s[::2]    # 'Hlo ol!'  (every 2nd char)
s[::-1]   # '!dlroW ,olleH'  (reverse)
```

## String Immutability

```python
s = "hello"
s[0] = "H"  # TypeError!

# To "modify", create a new string
s = "H" + s[1:]  # "Hello"
# or
s = s.replace("h", "H", 1)
```

---

## Interview Questions

### Q1: How do you reverse a string in Python?
**Answer:**
```python
s = "hello"
reversed_s = s[::-1]          # "olleh" — slicing
reversed_s = "".join(reversed(s))  # using reversed()
```

---

### Q2: What is the difference between `find()` and `index()`?
**Answer:**
- `find()` returns `-1` if substring not found
- `index()` raises `ValueError` if substring not found

```python
"hello".find("x")   # -1
"hello".index("x")  # ValueError
```

---

### Q3: How do you check if a string is a palindrome?
**Answer:**
```python
def is_palindrome(s):
    s = s.lower().replace(" ", "")
    return s == s[::-1]

is_palindrome("racecar")  # True
is_palindrome("A man a plan a canal Panama")  # True
```

---

### Q4: What is string interning?
**Answer:**
Python automatically **interns** (caches) short strings and string literals that look like identifiers. This means two variables with the same string value may point to the same object.

```python
a = "hello"
b = "hello"
a is b   # True — interned

a = "hello world"
b = "hello world"
a is b   # may be False — not always interned
```
Use `sys.intern()` to explicitly intern a string.

---

### Q5: What is the time complexity of string concatenation in a loop?
**Answer:**
`str += str` in a loop is **O(n²)** because strings are immutable — each concatenation creates a new string.

```python
# Bad — O(n²)
result = ""
for s in strings:
    result += s

# Good — O(n)
result = "".join(strings)
```

---

### Q6: How do f-strings differ from `.format()`?
**Answer:**
- f-strings are **evaluated at runtime** and are generally **faster**
- f-strings support arbitrary expressions: `f"{2+2}"`, `f"{obj.method()}"`
- `.format()` is more flexible for reusable templates

```python
# f-string — expression evaluated inline
x = 10
f"{x ** 2 + 1}"   # "101"

# format — template reuse
template = "{name} scored {score}"
template.format(name="Alice", score=95)
template.format(name="Bob", score=87)
```

---

### Q7: How do you count occurrences of each character in a string?
**Answer:**
```python
from collections import Counter

s = "hello world"
counts = Counter(s)
print(counts)  # Counter({'l': 3, 'o': 2, ...})
print(counts['l'])  # 3

# Manual approach
freq = {}
for c in s:
    freq[c] = freq.get(c, 0) + 1
```

---

### Q8: What are raw strings and when do you use them?
**Answer:**
Raw strings (`r"..."`) treat backslashes as literal characters, not escape sequences. Used for:
- Regular expressions: `r"\d+\.\d+"`
- Windows file paths: `r"C:\Users\name\file.txt"`

```python
print("\n")    # newline
print(r"\n")   # \n (literal)
import re
re.match(r"\d+", "123")  # correct regex
```
