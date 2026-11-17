import { test, expect } from '@playwright/test';
import { loadTestCatalogKey } from '../helpers/load-test-questions.js';

const TEST_CATALOG_KEY = loadTestCatalogKey();

function buildAccessControlMockInit() {
  return ({ key }) => {
    const collections = {
      allowed_users: new Map(),
      app_config: new Map([
        ['catalog_key', { schemaVersion: 2, keyBase64: key }],
        ['contact', { schemaVersion: 2, telegramUrl: 'https://t.me/nursing_admin_bot' }],
      ]),
      question_reports: new Map(),
      users: new Map(),
    };

    const studentUser = {
      uid: 'stu_invite_1',
      displayName: 'שרה כהן',
      email: 'sara.cohen@nursing.ac.il',
    };
    const adminUser = {
      uid: 'admin_ben_1',
      displayName: 'Benjamin Rotlevy',
      email: 'benjaminrotlevy@gmail.com',
    };

    let activeUser = null;
    let authCallback = null;
    const pendingListeners = [];

    function emitPendingSnapshot() {
      const docs = Array.from(collections.allowed_users.entries())
        .filter(([, d]) => d.status === 'PENDING')
        .map(([id, d]) => ({ id, data: () => d }));
      for (const cb of pendingListeners) {
        cb({ size: docs.length, docs });
      }
    }

    window.__E2E_SWITCH_USER__ = async (role) => {
      activeUser = role === 'admin' ? adminUser : role === 'student' ? studentUser : null;
      if (authCallback) {
        await authCallback(activeUser);
      }
    };

    window.__E2E_FIREBASE_SDK__ = {
      GoogleAuthProvider: class {},
      initializeApp: () => ({}),
      getAuth: () => ({
        get currentUser() {
          return activeUser;
        },
      }),
      onAuthStateChanged: (_auth, cb) => {
        authCallback = cb;
        setTimeout(() => cb(activeUser), 0);
        return () => {
          authCallback = null;
        };
      },
      signInWithPopup: async () => {
        activeUser = studentUser;
        if (authCallback) await authCallback(activeUser);
        return { user: activeUser };
      },
      signOut: async () => {
        activeUser = null;
        if (authCallback) await authCallback(null);
      },
      getFirestore: () => ({}),
      collection: (_db, colName) => ({ colName }),
      doc: (_db, colName, id) => ({ colName, id }),
      query: (colRef) => colRef,
      where: () => ({}),
      orderBy: () => ({}),
      limit: () => ({}),
      getDoc: async (ref) => {
        const store = collections[ref.colName];
        const data = store ? store.get(ref.id) : null;
        return {
          exists: () => Boolean(data),
          data: () => data || null,
        };
      },
      setDoc: async (ref, data, opts) => {
        const store = collections[ref.colName];
        if (!store) return;
        const prev = store.get(ref.id) || {};
        store.set(ref.id, opts?.merge ? { ...prev, ...data } : { ...data });
        if (ref.colName === 'allowed_users') emitPendingSnapshot();
      },
      deleteDoc: async (ref) => {
        const store = collections[ref.colName];
        if (store) {
          store.delete(ref.id);
          if (ref.colName === 'allowed_users') emitPendingSnapshot();
        }
      },
      getDocs: async (ref) => {
        const store = collections[ref.colName];
        return {
          docs: store
            ? Array.from(store.entries()).map(([id, data]) => ({ id, data: () => data }))
            : [],
        };
      },
      onSnapshot: (ref, cb) => {
        if (ref?.colName === 'allowed_users') {
          pendingListeners.push(cb);
          emitPendingSnapshot();
          return () => {
            const idx = pendingListeners.indexOf(cb);
            if (idx >= 0) pendingListeners.splice(idx, 1);
          };
        }
        return () => {};
      },
    };
  };
}

