# JavaScript — Event Loop, Async Programming & Memory Management

## The Event Loop

JavaScript is single-threaded but non-blocking via the event loop.

```
┌─────────────────────────────────────────────────────┐
│                   Call Stack                        │
│  (synchronous code executes here)                   │
└─────────────────────────────────────────────────────┘
         ↑ dequeue when stack empty
┌─────────────────────────────────────────────────────┐
│              Microtask Queue                        │
│  Promise callbacks, queueMicrotask, MutationObserver│
│  (ALWAYS drained before macrotasks)                 │
└─────────────────────────────────────────────────────┘
         ↑ dequeue one at a time
┌─────────────────────────────────────────────────────┐
│              Macrotask Queue                        │
│  setTimeout, setInterval, I/O, UI events            │
└─────────────────────────────────────────────────────┘
         ↑ Web APIs push callbacks here
┌─────────────────────────────────────────────────────┐
│                  Web APIs                           │
│  setTimeout, fetch, DOM events, etc.                │
└─────────────────────────────────────────────────────┘
```

### Event Loop Order
```javascript
console.log('1 - sync');

setTimeout(() => console.log('2 - macrotask'), 0);

Promise.resolve()
  .then(() => console.log('3 - microtask 1'))
  .then(() => console.log('4 - microtask 2'));

queueMicrotask(() => console.log('5 - microtask 3'));

console.log('6 - sync');

// Output:
// 1 - sync
// 6 - sync
// 3 - microtask 1
// 5 - microtask 3
// 4 - microtask 2
// 2 - macrotask

// Rule: ALL microtasks drain before ANY macrotask runs
```

### Microtask Starvation
```javascript
// Infinite microtasks block macrotasks (and UI)
function infiniteMicrotasks() {
  Promise.resolve().then(infiniteMicrotasks);
}
// infiniteMicrotasks(); // DON'T — blocks everything

// Safe: use setTimeout for yielding to browser
function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function processLargeArray(items) {
  for (let i = 0; i < items.length; i++) {
    process(items[i]);
    if (i % 1000 === 0) {
      await yieldToMain();  // let browser breathe
    }
  }
}
```

---

## Promises

```javascript
// Promise states: pending → fulfilled | rejected

// Creating promises
const p1 = new Promise((resolve, reject) => {
  setTimeout(() => resolve('data'), 1000);
});

const p2 = Promise.resolve(42);
const p3 = Promise.reject(new Error('failed'));

// Chaining
fetch('/api/user')
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(user => user.id)
  .then(id => fetch(`/api/posts?userId=${id}`))
  .then(res => res.json())
  .catch(err => {
    console.error('Failed:', err);
    return [];  // recover with default
  })
  .finally(() => hideSpinner());

// Promise combinators
const [user, posts, settings] = await Promise.all([
  fetchUser(id),
  fetchPosts(id),
  fetchSettings(id),
]);
// Fails fast if any rejects

const result = await Promise.allSettled([
  fetchUser(id),
  fetchPosts(id),
]);
// Never rejects — returns [{status:'fulfilled',value:...}, {status:'rejected',reason:...}]

const first = await Promise.race([
  fetch('/api/fast'),
  fetch('/api/slow'),
]);
// Resolves/rejects with first settled

const first = await Promise.any([
  Promise.reject('a'),
  Promise.resolve('b'),
  Promise.resolve('c'),
]);
// 'b' — first fulfilled (ignores rejections)
// Throws AggregateError if ALL reject
```

---

## Async/Await

```javascript
// async function always returns a Promise
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Error handling patterns
async function safeRequest(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return { data: await res.json(), error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// Parallel vs sequential
// Sequential (slow — waits for each)
async function sequential() {
  const user  = await fetchUser(1);   // wait
  const posts = await fetchPosts(1);  // then wait
  return { user, posts };
}

// Parallel (fast — concurrent)
async function parallel() {
  const [user, posts] = await Promise.all([
    fetchUser(1),
    fetchPosts(1),
  ]);
  return { user, posts };
}

// Async iteration
async function* paginate(url) {
  let page = 1;
  while (true) {
    const res = await fetch(`${url}?page=${page}`);
    const data = await res.json();
    if (!data.items.length) return;
    yield data.items;
    page++;
  }
}

for await (const items of paginate('/api/products')) {
  processItems(items);
}

// Timeout pattern
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

const data = await withTimeout(fetchData(), 5000);

// Retry pattern
async function retry(fn, { attempts = 3, delay = 1000, backoff = 2 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, delay * Math.pow(backoff, i)));
      }
    }
  }
  throw lastError;
}

const data = await retry(() => fetch('/api/data').then(r => r.json()), {
  attempts: 3,
  delay: 500,
});
```

