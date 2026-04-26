/**
 * E-Commerce Backend — Products, Cart, Orders
 */
'use strict';

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const morgan    = require('morgan');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');

const app  = express();
const PORT = process.env.PORT || 4002;
const JWT_SECRET = process.env.JWT_SECRET || 'ecom-secret';

app.use(helmet()); app.use(cors()); app.use(express.json()); app.use(morgan('dev'));

// ── In-memory store ───────────────────────────────────────────────────────────
const db = {
  users:    new Map(), nextUserId: 1,
  products: new Map(), nextProductId: 1,
  orders:   new Map(), nextOrderId: 1,
};

// Seed products
const seedProducts = [
  { name: 'Wireless Headphones', price: 79.99, stock: 50, category: 'electronics', description: 'Premium sound quality', rating: 4.5, reviewCount: 128, image: 'https://picsum.photos/400/300?random=1' },
  { name: 'Mechanical Keyboard', price: 129.99, stock: 30, category: 'electronics', description: 'Tactile typing experience', rating: 4.7, reviewCount: 89, image: 'https://picsum.photos/400/300?random=2' },
  { name: 'Running Shoes',       price: 89.99,  stock: 100, category: 'sports',     description: 'Lightweight and durable', rating: 4.3, reviewCount: 215, image: 'https://picsum.photos/400/300?random=3' },
  { name: 'Coffee Maker',        price: 49.99,  stock: 75,  category: 'kitchen',    description: 'Brew perfect coffee', rating: 4.1, reviewCount: 342, image: 'https://picsum.photos/400/300?random=4' },
  { name: 'Yoga Mat',            price: 29.99,  stock: 200, category: 'sports',     description: 'Non-slip surface', rating: 4.6, reviewCount: 178, image: 'https://picsum.photos/400/300?random=5' },
  { name: 'Smart Watch',         price: 199.99, stock: 40,  category: 'electronics', description: 'Track your fitness', rating: 4.4, reviewCount: 95, image: 'https://picsum.photos/400/300?random=6' },
  { name: 'Desk Lamp',           price: 34.99,  stock: 60,  category: 'home',       description: 'LED adjustable light', rating: 4.2, reviewCount: 67, image: 'https://picsum.photos/400/300?random=7' },
  { name: 'Water Bottle',        price: 19.99,  stock: 300, category: 'sports',     description: 'BPA-free stainless', rating: 4.8, reviewCount: 456, image: 'https://picsum.photos/400/300?random=8' },
];
seedProducts.forEach(p => {
  const id = db.nextProductId++;
  db.products.set(id, { id, ...p, createdAt: new Date() });
});

// Seed admin
(async () => {
  const hash = await bcrypt.hash('Admin123!', 10);
  db.users.set(1, { id: 1, name: 'Admin', email: 'admin@shop.com', password: hash, role: 'admin', createdAt: new Date() });
  db.nextUserId = 2;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sanitize = ({ password, ...u }) => u;
const paginate = (items, page = 1, limit = 12) => ({
  items: items.slice((page-1)*limit, page*limit),
  total: items.length, page: +page, limit: +limit,
  pages: Math.ceil(items.length / limit),
});

// ── Auth middleware ───────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch {} }
  next();
};
const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' });

// ── Auth routes ───────────────────────────────────────────────────────────────
const auth = express.Router();

auth.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if ([...db.users.values()].find(u => u.email === email))
    return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: db.nextUserId++, name, email, password: hash, role: 'user', createdAt: new Date() };
  db.users.set(user.id, user);
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ user: sanitize(user), token });
}));

auth.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = [...db.users.values()].find(u => u.email === email);
  const valid = user ? await bcrypt.compare(password, user.password)
                     : await bcrypt.compare(password, '$2a$10$placeholder');
  if (!user || !valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ user: sanitize(user), token });
}));

auth.get('/me', authenticate, (req, res) => {
  const user = db.users.get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user: sanitize(user) });
});

// ── Product routes ────────────────────────────────────────────────────────────
const products = express.Router();

