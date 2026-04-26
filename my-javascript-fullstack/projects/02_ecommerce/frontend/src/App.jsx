/**
 * E-Commerce Frontend — React
 * Products, Cart, Checkout, Orders
 */
import React, { useState, useEffect, useCallback, useReducer, createContext, useContext, useMemo } from 'react';

const API = 'http://localhost:4002/api/v1';

// ── API helpers ───────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('token');
const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...opts.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// ── Cart Context ──────────────────────────────────────────────────────────────
const CartContext = createContext(null);

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const existing = state.find(i => i.id === action.product.id);
      if (existing) return state.map(i => i.id === action.product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...state, { ...action.product, qty: 1 }];
    }
    case 'REMOVE':   return state.filter(i => i.id !== action.id);
    case 'UPDATE':   return state.map(i => i.id === action.id ? { ...i, qty: action.qty } : i);
    case 'CLEAR':    return [];
    default:         return state;
  }
}

function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, [], () => {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);

  const addToCart    = useCallback(p  => dispatch({ type: 'ADD', product: p }), []);
  const removeFromCart = useCallback(id => dispatch({ type: 'REMOVE', id }), []);
  const updateQty    = useCallback((id, qty) => qty < 1 ? dispatch({ type: 'REMOVE', id }) : dispatch({ type: 'UPDATE', id, qty }), []);
  const clearCart    = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const count = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  return <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQty, clearCart, total, count }}>{children}</CartContext.Provider>;
}
const useCart = () => useContext(CartContext);

