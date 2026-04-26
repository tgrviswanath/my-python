# React — Deep Dive: Hooks, Virtual DOM, Performance & Patterns

## Virtual DOM & Reconciliation

### How React Renders
```
JSX → React.createElement() → Virtual DOM (plain objects)
                                      ↓
                              Reconciliation (Diffing)
                                      ↓
                              Commit Phase (DOM updates)
```

### Reconciliation Algorithm
```javascript
// React's diffing rules:
// 1. Different element types → destroy old tree, build new
// 2. Same element type → update attributes, recurse children
// 3. Keys help identify which items changed in lists

// Without keys — React re-renders all items on change
<ul>
  {items.map(item => <li>{item.name}</li>)}  // BAD
</ul>

// With keys — React identifies changed items
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}  // GOOD
</ul>

// Key rules:
// - Must be unique among siblings
// - Must be stable (don't use array index for reorderable lists)
// - Don't use Math.random() as key
```

### Fiber Architecture
```
React Fiber = unit of work
- Each component = one fiber node
- Fiber tree mirrors component tree
- Work can be paused, resumed, aborted (concurrent mode)
- Priority levels: immediate, user-blocking, normal, low, idle
```

---

## Hooks Deep Dive

### useState
```javascript
import { useState, useCallback } from 'react';

// Functional update (safe for async/batched updates)
const [count, setCount] = useState(0);
setCount(prev => prev + 1);  // always uses latest state

// Lazy initialization (expensive computation runs once)
const [data, setData] = useState(() => {
  return JSON.parse(localStorage.getItem('data')) || [];
});

// Object state — always spread to avoid mutation
const [form, setForm] = useState({ name: '', email: '', age: 0 });
const updateField = useCallback((field, value) => {
  setForm(prev => ({ ...prev, [field]: value }));
}, []);
```

### useEffect
```javascript
import { useEffect, useRef } from 'react';

// Effect lifecycle:
// - Runs after every render (no deps)
// - Runs once on mount (empty deps [])
// - Runs when deps change
// - Cleanup runs before next effect and on unmount

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    let cancelled = false;

    async function fetchUser() {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          signal: abortRef.current.signal,
        });
        const data = await res.json();
        if (!cancelled) setUser(data);
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [userId]);

  return user ? <div>{user.name}</div> : <div>Loading...</div>;
}

// Event listener cleanup
useEffect(() => {
  const handler = (e) => console.log(e.key);
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);

// Subscription cleanup
useEffect(() => {
  const subscription = store.subscribe(setState);
  return () => subscription.unsubscribe();
}, []);
```

### useCallback & useMemo
```javascript
import { useCallback, useMemo } from 'react';

// useCallback: memoize function reference
// Use when: passing callbacks to optimized child components
const handleSubmit = useCallback(async (data) => {
  await api.post('/users', data);
  onSuccess();
}, [onSuccess]);  // only recreate if onSuccess changes

// useMemo: memoize computed value
// Use when: expensive computation, referential equality for objects/arrays
const sortedItems = useMemo(() =>
  [...items].sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

const chartData = useMemo(() =>
  transformDataForChart(rawData),
  [rawData]
);

// When NOT to use useMemo/useCallback:
// - Simple computations (overhead > benefit)
// - Values that change every render anyway
// - Primitive values (already compared by value)
```

### useRef
```javascript
import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

// 1. DOM reference
function TextInput() {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  return <input ref={inputRef} />;
}

// 2. Mutable value (doesn't trigger re-render)
function Timer() {
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);

  const start = () => {
    intervalRef.current = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
  };

  const stop = () => clearInterval(intervalRef.current);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div>
      <span>{count}</span>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}

// 3. Previous value
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });
  return ref.current;
}

// 4. forwardRef + useImperativeHandle
const FancyInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    clear: () => { inputRef.current.value = ''; },
    getValue: () => inputRef.current.value,
  }));

  return <input ref={inputRef} {...props} />;
});
```

