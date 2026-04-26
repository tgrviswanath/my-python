# Modern JavaScript — ES6+ Features Deep Dive

## Destructuring

```javascript
// Array destructuring
const [a, b, ...rest] = [1, 2, 3, 4, 5];
// a=1, b=2, rest=[3,4,5]

// Skip elements
const [,, third] = [1, 2, 3];

// Default values
const [x = 10, y = 20] = [5];
// x=5, y=20

// Object destructuring
const { name, age, address: { city } = {} } = user;

// Rename
const { name: userName, role: userRole = 'user' } = user;

// Function parameter destructuring
function render({ title, body, footer = 'Default footer' }) {
  return `<div><h1>${title}</h1><p>${body}</p><footer>${footer}</footer></div>`;
}

// Swap variables
let a = 1, b = 2;
[a, b] = [b, a];
```

## Spread & Rest

```javascript
// Spread: expand iterable
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5];       // [1,2,3,4,5]
const copy = [...arr1];              // shallow copy

// Object spread
const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3 };     // {a:1,b:2,c:3}
const override = { ...obj1, b: 99 }; // {a:1,b:99}

// Rest parameters
function sum(...nums) {
  return nums.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3, 4); // 10

// Spread in function calls
Math.max(...[1, 5, 3, 9, 2]); // 9
```

## Template Literals

```javascript
const name = 'Alice';
const age = 30;

// Basic interpolation
`Hello, ${name}! You are ${age} years old.`

// Expressions
`${age >= 18 ? 'Adult' : 'Minor'}`
`${2 ** 10}` // 1024

// Multi-line
const html = `
  <div class="card">
    <h2>${name}</h2>
    <p>Age: ${age}</p>
  </div>
`;

// Tagged templates
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) =>
    result + str + (values[i] !== undefined
      ? `<mark>${values[i]}</mark>`
      : ''),
    ''
  );
}
highlight`Hello ${name}, you are ${age} years old`;
// "Hello <mark>Alice</mark>, you are <mark>30</mark> years old"
```

## Optional Chaining & Nullish Coalescing

```javascript
// Optional chaining ?.
const city = user?.address?.city;           // undefined if any null/undefined
const len  = user?.friends?.length;
const fn   = obj?.method?.();               // call if exists
const item = arr?.[0];                      // array access

// Nullish coalescing ??
// Returns right side only if left is null or undefined (not 0, '', false)
const name = user.name ?? 'Anonymous';
const port = config.port ?? 3000;
const count = data.count ?? 0;

// vs || (returns right if left is falsy — 0, '', false also trigger)
const port1 = config.port || 3000;  // BUG: 0 would use 3000
const port2 = config.port ?? 3000;  // CORRECT: 0 stays 0

// Nullish assignment ??=
user.name ??= 'Anonymous';  // only assigns if null/undefined

// Logical assignment
user.role ||= 'user';   // assign if falsy
user.count &&= user.count + 1;  // assign if truthy
```

## Symbols & Iterators

```javascript
// Symbol: unique, immutable primitive
const id = Symbol('id');
const id2 = Symbol('id');
id === id2; // false — always unique

// Well-known symbols
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        return current <= end
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      }
    };
  }
}

for (const n of new Range(1, 5)) console.log(n); // 1 2 3 4 5
[...new Range(1, 5)]; // [1, 2, 3, 4, 5]

// Symbol.toPrimitive
class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.amount;
    if (hint === 'string') return `${this.amount} ${this.currency}`;
    return this.amount;
  }
}
const price = new Money(9.99, 'USD');
+price;       // 9.99
`${price}`;   // "9.99 USD"
price + 1;    // 10.99
```

## Generators

```javascript
function* range(start, end, step = 1) {
  for (let i = start; i <= end; i += step) yield i;
}

[...range(1, 10, 2)]; // [1, 3, 5, 7, 9]

// Infinite generator
function* naturals() {
  let n = 1;
  while (true) yield n++;
}

function take(n, gen) {
  const result = [];
  for (const val of gen) {
    result.push(val);
    if (result.length >= n) break;
  }
  return result;
}

take(5, naturals()); // [1, 2, 3, 4, 5]

// Generator with send (two-way communication)
function* calculator() {
  let result = 0;
  while (true) {
    const input = yield result;
    if (input === null) return result;
    result += input;
  }
}

const calc = calculator();
calc.next();    // {value: 0, done: false} — start
calc.next(5);   // {value: 5, done: false}
calc.next(3);   // {value: 8, done: false}
calc.next(null);// {value: 8, done: true}

// Async generators
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
```

## Proxy & Reflect

```javascript
// Proxy: intercept object operations
const handler = {
  get(target, prop, receiver) {
    console.log(`Getting ${prop}`);
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    if (typeof value !== typeof target[prop] && target[prop] !== undefined) {
      throw new TypeError(`${prop} must be ${typeof target[prop]}`);
    }
    console.log(`Setting ${prop} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },
  has(target, prop) {
    return prop in target;
  },
  deleteProperty(target, prop) {
    if (prop.startsWith('_')) throw new Error(`Cannot delete private property ${prop}`);
    return Reflect.deleteProperty(target, prop);
  },
};

const user = new Proxy({ name: 'Alice', age: 30, _id: 1 }, handler);
user.name;        // logs "Getting name"
user.age = 31;    // logs "Setting age = 31"
user.age = 'old'; // TypeError: age must be number

// Reactive data (Vue 3 uses this)
function reactive(obj) {
  return new Proxy(obj, {
    set(target, prop, value) {
      const old = target[prop];
      target[prop] = value;
      if (old !== value) notify(prop, value);
      return true;
    }
  });
}
```

## Interview Questions

### Q1: What is the difference between `null` coalescing `??` and `||`?
`||` returns right side if left is **falsy** (0, '', false, null, undefined). `??` returns right side only if left is **null or undefined**. Use `??` when 0 or empty string are valid values.

### Q2: What does optional chaining `?.` return if the chain breaks?
Returns `undefined` (not null, not an error). Safe to use in conditions: `if (user?.isAdmin)`.

### Q3: What is a Symbol and why is it useful?
Symbols are unique, immutable primitives. Use cases: unique object keys (no collision), well-known symbols (`Symbol.iterator`, `Symbol.toPrimitive`), private-like properties (not enumerable by default).

### Q4: What is the difference between a generator and an async generator?
- Generator: synchronous, yields values with `yield`
- Async generator: asynchronous, yields promises with `yield`, consumed with `for await...of`

### Q5: How does Proxy differ from `Object.defineProperty`?
`Object.defineProperty` intercepts a single property. `Proxy` intercepts all operations on an object (get, set, delete, has, apply, construct, etc.) and can be applied to arrays and functions too.
