# ADR-0004: Dev-Only Testing & Linting Toolchain

- **Status**: Accepted
- **Date**: 2026-11-10

## Context

While the production web application must remain 100% pure Vanilla JS with zero runtime dependencies, maintaining a senior full-stack standard requires automated linting, formatting, unit tests, DOM tests, and real-browser End-to-End (E2E) + visual regression tests.

## Decision

Adopt a minimal, industry-standard **dev-only** toolchain in `package.json` (`devDependencies` only; `"dependencies": {}` remains empty):

1. **Unit & Integration Test Runner**: Node.js built-in `node:test` and `node:assert/strict` (zero external runner dependency).
2. **Fast DOM Environment**: `happy-dom` for testing view rendering andXSS escaping in Node.js in milliseconds.
3. **Real-Browser E2E & Visual Regression**: `@playwright/test` running headless Chromium across Desktop (`1280×800`) and Mobile Pixel (`412×915`) viewports.
4. **Code Quality**: `eslint` (flat config `eslint.config.js`) and `prettier`.

## Consequences

- **Positive**:
  - Zero bytes of third-party code are shipped to the browser (`app/` has zero `node_modules` references).
  - Unit tests run instantaneously via `node --test`.
  - Playwright catches CSS layout regressions and mobile viewport bugs before code ever reaches `main`.
