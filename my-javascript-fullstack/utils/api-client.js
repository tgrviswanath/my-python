/**
 * Production API Client
 * Handles auth, retries, interceptors, cancellation
 */

'use strict';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  constructor({
    baseURL = '',
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    headers = {},
  } = {}) {
    this.baseURL    = baseURL;
    this.timeout    = timeout;
    this.retries    = retries;
    this.retryDelay = retryDelay;
    this.defaultHeaders = { 'Content-Type': 'application/json', ...headers };
    this.interceptors = { request: [], response: [] };
    this._refreshing = null;
  }

  // ── Interceptors ────────────────────────────────────────────────────────────
  addRequestInterceptor(fn)  { this.interceptors.request.push(fn); return this; }
  addResponseInterceptor(fn) { this.interceptors.response.push(fn); return this; }

  // ── Token management ────────────────────────────────────────────────────────
  setAccessToken(token)  { this.accessToken = token; }
  setRefreshToken(token) { this.refreshToken = token; }
  clearTokens()          { this.accessToken = this.refreshToken = null; }

  async _refreshAccessToken() {
    if (this._refreshing) return this._refreshing;

    this._refreshing = (async () => {
      try {
        const data = await this._fetch('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: this.refreshToken }),
          _skipAuth: true,
        });
        this.accessToken  = data.accessToken;
        this.refreshToken = data.refreshToken;
        return data.accessToken;
      } finally {
        this._refreshing = null;
      }
    })();

    return this._refreshing;
  }

  // ── Core fetch ──────────────────────────────────────────────────────────────
  async _fetch(path, options = {}) {
    const url = `${this.baseURL}${path}`;
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), this.timeout);

    let config = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...(this.accessToken && !options._skipAuth
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
        ...options.headers,
      },
      signal: controller.signal,
    };

    // Run request interceptors
    for (const interceptor of this.interceptors.request) {
      config = await interceptor(config) || config;
    }

    try {
      let response = await fetch(url, config);

      // Auto-refresh on 401
      if (response.status === 401 && this.refreshToken && !options._skipAuth) {
        try {
          await this._refreshAccessToken();
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          response = await fetch(url, config);
        } catch {
          this.clearTokens();
          this.onUnauthorized?.();
          throw new ApiError('Session expired', 401, null);
        }
      }

      const contentType = response.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        throw new ApiError(
          data?.error || data?.message || response.statusText,
          response.status,
          data
        );
      }

      // Run response interceptors
      let result = { data, status: response.status, headers: response.headers };
      for (const interceptor of this.interceptors.response) {
        result = await interceptor(result) || result;
      }

      return result.data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ── Retry logic ─────────────────────────────────────────────────────────────
  async _fetchWithRetry(path, options = {}, attempt = 0) {
    try {
      return await this._fetch(path, options);
    } catch (err) {
      const shouldRetry =
        attempt < this.retries &&
        !(err instanceof ApiError && err.status < 500) &&
        err.name !== 'AbortError';

      if (shouldRetry) {
        const delay = this.retryDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        return this._fetchWithRetry(path, options, attempt + 1);
      }
      throw err;
    }
  }

  // ── HTTP methods ─────────────────────────────────────────────────────────────
  get(path, params, options = {}) {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path;
    return this._fetchWithRetry(url, { method: 'GET', ...options });
  }

  post(path, body, options = {}) {
    return this._fetchWithRetry(path, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  }

  put(path, body, options = {}) {
    return this._fetchWithRetry(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    });
  }

  patch(path, body, options = {}) {
    return this._fetchWithRetry(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    });
  }

  delete(path, options = {}) {
    return this._fetchWithRetry(path, { method: 'DELETE', ...options });
  }

  // ── File upload ──────────────────────────────────────────────────────────────
  upload(path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseURL}${path}`);
      if (this.accessToken) xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      if (onProgress) xhr.upload.onprogress = e => onProgress(e.loaded / e.total);
      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(data.error, xhr.status, data));
      };
      xhr.onerror = () => reject(new ApiError('Network error', 0, null));
      xhr.send(formData);
    });
  }
}

// ── Singleton instance ────────────────────────────────────────────────────────
const api = new ApiClient({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  timeout: 30000,
  retries: 3,
});

// Add logging interceptor
api.addRequestInterceptor(config => {
  console.debug(`→ ${config.method} ${config.url}`);
  return config;
});

api.addResponseInterceptor(result => {
  console.debug(`← ${result.status}`);
  return result;
});

// Handle unauthorized globally
api.onUnauthorized = () => {
  window.location.href = '/login';
};

module.exports = { ApiClient, ApiError, api };
