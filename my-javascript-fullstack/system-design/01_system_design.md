# System Design — Frontend + Backend Architecture

## Frontend Architecture

### Component Architecture
```
App
├── Layout (Header, Sidebar, Footer)
├── Pages (route-level components)
│   ├── HomePage
│   ├── ProductsPage
│   └── CheckoutPage
├── Features (domain-specific)
│   ├── auth/
│   ├── products/
│   └── cart/
├── Shared (reusable UI)
│   ├── components/ (Button, Input, Modal)
│   ├── hooks/ (useFetch, useForm)
│   └── utils/ (formatters, validators)
└── Core (infrastructure)
    ├── api/ (HTTP client)
    ├── store/ (state management)
    └── router/
```

### State Management Decision Tree
```
Is state local to one component?
  → useState / useReducer

Is state shared between siblings?
  → Lift state up

Is state needed across many components?
  → Context API (small apps) or Redux/Zustand (large apps)

Is state server data (cache)?
  → React Query / SWR / RTK Query

Is state URL-based?
  → URL params / query strings
```

### Performance Patterns
```javascript
// Code splitting by route
const routes = [
  { path: '/', component: lazy(() => import('./pages/Home')) },
  { path: '/products', component: lazy(() => import('./pages/Products')) },
  { path: '/admin', component: lazy(() => import('./pages/Admin')) },
];

// Prefetch on hover
function NavLink({ to, children }) {
  const prefetch = () => import(`./pages/${to}`);
  return (
    <Link to={to} onMouseEnter={prefetch} onFocus={prefetch}>
      {children}
    </Link>
  );
}

// Image optimization
function OptimizedImage({ src, alt, width, height }) {
  return (
    <picture>
      <source srcSet={`${src}?format=webp`} type="image/webp" />
      <source srcSet={`${src}?format=avif`} type="image/avif" />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

// Service Worker for caching
// workbox-webpack-plugin or vite-plugin-pwa
```

---

## Backend Architecture

### Layered Architecture
```
HTTP Request
    ↓
Router (express routes)
    ↓
Middleware (auth, validation, rate limit)
    ↓
Controller (request/response handling)
    ↓
Service (business logic)
    ↓
Repository (data access)
    ↓
Database
```

```javascript
// Repository pattern
class UserRepository {
  async findById(id) {
    return db.query('SELECT * FROM users WHERE id = $1', [id]);
  }
  async findByEmail(email) {
    return db.query('SELECT * FROM users WHERE email = $1', [email]);
  }
  async create(data) {
    return db.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [data.name, data.email, data.password]
    );
  }
}

// Service layer
class UserService {
  constructor(userRepo, emailService, cacheService) {
    this.userRepo = userRepo;
    this.emailService = emailService;
    this.cache = cacheService;
  }

  async getUserById(id) {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;

    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User not found');

    await this.cache.set(`user:${id}`, user, 300);
    return user;
  }

  async createUser(data) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already registered');

    const user = await this.userRepo.create(data);
    await this.emailService.sendWelcome(user.email, user.name);
    return user;
  }
}
```

---

## Caching Strategy

```javascript
// Redis caching patterns
const redis = require('ioredis');
const client = new redis(process.env.REDIS_URL);

// Cache-aside pattern
async function getUser(id) {
  const key = `user:${id}`;
  const cached = await client.get(key);
  if (cached) return JSON.parse(cached);

  const user = await db.findUser(id);
  await client.setex(key, 300, JSON.stringify(user));  // TTL: 5 min
  return user;
}

// Write-through: update cache on write
async function updateUser(id, data) {
  const user = await db.updateUser(id, data);
  await client.setex(`user:${id}`, 300, JSON.stringify(user));
  return user;
}

// Cache invalidation
async function deleteUser(id) {
  await db.deleteUser(id);
  await client.del(`user:${id}`);
  await client.del('users:list');  // invalidate list cache
}

// Rate limiting with Redis
async function checkRateLimit(ip, limit = 100, window = 60) {
  const key = `ratelimit:${ip}`;
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, window);
  return count <= limit;
}

// Session storage
async function createSession(userId, data) {
  const sessionId = crypto.randomUUID();
  await client.setex(
    `session:${sessionId}`,
    86400,  // 24 hours
    JSON.stringify({ userId, ...data })
  );
  return sessionId;
}
```

