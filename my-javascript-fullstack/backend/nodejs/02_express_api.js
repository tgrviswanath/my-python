/**
 * Production Express.js REST API
 * Full implementation with auth, validation, error handling
 */

'use strict';

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const compression = require('compression');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');

// ── Configuration ────────────────────────────────────────────────────────────
const config = {
  port:       process.env.PORT || 3001,
  jwtSecret:  process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiry:  process.env.JWT_EXPIRY || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
  refreshExpiry: '7d',
  bcryptRounds: 12,
  env: process.env.NODE_ENV || 'development',
};

// ── Logger ───────────────────────────────────────────────────────────────────
const logger = {
  info:  (...args) => console.log('[INFO]',  new Date().toISOString(), ...args),
  warn:  (...args) => console.warn('[WARN]',  new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

// ── In-memory "database" (replace with real DB) ──────────────────────────────
const db = {
  users: new Map(),
  refreshTokens: new Set(),
  nextId: 1,

  createUser(data) {
    const user = { id: this.nextId++, ...data, createdAt: new Date(), updatedAt: new Date() };
    this.users.set(user.id, user);
    return user;
  },
  findUserById(id)      { return this.users.get(id) || null; },
  findUserByEmail(email){ return [...this.users.values()].find(u => u.email === email) || null; },
  updateUser(id, data)  {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  },
  deleteUser(id)        { return this.users.delete(id); },
  listUsers({ page = 1, limit = 20, sort = 'id', order = 'asc' } = {}) {
    let users = [...this.users.values()];
    users.sort((a, b) => {
      const cmp = a[sort] < b[sort] ? -1 : a[sort] > b[sort] ? 1 : 0;
      return order === 'asc' ? cmp : -cmp;
    });
    const total = users.length;
    const items = users.slice((page - 1) * limit, page * limit);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  },
};

// Seed admin user
(async () => {
  const hash = await bcrypt.hash('Admin123!', config.bcryptRounds);
  db.createUser({ name: 'Admin', email: 'admin@example.com', password: hash, role: 'admin' });
})();

// ── App Setup ────────────────────────────────────────────────────────────────
const app = express();

// Trust proxy (for rate limiting behind nginx/load balancer)
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors({
  origin: config.env === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',')
    : true,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan(config.env === 'production' ? 'combined' : 'dev', {
  skip: req => req.url === '/health',
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);

// ── Middleware ───────────────────────────────────────────────────────────────

// Request ID
app.use((req, res, next) => {
  req.id = Math.random().toString(36).slice(2);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Validation handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// JWT Authentication
const authenticate = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = auth.slice(7);
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.findUserById(decoded.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    res.status(401).json({ error: err.message, code });
  }
};

// Authorization
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Async wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Auth Routes ──────────────────────────────────────────────────────────────
const authRouter = express.Router();

authRouter.post('/register',
  authLimiter,
  [
    body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 })
      .matches(/^(?=.*[A-Z])(?=.*[0-9])/)
      .withMessage('Password must contain uppercase and number'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (db.findUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, config.bcryptRounds);
    const user = db.createUser({ name, email, password: hash, role: 'user' });

    const { accessToken, refreshToken } = generateTokens(user);
    db.refreshTokens.add(refreshToken);

    res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  })
);

authRouter.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = db.findUserByEmail(email);

    // Constant-time comparison to prevent timing attacks
    const validPassword = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, '$2a$12$placeholder.hash.for.timing');

    if (!user || !validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    db.refreshTokens.add(refreshToken);

    res.json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  })
);

authRouter.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || !db.refreshTokens.has(refreshToken)) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    try {
      const decoded = jwt.verify(refreshToken, config.refreshSecret);
      const user = db.findUserById(decoded.sub);
      if (!user) return res.status(401).json({ error: 'User not found' });

      db.refreshTokens.delete(refreshToken);
      const tokens = generateTokens(user);
      db.refreshTokens.add(tokens.refreshToken);

      res.json(tokens);
    } catch {
      db.refreshTokens.delete(refreshToken);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  })
);

authRouter.post('/logout', authenticate, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) db.refreshTokens.delete(refreshToken);
  res.json({ message: 'Logged out successfully' });
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// ── User Routes ──────────────────────────────────────────────────────────────
const userRouter = express.Router();

userRouter.get('/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sort').optional().isIn(['id', 'name', 'email', 'createdAt']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = db.listUsers(req.query);
    res.json({
      ...result,
      items: result.items.map(sanitizeUser),
    });
  })
);

userRouter.get('/:id',
  authenticate,
  param('id').isInt({ min: 1 }).toInt(),
  validate,
  asyncHandler(async (req, res) => {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Users can only see their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ user: sanitizeUser(user) });
  })
);

userRouter.patch('/:id',
  authenticate,
  param('id').isInt({ min: 1 }).toInt(),
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['user', 'admin', 'moderator']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only admins can change roles
    if (req.body.role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot change role' });
    }

    const user = db.updateUser(id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user: sanitizeUser(user) });
  })
);

userRouter.delete('/:id',
  authenticate,
  authorize('admin'),
  param('id').isInt({ min: 1 }).toInt(),
  validate,
  asyncHandler(async (req, res) => {
    const deleted = db.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  })
);

// ── Mount Routes ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth',  authRouter);
app.use('/api/v1/users', userRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error(`[${req.id}] ${err.message}`, { stack: err.stack, url: req.url });

  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
    requestId: req.id,
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateTokens(user) {
  const payload = { sub: user.id, role: user.role };
  return {
    accessToken:  jwt.sign(payload, config.jwtSecret,  { expiresIn: config.jwtExpiry }),
    refreshToken: jwt.sign(payload, config.refreshSecret, { expiresIn: config.refreshExpiry }),
  };
}

function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} [${config.env}]`);
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err => { logger.error('Uncaught:', err); shutdown('uncaughtException'); });
process.on('unhandledRejection', err => { logger.error('Unhandled:', err); });

module.exports = { app, db };
