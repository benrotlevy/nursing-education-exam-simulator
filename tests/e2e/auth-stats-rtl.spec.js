import { test, expect } from '@playwright/test';

test.describe('AUTH-RTL: Statistics Cloud Sync Badge & Saved Exams Count RTL Bidi Ordering', () => {
  test('renders "Google:" immediately adjacent to "מחובר לחשבון" without BiDi inversion across viewports', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    // Wait for app controller initialization
    await page.waitForFunction(() => Boolean(window.app?.authController));

    const isMobile = Boolean(page.viewportSize() && page.viewportSize().width <= 640);
    // Switch to Statistics tab
    await page.locator(isMobile ? '#bNavStats' : '#tabStats').click();
    await expect(page.locator('#screenStats')).toBeVisible();

    // Render authenticated user into DOM and lock state against background auth callbacks
    await page.evaluate(() => {
      const mockUser = {
        uid: 'test-user-123',
        displayName: 'Benjamin Rotlevy',
        email: 'benjamin.rotlevy@gmail.com',
      };
      if (window.app?.authController) {
        const originalRender = window.app.authController.renderUser;
        window.app.authController.renderUser = () => originalRender(mockUser);
        window.app.authController.renderUser(mockUser);
      }
    });

    const badge = page.locator('#statsCloudSyncInfo');
    await expect(badge).toBeVisible();

    // Verify DOM structure contains isolated bdi elements
    const googleBdi = badge.locator('.cloud-sync-active-title bdi');
    await expect(googleBdi).toHaveText('Google');

    const nameBdi = badge.locator('.user-display-name');
    await expect(nameBdi).toHaveText('Benjamin Rotlevy');

    // Verify visual horizontal positioning:
    // In RTL, items progress from right (higher x) to left (lower x):
    // 1. Rightmost: 'מחובר לחשבון'
    // 2. Middle-right: 'Google' followed immediately by ':'
    // 3. Middle-left: 'Benjamin Rotlevy'
    // 4. Followed by: 'סנכרון ענן פעיל' (on same line or wrapped on mobile)
    const positions = await page.evaluate(() => {
      const el = document.getElementById('statsCloudSyncInfo');
      const getBox = (text) => {
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let n;
        while ((n = walk.nextNode())) {
          const idx = n.nodeValue.indexOf(text);
          if (idx !== -1) {
            const range = document.createRange();
            range.setStart(n, idx);
            range.setEnd(n, idx + text.length);
            const r = range.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
            };
          }
        }
        return null;
      };

      return {
        connected: getBox('מחובר לחשבון'),
        google: getBox('Google'),
        colon: getBox(':'),
        name: getBox('Benjamin Rotlevy'),
        sync: getBox('סנכרון ענן פעיל'),
      };
    });

    expect(positions.connected).not.toBeNull();
    expect(positions.google).not.toBeNull();
    expect(positions.colon).not.toBeNull();
    expect(positions.name).not.toBeNull();
    expect(positions.sync).not.toBeNull();

    // 1. RTL sequence: connected is to the right of google on the same line
    expect(positions.connected.left).toBeGreaterThanOrEqual(positions.google.right - 10);

    // 2. Colon is adjacent to Google on the left (RTL progression)
    expect(positions.google.left).toBeLessThanOrEqual(positions.colon.right + 2);

    // 3. Name is to the left of Google / colon if on the same line
    if (Math.abs(positions.name.top - positions.google.top) < 10) {
      expect(positions.colon.left).toBeGreaterThanOrEqual(positions.name.right - 10);
    }

    // 4. Sync indicator is to the left of name if on the same line
    if (Math.abs(positions.sync.top - positions.name.top) < 10) {
      expect(positions.name.left).toBeGreaterThanOrEqual(positions.sync.right - 10);
    }
  });

  test('renders saved exams slots count with LTR direction to prevent 3/2 fraction inversion', async ({
    page,
  }) => {
    await page.goto('/');
    const isMobile = Boolean(page.viewportSize() && page.viewportSize().width <= 640);
    await page.locator(isMobile ? '#bNavSaved' : '#tabSavedExams').click();
    await expect(page.locator('#screenSavedExams')).toBeVisible();

    const slotsCount = page.locator('#savedSlotsCount');
    await expect(slotsCount).toBeVisible();

    // Check computed direction
    const direction = await slotsCount.evaluate((el) => window.getComputedStyle(el).direction);
    expect(direction).toBe('ltr');
  });
});
