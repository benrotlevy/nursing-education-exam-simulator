# Software Test Plan & Report (STPR) — v2.0

- **Project**: Clinical Preceptorship Nursing Exam Simulator
- **Document Version**: 1.0 (Baseline Audit & v2 Target Plan)
- **Date**: 2026-11-10
- **Standards Reference**: [`docs/standards/08-TESTING-STRATEGY.md`](./standards/08-TESTING-STRATEGY.md)

---

## 1. Purpose & Scope

This **Software Test Plan & Report (STPR)** defines the verification strategy, requirement traceability matrix, current test coverage audit, prioritized missing test gaps, and per-step execution results for the v2 refactoring and beyond.

It serves two primary goals:

1. **Guarantee Zero Unintended Regressions**: Ensure that splitting the v1 monolith into modular HTML, CSS, and Vanilla ES modules preserves 100% of verified features.
2. **Expose & Close All Testing Gaps**: Document which tests currently exist, which only tested copied/mocked snippets in v1, and which new unit, integration, DOM, accessibility, and E2E tests are required to reach senior full-stack quality.

---

## 2. Audit of Existing (v1) Tests

Before the v2 refactor, the repository contained 4 test scripts in `scripts/`:

| v1 Script                                | What It Tested                                                                                                                                                  | Critical Limitation Found in Audit                                                                                                                 | Run in CI (`v1`)? |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `scripts/verify_database.py` & `.js`     | Checked 1,079 question count, unique IDs, 6 categories, `correctIndex` bounds, and explanation lengths.                                                         | Duplicated across both Python and JS; tested `questions.js` global script wrapper instead of pure JSON schema.                                     | Only `.py`        |
| `scripts/test_shuffle_logic.js`          | Checked Fisher-Yates shuffle and option `correctIndex` tracking over 1,000 iterations.                                                                          | **Tested a copy-pasted clone** of `shuffleArray` and `getShuffledQuestionOptions` at the top of the test file—not the actual code in `index.html`! | Yes               |
| `scripts/test_saved_exams_quarantine.js` | Checked reserving 3 exams, quarantining questions from the active pool, and releasing exams.                                                                    | **Tested a local mock implementation** written inside the test file—never invoked the actual functions in `index.html`!                            | **No**            |
| `scripts/test_app_validation.js`         | VM syntax check, DOM ID lookup, `onclick` handler existence, `switchTab`, `renderExplanationHTML`, distractor elimination, and `copyCurrentStudyQuestionForAI`. | Ran in a hand-rolled regex/VM stub without a real DOM parser or browser layout engine; **not added to `.github/workflows/ci.yml`**.                | **No**            |

---

## 3. Test Levels & Environments (v2 Target)

| Level                                                           | Tooling                            | Environment                                                                                                                                                          | Target Execution Time |
| --------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **L1 — Data Schema** (`tests/data/`)                            | `node:test` + `node:assert/strict` | Node.js 20+                                                                                                                                                          | `< 1s`                |
| **L2 — Unit (Domain)** (`tests/unit/`)                          | `node:test` + `node:assert/strict` | Node.js 20+ (Zero DOM)                                                                                                                                               | `< 1.5s`              |
| **L3 — Integration & DOM** (`tests/integration/`, `tests/dom/`) | `node:test` + `happy-dom`          | Node.js 20+ with simulated DOM & Storage                                                                                                                             | `< 3s`                |
| **L4 — End-to-End & Visual** (`tests/e2e/`)                     | `@playwright/test`                 | Headless Chromium (RTL) across 4 device viewports: **Laptop (`1440×900`)**, **Tablet (`768×1024`)**, **Pixel 10 Pro XL (`448×998`)**, and **Galaxy S25 (`360×780`)** | `< 45s`               |

---

## 4. Requirements & Traceability Matrix

### Status Legend

- ✅ **Covered (Real Code)**: Tested directly against production code.
- ⚠️ **Partial / Copy-Only in v1**: Tested only via copy-pasted logic or shallow regex in v1; must be upgraded to import real modules in v2.
- ❌ **Missing**: Not tested at all in v1; must be added.

