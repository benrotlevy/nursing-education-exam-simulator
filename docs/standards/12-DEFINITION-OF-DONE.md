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
- [ ] Integration & DOM tests (`tests/integration/`, `tests/dom/`) pass (including CSS disabled/locked visual invariants).
- [ ] End-to-End & visual regression tests (`npm run test:e2e`) pass on all configured viewports (`laptop`, `tablet`, `pixel-10-pro-xl`, `galaxy-s25`), including `MutationObserver` no-flash checks, Role × Tab lock matrix, real-time `onSnapshot` auto-unlock, double-submit cooldown, and Sign-Out zero-residue verification.
- [ ] [`docs/STPR.md`](../STPR.md) traceability matrix and execution report are updated to reflect new/passing tests.

## ✅ 3. Accessibility, RTL & Mobile UX

- [ ] All interactive controls are keyboard-focusable and operable via `Enter` / `Space`.
- [ ] Hebrew RTL layout (`dir="rtl"`) renders without horizontal overflow at `360px`, `412px`, `768px`, and `1280px` widths.
- [ ] Mobile bottom navigation bar and active section indicator remain synchronized across all tabs.
- [ ] Expanded/renamed features have aligned button labels, modal titles, and fallback messages.

## ✅ 4. Full-Stack Deployment, Git Hygiene & Checkpoint Reporting

- [ ] When `firestore.rules` changed, deployed via `npm run deploy:rules`.
- [ ] When `tools/cloudflare-worker-telegram.js` changed, deployed via `npm run deploy:worker`.
- [ ] Commits follow Conventional Commits format.
- [ ] Branch is pushed to `origin`.
- [ ] A clear summary is presented reporting exact changes and verified test/command counts.
