import { test, expect } from '@playwright/test';

test.describe('SAVED-TOAST: Saved Exam Success Notification Layout & Responsiveness', () => {
  test('renders long success message properly contained, wrapped, and elevated above nav bar across all device viewports', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    const viewport = page.viewportSize();
    const isMobile = Boolean(viewport && viewport.width <= 640);

    // Navigate to Saved Exams tab
    await page.locator(isMobile ? '#bNavSaved' : '#tabSavedExams').click();
    await expect(page.locator('#screenSavedExams')).toBeVisible();

    // Select the long title exam matching user's scenario: 'שחזור מבחן מתכונת בית חולים מאיר 18.11.2020'
    const select = page.locator('#savedExamSourceSelect');
    await select.selectOption('שחזור מבחן מתכונת בית חולים מאיר 18.11.2020');

    // Click 'שמור ונעל מבחן זה'
    await page.locator('#savedAddSection button.btn-primary').click();

    // Verify toast notification appears
    const toast = page.locator('#appGlobalToast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/visible/);

    // Verify full Hebrew text is present without truncation
    await expect(toast).toContainText('בית חולים מאיר 18.11.2020');
    await expect(toast).toContainText('נשמר בהצלחה!');
    await expect(toast).toContainText('188 שאלות בודדו מחוץ למאגר');

    // Verify bounding box and layout containment within viewport
    const toastBox = await toast.boundingBox();
    expect(toastBox).not.toBeNull();
    if (!toastBox || !viewport) return;

    // 1. Horizontal containment: must not overflow left or right of viewport
    expect(toastBox.x).toBeGreaterThanOrEqual(8);
    expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(viewport.width - 8);

    // 2. Vertical containment: must remain within viewport
    expect(toastBox.y).toBeGreaterThanOrEqual(0);
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(viewport.height);

    // 3. On mobile viewports: must be elevated above bottom nav bar (height 64px)
    if (isMobile) {
      const bottomNav = page.locator('.mobile-bottom-nav');
      await expect(bottomNav).toBeVisible();
      const navBox = await bottomNav.boundingBox();
      if (navBox) {
        // The bottom of the toast must be above the top of the mobile bottom nav bar
        expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(navBox.y);
      }
    }

    // 4. Zero document-level horizontal scrollbar created by the toast
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 5. Computed styling verifies wrapping and text alignment
    const computedStyles = await toast.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        whiteSpace: s.whiteSpace,
        textAlign: s.textAlign,
      };
    });
    expect(computedStyles.whiteSpace).toBe('normal');
    expect(computedStyles.textAlign).toBe('center');

    // Capture visual snapshot for Pixel 10 Pro XL verification
    if (test.info().project.name === 'pixel-10-pro-xl') {
      await page.screenshot({ path: 'test-results/pixel-10-pro-xl-toast.png', fullPage: false });
    }
  });
});
