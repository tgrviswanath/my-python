# Node.js & Backend Interview Questions

## Easy

### Q1: What is Node.js and what makes it different?
Node.js is a JavaScript runtime built on V8. Key differences:
- **Non-blocking I/O**: Handles thousands of concurrent connections without threads
- **Event-driven**: Uses callbacks/promises for async operations
- **Single-threaded**: One thread for JS, but libuv thread pool for I/O
- **npm ecosystem**: Largest package registry

### Q2: What is `package.json`?
Manifest file for Node.js projects. Contains: name, version, scripts, dependencies, devDependencies, engines, main entry point.

```json
{
  "name": "my-api",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest --coverage",
    "lint": "eslint src/"
  },
  "dependencies": { "express": "^4.18.0" },
  "devDependencies": { "jest": "^29.0.0", "nodemon": "^3.0.0" }
}
```

---

## Medium

### Q3: What is middleware in Express?
Middleware functions have access to `req`, `res`, `next`. They can: execute code, modify req/res, end the request-response cycle, call next middleware.

```javascript
// Application-level
app.use((req, res, next) => {
  req.timestamp = Date.now();
  next();
});

// Error-handling (4 params)
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

// Router-level
router.use(authenticate);

// Built-in
app.use(express.json());
app.use(express.static('public'));
```

### Q4: How do you handle errors in async Express routes?
```javascript
// Without wrapper — unhandled rejection crashes server
app.get('/users', async (req, res) => {
  const users = await db.getUsers();  // if throws, unhandled!
  res.json(users);
});

// With try/catch
app.get('/users', async (req, res, next) => {
  try {
    const users = await db.getUsers();
    res.json(users);
  } catch (err) {
    next(err);  // pass to error handler
  }
});

// With wrapper (cleaner)
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/users', asyncHandler(async (req, res) => {
  const users = await db.getUsers();
  res.json(users);
}));
```

### Q5: What is JWT and how does it work?
JWT (JSON Web Token) = Header.Payload.Signature (base64url encoded)

```javascript
// Structure
// Header: { alg: "HS256", typ: "JWT" }
// Payload: { sub: "123", role: "admin", iat: 1234567890, exp: 1234571490 }
// Signature: HMACSHA256(base64(header) + "." + base64(payload), secret)

// Create
const token = jwt.sign(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m', issuer: 'myapp' }
);

// Verify
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// Security:
// - Store in httpOnly cookie (not localStorage — XSS safe)
// - Short expiry (15min) + refresh tokens (7 days)
// - Rotate refresh tokens on use
// - Blacklist on logout (Redis)
```

---

## Hard

### Q6: How do you scale a Node.js application?
```javascript
// 1. Clustering (multiple processes, one per CPU)
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.id} died, restarting`);
    cluster.fork();
  });
} else {
  require('./app');
}

// 2. PM2 (production process manager)
// pm2 start app.js -i max  (cluster mode)
// pm2 start app.js --watch

// 3. Horizontal scaling
// - Stateless design (no in-memory sessions)
// - Shared state in Redis
// - Load balancer (nginx, AWS ALB)

// 4. Caching
// - Redis for hot data
// - HTTP caching headers
// - CDN for static assets

// 5. Database optimization
// - Connection pooling
// - Read replicas
// - Query optimization + indexes
```

### Q7: Implement a rate limiter from scratch.
```javascript
class RateLimiter {
  constructor({ windowMs = 60000, max = 100 } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.store = new Map();  // ip → { count, resetTime }
  }

  middleware() {
    return (req, res, next) => {
      const key = req.ip;
      const now = Date.now();
      const record = this.store.get(key);

      if (!record || now > record.resetTime) {
        this.store.set(key, { count: 1, resetTime: now + this.windowMs });
        return next();
      }

      if (record.count >= this.max) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', this.max);
        res.setHeader('X-RateLimit-Remaining', 0);
        return res.status(429).json({ error: 'Too many requests' });
      }

      record.count++;
      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', this.max - record.count);
      next();
    };
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store) {
      if (now > record.resetTime) this.store.delete(key);
    }
  }
}

const limiter = new RateLimiter({ windowMs: 15 * 60 * 1000, max: 100 });
setInterval(() => limiter.cleanup(), 60000);
app.use('/api/', limiter.middleware());
```

### Q8: How do you implement graceful shutdown?
```javascript
const server = app.listen(PORT);

async function shutdown(signal) {
  console.log(`${signal} received`);

  // Stop accepting new connections
  server.close(async () => {
    try {
      // Close DB connections
      await db.pool.end();
      // Close Redis
      await redis.quit();
      // Flush logs
      await logger.flush();
      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 30s
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
```

### Q9: What is the difference between `require` and `import`?
| | `require` (CommonJS) | `import` (ESM) |
|---|---|---|
| Loading | Synchronous | Asynchronous |
| Evaluation | Runtime | Parse time |
| Tree shaking | No | Yes |
| Dynamic | Yes | `import()` |
| Default in Node | Yes | With `"type":"module"` |
| Circular deps | Partial object | Live bindings |

### Q10: How do you prevent SQL injection?
```javascript
// NEVER: string concatenation
const query = `SELECT * FROM users WHERE email = '${email}'`;
// Attacker: email = "' OR '1'='1"

// ALWAYS: parameterized queries
// pg (PostgreSQL)
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// mysql2
const [rows] = await pool.execute(
  'SELECT * FROM users WHERE email = ?',
  [email]
);

// Sequelize ORM
const user = await User.findOne({ where: { email } });

// Mongoose (MongoDB)
const user = await User.findOne({ email });  // safe by default
// NEVER: User.findOne({ $where: `this.email === '${email}'` })
```
