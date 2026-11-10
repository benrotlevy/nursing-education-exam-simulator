# 05 — HTML5, Accessibility (a11y) & RTL Standard

## 1. Document Root & RTL Configuration

- `app/index.html` must declare:
  ```html
  <!DOCTYPE html>
  <html lang="he" dir="rtl">
  ```
- `<meta charset="UTF-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1.0">` are mandatory.

---

## 2. Semantic Landmarks

Every screen and region must use proper HTML5 landmarks so screen readers and assistive technologies can navigate effortlessly:
- `<header>`: Application title, active question pool counter, and cloud authentication controls.
- `<nav aria-label="ניווט ראשי">`: Desktop top tab bar.
- `<nav id="mobileBottomNav" aria-label="ניווט ראשי למכשירים ניידים">`: Mobile bottom navigation bar.
- `<main id="appMain">`: Contains the top-level `<section class="screen" ...>` views.
- `<footer>`: Copyright and version attribution.
- `<dialog id="appDialog">`: Native modal dialog for confirmations and alerts.

---

## 3. Interactive Elements & Keyboard Navigation

1. **Buttons vs. Links**:
   - Any control that triggers an in-app action (selecting an answer, switching tabs, eliminating a distractor, copying for AI) **must** be a `<button type="button">` (or `<input>`/`<select>`).
   -Clickable `<div>` or `<span>` elements without keyboard support are prohibited, except when a composite card container contains nested interactive buttons (such as an option row that contains a separate nested `.btn-eliminate-option` button), in which case the container must have `role="button"`, `tabindex="0"`, and handle `Enter` / `Space` keydown events in `core/events.js`.
2. **Visible Focus States**:
   - Never remove `:focus` outlines without providing a high-contrast `:focus-visible` ring (`outline: 2px solid var(--color-primary); outline-offset: 2px;`).
3. **Form Labels**:
   - Every `<select>` and `<input>` must have an associated `<label for="...">` or `aria-label="..."`.

---

## 4. ARIA Patterns

- **Tabs / Navigation**:
  - Active navigation buttons must set `aria-current="page"` (or `aria-selected="true"`) in addition to the `.active` visual class.
- **Live Regions**:
  - `#appGlobalToast` must have `role="status"` and `aria-live="polite"`.
  - Exam progress and study feedback areas should announce state changes cleanly.
- **Hidden Screens**:
  - Inactive `.screen` sections have `display: none` (and `hidden` attribute where appropriate) so inactive controls are excluded from the accessibility tree and tab order.

---

## 5. Mobile Touch Targets & Contrast (WCAG 2.1 AA)

- **Minimum Tap Target**: Interactive controls on mobile (`<= 640px`) must have a minimum hit area of **44 × 44 CSS pixels** (or sufficient spacing so adjacent targets cannot be mis-tapped).
- **Color Contrast**:
  - Normal text must maintain at least **4.5:1** contrast ratio against its background.
  - Status states (correct green, wrong red, eliminated strikethrough) must never rely on color alone — they always pair color with an explicit icon/badge (`✓ תשובה נכונה`, `✗ הבחירה שלך`, `✕ מסיח שגוי`, strikethrough line).
