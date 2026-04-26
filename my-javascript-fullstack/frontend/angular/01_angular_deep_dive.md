# Angular — Architecture, DI, RxJS, Change Detection & Routing

## Angular Architecture

```
Angular Application
├── AppModule (root)
│   ├── Components (UI + logic)
│   ├── Services (business logic, DI)
│   ├── Directives (DOM manipulation)
│   ├── Pipes (data transformation)
│   └── Guards (route protection)
├── Feature Modules (lazy-loaded)
│   ├── UserModule
│   ├── ProductModule
│   └── AdminModule
└── Shared Module (common components/pipes)
```

---

## Dependency Injection

```typescript
// Service with DI
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'  // singleton across app
  // providedIn: UserModule  // scoped to module
})
export class UserService {
  private readonly apiUrl = '/api/users';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      retry(2),
      catchError(this.handleError)
    );
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createUser(user: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.apiUrl, user).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message || error.statusText;
    return throwError(() => new Error(`API Error: ${message}`));
  }
}

// Injection tokens for non-class dependencies
import { InjectionToken } from '@angular/core';

export const API_URL = new InjectionToken<string>('API_URL');
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// In module providers:
providers: [
  { provide: API_URL, useValue: environment.apiUrl },
  { provide: APP_CONFIG, useFactory: () => ({ theme: 'dark', lang: 'en' }) },
]

// Inject in component:
constructor(@Inject(API_URL) private apiUrl: string) {}
```

---

## Components & Lifecycle

```typescript
import {
  Component, OnInit, OnDestroy, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef,
  HostListener, signal, computed, effect,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-user-card',
  template: `
    <div class="card" [class.card--featured]="featured">
      <img [src]="user.avatar" [alt]="user.name + ' avatar'" loading="lazy">
      <div class="card__body">
        <h3>{{ user.name }}</h3>
        <p>{{ user.email }}</p>
        <span class="badge" [ngClass]="statusClass">{{ user.status }}</span>
      </div>
      <div class="card__footer">
        <button (click)="onEdit()">Edit</button>
        <button (click)="onDelete()" class="btn--danger">Delete</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,  // performance
})
export class UserCardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) user!: User;
  @Input() featured = false;
  @Output() edit   = new EventEmitter<User>();
  @Output() delete = new EventEmitter<number>();

  @ViewChild('card') cardRef!: ElementRef;

  private destroy$ = new Subject<void>();

  get statusClass(): Record<string, boolean> {
    return {
      'badge--success': this.user.status === 'active',
      'badge--danger':  this.user.status === 'inactive',
    };
  }

  ngOnInit(): void {
    // Subscribe with automatic cleanup
    this.userService.userUpdated$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(updated => {
      if (updated.id === this.user.id) {
        this.user = updated;
        this.cdr.markForCheck();  // OnPush: manually trigger CD
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('keydown.enter')
  onEnter(): void { this.onEdit(); }

  onEdit():   void { this.edit.emit(this.user); }
  onDelete(): void { this.delete.emit(this.user.id); }

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef,
  ) {}
}

// Angular 17+ Signals
@Component({
  selector: 'app-counter',
  template: `
    <p>Count: {{ count() }}</p>
    <p>Double: {{ double() }}</p>
    <button (click)="increment()">+</button>
  `,
})
export class CounterComponent {
  count  = signal(0);
  double = computed(() => this.count() * 2);

  constructor() {
    effect(() => {
      console.log('Count changed:', this.count());
    });
  }

  increment() { this.count.update(c => c + 1); }
}
```

---

## RxJS Deep Dive

```typescript
import {
  Observable, Subject, BehaviorSubject, ReplaySubject,
  combineLatest, merge, forkJoin, of, from, interval, timer,
} from 'rxjs';
import {
  map, filter, switchMap, mergeMap, concatMap, exhaustMap,
  debounceTime, distinctUntilChanged, takeUntil, catchError,
  retry, retryWhen, delay, tap, share, shareReplay,
  withLatestFrom, scan, reduce, startWith, pairwise,
} from 'rxjs/operators';

// Subject types
const subject       = new Subject<number>();          // no initial value, no replay
const behavior      = new BehaviorSubject<number>(0); // initial value, replays last
const replay        = new ReplaySubject<number>(3);   // replays last 3 values

// Higher-order mapping operators
// switchMap: cancels previous inner observable (search, navigation)
// mergeMap:  runs all concurrently (parallel requests)
// concatMap: queues, runs sequentially (ordered operations)
// exhaustMap: ignores new while current running (form submit)

// Search with debounce
const searchResults$ = searchInput$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  filter(query => query.length >= 2),
  switchMap(query =>
    this.searchService.search(query).pipe(
      catchError(() => of([]))  // don't break stream on error
    )
  ),
  shareReplay(1),  // share among multiple subscribers
);

// Combine multiple streams
const dashboard$ = combineLatest([
  this.userService.currentUser$,
  this.statsService.stats$,
  this.notificationService.count$,
]).pipe(
  map(([user, stats, notifCount]) => ({ user, stats, notifCount }))
);

// Polling with retry
const liveData$ = timer(0, 5000).pipe(
  switchMap(() => this.api.getData().pipe(
    retry({ count: 3, delay: 1000 })
  )),
  distinctUntilChanged(JSON.stringify),
  shareReplay(1),
);

// State management with scan
interface Action { type: string; payload?: any; }
interface State  { items: Item[]; loading: boolean; error: string | null; }

const actions$ = new Subject<Action>();
const state$   = actions$.pipe(
  scan((state: State, action: Action): State => {
    switch (action.type) {
      case 'LOAD':    return { ...state, loading: true, error: null };
      case 'SUCCESS': return { ...state, loading: false, items: action.payload };
      case 'ERROR':   return { ...state, loading: false, error: action.payload };
      default:        return state;
    }
  }, { items: [], loading: false, error: null }),
  startWith({ items: [], loading: false, error: null }),
  shareReplay(1),
);
```

---

## Change Detection

```typescript
// Default: checks entire component tree on every event
// OnPush: only checks when:
//   1. Input reference changes
//   2. Event originates from component
//   3. Async pipe emits
//   4. markForCheck() called
//   5. detectChanges() called

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptimizedComponent {
  // Use async pipe — auto subscribes/unsubscribes, triggers CD
  users$ = this.userService.getUsers();

  // Template:
  // <div *ngFor="let user of users$ | async">{{ user.name }}</div>
}

// Zone.js and NgZone
@Component({})
export class HeavyComponent {
  constructor(private ngZone: NgZone) {}

  runHeavyTask() {
    // Run outside Angular zone — no CD triggered
    this.ngZone.runOutsideAngular(() => {
      // Heavy computation, third-party library
      heavyLibrary.init();
    });

    // Re-enter zone when done
    this.ngZone.run(() => {
      this.result = 'done';  // triggers CD
    });
  }
}
```

---

## Routing & Guards

```typescript
// app-routing.module.ts
const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [AuthGuard],
    canLoad: [AuthGuard],
  },
  {
    path: 'users/:id',
    component: UserDetailComponent,
    resolve: { user: UserResolver },
    canDeactivate: [UnsavedChangesGuard],
  },
  { path: '**', component: NotFoundComponent },
];

