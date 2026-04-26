/**
 * Auth System — Frontend
 * React app with JWT authentication
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ── API Client ────────────────────────────────────────────────────────────────
const API_URL = 'http://localhost:4000';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async request(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.request(path, options);
      }
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    try {
      const data = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).then(r => r.json());
      if (data.accessToken) {
        this.setTokens(data.accessToken, data.refreshToken);
        return true;
      }
    } catch {}
    this.clearTokens();
    return false;
  }

  register(data)  { return this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) }); }
  login(data)     { return this.request('/auth/login',    { method: 'POST', body: JSON.stringify(data) }); }
  logout(token)   { return this.request('/auth/logout',   { method: 'POST', body: JSON.stringify({ refreshToken: token }) }); }
  getMe()         { return this.request('/auth/me'); }
  getProtected()  { return this.request('/protected'); }
}

const api = new ApiClient();

// ── Auth Context ──────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.getMe()
        .then(data => setUser(data.user))
        .catch(() => api.clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    api.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await api.register({ name, email, password });
    api.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await api.logout(refreshToken); } catch {}
    api.clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ── Components ────────────────────────────────────────────────────────────────
function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Sign In</h2>
      {error && <div style={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input
            type="email" required style={styles.input}
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            type="password" required style={styles.input}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
        </div>
        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        No account? <button style={styles.link} onClick={onSwitch}>Register</button>
      </p>
    </div>
  );
}

function RegisterForm({ onSwitch }) {
  const { register } = useAuth();
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Create Account</h2>
      {error && <div style={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit}>
        {['name', 'email', 'password'].map(field => (
          <div key={field} style={styles.field}>
            <label style={styles.label}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
            <input
              type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
              required style={styles.input}
              value={form[field]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            />
          </div>
        ))}
        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Have account? <button style={styles.link} onClick={onSwitch}>Sign In</button>
      </p>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [protected_, setProtected] = useState('');

  const testProtected = async () => {
    try {
      const data = await api.getProtected();
      setProtected(JSON.stringify(data, null, 2));
    } catch (err) {
      setProtected(`Error: ${err.message}`);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Dashboard</h2>
      <p>Welcome, <strong>{user.name}</strong>!</p>
      <p style={{ color: '#6b7280' }}>Email: {user.email}</p>
      <p style={{ color: '#6b7280' }}>Role: <span style={styles.badge}>{user.role}</span></p>

      <button onClick={testProtected} style={{ ...styles.btn, background: '#7c3aed', marginTop: '1rem' }}>
        Test Protected Route
      </button>
      {protected_ && <pre style={styles.code}>{protected_}</pre>}

      <button onClick={logout} style={{ ...styles.btn, background: '#dc2626', marginTop: '1rem' }}>
        Sign Out
      </button>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(true);

  if (loading) return <div style={styles.center}><div style={styles.spinner} /></div>;

  return (
    <div style={styles.page}>
      {user
        ? <Dashboard />
        : showLogin
          ? <LoginForm    onSwitch={() => setShowLogin(false)} />
          : <RegisterForm onSwitch={() => setShowLogin(true)} />
      }
    </div>
  );
}

export default function Root() {
  return <AuthProvider><App /></AuthProvider>;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  card:    { background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.1)' },
  title:   { margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' },
  field:   { marginBottom: '1rem' },
  label:   { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' },
  input:   { width: '100%', padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' },
  btn:     { width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  link:    { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 },
  error:   { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: '1rem', fontSize: '0.875rem' },
  badge:   { background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 },
  code:    { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1rem', fontSize: '0.8rem', overflow: 'auto', marginTop: '1rem' },
  center:  { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  spinner: { width: 40, height: 40, border: '4px solid #e2e8f0', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' },
};
