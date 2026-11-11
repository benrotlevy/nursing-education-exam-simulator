import { test, expect } from '@playwright/test';

test.describe('Characterization E2E Suite (Laptop, Tablet, Pixel 10 Pro XL, Galaxy S25)', () => {
  test('renders appropriate responsive navigation and zero horizontal overflow across all 4 screens [NAV-01..03, A11Y-01]', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');
    const viewport = page.viewportSize();
    const isSmartphone = viewport && viewport.width <= 640;

    if (isSmartphone) {
      await expect(page.locator('#mobileBottomNav')).toBeVisible();
      await expect(page.locator('#mobileSectionIndicator')).toBeVisible();
      await expect(page.locator('.nav-tabs')).toBeHidden();
    } else {
      await expect(page.locator('.nav-tabs')).toBeVisible();
      await expect(page.locator('#mobileBottomNav')).toBeHidden();
    }

    const tabs = [
      { tab: 'exam', desktopBtn: '#tabExam', mobileBtn: '#bNavExam', screen: '#screenExamSetup' },
      {
        tab: 'study',
        desktopBtn: '#tabStudy',
        mobileBtn: '#bNavStudy',
        screen: '#screenStudyMode',
      },
      {
        tab: 'saved-exams',
        desktopBtn: '#tabSavedExams',
        mobileBtn: '#bNavSaved',
        screen: '#screenSavedExams',
      },
      { tab: 'stats', desktopBtn: '#tabStats', mobileBtn: '#bNavStats', screen: '#screenStats' },
    ];

    for (const item of tabs) {
      const trigger = isSmartphone ? item.mobileBtn : item.desktopBtn;
      await page.locator(trigger).click();
      await expect(page.locator(item.screen)).toBeVisible();

      // Verify zero horizontal overflow on this screen at this device size
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow).toBe(false);
    }
  });

  test('completes Exam Mode flow: start 10-question exam, select, eliminate, flag, and submit [EXAM-01..09]', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    // Start 10-question exam
    await page.locator('#screenExamSetup button.btn-primary').click();
    await expect(page.locator('#screenActiveExam')).toBeVisible();
    await expect(page.locator('#examProgressCount')).toContainText('1 מתוך 10');

    // Select first option
    const firstOption = page.locator('#examOptionsContainer .option-item').first();
    await firstOption.click();
    await expect(firstOption).toHaveClass(/selected/);

    // Eliminate first option -> should unselect and mark eliminated
    await firstOption.locator('.btn-eliminate-option').click();
    await expect(firstOption).toHaveClass(/eliminated/);
    await expect(firstOption).not.toHaveClass(/selected/);

    // Flag question
    await page.locator('#examFlagBtn').click();
    await expect(page.locator('#examFlagBtn')).toHaveClass(/flagged/);

    // Jump to question 10 via Quick Grid
    await page.locator('#examQuickGrid .grid-q-btn').nth(9).click();
    await expect(page.locator('#examProgressCount')).toContainText('10 מתוך 10');

    // Accept unanswered confirmation modal (<dialog>) and submit
    await page.locator('#btnSubmitExam').click();
    await expect(page.locator('#appModalDialog')).toBeVisible();
    await page.locator('#appModalConfirmBtn').click();

    await expect(page.locator('#screenExamResults')).toBeVisible();
    await expect(page.locator('#resTotalCount')).toHaveText('10');
    await expect(page.locator('#examReviewList .expl-rationale-block').first()).toBeAttached();
  });

  test('completes Study Mode flow and copies AI prompt without modal alerts [STUDY-01..05]', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    const viewport = page.viewportSize();
    const isSmartphone = viewport && viewport.width <= 640;
    await page.locator(isSmartphone ? '#bNavStudy' : '#tabStudy').click();
    await expect(page.locator('#screenStudyMode')).toBeVisible();

    let alertFired = false;
    page.on('dialog', (dialog) => {
      alertFired = true;
      dialog.dismiss();
    });

    // Click first study option
    await page.locator('#studyOptionsContainer .option-item').first().click();
    await expect(page.locator('#studyExplanationBox')).toBeVisible();

    // Click Copy for AI button
    await page.locator('#btnCopyStudyAI').click();
    expect(alertFired).toBe(false);
    await expect(page.locator('#appGlobalToast')).toContainText('הועתקו בהצלחה');
  });

  test('reserves and releases a Saved Exam and updates active question pool counter [SAVED-01..05]', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    const viewport = page.viewportSize();
    const isSmartphone = viewport && viewport.width <= 640;
    await page.locator(isSmartphone ? '#bNavSaved' : '#tabSavedExams').click();
    await expect(page.locator('#screenSavedExams')).toBeVisible();

    await page.locator('#savedAddSection button.btn-primary').click();
    await expect(page.locator('#savedSlotsCount')).toHaveText('1 / 3');
    await expect(page.locator('#totalQuestionsHeader')).not.toContainText('מאגר פעיל: 1079');

    // Release saved exam via accessible <dialog> confirmation
    await page.locator('#savedExamsList .saved-slot-card button.btn-outline').click();
    await expect(page.locator('#appModalDialog')).toBeVisible();
    await page.locator('#appModalConfirmBtn').click();
    await expect(page.locator('#savedSlotsCount')).toHaveText('0 / 3');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');
  });

  test('verifies CSP meta tag, RTL/ARIA landmarks, Practice Weakest Category, and Stats Reset across viewports [STATS-03, STATS-04, A11Y-01]', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    // 1. Verify RTL document attributes and landmarks [A11Y-01]
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    // 2. Verify Content-Security-Policy meta tag forbids unsafe-inline scripts
    const cspContent = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(cspContent).toBeTruthy();
    const scriptSrcDirective =
      cspContent
        ?.split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith('script-src')) || '';
    expect(scriptSrcDirective).toContain("'self'");
    expect(scriptSrcDirective).not.toContain("'unsafe-inline'");

    // 3. Answer a question in Study Mode so a category has >= 1 answered, then test Practice Weakest Category [STATS-03]
    const viewport = page.viewportSize();
    const isSmartphone = viewport && viewport.width <= 640;
    await page.locator(isSmartphone ? '#bNavStudy' : '#tabStudy').click();
    await page.locator('#studyOptionsContainer .option-item').first().click();

    await page.locator(isSmartphone ? '#bNavStats' : '#tabStats').click();
    await expect(page.locator('#screenStats')).toBeVisible();
    await expect(page.locator('#statTotalAnswered')).toHaveText('1');

    await page.locator('[data-action="practice-weakest-category"]').click();
    await expect(page.locator('#screenStudyMode')).toBeVisible();
    await expect(page.locator('#studyCategoryFilter')).not.toHaveValue('ALL');

    // 4. Navigate back to Stats and reset statistics via accessible <dialog> [STATS-04]
    await page.locator(isSmartphone ? '#bNavStats' : '#tabStats').click();
    await page.locator('[data-action="confirm-reset-stats"]').click();
    await expect(page.locator('#appModalDialog')).toBeVisible();
    await page.locator('#appModalConfirmBtn').click();
    await expect(page.locator('#statTotalAnswered')).toHaveText('0');
  });
});