// Auth Guard
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanLoad {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (this.auth.isAuthenticated()) return true;
    return this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: route.url.join('/') }
    });
  }

  canLoad(route: Route): boolean {
    return this.auth.isAuthenticated();
  }
}

// Resolver
@Injectable({ providedIn: 'root' })
export class UserResolver implements Resolve<User> {
  constructor(private userService: UserService, private router: Router) {}

  resolve(route: ActivatedRouteSnapshot): Observable<User> {
    const id = +route.paramMap.get('id')!;
    return this.userService.getUserById(id).pipe(
      catchError(() => {
        this.router.navigate(['/not-found']);
        return EMPTY;
      })
    );
  }
}
```

---

## Forms

```typescript
// Reactive Forms
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';

@Component({
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="email" type="email">
      <div *ngIf="email.invalid && email.touched">
        <span *ngIf="email.errors?.['required']">Email required</span>
        <span *ngIf="email.errors?.['email']">Invalid email</span>
      </div>

      <div formGroupName="address">
        <input formControlName="city">
        <input formControlName="zip">
      </div>

      <div formArrayName="phones">
        <div *ngFor="let phone of phones.controls; let i = index">
          <input [formControlName]="i">
          <button type="button" (click)="removePhone(i)">Remove</button>
        </div>
        <button type="button" (click)="addPhone()">Add Phone</button>
      </div>

      <button type="submit" [disabled]="form.invalid || form.pristine">Submit</button>
    </form>
  `,
})
export class UserFormComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      name:  ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      address: this.fb.group({
        city: ['', Validators.required],
        zip:  ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      }),
      phones: this.fb.array([]),
    }, { validators: this.passwordMatchValidator });
  }

  get email()  { return this.form.get('email')!; }
  get phones() { return this.form.get('phones') as FormArray; }

  addPhone()         { this.phones.push(this.fb.control('', Validators.required)); }
  removePhone(i: number) { this.phones.removeAt(i); }

  passwordMatchValidator(group: AbstractControl) {
    const pass    = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

---

## Interview Questions

### Q1: What is the difference between `Subject`, `BehaviorSubject`, and `ReplaySubject`?
- **Subject**: No initial value, no replay. Late subscribers miss previous emissions.
- **BehaviorSubject**: Has initial value, replays last value to new subscribers. Use for current state.
- **ReplaySubject(n)**: Replays last n values to new subscribers. Use for event history.

### Q2: What is the difference between `switchMap`, `mergeMap`, `concatMap`, `exhaustMap`?
- **switchMap**: Cancels previous inner observable. Use for search, navigation.
- **mergeMap**: All run concurrently. Use for parallel independent requests.
- **concatMap**: Queues, runs sequentially. Use for ordered operations.
- **exhaustMap**: Ignores new while current running. Use for form submit (prevent double-submit).

### Q3: How does Angular's change detection work?
Angular uses Zone.js to monkey-patch async APIs (setTimeout, Promises, events). When any async operation completes, Zone.js notifies Angular to run change detection. With `OnPush`, Angular only checks the component when inputs change by reference, events originate from it, or `markForCheck()` is called.

### Q4: What is the difference between `ViewChild` and `ContentChild`?
- `ViewChild`: Queries elements in the component's own template.
- `ContentChild`: Queries elements projected via `<ng-content>` (from parent).

### Q5: How do you prevent memory leaks in Angular?
1. Use `async` pipe (auto-unsubscribes)
2. `takeUntil(this.destroy$)` pattern
3. `take(1)` for one-time subscriptions
4. `ngOnDestroy` to complete subjects
5. Avoid storing subscriptions without cleanup