### 4.1 Question Bank & Data Integrity (`DATA`)

| Req ID    | Requirement Description                                                                                           | Level | v1 Status | v2 Target Test File                   |
| --------- | ----------------------------------------------------------------------------------------------------------------- | ----- | --------- | ------------------------------------- |
| `DATA-01` | Dataset contains exactly 1,079 questions with unique `q_NNN` IDs.                                                 | L1    | ✅        | `tests/data/questions.schema.test.js` |
| `DATA-02` | Every question belongs to one of the 6 official syllabus categories.                                              | L1    | ✅        | `tests/data/questions.schema.test.js` |
| `DATA-03` | Every question has 3–4 non-empty distinct options and valid `correctIndex`.                                       | L1    | ✅        | `tests/data/questions.schema.test.js` |
| `DATA-04` | Every question has non-empty `shortExplanation` and `detailedExplanation` with rationale and distractor sections. | L1    | ✅        | `tests/data/questions.schema.test.js` |
| `DATA-05` | Build step strips redundant `aiExplanation` and removes internal `• מקור בספרות` lines.                           | L1    | ✅        | `tests/data/questions.schema.test.js` |

### 4.2 Randomization & Question Pool (`POOL`)

| Req ID    | Requirement Description                                                                                      | Level | v1 Status | v2 Target Test File                |
| --------- | ------------------------------------------------------------------------------------------------------------ | ----- | --------- | ---------------------------------- |
| `POOL-01` | `shuffleArray` produces a permutation without mutating the input array (supports injectable RNG).            | L2    | ✅        | `tests/unit/shuffle.test.js`       |
| `POOL-02` | `getShuffledQuestionOptions` randomizes option order and accurately updates `correctIndex` 100% of the time. | L2    | ✅        | `tests/unit/shuffle.test.js`       |
| `POOL-03` | Quarantined question IDs from saved exams are excluded from active Exam and Study pools.                     | L2    | ✅        | `tests/unit/question-pool.test.js` |
| `POOL-04` | Filtering by source, category, and `mistakesOnly` returns the exact matching subset.                         | L2    | ✅        | `tests/unit/question-pool.test.js` |
| `POOL-05` | `getAvailableFullExams` returns only sources with `>= 50` questions not already saved.                       | L2    | ✅        | `tests/unit/question-pool.test.js` |

### 4.3 Navigation & Responsive Layout (`NAV`)

| Req ID   | Requirement Description                                                                                         | Level  | v1 Status | v2 Target Test File                                                |
| -------- | --------------------------------------------------------------------------------------------------------------- | ------ | --------- | ------------------------------------------------------------------ |
| `NAV-01` | Switching between `exam`, `study`, `saved-exams`, and `stats` activates the target screen and hides all others. | L3, L4 | ✅        | `tests/integration/router.test.js`, `tests/e2e/navigation.spec.js` |
| `NAV-02` | Desktop top tabs and Mobile bottom navigation bar stay synchronized on every tab switch.                        | L3, L4 | ✅        | `tests/integration/router.test.js`, `tests/e2e/navigation.spec.js` |
| `NAV-03` | Mobile active section indicator pill displays the current section name on smartphone viewports (`<= 640px`).    | L3, L4 | ✅        | `tests/e2e/navigation.spec.js`                                     |
| `NAV-04` | Active tab is persisted in `sessionStorage` and restored across page reloads.                                   | L3, L4 | ✅        | `tests/integration/router.test.js`                                 |

### 4.4 Exam Mode (`EXAM`)

