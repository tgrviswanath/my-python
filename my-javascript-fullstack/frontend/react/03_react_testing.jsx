/**
 * React Testing — Jest + React Testing Library
 * Unit tests, integration tests, mocking patterns
 */

// ── Setup (jest.config.js) ────────────────────────────────────────────────────
/*
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['@testing-library/jest-dom'],
  moduleNameMapper: { '\\.(css|scss)$': 'identity-obj-proxy' },
  transform: { '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest' },
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80 } },
};
*/

import React, { useState } from 'react';
import {
  render, screen, fireEvent, waitFor,
  within, act, userEvent,
} from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Component under test ──────────────────────────────────────────────────────
function Counter({ initialCount = 0, step = 1, onCountChange }) {
  const [count, setCount] = useState(initialCount);

  const increment = () => {
    const next = count + step;
    setCount(next);
    onCountChange?.(next);
  };

  const decrement = () => {
    const next = count - step;
    setCount(next);
    onCountChange?.(next);
  };

  const reset = () => {
    setCount(initialCount);
    onCountChange?.(initialCount);
  };

  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={decrement} aria-label="Decrement">-</button>
      <button onClick={increment} aria-label="Increment">+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

// ── Counter Tests ─────────────────────────────────────────────────────────────
describe('Counter', () => {
  test('renders with initial count', () => {
    render(<Counter initialCount={5} />);
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });

  test('increments count on + click', () => {
    render(<Counter />);
    fireEvent.click(screen.getByLabelText('Increment'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  test('decrements count on - click', () => {
    render(<Counter initialCount={5} />);
    fireEvent.click(screen.getByLabelText('Decrement'));
    expect(screen.getByTestId('count')).toHaveTextContent('4');
  });

  test('resets to initial count', () => {
    render(<Counter initialCount={10} />);
    fireEvent.click(screen.getByLabelText('Increment'));
    fireEvent.click(screen.getByLabelText('Increment'));
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByTestId('count')).toHaveTextContent('10');
  });

  test('uses custom step', () => {
    render(<Counter step={5} />);
    fireEvent.click(screen.getByLabelText('Increment'));
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });

  test('calls onCountChange callback', () => {
    const onCountChange = jest.fn();
    render(<Counter onCountChange={onCountChange} />);
    fireEvent.click(screen.getByLabelText('Increment'));
    expect(onCountChange).toHaveBeenCalledWith(1);
    expect(onCountChange).toHaveBeenCalledTimes(1);
  });
});

// ── Form Component ────────────────────────────────────────────────────────────
function LoginForm({ onSubmit }) {
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!values.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(values.email)) errs.email = 'Invalid email';
    if (!values.password) errs.password = 'Password is required';
    else if (values.password.length < 6) errs.password = 'Min 6 characters';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await onSubmit(values);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Login form">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email" type="email"
          value={values.email}
          onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
        />
        {errors.email && <span id="email-error" role="alert">{errors.email}</span>}
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password" type="password"
          value={values.password}
          onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={!!errors.password}
        />
        {errors.password && <span id="password-error" role="alert">{errors.password}</span>}
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

// ── Form Tests ────────────────────────────────────────────────────────────────
describe('LoginForm', () => {
  test('renders email and password fields', () => {
    render(<LoginForm onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  test('shows validation errors on empty submit', async () => {
    render(<LoginForm onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  test('shows invalid email error', async () => {
    render(<LoginForm onSubmit={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'notanemail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Invalid email')).toBeInTheDocument();
  });

  test('calls onSubmit with form values', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Email'),    { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'password123',
      });
    });
  });

  test('shows loading state during submission', async () => {
    const onSubmit = jest.fn(() => new Promise(r => setTimeout(r, 100)));
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Email'),    { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' })).not.toBeDisabled());
  });
});

// ── Async Component ───────────────────────────────────────────────────────────
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div role="status">Loading...</div>;
  if (error)   return <div role="alert">Error: {error}</div>;

  return (
    <ul>
      {users.map(u => (
        <li key={u.id}>{u.name} — {u.email}</li>
      ))}
    </ul>
  );
}

// ── Async Tests with Mock Fetch ───────────────────────────────────────────────
describe('UserList', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows loading state initially', () => {
    global.fetch.mockResolvedValue({ json: () => new Promise(() => {}) });
    render(<UserList />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  });

  test('renders users after successful fetch', async () => {
    const mockUsers = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob',   email: 'bob@example.com' },
    ];
    global.fetch.mockResolvedValue({ json: () => Promise.resolve(mockUsers) });

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Alice — alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('Bob — bob@example.com')).toBeInTheDocument();
    });
  });

  test('shows error on fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    render(<UserList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Network error');
  });
});

// ── Custom Hook Tests ─────────────────────────────────────────────────────────
import { renderHook, act as hookAct } from '@testing-library/react';

function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = () => setValue(v => !v);
  const setTrue  = () => setValue(true);
  const setFalse = () => setValue(false);
  return { value, toggle, setTrue, setFalse };
}

describe('useToggle', () => {
  test('initializes with false by default', () => {
    const { result } = renderHook(() => useToggle());
    expect(result.current.value).toBe(false);
  });

  test('initializes with provided value', () => {
    const { result } = renderHook(() => useToggle(true));
    expect(result.current.value).toBe(true);
  });

  test('toggles value', () => {
    const { result } = renderHook(() => useToggle());
    hookAct(() => result.current.toggle());
    expect(result.current.value).toBe(true);
    hookAct(() => result.current.toggle());
    expect(result.current.value).toBe(false);
  });

  test('setTrue and setFalse work correctly', () => {
    const { result } = renderHook(() => useToggle());
    hookAct(() => result.current.setTrue());
    expect(result.current.value).toBe(true);
    hookAct(() => result.current.setFalse());
    expect(result.current.value).toBe(false);
  });
});

export { Counter, LoginForm, UserList, useToggle };
