# Contributing Guide (`CONTRIBUTING.md`)

Thank you for contributing to the **Clinical Preceptorship Nursing Exam Simulator**. This document outlines our development workflow, architectural rules, question-bank maintenance process, and quality gates.

For comprehensive engineering rules, read the **[Project Engineering Standards ("Bible")](./docs/standards/README.md)** and **[Software Test Plan & Report (`docs/STPR.md`)](./docs/STPR.md)**.

---

## 1. Prerequisites & Local Setup

- **Node.js `>= 20.0.0`**
- Zero production npm dependencies (the runtime application in `app/` is 100% pure Vanilla HTML5, CSS3, and ES2022+ Modules).

```bash
git clone https://github.com/benrotlevy/nursing-education-exam-simulator.git
cd nursing-education-exam-simulator
npm install
npm start
```

Open `http://127.0.0.1:4173` in your browser.

---

## 2. Architectural Rules

1. **Strict Layer Boundaries (`docs/standards/01-ARCHITECTURE.md`)**:
   - `app/js/domain/` — Pure, deterministic business logic. **Zero DOM (`document`, `window`) or storage (`localStorage`) imports.**
   - `app/js/core/` — State container (`store.js`), versioned persistence (`storage.js`), tab/screen router (`router.js`), and delegated event helper (`events.js`).
   - `app/js/services/` — External I/O adapters (`question-repository.js`, `cloud-sync.js`, `clipboard.js`).
   - `app/js/ui/` — Safe HTML escaping (`dom.js`), non-blocking `<dialog>` (`dialog.js`), toast (`toast.js`), and shared explanation renderer (`explanation-card.js`).
   - `app/js/features/<feature>/` — Feature-specific `<feature>-view.js` and `<feature>-controller.js`.
2. **Zero Inline JS or CSS in `app/index.html`**:
   - Never add inline `<script>`, inline `<style>`, or inline `onclick="..."` / `onchange="..."` attributes.
   - Use declarative `data-action="..."` attributes handled via root event delegation in `app/js/main.js`.
   - Keep `app/index.html` compliant with the strict `Content-Security-Policy` meta tag (`script-src` without `'unsafe-inline'`).
3. **XSS & URL Safety (`docs/standards/10-SECURITY.md`)**:
   - Escape all dynamic strings rendered into HTML via `escapeHTML` or the `html` tagged template literal (`app/js/ui/dom.js`).

---

## 3. Updating the Question Bank (`data-pipeline/`)

1. Edit the canonical source file at `data-pipeline/source/clean_questions.json`.
2. Compile and validate the runtime artifact (`app/data/questions.json`):
   ```bash
   npm run build:data
   ```
3. Run the data schema and pedagogical equivalence suite:
   ```bash
   npm run test:data
   ```

---

## 4. Branching, Commits & Pull Requests (`docs/standards/09-GIT-WORKFLOW.md`)

- Cut feature or fix branches from the active integration branch using prefixes:
  - `feat/<topic>`, `fix/<topic>`, `refactor/<topic>`, `test/<topic>`, `docs/<topic>`, `chore/<topic>`
- Use **Conventional Commits** (`feat(exam): ...`, `fix(sync): ...`, `docs(standards): ...`).
- Before opening a PR or merging, run all quality gates:

```bash
npm run format
npm run verify
npm run test:e2e
```

All **12 Definition of Done criteria** in [`docs/standards/12-DEFINITION-OF-DONE.md`](./docs/standards/12-DEFINITION-OF-DONE.md) must pass with zero errors.
