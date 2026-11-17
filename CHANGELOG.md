# Changelog

All notable changes to the **Clinical Preceptorship Nursing Exam Simulator** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.0] - 2026-11-17

### Added

- **Invite-Only Access Control & Key-Gated Encrypted Question Catalog (`ACCESS-SEC`)**:
  - Added isomorphic Web Crypto AES-256-GCM encryption/decryption (`app/js/services/catalog-crypto.js`) and CLI tool `npm run encrypt:questions` (`tools/encrypt-questions.js`), encrypting all 1,079 questions into `app/data/questions.enc.json` while extracting 10 representative sample questions into `app/data/questions-demo.json`.
  - Excluded plaintext `app/data/questions.json`, `data-pipeline/source/clean_questions.json`, and local `.secrets/` from git tracking via `.gitignore` and added CI-safe test fixtures (`tests/helpers/load-test-questions.js`).
  - Updated `firestore.rules` with `/allowed_users/{email}`, `/app_config/catalog_key`, `/app_config/contact`, and `isAuthorizedUser()` enforcement on `/users/{userId}` and `/question_reports/{reportId}`, verified by Invariant H in `tests/integration/firestore-rules.test.js`.
  - Built `app/js/domain/access-control.js`, `app/js/services/access-control-service.js`, and `app/js/features/auth/demo-banner-view.js` with 10-question Guest/Pending Demo Mode (allowing Study Mode and 10-question mini-exam), automatic first-sign-in `PENDING` registration, 1-time Telegram push notification alerts (updating `tools/cloudflare-worker-telegram.js` with backward-compatible fallback), optional Admin Telegram chat link (`https://t.me/...`), and offline PWA key caching under `nursing_access_approval_v1`.
  - Upgraded Admin Dashboard (`app/js/features/report-issue/admin-reports-view.js` and `report-controller.js`) with a 2-tab switcher (`🚩 דיווחי שאלות` | `👥 משתמשים מורשים`), 1-tap `✅ אשר גישה` / `🚫 השהה גישה` / `🗑️ הסר` actions, manual add-user form, and Cloud Encryption Key + Telegram Contact URL configuration panel.
  - Bumped Service Worker cache (`app/sw.js`) to `nursing-exam-sim-v2.4.0` to precache `questions-demo.json`, `questions.enc.json`, and all new modules, and verified across unit (`tests/unit/access-control.test.js`, `tests/unit/catalog-crypto.test.js`), DOM (`tests/dom/report-issue.test.js`), and cross-viewport Playwright E2E (`tests/e2e/access-control.spec.js`) suites.

---

## [2.3.0] - 2026-11-15

### Added

- **Full Offline-Capable Progressive Web App (`PWA`)**:
  - Added RTL Hebrew Web App Manifest (`app/manifest.webmanifest`) configured for `display: "standalone"`, `start_url: "./"`, `dir: "rtl"`, `lang: "he"`, and generated standard (`192x192`, `512x512`, `icon.svg`), `maskable` (`512x512`), and iOS (`apple-touch-icon.png`) icons under `app/icons/`.
  - Implemented Network-First Service Worker (`app/sw.js`) pre-caching all app shell assets, stylesheets, ES modules, icons, and `app/data/questions.json` under versioned cache `nursing-exam-sim-v2.3.0`, evicting legacy caches on activation, and bypassing external Firebase Auth/Firestore, Google Fonts, and Cloudflare Worker origins.
  - Added `app/js/services/pwa.js` (`createPwaService`) wiring Service Worker registration, `beforeinstallprompt` dismissible split-pill install banner (`#pwaInstallBanner` / `#btnInstallPwa` / `#btnDismissInstallPwa` persisted via `nursing_pwa_install_dismissed_v1`), standalone detection, and `appinstalled` toast feedback in `app/js/main.js` and `app/index.html`.
  - Updated `app/index.html` Content-Security-Policy with `manifest-src 'self'; worker-src 'self';`, added standard `<meta name="mobile-web-app-capable" content="yes">` alongside `apple-mobile-web-app-capable` to eliminate browser deprecation warnings, added `.webmanifest` MIME type in `tools/serve.js`, configured `app/sw.js` linting in `eslint.config.js`, and added automated verification in `tests/unit/pwa.test.js` and `tests/e2e/pwa-offline.spec.js`.

### Fixed