| Req ID    | Requirement Description                                                                                                                                                          | Level  | v1 Status | v2 Target Test File                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | -------------------------------------------------------------------------------- |
| `EXAM-01` | Starting an exam with count `10 / 25 / 50 / 100 / mistakes` samples the requested number of shuffled questions.                                                                  | L2, L4 | ✅        | `tests/unit/exam-session.test.js`, `tests/e2e/exam.spec.js`                      |
| `EXAM-02` | Attempting to start a mistakes-only exam when mistakes are empty shows a non-blocking notification and stays on setup.                                                           | L2, L4 | ✅        | `tests/unit/exam-session.test.js`, `tests/e2e/exam.spec.js`                      |
| `EXAM-03` | Selecting an option records the user's answer and clears any elimination on that option.                                                                                         | L2, L4 | ✅        | `tests/unit/exam-session.test.js`                                                |
| `EXAM-04` | Toggling distractor elimination (`✕`) strikes through the option and clears selection if that option was selected.                                                               | L2, L4 | ✅        | `tests/unit/exam-session.test.js`, `tests/e2e/exam.spec.js`                      |
| `EXAM-05` | Flagging a question (`★`) toggles its flagged status and updates the Quick Grid button state.                                                                                    | L2, L4 | ✅        | `tests/unit/exam-session.test.js`, `tests/e2e/exam.spec.js`                      |
| `EXAM-06` | Next, Previous, and Quick Grid jump buttons navigate accurately and preserve cached option shuffles.                                                                             | L2, L4 | ✅        | `tests/unit/exam-session.test.js`, `tests/e2e/exam.spec.js`                      |
| `EXAM-07` | Submitting an exam computes the exact percentage score, updates `userStats`, adds wrong/unanswered questions to `mistakes`, and removes newly-correct questions from `mistakes`. | L2, L4 | ✅        | `tests/unit/exam-session.test.js`, `tests/e2e/characterization.spec.js`          |
| `EXAM-08` | Submitting an exam warns the user via dialog if unanswered questions remain.                                                                                                     | L3, L4 | ✅        | `tests/integration/behavior-fixes.test.js`, `tests/e2e/characterization.spec.js` |
| `EXAM-09` | Exam Results screen renders full review cards with structured explanations and allows "Retry Wrong Questions Only".                                                              | L3, L4 | ✅        | `tests/dom/exam-view.test.js`, `tests/e2e/characterization.spec.js`              |
| `EXAM-10` | Active exam session (including answers, flags, eliminations, and option order) survives a page reload via `sessionStorage`.                                                      | L3, L4 | ✅        | `tests/integration/storage.test.js`, `tests/e2e/exam.spec.js`                    |

### 4.5 Study Mode (`STUDY`)

| Req ID     | Requirement Description                                                                                                                                                                 | Level      | v1 Status | v2 Target Test File                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------- | ----------------------------------------------------------------------------- |
| `STUDY-01` | Filtering by category or toggling "Mistakes Only" updates the study deck immediately.                                                                                                   | L2, L4     | ✅        | `tests/unit/study-session.test.js`, `tests/e2e/study.spec.js`                 |
| `STUDY-02` | Answering a study question immediately highlights green (correct) or red + green (wrong), reveals the explanation, and updates stats/mistakes once per question.                        | L2, L4     | ✅        | `tests/unit/study-session.test.js`, `tests/e2e/study.spec.js`                 |
| `STUDY-03` | Advancing past the last question in the study deck wraps around to index 0 with a fresh shuffle.                                                                                        | L2         | ✅        | `tests/unit/study-session.test.js`                                            |
| `STUDY-04` | Explanation renderer displays "בשורה אחת" summary, pedagogical rationale, and structured distractor cards while hiding `• מקור בספרות`.                                                 | L2, L3     | ✅        | `tests/unit/explanation-parser.test.js`, `tests/dom/explanation-card.test.js` |
| `STUDY-05` | "Copy Question for AI" button appears **only** in Study Mode, formats the Hebrew prompt with current shuffled options, copies to clipboard, and shows a toast without native `alert()`. | L2, L3, L4 | ✅        | `tests/unit/ai-prompt.test.js`, `tests/e2e/study.spec.js`                     |

### 4.6 Saved Exams & Quarantine Zone (`SAVED`)

