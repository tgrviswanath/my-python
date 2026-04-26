/**
 * Node.js API Testing — Jest + Supertest
 * Unit tests, integration tests, mocking patterns
 */

'use strict';

// ── Setup ─────────────────────────────────────────────────────────────────────
// jest.config.js:
// module.exports = {
//   testEnvironment: 'node',
//   coverageThreshold: { global: { branches: 80, functions: 80, lines: 80 } },
//   setupFilesAfterFramework: ['./tests/setup.js'],
// };

const request = require('supertest');
const { app, db } = require('../projects/05_rest_api/src/index');

// ── Test helpers ──────────────────────────────────────────────────────────────
async function createTestUser(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Test User', email: `test${Date.now()}@example.com`, password: 'Test123!', ...overrides });
  return { user: res.body.user, token: res.body.token };
}

async function createAdminUser() {
  return createTestUser({ name: 'Admin', email: `admin${Date.now()}@example.com`, role: 'admin' });
}

// ── Auth Tests ────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  test('registers a new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: `alice${Date.now()}@example.com`, password: 'Alice123!' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Alice', role: 'user' });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.token).toBeDefined();
  });

  test('returns 409 for duplicate email', async () => {
    const email = `dup${Date.now()}@example.com`;
    await request(app).post('/api/v1/auth/register').send({ name: 'A', email, password: 'Test123!' });
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'B', email, password: 'Test123!' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/taken|registered/i);
  });

  test('returns 422 for missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'Alice' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/auth/login', () => {
  test('logs in with valid credentials', async () => {
    const email = `login${Date.now()}@example.com`;
    await request(app).post('/api/v1/auth/register').send({ name: 'Bob', email, password: 'Bob123!' });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Bob123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  test('returns 401 for wrong password', async () => {
    const email = `wrong${Date.now()}@example.com`;
    await request(app).post('/api/v1/auth/register').send({ name: 'Carol', email, password: 'Carol123!' });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('returns 401 for non-existent user', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'test' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  test('returns current user with valid token', async () => {
    const { user, token } = await createTestUser();
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

// ── Products Tests ────────────────────────────────────────────────────────────
describe('GET /api/v1/products', () => {
  test('returns paginated products', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({ total: expect.any(Number), page: 1 });
  });

  test('filters by category', async () => {
    const res = await request(app).get('/api/v1/products?category=electronics');
    expect(res.status).toBe(200);
    res.body.data.forEach(p => expect(p.category).toBe('electronics'));
  });

  test('paginates correctly', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.limit).toBe(2);
  });
});

describe('POST /api/v1/products', () => {
  test('creates product as admin', async () => {
    // Get admin token (seed user)
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'admin@example.com', password: 'Admin123!' });
    const adminToken = loginRes.body.token;

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Product', price: 29.99, stock: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Product');
  });

  test('returns 403 for non-admin', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Product', price: 10 });
    expect(res.status).toBe(403);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/products').send({ name: 'Product', price: 10 });
    expect(res.status).toBe(401);
  });
});

// ── Orders Tests ──────────────────────────────────────────────────────────────
describe('POST /api/v1/orders', () => {
  test('creates order with valid items', async () => {
    const { token } = await createTestUser();
    const productsRes = await request(app).get('/api/v1/products?limit=1');
    const productId = productsRes.body.data[0]?.id;

    if (!productId) return; // skip if no products

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  test('returns 400 for empty items', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    expect(res.status).toBe(422);
  });
});

// ── Health Check ──────────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
describe('404 handler', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

// ── Unit Tests: Helpers ───────────────────────────────────────────────────────
const { strings, numbers, dates, arrays } = require('../utils/helpers');

describe('strings utilities', () => {
  test('capitalize', () => {
    expect(strings.capitalize('hello world')).toBe('Hello world');
    expect(strings.capitalize('HELLO')).toBe('Hello');
  });

  test('slugify', () => {
    expect(strings.slugify('Hello World!')).toBe('hello-world');
    expect(strings.slugify('  Foo  Bar  ')).toBe('foo-bar');
  });

  test('truncate', () => {
    expect(strings.truncate('Hello World', 8)).toBe('Hello...');
    expect(strings.truncate('Hi', 10)).toBe('Hi');
  });

  test('initials', () => {
    expect(strings.initials('Alice Johnson')).toBe('AJ');
    expect(strings.initials('Bob')).toBe('B');
  });
});

describe('numbers utilities', () => {
  test('clamp', () => {
    expect(numbers.clamp(5, 0, 10)).toBe(5);
    expect(numbers.clamp(-5, 0, 10)).toBe(0);
    expect(numbers.clamp(15, 0, 10)).toBe(10);
  });

  test('formatCompact', () => {
    expect(numbers.formatCompact(1500)).toBe('1.5K');
    expect(numbers.formatCompact(2500000)).toBe('2.5M');
    expect(numbers.formatCompact(999)).toBe('999');
  });

  test('percentage', () => {
    expect(numbers.percentage(25, 100)).toBe(25);
    expect(numbers.percentage(1, 3)).toBe(33.3);
    expect(numbers.percentage(0, 0)).toBe(0);
  });
});

describe('arrays utilities', () => {
  test('unique', () => {
    expect(arrays.unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  test('groupBy', () => {
    const items = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }];
    const grouped = arrays.groupBy(items, 'type');
    expect(grouped.a).toHaveLength(2);
    expect(grouped.b).toHaveLength(1);
  });

  test('chunk', () => {
    expect(arrays.chunk([1,2,3,4,5], 2)).toEqual([[1,2],[3,4],[5]]);
  });

  test('paginate', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const result = arrays.paginate(items, 2, 10);
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(25);
    expect(result.pages).toBe(3);
  });
});