- **Offline Question Reporting & Sync Status Indicator Safeguards (`PWA-OFFLINE`)**:
  - Updated `app/js/services/report-service.js` and `app/js/features/report-issue/report-dialog-view.js` so offline or hanging Firestore/webhook report submissions fail cleanly within `writeTimeoutMs` with a clear Hebrew offline message instead of freezing the UI, while keeping Cancel (`#reportCancelBtn`) and Close (`#reportDialogCloseBtn`) responsive at all times.
  - Updated `app/js/services/cloud-sync.js`, `app/js/features/auth/auth-view.js`, `app/js/features/auth/auth-controller.js`, `app/styles/components/badges.css`, and `app/styles/features/stats.css` to track browser `online`/`offline` transitions and Firestore error states so `#syncStatusIndicator` and Statistics sync sub-labels accurately show `'📴 מצב לא מקוון (נשמר מקומית)'` and `'⚠️ שגיאת סנכרון (נשמר מקומית)'` instead of staying green `'☁️ סנכרון ענן פעיל'`.

- **Cross-Device Saved Exam Release Synchronization (`SYNC-04`)**:
  - Replicated `releasedSavedExams` deletion tombstones to Firestore (`/users/{userId}`) in `app/js/services/cloud-sync.js` and `firestore.rules` (up to 200 keys), merged remote tombstones across devices using monotonic max timestamps in `app/js/domain/sync-merge.js`, added clock-skew-safe release/reserve timestamps in `app/js/features/saved-exams/saved-exams-controller.js`, and preserved `releasedSavedExams` across `storage.saveProgress()` callers.

---

## [2.2.0] - 2026-11-15

### Added

- **Question Issue Reporting (`RPT-01`, `RPT-02`)**:
  - Added **"🚩 דווח על טעות"** report triggers in Active Exam Mode (`#btnReportExamQuestion`), Study Mode (`#btnReportStudyQuestion`), and Exam Results review cards.
  - Built accessible `<dialog>` modal (`app/js/features/report-issue/report-dialog-view.js`) requiring Google Sign-In (`request.auth != null`) with issue categories (`KEY_ERROR`, `EXPLANATION_ERROR`, `TYPO_TEXT`, `OUTDATED`, `OTHER`), 3–1,000 character validation with live counter, and non-blocking toast feedback.
  - Added pure domain validation, payload builder, filtering, and admin formatting utilities in `app/js/domain/question-report.js` (`tests/unit/question-report.test.js`).

- **Firestore-Backed Admin Moderation Dashboard (`RPT-03`, `RPT-SEC`)**:
  - Enforced server-side Firestore security rules in `firestore.rules` allowing signed-in users to create schema-validated `/question_reports` documents while restricting `read`, `update`, and `delete` exclusively to verified administrators (`benjaminrotlevy@gmail.com`, `benjamin@rotlevy.com`), verified by Invariant G in `tests/integration/firestore-rules.test.js`.
  - Added header Admin trigger (`#btnAdminReports`) with live `onSnapshot` unresolved counter badge (`#adminReportsBadge`), status filter tabs (`OPEN`, `RESOLVED`, `DISMISSED`, `ALL`), expandable question preview, one-click clipboard copy (`📋 העתק לצורך תיקון`), resolve/dismiss/reopen/delete actions, and XSS-safe rendering (`tests/dom/report-issue.test.js`, `tests/e2e/report-issue.spec.js`).

- **Secret-Safe Instant Telegram Push Alerts (`RPT-04`)**:
  - Created Cloudflare Worker relay (`tools/cloudflare-worker-telegram.js`) keeping `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` strictly in encrypted edge environment secrets, with origin allowlist, `QUESTION_ISSUE_REPORT` payload contract (`questionPreview`), and HTML escaping.
  - Configured live Worker webhook endpoint (`TELEGRAM_WEBHOOK_URL`) in `app/js/config.js`, tightened `app/index.html` CSP `connect-src`, and documented setup in `docs/guides/TELEGRAM_NOTIFICATIONS_SETUP.md`.

### Fixed

- **Report Modal Category Selection & Admin Top-Layer Stacking**:
  - Added distinct active styling and `✓` selection indicator for `.pill-badge.active` / `[aria-pressed='true']` issue category buttons (`app/styles/components/forms.css`, `app/styles/features/report-issue.css`).
  - Promoted `#appToastContainer` using native Top Layer `popover="manual"` (`app/index.html`, `app/js/ui/toast.js`, `app/styles/components/toast.css`) so copy/resolve/dismiss toast notifications always render crisply above active `<dialog>` modals and their blurred `::backdrop`, and wired `danger: true` / `confirmText` for Admin report deletion (`app/js/features/report-issue/report-controller.js`).

---

## [2.1.5] - 2026-11-12

### Fixed