| Req ID     | Requirement Description                                                                                                                            | Level  | v1 Status | v2 Target Test File                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | ----------------------------------------------------------------- |
| `SAVED-01` | Reserving a full exam adds it to `savedExams` (up to max 3 slots) and immediately removes its questions from the active pool.                      | L2, L4 | ✅        | `tests/unit/saved-exams.test.js`, `tests/e2e/saved-exams.spec.js` |
| `SAVED-02` | Attempting to save a 4th exam or duplicate source is rejected with a clear message.                                                                | L2     | ✅        | `tests/unit/saved-exams.test.js`                                  |
| `SAVED-03` | Starting a saved exam launches a full exam with all questions from that source in `ACTIVE` screen.                                                 | L2, L4 | ✅        | `tests/unit/saved-exams.test.js`, `tests/e2e/saved-exams.spec.js` |
| `SAVED-04` | Completing a saved exam records its `score` and `completedAt` on the saved slot and shows the "Release Exam to Pool" banner on the results screen. | L2, L4 | ✅        | `tests/unit/saved-exams.test.js`, `tests/e2e/saved-exams.spec.js` |
| `SAVED-05` | Releasing a saved exam removes the slot and restores all its questions to the active pool and header counter.                                      | L2, L4 | ✅        | `tests/unit/saved-exams.test.js`, `tests/e2e/saved-exams.spec.js` |

### 4.7 Statistics & Weakest Category (`STATS`)

| Req ID     | Requirement Description                                                                                                                  | Level  | v1 Status | v2 Target Test File                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | -------------------------------------------------------------------------------- |
| `STATS-01` | Overall accuracy, total answered, exams completed, and mistakes count are calculated accurately.                                         | L2, L3 | ✅        | `tests/unit/stats.test.js`, `tests/dom/stats-view.test.js`                       |
| `STATS-02` | Per-category progress bars and percentages sort or highlight performance accurately and identify the weakest category (`>= 1` answered). | L2     | ✅        | `tests/unit/stats.test.js`                                                       |
| `STATS-03` | Clicking "Practice Weakest Category" switches to Study Mode filtered to that category.                                                   | L3, L4 | ✅        | `tests/integration/behavior-fixes.test.js`, `tests/e2e/characterization.spec.js` |
| `STATS-04` | Resetting statistics clears mistakes and stats after dialog confirmation and records `lastResetAt` timestamp.                            | L2, L4 | ✅        | `tests/unit/stats.test.js`, `tests/e2e/characterization.spec.js`                 |

### 4.8 Persistence, Security & Cloud Sync (`SYNC` & `SEC`)

| Req ID    | Requirement Description                                                                                                                                   | Level  | v1 Status | v2 Target Test File                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | -------------------------------------------------------------------------------- |
| `SYNC-01` | Local progress persists under `nursing_progress_v2` and survives corrupt JSON in `localStorage` without crashing.                                         | L3     | ✅        | `tests/integration/storage.test.js`                                              |
| `SYNC-02` | Merging local and remote cloud state resolves mistake additions and removals by per-item `updatedAt` timestamp (no zombie mistakes).                      | L2, L3 | ✅        | `tests/unit/sync-merge.test.js`, `tests/integration/behavior-fixes.test.js`      |
| `SYNC-03` | Merging local and remote cloud state respects `userStats.lastResetAt` so a stats reset propagates across devices.                                         | L2, L3 | ✅        | `tests/unit/sync-merge.test.js`, `tests/integration/behavior-fixes.test.js`      |
| `SEC-01`  | `html` template tag escapes `<script>`, `onerror=`, quotes, and ampersands in all interpolated strings.                                                   | L2, L3 | ✅        | `tests/unit/dom-escape.test.js`, `tests/dom/auth-view.test.js`                   |
| `A11Y-01` | All 4 screens pass automated accessibility checks (landmarks, labels, contrast, keyboard navigation) and visual regression baselines on Desktop & Mobile. | L3, L4 | ✅        | `tests/integration/behavior-fixes.test.js`, `tests/e2e/characterization.spec.js` |

---

## 5. Prioritized Missing Test Backlog (To Be Closed During Refactor)

### Priority 0 (Blocker for v2 — Closed in Steps 3, 5, 7, 8, 9, 10, 11)