// ── Auth Context ──────────────────────────────────────────────────────────────
const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getToken()) {
      apiFetch('/auth/me').then(d => setUser(d.user)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const d = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('token', d.token); setUser(d.user); return d;
  };
  const register = async (name, email, password) => {
    const d = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    localStorage.setItem('token', d.token); setUser(d.user); return d;
  };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
const useAuth = () => useContext(AuthContext);

// ── Components ────────────────────────────────────────────────────────────────
const S = {
  page:    { fontFamily: 'system-ui,sans-serif', minHeight: '100vh', background: '#f8fafc', color: '#0f172a' },
  nav:     { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 100 },
  logo:    { fontWeight: 800, fontSize: '1.25rem', color: '#2563eb', cursor: 'pointer' },
  navLinks:{ display: 'flex', gap: '1rem', alignItems: 'center' },
  navBtn:  { background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem' },
  main:    { maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '1.5rem' },
  card:    { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.1)', transition: 'transform .2s,box-shadow .2s', cursor: 'pointer' },
  cardImg: { width: '100%', aspectRatio: '4/3', objectFit: 'cover' },
  cardBody:{ padding: '1rem' },
  btn:     { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'all .15s' },
  btnPrimary: { background: '#2563eb', color: '#fff' },
  btnOutline: { background: 'transparent', border: '1.5px solid #2563eb', color: '#2563eb' },
  btnDanger:  { background: '#dc2626', color: '#fff' },
  input:   { width: '100%', padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box' },
  badge:   { background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 },
  stars:   { color: '#f59e0b', fontSize: '0.875rem' },
};

function StarRating({ rating }) {
  return <span style={S.stars}>{'★'.repeat(Math.round(rating))}{'☆'.repeat(5-Math.round(rating))} <span style={{ color: '#6b7280' }}>({rating})</span></span>;
}

function ProductCard({ product, onClick }) {
  const { addToCart } = useCart();
  return (
    <div style={S.card} onClick={() => onClick(product)} onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.12)'; }} onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.1)'; }}>
      <img src={product.image} alt={product.name} style={S.cardImg} loading="lazy" />
      <div style={S.cardBody}>
        <span style={{ ...S.badge, marginBottom: 8, display: 'inline-block' }}>{product.category}</span>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>{product.name}</h3>
        <StarRating rating={product.rating} />
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '4px 0 12px' }}>{product.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#2563eb' }}>${product.price}</span>
          <button style={{ ...S.btn, ...S.btnPrimary, padding: '6px 12px' }}
            onClick={e => { e.stopPropagation(); addToCart(product); }}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ onClose, onCheckout }) {
  const { cart, removeFromCart, updateQty, total, clearCart } = useCart();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 400, background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.15)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Cart ({cart.length})</h2>
          <button style={{ ...S.btn, background: 'none', fontSize: '1.5rem' }} onClick={onClose}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {cart.length === 0 ? <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '3rem' }}>Your cart is empty</p> :
            cart.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <img src={item.image} alt={item.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</p>
                  <p style={{ margin: '0 0 8px', color: '#2563eb', fontWeight: 700 }}>${item.price}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={{ ...S.btn, padding: '2px 8px', background: '#f1f5f9' }} onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                    <span style={{ fontWeight: 600 }}>{item.qty}</span>
                    <button style={{ ...S.btn, padding: '2px 8px', background: '#f1f5f9' }} onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                    <button style={{ ...S.btn, padding: '2px 8px', color: '#dc2626', background: 'none' }} onClick={() => removeFromCart(item.id)}>✕</button>
                  </div>
                </div>
                <span style={{ fontWeight: 700 }}>${(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))
          }
        </div>
        {cart.length > 0 && (
          <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontWeight: 700, fontSize: '1.125rem' }}>
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
            <button style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '12px', fontSize: '1rem', marginBottom: 8 }} onClick={onCheckout}>Checkout</button>
            <button style={{ ...S.btn, ...S.btnOutline, width: '100%', padding: '10px' }} onClick={clearCart}>Clear Cart</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutPage({ onBack, onSuccess }) {
  const { cart, total, clearCart } = useCart();
  const { user } = useAuth();
  const [form, setForm] = useState({ street: '', city: '', state: '', zip: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await apiFetch('/orders', { method: 'POST', body: JSON.stringify({
        items: cart.map(i => ({ productId: i.id, quantity: i.qty })),
        address: form,
      })});
      clearCart(); onSuccess();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const tax = total * 0.08;
  const shipping = total >= 50 ? 0 : 9.99;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <button style={{ ...S.btn, ...S.btnOutline, marginBottom: '1.5rem' }} onClick={onBack}>← Back to Cart</button>
      <h2>Checkout</h2>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <h3>Shipping Address</h3>
        {['street','city','state','zip'].map(f => (
          <div key={f} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>{f}</label>
            <input style={S.input} required value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} placeholder={f === 'zip' ? '12345' : ''} />
          </div>
        ))}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Order Summary</h3>
          {cart.map(i => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.875rem' }}><span>{i.name} × {i.qty}</span><span>${(i.price*i.qty).toFixed(2)}</span></div>)}
          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 4 }}><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 4 }}><span>Tax (8%)</span><span>${tax.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 8 }}><span>Shipping</span><span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.125rem' }}><span>Total</span><span>${(total+tax+shipping).toFixed(2)}</span></div>
        </div>
        <button type="submit" style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '14px', fontSize: '1rem' }} disabled={loading}>
          {loading ? 'Placing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function ShopApp() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [page, setPage] = useState('shop');
  const [cartOpen, setCartOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({});
  const [filters, setFilters] = useState({ search: '', category: '', sort: 'id', page: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ ...filters, limit: 8 });
    apiFetch(`/products?${params}`)
      .then(d => { setProducts(d.items); setMeta(d); })
      .finally(() => setLoading(false));
  }, [filters]);

  if (page === 'checkout') return (
    <div style={S.page}>
      <nav style={S.nav}><span style={S.logo} onClick={() => setPage('shop')}>🛒 ShopApp</span></nav>
      <div style={S.main}>
        {orderSuccess
          ? <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div style={{ fontSize: '4rem' }}>✅</div>
              <h2>Order Placed!</h2>
              <p style={{ color: '#6b7280' }}>Thank you for your purchase.</p>
              <button style={{ ...S.btn, ...S.btnPrimary, marginTop: '1rem' }} onClick={() => { setPage('shop'); setOrderSuccess(false); }}>Continue Shopping</button>
            </div>
          : <CheckoutPage onBack={() => setPage('shop')} onSuccess={() => setOrderSuccess(true)} />
        }
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <span style={S.logo}>🛒 ShopApp</span>
        <div style={S.navLinks}>
          {user ? <>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Hi, {user.name}</span>
            <button style={{ ...S.btn, ...S.btnOutline }} onClick={logout}>Logout</button>
          </> : <button style={{ ...S.btn, ...S.btnPrimary }}>Sign In</button>}
          <button style={{ ...S.btn, ...S.btnPrimary, position: 'relative' }} onClick={() => setCartOpen(true)}>
            🛒 Cart {count > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>}
          </button>
        </div>
      </nav>

      <div style={S.main}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <input style={{ ...S.input, maxWidth: 300 }} placeholder="Search products..." value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))} />
          <select style={{ ...S.input, width: 'auto' }} value={filters.category}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value, page: 1 }))}>
            <option value="">All Categories</option>
            {(meta.categories||[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={{ ...S.input, width: 'auto' }} value={filters.sort}
            onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}>
            <option value="id">Default</option>
            <option value="price">Price: Low to High</option>
            <option value="-price">Price: High to Low</option>
            <option value="-rating">Top Rated</option>
          </select>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>Loading products...</div> :
          <>
            <div style={S.grid}>
              {products.map(p => <ProductCard key={p.id} product={p} onClick={setSelected} />)}
            </div>
            {meta.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                {Array.from({ length: meta.pages }, (_, i) => (
                  <button key={i} style={{ ...S.btn, ...(filters.page === i+1 ? S.btnPrimary : S.btnOutline), padding: '6px 12px' }}
                    onClick={() => setFilters(f => ({ ...f, page: i+1 }))}>{i+1}</button>
                ))}
              </div>
            )}
          </>
        }
      </div>

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setPage('checkout'); }} />}
    </div>
  );
}

export default function App() {
  return <AuthProvider><CartProvider><ShopApp /></CartProvider></AuthProvider>;
}