test.describe('ACCESS-CONTROL E2E: Demo Mode, Telegram Approval Request & Encrypted Catalog Unlock', () => {
  test('walks through Guest 10-question Demo -> Pending request + Telegram link -> Admin 1-tap approval -> 1,079 encrypted unlock', async ({
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

    await page.addInitScript(buildAccessControlMockInit(), {
      key: TEST_CATALOG_KEY,
    });

    // 1. Guest boots in 10-question Demo Mode (with both Study & 10-Q Demo Exam allowed)
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מצב הדגמה: 10 שאלות פתוחות');
    const demoBanner = page.locator('#demoModeBanner');
    await expect(demoBanner).toBeVisible();
    await expect(demoBanner).toContainText('מצב הדגמה (10 מתוך 1079');

    // Miniature 10-question Demo Exam works for guests
    await page.locator('#screenExamSetup button[data-action="start-exam"]').click();
    await expect(page.locator('#screenActiveExam')).toBeVisible();
    await expect(page.locator('#examProgressCount')).toContainText('1 מתוך 10');

    // Abandon demo exam so we return cleanly to setup
    await page.locator('#btnAbandonExam').click();
    await page.locator('#appModalConfirmBtn').click();
    await expect(page.locator('#screenExamSetup')).toBeVisible();

    // 2. New student signs in -> auto PENDING registration + 1st Telegram notification + Telegram chat link
    await page.locator('#btnGoogleSignIn').click();
    await expect(demoBanner).toHaveClass(/is-pending/);
    await expect(demoBanner).toContainText('sara.cohen@nursing.ac.il');

    const telegramLink = page.locator('#btnTelegramAdminChat');
    await expect(telegramLink).toBeVisible();
    await expect(telegramLink).toHaveAttribute('href', 'https://t.me/nursing_admin_bot');
    expect(webhookRequests).toHaveLength(1);
    expect(webhookRequests[0].type).toBe('NEW_USER_SIGN_IN');
    expect(webhookRequests[0].email).toBe('sara.cohen@nursing.ac.il');

    // Student sends explicit request with cohort note -> 2nd Telegram notification
    await page.locator('#accessRequestNoteInput').fill('הדסה שנה ד');
    await page.locator('#btnSendAccessRequest').click();
    await expect(page.locator('#appGlobalToast')).toContainText('בקשת הגישה נשלחה');
    expect(webhookRequests).toHaveLength(2);
    expect(webhookRequests[1].isExplicitRequest).toBe(true);
    expect(webhookRequests[1].note).toBe('הדסה שנה ד');

    // Zero horizontal overflow on Demo/Pending banner across all viewports
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasOverflow).toBe(false);

    // 3. Admin signs in -> badge shows pending request -> opens Tab 2 & approves student in 1 tap
    await page.evaluate(() => window.__E2E_SWITCH_USER__('admin'));
    const adminBtn = page.locator('#btnAdminReports');
    await expect(adminBtn).toBeVisible();
    await expect(page.locator('#adminReportsBadge')).toContainText('1');

    await adminBtn.click();
    const adminDialog = page.locator('#adminReportsDialog');
    await expect(adminDialog).toBeVisible();
    await adminDialog.locator('button[data-admin-tab="users"]').click();
    await expect(adminDialog).toContainText('sara.cohen@nursing.ac.il');
    await expect(adminDialog).toContainText('הדסה שנה ד');

    await adminDialog.locator('button[data-user-action="approve"]').click();
    await expect(page.locator('#appGlobalToast')).toContainText('הגישה אושרה');
    await adminDialog.locator('#adminDialogCloseBtn').click();

    // Sign out of Admin -> catalog reverts cleanly to 10-question Demo Mode
    await page.evaluate(() => window.__E2E_SWITCH_USER__(null));
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מצב הדגמה: 10 שאלות פתוחות');

    // 4. Switch to approved student -> all 1,079 encrypted questions unlock & banner hides
    await page.evaluate(() => window.__E2E_SWITCH_USER__('student'));
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מאגר פעיל: 1079');
    await expect(demoBanner).toBeHidden();
    await expect(page.locator('#syncStatusIndicator')).toContainText('☁️ סנכרון ענן פעיל');
  });
});
