# 04 — CSS & Styling Standards

## 1. Cascade Layers (`@layer`)

To eliminate specificity wars and `!important` overrides, `app/styles/main.css` declares an explicit cascade layer order at the top of the file:

```css
@layer tokens, base, layout, components, features, utilities;
```

1. **`tokens`**: CSS custom properties (`:root`) only. No element selectors.
2. **`base`**: Box-sizing reset, `html`/`body` defaults, Hebrew RTL typography (`Assistant`, `Rubik`).
3. **`layout`**: Page shell (`header`, `main`, `footer`, `.nav-tabs`, `.mobile-bottom-nav`).
4. **`components`**: Reusable UI primitives (`.btn`, `.card`, `.badge`, `.option-item`, `.expl-*`, `.app-toast`, `.app-dialog`).
5. **`features`**: Screen-specific layouts (`.exam-*`, `.study-*`, `.saved-*`, `.stats-*`).
6. **`utilities`**: Single-purpose helpers (`.u-hidden`, `.u-sr-only`, `.u-text-center`).

---

## 2. Design Tokens (`tokens.css`)

All colors, shadows, border-radii, font sizes, and z-indices must be defined in `tokens.css` and referenced via `var(--*)`. Raw hex codes outside `tokens.css` are discouraged.

### Core Token Categories

- **Brand & Accent**: `--color-primary`, `--color-primary-hover`, `--color-primary-light`, `--color-secondary`
- **Semantic Status**:
  - Success: `--color-success`, `--color-success-bg`, `--color-success-border`, `--color-success-text`
  - Danger: `--color-danger`, `--color-danger-bg`, `--color-danger-border`, `--color-danger-text`
  - Warning: `--color-warning`, `--color-warning-bg`, `--color-warning-border`, `--color-warning-text`
- **Surfaces & Text**: `--color-bg`, `--color-surface`, `--color-surface-muted`, `--color-text-main`, `--color-text-muted`, `--color-border`
- **Radii & Shadows**: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Z-Index Scale**:
  - `--z-header: 100`
  - `--z-bottom-nav: 200`
  - `--z-toast: 300`
  - `--z-dialog: 400`

---

## 3. Naming Convention (BEM-Lite)

- **Block**: `.question-card`, `.saved-slot`, `.expl-distractor`
- **Element**: `.question-card__header`, `.saved-slot__actions` (or concise hyphenated prefixes established in v1 such as `.q-header`, `.bnav-btn`, kept consistent per component).
- **Modifier / State**: `.is-active`, `.is-selected`, `.is-correct`, `.is-wrong`, `.is-eliminated`, `.is-visible` (or existing semantic modifiers `.active`, `.selected`, `.correct`, `.wrong`, `.eliminated`).

---

## 4. RTL & Logical Properties

Because the application is native Hebrew (`dir="rtl"`):

- Prefer **CSS Logical Properties** (`margin-inline-start`, `padding-inline-end`, `border-inline-start`, `inset-inline-end`, `text-align: start`) over physical `left`/`right` properties.
- Never hardcode `direction: ltr` except on technical strings such as email addresses or code/numeric badges.

---

## 5. Responsive Breakpoints

Keep media queries consolidated and consistent across component/feature stylesheets using two standard breakpoints:

| Tier              | Media Query                 | Target Devices                                                                                  |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| Desktop / Default | _(base rules)_              | Laptops, desktops, landscape tablets (`> 768px`)                                                |
| Tablet            | `@media (max-width: 768px)` | Portrait tablets & compact windows                                                              |
| Smartphone        | `@media (max-width: 640px)` | Smartphones (Pixel, Galaxy S, iPhone) — activates bottom navigation bar and mobile section pill |
| Ultra-Compact     | `@media (max-width: 420px)` | Narrow portrait viewports                                                                       |

---

## 6. Strict Rules

1. **Zero Inline Styles in HTML**: Static `style="..."` attributes in `app/index.html` are forbidden. Use semantic classes (`.u-hidden` instead of `style="display:none;"`).
2. **Dynamic Progress Bars**: Only dynamic runtime percentages (such as `style="width: ${pct}%"` on progress fill bars) are permitted to set inline styles.
3. **Avoid `!important`**: With `@layer`, `!important` should only ever appear on `.u-hidden { display: none !important; }`.