- **Offline Saved Exam Release Tombstone Tracking (`SYNC-01`, `SYNC-04`)**:
  - Implemented `releasedSavedExams` tombstone tracking in client state (`store.js`) and persistent browser storage (`storage.js`) to record release timestamps when exams are released from the saved quarantine pool.
  - Refactored `mergeCloudAndLocalProgress` in `app/js/domain/sync-merge.js` to cross-reference `remote.savedExams` against local release tombstones, discarding exams released offline after their `savedAt` timestamp instead of letting stale remote arrays unconditionally overwrite offline deletions.
  - Immediately pushes the reconciled, clean `savedExams` list to Firestore upon re-authentication, preventing resurrected exams from lingering across devices.
  - Maintained strict conformance with Firestore security rules (`hasOnlyAllowedFields`), keeping tombstones exclusively client-side.
  - Added automated integration test in `tests/integration/cloud-sync-resilience.test.js` verifying offline release reconciliation and cloud update.

---

## [2.1.4] - 2026-11-12

### Fixed

- **Immediate Cloud Push for Offline Progress on Re-Authentication (`SYNC-04`)**:
  - Removed the `isReceivingRemoteUpdate` lock in `app/js/services/cloud-sync.js` that was erroneously aborting `schedulePush()` calls executed immediately after `applyRemotePayload()` on user sign-in.
  - Guarantees that any mistakes or exam progress recorded while signed out or offline are merged with existing cloud data and promptly pushed to Firestore so other connected browsers update in real-time.
  - Added automated integration test in `tests/integration/cloud-sync-resilience.test.js` validating the full offline-to-sign-in merge and push lifecycle.

---

## [2.1.3] - 2026-11-12

### Added

- **Automatic Online Reconnection Sync Trigger (`SYNC-04`)**:
  - Registered native `window.addEventListener('online', ...)` in `app/js/services/cloud-sync.js` to immediately schedule a cloud push whenever network connectivity is restored, ensuring offline progress syncs to Firestore without waiting for user interaction or page reload.
  - Added unit test in `tests/integration/cloud-sync-resilience.test.js` validating automatic flush on `'online'` event.

---

## [2.1.2] - 2026-11-12

### Added

- **Interactive Auth Lifecycle Playwright E2E Suite (`tests/e2e/auth-flow.spec.js`)**:
  - Full automated end-to-end verification of Google Sign-in and Sign-out lifecycle across all 4 target devices: Laptop, Tablet, Pixel 10 Pro XL, and Galaxy S25.
  - Verifies `#btnGoogleSignIn` hiding, `#userPill` appearance with authenticated name and avatar, toast notifications, Statistics dashboard active badge sync, and clean sign-out reversion.
- **Mobile Redirect Fallback in Cloud Sync Service**:
  - Added modular support for `signInWithRedirect` and `getRedirectResult` in `app/js/services/cloud-sync.js` to automatically fall back when mobile browsers block popups (`auth/popup-blocked`).
  - Added unit test in `tests/integration/cloud-sync.test.js` validating redirect fallback.

---

## [2.1.1] - 2026-11-12

### Fixed

- **RTL Bidirectional Isolation for Statistics Cloud Sync Banner**:
  - Resolved BiDi algorithm inversion in `app/js/features/auth/auth-view.js` where adjacent LTR text runs (the English brand `Google:` and user Latin display names or email addresses) merged, pushing the word `Google:` to the opposite side of the user's name.
  - Wrapped `Google` and user `displayLabel` in `<bdi>` elements (`<bdi>Google</bdi>:` and `<bdi class="user-display-name">...`) ensuring strict directional boundary isolation and natural RTL progression: `☁️ מחובר לחשבון Google: <שם/אימייל> • סנכרון ענן פעיל`.
- **Saved Exams Quarantine Slot Metric Layout**:
  - Enforced `direction: ltr; unicode-bidi: isolate;` on `.saved-metric-num` in `app/styles/features/saved-exams.css` preventing slash fractions (e.g. `2 / 3`) from visually flipping to `3 / 2` in RTL layout.

### Added

- Added `tests/e2e/auth-stats-rtl.spec.js` automated Playwright E2E suite verifying bidirectional text layout and element ordering across all 4 target devices: Laptop (`1440×900`), Tablet (`768×1024`), Pixel 10 Pro XL (`448×998`), and Galaxy S25 (`360×780`).
- Added unit/DOM assertion in `tests/dom/auth-view.test.js` validating bidirectional `<bdi>` DOM tags and XSS safety in `#statsCloudSyncInfo`.

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
- **Toast Notification Mobile Responsiveness**: Fixed long toast messages (e.g., saving full exams with 70+ character titles) cutting off past screen edges on mobile viewports like Pixel 10 Pro XL. Enabled responsive text wrapping (`white-space: normal`, `word-break: break-word`), viewport container bounds, 18px rounded card styling, and elevated mobile bottom placement (`bottom: 84px`) to guarantee zero collision with the mobile bottom navigation bar; added `tests/e2e/saved-exam-toast.spec.js` running across all 4 supported device viewports.

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
