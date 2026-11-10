# Question Bank Data Pipeline

This directory contains the canonical source dataset and maintenance utilities for the **1,079 verified multiple-choice questions** in the Clinical Preceptorship Nursing Exam Simulator.

---

## 📂 Contents

- **`source/clean_questions.json`**: The single source of truth for all 1,079 questions, including historical provenance metadata (`originalExplanation`, `source`, `verified`).
- **`scripts/clean_hebrew_utils.py`**: Shared Hebrew RTL text normalization and sanitization utilities.
- **`scripts/build_clean_database.py`**: Canonical Python pipeline utility for validating and normalizing `source/clean_questions.json`.
- **Related Documentation**:
  - [`../docs/data/INDEXING_STATUS.md`](../docs/data/INDEXING_STATUS.md) — Complete audit log of all 17 raw exam sources indexed into the bank.
  - [`../docs/data/single_answer_questions.md`](../docs/data/single_answer_questions.md) — 261 additional single-answer reconstruction items reserved for future distractor authoring.
  - [`../docs/standards/07-DATA-SCHEMA.md`](../docs/standards/07-DATA-SCHEMA.md) — Formal JSON schema specification for v2.

---

## 🛠️ Building the Runtime Dataset (`app/data/questions.json`)

Whenever `data-pipeline/source/clean_questions.json` is updated, run:

```bash
npm run build:data
```

This executes `tools/build-questions.js`, which validates every question against the v2 schema, strips duplicate/internal fields (`aiExplanation`, trailing `• מקור בספרות:` lines), and writes the slimmed runtime file to `app/data/questions.json`.
