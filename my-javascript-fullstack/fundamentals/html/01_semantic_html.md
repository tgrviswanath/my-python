# HTML — Semantic HTML, Accessibility & SEO

## Why Semantic HTML Matters

Semantic HTML uses elements that convey **meaning** about the content, not just presentation. This benefits:
- **Accessibility**: Screen readers understand structure
- **SEO**: Search engines rank semantic content higher
- **Maintainability**: Code is self-documenting
- **Performance**: Browser rendering hints

---

## Semantic Elements

### Document Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Page description for SEO (150-160 chars)">
  <title>Page Title | Site Name</title>
  <link rel="canonical" href="https://example.com/page">
</head>
<body>
  <header>          <!-- Site header, logo, nav -->
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>

  <main>            <!-- Primary content — only ONE per page -->
    <article>       <!-- Self-contained content (blog post, news) -->
      <header>
        <h1>Article Title</h1>
        <time datetime="2024-01-15">January 15, 2024</time>
      </header>
      <section>     <!-- Thematic grouping within article -->
        <h2>Section Heading</h2>
        <p>Content...</p>
      </section>
      <aside>       <!-- Tangentially related content -->
        <h3>Related Links</h3>
      </aside>
    </article>
  </main>

  <footer>          <!-- Site footer -->
    <address>       <!-- Contact info -->
      <a href="mailto:contact@example.com">contact@example.com</a>
    </address>
  </footer>
</body>
</html>
```

### Content Elements
```html
<!-- Figures with captions -->
<figure>
  <img src="chart.png" alt="Sales chart showing 20% growth in Q4 2024">
  <figcaption>Q4 2024 Sales Performance</figcaption>
</figure>

<!-- Details/Summary (native accordion) -->
<details>
  <summary>Click to expand</summary>
  <p>Hidden content revealed on click</p>
</details>

<!-- Mark (highlighted text) -->
<p>Search results for <mark>JavaScript</mark></p>

<!-- Progress and Meter -->
<progress value="70" max="100">70%</progress>
<meter value="0.7" min="0" max="1" low="0.3" high="0.8" optimum="1">70%</meter>

<!-- Dialog (native modal) -->
<dialog id="modal">
  <h2>Modal Title</h2>
  <button onclick="document.getElementById('modal').close()">Close</button>
</dialog>
```

---

## Accessibility (ARIA)

### ARIA Roles, States, Properties
```html
<!-- Role: landmark regions -->
<div role="banner">Header</div>
<div role="navigation" aria-label="Breadcrumb">...</div>
<div role="main">Main content</div>
<div role="complementary">Sidebar</div>
<div role="contentinfo">Footer</div>

<!-- Interactive widgets -->
<button
  aria-expanded="false"
  aria-controls="dropdown-menu"
  aria-haspopup="true"
  onclick="toggleMenu(this)"
>
  Menu
</button>
<ul id="dropdown-menu" role="menu" hidden>
  <li role="menuitem"><a href="/home">Home</a></li>
</ul>

<!-- Form accessibility -->
<form>
  <div role="group" aria-labelledby="address-heading">
    <h3 id="address-heading">Shipping Address</h3>

    <label for="street">Street Address *</label>
    <input
      id="street"
      type="text"
      required
      aria-required="true"
      aria-describedby="street-error"
      autocomplete="street-address"
    >
    <span id="street-error" role="alert" aria-live="polite"></span>
  </div>
</form>

<!-- Live regions for dynamic content -->
<div aria-live="polite" aria-atomic="true" id="status">
  <!-- Updated dynamically: "3 items added to cart" -->
</div>

<!-- Skip navigation link (keyboard accessibility) -->
<a href="#main-content" class="skip-link">Skip to main content</a>
```

### Focus Management
```javascript
// Trap focus in modal
function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  });
}
```

---

## Forms & Validation

```html
<form id="signup" novalidate>
  <!-- Email with pattern -->
  <label for="email">Email *</label>
  <input
    id="email" type="email" name="email"
    required minlength="5" maxlength="254"
    autocomplete="email"
    pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
    aria-describedby="email-hint email-error"
  >
  <span id="email-hint">We'll never share your email</span>
  <span id="email-error" role="alert"></span>

  <!-- Password with strength indicator -->
  <label for="password">Password *</label>
  <input
    id="password" type="password" name="password"
    required minlength="8"
    autocomplete="new-password"
    aria-describedby="password-requirements"
  >
  <ul id="password-requirements" aria-label="Password requirements">
    <li id="req-length">At least 8 characters</li>
    <li id="req-upper">One uppercase letter</li>
    <li id="req-number">One number</li>
  </ul>

  <!-- File upload -->
  <label for="avatar">Profile Picture</label>
  <input
    id="avatar" type="file" name="avatar"
    accept="image/jpeg,image/png,image/webp"
    aria-describedby="avatar-hint"
  >
  <span id="avatar-hint">JPEG, PNG or WebP, max 2MB</span>

  <button type="submit">Create Account</button>
