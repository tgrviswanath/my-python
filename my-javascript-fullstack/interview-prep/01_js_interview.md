# JavaScript Interview Questions — Complete Guide

## Easy Level

### Q1: What are the different data types in JavaScript?
**Primitives** (immutable, stored by value):
- `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, `symbol`

**Objects** (mutable, stored by reference):
- `Object`, `Array`, `Function`, `Date`, `RegExp`, `Map`, `Set`, `WeakMap`, `WeakSet`

```javascript
typeof "hello"     // "string"
typeof 42          // "number"
typeof true        // "boolean"
typeof undefined   // "undefined"
typeof null        // "object" ← famous bug
typeof {}          // "object"
typeof []          // "object"
typeof function(){} // "function"
typeof Symbol()    // "symbol"
typeof 42n         // "bigint"
```

### Q2: What is the difference between `var`, `let`, and `const`?
| | `var` | `let` | `const` |
|---|---|---|---|
| Scope | Function | Block | Block |
| Hoisting | Yes (undefined) | Yes (TDZ) | Yes (TDZ) |
| Re-declare | Yes | No | No |
| Re-assign | Yes | Yes | No |
| Global property | Yes | No | No |

### Q3: What is `undefined` vs `null`?
- `undefined`: variable declared but not assigned, missing function argument, missing object property
- `null`: intentional absence of value (must be explicitly set)

```javascript
let x;           // undefined
let y = null;    // null (intentional)
typeof undefined // "undefined"
typeof null      // "object" (bug)
null == undefined  // true (loose)
null === undefined // false (strict)
```

### Q4: What is the difference between `==` and `===`?
`===` strict equality: same type AND value. `==` loose equality: type coercion applied.

```javascript
0 == false    // true  (false coerced to 0)
0 === false   // false (different types)
"" == false   // true
null == undefined // true
null === undefined // false
NaN == NaN    // false (NaN is never equal to itself)
```

---

## Medium Level

### Q5: Explain closures with a practical example.
A closure is a function that retains access to its outer scope even after the outer function returns.

```javascript
// Practical: private counter
function createCounter(initial = 0) {
  let count = initial;
  return {
    increment: () => ++count,
    decrement: () => --count,
    value:     () => count,
    reset:     () => { count = initial; },
  };
}

const c = createCounter(10);
c.increment(); // 11
c.increment(); // 12
c.value();     // 12

// Practical: memoization
function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  };
}
```

### Q6: What is the event loop? Explain with an example.
```javascript
console.log('1');

setTimeout(() => console.log('2'), 0);

Promise.resolve().then(() => console.log('3'));

console.log('4');

// Output: 1, 4, 3, 2
// 1, 4: synchronous
// 3: microtask (Promise) — runs before macrotasks
// 2: macrotask (setTimeout)
```

### Q7: What is prototypal inheritance?
```javascript
// Every object has [[Prototype]] link
// Property lookup walks the chain

const animal = { breathe() { return 'breathing'; } };
const dog    = Object.create(animal);
dog.bark = function() { return 'woof'; };

const rex = Object.create(dog);
rex.name = 'Rex';

rex.bark();    // found on dog
rex.breathe(); // found on animal
rex.toString();// found on Object.prototype

// Class syntax (syntactic sugar)
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
}

class Dog extends Animal {
  speak() { return `${this.name} barks`; }
}

const d = new Dog('Rex');
d.speak();              // Rex barks
d instanceof Dog;       // true
d instanceof Animal;    // true
```

### Q8: What is `this` in JavaScript?
```javascript
// 4 rules (precedence order):
// 1. new → newly created object
// 2. call/apply/bind → specified object
// 3. method call → object before dot
// 4. default → global (or undefined in strict mode)

// Arrow functions: lexical this (no own this)
class Timer {
  constructor() { this.count = 0; }
  start() {
    setInterval(() => {
      this.count++;  // 'this' is Timer instance (lexical)
    }, 1000);
  }
}

