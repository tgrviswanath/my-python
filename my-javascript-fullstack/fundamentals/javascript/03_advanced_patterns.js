/**
 * JavaScript Advanced Patterns
 * Closures, Prototypes, Async, Design Patterns
 */

'use strict';

// ── 1. Closure Patterns ──────────────────────────────────────────────────────

// Module pattern (IIFE)
const Counter = (() => {
  let _count = 0;
  const _history = [];

  return {
    increment(n = 1) {
      _count += n;
      _history.push({ op: 'increment', n, result: _count });
      return this;
    },
    decrement(n = 1) {
      _count -= n;
      _history.push({ op: 'decrement', n, result: _count });
      return this;
    },
    reset() {
      _count = 0;
      _history.push({ op: 'reset', result: 0 });
      return this;
    },
    get value() { return _count; },
    get history() { return [..._history]; },
  };
})();

Counter.increment(5).increment(3).decrement(2);
console.log(Counter.value);   // 6
console.log(Counter.history); // [{op:'increment',n:5,...}, ...]

// Memoization
function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      console.log(`Cache hit for ${key}`);
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveFib = memoize(function fib(n) {
  if (n <= 1) return n;
  return expensiveFib(n - 1) + expensiveFib(n - 2);
});

console.log(expensiveFib(40)); // fast after first call

// Partial application
function partial(fn, ...presetArgs) {
  return function(...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}

const multiply = (a, b) => a * b;
const double = partial(multiply, 2);
const triple = partial(multiply, 3);
console.log(double(5)); // 10
console.log(triple(5)); // 15

// Currying
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function(...moreArgs) {
      return curried.apply(this, args.concat(moreArgs));
    };
  };
}

const add = curry((a, b, c) => a + b + c);
console.log(add(1)(2)(3));   // 6
console.log(add(1, 2)(3));   // 6
console.log(add(1)(2, 3));   // 6
console.log(add(1, 2, 3));   // 6

// ── 2. Prototype Patterns ────────────────────────────────────────────────────

// Mixins
const Serializable = {
  serialize() {
    return JSON.stringify(this);
  },
  static_deserialize(json) {
    return Object.assign(Object.create(this), JSON.parse(json));
  },
};

const Validatable = {
  validate() {
    const errors = [];
    for (const [field, rules] of Object.entries(this.constructor.validations || {})) {
      const value = this[field];
      if (rules.required && !value) errors.push(`${field} is required`);
      if (rules.minLength && value?.length < rules.minLength)
        errors.push(`${field} must be at least ${rules.minLength} chars`);
      if (rules.pattern && !rules.pattern.test(value))
        errors.push(`${field} has invalid format`);
    }
    return { valid: errors.length === 0, errors };
  },
};

class User {
  static validations = {
    name:  { required: true, minLength: 2 },
    email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  };

  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
}
Object.assign(User.prototype, Serializable, Validatable);

const user = new User('Alice', 'alice@example.com');
console.log(user.validate()); // { valid: true, errors: [] }
console.log(user.serialize()); // '{"name":"Alice","email":"alice@example.com"}'

// ── 3. Async Patterns ────────────────────────────────────────────────────────

// Promise queue (concurrency limiter)
class PromiseQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.run();
    });
  }

  run() {
    while (this.running < this.concurrency && this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;
      Promise.resolve(fn())
        .then(resolve, reject)
        .finally(() => {
          this.running--;
          this.run();
        });
    }
  }
}

// Usage: limit to 3 concurrent requests
const queue = new PromiseQueue(3);
const urls = Array.from({ length: 10 }, (_, i) => `/api/item/${i}`);

async function fetchAll(urls) {
  return Promise.all(
    urls.map(url => queue.add(() => fetch(url).then(r => r.json())))
  );
}

// Observable pattern (simplified)
class Observable {
  constructor(subscriber) {
    this._subscriber = subscriber;
  }

  subscribe(observer) {
    const safeObserver = {
      next:     observer.next     || (() => {}),
      error:    observer.error    || (err => { throw err; }),
      complete: observer.complete || (() => {}),
    };
    return this._subscriber(safeObserver);
  }

  pipe(...operators) {
    return operators.reduce((obs, op) => op(obs), this);
  }

  static fromEvent(element, event) {
    return new Observable(observer => {
      const handler = e => observer.next(e);
      element.addEventListener(event, handler);
      return () => element.removeEventListener(event, handler);
    });
  }

  static interval(ms) {
    return new Observable(observer => {
      let i = 0;
      const id = setInterval(() => observer.next(i++), ms);
      return () => clearInterval(id);
    });
  }
}

// Operators
const map = fn => obs => new Observable(observer =>
  obs.subscribe({ ...observer, next: v => observer.next(fn(v)) })
);

