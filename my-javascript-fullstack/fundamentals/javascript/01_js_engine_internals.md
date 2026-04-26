# JavaScript — Engine Internals, Execution Context & Call Stack

## How JavaScript Engines Work

### V8 Architecture (Chrome/Node.js)
```
Source Code
    ↓
Parser → AST (Abstract Syntax Tree)
    ↓
Ignition (Interpreter) → Bytecode
    ↓ (hot code detected)
TurboFan (JIT Compiler) → Optimized Machine Code
    ↓ (deoptimization if assumptions wrong)
Back to Ignition
```

### Parsing
```javascript
// Source → Tokens → AST
const x = 1 + 2;

// AST representation:
// VariableDeclaration
//   VariableDeclarator
//     Identifier: x
//     BinaryExpression (+)
//       NumericLiteral: 1
//       NumericLiteral: 2
```

### Hidden Classes & Inline Caching
```javascript
// V8 creates hidden classes for objects
// Objects with same shape share hidden class → fast property access

// GOOD: consistent shape
function Point(x, y) {
  this.x = x;  // always add in same order
  this.y = y;
}
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);
// p1 and p2 share hidden class → inline cache hit

// BAD: different shapes
const a = { x: 1, y: 2 };
const b = { y: 2, x: 1 };  // different order → different hidden class

// BAD: adding properties after creation
const obj = {};
obj.x = 1;  // new hidden class
obj.y = 2;  // another new hidden class
```

---

## Execution Context

Every time code runs, an **Execution Context** is created:

```
Execution Context
├── Variable Environment (var declarations, function declarations)
├── Lexical Environment (let, const, function scope)
├── this binding
└── Outer Environment Reference (scope chain)
```

### Types of Execution Contexts
1. **Global Execution Context** — created when script starts
2. **Function Execution Context** — created for each function call
3. **Eval Execution Context** — created inside `eval()`

### Two Phases
```javascript
// Phase 1: Creation (Hoisting)
// Phase 2: Execution

console.log(x);    // undefined (hoisted, not initialized)
console.log(foo);  // [Function: foo] (fully hoisted)
console.log(bar);  // ReferenceError: Cannot access 'bar' before initialization

var x = 5;
function foo() { return 'foo'; }
let bar = 'bar';  // TDZ (Temporal Dead Zone) until declaration

// What happens during creation phase:
// var x → allocated, set to undefined
// function foo → fully hoisted (name + body)
// let bar → allocated but NOT initialized (TDZ)
```

---

## The Call Stack

```javascript
function multiply(a, b) {
  return a * b;
}

function square(n) {
  return multiply(n, n);  // ← multiply pushed onto stack
}

function printSquare(n) {
  const result = square(n);  // ← square pushed onto stack
  console.log(result);
}

printSquare(5);

// Call Stack (top to bottom):
// 1. printSquare(5) → pushed
// 2. square(5)      → pushed
// 3. multiply(5,5)  → pushed
// 4. multiply returns 25 → popped
// 5. square returns 25   → popped
// 6. console.log(25)     → pushed, popped
// 7. printSquare returns → popped
// 8. Stack empty
```

### Stack Overflow
```javascript
// Infinite recursion → stack overflow
function recurse() {
  return recurse();  // RangeError: Maximum call stack size exceeded
}

// Fix: base case
function recurse(n) {
  if (n <= 0) return 0;  // base case
  return recurse(n - 1);
}

// Fix for deep recursion: trampolining
function trampoline(fn) {
  return function(...args) {
    let result = fn(...args);
    while (typeof result === 'function') {
      result = result();
    }
    return result;
  };
}

const factorial = trampoline(function fact(n, acc = 1) {
  if (n <= 1) return acc;
  return () => fact(n - 1, n * acc);  // return thunk instead of recursing
});

factorial(100000);  // works without stack overflow
```

---

## Scope & Closures

### Scope Chain
```javascript
const global = 'global';

function outer() {
  const outerVar = 'outer';

  function inner() {
    const innerVar = 'inner';
    // Can access: innerVar, outerVar, global
    console.log(innerVar, outerVar, global);
  }

  inner();
  // Cannot access: innerVar
}

// Scope chain: inner → outer → global
// Each function has reference to its outer lexical environment
```

### Closures
```javascript
// A closure is a function that remembers its lexical scope
// even when executed outside that scope

function makeCounter(initial = 0) {
  let count = initial;  // closed over variable

  return {
    increment: () => ++count,
    decrement: () => --count,
    reset:     () => { count = initial; },
    value:     () => count,
  };
}

const counter = makeCounter(10);
counter.increment(); // 11
counter.increment(); // 12
counter.decrement(); // 11
counter.value();     // 11

// Each call to makeCounter creates a NEW closure
const c1 = makeCounter();
const c2 = makeCounter();
c1.increment(); // 1
c2.increment(); // 1 — independent
```

### Classic Closure Bug
```javascript
// BUG: all callbacks share same 'i' reference
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 3, 3, 3 (not 0, 1, 2)

// Fix 1: let (block scope)
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// Output: 0, 1, 2

// Fix 2: IIFE closure
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(() => console.log(j), 100);
  })(i);
}

// Fix 3: bind
for (var i = 0; i < 3; i++) {
  setTimeout(console.log.bind(null, i), 100);
}
```

