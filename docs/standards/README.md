# Project Engineering Standards ("The Bible")

Welcome to the engineering standards documentation for the **Clinical Preceptorship Nursing Exam Simulator (v2)**.

This directory serves as the authoritative **Project Bible**. Every architectural boundary, file placement, naming convention, coding pattern, accessibility rule, testing requirement, and deployment step is governed by these documents.

---

## 📜 The Golden Rule

> **When code and the standard disagree, either fix the code or amend the standard via an Architecture Decision Record (ADR). Never silently ignore the standard.**

---

## 📚 Table of Contents

| #   | Document                                                     | Purpose & Scope                                                                                                       |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 01  | [01-ARCHITECTURE.md](./01-ARCHITECTURE.md)                   | Layered architecture, unidirectional dependency rules, data flow, and module boundaries.                              |
| 02  | [02-FOLDER-STRUCTURE.md](./02-FOLDER-STRUCTURE.md)           | Canonical repository tree, file naming conventions, and where new features belong.                                    |
| 03  | [03-JS-STANDARDS.md](./03-JS-STANDARDS.md)                   | Vanilla ES2022+ module standards, JSDoc typing, pure functions, DOM safety, and event delegation.                     |
| 04  | [04-CSS-STANDARDS.md](./04-CSS-STANDARDS.md)                 | CSS `@layer` cascade, design tokens, logical RTL properties, BEM-lite naming, and responsive breakpoints.             |
| 05  | [05-HTML-A11Y-RTL.md](./05-HTML-A11Y-RTL.md)                 | Semantic HTML5 landmarks, Hebrew RTL rules, WCAG 2.1 AA contrast, keyboard navigation, and ARIA patterns.             |
| 06  | [06-STATE-AND-PERSISTENCE.md](./06-STATE-AND-PERSISTENCE.md) | Observable state store contract, immutable updates, storage key registry (`v2`), and cloud sync rules.                |
| 07  | [07-DATA-SCHEMA.md](./07-DATA-SCHEMA.md)                     | JSON Schema for `questions.json` v2, category enums, ID conventions, and data pipeline integrity.                     |
| 08  | [08-TESTING-STRATEGY.md](./08-TESTING-STRATEGY.md)           | Test pyramid (`node:test`, `happy-dom`, Playwright), coverage targets, and the regression-first rule.                 |
| 09  | [09-GIT-WORKFLOW.md](./09-GIT-WORKFLOW.md)                   | Branching strategy (`release/v2`, feature branches), Conventional Commits, tagging, and rollback protocol.            |
| 10  | [10-SECURITY.md](./10-SECURITY.md)                           | XSS prevention via auto-escaping templates, Content Security Policy (CSP), Firebase security, and artifact isolation. |
| 11  | [11-PERFORMANCE.md](./11-PERFORMANCE.md)                     | Asset size budgets, Web Vitals targets (LCP, INP, CLS), and data-loading optimization.                                |
| 12  | [12-DEFINITION-OF-DONE.md](./12-DEFINITION-OF-DONE.md)       | Mandatory quality gates that every branch and release must pass before merge.                                         |

---

## 🏛️ Architecture Decision Records (ADRs)

Significant technical decisions are recorded in [`docs/adr/`](../adr/):

- [ADR-0001: Pure Vanilla ES Modules Without a Bundler](../adr/0001-vanilla-es-modules-no-bundler.md)
- [ADR-0002: Deploy Only `app/` Directory to GitHub Pages](../adr/0002-deploy-app-folder-only.md)
- [ADR-0003: Storage Schema Versioning (`v2` Clean Slate)](../adr/0003-storage-schema-versioning.md)
- [ADR-0004: Dev-Only Testing & Linting Toolchain](../adr/0004-test-tooling.md)

---

## 🧪 Software Test Plan & Report (STPR)

See [`docs/STPR.md`](../STPR.md) for the complete requirement traceability matrix, test inventory, prioritized test gap analysis, and per-step test execution records.
