# Defect Report: BUG-EXAM-01

- **Defect ID**: `BUG-EXAM-01`
- **Requirement ID**: `EXAM-11` (Active Exam Abandonment Lifecycle & Storage Purge)
- **Severity**: Medium
- **Status**: Open / Discovered in Test Expansion v3.0
- **Reported By**: Worker 2 (Exam Flow Test Worker)
- **Date**: 2026-11-12
- **Affected File**: `app/index.html` (Line 143)

---

## 1. Description & Impact

The Active Exam view (`#screenActiveExam`) header contains an abandon exam button meant to allow users to exit an in-progress exam and return to the Exam Setup screen.
According to `docs/STPR.md` (Requirement `EXAM-11`) and automated test specifications, this button must be addressable via the unique ID `#btnAbandonExam`, matching the standard naming convention of other exam control buttons (`#btnPrevExam`, `#btnNextExam`, `#btnSubmitExam`, `#btnRetryWrong`).

In `app/index.html`, the button is currently defined with class `.btn-abandon-exam` and `data-action="confirm-abandon-exam"`, but **lacks the required `id="btnAbandonExam"`**. As a result:

- DOM queries targeting `#btnAbandonExam` return `null`.
- Automated tests and accessibility selectors expecting `#btnAbandonExam` fail.

---

## 2. Steps to Reproduce

1. Mount the application with `app/index.html`.
2. Query `document.querySelector('#btnAbandonExam')` or `document.getElementById('btnAbandonExam')`.
3. Observed result: `null`.

---

## 3. Expected vs Actual Behavior

### Expected

The button in `app/index.html` should include `id="btnAbandonExam"`:

```html
<button
  type="button"
  class="btn-abandon-exam"
  id="btnAbandonExam"
  data-action="confirm-abandon-exam"
  title="יציאה מהמבחן וחזרה למסך הגדרת מבחן"
>
  ✕ יציאה מהמבחן
</button>
```

### Actual

Line 143 of `app/index.html`:

```html
<button
  type="button"
  class="btn-abandon-exam"
  data-action="confirm-abandon-exam"
  title="יציאה מהמבחן וחזרה למסך הגדרת מבחן"
>
  ✕ יציאה מהמבחן
</button>
```

---

## 4. Associated Observations (Storage Key Naming)

In `docs/STPR.md`, Requirement `EXAM-11` specifies purging `sessionStorage` item `nursing_active_exam_v2`.
The application implementation in `app/js/config.js` and `app/js/core/storage.js` stores active sessions under `STORAGE_KEYS.EXAM_SESSION` = `'nursing_exam_session_v2'`.
The abandonment lifecycle correctly deletes `'nursing_exam_session_v2'` upon confirmation. `docs/STPR.md` should harmonize on `'nursing_exam_session_v2'` or the storage adapter should alias `'nursing_active_exam_v2'`.

---

## 5. Suggested Remediation

Add `id="btnAbandonExam"` to `<button type="button" class="btn-abandon-exam" ...>` on line 143 of `app/index.html`.
