import { test, expect } from '@playwright/test';
import { loadTestCatalogKey } from '../helpers/load-test-questions.js';

const TEST_CATALOG_KEY = loadTestCatalogKey();

function buildAccessControlMockInit() {
  return ({ key, initialConfig = true, persistInSession = false, authDelayMs = 0 }) => {
    const SESSION_STORAGE_KEY = '__E2E_ACCESS_MOCK_DB__';

    function loadPersistedState() {
      if (persistInSession) {
        try {
          const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            return {
              allowed_users: new Map(parsed.allowed_users || []),
              app_config: new Map(parsed.app_config || []),
              question_reports: new Map(parsed.question_reports || []),
              users: new Map(parsed.users || []),
              activeUser: parsed.activeUser || null,
            };
          }
        } catch {
          // Ignore malformed session data
        }
      }

      const appConfigEntries = initialConfig
        ? [
            ['catalog_key', { schemaVersion: 2, keyBase64: key }],
            ['contact', { schemaVersion: 2, telegramUrl: 'https://t.me/nursing_admin_bot' }],
          ]
        : [];

      return {
        allowed_users: new Map(),
        app_config: new Map(appConfigEntries),
        question_reports: new Map(),
        users: new Map(),
        activeUser: null,
      };
    }

    const state = loadPersistedState();
    const collections = {
      allowed_users: state.allowed_users,
      app_config: state.app_config,
      question_reports: state.question_reports,
      users: state.users,
    };

    function savePersistedState() {
      if (!persistInSession) return;
      try {
        window.sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            allowed_users: Array.from(collections.allowed_users.entries()),
            app_config: Array.from(collections.app_config.entries()),
            question_reports: Array.from(collections.question_reports.entries()),
            users: Array.from(collections.users.entries()),
            activeUser,
          })
        );
      } catch {
        // Ignore storage quota errors
      }
    }

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

    let activeUser = state.activeUser;
    let authCallback = null;
    const pendingListeners = [];
    const docListeners = [];

    function emitPendingSnapshot() {
      const docs = Array.from(collections.allowed_users.entries())
        .filter(([, d]) => d.status === 'PENDING')
        .map(([id, d]) => ({ id, data: () => d }));
      for (const cb of pendingListeners) {
        cb({ size: docs.length, docs });
      }
    }

    function emitDocSnapshot(colName, id) {
      const store = collections[colName];
      const data = store ? store.get(id) : null;
      for (const listener of docListeners) {
        if (listener.colName === colName && listener.id === id) {
          listener.cb({
            exists: () => Boolean(data),
            data: () => data || null,
          });
        }
      }
    }

    window.__E2E_SWITCH_USER__ = async (role) => {
      activeUser = role === 'admin' ? adminUser : role === 'student' ? studentUser : null;
      savePersistedState();
      if (authCallback) {
        await authCallback(activeUser);
      }
    };

    window.__E2E_SET_USER_ACCESS__ = (email, docData) => {
      if (docData === null) {
        collections.allowed_users.delete(email);
      } else {
        collections.allowed_users.set(email, docData);
      }
      savePersistedState();
      emitPendingSnapshot();
      emitDocSnapshot('allowed_users', email);
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
        savePersistedState();
        if (authCallback) await authCallback(activeUser);
        return { user: activeUser };
      },
      signOut: async () => {
        activeUser = null;
        savePersistedState();
        if (authCallback) await authCallback(null);
      },
      getFirestore: () => ({}),
      collection: (_db, colName) => ({ colName }),
      doc: (_db, colName, id) => ({ type: 'doc', colName, id }),
      query: (colRef) => colRef,
      where: () => ({}),
      orderBy: () => ({}),
      limit: () => ({}),
      getDoc: async (ref) => {
        if (authDelayMs > 0) {
          await new Promise((r) => setTimeout(r, authDelayMs));
        }
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
        savePersistedState();
        if (ref.colName === 'allowed_users') {
          emitPendingSnapshot();
          emitDocSnapshot(ref.colName, ref.id);
        }
      },
      deleteDoc: async (ref) => {
        const store = collections[ref.colName];
        if (store) {
          store.delete(ref.id);
          savePersistedState();
          if (ref.colName === 'allowed_users') {
            emitPendingSnapshot();
            emitDocSnapshot(ref.colName, ref.id);
          }
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
        if (ref?.type === 'doc') {
          const entry = { colName: ref.colName, id: ref.id, cb };
          docListeners.push(entry);
          setTimeout(() => {
            const store = collections[ref.colName];
            const data = store ? store.get(ref.id) : null;
            cb({
              exists: () => Boolean(data),
              data: () => data || null,
            });
          }, 0);
          return () => {
            const idx = docListeners.indexOf(entry);
            if (idx >= 0) docListeners.splice(idx, 1);
          };
        }
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
      initialConfig: true,
      persistInSession: false,
      authDelayMs: 25,
    });

    // 1. Guest boots in 10-question Demo Mode (with >10 question buttons & selectors locked, 10-Q mini-exam allowed)
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מצב הדגמה: 10 שאלות פתוחות');
    const demoBanner = page.locator('#demoModeBanner');
    await expect(demoBanner).toBeVisible();
    await expect(demoBanner).toContainText('מצב הדגמה (10 מתוך 1079');

    // Verify source/category selectors, Saved Exams lock controls, and >10 question radios are locked in Demo Mode
    await expect(page.locator('#examSourceSelect')).toBeDisabled();
    await expect(page.locator('#examCategorySelect')).toBeDisabled();
    await expect(page.locator('#studyCategoryFilter')).toBeDisabled();
    await expect(page.locator('#savedExamSourceSelect')).toBeDisabled();
    await expect(
      page.locator('#savedAddSection button[data-action="add-saved-exam"]')
    ).toBeDisabled();
    await expect(page.locator('input[name="examCount"][value="10"]')).toBeEnabled();
    await expect(page.locator('input[name="examCount"][value="10"]')).toBeChecked();
    for (const lockedVal of ['25', '50', '100']) {
      await expect(page.locator(`input[name="examCount"][value="${lockedVal}"]`)).toBeDisabled();
    }

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

    // Student sends explicit request with cohort note -> 2nd Telegram notification, then button enters 10-min cooldown
    await page.locator('#accessRequestNoteInput').fill('הדסה שנה ד');
    await page.locator('#btnSendAccessRequest').click();
    await expect(page.locator('#appGlobalToast')).toContainText('בקשת הגישה נשלחה');
    expect(webhookRequests).toHaveLength(2);
    expect(webhookRequests[1].isExplicitRequest).toBe(true);
    expect(webhookRequests[1].note).toBe('הדסה שנה ד');
    await expect(page.locator('#btnSendAccessRequest')).toBeDisabled();
    await expect(page.locator('#btnSendAccessRequest')).toContainText('הבקשה נשלחה');

    const cooldownRes = await page.evaluate(() =>
      window.app.accessControlService.submitAccessRequest({ note: 'ניסיון ספאם' })
    );
    expect(cooldownRes.ok).toBe(false);
    expect(cooldownRes.cooldown).toBe(true);
    expect(webhookRequests).toHaveLength(2);

    // Zero horizontal overflow on Demo/Pending banner across all viewports
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasOverflow).toBe(false);

    // 3. Admin signs in -> NO false "ממתין לאישור" flash -> button says ניהול -> shows BOTH admins + approves student in 1 tap
    await page.evaluate(() => {
      window.__E2E_PENDING_FLASHES__ = [];
      const bannerEl = document.getElementById('demoModeBanner');
      const toastEl = document.getElementById('appGlobalToast');
      const syncEl = document.getElementById('syncStatusIndicator');
      const obs = new MutationObserver(() => {
        const txt = `${bannerEl?.textContent || ''} | ${toastEl?.textContent || ''} | ${syncEl?.textContent || ''}`;
        if (txt.includes('ממתין לאישור') || bannerEl?.classList.contains('is-pending')) {
          window.__E2E_PENDING_FLASHES__.push(txt);
        }
      });
      for (const el of [bannerEl, toastEl, syncEl]) {
        if (el)
          obs.observe(el, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
          });
      }
      window.__E2E_OBS__ = obs;
    });

    await page.evaluate(() => window.__E2E_SWITCH_USER__('admin'));
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מאגר פעיל: 1079');
    const adminFlashes = await page.evaluate(() => {
      window.__E2E_OBS__?.disconnect();
      return window.__E2E_PENDING_FLASHES__;
    });
    expect(adminFlashes).toEqual([]);

    const adminBtn = page.locator('#btnAdminReports');
    await expect(adminBtn).toBeVisible();
    await expect(adminBtn).toContainText('ניהול');
    await expect(adminBtn).not.toContainText('דיווחים');
    await expect(page.locator('#adminReportsBadge')).toContainText('1');

    await adminBtn.click();
    const adminDialog = page.locator('#adminReportsDialog');
    await expect(adminDialog).toBeVisible();
    const usersTabBtn = adminDialog.locator('button[data-admin-tab="users"]');
    await expect(usersTabBtn).toContainText('משתמשים מורשים (2)');
    await expect(usersTabBtn).toContainText('⏳ 1');
    await usersTabBtn.click();
    await expect(adminDialog).toContainText('benjaminrotlevy@gmail.com');
    await expect(adminDialog).toContainText('benjamin@rotlevy.com');
    await expect(adminDialog).toContainText('sara.cohen@nursing.ac.il');
    await expect(adminDialog).toContainText('הדסה שנה ד');

    await adminDialog.locator('button[data-user-action="approve"]').click();
    await expect(page.locator('#appGlobalToast')).toContainText('הגישה אושרה');
    await expect(usersTabBtn).toContainText('משתמשים מורשים (3)');
    await adminDialog.locator('#adminDialogCloseBtn').click();

    // Sign out of Admin -> catalog reverts cleanly to 10-question Demo Mode & re-locks controls
    await page.evaluate(() => window.__E2E_SWITCH_USER__(null));
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מצב הדגמה: 10 שאלות פתוחות');
    await expect(page.locator('#examSourceSelect')).toBeDisabled();
    await expect(
      page.locator('#savedAddSection button[data-action="add-saved-exam"]')
    ).toBeDisabled();
    await expect(page.locator('input[name="examCount"][value="50"]')).toBeDisabled();

    // 4. Approved student signs in via popup flow -> NO false "ממתין לאישור" toast/banner flash -> all 1,079 questions & Saved Exams unlock
    await page.evaluate(() => {
      window.__E2E_PENDING_FLASHES__ = [];
      const bannerEl = document.getElementById('demoModeBanner');
      const toastEl = document.getElementById('appGlobalToast');
      const syncEl = document.getElementById('syncStatusIndicator');
      const obs = new MutationObserver(() => {
        const txt = `${bannerEl?.textContent || ''} | ${toastEl?.textContent || ''} | ${syncEl?.textContent || ''}`;
        if (txt.includes('ממתין לאישור') || bannerEl?.classList.contains('is-pending')) {
          window.__E2E_PENDING_FLASHES__.push(txt);
        }
      });
      for (const el of [bannerEl, toastEl, syncEl]) {
        if (el)
          obs.observe(el, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
          });
      }
      window.__E2E_OBS__ = obs;
    });

    await page.locator('#btnGoogleSignIn').click();
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מאגר פעיל: 1079');
    await expect(page.locator('#appGlobalToast')).toContainText('מסנכרן עם הענן');
    const studentFlashes = await page.evaluate(() => {
      window.__E2E_OBS__?.disconnect();
      return window.__E2E_PENDING_FLASHES__;
    });
    expect(studentFlashes).toEqual([]);
    await expect(demoBanner).toBeHidden();
    await expect(page.locator('#syncStatusIndicator')).toContainText('☁️ סנכרון ענן פעיל');
    await expect(page.locator('#examSourceSelect')).toBeEnabled();
    await expect(page.locator('#examCategorySelect')).toBeEnabled();
    await expect(page.locator('#studyCategoryFilter')).toBeEnabled();
    await expect(page.locator('#savedExamSourceSelect')).toBeEnabled();
    await expect(
      page.locator('#savedAddSection button[data-action="add-saved-exam"]')
    ).toBeEnabled();
    for (const unlockedVal of ['25', '50', '100']) {
      await expect(page.locator(`input[name="examCount"][value="${unlockedVal}"]`)).toBeEnabled();
    }
  });

  test('verifies Admin first-time key & Telegram setup, legacy worker 400 fallback, in-place recheck, offline encrypted reload, and online revocation', async ({
    page,
    context,
  }) => {
    const webhookRequests = [];
    await page.route('https://*.workers.dev/**', async (route) => {
      const payload = route.request().postDataJSON();
      webhookRequests.push(payload);
      // Simulate legacy deployed Cloudflare Worker returning 400 on NEW_USER_SIGN_IN
      if (payload?.type === 'NEW_USER_SIGN_IN') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'Invalid report payload' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.addInitScript(buildAccessControlMockInit(), {
      key: TEST_CATALOG_KEY,
      initialConfig: false,
      persistInSession: true,
    });

    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.app?.authController));

    // Ensure Service Worker is active so offline reload with encrypted catalog works
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker?.ready;
      return Boolean(reg?.active);
    });

    // 1. Admin signs in before catalog_key exists in Firestore -> sees setup prompt & configures key + @handle
    await page.evaluate(() => window.__E2E_SWITCH_USER__('admin'));
    const demoBanner = page.locator('#demoModeBanner');
    await expect(demoBanner).toHaveClass(/is-admin-setup/);
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מצב הדגמה: 10 שאלות פתוחות');

    await page.locator('#btnBannerSetupKey').click();
    const adminDialog = page.locator('#adminReportsDialog');
    await expect(adminDialog).toBeVisible();
    await expect(adminDialog.locator('#adminCatalogKeyInput')).toBeVisible();

    await adminDialog.locator('#adminCatalogKeyInput').fill(TEST_CATALOG_KEY);
    await adminDialog.locator('#adminSaveCatalogKeyBtn').click();

    // All 1,079 questions unlock immediately for Admin and settings section stays open for Telegram link
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מאגר פעיל: 1079');
    await expect(demoBanner).toBeHidden();
    await expect(adminDialog.locator('#adminTelegramUrlInput')).toBeVisible();

    await adminDialog.locator('#adminTelegramUrlInput').fill('@nursing_preceptor_admin');
    await adminDialog.locator('#adminSaveTelegramUrlBtn').click();
    await expect(adminDialog.locator('#adminTelegramUrlInput')).toHaveValue(
      'https://t.me/nursing_preceptor_admin'
    );
    await adminDialog.locator('#adminDialogCloseBtn').click();

    // Sign out Admin -> Demo Mode restores cleanly
    await page.evaluate(() => window.__E2E_SWITCH_USER__(null));
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מצב הדגמה: 10 שאלות פתוחות');

    // 2. Unapproved student signs in -> legacy Worker returns 400, client automatically retries with compatible schema
    await page.locator('#btnGoogleSignIn').click();
    await expect(demoBanner).toHaveClass(/is-pending/);
    await expect(page.locator('#btnTelegramAdminChat')).toHaveAttribute(
      'href',
      'https://t.me/nursing_preceptor_admin'
    );
    expect(webhookRequests).toHaveLength(2);
    expect(webhookRequests[0].type).toBe('NEW_USER_SIGN_IN');
    expect(webhookRequests[1].type).toBe('QUESTION_ISSUE_REPORT');
    expect(webhookRequests[1].reporterEmail).toBe('sara.cohen@nursing.ac.il');

    // 3. Admin approves student in Firestore -> live listener unlocks all 1,079 questions AUTOMATICALLY without tapping recheck
    await page.evaluate(() => {
      window.__E2E_SET_USER_ACCESS__('sara.cohen@nursing.ac.il', {
        schemaVersion: 2,
        email: 'sara.cohen@nursing.ac.il',
        active: true,
        status: 'APPROVED',
        addedAt: '2026-11-17T08:00:00.000Z',
        updatedAt: '2026-11-17T08:05:00.000Z',
      });
    });
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מאגר פעיל: 1079');
    await expect(page.locator('#appGlobalToast')).toContainText('אושרת!');
    await expect(demoBanner).toBeHidden();

    // 4. Reload while completely offline -> cached approval + key decrypts all 1,079 SW-cached questions
    await page.reload();
    await page.evaluate(async () => {
      await navigator.serviceWorker?.ready;
    });
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.locator('#totalQuestionsHeader')).toContainText('מאגר פעיל: 1079');
      await expect(demoBanner).toBeHidden();
    } finally {
      await context.setOffline(false);
    }

    // 5. Online revocation invalidates cached key and locks student back to 10-question Demo Mode
    await page.evaluate(() => {
      window.__E2E_SET_USER_ACCESS__('sara.cohen@nursing.ac.il', {
        schemaVersion: 2,
        email: 'sara.cohen@nursing.ac.il',
        active: false,
        status: 'REVOKED',
        addedAt: '2026-11-17T08:00:00.000Z',
        updatedAt: '2026-11-17T08:10:00.000Z',
      });
    });
    await page.reload();
    await expect(demoBanner).toBeVisible();
    await expect(demoBanner).toHaveClass(/is-revoked/);
    await expect(page.locator('#totalQuestionsHeader')).toContainText('מצב הדגמה: 10 שאלות פתוחות');
    await expect(page.locator('#syncStatusIndicator')).toContainText('🚫 גישה מושהית');

    // 6. Unsynced local progress on sign-out shows confirmation warning; confirming clears ALL localStorage & sessionStorage data
    await page.locator('#screenExamSetup button[data-action="start-exam"]').click();
    await expect(page.locator('#screenActiveExam')).toBeVisible();

    await page.locator('#userPill button[data-action="google-sign-out"]').click();
    await expect(page.locator('#appModalDialog')).toBeVisible();
    await expect(page.locator('#appModalDialogBody')).toContainText('נתונים מקומיים');
    // Cancel keeps user signed in and active exam intact
    await page.locator('#appModalCancelBtn').click();
    await expect(page.locator('#screenActiveExam')).toBeVisible();

    // Confirm sign-out -> signs out and wipes localStorage & sessionStorage keys completely
    await page.locator('#userPill button[data-action="google-sign-out"]').click();
    await page.locator('#appModalConfirmBtn').click();
    await expect(page.locator('#userPill')).toBeHidden();
    await expect(page.locator('#screenExamSetup')).toBeVisible();

    const remainingKeys = await page.evaluate(() => ({
      progress: localStorage.getItem('nursing_progress_v2'),
      approval: localStorage.getItem('nursing_access_approval_v1'),
      notified: localStorage.getItem('nursing_signin_notified_v1'),
      examSession: sessionStorage.getItem('nursing_exam_session_v2'),
      studySession: sessionStorage.getItem('nursing_study_session_v2'),
      activeTab: sessionStorage.getItem('nursing_active_tab_v2'),
    }));
    expect(remainingKeys).toEqual({
      progress: null,
      approval: null,
      notified: null,
      examSession: null,
      studySession: null,
      activeTab: null,
    });
  });
});
