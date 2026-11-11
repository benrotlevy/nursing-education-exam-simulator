# 11 — Performance Standard & Budgets

## 1. Asset Size Budgets

To guarantee sub-second interactive load times on both desktop broadband and mobile 4G connections:

| Asset Category                               | Uncompressed Budget | Gzip / Brotli Transfer Budget | Notes                                                     |
| -------------------------------------------- | ------------------- | ----------------------------- | --------------------------------------------------------- |
| `app/index.html`                             | `≤ 25 KB`           | `≤ 7 KB`                      | Semantic shell only (down from 143 KB in v1)              |
| Total CSS (`app/styles/**/*.css`)            | `≤ 45 KB`           | `≤ 10 KB`                     | Modular stylesheets                                       |
| Total Application JS (`app/js/**/*.js`)      | `≤ 60 KB`           | `≤ 18 KB`                     | Pure Vanilla ES modules, zero framework overhead          |
| Question Dataset (`app/data/questions.json`) | `≤ 3.6 MB`          | `≤ 750 KB`                    | Slimmed JSON (down from 4.41 MB in v1; cached by browser) |

---

## 2. Core Web Vitals Targets

| Metric                              | Target    | Strategy                                                                                                                                   |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Largest Contentful Paint (LCP)**  | `< 1.8 s` | Render the app header, navigation, and setup skeleton immediately before `questions.json` finishes parsing.                                |
| **Interaction to Next Paint (INP)** | `< 50 ms` | All tab switches, option selections, and distractor eliminations update only the active card container—never re-rendering the entire page. |
| **Cumulative Layout Shift (CLS)**   | `< 0.02`  | Reserve fixed heights/aspect-ratios for header badges, question meta bars, and bottom navigation bar (`padding-bottom: 76px` on mobile).   |

---

## 3. Runtime Efficiency Rules

1. **Non-Blocking Data Load**:
   - `questions.json` is fetched asynchronously via `fetch('data/questions.json')` instead of blocking `<head>` or `<body>` parsing with a 4.4 MB synchronous `<script src="questions.js">`.
2. **O(1) Question & Quarantine Lookups**:
   - Index questions by `id` in a `Map` on load so restoring saved exams or mistakes is `O(1)` per ID rather than repeated `O(N)` array scans.
3. **Scoped DOM Updates**:
   - Updating an option state or toggling a flag updates only the question view region, avoiding layout thrashing.
   - In Exam Results review lists (up to 100 questions), render efficiently in a single batch write.
