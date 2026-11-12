import { test, expect } from '@playwright/test';

test.describe('AUTH-FLOW: Interactive Google Sign-In & Sign-Out Lifecycle (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a clean, controlled mock Firebase SDK into the page prior to app bootstrap
    await page.addInitScript(() => {
      let authCallback = null;
      let currentMockUser = null;
      let storedDocument = null;

      const authInstance = {
        get currentUser() {
          return currentMockUser;
        },
      };

      window.__E2E_FIREBASE_SDK__ = {
        initializeApp: () => ({ name: 'e2e-app' }),
        getAuth: () => authInstance,
        getFirestore: () => ({ name: 'e2e-db' }),
        GoogleAuthProvider: class {
          setCustomParameters() {}
        },
        onAuthStateChanged: (_auth, cb) => {
          authCallback = cb;
          // Notify initial unauthenticated state
          setTimeout(() => cb(currentMockUser), 0);
          return () => {
            authCallback = null;
          };
        },
        signInWithPopup: async () => {
          currentMockUser = {
            uid: 'e2e-nurse-42',
            displayName: 'ד״ר יעל כהן',
            email: 'yael.cohen@hospital.org.il',
            photoURL: 'https://lh3.googleusercontent.com/a/yael-avatar=s96-c',
          };
          if (authCallback) {
            await authCallback(currentMockUser);
          }
          return { user: currentMockUser };
        },
        signOut: async () => {
          currentMockUser = null;
          if (authCallback) {
            await authCallback(null);
          }
        },
        doc: (_db, col, id) => ({ path: `${col}/${id}` }),
        getDoc: async () => ({
          exists: () => Boolean(storedDocument),
          data: () => storedDocument,
        }),
        setDoc: async (_ref, data) => {
          storedDocument = { ...(storedDocument || {}), ...data };
        },
        onSnapshot: () => () => {},
      };
    });
  });

  test('completes full sign-in and sign-out UI lifecycle with toast notifications across viewports', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#totalQuestionsHeader')).toContainText('1079');

    // 1. Initial State: Unauthenticated
    const signInBtn = page.locator('#btnGoogleSignIn');
    const userPill = page.locator('#userPill');
    const userName = page.locator('#userName');
    const userAvatar = page.locator('#userAvatar');
    const toast = page.locator('#appGlobalToast');

    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toContainText('סנכרון ענן (Google)');
    await expect(userPill).toBeHidden();

    // 2. Click Sign In Button
    await signInBtn.click();

    // 3. Authenticated State Verification
    await expect(userPill).toBeVisible();
    await expect(signInBtn).toBeHidden();
    await expect(userName).toHaveText('ד״ר יעל כהן');
    await expect(userAvatar).toHaveAttribute(
      'src',
      'https://lh3.googleusercontent.com/a/yael-avatar=s96-c'
    );

    // Verify successful sign-in toast
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('התחברת בהצלחה!');

    // 4. Verify Statistics Dashboard Badge reflects authenticated state
    const isMobile = Boolean(page.viewportSize() && page.viewportSize().width <= 640);
    await page.locator(isMobile ? '#bNavStats' : '#tabStats').click();
    await expect(page.locator('#screenStats')).toBeVisible();

    const statsCloudBadge = page.locator('#statsCloudSyncInfo');
    await expect(statsCloudBadge).toBeVisible();
    await expect(statsCloudBadge.locator('.cloud-sync-active-title bdi')).toHaveText('Google');
    await expect(statsCloudBadge.locator('.user-display-name')).toHaveText('ד״ר יעל כהן');
    await expect(statsCloudBadge).toContainText('סנכרון ענן פעיל');

    // 5. Click Sign Out Button
    const signOutBtn = page.locator('#userPill button[data-action="google-sign-out"]');
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // 6. Signed-out State Verification
    await expect(userPill).toBeHidden();
    await expect(signInBtn).toBeVisible();

    // Verify signed-out toast
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('התנתקת מחשבון הענן');

    // Verify Statistics Dashboard Badge reverts to local storage notice
    await expect(statsCloudBadge).toContainText('הנתונים נשמרים מקומית בדפדפן');
    await expect(statsCloudBadge.locator('.user-display-name')).toHaveCount(0);
  });
});
