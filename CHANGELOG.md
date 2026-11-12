# Changelog

All notable changes to the **Clinical Preceptorship Nursing Exam Simulator** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-11-12

### Added

- **Version 3.0 Automated Test Suite Expansion (16 Target Requirements)**:
  - Added 11 new automated test suites covering edge cases, network resilience, accessibility, and responsive stress:
    - `tests/integration/cloud-sync-resilience.test.js` (`SYNC-04`, `SYNC-05`, `SYNC-06`)
    - `tests/integration/firestore-rules.test.js` (`SEC-04`)
    - `tests/integration/storage-quota.test.js` (`STORE-01`)
    - `tests/integration/saved-exams-defense.test.js` (`SAVED-06`)
    - `tests/dom/exam-edge-cases.test.js` (`EXAM-11`, `EXAM-12`, `EXAM-13`, `PERF-01`)
    - `tests/dom/study-filters.test.js` (`STUDY-07`)
    - `tests/dom/aria-live.test.js` (`A11Y-03`)
    - `tests/unit/exam-retry.test.js` (`EXAM-12`)
    - `tests/unit/study-navigation.test.js` (`STUDY-06`)
    - `tests/e2e/accessibility.spec.js` (`A11Y-02`)
    - `tests/e2e/responsive-stress.spec.js` (`UX-01`)
  - Automated test coverage expanded to 124 Node.js tests across 47 suites, and 48 Playwright E2E matrix specs across 4 device profiles.

### Fixed

- **Cloud Sync & Resilience**: Resolved offline network status degradation (`BUG-SYNC-01`), exposed debounced `syncPush` API (`BUG-SYNC-02`), and resolved Firestore listener & timer leaks on auth sign-out (`BUG-SYNC-03`).
- **Storage Graceful Degradation**: Added in-memory fallback and quota alert when localStorage throws `QuotaExceededError` (`BUG-STORE-01`).
- **Exam Edge Cases & Performance**: Added active exam abandon button ID (`BUG-EXAM-01`), aligned 100% score retry toast text (`BUG-EXAM-02`), and optimized 100-question batch review card rendering to `< 170ms` (`BUG-PERF-01`).
- **Accessibility & Mobile UX**: Added accessible radio inputs and keyboard event delegation (`BUG-A11Y-01`), added ARIA live status regions for toast alerts and study explanations (`BUG-A11Y-02`), and enlarged mobile touch targets to 46×46px (`BUG-UX-01`).

### Changed

- **Dependencies Upgrade**:
  - Updated all devDependencies to their latest versions: `@eslint/js` (`^10.0.1`), `@playwright/test` (`^1.65.0`), `eslint` (`^10.14.0`), `globals` (`^17.14.0`), `happy-dom` (`^21.0.4`), and `prettier` (`^3.10.0`).

---

## [2.0.0] - 2026-11-11

### Added

- **Engineering Standards "Bible" & ADRs (`docs/standards/`, `docs/adr/`, `docs/STPR.md`)**:
  - Authored 12 numbered engineering standard documents (`01-ARCHITECTURE.md` through `12-DEFINITION-OF-DONE.md`), 4 Architecture Decision Records (`ADR-0001` through `ADR-0004`), and a complete Software Test Plan & Report (`docs/STPR.md`).
- **Modular Vanilla ES2022+ Application Architecture (`app/js/`)**:
  - `app/js/config.js` — Centralized schema version (`v2`), storage keys, syllabus categories, limits, and Firebase configuration.
  - `app/js/core/` — Observable state store (`store.js`), corrupt-JSON-resilient storage adapter (`storage.js`), responsive tab/screen router (`router.js`), and declarative `data-action` event delegation (`events.js`).
  - `app/js/domain/` — 9 pure, zero-DOM domain modules: `shuffle.js`, `question-pool.js`, `explanation-parser.js`, `ai-prompt.js`, `sync-merge.js`, `exam-session.js`, `study-session.js`, `saved-exams.js`, and `stats.js`.
  - `app/js/services/` — `question-repository.js`, `clipboard.js`, and dependency-injectable `cloud-sync.js`.
  - `app/js/ui/` — Auto-escaping `html` template tag (`dom.js`), non-blocking `toast.js`, accessible `<dialog>` controller (`dialog.js`), and shared `explanation-card.js`.
  - `app/js/features/` — Dedicated `<feature>-view.js` and `<feature>-controller.js` pairs for `exam`, `study`, `saved-exams`, `stats`, and `auth`.
