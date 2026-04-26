# HTML & CSS Interview Questions

## HTML — Easy

### Q1: What is the difference between `<div>` and `<span>`?
- `<div>`: **block-level** — takes full width, starts on new line. Use for layout sections.
- `<span>`: **inline** — only as wide as content, flows with text. Use for styling text portions.

```html
<div>Block element — full width</div>
<p>Text with <span style="color:red">inline span</span> inside.</p>
```

### Q2: What is the difference between `id` and `class`?
- `id`: unique per page, higher specificity (1,0,0), used for JS targeting and anchor links
- `class`: reusable on multiple elements, lower specificity (0,1,0), used for styling groups

### Q3: What does `<!DOCTYPE html>` do?
Tells the browser to render in **standards mode** (not quirks mode). Without it, browsers may use legacy rendering behavior. Always include as the first line.

### Q4: What is the difference between `<script>`, `<script defer>`, and `<script async>`?
```html
<!-- Blocks HTML parsing until script downloads + executes -->
<script src="app.js"></script>

<!-- Downloads in parallel, executes AFTER HTML parsed, in order -->
<script defer src="app.js"></script>

<!-- Downloads in parallel, executes AS SOON AS downloaded (may be out of order) -->
<script async src="analytics.js"></script>
```
Use `defer` for most scripts. Use `async` for independent scripts (analytics, ads).

---

## HTML — Medium

### Q5: What are data attributes and when do you use them?
```html
<button data-user-id="42" data-action="delete" data-confirm="true">Delete</button>

<script>
const btn = document.querySelector('button');
btn.dataset.userId;   // "42"
btn.dataset.action;   // "delete"
btn.dataset.confirm;  // "true"

// CSS can also use them
// [data-action="delete"] { color: red; }
</script>
```
Use for: storing extra data on elements, JS hooks without classes, configuration.

### Q6: What is the difference between `<input type="submit">` and `<button type="submit">`?
- `<input type="submit">`: self-closing, text-only, less styleable
- `<button type="submit">`: can contain HTML (icons, spans), more styleable, default type inside form is `submit`

Always specify `type` on buttons inside forms to avoid accidental submission.

### Q7: What is the `tabindex` attribute?
Controls keyboard focus order:
- `tabindex="0"`: element is focusable in natural DOM order
- `tabindex="-1"`: focusable via JS (`el.focus()`) but not via Tab key
- `tabindex="1+"`: explicit order (avoid — creates confusing UX)

```html
<div role="button" tabindex="0" onclick="..." onkeydown="...">Custom button</div>
```

### Q8: What is the difference between `<picture>` and `<img>`?
```html
<!-- img: single source -->
<img src="photo.jpg" alt="Photo">

<!-- picture: multiple sources, browser picks best -->
<picture>
  <source media="(min-width: 1024px)" srcset="large.webp" type="image/webp">
  <source media="(min-width: 768px)"  srcset="medium.webp" type="image/webp">
  <img src="small.jpg" alt="Photo" loading="lazy">
</picture>
```
Use `<picture>` for art direction (different crops) or format negotiation (WebP/AVIF with JPEG fallback).

---

## HTML — Hard

### Q9: How does the browser's critical rendering path work?
```
1. Parse HTML → DOM tree
2. Parse CSS → CSSOM tree
3. Combine → Render tree (only visible nodes)
4. Layout (Reflow) → calculate positions/sizes
5. Paint → fill pixels per layer
6. Composite → combine layers (GPU)

Optimizations:
- Inline critical CSS (above-the-fold)
- defer/async scripts
- Preload key resources: <link rel="preload" href="font.woff2" as="font">
- Preconnect to origins: <link rel="preconnect" href="https://api.example.com">
- Lazy load images: loading="lazy"
```

### Q10: What is the difference between `preload`, `prefetch`, and `preconnect`?
```html
<!-- preload: high priority, needed for current page -->
<link rel="preload" href="/fonts/inter.woff2" as="font" crossorigin>
<link rel="preload" href="/critical.css" as="style">

<!-- prefetch: low priority, needed for NEXT navigation -->
<link rel="prefetch" href="/next-page.html">
<link rel="prefetch" href="/next-page-data.json">

<!-- preconnect: establish connection early (DNS + TCP + TLS) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://api.example.com">
```

---

## CSS — Easy

### Q11: What is the CSS box model?
Every element is a box: content → padding → border → margin. With `box-sizing: border-box`, width includes padding and border (recommended). With `content-box` (default), width is content only.

### Q12: What is CSS specificity?
Specificity determines which rule wins when multiple rules target the same element:
- Inline styles: 1,0,0,0
- ID selectors: 0,1,0,0
- Class/attribute/pseudo-class: 0,0,1,0
- Element/pseudo-element: 0,0,0,1
- `!important` overrides all

