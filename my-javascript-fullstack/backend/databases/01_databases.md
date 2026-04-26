# Databases — SQL, MongoDB, ORM/ODM & Query Optimization

## SQL (PostgreSQL)

### Schema Design
```sql
-- Users table
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(254) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'user'
               CHECK (role IN ('user', 'admin', 'moderator')),
  avatar_url TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  total      NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order items (junction table)
CREATE TABLE order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  price      NUMERIC(10, 2) NOT NULL,  -- snapshot at time of order
  UNIQUE (order_id, product_id)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_price ON products(price);

-- Composite index for common query pattern
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Partial index (only active users)
CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Query Patterns
```sql
-- Pagination (keyset pagination — better than OFFSET for large tables)
-- OFFSET pagination (simple but slow for large offsets)
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 100;

-- Keyset pagination (fast, consistent)
SELECT * FROM products
WHERE id > :last_id
ORDER BY id
LIMIT 20;

-- Complex JOIN query
SELECT
  o.id AS order_id,
  u.name AS customer,
  u.email,
  o.status,
  o.total,
  COUNT(oi.id) AS item_count,
  o.created_at
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
  AND o.status != 'cancelled'
GROUP BY o.id, u.name, u.email
ORDER BY o.created_at DESC
LIMIT 50;

-- Aggregation with window functions
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS orders,
  SUM(total) AS revenue,
  AVG(total) AS avg_order,
  SUM(SUM(total)) OVER (ORDER BY DATE_TRUNC('day', created_at)) AS cumulative_revenue
FROM orders
WHERE status = 'delivered'
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

-- Full-text search
SELECT id, name, description,
  ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')),
          plainto_tsquery('english', :query)) AS rank
FROM products
WHERE to_tsvector('english', name || ' ' || COALESCE(description, ''))
      @@ plainto_tsquery('english', :query)
ORDER BY rank DESC
LIMIT 20;

-- Upsert
INSERT INTO products (name, price, stock)
VALUES (:name, :price, :stock)
ON CONFLICT (name) DO UPDATE
SET price = EXCLUDED.price,
    stock = products.stock + EXCLUDED.stock,
    updated_at = NOW();

-- Transaction
BEGIN;
  UPDATE products SET stock = stock - :qty WHERE id = :product_id AND stock >= :qty;
  INSERT INTO order_items (order_id, product_id, quantity, price)
    SELECT :order_id, :product_id, :qty, price FROM products WHERE id = :product_id;
  UPDATE orders SET total = (
    SELECT SUM(quantity * price) FROM order_items WHERE order_id = :order_id
  ) WHERE id = :order_id;
COMMIT;
```

---

## MongoDB

### Schema Design (Mongoose)
```javascript
const mongoose = require('mongoose');
const { Schema } = mongoose;