1. **Real-Browser Characterization E2E Suite (`tests/e2e/`)**: Added in **Step 3** before touching application code.
2. **Data Schema & Deduplication Suite (`tests/data/questions.schema.test.js`)**: Added in **Step 5**.
3. **Storage & Store Integration Suite (`tests/integration/`)**: Added in **Step 7**.
4. **Pure Domain Unit Suite (`tests/unit/*.test.js`)**: Added in **Step 8**, replacing copy-pasted v1 scripts with direct imports of `shuffle.js`, `question-pool.js`, `exam-session.js`, `study-session.js`, `saved-exams.js`, `stats.js`, `explanation-parser.js`, and `ai-prompt.js`.
5. **Cloud Sync Merge Suite (`tests/unit/sync-merge.test.js`)**: Added in **Steps 10–11** to verify timestamped mistake deletion and reset propagation.

### Priority 1 (High Value — Closed in Steps 9 & 12)

1. **DOM View Rendering & XSS Escaping Suite (`tests/dom/`)**: Added in **Steps 7 & 9**.
2. **Visual Regression Baselines (Desktop 1280px & Pixel 412px)**: Added in **Step 3** and enforced at **Step 6** (CSS split) and **Step 12**.
3. **Accessibility Audit (`@axe-core/playwright` or ARIA assertions)**: Added in **Step 12**.

### Priority 2 (Future Enhancements Backlog — Post-v2.0)

1. **Firestore Emulator Rules Test Suite**: Automated testing of `firestore.rules` against the local Firebase Emulator (`@firebase/rules-unit-testing`).
2. **Network Throttling / Offline Service Worker E2E Tests**: Once a Service Worker is added in a future v2.1 release.
3. **Mutation Testing (StrykerJS)**: Optional periodic run on `app/js/domain/` to verify test assertion strength.

---

## 6. v2.0 Release Entry & Exit Criteria

- **Entry Criteria (Step 3)**: Characterization E2E tests pass 100% against the v1 baseline before structural refactoring begins.
- **Exit Criteria (Step 14)**:
  - 100% of P0 and P1 tests in Section 4 are implemented and passing (`✅ Covered`).
  - `npm run verify` (`lint` + `unit` + `integration` + `data` + `dom` + `e2e`) passes with 0 errors.
  - Domain code coverage `>= 90%`.

---

## 7. Execution Report Log (Updated Per Step)

