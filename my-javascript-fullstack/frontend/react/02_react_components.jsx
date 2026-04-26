/**
 * React Production-Grade Components
 * Hooks, Context, Performance, Error Boundaries
 */

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
  useReducer, createContext, useContext, memo, lazy, Suspense,
  forwardRef, useImperativeHandle, Component,
} from 'react';

// ── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Custom Hooks ─────────────────────────────────────────────────────────────

// useFetch — production-grade data fetching
function useFetch(url, options = {}) {
  const [state, dispatch] = useReducer(
    (s, a) => ({ ...s, ...a }),
    { data: null, loading: false, error: null }
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async (overrideUrl) => {
    const targetUrl = overrideUrl || url;
    if (!targetUrl) return;

    dispatch({ loading: true, error: null });
    const controller = new AbortController();

    try {
      const res = await fetch(targetUrl, {
        ...optionsRef.current,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      dispatch({ data, loading: false });
      return data;
    } catch (err) {
      if (err.name !== 'AbortError') {
        dispatch({ error: err.message, loading: false });
      }
    }

    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    const cleanup = execute();
    return () => cleanup?.();
  }, [execute]);

  return { ...state, refetch: execute };
}

// useForm — form state management
function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    if (validate) {
      const fieldErrors = validate({ ...values, [name]: values[name] });
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] || '' }));
    }
  }, [values, validate]);

  const handleSubmit = useCallback((onSubmit) => async (e) => {
    e.preventDefault();
    const allTouched = Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);

    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      if (Object.values(validationErrors).some(Boolean)) return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values, errors, touched, isSubmitting,
    handleChange, handleBlur, handleSubmit, reset,
    setValues, setErrors,
  };
}

// useInfiniteScroll
function useInfiniteScroll(fetchMore, hasMore) {
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    if (!hasMore) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) fetchMore();
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [fetchMore, hasMore]);

  return loadMoreRef;
}

// ── Context: Theme ───────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('theme') || 'light'
  );

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={theme}>{children}</div>
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// ── Components ───────────────────────────────────────────────────────────────

// Button component
const Button = memo(forwardRef(function Button(
  { children, variant = 'primary', size = 'md', loading, disabled, onClick, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn--${variant} btn--${size}`}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}));

// Input component
const Input = memo(forwardRef(function Input(
  { label, error, hint, id, required, ...props },
  ref
) {
  const inputId = id || `input-${Math.random().toString(36).slice(2)}`;
  const errorId = `${inputId}-error`;
  const hintId  = `${inputId}-hint`;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`form-input ${error ? 'form-input--error' : ''}`}
        aria-required={required}
        aria-describedby={[error && errorId, hint && hintId].filter(Boolean).join(' ')}
        aria-invalid={!!error}
        {...props}
      />
      {hint  && <span id={hintId}  className="form-hint">{hint}</span>}
      {error && <span id={errorId} className="form-error" role="alert">{error}</span>}
    </div>
  );
}));

// Modal component
function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialogRef.current?.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e) => {
    if (e.target === dialogRef.current) onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      onClick={handleBackdropClick}
      aria-labelledby="modal-title"
      aria-modal="true"
    >
      <div className="modal__content">
        <header className="modal__header">
          <h2 id="modal-title" className="modal__title">{title}</h2>
          <button
            className="modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </dialog>
  );
}

// DataTable with sorting, filtering, pagination
function DataTable({ columns, data, pageSize = 10 }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!filter) return data;
    const lower = filter.toLowerCase();
    return data.filter(row =>
      columns.some(col => String(row[col.key]).toLowerCase().includes(lower))
    );
  }, [data, filter, columns]);

  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortConfig]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = useMemo(() =>
    sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize]
  );

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }, []);

  return (
    <div className="data-table">
      <div className="data-table__toolbar">
        <Input
          placeholder="Search..."
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1); }}
          aria-label="Filter table"
        />
        <span className="text-muted text-sm">{sorted.length} results</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table role="grid" aria-rowcount={sorted.length}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  aria-sort={
                    sortConfig.key === col.key
                      ? sortConfig.direction === 'asc' ? 'ascending' : 'descending'
                      : 'none'
                  }
                  style={{ cursor: col.sortable !== false ? 'pointer' : 'default' }}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span aria-hidden="true">
                      {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Table pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}

// ── App Example ──────────────────────────────────────────────────────────────
const LazyDashboard = lazy(() => import('./Dashboard'));

function App() {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: users, loading, error } = useFetch('/api/users');

  const columns = [
    { key: 'id',    label: 'ID',    sortable: true },
    { key: 'name',  label: 'Name',  sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <span className={`badge badge--${val === 'active' ? 'success' : 'danger'}`}>
          {val}
        </span>
      ),
    },
  ];

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <div className="container">
          <h1>User Management</h1>

          <Button onClick={() => setModalOpen(true)}>Add User</Button>

          {loading && <div className="skeleton skeleton--image" />}
          {error   && <div className="alert alert--danger">{error}</div>}
          {users   && <DataTable columns={columns} data={users} />}

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Add New User"
          >
            <AddUserForm onSuccess={() => setModalOpen(false)} />
          </Modal>

          <Suspense fallback={<div className="skeleton skeleton--image" />}>
            <LazyDashboard />
          </Suspense>
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

function AddUserForm({ onSuccess }) {
  const validate = useCallback((values) => {
    const errors = {};
    if (!values.name?.trim()) errors.name = 'Name is required';
    if (!values.email?.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      errors.email = 'Invalid email format';
    return errors;
  }, []);

  const { values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit } =
    useForm({ name: '', email: '', role: 'user' }, validate);

  const onSubmit = handleSubmit(async (data) => {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Input
        label="Full Name"
        name="name"
        value={values.name}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.name && errors.name}
        required
        autoFocus
      />
      <Input
        label="Email"
        name="email"
        type="email"
        value={values.email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.email && errors.email}
        required
      />
      <Button type="submit" loading={isSubmitting} style={{ marginTop: '1rem' }}>
        {isSubmitting ? 'Creating...' : 'Create User'}
      </Button>
    </form>
  );
}

export {
  App, Button, Input, Modal, DataTable,
  ErrorBoundary, ThemeProvider, useTheme,
  useFetch, useForm, useInfiniteScroll,
};
