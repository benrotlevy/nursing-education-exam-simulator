import { test, expect } from '@playwright/test';

function injectMockFirebaseScript(initialUser = null, initialReports = {}) {
  return `
    (() => {
      const storeMap = new Map(Object.entries(${JSON.stringify(initialReports)}));
      let authCb = null;
      let currentUser = ${JSON.stringify(initialUser)};
      let countCb = null;

      const emitCount = () => {
        if (!countCb) return;
        const openDocs = Array.from(storeMap.entries())
          .filter(([, d]) => d.status === 'OPEN')
          .map(([id, d]) => ({ id, data: () => d }));
        countCb({ size: openDocs.length, docs: openDocs });
      };

      window.__E2E_FIREBASE_SDK__ = {
        GoogleAuthProvider: class {},
        initializeApp: () => ({}),
        getAuth: () => ({ get currentUser() { return currentUser; } }),
        onAuthStateChanged: (_auth, cb) => {
          authCb = cb;
          cb(currentUser);
          return () => { authCb = null; };
        },
        signInWithPopup: async () => ({ user: currentUser }),
        signOut: async () => {
          currentUser = null;
          if (authCb) authCb(null);
        },
        getFirestore: () => ({}),
        collection: (_db, name) => ({ path: name }),
        doc: (_db, col, id) => ({ path: col, id }),
        query: (c) => c,
        where: () => ({}),
        orderBy: () => ({}),
        limit: () => ({}),
        getDoc: async () => ({ exists: () => false, data: () => ({}) }),
        setDoc: async (ref, data) => {
          if (ref.path === 'question_reports') {
            storeMap.set(ref.id, { ...data });
            emitCount();
          }
        },
        addDoc: async (_col, data) => {
          const id = 'e2e_rpt_' + (storeMap.size + 1);
          storeMap.set(id, { ...data });
          emitCount();
          return { id };
        },
        updateDoc: async (ref, data) => {
          const prev = storeMap.get(ref.id) || {};
          storeMap.set(ref.id, { ...prev, ...data });
          emitCount();
        },
        deleteDoc: async (ref) => {
          storeMap.delete(ref.id);
          emitCount();
        },
        getDocs: async () => ({
          docs: Array.from(storeMap.entries()).map(([id, data]) => ({
            id,
            data: () => data,
          })),
        }),
        onSnapshot: (ref, onNext) => {
          if (ref && ref.path === 'question_reports') {
            countCb = onNext;
            emitCount();
          }
          return () => { countCb = null; };
        },
      };
      window.__E2E_REPORTS_MAP__ = storeMap;
    })();
  `;
}

