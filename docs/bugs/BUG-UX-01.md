# Defect Report: BUG-UX-01

**Requirement**: `UX-01` (Ultra-Narrow Viewport 320px & Viewport Rotation Stress)  
**Severity**: Medium (WCAG 2.1 AA Target Size Non-Conformance / Mobile Touch Usability)  
**Status**: Resolved in v3.0  
**Affected Files**:

- `app/styles/components/buttons.css` (lines 201–221, lines 240–244)

---

## 1. Description

On mobile viewports (including ultra-narrow iPhone SE at `320×568` and rotated `568×320` landscape), the distractor elimination button (`.btn-eliminate-option`) has an undersized hit area that violates the 44×44px minimum touch target size requirement:

In `app/styles/components/buttons.css`:

```css
.btn-eliminate-option {
  width: 28px;
  height: 28px;
  ...
}

@media (max-width: 640px) {
  .btn-eliminate-option {
    width: 26px;
    height: 26px;
    font-size: 0.75rem;
  }
}
```

On mobile screens (`<= 640px`), the button dimensions shrink down to **26 × 26 CSS pixels**. This is substantially below the **44 × 44 CSS pixels** minimum touch target standard prescribed by WCAG 2.1 Success Criterion 2.5.5, WCAG 2.2 SC 2.5.8, and the project standard in `docs/standards/05-HTML-A11Y-RTL.md` (Section 5).

---

## 2. Reproduction Steps

1. Run Playwright responsive stress suite:
   `npx playwright test tests/e2e/responsive-stress.spec.js`
2. Inspect test failures under `verifies touch targets meet minimum 44px hit area [UX-01]`:
   - `Eliminate button 0 width (26px) must be >= 44px at 320x568`
   - `Eliminate button 0 height (26px) must be >= 44px at 568x320`

---

## 3. Expected vs. Actual Behavior

- **Expected**: Interactive touch targets on mobile viewports must maintain a minimum bounding box of 44 × 44px (or sufficient touch target padding / pseudo-element clearance) to prevent mis-taps.
- **Actual**: The distractor elimination button measures only 26 × 26px on mobile viewports, leading to potential accidental clicks on the parent `.option-item` answer card.

---

## 4. Recommended Remediation

In `app/styles/components/buttons.css`, expand the touch hit area of `.btn-eliminate-option` to at least 44×44px without altering its visual compactness, using an invisible pseudo-element:

```css
.btn-eliminate-option {
  position: relative;
}

.btn-eliminate-option::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 44px;
  min-height: 44px;
}
```

Or increase the padding and dimensions of `.btn-eliminate-option` on mobile to `min-width: 44px; min-height: 44px;`.
