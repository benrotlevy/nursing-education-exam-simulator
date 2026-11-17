import { test, expect } from '@playwright/test';

test.describe('Progressive Web App (PWA) Offline Support', () => {
  test('registers manifest and Service Worker cleanly and runs offline after reload', async ({
    page,
    context,
  }) => {
    const pageErrors = [];
    const onlineConsoleErrors = [];
    let isOffline = false;

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isOffline) {
        onlineConsoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    // Verify manifest is linked and served with application/manifest+json
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('./manifest.webmanifest');
    const manifestResp = await page.request.get('./manifest.webmanifest');
    expect(manifestResp.status()).toBe(200);
    expect(manifestResp.headers()['content-type']).toContain('application/manifest+json');

    // Wait for Service Worker to install and activate, then reload so it controls the client
    const swActive = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active);
    });
    expect(swActive).toBe(true);

    await page.reload();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        throw new Error('Expected active Service Worker to control page after reload');
      }
    });

    // Switch browser context completely offline and reload the full app
    isOffline = true;
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

      // Verify Exam Mode can still launch & answer a question offline
      await page.locator('[data-action="start-exam"]').click();
      await expect(page.locator('#screenActiveExam')).toHaveClass(/active/);
      await expect(page.locator('#examQText')).not.toHaveText('');
      await page
        .locator('#examOptionsContainer [data-action="select-exam-option"]')
        .first()
        .click();

      // Switch to Study Mode and verify question rendering offline
      await page.locator('[data-action="switch-tab"][data-tab="study"]:visible').click();
      await expect(page.locator('#screenStudyMode')).toHaveClass(/active/);
      await expect(page.locator('#studyQText')).not.toHaveText('');
    } finally {
      await context.setOffline(false);
    }

    expect(pageErrors).toEqual([]);
    expect(onlineConsoleErrors).toEqual([]);
  });

  test('updates #syncStatusIndicator offline/online and keeps report dialog responsive offline', async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      let authCallback = null;
      let currentMockUser = null;
      const authInstance = {
        get currentUser() {
          return currentMockUser;
        },
      };

      window.__E2E_FIREBASE_SDK__ = {
        initializeApp: () => ({ name: 'e2e-pwa-app' }),
        getAuth: () => authInstance,
        getFirestore: () => ({ name: 'e2e-pwa-db' }),
        GoogleAuthProvider: class {
          setCustomParameters() {}
        },
        onAuthStateChanged: (_auth, cb) => {
          authCallback = cb;
          setTimeout(() => cb(currentMockUser), 0);
          return () => {
            authCallback = null;
          };
        },
        signInWithPopup: async () => {
          currentMockUser = {
            uid: 'e2e-pwa-user',
            displayName: 'אחות מעשית',
            email: 'nurse.pwa@example.com',
          };
          if (authCallback) await authCallback(currentMockUser);
          return { user: currentMockUser };
        },
        signOut: async () => {
          currentMockUser = null;
          if (authCallback) await authCallback(null);
        },
        collection: (_db, name) => ({ path: name }),
        doc: (_db, col, id) => ({ path: `${col}/${id}`, id }),
        query: (ref) => ref,
        where: () => ({}),
        orderBy: () => ({}),
        limit: () => ({}),
        getDoc: async (ref) => {
          if (ref?.path?.startsWith('allowed_users/')) {
            return {
              exists: () => true,
              data: () => ({ active: true, status: 'APPROVED', email: ref.id }),
            };
          }
          return { exists: () => false, data: () => null };
        },
        setDoc: async () => {},
        addDoc: async () => ({ id: 'rpt_online' }),
        onSnapshot: () => () => {},
      };
    });

    await page.goto('/');
    await page.locator('#btnGoogleSignIn').click();
    const syncIndicator = page.locator('#syncStatusIndicator');
    await expect(syncIndicator).toContainText('☁️ סנכרון ענן פעיל');

    // Verify dismissible PWA install split-pill fits without horizontal overflow and remembers dismissal
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    });
    const installBanner = page.locator('#pwaInstallBanner');
    await expect(installBanner).toBeVisible();
    await expect(page.locator('#btnInstallPwa')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.locator('#btnDismissInstallPwa').click();
    await expect(installBanner).toBeHidden();
    const persistedDismiss = await page.evaluate(() =>
      localStorage.getItem('nursing_pwa_install_dismissed_v1')
    );
    expect(persistedDismiss).toBe('1');

    // Subsequent beforeinstallprompt events must keep the banner hidden once dismissed
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    });
    await expect(installBanner).toBeHidden();

    // Switch browser offline and confirm indicator updates cleanly
    await context.setOffline(true);
    try {
      await expect(syncIndicator).toContainText('📴 מצב לא מקוון');
      await expect(syncIndicator).toHaveClass(/sync-indicator-offline/);

      // Open Report dialog in Study mode and submit while offline: must fail gracefully without freezing
      await page.locator('[data-action="switch-tab"][data-tab="study"]:visible').click();
      await page.locator('#btnReportStudyQuestion').click();
      await expect(page.locator('#reportIssueDialog')).toHaveAttribute('open', '');

      await page.locator('#reportCommentInput').fill('בדיקת דיווח בזמן חוסר חיבור לרשת.');
      await page.locator('#reportSubmitBtn').click();

      await expect(page.locator('#reportErrorBox')).toContainText('לא מקוון');
      await expect(page.locator('#reportSubmitBtn')).toBeEnabled();
      await expect(page.locator('#reportCancelBtn')).toBeEnabled();

      // Cancel must cleanly close the dialog without trapping the user
      await page.locator('#reportCancelBtn').click();
      await expect(page.locator('#reportIssueDialog')).not.toHaveAttribute('open', '');
    } finally {
      await context.setOffline(false);
    }

    // Reconnecting must restore the green synced indicator
    await expect(syncIndicator).toContainText('☁️ סנכרון ענן פעיל');
    await expect(syncIndicator).not.toHaveClass(/sync-indicator-offline/);
  });
});
