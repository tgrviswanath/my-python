/**
 * MongoDB / Mongoose — Production Models & Queries
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { Schema } = mongoose;

// ── User Model ────────────────────────────────────────────────────────────────
const userSchema = new Schema({
  name:     { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true,
              match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email'] },
  password: { type: String, required: true, select: false, minlength: 8 },
  role:     { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
  avatar:   { type: String, default: null },
  isActive: { type: Boolean, default: true, index: true },
  lastLogin:{ type: Date },
  profile: {
    bio:      { type: String, maxlength: 500 },
    location: { type: String, maxlength: 100 },
    website:  { type: String, match: [/^https?:\/\//, 'Must be a valid URL'] },
  },
  preferences: {
    theme:         { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    notifications: { type: Boolean, default: true },
    language:      { type: String, default: 'en' },
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => { delete ret.password; delete ret.__v; return ret; },
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

// Pre-save: hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance methods
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function() {
  const { password, __v, ...safe } = this.toObject({ virtuals: true });
  return safe;
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

userSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true });
};

const User = mongoose.model('User', userSchema);

// ── Product Model ─────────────────────────────────────────────────────────────
const productSchema = new Schema({
  name:        { type: String, required: true, trim: true, index: true },
  slug:        { type: String, unique: true, lowercase: true },
  description: { type: String, maxlength: 5000 },
  price:       { type: Number, required: true, min: 0 },
  comparePrice:{ type: Number, min: 0 },
  cost:        { type: Number, min: 0, select: false },
  stock:       { type: Number, default: 0, min: 0 },
  sku:         { type: String, unique: true, sparse: true },
  category:    { type: Schema.Types.ObjectId, ref: 'Category', index: true },
  tags:        [{ type: String, lowercase: true, trim: true }],
  images:      [{ url: String, alt: String, isPrimary: { type: Boolean, default: false } }],
  attributes:  { type: Map, of: Schema.Types.Mixed },
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count:   { type: Number, default: 0 },
  },
  isActive:    { type: Boolean, default: true, index: true },
  isFeatured:  { type: Boolean, default: false },
}, { timestamps: true });

// Text search index
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ price: 1, 'ratings.average': -1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ tags: 1 });

// Auto-generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

// Virtual: discount percentage
productSchema.virtual('discountPercent').get(function() {
  if (!this.comparePrice || this.comparePrice <= this.price) return 0;
  return Math.round((1 - this.price / this.comparePrice) * 100);
});

// Static: search
productSchema.statics.search = function(query, options = {}) {
  const { page = 1, limit = 20, sort = { score: { $meta: 'textScore' } } } = options;
  return this.find(
    { $text: { $search: query }, isActive: true },
    { score: { $meta: 'textScore' } }
  )
  .sort(sort)
  .skip((page - 1) * limit)
  .limit(limit)
  .lean();
};

const Product = mongoose.model('Product', productSchema);

// ── Order Model ───────────────────────────────────────────────────────────────
const orderItemSchema = new Schema({
  product:  { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name:     { type: String, required: true },  // snapshot
  price:    { type: Number, required: true },  // snapshot
  quantity: { type: Number, required: true, min: 1 },
  total:    { type: Number, required: true },
}, { _id: false });

const orderSchema = new Schema({
  user:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items:   [orderItemSchema],
  status:  {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
    index: true,
  },
  subtotal:  { type: Number, required: true },
  tax:       { type: Number, default: 0 },
  shipping:  { type: Number, default: 0 },
  total:     { type: Number, required: true },
  address: {
    street:  String,
    city:    String,
    state:   String,
    zip:     String,
    country: { type: String, default: 'US' },
  },
  notes:     String,
  paidAt:    Date,
  shippedAt: Date,
}, { timestamps: true });

orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Pre-save: calculate totals
orderSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.total    = this.subtotal + this.tax + this.shipping;
  next();
});

// Static: revenue stats
orderSchema.statics.getRevenueStats = function(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { status: 'delivered', createdAt: { $gte: since } } },
    { $group: {
      _id:      { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      revenue:  { $sum: '$total' },
      orders:   { $sum: 1 },
      avgOrder: { $avg: '$total' },
    }},
    { $sort: { _id: 1 } },
    { $project: {
      date:     '$_id',
      revenue:  { $round: ['$revenue', 2] },
      orders:   1,
      avgOrder: { $round: ['$avgOrder', 2] },
      _id: 0,
    }},
  ]);
};

const Order = mongoose.model('Order', orderSchema);

// ── Repository Pattern ────────────────────────────────────────────────────────
class UserRepository {
  async findById(id) {
    return User.findById(id).lean();
  }

  async findByEmail(email) {
    return User.findByEmail(email);
  }

  async create(data) {
    const user = new User(data);
    await user.save();
    return user.toSafeObject();
  }

  async update(id, data) {
    return User.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  }

  async delete(id) {
    return User.findByIdAndDelete(id);
  }

  async list({ page = 1, limit = 20, sort = '-createdAt', ...filter } = {}) {
    const [items, total] = await Promise.all([
      User.find(filter).sort(sort).skip((page-1)*limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}

class ProductRepository {
  async findById(id) {
    return Product.findById(id).populate('category', 'name slug').lean();
  }

  async create(data) {
    const product = new Product(data);
    await product.save();
    return product.toObject({ virtuals: true });
  }

  async update(id, data) {
    return Product.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  }

  async list({ page = 1, limit = 20, sort = '-createdAt', category, minPrice, maxPrice, tags, search } = {}) {
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (minPrice || maxPrice) filter.price = {};
    if (minPrice) filter.price.$gte = minPrice;
    if (maxPrice) filter.price.$lte = maxPrice;
    if (tags?.length) filter.tags = { $in: tags };

    if (search) {
      return Product.search(search, { page, limit });
    }

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip((page-1)*limit).limit(limit)
        .populate('category', 'name').lean(),
      Product.countDocuments(filter),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}

// ── Database Connection ───────────────────────────────────────────────────────
async function connectDB(uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp') {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected',    () => console.log('MongoDB connected'));
  mongoose.connection.on('error',        err => console.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = {
  User, Product, Order,
  UserRepository, ProductRepository,
  connectDB, disconnectDB,
};
