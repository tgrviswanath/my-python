# React & Angular Interview Questions

## React — Easy

### Q1: What is JSX?
JSX is a syntax extension that looks like HTML but compiles to `React.createElement()` calls. It's not required but makes component code more readable.

```jsx
// JSX
const element = <h1 className="title">Hello, {name}!</h1>;

// Compiles to:
const element = React.createElement('h1', { className: 'title' }, `Hello, ${name}!`);
```

### Q2: What is the difference between state and props?
- **Props**: Read-only data passed from parent to child. Immutable in child.
- **State**: Mutable data managed within a component. Triggers re-render when changed.

### Q3: What are React hooks rules?
1. Only call hooks at the top level (not inside loops, conditions, nested functions)
2. Only call hooks from React function components or custom hooks
3. Custom hooks must start with `use`

---

## React — Medium

### Q4: Explain the useEffect dependency array.
```javascript
useEffect(() => { /* runs after every render */ });
useEffect(() => { /* runs once on mount */ }, []);
useEffect(() => { /* runs when dep changes */ }, [dep]);

// Common mistake: missing dependency
function Component({ userId }) {
  const [user, setUser] = useState(null);

  // BUG: userId not in deps — stale closure
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // should be [userId]

  // FIX:
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
}
```

### Q5: What is the difference between `useMemo` and `useCallback`?
```javascript
// useMemo: memoizes a VALUE
const sortedList = useMemo(() =>
  [...items].sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// useCallback: memoizes a FUNCTION
const handleClick = useCallback((id) => {
  dispatch({ type: 'SELECT', id });
}, [dispatch]);

// useCallback(fn, deps) === useMemo(() => fn, deps)
```

### Q6: How does React's reconciliation work?
React diffs the new virtual DOM against the previous one:
1. Different element types → destroy and rebuild subtree
2. Same element type → update attributes, recurse children
3. Lists → use keys to identify which items changed

Keys must be stable and unique among siblings. Using array index as key causes issues when items are reordered.

### Q7: What is Context API and when should you use it?
Context provides a way to pass data through the component tree without prop drilling. Use for: theme, locale, auth state, user preferences. Don't use for: frequently changing data (causes all consumers to re-render), data that could be passed as props.

```javascript
// Split contexts to avoid unnecessary re-renders
const UserContext    = createContext(null);  // rarely changes
const ThemeContext   = createContext(null);  // rarely changes
const CartContext    = createContext(null);  // changes often
```

---

## React — Hard

### Q8: How do you optimize a React app that re-renders too often?
```javascript
// 1. React.memo for components
const ExpensiveChild = memo(({ data, onAction }) => {
  return <div>{/* expensive render */}</div>;
});

// 2. useCallback for stable function references
const handleAction = useCallback((id) => {
  dispatch({ type: 'ACTION', id });
}, [dispatch]);

// 3. useMemo for expensive computations
const processed = useMemo(() => heavyTransform(data), [data]);

// 4. Split state to minimize re-renders
// BAD: one big state object
const [state, setState] = useState({ user, theme, cart, modal });

// GOOD: separate states
const [user, setUser]   = useState(null);
const [theme, setTheme] = useState('light');

// 5. Use useReducer for complex state
// 6. Virtualize long lists (react-window)
// 7. Code split with lazy + Suspense
// 8. Profile with React DevTools Profiler
```

### Q9: Implement a custom hook for infinite scroll.
```javascript
function useInfiniteScroll({ fetchMore, hasMore, threshold = 0.1 }) {
  const [loading, setLoading] = useState(false);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          setLoading(true);
          try { await fetchMore(); }
          finally { setLoading(false); }
        }
      },
      { threshold }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [fetchMore, hasMore, loading, threshold]);

  return { sentinelRef, loading };
}

// Usage
function ProductList() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchMore = useCallback(async () => {
    const data = await api.getProducts({ page });
    setProducts(prev => [...prev, ...data.items]);
    setHasMore(data.hasMore);
    setPage(p => p + 1);
  }, [page]);

  const { sentinelRef, loading } = useInfiniteScroll({ fetchMore, hasMore });

  return (
    <div>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
      <div ref={sentinelRef} />
      {loading && <Spinner />}
    </div>
  );
}
```

---

## Angular — Easy

### Q10: What is Angular's dependency injection?
Angular's DI system creates and manages service instances. Services are registered in providers and injected via constructor parameters. The injector creates a singleton per scope (root, module, or component).

### Q11: What is the difference between `ngOnInit` and constructor?
- **Constructor**: Called by JavaScript when class is instantiated. Use for DI only.
- **ngOnInit**: Called by Angular after inputs are set. Use for initialization logic, data fetching.

---

## Angular — Medium

### Q12: What is the difference between `Observable` and `Promise`?
| | Observable | Promise |
|---|---|---|
| Values | Multiple | Single |
| Lazy | Yes | No (eager) |
| Cancellable | Yes (unsubscribe) | No |
| Operators | Rich (RxJS) | Limited |
| Sync/Async | Both | Async only |

### Q13: What is change detection and how does OnPush work?
Angular's default change detection checks every component on every event. `OnPush` only checks when:
1. Input reference changes
2. Event originates from component
3. Async pipe emits
4. `markForCheck()` called

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptimizedComponent {
  @Input() data: Data[];  // must change reference, not mutate
  items$ = this.service.items$;  // async pipe triggers CD
}
```

### Q14: What is the difference between `switchMap`, `mergeMap`, `concatMap`?
```typescript
// switchMap: cancels previous (search, navigation)
searchTerm$.pipe(
  debounceTime(300),
  switchMap(term => this.api.search(term))
);

// mergeMap: all concurrent (parallel requests)
ids$.pipe(
  mergeMap(id => this.api.getItem(id))
);

// concatMap: sequential (ordered operations)
actions$.pipe(
  concatMap(action => this.api.process(action))
);

// exhaustMap: ignore new while running (form submit)
submitClick$.pipe(
  exhaustMap(() => this.api.submit(formData))
);
```

---

## Angular — Hard

### Q15: How do you prevent memory leaks in Angular?
```typescript
// Pattern 1: async pipe (auto-unsubscribes)
// Template: {{ data$ | async }}

// Pattern 2: takeUntil
export class MyComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.service.data$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => this.data = data);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Pattern 3: take(1) for one-time
this.service.getUser().pipe(take(1)).subscribe(user => this.user = user);

// Pattern 4: DestroyRef (Angular 16+)
export class MyComponent {
  constructor(destroyRef: DestroyRef) {
    this.service.data$.pipe(
      takeUntilDestroyed(destroyRef)
    ).subscribe(data => this.data = data);
  }
}
```