// Common gotcha
const obj = {
  name: 'Alice',
  greet() { return `Hello, ${this.name}`; },
};
const fn = obj.greet;
fn();        // undefined (lost binding)
fn.call(obj); // Hello, Alice
```

---

## Hard Level

### Q9: Implement `Promise.all` from scratch.
```javascript
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!promises.length) return resolve([]);
    const results = new Array(promises.length);
    let resolved = 0;

    promises.forEach((promise, i) => {
      Promise.resolve(promise).then(value => {
        results[i] = value;
        if (++resolved === promises.length) resolve(results);
      }).catch(reject);
    });
  });
}

// Test
promiseAll([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3),
]).then(console.log); // [1, 2, 3]
```

### Q10: Implement `debounce` and `throttle`.
```javascript
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, limit) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

// Leading + trailing debounce
function debounceAdvanced(fn, delay, { leading = false, trailing = true } = {}) {
  let timer, lastArgs;
  return function(...args) {
    lastArgs = args;
    if (leading && !timer) fn.apply(this, args);
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (trailing) fn.apply(this, lastArgs);
      timer = null;
    }, delay);
  };
}
```

### Q11: What is the output and why?
```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 3, 3, 3
// var is function-scoped, all callbacks share same 'i'
// By the time callbacks run, loop finished, i = 3

// Fix 1: let (block-scoped)
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 0, 1, 2

// Fix 2: IIFE
for (var i = 0; i < 3; i++) {
  (j => setTimeout(() => console.log(j), 0))(i);
}
```

### Q12: Implement a deep clone function.
```javascript
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);  // handle circular refs

  if (value instanceof Date)   return new Date(value);
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map)    {
    const clone = new Map();
    seen.set(value, clone);
    value.forEach((v, k) => clone.set(deepClone(k, seen), deepClone(v, seen)));
    return clone;
  }
  if (value instanceof Set) {
    const clone = new Set();
    seen.set(value, clone);
    value.forEach(v => clone.add(deepClone(v, seen)));
    return clone;
  }

  const clone = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, clone);
  for (const key of Reflect.ownKeys(value)) {
    clone[key] = deepClone(value[key], seen);
  }
  return clone;
}
```

### Q13: Implement `Function.prototype.bind` from scratch.
```javascript
Function.prototype.myBind = function(thisArg, ...presetArgs) {
  const fn = this;
  return function bound(...laterArgs) {
    // Handle new keyword
    if (new.target) {
      return new fn(...presetArgs, ...laterArgs);
    }
    return fn.apply(thisArg, [...presetArgs, ...laterArgs]);
  };
};

function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}
const boundGreet = greet.myBind({ name: 'Alice' }, 'Hello');
console.log(boundGreet('!')); // Hello, Alice!
```

### Q14: What is a WeakMap and when would you use it?
```javascript
// WeakMap: keys must be objects, keys are weakly referenced
// → doesn't prevent garbage collection of keys
// → not iterable, no size property

// Use case 1: private data
const _private = new WeakMap();
class Person {
  constructor(name, age) {
    _private.set(this, { name, age });
  }
  getName() { return _private.get(this).name; }
}

// Use case 2: caching without memory leaks
const cache = new WeakMap();
function processDOM(element) {
  if (cache.has(element)) return cache.get(element);
  const result = expensiveCompute(element);
  cache.set(element, result);  // GC'd when element removed from DOM
  return result;
}

// Use case 3: tracking without preventing GC
const listeners = new WeakMap();
function addListener(obj, fn) {
  listeners.set(obj, fn);
  obj.addEventListener('click', fn);
}
// When obj is GC'd, listener entry is automatically removed
```

### Q15: Explain async/await error handling patterns.
```javascript
// Pattern 1: try/catch
async function fetchUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Pattern 2: Result type (Go-style)
async function safeAsync(promise) {
  try {
    return [null, await promise];
  } catch (err) {
    return [err, null];
  }
}

const [err, user] = await safeAsync(fetchUser(1));
if (err) handleError(err);
else processUser(user);

// Pattern 3: Global handler
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Pattern 4: Async IIFE
(async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
```
