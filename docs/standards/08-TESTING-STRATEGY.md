# 08 — Testing Strategy Standard

## 1. Guiding Principles

1. **Test the Real Code, Never a Copy**: Tests must `import` the actual production ES modules from `app/js/...`. Copy-pasting functions into test files is strictly forbidden.
2. **Bug → Regression Test First**: Whenever a bug is discovered, write a failing automated test that reproduces the bug _before_ writing the fix.
3. **Fast Feedback Pyramid**:
   - **Unit & Data Schema tests** (`node:test`): Run in `< 2 seconds` on every save/commit.
   - **Integration & DOM View tests** (`node:test` + `happy-dom`): Run in `< 5 seconds` without launching a browser.
   - **End-to-End & Visual Regression tests** (`Playwright`): Run in a real headless Chromium browser across Desktop (`1280×800`) and Mobile Pixel (`412×915`) viewports.

---

## 2. The Four Test Layers

| Layer                    | Directory                          | Runner / Environment      | What It Verifies                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Data Integrity**    | `tests/data/`                      | `node:test`               | `questions.json` schema, 1,079 count, unique IDs, valid categories, option bounds, explanation structure, zero leaked literature headers.                                                                              |
| **2. Unit (Domain)**     | `tests/unit/`                      | `node:test`               | Pure functions in `app/js/domain/*`: shuffle determinism, quarantine math, exam grading, study session wrap-around, saved-exams 3-slot limit, explanation parser, AI prompt formatter, sync-merge conflict resolution. |
| **3. Integration & DOM** | `tests/integration/`, `tests/dom/` | `node:test` + `happy-dom` | `core/store.js` subscriptions, `core/storage.js` round-trip persistence, `core/router.js`, `ui/dom.js` XSS auto-escaping, feature views rendering expected Hebrew text and `data-action` attributes.                   |
| **4. End-to-End (E2E)**  | `tests/e2e/`                       | Playwright (Chromium)     | Full user journeys in a real browser (Exam flow, Study flow + AI copy, Saved Exams lifecycle, Stats & reset, Mobile bottom nav UX) + visual screenshot baselines.                                                      |

---

## 3. Coverage Targets

- **`app/js/domain/*`**: **≥ 90% line & branch coverage**. Every business rule and edge case must have direct unit tests.
- **`app/js/core/*`**: **≥ 85% line coverage**.
- **Critical User Journeys**: **100% E2E coverage** of all P0 requirements defined in [`docs/STPR.md`](../STPR.md).

---

## 4. Test Naming & Structure

Each test file uses Node's built-in `describe` and `it` from `node:test` and `node:assert/strict` (or `@playwright/test` for E2E):

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toggleEliminateOption } from '../../app/js/domain/exam-session.js';

describe('exam-session: toggleEliminateOption', () => {
  it('clears the selected answer when the user eliminates the currently selected option [EXAM-05]', () => {
    // Arrange
    const session = createFixtureSession({ selectedOption: 2 });
    // Act
    const updated = toggleEliminateOption(session, 0, 2);
    // Assert
    assert.equal(updated.userAnswers[0], undefined);
    assert.equal(updated.eliminated[0].includes(2), true);
  });
});
```

Include the **STPR Requirement ID** (e.g., `[EXAM-05]`) in test descriptions wherever applicable to maintain bidirectional traceability with `docs/STPR.md`.
