# CSS — Box Model, Specificity, Flexbox, Grid & Architecture

## The Box Model

Every element is a rectangular box with four areas:

```
┌─────────────────────────────────┐
│           MARGIN                │
│  ┌───────────────────────────┐  │
│  │         BORDER            │  │
│  │  ┌─────────────────────┐  │  │
│  │  │      PADDING        │  │  │
│  │  │  ┌───────────────┐  │  │  │
│  │  │  │    CONTENT    │  │  │  │
│  │  │  └───────────────┘  │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

```css
/* box-sizing: content-box (default) */
/* width = content only */
.box { width: 200px; padding: 20px; border: 2px solid; }
/* Actual rendered width: 200 + 40 + 4 = 244px */

/* box-sizing: border-box (recommended) */
/* width = content + padding + border */
*, *::before, *::after { box-sizing: border-box; }
.box { width: 200px; padding: 20px; border: 2px solid; }
/* Actual rendered width: 200px */
```

### Margin Collapsing
```css
/* Vertical margins collapse — only the larger one applies */
.parent { margin-bottom: 30px; }
.child  { margin-top: 20px; }
/* Gap between them: 30px (not 50px) */

/* Prevent collapse with: */
.parent { overflow: hidden; }  /* creates BFC */
.parent { display: flex; }     /* flex container */
.parent { padding-top: 1px; }  /* any padding/border */
```

---

## Specificity

Specificity is calculated as (a, b, c):
- **a**: Inline styles (1,0,0)
- **b**: IDs (0,1,0)
- **c**: Classes, attributes, pseudo-classes (0,0,1)
- Elements, pseudo-elements (0,0,1) — actually (0,0,1) for elements

```css
/* Specificity examples */
*              {}  /* 0,0,0 */
div            {}  /* 0,0,1 */
.class         {}  /* 0,1,0 */
#id            {}  /* 1,0,0 */
div.class      {}  /* 0,1,1 */
#id .class div {}  /* 1,1,1 */
style=""          /* 1,0,0,0 */
!important        /* overrides everything */

/* Specificity battle */
#nav .link { color: red; }    /* 1,1,0 */
.nav a.link { color: blue; }  /* 0,2,1 — wins! */
```

### The Cascade
Order of precedence (highest to lowest):
1. `!important` user agent declarations
2. `!important` author declarations
3. Author declarations (specificity)
4. User declarations
5. User agent (browser defaults)

---

## Flexbox Deep Dive

```css
/* Container properties */
.flex-container {
  display: flex;                    /* or inline-flex */
  flex-direction: row;              /* row | row-reverse | column | column-reverse */
  flex-wrap: nowrap;                /* nowrap | wrap | wrap-reverse */
  flex-flow: row wrap;              /* shorthand: direction + wrap */
  justify-content: flex-start;     /* main axis alignment */
  /* flex-start | flex-end | center | space-between | space-around | space-evenly */
  align-items: stretch;            /* cross axis alignment */
  /* stretch | flex-start | flex-end | center | baseline */
  align-content: flex-start;       /* multi-line cross axis */
  gap: 16px;                       /* gap: row-gap column-gap */
}

/* Item properties */
.flex-item {
  flex-grow: 0;    /* how much to grow (proportion) */
  flex-shrink: 1;  /* how much to shrink */
  flex-basis: auto; /* initial size before grow/shrink */
  flex: 1;         /* shorthand: grow shrink basis → flex: 1 1 0% */
  align-self: auto; /* override container's align-items */
  order: 0;        /* visual order (doesn't affect DOM) */
}

/* Common patterns */
/* Center anything */
.center { display: flex; justify-content: center; align-items: center; }

/* Sticky footer */
body { display: flex; flex-direction: column; min-height: 100vh; }
main { flex: 1; }

/* Equal-width columns */
.cols > * { flex: 1; }

/* Holy Grail layout */
.layout { display: flex; }
.sidebar { flex: 0 0 250px; }
.main    { flex: 1; }
```

---

## CSS Grid Deep Dive

```css
/* Container */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header header"
    "sidebar main   main"
    "footer footer footer";
  gap: 16px;
  /* column-gap: 16px; row-gap: 8px; */
}

/* Named areas */
.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.footer  { grid-area: footer; }