</form>

<script>
// Constraint Validation API
const form = document.getElementById('signup');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.checkValidity()) {
    // Show custom error messages
    Array.from(form.elements).forEach(field => {
      if (!field.validity.valid) {
        showError(field);
      }
    });
    return;
  }
  submitForm(new FormData(form));
});

function showError(field) {
  const errorEl = document.getElementById(`${field.id}-error`);
  if (!errorEl) return;
  const { validity } = field;
  if (validity.valueMissing) errorEl.textContent = 'This field is required';
  else if (validity.typeMismatch) errorEl.textContent = 'Please enter a valid value';
  else if (validity.tooShort) errorEl.textContent = `Minimum ${field.minLength} characters`;
  else if (validity.patternMismatch) errorEl.textContent = field.title || 'Invalid format';
}
</script>
```

---

## SEO Best Practices

```html
<!-- Open Graph (social sharing) -->
<meta property="og:title" content="Page Title">
<meta property="og:description" content="Description">
<meta property="og:image" content="https://example.com/og-image.jpg">
<meta property="og:url" content="https://example.com/page">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page Title">
<meta name="twitter:image" content="https://example.com/twitter-image.jpg">

<!-- Structured Data (JSON-LD) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": { "@type": "Person", "name": "Author Name" },
  "datePublished": "2024-01-15",
  "image": "https://example.com/article-image.jpg"
}
</script>

<!-- Performance hints -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preload" href="/critical.css" as="style">
<link rel="prefetch" href="/next-page.html">
<link rel="dns-prefetch" href="//api.example.com">
```

---

## Interview Questions

### Q1: What is the difference between `<section>`, `<article>`, and `<div>`?
**Answer:**
- `<article>`: Self-contained, independently distributable content (blog post, news article, comment). Makes sense on its own.
- `<section>`: Thematic grouping of content, typically with a heading. Part of a larger whole.
- `<div>`: Generic container with no semantic meaning. Use only when no semantic element fits.

Rule: Ask "Would this make sense syndicated on its own?" → `<article>`. "Is this a thematic group?" → `<section>`. Otherwise → `<div>`.

### Q2: What is ARIA and when should you use it?
**Answer:**
ARIA (Accessible Rich Internet Applications) adds semantic meaning to elements that lack native semantics. **First rule of ARIA**: Don't use ARIA if a native HTML element can do the job.

```html
<!-- Bad: ARIA on native element -->
<button role="button">Click</button>

<!-- Good: native semantics -->
<button>Click</button>

<!-- Good: ARIA for custom widget -->
<div role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0">
```

### Q3: What is the difference between `alt=""` and omitting `alt`?
**Answer:**
- `alt=""` (empty): Image is decorative, screen readers skip it
- `alt="description"`: Meaningful image, screen readers announce it
- No `alt`: Screen readers may announce the filename — bad UX

### Q4: What are the performance implications of HTML structure?
**Answer:**
- **Critical rendering path**: HTML → DOM → CSSOM → Render Tree → Layout → Paint
- `<script>` in `<head>` blocks parsing → use `defer` or `async`
- `defer`: executes after HTML parsed, in order
- `async`: executes as soon as downloaded, may be out of order
- Inline critical CSS, lazy-load non-critical resources
- `loading="lazy"` on images below the fold

### Q5: What is the difference between `<input type="button">` and `<button>`?
**Answer:**
`<button>` is preferred:
- Can contain HTML (icons, spans)
- Default type is `submit` inside forms
- More styleable
- `<input type="button">` is self-closing, text-only

### Q6: How does the browser render HTML?
**Answer:**
1. **Parsing**: HTML → DOM tree (incremental, can be interrupted by scripts)
2. **Style calculation**: CSS → CSSOM, combined with DOM → Render Tree
3. **Layout (Reflow)**: Calculate position/size of each element
4. **Paint**: Fill in pixels for each layer
5. **Composite**: Combine layers (GPU-accelerated for transforms/opacity)

Reflow is expensive — avoid triggering it in loops. Use `transform` instead of `top/left` for animations.
