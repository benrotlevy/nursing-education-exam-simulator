import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone SE (320x568 Portrait)', width: 320, height: 568 },
  { name: 'Landscape Rotation (568x320)', width: 568, height: 320 },
];

test.describe('UX-01: Ultra-Narrow Viewport (320px) & Viewport Rotation Stress', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name}`, () => {
      test('maintains zero horizontal scrolling across all screens [UX-01]', async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

        const screens = [
          { tabBtn: '#bNavExam', desktopBtn: '#tabExam', screenId: '#screenExamSetup' },
          { tabBtn: '#bNavStudy', desktopBtn: '#tabStudy', screenId: '#screenStudyMode' },
          { tabBtn: '#bNavSaved', desktopBtn: '#tabSavedExams', screenId: '#screenSavedExams' },
          { tabBtn: '#bNavStats', desktopBtn: '#tabStats', screenId: '#screenStats' },
        ];

        for (const s of screens) {
          const mobileNav = page.locator(s.tabBtn);
          if (await mobileNav.isVisible()) {
            await mobileNav.click();
          } else {
            await page.locator(s.desktopBtn).click();
          }
          await expect(page.locator(s.screenId)).toBeVisible();

          const hasOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth;
          });
          expect(
            hasOverflow,
            `Screen ${s.screenId} has horizontal scroll overflow at ${vp.width}x${vp.height}`
          ).toBe(false);
        }

        // Test Active Exam screen
        const mobileExamBtn = page.locator('#bNavExam');
        if (await mobileExamBtn.isVisible()) {
          await mobileExamBtn.click();
        } else {
          await page.locator('#tabExam').click();
        }
        await page.locator('#screenExamSetup button.btn-primary').click();
        await expect(page.locator('#screenActiveExam')).toBeVisible();

        const examOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(
          examOverflow,
          `Active exam screen has horizontal scroll overflow at ${vp.width}x${vp.height}`
        ).toBe(false);

        // Jump to question 10 via Quick Grid and test Exam Results screen
        await page.locator('#examQuickGrid .grid-q-btn').nth(9).click();
        await expect(page.locator('#examProgressCount')).toContainText('10 מתוך 10');

        await page.locator('#btnSubmitExam').click();
        await expect(page.locator('#appModalDialog')).toBeVisible();
        await page.locator('#appModalConfirmBtn').click();
        await expect(page.locator('#screenExamResults')).toBeVisible();

        const resultsOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(
          resultsOverflow,
          `Exam results screen has horizontal scroll overflow at ${vp.width}x${vp.height}`
        ).toBe(false);
      });

      test('verifies touch targets meet minimum 44px hit area [UX-01]', async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

        // Start 10-question exam to inspect exam buttons and distractor eliminate buttons
        await page.locator('#screenExamSetup button.btn-primary').click();
        await expect(page.locator('#screenActiveExam')).toBeVisible();

        // 1. Verify distractor elimination button hit areas (>= 44x44px)
        const eliminateButtons = page.locator('.btn-eliminate-option');
        const count = await eliminateButtons.count();
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
          const btn = eliminateButtons.nth(i);
          const box = await btn.boundingBox();
          expect(box, `Eliminate button ${i} bounding box must exist`).toBeTruthy();
          expect(
            box.width,
            `Eliminate button ${i} width (${box.width}px) must be >= 44px at ${vp.width}x${vp.height}`
          ).toBeGreaterThanOrEqual(44);
          expect(
            box.height,
            `Eliminate button ${i} height (${box.height}px) must be >= 44px at ${vp.width}x${vp.height}`
          ).toBeGreaterThanOrEqual(44);
        }
      });

      test('verifies zero overlap between option text and eliminate buttons [UX-01]', async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

        await page.locator('#screenExamSetup button.btn-primary').click();
        await expect(page.locator('#screenActiveExam')).toBeVisible();

        const optionItems = page.locator('#examOptionsContainer .option-item');
        const count = await optionItems.count();
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
          const item = optionItems.nth(i);
          const content = item.locator('.option-content');
          const elimBtn = item.locator('.btn-eliminate-option');

          const contentBox = await content.boundingBox();
          const elimBox = await elimBtn.boundingBox();

          expect(contentBox).toBeTruthy();
          expect(elimBox).toBeTruthy();

          // Check for geometric bounding box overlap
          const overlapsX =
            contentBox.x < elimBox.x + elimBox.width && contentBox.x + contentBox.width > elimBox.x;
          const overlapsY =
            contentBox.y < elimBox.y + elimBox.height &&
            contentBox.y + contentBox.height > elimBox.y;

          const isOverlapping = overlapsX && overlapsY;
          expect(
            isOverlapping,
            `Option content and eliminate button must not overlap in option ${i} at ${vp.width}x${vp.height}`
          ).toBe(false);
        }
      });
    });
  }
});