---

## WebSockets & Real-Time

```javascript
// Socket.io server
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
  pingTimeout: 60000,
});

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.sub;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// Chat room implementation
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);

  socket.on('join-room', async (roomId) => {
    socket.join(roomId);
    const history = await getMessageHistory(roomId, 50);
    socket.emit('room-history', history);
    socket.to(roomId).emit('user-joined', { userId: socket.userId });
  });

  socket.on('send-message', async ({ roomId, content }) => {
    const message = await saveMessage({ roomId, userId: socket.userId, content });
    io.to(roomId).emit('new-message', message);
  });

  socket.on('typing', ({ roomId }) => {
    socket.to(roomId).emit('user-typing', { userId: socket.userId });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});
```

---

## Security

```javascript
// XSS Prevention
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const purify = DOMPurify(window);

function sanitizeHTML(dirty) {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  });
}

// CSRF Protection
const csrf = require('csurf');
app.use(csrf({ cookie: { httpOnly: true, secure: true, sameSite: 'strict' } }));

// SQL Injection Prevention (parameterized queries)
// BAD:
const query = `SELECT * FROM users WHERE email = '${email}'`;
// GOOD:
const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

// Input validation
const { z } = require('zod');
const createUserSchema = z.object({
  name:     z.string().min(2).max(100).trim(),
  email:    z.string().email().toLowerCase(),
  password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*[0-9])/),
  role:     z.enum(['user', 'admin']).optional().default('user'),
});

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: 'Validation failed',
        details: result.error.errors,
      });
    }
    req.body = result.data;
    next();
  };
}

// Secure headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.API_URL],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

---

## Interview Questions

### Q1: How would you design a URL shortener?
**Components:**
- **API**: POST /shorten → returns short code; GET /:code → redirect
- **Storage**: Redis for hot URLs (fast lookup), PostgreSQL for persistence
- **Code generation**: Base62 encode auto-increment ID (no collision) or hash + collision check
- **Scaling**: CDN for redirects, read replicas, horizontal API scaling
- **Analytics**: Async write to Kafka → ClickHouse for click tracking

### Q2: How do you handle authentication at scale?
- **Stateless JWT**: No server-side session storage, scales horizontally
- **Short-lived access tokens** (15min) + **long-lived refresh tokens** (7 days)
- **Token rotation**: Issue new refresh token on each use
- **Revocation**: Redis blacklist for logout/compromise
- **OAuth 2.0**: For third-party auth (Google, GitHub)

### Q3: How do you optimize a slow API endpoint?
1. Profile: identify bottleneck (DB query, computation, network)
2. Add caching (Redis) for frequently-read data
3. Optimize DB queries (indexes, N+1, pagination)
4. Add database connection pooling
5. Use async/non-blocking operations
6. Consider CDN for static/cacheable responses
7. Horizontal scaling + load balancing

### Q4: What is the difference between horizontal and vertical scaling?
- **Vertical**: Bigger server (more CPU/RAM). Simple but has limits and single point of failure.
- **Horizontal**: More servers. Requires stateless design, load balancer, shared session storage. More complex but unlimited scale.

### Q5: How do you handle CORS?
CORS (Cross-Origin Resource Sharing) is a browser security mechanism. Server sends headers to allow/deny cross-origin requests:
- `Access-Control-Allow-Origin`: allowed origins
- `Access-Control-Allow-Methods`: allowed HTTP methods
- `Access-Control-Allow-Headers`: allowed request headers
- `Access-Control-Allow-Credentials`: allow cookies
Preflight: browser sends OPTIONS request first for non-simple requests.
