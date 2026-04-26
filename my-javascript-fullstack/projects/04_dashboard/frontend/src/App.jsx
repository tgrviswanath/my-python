/**
 * Analytics Dashboard Frontend — React
 */
import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:4003/api/dashboard';

const apiFetch = path => fetch(`${API}${path}`).then(r => r.json());

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app:     { fontFamily: 'system-ui,sans-serif', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' },
  nav:     { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 },
  main:    { maxWidth: 1400, margin: '0 auto', padding: '2rem 1.5rem' },
  grid4:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.5rem', marginBottom: '2rem' },
  grid2:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(400px,1fr))', gap: '1.5rem', marginBottom: '2rem' },
  card:    { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)' },
  metric:  { display: 'flex', flexDirection: 'column', gap: 4 },
  mLabel:  { fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  mValue:  { fontSize: '2rem', fontWeight: 800, lineHeight: 1 },
  mChange: { fontSize: '0.8rem', fontWeight: 600 },
  up:      { color: '#16a34a' },
  down:    { color: '#dc2626' },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th:      { textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td:      { padding: '10px 12px', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9' },
  badge:   { padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700 },
  bar:     { height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, background: '#2563eb', transition: 'width .5s ease' },
  tabs:    { display: 'flex', gap: '0.5rem', marginBottom: '2rem' },
  tab:     { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' },
};

const statusColors = {
  delivered:  { background: '#dcfce7', color: '#166534' },
  processing: { background: '#dbeafe', color: '#1e40af' },
  shipped:    { background: '#fef3c7', color: '#92400e' },
  pending:    { background: '#f3f4f6', color: '#374151' },
  cancelled:  { background: '#fee2e2', color: '#991b1b' },
};

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
function MiniChart({ data, field, color = '#2563eb', height = 60 }) {
  if (!data?.length) return null;
  const values = data.map(d => d[field]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 100 / data.length;

  return (
    <svg width="100%" height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const h = ((d[field] - min) / range) * (height - 8) + 4;
        return <rect key={i} x={`${i * w}%`} y={height - h} width={`${w - 1}%`} height={h} fill={color} opacity={0.7} rx={2} />;
      })}
    </svg>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, change, trend, prefix = '', suffix = '', color = '#2563eb' }) {
  const isUp = trend === 'up';
  return (
    <div style={S.card}>
      <div style={S.metric}>
        <span style={S.mLabel}>{label}</span>
        <span style={{ ...S.mValue, color }}>{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</span>
        <span style={{ ...S.mChange, ...(isUp ? S.up : S.down) }}>
          {isUp ? '↑' : '↓'} {Math.abs(change)}% vs last month
        </span>
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ data }) {
  if (!data) return <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading...</div>;
  const { metrics, revenueChart, topProducts, trafficSources, recentOrders } = data;

  return (
    <>
      {/* Metrics */}
      <div style={S.grid4}>
        <MetricCard label="Revenue"     value={metrics.revenue.value}    change={metrics.revenue.change}    trend={metrics.revenue.trend}    prefix="$" color="#2563eb" />
        <MetricCard label="Orders"      value={metrics.orders.value}     change={metrics.orders.change}     trend={metrics.orders.trend}     color="#7c3aed" />
        <MetricCard label="Active Users" value={metrics.users.value}     change={metrics.users.change}      trend={metrics.users.trend}      color="#16a34a" />
        <MetricCard label="Avg Order"   value={metrics.avgOrder.value}   change={metrics.avgOrder.change}   trend={metrics.avgOrder.trend}   prefix="$" color="#d97706" />
        <MetricCard label="Conversion"  value={metrics.conversion.value} change={metrics.conversion.change} trend={metrics.conversion.trend} suffix="%" color="#0891b2" />
        <MetricCard label="Bounce Rate" value={metrics.bounceRate.value} change={metrics.bounceRate.change} trend={metrics.bounceRate.trend} suffix="%" color="#dc2626" />
      </div>

      <div style={S.grid2}>
        {/* Revenue Chart */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Revenue (30 days)</h3>
          <MiniChart data={revenueChart} field="revenue" height={120} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.75rem', color: '#64748b' }}>
            <span>{revenueChart?.[0]?.date}</span>
            <span>{revenueChart?.[revenueChart.length-1]?.date}</span>
          </div>
        </div>

        {/* Traffic Sources */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Traffic Sources</h3>
          {trafficSources?.map(s => (
            <div key={s.source} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.875rem' }}>
                <span>{s.source}</span>
                <span style={{ fontWeight: 700 }}>{s.percentage}%</span>
              </div>
              <div style={S.bar}><div style={{ ...S.barFill, width: `${s.percentage}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.grid2}>
        {/* Top Products */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Top Products</h3>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Product</th><th style={S.th}>Revenue</th><th style={S.th}>Growth</th></tr></thead>
            <tbody>
              {topProducts?.map(p => (
                <tr key={p.id}>
                  <td style={S.td}>{p.name}</td>
                  <td style={S.td}>${p.revenue.toLocaleString()}</td>
                  <td style={{ ...S.td, color: p.growth >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    {p.growth >= 0 ? '+' : ''}{p.growth}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Orders */}
        <div style={S.card}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Recent Orders</h3>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Customer</th><th style={S.th}>Amount</th><th style={S.th}>Status</th></tr></thead>
            <tbody>
              {recentOrders?.map(o => (
                <tr key={o.id}>
                  <td style={S.td}>{o.customer}</td>
                  <td style={S.td}>${o.amount}</td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, ...(statusColors[o.status] || {}) }}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ data }) {
  if (!data) return <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading...</div>;
  return (
    <>
      <div style={S.grid4}>
        <MetricCard label="Total Users"  value={data.total}   change="5.4" trend="up"   color="#2563eb" />
        <MetricCard label="New Users"    value={data.new}     change="12.1" trend="up"  color="#7c3aed" />
        <MetricCard label="Active Users" value={data.active}  change="3.2" trend="up"   color="#16a34a" />
        <MetricCard label="Churned"      value={data.churned} change="1.8" trend="down" color="#dc2626" />
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Users by Device</h3>
          {data.byDevice?.map(d => (
            <div key={d.device} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.875rem' }}>
                <span>{d.device}</span><span style={{ fontWeight: 700 }}>{d.percentage}%</span>
              </div>
              <div style={S.bar}><div style={{ ...S.barFill, width: `${d.percentage}%`, background: d.device === 'Desktop' ? '#2563eb' : d.device === 'Mobile' ? '#7c3aed' : '#16a34a' }} /></div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Top Countries</h3>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Country</th><th style={S.th}>Users</th></tr></thead>
            <tbody>
              {data.byCountry?.map(c => (
                <tr key={c.country}><td style={S.td}>{c.country}</td><td style={S.td}>{c.users.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (tab === 'overview' && !overview) {
      apiFetch('/overview').then(setOverview).finally(() => setLoading(false));
    } else if (tab === 'users' && !users) {
      apiFetch('/users').then(setUsers).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [tab]);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users',    label: '👥 Users' },
    { id: 'products', label: '📦 Products' },
    { id: 'orders',   label: '🛒 Orders' },
  ];

  return (
    <div style={S.app}>
      <nav style={S.nav}>
        <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#2563eb' }}>📊 Analytics</span>
        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Last updated: {new Date().toLocaleTimeString()}</span>
      </nav>
      <div style={S.main}>
        <div style={S.tabs}>
          {tabs.map(t => (
            <button key={t.id} style={{ ...S.tab, background: tab === t.id ? '#2563eb' : '#fff', color: tab === t.id ? '#fff' : '#374151', boxShadow: tab === t.id ? 'none' : '0 1px 3px rgba(0,0,0,.1)' }}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {tab === 'overview' && <OverviewTab data={overview} />}
        {tab === 'users'    && <UsersTab    data={users} />}
        {tab === 'products' && <div style={{ ...S.card, textAlign: 'center', padding: '4rem', color: '#64748b' }}>Products analytics — connect to /api/dashboard/products</div>}
        {tab === 'orders'   && <div style={{ ...S.card, textAlign: 'center', padding: '4rem', color: '#64748b' }}>Orders analytics — connect to /api/dashboard/revenue</div>}
      </div>
    </div>
  );
}