---

## Memory Management & Garbage Collection

### Reference Counting + Mark-and-Sweep
```javascript
// V8 uses generational GC:
// Young generation (Scavenger): short-lived objects, frequent GC
// Old generation (Mark-Sweep-Compact): long-lived objects, less frequent

// Memory leaks — common causes:

// 1. Forgotten timers/intervals
function startPolling() {
  const data = new Array(10000).fill('data');
  setInterval(() => {
    // data is captured in closure — never GC'd
    console.log(data.length);
  }, 1000);
}
// Fix: store interval ID and clear it
const id = setInterval(fn, 1000);
clearInterval(id);

// 2. Detached DOM nodes
let detachedNode;
function createNode() {
  const div = document.createElement('div');
  detachedNode = div;  // reference kept after removal
  document.body.appendChild(div);
  document.body.removeChild(div);
  // div removed from DOM but detachedNode still references it
}
// Fix: set detachedNode = null when done

// 3. Closures capturing large objects
function processData() {
  const hugeData = new Array(1000000).fill('x');
  return function() {
    // hugeData captured even if not used
    return 'done';
  };
}
// Fix: don't capture what you don't need
function processData() {
  const hugeData = new Array(1000000).fill('x');
  const result = compute(hugeData);
  // hugeData can be GC'd after this
  return function() { return result; };
}

// 4. Event listeners not removed
class Component {
  constructor() {
    this.handler = this.handleClick.bind(this);
    document.addEventListener('click', this.handler);
  }
  handleClick() { /* ... */ }
  destroy() {
    document.removeEventListener('click', this.handler);
  }
}

// 5. WeakMap/WeakSet for weak references
const cache = new WeakMap();
function process(obj) {
  if (cache.has(obj)) return cache.get(obj);
  const result = expensiveCompute(obj);
  cache.set(obj, result);  // won't prevent GC of obj
  return result;
}
```

### Memory Profiling
```javascript
// Check memory usage in Node.js
const used = process.memoryUsage();
console.log({
  rss:       `${Math.round(used.rss / 1024 / 1024)}MB`,      // Resident Set Size
  heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`, // V8 heap allocated
  heapUsed:  `${Math.round(used.heapUsed / 1024 / 1024)}MB`,  // V8 heap used
  external:  `${Math.round(used.external / 1024 / 1024)}MB`,  // C++ objects
});
```

---

## Interview Questions

### Q1: What is the difference between microtasks and macrotasks?
**Answer:**
- **Microtasks**: Promise callbacks, `queueMicrotask()`, `MutationObserver`. Processed after current task, before next macrotask. ALL microtasks drain before any macrotask runs.
- **Macrotasks**: `setTimeout`, `setInterval`, I/O callbacks, UI rendering. One macrotask per event loop iteration.

```javascript
// Execution order:
// 1. Current synchronous code
// 2. All microtasks (drain completely)
// 3. One macrotask
// 4. All microtasks again
// 5. Next macrotask...
```

### Q2: What is the output of this code?
```javascript
async function foo() {
  console.log('A');
  await Promise.resolve();
  console.log('B');
}
console.log('C');
foo();
console.log('D');
// C, A, D, B
// C: sync
// A: sync inside foo
// D: sync after foo() call (foo suspends at await)
// B: microtask (after await resolves)
```

### Q3: How do you prevent memory leaks in JavaScript?
**Answer:**
1. Clear timers/intervals when done
2. Remove event listeners in cleanup
3. Avoid global variables
4. Use `WeakMap`/`WeakSet` for object-keyed caches
5. Null out references to large objects when done
6. Be careful with closures capturing large data
7. Use Chrome DevTools Memory tab to find leaks

### Q4: What is the difference between `Promise.all` and `Promise.allSettled`?
**Answer:**
- `Promise.all`: Fails fast — rejects immediately if any promise rejects. Use when all must succeed.
- `Promise.allSettled`: Never rejects — waits for all, returns array of `{status, value/reason}`. Use when you want all results regardless of failures.

### Q5: Explain async/await error handling best practices.
```javascript
// Pattern 1: try/catch
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    logger.error(err);
    throw err;  // re-throw or return default
  }
}

// Pattern 2: Result type (no exceptions)
async function safeRequest(url) {
  try {
    const data = await fetch(url).then(r => r.json());
    return [null, data];
  } catch (err) {
    return [err, null];
  }
}
const [err, data] = await safeRequest('/api/data');
if (err) handleError(err);
```