### Custom Hooks
```javascript
// useFetch — data fetching with loading/error states
function useFetch(url, options = {}) {
  const [state, dispatch] = useReducer(
    (state, action) => {
      switch (action.type) {
        case 'LOADING': return { ...state, loading: true, error: null };
        case 'SUCCESS': return { loading: false, error: null, data: action.data };
        case 'ERROR':   return { loading: false, error: action.error, data: null };
        default: return state;
      }
    },
    { loading: false, error: null, data: null }
  );

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    dispatch({ type: 'LOADING' });

    fetch(url, { ...options, signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => dispatch({ type: 'SUCCESS', data }))
      .catch(err => {
        if (err.name !== 'AbortError')
          dispatch({ type: 'ERROR', error: err.message });
      });

    return () => controller.abort();
  }, [url]);

  return state;
}

// useLocalStorage
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = useCallback((newValue) => {
    try {
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
      setValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (err) {
      console.error(err);
    }
  }, [key, value]);

  return [value, setStoredValue];
}

// useDebounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// useIntersectionObserver (lazy loading)
function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      options
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, isIntersecting];
}
```

---

## State Management

### Context API
```javascript
import { createContext, useContext, useReducer, useMemo } from 'react';

// 1. Create context
const AuthContext = createContext(null);

// 2. Reducer
function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.user, isAuthenticated: true };
    case 'LOGOUT':
      return { user: null, isAuthenticated: false };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.updates } };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

// 3. Provider
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
  });

  // Memoize actions to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    login:      (user) => dispatch({ type: 'LOGIN', user }),
    logout:     ()     => dispatch({ type: 'LOGOUT' }),
    updateUser: (updates) => dispatch({ type: 'UPDATE_USER', updates }),
  }), []);

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 4. Custom hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

---

## Performance Optimization

```javascript
import { memo, lazy, Suspense } from 'react';

// React.memo — skip re-render if props unchanged
const ExpensiveList = memo(function ExpensiveList({ items, onSelect }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onSelect(item)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}, (prevProps, nextProps) => {
  // Custom comparison (return true to skip re-render)
  return prevProps.items === nextProps.items &&
         prevProps.onSelect === nextProps.onSelect;
});

// Code splitting with lazy + Suspense
const Dashboard = lazy(() => import('./Dashboard'));
const Settings  = lazy(() => import('./Settings'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings"  element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Virtualization for large lists (react-window)
import { FixedSizeList } from 'react-window';

function VirtualList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

---

## Interview Questions

### Q1: What is the difference between `useEffect` and `useLayoutEffect`?
**Answer:**
- `useEffect`: runs asynchronously after paint — doesn't block browser rendering. Use for data fetching, subscriptions, logging.
- `useLayoutEffect`: runs synchronously after DOM mutations but before paint — blocks rendering. Use for DOM measurements, preventing visual flicker.

### Q2: Why shouldn't you use array index as key?
**Answer:** When items are reordered, added, or removed, index-based keys cause React to reuse the wrong component instances, leading to incorrect state, animation glitches, and performance issues. Use stable, unique IDs.

### Q3: What causes unnecessary re-renders and how do you prevent them?
**Answer:**
- New object/array references in props → `useMemo`
- New function references → `useCallback`
- Context value changes → split contexts, memoize value
- Parent re-renders → `React.memo`
- State updates that don't change value → check before `setState`

### Q4: Explain the React rendering phases.
**Answer:**
1. **Render phase**: React calls component functions, builds new virtual DOM tree, diffs with previous (pure, no side effects)
2. **Commit phase**: React applies changes to real DOM, runs `useLayoutEffect`, then `useEffect`

### Q5: What is the difference between controlled and uncontrolled components?
**Answer:**
- **Controlled**: React state is the single source of truth. `value` prop + `onChange` handler. Enables validation, conditional disabling, formatting.
- **Uncontrolled**: DOM manages its own state. Access via `ref`. Simpler for file inputs, integrating with non-React code.
