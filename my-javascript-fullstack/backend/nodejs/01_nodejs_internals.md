# Node.js — Internals, Event Loop, Express & REST API Design

## Node.js Architecture

```
Node.js
├── V8 (JavaScript engine)
├── libuv (async I/O, event loop, thread pool)
├── Node.js Core APIs (fs, http, crypto, etc.)
└── Node.js Bindings (C++ bridge)

libuv Thread Pool (default 4 threads):
- File system operations
- DNS lookups
- Crypto operations
- User-defined C++ addons
```

## The Node.js Event Loop

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout, setInterval callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  I/O callbacks deferred to next loop
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  internal use
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  retrieve new I/O events
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  socket.on('close', ...)
   └───────────────────────────┘

Between each phase: process.nextTick() and Promise microtasks drain
```

```javascript
// Event loop order demonstration
setImmediate(() => console.log('setImmediate'));
setTimeout(() => console.log('setTimeout 0'), 0);
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('Promise'));
console.log('sync');

// Output:
// sync
// nextTick        ← process.nextTick (before I/O)
// Promise         ← microtask
// setTimeout 0    ← timers phase (or setImmediate first, order varies)
// setImmediate    ← check phase
```

---

## Non-Blocking I/O

```javascript
const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

// Blocking (BAD — blocks event loop)
const data = fs.readFileSync('large-file.txt', 'utf8');
// Nothing else can run while this executes

// Non-blocking (GOOD)
fs.readFile('large-file.txt', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data);
});
// Event loop continues, callback called when done

// Async/await (modern)
async function readConfig() {
  try {
    const data = await readFile('config.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    throw new Error(`Failed to read config: ${err.message}`);
  }
}

// Streams for large files (memory efficient)
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const { createGzip } = require('zlib');

async function compressFile(input, output) {
  await pipeline(
    createReadStream(input),
    createGzip(),
    createWriteStream(output),
  );
}
```

---

## Express.js — Production Setup

```javascript
// app.js
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'nonce-{nonce}'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});
app.use('/api/auth/', authLimiter);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Performance ──────────────────────────────────────────────────────────────
app.use(compression());

// ── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  skip: (req) => req.url === '/health',
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/users',    require('./routes/users'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/auth',     require('./routes/auth'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
```

---

## REST API Design

```javascript
// routes/users.js — RESTful resource
const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const UserController = require('../controllers/UserController');

// Validation middleware
const validateUser = [
  body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
  body('role').optional().isIn(['user', 'admin', 'moderator']),
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(['name', 'email', 'createdAt']),
  query('order').optional().isIn(['asc', 'desc']),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// GET /api/v1/users
router.get('/',
  authenticate,
  validatePagination,
  handleValidation,
  UserController.list
);

// GET /api/v1/users/:id
router.get('/:id',
  authenticate,
  param('id').isInt({ min: 1 }).toInt(),
  handleValidation,
  UserController.getById
);

// POST /api/v1/users
router.post('/',
  authenticate,
  authorize('admin'),
  validateUser,
  handleValidation,
  UserController.create
);

// PATCH /api/v1/users/:id
router.patch('/:id',
  authenticate,
  param('id').isInt({ min: 1 }).toInt(),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  handleValidation,
  UserController.update
);

// DELETE /api/v1/users/:id
router.delete('/:id',
  authenticate,
  authorize('admin'),
  param('id').isInt({ min: 1 }).toInt(),
  handleValidation,
  UserController.delete
);

module.exports = router;
```

---

## Authentication (JWT)

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const verifyAsync = promisify(jwt.verify);

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET;

function generateTokens(userId, role) {
  const payload = { sub: userId, role };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'myapp',
    audience: 'myapp-client',
  });

  const refreshToken = jwt.sign(payload, JWT_REFRESH, {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const decoded = await verifyAsync(token, JWT_SECRET, {
      issuer: 'myapp',
      audience: 'myapp-client',
    });

    // Check token blacklist (Redis)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, generateTokens };
```

---

## Interview Questions

### Q1: What is the Node.js event loop and how does it differ from browser's?
**Answer:** Node.js event loop (libuv) has 6 phases: timers, pending callbacks, idle/prepare, poll, check, close. Between phases, `process.nextTick()` and Promise microtasks drain. Browser event loop is simpler with macrotask queue + microtask queue. Key difference: Node has `setImmediate` (check phase) and `process.nextTick` (before I/O), browser doesn't.

### Q2: What is the difference between `process.nextTick()` and `setImmediate()`?
- `process.nextTick()`: Runs before any I/O, before next event loop iteration. Highest priority after current operation.
- `setImmediate()`: Runs in the check phase, after I/O callbacks. Lower priority.

### Q3: How do you handle uncaught exceptions in Node.js?
```javascript
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  // Graceful shutdown
  server.close(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
  // In Node 15+, this crashes the process by default
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    db.disconnect();
    process.exit(0);
  });
});
```

### Q4: What is clustering in Node.js and when do you use it?
Node.js is single-threaded. Clustering creates multiple worker processes (one per CPU core) sharing the same port. Use for CPU-bound work or to maximize throughput on multi-core servers. Alternative: PM2 cluster mode.

### Q5: How do you prevent SQL injection and XSS in Node.js?
- **SQL injection**: Use parameterized queries (never string concatenation), ORM/query builders
- **XSS**: Sanitize output (DOMPurify, xss library), set CSP headers, use `helmet`
- **CSRF**: Use CSRF tokens, SameSite cookies, verify Origin header
- **Input validation**: `express-validator`, Joi, Zod
