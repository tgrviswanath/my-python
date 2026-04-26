/**
 * Auth System — Backend
 * JWT authentication with refresh tokens
 */

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET     = process.env.JWT_SECRET     || 'access-secret-dev';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh-secret-dev';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// ── In-memory store ───────────────────────────────────────────────────────────
const users = new Map();
const refreshTokens = new Set();
let nextId = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateTokens = (user) => ({
  accessToken:  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET,     { expiresIn: '15m' }),
  refreshToken: jwt.sign({ sub: user.id },                  REFRESH_SECRET, { expiresIn: '7d' }),
});

const sanitize = ({ password, ...u }) => u;

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
};

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if ([...users.values()].find(u => u.email === email))
    return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 12);
  const user = { id: nextId++, name, email, password: hash, role: 'user', createdAt: new Date() };
  users.set(user.id, user);

  const tokens = generateTokens(user);
  refreshTokens.add(tokens.refreshToken);
  res.status(201).json({ user: sanitize(user), ...tokens });
});

app.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = [...users.values()].find(u => u.email === email);
  const valid = user ? await bcrypt.compare(password, user.password)
                     : await bcrypt.compare(password, '$2a$12$placeholder');
  if (!user || !valid) return res.status(401).json({ error: 'Invalid credentials' });

  const tokens = generateTokens(user);
  refreshTokens.add(tokens.refreshToken);
  res.json({ user: sanitize(user), ...tokens });
});

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || !refreshTokens.has(refreshToken))
    return res.status(401).json({ error: 'Invalid refresh token' });
  try {
    const { sub } = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.get(sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    refreshTokens.delete(refreshToken);
    const tokens = generateTokens(user);
    refreshTokens.add(tokens.refreshToken);
    res.json(tokens);
  } catch {
    refreshTokens.delete(refreshToken);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

app.post('/auth/logout', authenticate, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) refreshTokens.delete(refreshToken);
  res.json({ message: 'Logged out' });
});

app.get('/auth/me', authenticate, (req, res) => {
  const user = users.get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitize(user) });
});

app.get('/protected', authenticate, (req, res) => {
  res.json({ message: `Hello user ${req.user.sub}`, role: req.user.role });
});

app.listen(PORT, () => console.log(`Auth server on :${PORT}`));
module.exports = app;