```css
#nav .link { color: red; }    /* 0,1,1,0 */
.nav a.link { color: blue; }  /* 0,0,2,1 — wins! */
```

### Q13: What is the difference between `position: relative`, `absolute`, `fixed`, `sticky`?
- `relative`: offset from normal position, still in flow
- `absolute`: removed from flow, positioned relative to nearest positioned ancestor
- `fixed`: removed from flow, positioned relative to viewport, stays on scroll
- `sticky`: in flow until scroll threshold, then acts like fixed

---

## CSS — Medium

### Q14: What is a BFC (Block Formatting Context) and why does it matter?
A BFC is an isolated rendering region. Created by: `overflow: hidden/auto/scroll`, `display: flex/grid/inline-block`, `position: absolute/fixed`, `float`.

Benefits:
- Contains floats (clearfix alternative)
- Prevents margin collapse
- Isolates from external floats

```css
/* Clearfix using BFC */
.container { overflow: hidden; }

/* Modern clearfix */
.container::after { content: ''; display: table; clear: both; }
```

### Q15: How does Flexbox differ from Grid?
- **Flexbox**: one-dimensional (row OR column). Best for components, navigation, centering.
- **Grid**: two-dimensional (rows AND columns). Best for page layouts, complex positioning.

```css
/* Flexbox: distribute items in a row */
.nav { display: flex; justify-content: space-between; align-items: center; }

/* Grid: full page layout */
.page {
  display: grid;
  grid-template-areas: "header" "main" "footer";
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
```

### Q16: What is the difference between `em`, `rem`, `vw`, `vh`, `%`?
```css
/* em: relative to parent's font-size (compounds in nesting) */
.parent { font-size: 20px; }
.child  { font-size: 1.5em; }  /* 30px */
.grandchild { font-size: 1.5em; } /* 45px — compounds! */

/* rem: relative to root (html) font-size — predictable */
html { font-size: 16px; }
.any { font-size: 1.5rem; } /* always 24px */

/* vw/vh: viewport percentage */
.hero { height: 100vh; width: 100vw; }

/* %: relative to parent's same property */
.child { width: 50%; } /* 50% of parent's width */

/* clamp: responsive without media queries */
h1 { font-size: clamp(1.5rem, 4vw, 3rem); }
```

---

## CSS — Hard

### Q17: What triggers reflow vs repaint vs composite?
```
Reflow (Layout) — most expensive, cascades to children:
  width, height, margin, padding, font-size, display,
  adding/removing elements, reading offsetWidth/scrollTop

Repaint — less expensive:
  color, background, box-shadow, border-color, visibility

Composite only — cheapest (GPU):
  transform, opacity

// Optimization: batch DOM reads/writes
// BAD: interleaved read/write causes layout thrashing
for (const el of elements) {
  el.style.width = el.offsetWidth + 10 + 'px'; // read then write in loop
}

// GOOD: batch reads, then batch writes
const widths = elements.map(el => el.offsetWidth);
elements.forEach((el, i) => { el.style.width = widths[i] + 10 + 'px'; });
```

### Q18: How do CSS custom properties (variables) differ from preprocessor variables?
```css
/* CSS custom properties: runtime, cascading, JS-accessible */
:root { --color-primary: #2563eb; }
.dark { --color-primary: #60a5fa; }  /* override in dark mode */

.btn { background: var(--color-primary); }

/* JS can read/write */
document.documentElement.style.setProperty('--color-primary', '#ff0000');
getComputedStyle(el).getPropertyValue('--color-primary');

/* SCSS variables: compile-time, no cascade, no JS access */
$color-primary: #2563eb;
.btn { background: $color-primary; }
```

### Q19: What is the `contain` property and when do you use it?
```css
/* contain: tells browser this element is independent */
.widget {
  contain: layout;   /* layout changes don't affect outside */
  contain: paint;    /* painting is clipped to element */
  contain: strict;   /* layout + paint + size */
  contain: content;  /* layout + paint (recommended) */
}

/* Use for: widgets, cards, repeated items in lists */
/* Benefit: browser can skip reflow/repaint of unrelated elements */
```

### Q20: How do you implement a CSS-only dark mode?
```css
:root {
  --bg: #ffffff;
  --text: #0f172a;
  --border: #e2e8f0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f172a;
    --text: #f1f5f9;
    --border: #334155;
  }
}

/* Manual toggle via data attribute */
[data-theme="dark"] {
  --bg: #0f172a;
  --text: #f1f5f9;
}

/* JS toggle */
document.documentElement.setAttribute('data-theme',
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
);
```
