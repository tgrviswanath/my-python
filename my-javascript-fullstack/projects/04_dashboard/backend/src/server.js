/**
 * Dashboard Backend — Analytics API
 */
'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const app  = express();
const PORT = process.env.PORT || 4003;

app.use(helmet()); app.use(cors()); app.use(express.json());

// ── Generate realistic mock data ──────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, dp = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(dp)); }

function generateDailyData(days = 90) {
  const data = [];
  let revenue = 8000, users = 1200, orders = 180;
  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const isWeekend = [0, 6].includes(date.getDay());
    const factor = isWeekend ? 0.7 : 1;
    revenue = Math.max(1000, revenue + rand(-500, 800) * factor);
    users   = Math.max(100,  users   + rand(-50,  100) * factor);
    orders  = Math.max(10,   orders  + rand(-20,  40)  * factor);
    data.push({
      date:    date.toISOString().slice(0, 10),
      revenue: Math.round(revenue),
      users:   Math.round(users),
      orders:  Math.round(orders),
      avgOrder: Math.round(revenue / orders),
    });
  }
  return data;
}

function generateTopProducts() {
  return [
    { id: 1, name: 'Wireless Headphones', revenue: 45230, units: 567, growth: 12.4 },
    { id: 2, name: 'Smart Watch',         revenue: 38900, units: 195, growth: 8.7  },
    { id: 3, name: 'Mechanical Keyboard', revenue: 29100, units: 224, growth: -2.1 },
    { id: 4, name: 'Running Shoes',       revenue: 24800, units: 276, growth: 15.3 },
    { id: 5, name: 'Coffee Maker',        revenue: 18600, units: 372, growth: 5.8  },
  ];
}

function generateTrafficSources() {
  return [
    { source: 'Organic Search', sessions: 12450, percentage: 38.2 },
    { source: 'Direct',         sessions: 8920,  percentage: 27.4 },
    { source: 'Social Media',   sessions: 5340,  percentage: 16.4 },
    { source: 'Email',          sessions: 3210,  percentage: 9.9  },
    { source: 'Paid Ads',       sessions: 2640,  percentage: 8.1  },
  ];
}

function generateRecentOrders() {
  const statuses = ['delivered', 'processing', 'shipped', 'pending', 'cancelled'];
  const names = ['Alice Johnson', 'Bob Smith', 'Carol White', 'Dave Brown', 'Eve Davis', 'Frank Miller', 'Grace Wilson', 'Henry Moore'];
  return Array.from({ length: 10 }, (_, i) => ({
    id:       1000 + i,
    customer: names[i % names.length],
    amount:   randFloat(20, 500),
    status:   statuses[rand(0, statuses.length - 1)],
    date:     new Date(Date.now() - rand(0, 7) * 86400000).toISOString(),
    items:    rand(1, 5),
  }));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/dashboard/overview', (req, res) => {
  const daily = generateDailyData(30);
  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  const lastMonth = daily.slice(0, 30);
  const prevMonth = generateDailyData(60).slice(0, 30);

  const sum = arr => arr.reduce((s, d) => s + d.revenue, 0);
  const thisMonthRev = sum(lastMonth);
  const prevMonthRev = sum(prevMonth);

  res.json({
    metrics: {
      revenue:    { value: thisMonthRev, change: ((thisMonthRev - prevMonthRev) / prevMonthRev * 100).toFixed(1), trend: 'up' },
      orders:     { value: lastMonth.reduce((s, d) => s + d.orders, 0), change: '8.2', trend: 'up' },
      users:      { value: today.users, change: '5.4', trend: 'up' },
      avgOrder:   { value: today.avgOrder, change: '-1.2', trend: 'down' },
      conversion: { value: '3.24', change: '0.3', trend: 'up' },
      bounceRate: { value: '42.1', change: '-2.1', trend: 'up' },
    },
    revenueChart:  daily.slice(-30),
    topProducts:   generateTopProducts(),
    trafficSources: generateTrafficSources(),
    recentOrders:  generateRecentOrders(),
  });
});

app.get('/api/dashboard/revenue', (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  res.json({ data: generateDailyData(days), period });
});

app.get('/api/dashboard/users', (req, res) => {
  const daily = generateDailyData(30);
  res.json({
    total:    daily[daily.length-1].users,
    new:      rand(80, 150),
    active:   rand(600, 900),
    churned:  rand(20, 60),
    byDevice: [
      { device: 'Desktop', percentage: 52.3 },
      { device: 'Mobile',  percentage: 38.7 },
      { device: 'Tablet',  percentage: 9.0  },
    ],
    byCountry: [
      { country: 'United States', users: 4521 },
      { country: 'United Kingdom', users: 1234 },
      { country: 'Germany',        users: 987  },
      { country: 'France',         users: 756  },
      { country: 'Canada',         users: 643  },
    ],
    chart: daily.map(d => ({ date: d.date, users: d.users })),
  });
});

app.get('/api/dashboard/products', (req, res) => {
  res.json({
    topProducts:  generateTopProducts(),
    categories: [
      { name: 'Electronics', revenue: 89400, percentage: 42.1 },
      { name: 'Sports',      revenue: 45200, percentage: 21.3 },
      { name: 'Kitchen',     revenue: 32100, percentage: 15.1 },
      { name: 'Home',        revenue: 28900, percentage: 13.6 },
      { name: 'Other',       revenue: 16800, percentage: 7.9  },
    ],
    lowStock: [
      { id: 6, name: 'Smart Watch',   stock: 3,  threshold: 10 },
      { id: 2, name: 'Mech Keyboard', stock: 5,  threshold: 10 },
      { id: 1, name: 'Headphones',    stock: 8,  threshold: 15 },
    ],
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`Dashboard API on :${PORT}`));
module.exports = app;