| Step    | Branch                       | Date       | Lint                         | Unit / Data / DOM                                                                    | E2E (Playwright)                                                                        | Notes                                                                                                                                                                                                                                                                                                                                               |
| ------- | ---------------------------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1  | `docs/01-standards-bible`    | 2026-11-10 | N/A                          | v1 suite: 4/4 pass                                                                   | Pending Step 3                                                                          | Authored Standards Bible (01–12), ADRs (0001–0004), and STPR v1.0.                                                                                                                                                                                                                                                                                  |
| Step 2  | `chore/02-tooling`           | 2026-11-10 | ESLint + Prettier (0 errors) | `node:test` (2/2) + v1 suite (4/4)                                                   | Configured (`playwright.config.js`: Laptop, Tablet, Pixel 10 Pro XL, Galaxy S25)        | Added dev-only toolchain, `tools/serve.js`, flat ESLint config, and CI workflow.                                                                                                                                                                                                                                                                    |
| Step 3  | `test/03-safety-net`         | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` + `happy-dom` (7/7) + v1 (4/4)                                           | `tests/e2e/characterization.spec.js` (4 flows × 4 device viewports = 16 specs)          | Added characterization DOM & E2E suites; caught & fixed latent `shuffledOptionsCache` crash on unvisited exam questions in `submitExam`.                                                                                                                                                                                                            |
| Step 4  | `refactor/04-repo-structure` | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` + `happy-dom` (7/7) + v1 (4/4)                                           | Ready (`tools/serve.js` auto-resolved `./app`)                                          | Moved `index.html` → `app/index.html`, untracked `raw_materials/`, moved canonical source to `data-pipeline/source/clean_questions.json`, archived 90 one-off scripts & 27 dumps to `../nursing-education-ai-archive/`, added `deploy-pages.yml`.                                                                                                   |
| Step 5  | `refactor/05-data-layer`     | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (14/14: unit + data + dom) + legacy (3/3)                                | Ready (`./data/questions.json` fetched asynchronously)                                  | Built `app/data/questions.json` (saved 2.01 MB / 46.7% vs source), added `app/js/services/question-repository.js`, verified 4 data equivalence & schema checks across all 1,079 questions, removed `questions.js` & `scripts/verify_database.*`.                                                                                                    |
| Step 6  | `refactor/06-css`            | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (18/18: unit + data + dom) + legacy (3/3)                                | Ready (`./styles/main.css` with `@layer`)                                               | Extracted 1,901-line `<style>` block from `app/index.html` into 16 modular CSS files under `app/styles/` with `@layer tokens, base, layout, components, features, utilities`, cleaned static inline styles, and added `tests/dom/css-architecture.test.js`.                                                                                         |
| Step 7  | `refactor/07-js-core`        | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (30/30: unit + integration + data + dom) + legacy (3/3)                  | Ready                                                                                   | Added `app/js/config.js`, `core/store.js`, `core/storage.js` (`v2` keys), `core/router.js`, `core/events.js`, `ui/dom.js` (`html` auto-escaping tag), `ui/toast.js`, and `ui/dialog.js` with 12 new unit/integration/DOM tests.                                                                                                                     |
| Step 8  | `refactor/08-domain`         | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (48/48 across 19 suites: unit + integration + data + dom) + legacy (1/1) | Ready                                                                                   | Added 9 pure domain modules under `app/js/domain/` (`shuffle.js`, `question-pool.js`, `explanation-parser.js`, `ai-prompt.js`, `sync-merge.js`, `exam-session.js`, `study-session.js`, `saved-exams.js`, `stats.js`) with 18 new unit tests; retired `scripts/test_shuffle_logic.js` & `scripts/test_saved_exams_quarantine.js`.                    |
| Step 9  | `refactor/09-features`       | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (53/53 across 22 suites: unit + integration + data + dom)                | Ready                                                                                   | Extracted `app/js/ui/explanation-card.js`, 8 feature view/controller modules (`exam`, `study`, `saved-exams`, `stats`), and `app/js/main.js`; removed 1,791-line inline `<script>` and all inline `onclick`/`onchange` handlers from `app/index.html`; added 3 DOM test suites; retired `scripts/test_app_validation.js`.                           |
| Step 10 | `refactor/10-cloud-sync`     | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (58/58 across 24 suites: unit + integration + data + dom)                | Ready                                                                                   | Extracted inline Firebase `<script type="module">` into `app/js/services/cloud-sync.js`, `app/js/features/auth/auth-view.js`, and `app/js/features/auth/auth-controller.js` wired to `v2` `store`/`storage`; authored `firestore.rules` via `firestore-rules-author`; added `tests/integration/cloud-sync.test.js` & `tests/dom/auth-view.test.js`. |
| Step 11 | `fix/11-behavior-fixes`      | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (62/62 across 25 suites: unit + integration + data + dom)                | Updated for `<dialog>` (`#appModalDialog`)                                              | Wired accessible `<dialog>` (`confirmDialog` / `alertDialog`) across `exam`, `saved-exams`, `stats`, and `auth`; extracted `app/js/services/clipboard.js`; verified end-to-end `SYNC-02` (no zombie mistakes) and `SYNC-03` (`lastResetAt` propagation) in `tests/integration/behavior-fixes.test.js`.                                              |
| Step 12 | `chore/12-quality-gates`     | 2026-11-11 | ESLint + Prettier (0 errors) | `node:test` (63/63 across 25 suites: unit + integration + data + dom)                | `20/20` passed (`5` flows × `4` viewports: Laptop, Tablet, Pixel 10 Pro XL, Galaxy S25) | Added Content Security Policy (`CSP`) `<meta>` tag in `app/index.html` forbidding `'unsafe-inline'` scripts; verified `STATS-03`, `STATS-04`, `EXAM-08`, and `A11Y-01` across all 4 device viewports (`42.3s` total E2E runtime); 100% of Section 4 requirements now `✅` covered.                                                                  |
