/**
 * Angular Production Components
 * Services, Guards, Interceptors, Reactive Forms, RxJS patterns
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable, BehaviorSubject, throwError, EMPTY, timer,
} from 'rxjs';
import {
  catchError, map, switchMap, filter, take, retry,
  shareReplay, tap, finalize,
} from 'rxjs/operators';
import { environment } from '../environments/environment';

// ── Models ────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; pages: number };
}

// ── Token Service ─────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly ACCESS_KEY  = 'access_token';
  private readonly REFRESH_KEY = 'refresh_token';

  getAccessToken():  string | null { return localStorage.getItem(this.ACCESS_KEY); }
  getRefreshToken(): string | null { return localStorage.getItem(this.REFRESH_KEY); }

  setTokens(tokens: AuthTokens): void {
    localStorage.setItem(this.ACCESS_KEY,  tokens.accessToken);
    localStorage.setItem(this.REFRESH_KEY, tokens.refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}

// ── Auth Service ──────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private refreshTokenInProgress = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();
  isAuthenticated$ = this.currentUser$.pipe(map(u => !!u));

  constructor(
    private http: HttpClient,
    private tokenService: TokenService,
    private router: Router,
  ) {
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    const token = this.tokenService.getAccessToken();
    if (token && !this.tokenService.isTokenExpired(token)) {
      this.http.get<{ user: User }>(`${this.apiUrl}/me`).pipe(
        catchError(() => { this.tokenService.clearTokens(); return EMPTY; })
      ).subscribe(({ user }) => this.currentUserSubject.next(user));
    }
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<{ user: User } & AuthTokens>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(({ user, accessToken, refreshToken }) => {
        this.tokenService.setTokens({ accessToken, refreshToken });
        this.currentUserSubject.next(user);
      }),
      map(({ user }) => user),
    );
  }

  register(name: string, email: string, password: string): Observable<User> {
    return this.http.post<{ user: User } & AuthTokens>(`${this.apiUrl}/register`, { name, email, password }).pipe(
      tap(({ user, accessToken, refreshToken }) => {
        this.tokenService.setTokens({ accessToken, refreshToken });
        this.currentUserSubject.next(user);
      }),
      map(({ user }) => user),
    );
  }

  logout(): void {
    const refreshToken = this.tokenService.getRefreshToken();
    this.http.post(`${this.apiUrl}/logout`, { refreshToken }).pipe(
      catchError(() => EMPTY),
      finalize(() => {
        this.tokenService.clearTokens();
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
      })
    ).subscribe();
  }

  refreshToken(): Observable<string> {
    if (this.refreshTokenInProgress) {
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        map(token => token!),
      );
    }

    this.refreshTokenInProgress = true;
    this.refreshTokenSubject.next(null);

    const refreshToken = this.tokenService.getRefreshToken();
    return this.http.post<AuthTokens>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap(tokens => {
        this.tokenService.setTokens(tokens);
        this.refreshTokenSubject.next(tokens.accessToken);
        this.refreshTokenInProgress = false;
      }),
      map(tokens => tokens.accessToken),
      catchError(err => {
        this.refreshTokenInProgress = false;
        this.logout();
        return throwError(() => err);
      }),
    );
  }

  get currentUser(): User | null { return this.currentUserSubject.value; }
  hasRole(role: string): boolean { return this.currentUser?.role === role; }
}

// ── HTTP Interceptor (functional, Angular 15+) ────────────────────────────────
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const tokenService = inject(TokenService);
  const authService  = inject(AuthService);

  const token = tokenService.getAccessToken();
  if (!token) return next(req);

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/auth/')) {
        return authService.refreshToken().pipe(
          switchMap(newToken => {
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retryReq);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};

// ── User Service ──────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/users`;
  private cache = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  getUsers(params: Record<string, any> = {}): Observable<ApiResponse<User[]>> {
    const key = JSON.stringify(params);
    if (!this.cache.has(key)) {
      this.cache.set(key,
        this.http.get<ApiResponse<User[]>>(this.apiUrl, { params }).pipe(
          retry({ count: 2, delay: 1000 }),
          shareReplay(1),
          catchError(this.handleError),
        )
      );
    }
    return this.cache.get(key)!;
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<{ data: User }>(`${this.apiUrl}/${id}`).pipe(
      map(r => r.data),
      catchError(this.handleError),
    );
  }

  createUser(data: Partial<User>): Observable<User> {
    this.cache.clear();
    return this.http.post<{ data: User }>(this.apiUrl, data).pipe(
      map(r => r.data),
      catchError(this.handleError),
    );
  }

  updateUser(id: number, data: Partial<User>): Observable<User> {
    this.cache.clear();
    return this.http.patch<{ data: User }>(`${this.apiUrl}/${id}`, data).pipe(
      map(r => r.data),
      catchError(this.handleError),
    );
  }

  deleteUser(id: number): Observable<void> {
    this.cache.clear();
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError),
    );
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    const message = err.error?.error || err.error?.message || err.statusText;
    return throwError(() => new Error(`API Error ${err.status}: ${message}`));
  }
}

// ── Auth Guard ────────────────────────────────────────────────────────────────
export const authGuard = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.currentUser) return true;
  return router.createUrlTree(['/login']);
};

export const adminGuard = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.hasRole('admin')) return true;
  return router.createUrlTree(['/forbidden']);
};

// ── State Management with RxJS ────────────────────────────────────────────────
interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

@Injectable()
export class StateStore<T> {
  private state$ = new BehaviorSubject<State<T>>({
    data: null, loading: false, error: null,
  });

  readonly data$    = this.state$.pipe(map(s => s.data));
  readonly loading$ = this.state$.pipe(map(s => s.loading));
  readonly error$   = this.state$.pipe(map(s => s.error));

  setLoading(): void {
    this.state$.next({ ...this.state$.value, loading: true, error: null });
  }

  setData(data: T): void {
    this.state$.next({ data, loading: false, error: null });
  }

  setError(error: string): void {
    this.state$.next({ ...this.state$.value, loading: false, error });
  }

  get snapshot(): State<T> { return this.state$.value; }
}

// ── Polling Service ───────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class PollingService {
  poll<T>(
    request: () => Observable<T>,
    intervalMs = 5000,
  ): Observable<T> {
    return timer(0, intervalMs).pipe(
      switchMap(() => request().pipe(
        retry({ count: 3, delay: 1000 }),
        catchError(() => EMPTY),
      )),
    );
  }
}
