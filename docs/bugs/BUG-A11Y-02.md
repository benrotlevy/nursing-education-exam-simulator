# Defect Report: BUG-A11Y-02

**Requirement**: `A11Y-03` (ARIA Live Region & Screen Reader Politeness)  
**Severity**: Medium-High (Screen Reader Accessibility / WCAG 2.1 AA Non-Conformance)  
**Status**: Open  
**Affected Files**:

- `app/index.html` (lines 362–369, line 473)
- `app/js/features/study/study-view.js` (lines 130–151)
- `app/js/ui/toast.js` (lines 1–48)

---

## 1. Description

Screen reader users relying on auditory feedback do not receive timely announcements when interacting with dynamic content updates:

1. **Study Feedback Container Lacks `aria-live` Region**:
   In `app/index.html`:

   ```html
   <div class="explanation-box" id="studyExplanationBox">
     <div class="explanation-header" id="studyExplanationHeader">💡 הסבר ונימוק פדגוגי:</div>
     <div class="explanation-body" id="studyExplanationText">נימוק...</div>
   </div>
   ```

   Neither `#studyExplanationBox` nor `#studyExplanationHeader` declares `aria-live="polite"`, `role="status"`, or `role="alert"`. When a user answers a question in Study Mode, the visual feedback updates (`✅ נכון מאוד! כל הכבוד:` or `❌ לא מדויק. להלן ההסבר המלא:`), but assistive technologies (JAWS, NVDA, VoiceOver) are not alerted to announce the grading outcome.

2. **Divergent Toast Container Element ID**:
   The specification and test contracts target `#appToastContainer`, whereas `app/index.html` defines:
   ```html
   <div id="appGlobalToast" class="app-toast" role="status" aria-live="polite"></div>
   ```
   No element with ID `appToastContainer` exists in the markup, causing container lookups and assertions targeting `#appToastContainer` to return `null`.

---

## 2. Reproduction Steps

1. Run DOM test: `node --test tests/dom/aria-live.test.js`.
2. Observe assertion failure: `Toast notification container #appToastContainer must exist in DOM`.
3. In Study Mode, select an answer option: inspect `#studyExplanationBox` and `#studyExplanationHeader`. Neither contains `aria-live` or `role="status"`/`alert`.

---

## 3. Expected vs. Actual Behavior

- **Expected**: In accordance with `docs/standards/05-HTML-A11Y-RTL.md` (Section 4 — ARIA Patterns) and STPR.md requirement `A11Y-03`, dynamic grading feedback in Study Mode must be broadcast to screen readers via an accessible live region (`aria-live="polite"` or `role="status"`), and the toast notification container must provide the standard `#appToastContainer` element.
- **Actual**: Screen readers receive zero auditory announcement upon answering in Study Mode, and `#appToastContainer` is missing from the DOM.

---

## 4. Recommended Remediation

1. In `app/index.html`:
   - Add `role="status"` and `aria-live="polite"` to `#studyExplanationBox`.
   - Update or alias the toast element ID to `#appToastContainer` (or support both `id="appToastContainer"` and `id="appGlobalToast"`).
2. In `app/js/features/study/study-view.js`:
   - Ensure the live region text update triggers a clean announcement in Hebrew upon each answer selection.
