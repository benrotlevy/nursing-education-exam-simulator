# ADR-0001: Pure Vanilla ES Modules Without a Bundler

- **Status**: Accepted
- **Date**: 2026-11-10

## Context
In v1, the entire application (CSS, HTML markup, application JS, and Firebase integration) lived inside a single 4,375-line `index.html` file. This made maintenance error-prone (e.g., stray syntax errors breaking tab switching, module scope confusion between `<script>` and `<script type="module">`).

We need a modular, senior-grade architecture for v2 while keeping the core technology stack pure Vanilla HTML, CSS, and JavaScript.

## Decision
We will use **native browser ES Modules (`<script type="module" src="./js/main.js">`)** and **native CSS `@import` + `@layer`** directly in production, with **zero bundler** (no Webpack, Vite, Rollup, or Babel build step required to run the web app).

Dev-only Node.js tools (ESLint, Prettier, `node:test`, `happy-dom`, Playwright) are used strictly for linting and automated testing.

## Consequences
- **Positive**:
  - Zero build step required to serve `app/`: what you edit in `app/js/` and `app/styles/` is the exact code running in the browser.
  - Native ES module imports work identically in Node.js 20 (`node:test`) and in modern browsers (Chrome, Safari, Firefox, Edge).
  - Zero framework lock-in or runtime bundle bloat.
- **Negative / Trade-offs**:
  - Opening `app/index.html` directly via `file://` double-click is blocked by browser CORS rules for ES modules and `fetch()`. Developers run `npm run serve` locally instead.
  - Relative import paths must always include the explicit `.js` extension.