test.describe('RPT-E2E: Question Issue Reporting & Admin Dashboard Flows', () => {
  test('signed-in student opens Report modal from Study Mode, submits report cleanly across viewports', async ({
    page,
  }) => {
    const webhookRequests = [];
    await page.route('https://*.workers.dev/**', async (route) => {
      webhookRequests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.addInitScript(
      injectMockFirebaseScript({
        uid: 'stu_e2e_1',
        displayName: 'סטודנט בדיקה',
        email: 'student@example.com',
      })
    );

    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');
    await expect(page.locator('#btnAdminReports')).toBeHidden();

    const viewport = page.viewportSize();
    const isMobile = Boolean(viewport && viewport.width <= 640);
    await page.locator(isMobile ? '#bNavStudy' : '#tabStudy').click();
    await expect(page.locator('#screenStudyMode')).toBeVisible();

    await page.locator('#btnReportStudyQuestion').click();
    const dialog = page.locator('#reportIssueDialog');
    await expect(dialog).toBeVisible();

    // Ensure modal does not create horizontal overflow on mobile or desktop
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);

    const keyPill = dialog.locator('button[data-issue-type="KEY_ERROR"]');
    const typoPill = dialog.locator('button[data-issue-type="TYPO_TEXT"]');
    await expect(keyPill).toHaveAttribute('aria-pressed', 'true');
    await expect(keyPill).toHaveClass(/\bactive\b/);
    await expect(typoPill).toHaveAttribute('aria-pressed', 'false');

    const selectedBg = await keyPill.evaluate((el) => getComputedStyle(el).backgroundColor);
    const unselectedBg = await typoPill.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(selectedBg).not.toBe(unselectedBg);

    await typoPill.click();
    await expect(typoPill).toHaveAttribute('aria-pressed', 'true');
    await expect(typoPill).toHaveClass(/\bactive\b/);
    await expect(keyPill).toHaveAttribute('aria-pressed', 'false');
    await expect(keyPill).not.toHaveClass(/\bactive\b/);

    await dialog.locator('#reportCommentInput').fill('חסרה מילה בסוף השאלה.');
    await dialog.locator('#reportSubmitBtn').click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('#appGlobalToast')).toContainText('הדיווח נשלח ונשמר בהצלחה');
    expect(webhookRequests).toHaveLength(1);
    expect(webhookRequests[0].type).toBe('QUESTION_ISSUE_REPORT');
    expect(webhookRequests[0].issueType).toBe('TYPO_TEXT');
    expect(webhookRequests[0].questionPreview).toBeTruthy();
  });

  test('authorized admin sees open badge count and resolves reported question in Admin Dashboard', async ({
    page,
  }) => {
    await page.addInitScript(
      injectMockFirebaseScript(
        {
          uid: 'admin_e2e_1',
          displayName: 'Benjamin Rotlevy',
          email: 'benjaminrotlevy@gmail.com',
        },
        {
          rpt_e2e_open: {
            questionId: 'q_0001',
            category: 'אתיקה, חוק ובטיחות המטופל',
            source: 'מבחן 2024',
            questionText: 'שאלת דוגמה',
            issueType: 'KEY_ERROR',
            comment: 'מפתח התשובה מסמן א במקום ג',
            reporterUid: 'stu_e2e_1',
            reporterName: 'נועה כהן',
            reporterEmail: 'noa@example.com',
            status: 'OPEN',
            createdAt: '2026-11-15T09:30:00.000Z',
            updatedAt: '2026-11-15T09:30:00.000Z',
          },
        }
      )
    );

    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    const adminBtn = page.locator('#btnAdminReports');
    await expect(adminBtn).toBeVisible();
    await expect(page.locator('#adminReportsBadge')).toContainText('1');

    await adminBtn.click();
    const adminDialog = page.locator('#adminReportsDialog');
    await expect(adminDialog).toBeVisible();
    await expect(adminDialog).toContainText('מפתח התשובה מסמן א במקום ג');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);

    await adminDialog.locator('button[data-admin-action="resolve"]').click();
    await expect(page.locator('#appGlobalToast')).toContainText('הדיווח סומן כתוקן');
    const toastAboveDialog = await page.evaluate(() => {
      const host = document.getElementById('appToastContainer');
      return Boolean(host && host.matches(':popover-open'));
    });
    expect(toastAboveDialog).toBe(true);
    await expect(page.locator('#adminReportsBadge')).toBeHidden();

    // Switch filter to RESOLVED and verify delete confirmation modal sits cleanly above admin dialog
    await adminDialog.locator('button[data-admin-filter="RESOLVED"]').click();
    await adminDialog.locator('button[data-admin-action="delete"]').click();
    const confirmDialog = page.locator('#appModalDialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.locator('#appModalConfirmBtn')).toHaveText('מחק דיווח');
    const confirmOnTop = await page.evaluate(() => {
      const btn = document.getElementById('appModalConfirmBtn');
      if (!btn) return false;
      const rect = btn.getBoundingClientRect();
      const topEl = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return Boolean(topEl && (topEl === btn || btn.contains(topEl)));
    });
    expect(confirmOnTop).toBe(true);
    await confirmDialog.locator('#appModalCancelBtn').click();
    await expect(confirmDialog).toBeHidden();
  });
});
