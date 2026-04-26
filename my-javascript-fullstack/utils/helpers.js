/**
 * Reusable Helper Utilities
 * Date formatting, string utils, array helpers, async utils
 */

'use strict';

// ── String Utilities ──────────────────────────────────────────────────────────
const strings = {
  capitalize: s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
  titleCase:  s => s.replace(/\b\w/g, c => c.toUpperCase()),
  camelToKebab: s => s.replace(/([A-Z])/g, '-$1').toLowerCase(),
  kebabToCamel: s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
  truncate: (s, max, suffix = '...') => s.length <= max ? s : s.slice(0, max - suffix.length) + suffix,
  slugify: s => s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''),
  stripHTML: s => s.replace(/<[^>]*>/g, ''),
  escapeHTML: s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;'),
  countWords: s => s.trim().split(/\s+/).filter(Boolean).length,
  initials: name => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
};

// ── Number Utilities ──────────────────────────────────────────────────────────
const numbers = {
  clamp:    (n, min, max) => Math.min(Math.max(n, min), max),
  round:    (n, dp = 2) => Math.round(n * 10**dp) / 10**dp,
  formatCurrency: (n, currency = 'USD', locale = 'en-US') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n),
  formatNumber: (n, locale = 'en-US') => new Intl.NumberFormat(locale).format(n),
  formatCompact: (n) => {
    if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`;
    return String(n);
  },
  percentage: (part, total, dp = 1) => total === 0 ? 0 : numbers.round((part / total) * 100, dp),
  randomInt:  (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
};

// ── Date Utilities ────────────────────────────────────────────────────────────
const dates = {
  format: (date, locale = 'en-US', options = {}) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...options }).format(new Date(date)),

  formatRelative: (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);
    const weeks   = Math.floor(days / 7);
    const months  = Math.floor(days / 30);
    const years   = Math.floor(days / 365);

    if (seconds < 60)  return 'just now';
    if (minutes < 60)  return `${minutes}m ago`;
    if (hours < 24)    return `${hours}h ago`;
    if (days < 7)      return `${days}d ago`;
    if (weeks < 4)     return `${weeks}w ago`;
    if (months < 12)   return `${months}mo ago`;
    return `${years}y ago`;
  },

  addDays:    (date, days)    => new Date(new Date(date).getTime() + days * 86400000),
  startOfDay: (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
  endOfDay:   (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999),
  isToday:    (date) => dates.startOfDay(new Date(date)).getTime() === dates.startOfDay().getTime(),
  daysBetween:(a, b) => Math.abs(Math.floor((new Date(b) - new Date(a)) / 86400000)),
};

// ── Array Utilities ───────────────────────────────────────────────────────────
const arrays = {
  unique:    arr => [...new Set(arr)],
  uniqueBy:  (arr, key) => [...new Map(arr.map(item => [item[key], item])).values()],
  groupBy:   (arr, key) => arr.reduce((acc, item) => { const k = typeof key === 'function' ? key(item) : item[key]; (acc[k] = acc[k] || []).push(item); return acc; }, {}),
  sortBy:    (arr, key, dir = 'asc') => [...arr].sort((a, b) => { const cmp = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; return dir === 'asc' ? cmp : -cmp; }),
  chunk:     (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size)),
  flatten:   (arr, depth = 1) => arr.flat(depth),
  flatMap:   (arr, fn) => arr.flatMap(fn),
  sum:       (arr, key) => arr.reduce((s, item) => s + (key ? item[key] : item), 0),
  avg:       (arr, key) => arrays.sum(arr, key) / arr.length,
  min:       (arr, key) => key ? arr.reduce((m, i) => i[key] < m[key] ? i : m) : Math.min(...arr),
  max:       (arr, key) => key ? arr.reduce((m, i) => i[key] > m[key] ? i : m) : Math.max(...arr),
  paginate:  (arr, page, limit) => ({ items: arr.slice((page-1)*limit, page*limit), total: arr.length, page, limit, pages: Math.ceil(arr.length/limit) }),
  shuffle:   arr => [...arr].sort(() => Math.random() - 0.5),
  sample:    (arr, n = 1) => arrays.shuffle(arr).slice(0, n),
  intersection: (a, b) => a.filter(x => b.includes(x)),
  difference:   (a, b) => a.filter(x => !b.includes(x)),
};

// ── Object Utilities ──────────────────────────────────────────────────────────
const objects = {
  pick:    (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]])),
  omit:    (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k))),
  isEmpty: obj => Object.keys(obj).length === 0,
  deepMerge: (target, source) => {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = objects.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  },
  flatten: (obj, prefix = '', sep = '.') => {
    return Object.entries(obj).reduce((acc, [k, v]) => {
      const key = prefix ? `${prefix}${sep}${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(acc, objects.flatten(v, key, sep));
      } else {
        acc[key] = v;
      }
      return acc;
    }, {});
  },
};

// ── Async Utilities ───────────────────────────────────────────────────────────
const async_ = {
  sleep: ms => new Promise(r => setTimeout(r, ms)),

  timeout: (promise, ms, message = `Timeout after ${ms}ms`) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]),

  retry: async (fn, { attempts = 3, delay = 1000, backoff = 2, onRetry } = {}) => {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try { return await fn(); }
      catch (err) {
        lastErr = err;
        if (i < attempts - 1) {
          onRetry?.(err, i + 1);
          await async_.sleep(delay * Math.pow(backoff, i));
        }
      }
    }
    throw lastErr;
  },

  parallel: (tasks, limit = Infinity) => {
    if (limit === Infinity) return Promise.all(tasks.map(t => t()));
    return new Promise((resolve, reject) => {
      const results = []; let running = 0, idx = 0, done = 0;
      const run = () => {
        while (running < limit && idx < tasks.length) {
          const i = idx++;
          running++;
          Promise.resolve(tasks[i]())
            .then(r => { results[i] = r; running--; done++; if (done === tasks.length) resolve(results); else run(); })
            .catch(reject);
        }
      };
      run();
    });
  },

  memoizeAsync: (fn, ttl = 60000) => {
    const cache = new Map();
    return async (...args) => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      if (cached && Date.now() - cached.time < ttl) return cached.value;
      const value = await fn(...args);
      cache.set(key, { value, time: Date.now() });
      return value;
    };
  },
};

// ── Environment ───────────────────────────────────────────────────────────────
const env = {
  get: (key, defaultValue = '') => process.env[key] || defaultValue,
  getInt: (key, defaultValue = 0) => parseInt(process.env[key] || defaultValue, 10),
  getBool: (key, defaultValue = false) => {
    const val = process.env[key];
    if (val === undefined) return defaultValue;
    return ['true', '1', 'yes', 'on'].includes(val.toLowerCase());
  },
  require: (key) => {
    const val = process.env[key];
    if (!val) throw new Error(`Required environment variable ${key} is not set`);
    return val;
  },
  isDev:  () => process.env.NODE_ENV === 'development',
  isProd: () => process.env.NODE_ENV === 'production',
  isTest: () => process.env.NODE_ENV === 'test',
};

module.exports = { strings, numbers, dates, arrays, objects, async: async_, env };