const filter = pred => obs => new Observable(observer =>
  obs.subscribe({ ...observer, next: v => pred(v) && observer.next(v) })
);

const take = n => obs => new Observable(observer => {
  let count = 0;
  const unsub = obs.subscribe({
    ...observer,
    next(v) {
      if (count++ < n) observer.next(v);
      else { observer.complete(); unsub?.(); }
    },
  });
  return unsub;
});

// ── 4. Design Patterns ───────────────────────────────────────────────────────

// Singleton
class Database {
  static #instance = null;

  #connection = null;

  constructor(url) {
    if (Database.#instance) return Database.#instance;
    this.url = url;
    this.#connection = this.#connect();
    Database.#instance = this;
  }

  #connect() {
    console.log(`Connecting to ${this.url}`);
    return { url: this.url, connected: true };
  }

  static getInstance(url) {
    if (!Database.#instance) new Database(url);
    return Database.#instance;
  }

  query(sql) {
    return `Result of: ${sql}`;
  }
}

const db1 = Database.getInstance('postgresql://localhost/mydb');
const db2 = Database.getInstance('postgresql://localhost/other');
console.log(db1 === db2); // true

// Observer / EventEmitter
class EventEmitter {
  #events = new Map();

  on(event, listener) {
    if (!this.#events.has(event)) this.#events.set(event, new Set());
    this.#events.get(event).add(listener);
    return () => this.off(event, listener); // returns unsubscribe fn
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event, listener) {
    this.#events.get(event)?.delete(listener);
  }

  emit(event, ...args) {
    this.#events.get(event)?.forEach(listener => {
      try { listener(...args); }
      catch (err) { console.error(`Error in ${event} listener:`, err); }
    });
  }

  removeAllListeners(event) {
    if (event) this.#events.delete(event);
    else this.#events.clear();
  }
}

const emitter = new EventEmitter();
const unsub = emitter.on('data', data => console.log('Received:', data));
emitter.once('connect', () => console.log('Connected!'));

emitter.emit('connect');  // Connected!
emitter.emit('data', { id: 1 }); // Received: {id:1}
unsub(); // unsubscribe
emitter.emit('data', { id: 2 }); // nothing

// Strategy pattern
class Sorter {
  constructor(strategy) {
    this.strategy = strategy;
  }

  sort(data) {
    return this.strategy.sort([...data]);
  }
}

const bubbleSort = {
  sort(arr) {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < n - i - 1; j++)
        if (arr[j] > arr[j+1]) [arr[j], arr[j+1]] = [arr[j+1], arr[j]];
    return arr;
  }
};

const quickSort = {
  sort(arr) {
    if (arr.length <= 1) return arr;
    const pivot = arr[Math.floor(arr.length / 2)];
    const left  = arr.filter(x => x < pivot);
    const mid   = arr.filter(x => x === pivot);
    const right = arr.filter(x => x > pivot);
    return [...this.sort(left), ...mid, ...this.sort(right)];
  }
};

const sorter = new Sorter(quickSort);
console.log(sorter.sort([3, 1, 4, 1, 5, 9, 2, 6]));

// ── 5. Functional Utilities ──────────────────────────────────────────────────

// Compose and pipe
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);
const pipe    = (...fns) => x => fns.reduce((v, f) => f(v), x);

const transform = pipe(
  x => x * 2,
  x => x + 1,
  x => x.toString(),
  x => `Result: ${x}`,
);
console.log(transform(5)); // Result: 11

// Immutable update helpers
const update = (obj, path, value) => {
  const keys = path.split('.');
  const result = { ...obj };
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = { ...current[keys[i]] };
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return result;
};

const state = { user: { name: 'Alice', address: { city: 'NYC' } } };
const newState = update(state, 'user.address.city', 'LA');
console.log(state.user.address.city);    // NYC (unchanged)
console.log(newState.user.address.city); // LA

// Deep clone
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  if (obj instanceof Map) return new Map([...obj].map(([k,v]) => [deepClone(k), deepClone(v)]));
  if (obj instanceof Set) return new Set([...obj].map(deepClone));
  if (Array.isArray(obj)) return obj.map(deepClone);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, deepClone(v)])
  );
}

// Debounce
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Throttle
function throttle(fn, limit) {
  let inThrottle = false;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// Usage
const handleSearch = debounce(query => console.log('Searching:', query), 300);
const handleScroll = throttle(() => console.log('Scroll event'), 100);

module.exports = {
  Counter, memoize, partial, curry,
  PromiseQueue, Observable, EventEmitter,
  compose, pipe, update, deepClone,
  debounce, throttle,
};
