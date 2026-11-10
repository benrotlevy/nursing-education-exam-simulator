# 12 — Definition of Done (DoD)

Every refactoring step branch (`docs/*`, `chore/*`, `test/*`, `refactor/*`, `fix/*`) and every future feature PR must satisfy **100% of the applicable criteria below** before merging into `release/v2` (and before `release/v2` merges into `main`).

---

## ✅ 1. Code & Architecture Compliance
- [ ] Follows the layer dependency rules in [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) (`domain/` has zero DOM/storage/service imports).
- [ ] File and folder names match [`02-FOLDER-STRUCTURE.md`](./02-FOLDER-STRUCTURE.md).
- [ ] Zero `window.*` globals, zero `onclick="..."` inline attributes, zero `alert()` / `confirm()` calls (once the relevant refactor step is reached).
- [ ] All dynamic HTML uses the auto-escaping `html` template tag from `ui/dom.js`.
- [ ] `npm run lint` (ESLint + Prettier check) exits with **0 errors and 0 warnings**.

## ✅ 2. Automated Testing & STPR Traceability
- [ ] Unit tests (`tests/unit/`) pass for all modified/added domain logic.
- [ ] Data schema tests (`tests/data/`) pass against the 1,079 questions.
- [ ] Integration & DOM tests (`tests/integration/`, `tests/dom/`) pass.
- [ ] End-to-End & visual regression tests (`npm run test:e2e`) pass on both Desktop (`1280×800`) and Mobile Pixel (`412×915`) viewports.
- [ ] [`docs/STPR.md`](../STPR.md) traceability matrix and execution report are updated to reflect new/passing tests.

## ✅ 3. Accessibility, RTL & Mobile UX
- [ ] All interactive controls are keyboard-focusable and operable via `Enter` / `Space`.
- [ ] Hebrew RTL layout (`dir="rtl"`) renders without horizontal overflow at `360px`, `412px`, `768px`, and `1280px` widths.
- [ ] Mobile bottom navigation bar and active section indicator remain synchronized across all tabs.

## ✅ 4. Git Hygiene & Checkpoint Reporting
- [ ] Work was performed on a dedicated step branch cut from `release/v2` (`main` untouched).
- [ ] Commits follow Conventional Commits format.
- [ ] Branch is pushed to `origin`.
- [ ] A clear **Checkpoint Report** is presented to the user summarizing changes, test counts, any deviations or surprises, and awaiting explicit approval before continuing.
