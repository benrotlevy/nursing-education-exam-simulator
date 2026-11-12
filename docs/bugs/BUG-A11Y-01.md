# Defect Report: BUG-A11Y-01

**Requirement**: `A11Y-02` (Full Keyboard-Only Navigation Workflow)  
**Severity**: High (Accessibility / WCAG 2.1 Level A & AA Non-Conformance)  
**Status**: Resolved in v3.0  
**Affected Files**:

- `app/styles/components/forms.css` (lines 43–45)
- `app/js/features/exam/exam-view.js` (lines 98–119)
- `app/js/core/events.js` (lines 40–47)

---

## 1. Description

A user relying strictly on a keyboard (using `Tab`, `Arrow`, `Space`, and `Enter` keys) cannot complete an exam due to two critical accessibility defects in the UI and form controls:

1. **Exam Setup Screen Radio Inputs Hidden with `display: none`**:
   In `app/styles/components/forms.css`:

   ```css
   .pill-option input {
     display: none;
   }
   ```

   CSS `display: none` removes the `<input type="radio" name="examCount">` elements from the accessibility tree and keyboard tab order entirely. Keyboard users cannot Tab to or select question count options (10, 25, 50, 100, or Mistakes Only).

2. **Active Exam Answer Options Lack Focusability & Keydown Handlers**:
   In `app/js/features/exam/exam-view.js`:
   Option cards are created as plain `<div>` elements:
   ```javascript
   const item = document.createElement('div');
   item.className = 'option-item';
   item.setAttribute('data-action', 'select-exam-option');
   ```
   The `<div>` elements do not have `tabindex="0"`, do not declare `role="button"`, and `app/js/core/events.js` only listens for `click` events without handling `keydown` (`Space` / `Enter`). As a result, pressing `Tab` skips the answer options entirely, landing solely on the nested `.btn-eliminate-option` button. A keyboard-only user cannot focus or select an answer option.

---

## 2. Reproduction Steps

1. Launch application in Playwright or browser at `/`.
2. Press `Tab` through `#screenExamSetup`. Focus jumps from `#examCategorySelect` directly to `button[data-action="start-exam"]`, completely skipping question count radio options.
3. Start an exam and inspect focus order in `#screenActiveExam`.
4. Press `Tab` through the question card: focus jumps directly to `.btn-eliminate-option`, skipping `.option-item`.
5. Pressing `Space` or `Enter` on `.option-item` fails to select the option.

---

## 3. Expected vs. Actual Behavior

- **Expected**: In accordance with WCAG 2.1 Principle 2 (Operable) and project standard `docs/standards/05-HTML-A11Y-RTL.md`, all interactive controls must be reachable via `Tab` and activatable via `Space` / `Enter`.
- **Actual**: Option inputs are removed from tab order with `display: none`, and answer option cards are un-focusable `<div>` elements without keyboard event listeners.

---

## 4. Recommended Remediation

1. In `app/styles/components/forms.css`: Replace `display: none;` on `.pill-option input` with accessible visually-hidden styling (e.g. `position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none;`) and add `:focus-visible` styling to `.pill-badge`.
2. In `app/js/features/exam/exam-view.js`: Add `item.tabIndex = 0;` and `item.setAttribute('role', 'button');` to `.option-item`.
3. In `app/js/core/events.js`: Add keyboard delegation listening for `Enter` and `Space` keydown events on `[data-action]` elements.
