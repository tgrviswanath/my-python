/**
 * Centralized Error Handling
 * Custom error classes, Express middleware, async wrapper
 */

'use strict';

// ── Custom Error Classes ──────────────────────────────────────────────────────
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.resource = resource;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} is temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE');
  }
}

// ── Async Handler ─────────────────────────────────────────────────────────────
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Express Error Middleware ──────────────────────────────────────────────────
function errorMiddleware(logger) {
  return (err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';

    // Normalize error
    let error = err;
    if (!(err instanceof AppError)) {
      // Handle known third-party errors
      if (err.name === 'ValidationError' && err.errors) {
        // Mongoose validation error
        const details = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
        error = new ValidationError('Validation failed', details);
      } else if (err.code === 11000) {
        // MongoDB duplicate key
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        error = new ConflictError(`${field} already exists`);
      } else if (err.name === 'JsonWebTokenError') {
        error = new UnauthorizedError('Invalid token');
      } else if (err.name === 'TokenExpiredError') {
        error = new UnauthorizedError('Token expired');
      } else if (err.name === 'CastError') {
        error = new NotFoundError('Resource');
      } else {
        error = new AppError(isDev ? err.message : 'Internal server error', 500);
      }
    }

    // Log
    if (error.statusCode >= 500) {
      (logger || console).error({
        message: err.message,
        stack:   err.stack,
        url:     req.url,
        method:  req.method,
        userId:  req.user?.id,
        requestId: req.id,
      });
    }

    // Response
    const response = {
      error:     error.message,
      code:      error.code,
      requestId: req.id,
    };

    if (error instanceof ValidationError && error.details?.length) {
      response.details = error.details;
    }

    if (isDev) {
      response.stack = err.stack;
    }

    res.status(error.statusCode).json(response);
  };
}

// ── Not Found Handler ─────────────────────────────────────────────────────────
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  });
}

// ── Process-level Error Handlers ──────────────────────────────────────────────
function setupProcessHandlers(server, logger) {
  const log = logger || console;

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception:', err);
    gracefulShutdown(server, 1);
  });

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection:', reason);
    gracefulShutdown(server, 1);
  });

  process.on('SIGTERM', () => { log.info('SIGTERM received'); gracefulShutdown(server, 0); });
  process.on('SIGINT',  () => { log.info('SIGINT received');  gracefulShutdown(server, 0); });
}

function gracefulShutdown(server, code) {
  server.close(() => {
    console.log('Server closed');
    process.exit(code);
  });
  setTimeout(() => process.exit(code), 10000);
}

module.exports = {
  AppError, ValidationError, NotFoundError, UnauthorizedError,
  ForbiddenError, ConflictError, RateLimitError, ServiceUnavailableError,
  asyncHandler, errorMiddleware, notFoundHandler, setupProcessHandlers,
};
