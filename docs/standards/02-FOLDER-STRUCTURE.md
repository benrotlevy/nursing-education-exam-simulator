# 02 — Folder Structure & Naming Standard

## 1. Repository Layout

The repository separates **deployable web application assets** (`app/`), **automated tests** (`tests/`), **data build & canonical pipeline scripts** (`data-pipeline/` and `tools/`), and **engineering documentation** (`docs/`).

> **Note on Historical Raw Materials & One-Off Extraction Scripts:**
> Per project governance decisions, copyrighted raw PDFs (`raw_materials/`) and the ~110 historical one-off extraction scripts are archived outside the tracked web repository in a dedicated sibling archive folder (`../nursing-education-ai-archive/`) with a descriptive manifest for future AI workflows.

```text
/
├── app/                              # DEPLOYED ROOT (GitHub Pages artifact)
│   ├── index.html                    # Semantic HTML5 shell (no inline JS or CSS)
│   ├── data/
│   │   └── questions.json            # Generated, validated, deduplicated question bank
│   ├── styles/
│   │   ├── main.css                  # Entry stylesheet: defines @layer order & @imports
│   │   ├── tokens.css                # CSS Custom Properties (colors, spacing, fonts, radii)
│   │   ├── base.css                  # Reset, document defaults, RTL rules, typography
│   │   ├── layout.css                # App header, main container, desktop tabs, mobile bottom nav
│   │   ├── components/
│   │   │   ├── buttons.css
│   │   │   ├── cards.css
│   │   │   ├── badges.css
│   │   │   ├── forms.css
│   │   │   ├── question-card.css
│   │   │   ├── explanation.css
│   │   │   ├── toast.css
│   │   │   └── dialog.css
│   │   └── features/
│   │       ├── exam.css
│   │       ├── study.css
│   │       ├── saved-exams.css
│   │       ├── stats.css
│   │       └── auth.css
│   └── js/
│       ├── main.js                   # Application bootstrap & composition root
│       ├── config.js                 # Constants, storage keys (v2), categories, Firebase config
│       ├── core/
│       │   ├── store.js              # Observable state container
│       │   ├── storage.js            # Versioned localStorage / sessionStorage adapter
│       │   ├── router.js             # Tab & screen state transitions
│       │   └── events.js             # Delegated data-action event dispatcher
│       ├── domain/
│       │   ├── shuffle.js            # Fisher-Yates & option shuffler
│       │   ├── question-pool.js      # Quarantine filtering & pool queries
│       │   ├── exam-session.js       # Pure exam state transitions & grading
│       │   ├── study-session.js      # Pure study mode transitions
│       │   ├── saved-exams.js        # Quarantine slot management (max 3)
│       │   ├── stats.js              # Category accuracy & weakest-category calculation
│       │   ├── explanation-parser.js # Rationale & distractor parser (strips literature)
│       │   ├── ai-prompt.js          # Hebrew AI prompt builder
│       │   └── sync-merge.js         # Cloud/local state merge algorithm
│       ├── services/
│       │   ├── question-repository.js# Fetches and caches app/data/questions.json
│       │   ├── clipboard.js          # Resilient async clipboard + mobile fallback
│       │   └── cloud-sync.js         # Firebase Auth & Firestore adapter
│       ├── ui/
│       │   ├── dom.js                # Auto-escaping html`` template tag & DOM utilities
│       │   ├── toast.js              # Non-blocking status toast
│       │   ├── dialog.js             # Accessible <dialog> modal replacement for alert/confirm
│       │   └── components/
│       │       └── explanation-card.js
│       └── features/
│           ├── exam/
│           │   ├── exam.controller.js
│           │   └── exam.view.js
│           ├── study/
│           │   ├── study.controller.js
│           │   └── study.view.js
│           ├── saved-exams/
│           │   ├── saved-exams.controller.js
│           │   └── saved-exams.view.js
│           ├── stats/
│           │   ├── stats.controller.js
│           │   └── stats.view.js
│           └── auth/
│               ├── auth.controller.js
│               └── auth.view.js
├── tests/
│   ├── unit/                         # Pure domain & core unit tests (node:test)
│   ├── integration/                  # Store + storage persistence & cloud merge tests
│   ├── dom/                          # Component & view rendering tests (happy-dom)
│   ├── e2e/                          # Playwright full-browser flows & visual regression
│   ├── data/                         # Schema & pedagogical integrity tests for questions.json
│   ├── fixtures/                     # Sample questions and state snapshots
│   └── helpers/                      # Test utilities and mock factories
├── data-pipeline/                    # Canonical question-bank maintenance (not deployed)
│   ├── README.md
│   └── source/
│       └── clean_questions.json      # Canonical source of truth for the 1,079 questions
├── tools/
│   ├── build-questions.js            # Compiles clean_questions.json -> app/data/questions.json
│   └── serve.js                      # Zero-dependency local HTTP dev server
├── docs/
│   ├── standards/                    # The Project Bible (01 through 12)
│   ├── adr/                          # Architecture Decision Records
│   ├── STPR.md                       # Software Test Plan & Report
│   └── data/                         # Historical indexing docs & single-answer question bank
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, Unit, Data, DOM, and E2E pipeline
│       └── deploy-pages.yml          # Publishes ONLY app/ to GitHub Pages
├── package.json
├── eslint.config.js
├── playwright.config.js
├── .prettierrc
├── .editorconfig
├── .gitignore
├── .gitattributes
├── firestore.rules
├── README.md
├── CONTRIBUTING.md
└── CHANGELOG.md
```

---

## 2. File & Directory Naming Conventions

1. **Directories**: Always `kebab-case` (e.g., `saved-exams`, `data-pipeline`).
2. **JavaScript Files**:
   - Standard modules: `kebab-case.js` (e.g., `question-pool.js`, `explanation-parser.js`).
   - Feature modules: `<feature>.controller.js` and `<feature>.view.js`.
   - Unit / Integration / DOM tests: `<module-name>.test.js` mirroring the source layer.
   - Playwright E2E specs: `<flow-name>.spec.js` inside `tests/e2e/`.
3. **CSS Files**: `kebab-case.css` grouped under `styles/components/` or `styles/features/`.
4. **Documentation**:
   - Numbered standards in `docs/standards/`: `NN-UPPER-KEBAB.md`.
   - ADRs in `docs/adr/`: `NNNN-kebab-title.md`.

---

## 3. Adding a New Feature (Checklist)

When adding a new feature in v2+:
1. Add any pure calculations or state transitions to `app/js/domain/<feature>.js` with unit tests in `tests/unit/<feature>.test.js`.
2. Create `app/js/features/<feature>/<feature>.view.js` and `<feature>.controller.js`.
3. Add styles in `app/styles/features/<feature>.css` and import it inside `app/styles/main.css` under `@layer features`.
4. Register routes/actions in `app/js/main.js`.
5. Add DOM and E2E tests and register the requirement IDs in `docs/STPR.md`.
