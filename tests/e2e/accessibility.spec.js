import { test, expect } from '@playwright/test';

test.describe('A11Y-02: Full Keyboard-Only Navigation Workflow (E2E)', () => {
  test('navigates complete exam flow using only keyboard: Tab, Space, Enter, and Arrow keys [A11Y-02]', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    // 1. Navigate to and select 10-question option using keyboard
    // Focus the category selector and Tab toward the question count option
    await page.locator('#examCategorySelect').focus();
    await page.keyboard.press('Tab');

    // A keyboard user should land on the exam count radio group / 10-question option
    const count10Radio = page.locator('input[name="examCount"][value="10"]');
    await expect(
      count10Radio,
      '10-question exam count radio option must be focusable via Tab (not hidden with display:none)'
    ).toBeFocused();

    // Select with Space key
    await page.keyboard.press('Space');
    await expect(count10Radio).toBeChecked();

    // Tab to Start Exam button
    await page.keyboard.press('Tab');
    const startBtn = page.locator('#screenExamSetup button[data-action="start-exam"]');
    await expect(startBtn).toBeFocused();
    await page.keyboard.press('Enter');

    // 2. Active Exam screen loads
    await expect(page.locator('#screenActiveExam')).toBeVisible();
    await expect(page.locator('#examProgressCount')).toContainText('1 מתוך 10');

    // 3. Navigate options and select first option using keyboard
    // Per WCAG 2.1 Principle 2 & Standard 05-HTML-A11Y-RTL, answer options must have tabindex="0" and receive keyboard focus
    await page.keyboard.press('Tab');
    const firstOption = page.locator('#examOptionsContainer .option-item').first();
    await expect(
      firstOption,
      'Option item must be navigable and focusable via keyboard (tabindex="0")'
    ).toBeFocused();

    await page.keyboard.press('Space');
    await expect(firstOption, 'Option item must be selectable with Space or Enter key').toHaveClass(
      /selected/
    );

    // 4. Eliminate option with keyboard/focus:
    // Tab to distractor elimination button within option
    const elimBtn = firstOption.locator('.btn-eliminate-option');
    await elimBtn.focus();
    await expect(elimBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(firstOption).toHaveClass(/eliminated/);
    await expect(firstOption).not.toHaveClass(/selected/);

    // 5. Flag question using keyboard
    const flagBtn = page.locator('#examFlagBtn');
    await flagBtn.focus();
    await expect(flagBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(flagBtn).toHaveClass(/flagged/);

    // 6. Advance to next question using keyboard
    const nextBtn = page.locator('#btnNextExam');
    await nextBtn.focus();
    await expect(nextBtn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#examProgressCount')).toContainText('2 מתוך 10');

    // 7. Jump to Question 10 using keyboard on Quick Grid
    const q10Btn = page.locator('#examQuickGrid .grid-q-btn').nth(9);
    await q10Btn.focus();
    await expect(q10Btn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#examProgressCount')).toContainText('10 מתוך 10');

    // 8. Submit exam using keyboard
    const submitBtn = page.locator('#btnSubmitExam');
    await expect(submitBtn).toBeVisible();
    await submitBtn.focus();
    await expect(submitBtn).toBeFocused();
    await page.keyboard.press('Enter');

    // 9. Confirm modal dialog using keyboard
    await expect(page.locator('#appModalDialog')).toBeVisible();
    const confirmBtn = page.locator('#appModalConfirmBtn');
    await confirmBtn.focus();
    await expect(confirmBtn).toBeFocused();
    await page.keyboard.press('Enter');

    // 10. Verify Exam Results screen appears
    await expect(page.locator('#screenExamResults')).toBeVisible();
    await expect(page.locator('#resTotalCount')).toHaveText('10');
  });
});
