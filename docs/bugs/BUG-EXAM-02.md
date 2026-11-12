# Defect Report: BUG-EXAM-02

- **Defect ID**: `BUG-EXAM-02`
- **Requirement ID**: `EXAM-12` ("Retry Wrong Questions Only" Sub-Exam Generation & 100% Toast Guard)
- **Severity**: Low / UI String Consistency
- **Status**: Resolved in v3.0
- **Reported By**: Worker 2 (Exam Flow Test Worker)
- **Date**: 2026-11-12
- **Affected File**: `app/js/domain/exam-session.js` (Line 305)

---

## 1. Description & Impact

When viewing exam results on the Results screen (`#screenExamResults`), clicking `#btnRetryWrong` generates a sub-exam composed exclusively of questions that were answered incorrectly or left unanswered.
If the student achieved a perfect 100% score (0 errors), the system must guard against creating an empty exam and provide user feedback via a toast notification.

Requirement `EXAM-12` (Scenario B) in `docs/STPR.md` explicitly specifies:

> **Scenario B**: Complete exam with 5/5 correct (100%). Click `#btnRetryWrong`. Assert toast shows `"אין שאלות שגויות לתרגול חוזר!"` and no active exam session is initiated.

In production code (`app/js/domain/exam-session.js` line 305), `createRetryWrongExamSession()` returns:

```javascript
if (wrongList.length === 0) {
  return {
    ok: false,
    message: 'לא היו שגיאות במבחן זה! כל הכבוד!',
  };
}
```

Consequently, the toast displayed to the user is `'לא היו שגיאות במבחן זה! כל הכבוד!'` instead of the specified `'אין שאלות שגויות לתרגול חוזר!'`.
Both the unit test (`tests/unit/exam-retry.test.js`) and DOM test (`tests/dom/exam-edge-cases.test.js`) fail on this assertion.

---

## 2. Steps to Reproduce

1. Complete an exam where all questions are answered correctly (100% score).
2. On `#screenExamResults`, click `#btnRetryWrong` (or call `createRetryWrongExamSession(exam)`).
3. Observe the toast notification text.
4. Expected: `"אין שאלות שגויות לתרגול חוזר!"`
5. Actual: `"לא היו שגיאות במבחן זה! כל הכבוד!"`

---

## 3. Expected vs Actual Implementation

### Expected (`app/js/domain/exam-session.js:302-307`)

```javascript
if (wrongList.length === 0) {
  return {
    ok: false,
    message: 'אין שאלות שגויות לתרגול חוזר!',
  };
}
```

### Actual (`app/js/domain/exam-session.js:302-307`)

```javascript
if (wrongList.length === 0) {
  return {
    ok: false,
    message: 'לא היו שגיאות במבחן זה! כל הכבוד!',
  };
}
```

---

## 4. Suggested Remediation

Update the return message in `createRetryWrongExamSession()` in `app/js/domain/exam-session.js` from `'לא היו שגיאות במבחן זה! כל הכבוד!'` to `'אין שאלות שגויות לתרגול חוזר!'`.