products.get('/', (req, res) => {
  const { page = 1, limit = 12, category, search, sort = 'id', order = 'asc', minPrice, maxPrice } = req.query;
  let items = [...db.products.values()];
  if (category) items = items.filter(p => p.category === category);
  if (search)   items = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()));
  if (minPrice) items = items.filter(p => p.price >= +minPrice);
  if (maxPrice) items = items.filter(p => p.price <= +maxPrice);
  items.sort((a, b) => {
    const cmp = a[sort] < b[sort] ? -1 : a[sort] > b[sort] ? 1 : 0;
    return order === 'asc' ? cmp : -cmp;
  });
  const categories = [...new Set([...db.products.values()].map(p => p.category))];
  res.json({ ...paginate(items, page, limit), categories });
});

products.get('/featured', (req, res) => {
  const items = [...db.products.values()].sort((a, b) => b.rating - a.rating).slice(0, 4);
  res.json({ items });
});

products.get('/:id', (req, res) => {
  const product = db.products.get(+req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ data: product });
});

products.post('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { name, price, stock, category, description, image } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
  const product = { id: db.nextProductId++, name, price: +price, stock: +(stock||0), category: category||'general', description: description||'', image: image||'', rating: 0, reviewCount: 0, createdAt: new Date() };
  db.products.set(product.id, product);
  res.status(201).json({ data: product });
}));

products.patch('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const product = db.products.get(+req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  const updated = { ...product, ...req.body, updatedAt: new Date() };
  db.products.set(product.id, updated);
  res.json({ data: updated });
}));

products.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  if (!db.products.delete(+req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// ── Order routes ──────────────────────────────────────────────────────────────
const orders = express.Router();

orders.get('/', authenticate, (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.sub };
  let items = [...db.orders.values()];
  if (filter.userId) items = items.filter(o => o.userId === filter.userId);
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(paginate(items, req.query.page, req.query.limit));
});

orders.post('/', authenticate, asyncHandler(async (req, res) => {
  const { items, address } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Items required' });

  const orderItems = [];
  let subtotal = 0;

  for (const { productId, quantity } of items) {
    const product = db.products.get(+productId);
    if (!product) return res.status(400).json({ error: `Product ${productId} not found` });
    if (product.stock < quantity) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
    const itemTotal = product.price * quantity;
    subtotal += itemTotal;
    orderItems.push({ productId: product.id, name: product.name, price: product.price, quantity, total: itemTotal });
    db.products.set(product.id, { ...product, stock: product.stock - quantity });
  }

  const tax      = Math.round(subtotal * 0.08 * 100) / 100;
  const shipping = subtotal >= 50 ? 0 : 9.99;
  const total    = Math.round((subtotal + tax + shipping) * 100) / 100;

  const order = { id: db.nextOrderId++, userId: req.user.sub, items: orderItems, subtotal: Math.round(subtotal*100)/100, tax, shipping, total, status: 'pending', address: address || {}, createdAt: new Date() };
  db.orders.set(order.id, order);
  res.status(201).json({ data: order });
}));

orders.get('/:id', authenticate, (req, res) => {
  const order = db.orders.get(+req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && order.userId !== req.user.sub)
    return res.status(403).json({ error: 'Forbidden' });
  res.json({ data: order });
});

orders.patch('/:id/status', authenticate, authorize('admin'), (req, res) => {
  const order = db.orders.get(+req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const valid = ['pending','processing','shipped','delivered','cancelled'];
  if (!valid.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  const updated = { ...order, status: req.body.status, updatedAt: new Date() };
  db.orders.set(order.id, updated);
  res.json({ data: updated });
});

// ── Stats (admin) ─────────────────────────────────────────────────────────────
app.get('/api/v1/stats', authenticate, authorize('admin'), (req, res) => {
  const allOrders = [...db.orders.values()];
  const delivered = allOrders.filter(o => o.status === 'delivered');
  res.json({
    users:    db.users.size,
    products: db.products.size,
    orders:   allOrders.length,
    revenue:  delivered.reduce((s, o) => s + o.total, 0).toFixed(2),
    byStatus: allOrders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status]||0)+1 }), {}),
    topProducts: [...db.products.values()].sort((a,b) => b.reviewCount - a.reviewCount).slice(0,5).map(p => ({ id: p.id, name: p.name, rating: p.rating })),
  });
});

app.use('/api/v1/auth',     auth);
app.use('/api/v1/products', products);
app.use('/api/v1/orders',   orders);
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

app.listen(PORT, () => console.log(`E-commerce API on :${PORT}`));
module.exports = { app, db };
