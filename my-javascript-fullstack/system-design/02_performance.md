# Performance Optimization — Frontend & Backend

## Frontend Performance

### Core Web Vitals
- **LCP** (Largest Contentful Paint): < 2.5s — loading performance
- **FID** (First Input Delay): < 100ms — interactivity
- **CLS** (Cumulative Layout Shift): < 0.1 — visual stability
- **INP** (Interaction to Next Paint): < 200ms — responsiveness

### Code Splitting
```javascript
// Route-based splitting (React)
const Home     = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const Admin    = lazy(() => import('./pages/Admin'));

// Component-based splitting
const HeavyChart = lazy(() => import('./components/Chart'));

// Prefetch on hover
const prefetchDashboard = () => import('./pages/Dashboard');
<Link onMouseEnter={prefetchDashboard} to="/dashboard">Dashboard</Link>
```

### Image Optimization
```html
<!-- Modern formats with fallback -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="..." loading="lazy" decoding="async"
       width="800" height="600">
</picture>

<!-- Responsive images -->
<img
  srcset="small.jpg 480w, medium.jpg 800w, large.jpg 1200w"
  sizes="(max-width: 480px) 480px, (max-width: 800px) 800px, 1200px"
  src="medium.jpg" alt="...">
```

### Bundle Optimization
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom'],
          router:  ['react-router-dom'],
          charts:  ['recharts'],
          utils:   ['lodash', 'date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
};
```

### React Performance
```javascript
// 1. Avoid unnecessary re-renders
const MemoizedList = memo(({ items }) => (
  <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
));

// 2. Stable references
const handleClick = useCallback((id) => dispatch({ type: 'SELECT', id }), [dispatch]);
const processed   = useMemo(() => expensiveTransform(data), [data]);

// 3. Virtualize long lists
import { FixedSizeList } from 'react-window';
<FixedSizeList height={600} itemCount={10000} itemSize={50}>
  {({ index, style }) => <div style={style}>{items[index].name}</div>}
</FixedSizeList>

// 4. Defer non-critical updates
import { startTransition } from 'react';
startTransition(() => setSearchResults(results));

// 5. Concurrent features
const deferredQuery = useDeferredValue(query);
```

---

## Backend Performance

### Database Query Optimization
```javascript
// 1. Use indexes
// PostgreSQL
CREATE INDEX CONCURRENTLY idx_orders_user_status ON orders(user_id, status);

// MongoDB
db.products.createIndex({ category: 1, price: 1 });
db.products.createIndex({ name: 'text', description: 'text' });

// 2. Select only needed fields
// Bad
const users = await User.find({});
// Good
const users = await User.find({}, 'name email role').lean();

// 3. Avoid N+1 — use populate/join
// Bad: N+1
const orders = await Order.find({ userId });
for (const order of orders) {
  order.user = await User.findById(order.userId); // N queries!
}
// Good: single query
const orders = await Order.find({ userId }).populate('user', 'name email');

// 4. Pagination — keyset over offset for large tables
// Offset (slow for large pages)
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;
// Keyset (fast)
SELECT * FROM products WHERE id > :last_id ORDER BY id LIMIT 20;

// 5. Connection pooling
const pool = new Pool({ max: 20, idleTimeoutMillis: 30000 });
```

### Caching Strategy
```javascript
// Cache-aside pattern
async function getProduct(id) {
  const key = `product:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const product = await Product.findById(id).lean();
  await redis.setex(key, 300, JSON.stringify(product)); // 5 min TTL
  return product;
}

// HTTP caching headers
app.get('/api/products', (req, res) => {
  res.set({
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'ETag': generateETag(products),
    'Last-Modified': new Date().toUTCString(),
  });
  res.json(products);
});

// Conditional requests
app.get('/api/products', (req, res) => {
  const etag = generateETag(products);
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.set('ETag', etag).json(products);
});
```

### Node.js Performance
```javascript
// 1. Use streams for large data
const { pipeline } = require('stream/promises');
app.get('/export', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  await pipeline(
    db.query('SELECT * FROM orders').stream(),
    new CSVTransform(),
    res,
  );
});

// 2. Worker threads for CPU-bound work
const { Worker } = require('worker_threads');
function runInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

// 3. Cluster for multi-core
const cluster = require('cluster');
if (cluster.isPrimary) {
  require('os').cpus().forEach(() => cluster.fork());
} else {
  require('./app');
}

// 4. Avoid blocking the event loop
// Bad: synchronous heavy computation
app.get('/compute', (req, res) => {
  const result = heavySync(data); // blocks event loop!
  res.json(result);
});
// Good: offload to worker thread or use async
app.get('/compute', async (req, res) => {
  const result = await runInWorker(data);
  res.json(result);
});
```

---

## Interview Questions

### Q1: What are Core Web Vitals and how do you improve them?
- **LCP**: Preload hero images, optimize server response, use CDN
- **FID/INP**: Break up long tasks, use web workers, defer non-critical JS
- **CLS**: Set explicit width/height on images, avoid inserting content above existing

### Q2: What is the difference between debounce and throttle?
- **Debounce**: delays execution until after N ms of inactivity. Use for search input, resize handler.
- **Throttle**: executes at most once per N ms. Use for scroll events, mousemove.

### Q3: How do you measure and improve Time to First Byte (TTFB)?
- Use CDN to serve from edge locations
- Enable HTTP/2 or HTTP/3
- Optimize server-side rendering
- Add caching (Redis, HTTP cache headers)
- Use connection pooling for databases
- Profile slow queries with EXPLAIN ANALYZE

### Q4: What is tree shaking and how does it work?
Tree shaking removes unused code from bundles. Requires ES modules (static imports). Bundlers (Webpack, Rollup, Vite) analyze the import graph and eliminate dead code.

```javascript
// Named imports enable tree shaking
import { debounce } from 'lodash-es'; // only debounce included

// Default import prevents tree shaking
import _ from 'lodash'; // entire lodash included
```
