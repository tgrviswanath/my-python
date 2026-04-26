/**
 * Reusable Validators
 * Input validation utilities for frontend and backend
 */

'use strict';

// ── Primitive validators ──────────────────────────────────────────────────────
const validators = {
  required:  v => v !== null && v !== undefined && v !== '',
  email:     v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)),
  url:       v => { try { new URL(v); return true; } catch { return false; } },
  phone:     v => /^\+?[\d\s\-().]{7,20}$/.test(String(v)),
  integer:   v => Number.isInteger(Number(v)),
  positive:  v => Number(v) > 0,
  uuid:      v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  alphanumeric: v => /^[a-zA-Z0-9]+$/.test(v),
  noScript:  v => !/<script|javascript:|on\w+=/i.test(v),
  strongPassword: v => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/.test(v),
};

// ── Schema validator ──────────────────────────────────────────────────────────
class Schema {
  constructor(shape) {
    this.shape = shape;
  }

  validate(data) {
    const errors = {};
    const result = {};

    for (const [field, rules] of Object.entries(this.shape)) {
      const value = data[field];
      const fieldErrors = [];

      for (const rule of rules) {
        const error = rule(value, data);
        if (error) fieldErrors.push(error);
      }

      if (fieldErrors.length) {
        errors[field] = fieldErrors[0];
      } else {
        result[field] = value;
      }
    }

    return {
      valid:  Object.keys(errors).length === 0,
      errors,
      data:   result,
    };
  }
}

// ── Rule builders ─────────────────────────────────────────────────────────────
const rules = {
  required: (msg = 'This field is required') =>
    v => (!validators.required(v) ? msg : null),

  email: (msg = 'Invalid email address') =>
    v => (v && !validators.email(v) ? msg : null),

  minLength: (min, msg) =>
    v => (v && v.length < min ? (msg || `Minimum ${min} characters`) : null),

  maxLength: (max, msg) =>
    v => (v && v.length > max ? (msg || `Maximum ${max} characters`) : null),

  min: (min, msg) =>
    v => (v !== undefined && Number(v) < min ? (msg || `Minimum value is ${min}`) : null),

  max: (max, msg) =>
    v => (v !== undefined && Number(v) > max ? (msg || `Maximum value is ${max}`) : null),

  pattern: (regex, msg = 'Invalid format') =>
    v => (v && !regex.test(v) ? msg : null),

  oneOf: (options, msg) =>
    v => (v && !options.includes(v) ? (msg || `Must be one of: ${options.join(', ')}`) : null),

  strongPassword: (msg = 'Password must contain uppercase, lowercase, number, and special character') =>
    v => (v && !validators.strongPassword(v) ? msg : null),

  match: (field, msg) =>
    (v, data) => (v !== data[field] ? (msg || `Must match ${field}`) : null),

  custom: (fn, msg = 'Invalid value') =>
    v => (!fn(v) ? msg : null),
};

// ── Common schemas ────────────────────────────────────────────────────────────
const schemas = {
  register: new Schema({
    name:     [rules.required(), rules.minLength(2), rules.maxLength(100)],
    email:    [rules.required(), rules.email()],
    password: [rules.required(), rules.minLength(8), rules.strongPassword()],
    confirm:  [rules.required(), rules.match('password', 'Passwords do not match')],
  }),

  login: new Schema({
    email:    [rules.required(), rules.email()],
    password: [rules.required()],
  }),

  product: new Schema({
    name:  [rules.required(), rules.minLength(1), rules.maxLength(200)],
    price: [rules.required(), rules.min(0)],
    stock: [rules.min(0)],
  }),
};

// ── Sanitizers ────────────────────────────────────────────────────────────────
const sanitize = {
  trim:       v => typeof v === 'string' ? v.trim() : v,
  lowercase:  v => typeof v === 'string' ? v.toLowerCase() : v,
  uppercase:  v => typeof v === 'string' ? v.toUpperCase() : v,
  toNumber:   v => Number(v),
  toBoolean:  v => Boolean(v),
  toInt:      v => parseInt(v, 10),
  stripHTML:  v => typeof v === 'string' ? v.replace(/<[^>]*>/g, '') : v,
  escapeHTML: v => typeof v === 'string'
    ? v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
       .replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
    : v,
};

module.exports = { validators, Schema, rules, schemas, sanitize };