/* Explicit placement */
.item {
  grid-column: 1 / 3;    /* span columns 1-2 */
  grid-row: 2 / 4;       /* span rows 2-3 */
  /* shorthand: */
  grid-area: 2 / 1 / 4 / 3; /* row-start / col-start / row-end / col-end */
}

/* Auto-fill vs auto-fit */
/* auto-fill: creates empty tracks if items don't fill */
/* auto-fit: collapses empty tracks */
.responsive-grid {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

/* Subgrid (CSS Grid Level 2) */
.card-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
.card {
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid; /* align content across cards */
}
```

---

## Responsive Design

```css
/* Mobile-first approach */
.container { padding: 1rem; }

/* Tablet */
@media (min-width: 768px) {
  .container { padding: 2rem; max-width: 768px; margin: 0 auto; }
}

/* Desktop */
@media (min-width: 1024px) {
  .container { max-width: 1200px; }
}

/* Modern: container queries */
@container (min-width: 400px) {
  .card { display: flex; }
}

/* Fluid typography */
:root {
  --font-size-base: clamp(1rem, 0.5rem + 1vw, 1.25rem);
}

/* Fluid spacing */
.section { padding: clamp(2rem, 5vw, 6rem) 0; }

/* Prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f172a;
    --text: #f1f5f9;
  }
}
```

---

## Animations & Transitions

```css
/* Transitions */
.button {
  background: #2563eb;
  transition: background 200ms ease, transform 150ms ease, box-shadow 200ms ease;
}
.button:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

/* Keyframe animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card {
  animation: fadeInUp 400ms ease forwards;
  animation-delay: calc(var(--index) * 100ms); /* stagger */
}

/* Skeleton loading */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* GPU-accelerated properties (no reflow/repaint) */
/* Use: transform, opacity */
/* Avoid animating: width, height, top, left, margin, padding */
```

---

## CSS Architecture (BEM + Custom Properties)

```css
/* BEM: Block__Element--Modifier */
.card { }                        /* Block */
.card__title { }                 /* Element */
.card__image { }                 /* Element */
.card--featured { }              /* Modifier */
.card--featured .card__title { } /* Element in modified block */

/* Design tokens with CSS Custom Properties */
:root {
  /* Colors */
  --color-primary-50:  #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-900: #1e3a8a;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-8: 2rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}

/* Component using tokens */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary-500);
  color: #fff;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 200ms ease;
}
.btn:hover { background: var(--color-primary-900); }
.btn--sm { padding: var(--space-1) var(--space-2); font-size: var(--text-xs); }
```

---

## Interview Questions

### Q1: What is the difference between `display: none`, `visibility: hidden`, and `opacity: 0`?
| Property | Space | Events | Accessible |
|---|---|---|---|
| `display: none` | No | No | No |
| `visibility: hidden` | Yes | No | No |
| `opacity: 0` | Yes | Yes | Yes (still focusable) |

### Q2: What triggers reflow vs repaint?
- **Reflow (Layout)**: Changes to geometry — width, height, margin, padding, font-size, adding/removing elements. Expensive — cascades to children.
- **Repaint**: Visual changes without geometry — color, background, box-shadow. Less expensive.
- **Composite only**: transform, opacity — GPU-accelerated, cheapest.

### Q3: How does CSS specificity work with `!important`?
`!important` overrides all specificity. Two `!important` declarations → specificity wins. Avoid `!important` — use it only for utility classes or overriding third-party styles.

### Q4: What is a BFC (Block Formatting Context)?
A BFC is an isolated rendering region. Created by: `overflow: hidden/auto`, `display: flex/grid/inline-block`, `position: absolute/fixed`, `float`. Benefits: contains floats, prevents margin collapse, isolates from external floats.

### Q5: What is the difference between `em`, `rem`, `vw`, `vh`, `%`?
- `em`: relative to parent's font-size (compounds in nesting)
- `rem`: relative to root (`html`) font-size — predictable
- `vw/vh`: viewport width/height percentage
- `%`: relative to parent's corresponding property
- `clamp(min, preferred, max)`: responsive without media queries

### Q6: How do you center a div both horizontally and vertically?
```css
/* Method 1: Flexbox */
.parent { display: flex; justify-content: center; align-items: center; }

/* Method 2: Grid */
.parent { display: grid; place-items: center; }

/* Method 3: Absolute + transform */
.child { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }

/* Method 4: Margin auto (horizontal only) */
.child { width: fit-content; margin: 0 auto; }
```