- **Modular CSS Cascade Layer Architecture (`app/styles/`)**:
  - Extracted the 1,901-line inline `<style>` block into 16 modular CSS files governed by `@layer tokens, base, layout, components, features, utilities;`.
- **Security Hardening (`CSP` & `firestore.rules`)**:
  - Added strict `<meta http-equiv="Content-Security-Policy">` to `app/index.html` (`script-src` without `'unsafe-inline'`).
  - Added least-privilege Cloud Firestore security rules (`firestore.rules`) enforcing owner-only `/users/{userId}` access, `allow delete: if false;`, and strict field/type/size validation.
  - Added HTTPS protocol validation on user avatar URLs (`sanitizeAvatarUrl`) and full HTML escaping across all dynamic views.
- **Comprehensive 4-Layer Automated Test Pyramid (`tests/`)**:
  - **63 Unit, Data Schema, Integration, and DOM tests** (`node:test` + `happy-dom`).
  - **20 Playwright End-to-End (E2E) tests** across 4 device viewports: `laptop` (`1440×900`), `tablet` (`768×1024`), `pixel-10-pro-xl` (`448×998` @ 3x DPR), and `galaxy-s25` (`360×780` @ 3x DPR).
- **CI/CD & Artifact Isolation (`.github/workflows/`)**:
  - Updated `ci.yml` to run ESLint, Prettier, unit/integration/data/DOM tests, and Playwright E2E.
  - Added `deploy-pages.yml` to deploy exclusively the `app/` directory to GitHub Pages.

### Changed

- **Runtime Data Artifact Optimization (`tools/build-questions.js` -> `app/data/questions.json`)**:
  - Replaced synchronous `questions.js` (`4.31 MB`) with asynchronously fetched `app/data/questions.json` (`2.29 MB` — **46.7% smaller** via lossless removal of duplicate `explanation`/`aiExplanation` fields while preserving 100% of the 1,079 questions and explanations).
- **Repository Hygiene**:
  - Untracked copyrighted raw materials (`raw_materials/`) from Git history tracking while keeping local files intact, and archived ~110 historical one-off extraction scripts outside the web repository.

### Fixed

- **Latent Unvisited Question Shuffle Crash (`EXAM-07`)**:
  - Fixed a latent v1 bug where submitting an exam with unvisited questions caused a `TypeError` when reading `shuffledOptionsCache[idx].correctIndex`.
- **Cloud Sync Zombie Mistakes (`SYNC-02`)**:
  - Replaced naive set-union mistake merging with per-question monotonic timestamps and removal tombstones (`mistakeTimestamps`) so resolved mistakes are never resurrected by stale cloud documents.
- **Cloud Sync Stats Reset Propagation (`SYNC-03`)**:
  - Added `userStats.lastResetAt` timestamp tracking so resetting statistics propagates deterministically across synced devices instead of being overwritten by `Math.max`.
- **Non-Blocking Accessible Confirmation Modals (`EXAM-08`, `SAVED-05`, `STATS-04`)**:
  - Replaced blocking native `window.confirm()` and `window.alert()` calls with an accessible RTL `<dialog>` modal (`app/js/ui/dialog.js`).

---

## [1.0.0] - 2026-11-10

### Added

- Initial baseline release (`v1.0.0`, commit `8ea2295`) featuring 1,079 indexed multiple-choice questions across 6 clinical preceptorship syllabus categories, Exam Mode, Study Mode, Saved Exams Quarantine Zone (up to 3 slots), Statistics Dashboard, and Google Cloud Sync in a single-file `index.html` + `questions.js` architecture.