// User schema
const userSchema = new Schema({
  name:      { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, select: false },  // exclude from queries
  role:      { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
  avatar:    String,
  isActive:  { type: Boolean, default: true },
  lastLogin: Date,
  profile: {
    bio:      String,
    location: String,
    website:  String,
  },
}, {
  timestamps: true,  // adds createdAt, updatedAt
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.password;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// Virtual
userSchema.virtual('displayName').get(function() {
  return this.name.split(' ')[0];
});

// Pre-save hook
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Static method
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

const User = mongoose.model('User', userSchema);

// Product schema with embedded subdocuments
const productSchema = new Schema({
  name:        { type: String, required: true, index: true },
  description: String,
  price:       { type: Number, required: true, min: 0 },
  stock:       { type: Number, default: 0, min: 0 },
  category:    { type: Schema.Types.ObjectId, ref: 'Category', index: true },
  images:      [{ url: String, alt: String }],
  tags:        [{ type: String, lowercase: true }],
  attributes:  Schema.Types.Mixed,  // flexible key-value
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count:   { type: Number, default: 0 },
  },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' });  // text search
productSchema.index({ price: 1, 'ratings.average': -1 });
productSchema.index({ tags: 1 });
```

### MongoDB Queries
```javascript
// Find with projection, sort, pagination
const users = await User.find(
  { isActive: true, role: { $in: ['user', 'moderator'] } },
  { password: 0, __v: 0 }
)
.sort({ createdAt: -1 })
.skip((page - 1) * limit)
.limit(limit)
.lean();  // returns plain objects (faster)

// Aggregation pipeline
const stats = await Order.aggregate([
  { $match: {
    status: 'delivered',
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }},
  { $group: {
    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
    count:   { $sum: 1 },
    revenue: { $sum: '$total' },
    avgOrder: { $avg: '$total' },
  }},
  { $sort: { _id: 1 } },
  { $project: {
    date: '$_id',
    count: 1,
    revenue: { $round: ['$revenue', 2] },
    avgOrder: { $round: ['$avgOrder', 2] },
    _id: 0,
  }},
]);

// Populate (JOIN equivalent)
const order = await Order.findById(id)
  .populate('user', 'name email')
  .populate({
    path: 'items.product',
    select: 'name price images',
    match: { isActive: true },
  });

// Transactions
const session = await mongoose.startSession();
session.startTransaction();
try {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $inc: { stock: -quantity } },
    { new: true, session, runValidators: true }
  );
  if (product.stock < 0) throw new Error('Insufficient stock');

  await Order.create([{ user: userId, items: [...], total }], { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

---

## Query Optimization

### SQL Optimization
```sql
-- EXPLAIN ANALYZE to understand query plan
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 1 AND status = 'pending';

-- Common optimizations:
-- 1. Use indexes on WHERE, JOIN, ORDER BY columns
-- 2. Avoid SELECT * — specify columns
-- 3. Use LIMIT for large result sets
-- 4. Avoid functions on indexed columns in WHERE
--    BAD:  WHERE LOWER(email) = 'alice@example.com'
--    GOOD: WHERE email = 'alice@example.com' (store lowercase)
-- 5. Use covering indexes (include all needed columns)
CREATE INDEX idx_orders_covering ON orders(user_id, status) INCLUDE (total, created_at);

-- 6. Avoid N+1 queries — use JOINs
-- BAD: query users, then query orders for each user
-- GOOD:
SELECT u.*, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id;
```

### MongoDB Optimization
```javascript
// Use explain() to analyze queries
await User.find({ email: 'alice@example.com' }).explain('executionStats');

// Projection to limit data transfer
await Product.find({}).select('name price stock').lean();

// Avoid $where (uses JavaScript, can't use indexes)
// Use $expr for cross-field comparisons
await Product.find({ $expr: { $gt: ['$price', '$cost'] } });

// Use $in instead of multiple $or
await User.find({ role: { $in: ['admin', 'moderator'] } });

// Compound index order matters: equality → sort → range
// Query: find by role, sort by createdAt, filter by date range
// Index: { role: 1, createdAt: -1 }
```

---

## Interview Questions

### Q1: What is the N+1 query problem?
**Answer:** When fetching a list of N items and then making N additional queries for related data. Solution: use JOINs (SQL), `populate` (Mongoose), `include` (Sequelize), or DataLoader (batching).

### Q2: When would you use NoSQL over SQL?
- **NoSQL**: Flexible schema, horizontal scaling, document-oriented data, high write throughput, unstructured data
- **SQL**: Complex relationships, ACID transactions, complex queries, data integrity, reporting

### Q3: What is database indexing and what are the trade-offs?
Indexes speed up reads by creating a sorted data structure (B-tree, hash). Trade-offs: slower writes (index must be updated), more storage, wrong indexes can hurt performance. Index columns used in WHERE, JOIN, ORDER BY, GROUP BY.

### Q4: What is a database transaction and what are ACID properties?
- **Atomicity**: All or nothing
- **Consistency**: Data remains valid
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed data persists

### Q5: What is the difference between `find()` and `findOne()` in Mongoose?
`find()` returns an array (empty if no match). `findOne()` returns a single document or `null`. Use `findOne()` when you expect at most one result (by unique field). Both return a Query object — call `.lean()` for plain objects, `.exec()` to get a Promise.
