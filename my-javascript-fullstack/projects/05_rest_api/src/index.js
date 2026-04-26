/**
 * Project 05 — Production REST API
 * Full CRUD with PostgreSQL-like in-memory store, validation, auth
 */

'use strict';

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const { z }     = require('zod');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');

const app  = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'rest-api-secret';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ── In-memory store ───────────────────────────────────────────────────────────
class Store {
  constructor() { this.data = new Map(); this.nextId = 1; }
  create(item)   { const id = this.nextId++; const record = { id, ...item, createdAt: new Date(), updatedAt: new Date() }; this.data.set(id, record); return record; }
  findById(id)   { return this.data.get(id) || null; }
  findAll(filter = {}) {
    let items = [...this.data.values()];
    Object.entries(filter).forEach(([k, v]) => { if (v !== undefined) items = items.filter(i => i[k] === v); });
    return items;
  }
  update(id, updates) {
    const item = this.data.get(id);
    if (!item) return null;
    const updated = { ...item, ...updates, updatedAt: new Date() };
    this.data.set(id, updated);
    return updated;
  }
  delete(id) { return this.data.delete(id); }
  count()    { return this.data.size; }
}

const stores = {
  users:    new Store(),
  products: new Store(),
  orders:   new Store(),
};

// Seed data
(async () => {
  const hash = await bcrypt.hash('Admin123!', 10);
  stores.users.create({ name: 'Admin', email: 'admin@example.com', password: hash, role: 'admin' });
  stores.users.create({ name: 'Alice',  email: 'alice@example.com', password: hash, role: 'user' });

  ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Keyboard'].forEach((name, i) => {
    stores.products.create({ name, price: (i + 1) * 199.99, stock: (i + 1) * 10, category: 'electronics' });
  });
})();

// ── Validation ────────────────────────────────────────────────────────────────
const schemas = {
  register: z.object({
    name:     z.string().min(2).max(100).trim(),
    email:    z.string().email().toLowerCase(),
    password: z.string().min(8),
  }),
  login: z.object({
    email:    z.string().email().toLowerCase(),
    password: z.string().min(1),
  }),
  product: z.object({
    name:     z.string().min(1).max(200).trim(),
    price:    z.number().positive(),
    stock:    z.number().int().min(0).default(0),
    category: z.string().optional(),
    description: z.string().optional(),
  }),
  order: z.object({
    items: z.array(z.object({
      productId: z.number().int().positive(),
      quantity:  z.number().int().positive(),
    })).min(1),
  }),
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ error: 'Validation failed', details: result.error.errors });
  }
  req.body = result.data;
  next();
};

// ── Auth ──────────────────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Pagination helper ─────────────────────────────────────────────────────────
function paginate(items, { page = 1, limit = 20, sort = 'id', order = 'asc' } = {}) {
  const sorted = [...items].sort((a, b) => {
    const cmp = a[sort] < b[sort] ? -1 : a[sort] > b[sort] ? 1 : 0;
    return order === 'asc' ? cmp : -cmp;
  });
  const total = sorted.length;
  const pages = Math.ceil(total / limit);
  const data  = sorted.slice((page - 1) * limit, page * limit);
  return { data, meta: { total, page, limit, pages } };
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
const auth = express.Router();

auth.post('/register', validate(schemas.register), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (stores.users.findAll({ email }).length) return res.status(409).json({ error: 'Email taken' });
  const hash = await bcrypt.hash(password, 10);
  const user = stores.users.create({ name, email, password: hash, role: 'user' });
  const { password: _, ...safe } = user;
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ user: safe, token });
}));

auth.post('/login', validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = stores.users.findAll({ email })[0];
  const valid = user ? await bcrypt.compare(password, user.password)
                     : await bcrypt.compare(password, '$2a$10$placeholder');
  if (!user || !valid) return res.status(401).json({ error: 'Invalid credentials' });
  const { password: _, ...safe } = user;
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ user: safe, token });
}));

auth.get('/me', authenticate, (req, res) => {
  const user = stores.users.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { password: _, ...safe } = user;
  res.json({ user: safe });
});

// ── Products Routes ───────────────────────────────────────────────────────────
const products = express.Router();

products.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, sort = 'id', order = 'asc', category, minPrice, maxPrice } = req.query;
  let items = stores.products.findAll();
  if (category) items = items.filter(p => p.category === category);
  if (minPrice) items = items.filter(p => p.price >= +minPrice);
  if (maxPrice) items = items.filter(p => p.price <= +maxPrice);
  res.json(paginate(items, { page: +page, limit: +limit, sort, order }));
}));

products.get('/:id', asyncHandler(async (req, res) => {
  const product = stores.products.findById(+req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ data: product });
}));

products.post('/', authenticate, authorize('admin'), validate(schemas.product), asyncHandler(async (req, res) => {
  const product = stores.products.create(req.body);
  res.status(201).json({ data: product });
}));

products.patch('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const product = stores.products.update(+req.params.id, req.body);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ data: product });
}));

products.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  if (!stores.products.delete(+req.params.id)) return res.status(404).json({ error: 'Product not found' });
  res.status(204).send();
}));

// ── Orders Routes ─────────────────────────────────────────────────────────────
const orders = express.Router();

orders.get('/', authenticate, asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.sub };
  const items  = stores.orders.findAll(filter);
  res.json(paginate(items, req.query));
}));

orders.post('/', authenticate, validate(schemas.order), asyncHandler(async (req, res) => {
  const { items } = req.body;
  let total = 0;
  const orderItems = [];

  for (const { productId, quantity } of items) {
    const product = stores.products.findById(productId);
    if (!product) return res.status(400).json({ error: `Product ${productId} not found` });
    if (product.stock < quantity) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
    total += product.price * quantity;
    orderItems.push({ productId, quantity, price: product.price, name: product.name });
    stores.products.update(productId, { stock: product.stock - quantity });
  }

  const order = stores.orders.create({
    userId: req.user.sub,
    items: orderItems,
    total: Math.round(total * 100) / 100,
    status: 'pending',
  });
  res.status(201).json({ data: order });
}));

orders.patch('/:id/status', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const order = stores.orders.update(+req.params.id, { status });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ data: order });
}));

// ── Mount ─────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',     auth);
app.use('/api/v1/products', products);
app.use('/api/v1/orders',   orders);

app.get('/health', (req, res) => res.json({
  status: 'ok',
  counts: { users: stores.users.count(), products: stores.products.count(), orders: stores.orders.count() },
}));

app.get('/api/v1/stats', authenticate, authorize('admin'), (req, res) => {
  const allOrders = stores.orders.findAll();
  res.json({
    users:    stores.users.count(),
    products: stores.products.count(),
    orders:   allOrders.length,
    revenue:  allOrders.reduce((s, o) => s + o.total, 0).toFixed(2),
    byStatus: allOrders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {}),
  });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`REST API on :${PORT}`));
module.exports = { app, stores };
