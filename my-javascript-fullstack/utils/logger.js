/**
 * Production Logger
 * Structured logging with levels, context, and transports
 */

'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const COLORS = {
  error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[32m',
  http: '\x1b[36m', debug: '\x1b[35m', reset: '\x1b[0m',
};

class Logger {
  constructor({ level = 'info', service = 'app', pretty = false } = {}) {
    this.level   = level;
    this.service = service;
    this.pretty  = pretty || process.env.NODE_ENV !== 'production';
    this.context = {};
  }

  child(context) {
    const child = new Logger({ level: this.level, service: this.service, pretty: this.pretty });
    child.context = { ...this.context, ...context };
    return child;
  }

  _shouldLog(level) {
    return LEVELS[level] <= LEVELS[this.level];
  }

  _format(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...this.context,
      ...meta,
    };

    if (this.pretty) {
      const color = COLORS[level] || '';
      const reset = COLORS.reset;
      const ts    = entry.timestamp.slice(11, 23);
      const lvl   = level.toUpperCase().padEnd(5);
      const ctx   = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      return `${color}${ts} ${lvl}${reset} ${message}${ctx}`;
    }

    return JSON.stringify(entry);
  }

  _log(level, message, meta) {
    if (!this._shouldLog(level)) return;
    const formatted = this._format(level, message, meta);
    if (level === 'error' || level === 'warn') {
      process.stderr.write(formatted + '\n');
    } else {
      process.stdout.write(formatted + '\n');
    }
  }

  error(message, meta = {}) { this._log('error', message, meta); }
  warn(message,  meta = {}) { this._log('warn',  message, meta); }
  info(message,  meta = {}) { this._log('info',  message, meta); }
  http(message,  meta = {}) { this._log('http',  message, meta); }
  debug(message, meta = {}) { this._log('debug', message, meta); }

  // Express middleware
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        this.http(`${req.method} ${req.url}`, {
          status:    res.statusCode,
          duration:  `${Date.now() - start}ms`,
          ip:        req.ip,
          userAgent: req.headers['user-agent'],
          userId:    req.user?.id,
        });
      });
      next();
    };
  }
}

const logger = new Logger({
  level:   process.env.LOG_LEVEL || 'info',
  service: process.env.SERVICE_NAME || 'api',
  pretty:  process.env.NODE_ENV !== 'production',
});

module.exports = { Logger, logger };
