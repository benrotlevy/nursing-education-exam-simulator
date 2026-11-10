# 03 — JavaScript Coding Standards

## 1. Language Level & Module System

- **Standard**: ECMAScript 2022+ (`ES2022`) running natively in modern browsers and Node.js 20+.
- **Strict ES Modules**: Every file is a native ES module (`import` / `export`).
  - Use **named exports** (`export function ...`, `export const ...`) everywhere. Default exports are prohibited because they harm refactoring and auto-imports.
  - Always include the `.js` file extension in relative import paths (required by native browser ES modules):
    ```js
    // GOOD
    import { shuffleArray } from '../domain/shuffle.js';

    // BAD (fails in browser without a bundler)
    import { shuffleArray } from '../domain/shuffle';
    ```
- **Zero Globals**: Never attach functions or state to `window` (no `window.switchTab`, no `window.EXAM_QUESTIONS`). The only exception is an optional read-only debug hook in `main.js` when `?debug=1` is present.

---

## 2. Variables, Immutability & Functions

- Use `const` by default. Use `let` only when a binding must be reassigned (e.g., loop counters or accumulators). `var` is forbidden.
- **Immutability in Domain & Store**: Never mutate state objects or arrays in place across module boundaries. Return new objects/arrays (`{ ...prev, ... }`, `new Set(prev)`).
- **Pure Domain Functions**: Functions in `app/js/domain/` must be deterministic given their inputs. If randomness or current time is needed, accept default parameters:
  ```js
  export function shuffleArray(items, rng = Math.random) { ... }
  export function createSavedExam(source, questions, now = Date.now) { ... }
  ```
- **Size Limits**:
  - Single function: **≤ 50 lines** of logic (excluding JSDoc comments).
  - Single file: **≤ 300 lines**. If a file grows larger, split it by responsibility.

---

## 3. Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Variables & parameters | `camelCase` | `currentIndex`, `selectedCategory` |
| Booleans | `is*`, `has*`, `can*`, `should*` | `isVerified`, `hasMistakes`, `isEliminated` |
| Functions & methods | `camelCase` (verb-first) | `calculateExamScore()`, `parseExplanation()` |
| Constants (module/config) | `UPPER_SNAKE_CASE` | `MAX_SAVED_EXAMS`, `STORAGE_KEYS` |
| Classes / Constructors | `PascalCase` | `SafeHtml`, `QuestionRepository` |

---

## 4. Type Safety via JSDoc

Because we ship zero-build Vanilla JS, we document data structures and public module signatures with **JSDoc** in `app/js/domain/` and `app/js/core/`:

```js
/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} source
 * @property {string} category
 * @property {string} question
 * @property {string[]} options
 * @property {number} correctIndex
 * @property {boolean} verified
 * @property {string} shortExplanation
 * @property {string} detailedExplanation
 */
```

---

## 5. DOM Manipulation & XSS Prevention

- **Never interpolate untrusted or dynamic strings into raw `innerHTML`.**
- All HTML rendering must use the `html` tagged template literal from `app/js/ui/dom.js`, which escapes `&`, `<`, `>`, `"`, and `'` automatically on every interpolated expression, unless explicitly wrapped in `raw()` for pre-escaped child templates:
  ```js
  import { html, render } from '../../ui/dom.js';

  const view = html`<div class="q-text">${question.question}</div>`;
  render(containerEl, view);
  ```
- Simple text updates on a single leaf element may use `element.textContent = value`.

---

## 6. Event Handling (Declarative Delegation)

- **Zero Inline Event Handlers**: `onclick="..."`, `onchange="..."`, and `oninput="..."` attributes in HTML or templates are strictly forbidden (enforced by ESLint/tests and CSP).
- Use `data-action` and `data-*` payload attributes handled by the central delegator in `app/js/core/events.js`:
  ```html
  <button type="button" data-action="exam:select-option" data-option-index="2">...</button>
  ```

---

## 7. Error Handling & User Feedback

- **No Blocking Native Popups**: `window.alert()`, `window.confirm()`, and `window.prompt()` are forbidden in application code.
  - Use `showToast(message)` from `ui/toast.js` for non-blocking status feedback.
  - Use ` await showConfirmDialog({ title, message, confirmText, cancelText })` from `ui/dialog.js` for confirmations.
- **Storage & Network Resilience**: All calls to `localStorage`, `sessionStorage`, `fetch`, `navigator.clipboard`, and Firebase must be wrapped in `try / catch` inside their respective service/adapter modules and degrade gracefully.