---

## Prototypes & Inheritance

### Prototype Chain
```javascript
// Every object has [[Prototype]] (internal slot)
// Accessed via __proto__ or Object.getPrototypeOf()

const animal = {
  breathe() { return 'breathing'; }
};

const dog = Object.create(animal);
dog.bark = function() { return 'woof'; };

const rex = Object.create(dog);
rex.name = 'Rex';

// Prototype chain: rex → dog → animal → Object.prototype → null
rex.bark();    // found on dog
rex.breathe(); // found on animal
rex.toString();// found on Object.prototype

// Property lookup: own → [[Prototype]] → [[Prototype]]... → null
```

### Constructor Functions vs Classes
```javascript
// Constructor function (ES5)
function Animal(name, sound) {
  this.name = name;
  this.sound = sound;
}
Animal.prototype.speak = function() {
  return `${this.name} says ${this.sound}`;
};

// Class (ES6) — syntactic sugar over prototypes
class Animal {
  #sound;  // private field

  constructor(name, sound) {
    this.name = name;
    this.#sound = sound;
  }

  speak() {
    return `${this.name} says ${this.#sound}`;
  }

  static create(name, sound) {
    return new Animal(name, sound);
  }
}

class Dog extends Animal {
  #tricks = [];

  constructor(name) {
    super(name, 'woof');
  }

  learn(trick) {
    this.#tricks.push(trick);
    return this;  // chainable
  }

  perform() {
    return this.#tricks.map(t => `${this.name} performs ${t}`);
  }
}

const rex = new Dog('Rex');
rex.learn('sit').learn('shake').learn('roll over');
console.log(rex.speak());    // Rex says woof
console.log(rex.perform());  // [...]

// Check prototype chain
console.log(rex instanceof Dog);    // true
console.log(rex instanceof Animal); // true
console.log(Object.getPrototypeOf(rex) === Dog.prototype); // true
```

---

## `this` Binding

```javascript
// 4 rules (in order of precedence):
// 1. new binding
// 2. explicit binding (call/apply/bind)
// 3. implicit binding (method call)
// 4. default binding (global/undefined in strict)

// 1. new binding
function Person(name) { this.name = name; }
const p = new Person('Alice');  // this = new object

// 2. Explicit binding
function greet() { return `Hello, ${this.name}`; }
greet.call({ name: 'Bob' });    // Hello, Bob
greet.apply({ name: 'Carol' }); // Hello, Carol
const boundGreet = greet.bind({ name: 'Dave' });
boundGreet(); // Hello, Dave

// 3. Implicit binding
const obj = {
  name: 'Eve',
  greet() { return `Hello, ${this.name}`; }
};
obj.greet(); // Hello, Eve

// Implicit binding lost
const fn = obj.greet;
fn(); // Hello, undefined (default binding)

// 4. Arrow functions — lexical this (no own this)
class Timer {
  constructor() {
    this.seconds = 0;
  }
  start() {
    // Arrow function captures 'this' from start()
    setInterval(() => {
      this.seconds++;  // 'this' is Timer instance
    }, 1000);
  }
}
```

---

## Interview Questions

### Q1: What is hoisting?
**Answer:** Hoisting is JavaScript's behavior of moving declarations to the top of their scope during the creation phase. `var` declarations are hoisted and initialized to `undefined`. Function declarations are fully hoisted. `let`/`const` are hoisted but NOT initialized (Temporal Dead Zone — accessing them throws ReferenceError).

### Q2: What is a closure and give a real-world use case?
**Answer:** A closure is a function that retains access to its outer lexical scope even after the outer function has returned. Real-world uses: module pattern (private state), memoization, partial application, event handlers with captured state, React hooks (useState captures state in closure).

### Q3: What is the difference between `==` and `===`?
**Answer:** `===` (strict equality) compares value AND type — no coercion. `==` (loose equality) performs type coercion before comparison. Always use `===` except when intentionally checking for null/undefined: `value == null` catches both.

### Q4: Explain the prototype chain.
**Answer:** Every JavaScript object has an internal `[[Prototype]]` link to another object. When accessing a property, JS first checks the object itself, then walks up the prototype chain until found or `null` is reached. `Object.prototype` is at the top of all chains. Classes use this mechanism — methods defined on a class are on `ClassName.prototype`.

### Q5: What is the Temporal Dead Zone?
**Answer:** The TDZ is the period between entering a scope and the `let`/`const` declaration being initialized. During TDZ, accessing the variable throws `ReferenceError`. This prevents using variables before they're declared, unlike `var` which returns `undefined`.

### Q6: How does `new` work internally?
```javascript
// new Foo() does:
// 1. Creates empty object: obj = {}
// 2. Sets prototype: Object.setPrototypeOf(obj, Foo.prototype)
// 3. Calls constructor with this = obj: Foo.call(obj, ...args)
// 4. Returns obj (unless constructor returns non-primitive)

function myNew(Constructor, ...args) {
  const obj = Object.create(Constructor.prototype);
  const result = Constructor.apply(obj, args);
  return result instanceof Object ? result : obj;
}
```
