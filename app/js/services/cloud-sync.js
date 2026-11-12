/**
 * Firebase Cloud Sync Service (`app/js/services/cloud-sync.js`)
 * Manages Firebase Authentication (Google Sign-In) and real-time Cloud Firestore synchronization
 * against the v2 `store` and `storage` (`nursing_progress_v2`).
 */

import { FIREBASE_CONFIG, SCHEMA_VERSION } from '../config.js';
import { mergeCloudAndLocalProgress } from '../domain/sync-merge.js';

const FIREBASE_CDN_BASE = 'https://www.gstatic.com/firebasejs/11.0.2';

/**
 * Dynamically imports the Firebase v11 modular SDK from the official gstatic CDN in browser environments.
 */
async function loadFirebaseFromCdn() {
  const [appMod, authMod, firestoreMod] = await Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-app.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`),
  ]);
  return {
    initializeApp: appMod.initializeApp,
    getAuth: authMod.getAuth,
    signInWithPopup: authMod.signInWithPopup,
    signInWithRedirect: authMod.signInWithRedirect,
    getRedirectResult: authMod.getRedirectResult,
    browserPopupRedirectResolver: authMod.browserPopupRedirectResolver,
    signOut: authMod.signOut,
    GoogleAuthProvider: authMod.GoogleAuthProvider,
    onAuthStateChanged: authMod.onAuthStateChanged,
    getFirestore: firestoreMod.getFirestore,
    doc: firestoreMod.doc,
    getDoc: firestoreMod.getDoc,
    setDoc: firestoreMod.setDoc,
    onSnapshot: firestoreMod.onSnapshot,
  };
}

export function createCloudSyncService({
  firebaseConfig = FIREBASE_CONFIG,
  firebaseSdk = null,
  sdkLoader = loadFirebaseFromCdn,
  store,
  storage,
  toast = null,
  notifyError = null,
  onAuthChanged = null,
  onRemoteMerged = null,
  onSyncFlash = null,
  onSignInLoadingChange = null,
  debounceMs = 600,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  window = globalThis.window,
} = {}) {
  let sdk = firebaseSdk;
  let auth = null;
  let db = null;
  let provider = null;
  let unsubscribeSnapshot = null;
  let pushDebounceTimer = null;
  let initialized = false;

  // Automatically flush pending offline mutations when network connectivity is restored
  if (window && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => {
      if (auth && auth.currentUser) {
        schedulePush();
      }
    });
  }

  if (storage && toast) {
    if (typeof storage.bindToast === 'function') {
      storage.bindToast(toast);
    } else {
      storage._toast = toast;
    }
  }

  function unbindSession() {
    if (pushDebounceTimer) {
      clearTimeoutFn(pushDebounceTimer);
      pushDebounceTimer = null;
    }
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }

  function reportError(message) {
    if (typeof notifyError === 'function') {
      notifyError(message);
    } else if (toast) {
      toast.showToast(message);
    }
  }

  function applyRemotePayload(remote) {
    if (!remote || !store) return;
    const state = store.getState();
    const merged = mergeCloudAndLocalProgress(
      {
        mistakes: state.mistakes,
        mistakeTimestamps: state.mistakeTimestamps,
        userStats: state.userStats,
        savedExams: state.savedExams,
      },
      remote
    );

    store.setState(
      {
        mistakes: merged.mistakes,
        mistakeTimestamps: merged.mistakeTimestamps,
        userStats: merged.userStats,
        savedExams: merged.savedExams,
      },
      'cloud-sync/merge-remote'
    );

    if (storage) {
      storage.saveProgress({
        mistakes: merged.mistakes,
        mistakeTimestamps: merged.mistakeTimestamps,
        savedExams: merged.savedExams,
        userStats: merged.userStats,
      });
    }

    if (typeof onRemoteMerged === 'function') {
      onRemoteMerged(merged);
    }
    if (typeof onSyncFlash === 'function') {
      onSyncFlash();
    }
  }

  async function pushNow() {
    if (!sdk || !auth || !auth.currentUser || !db || !store) return false;
    try {
      const state = store.getState();
      const userDocRef = sdk.doc(db, 'users', auth.currentUser.uid);
      const dataToPush = {
        schemaVersion: SCHEMA_VERSION,
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || '',
        mistakes: Array.from(state.mistakes || []),
        mistakeTimestamps: state.mistakeTimestamps || {},
        userStats: state.userStats,
        savedExams: (state.savedExams || []).slice(0, 3),
        updatedAt: new Date().toISOString(),
      };
      await sdk.setDoc(userDocRef, dataToPush, { merge: true });
      if (store) {
        const currentAuth = store.getState().auth || {};
        store.setState(
          {
            auth: {
              ...currentAuth,
              syncStatus: 'synced',
            },
          },
          'cloud-sync/pushed'
        );
      }
      if (typeof onSyncFlash === 'function') {
        onSyncFlash();
      }
      return true;
    } catch (err) {
      console.warn('Cloud push warning:', err);
      if (store) {
        const currentAuth = store.getState().auth || {};
        const isOffline =
          err?.code === 'unavailable' ||
          err?.name === 'NetworkError' ||
          String(err?.message || '')
            .toLowerCase()
            .includes('network') ||
          String(err?.message || '')
            .toLowerCase()
            .includes('offline') ||
          String(err?.message || '')
            .toLowerCase()
            .includes('timed out');
        store.setState(
          {
            auth: {
              ...currentAuth,
              syncStatus: isOffline ? 'offline' : 'error',
            },
          },
          'cloud-sync/push-error'
        );
      }
      return false;
    }
  }

  function schedulePush() {
    if (!sdk || !auth || !auth.currentUser) return;
    clearTimeoutFn(pushDebounceTimer);
    pushDebounceTimer = setTimeoutFn(() => {
      pushNow();
    }, debounceMs);
  }

  async function resetCloudData() {
    if (!sdk || !auth || !auth.currentUser || !db) return false;
    try {
      const state = store ? store.getState() : {};
      const userDocRef = sdk.doc(db, 'users', auth.currentUser.uid);
      await sdk.setDoc(
        userDocRef,
        {
          schemaVersion: SCHEMA_VERSION,
          email: auth.currentUser.email || '',
          displayName: auth.currentUser.displayName || '',
          mistakes: [],
          mistakeTimestamps: state.mistakeTimestamps || {},
          userStats: state.userStats || {
            totalAnswered: 0,
            totalCorrect: 0,
            examsCompleted: 0,
            categoryStats: {},
            lastResetAt: Date.now(),
          },
          savedExams: (state.savedExams || []).slice(0, 3),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      if (typeof onSyncFlash === 'function') {
        onSyncFlash();
      }
      return true;
    } catch (err) {
      console.error('Failed to reset cloud data:', err);
      return false;
    }
  }

  async function handleAuthUserChange(user) {
    if (store) {
      store.setState(
        {
          auth: {
            user: user
              ? {
                  uid: user.uid,
                  email: user.email || '',
                  displayName: user.displayName || '',
                  photoURL: user.photoURL || '',
                }
              : null,
            syncStatus: user ? 'synced' : 'idle',
          },
        },
        'cloud-sync/auth-changed'
      );
    }

    if (typeof onAuthChanged === 'function') {
      onAuthChanged(user);
    }

    if (user && sdk && db) {
      const userDocRef = sdk.doc(db, 'users', user.uid);
      try {
        const snap = await sdk.getDoc(userDocRef);
        if (snap && typeof snap.exists === 'function' && snap.exists()) {
          applyRemotePayload(snap.data());
          schedulePush();
        } else {
          schedulePush();
        }
      } catch (err) {
        console.warn('Initial Firestore getDoc failed:', err);
      }

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      unsubscribeSnapshot = sdk.onSnapshot(
        userDocRef,
        (docSnap) => {
          if (!docSnap || typeof docSnap.exists !== 'function' || !docSnap.exists()) return;
          applyRemotePayload(docSnap.data());
        },
        (err) => {
          console.warn('Snapshot listener error:', err);
        }
      );
    } else {
      unbindSession();
    }
  }

  async function init() {
    if (initialized) return true;
    try {
      if (!sdk) {
        sdk = await sdkLoader();
      }
      const app = sdk.initializeApp(firebaseConfig);
      auth = sdk.getAuth(app);
      db = sdk.getFirestore(app);
      provider = new sdk.GoogleAuthProvider();
      if (typeof provider.setCustomParameters === 'function') {
        provider.setCustomParameters({ prompt: 'select_account' });
      }
      initialized = true;

      if (auth && typeof sdk.onAuthStateChanged === 'function') {
        sdk.onAuthStateChanged(auth, (user) => {
          handleAuthUserChange(user);
        });
      }

      if (auth && typeof sdk.getRedirectResult === 'function') {
        try {
          const redirectRes = await sdk.getRedirectResult(auth);
          if (redirectRes?.user) {
            toast?.showToast('התחברת בהצלחה! מסנכרן עם הענן ☁️');
          }
        } catch (redirectErr) {
          console.warn('Redirect sign-in result notice:', redirectErr);
        }
      }

      return true;
    } catch (err) {
      console.warn('Firebase initialization failed:', err);
      return false;
    }
  }

  async function signIn() {
    if (!initialized) {
      await init();
    }
    if (!auth || !sdk) {
      reportError('שירותי הענן אינם זמינים כעת (למשל במצב ללא אינטרנט).');
      return false;
    }
    if (typeof onSignInLoadingChange === 'function') {
      onSignInLoadingChange(true);
    }
    try {
      await sdk.signInWithPopup(auth, provider);
      toast?.showToast('התחברת בהצלחה! מסנכרן עם הענן ☁️');
      return true;
    } catch (err) {
      console.error('Firebase Sign-in error:', err);
      if (err?.code === 'auth/popup-blocked') {
        if (typeof sdk.signInWithRedirect === 'function') {
          try {
            await sdk.signInWithRedirect(auth, provider);
            return true;
          } catch (redirectErr) {
            console.error('Firebase Redirect Sign-in fallback failed:', redirectErr);
          }
        }
        reportError(
          'הדפדפן חסם את חלון ההתחברות. אנא אשר פתיחת חלונות קופצים (Popups) בדפדפן עבור אתר זה ונסה שוב.'
        );
      } else if (err?.code === 'auth/unauthorized-domain') {
        reportError(
          'דומיין לא מאושר ב-Firebase! יש לוודא שהדומיין מופיע ב-Firebase Console תחת Authorized Domains וברשימת ה-HTTP referrers של מפתח ה-API ב-Google Cloud Console.'
        );
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        reportError('שגיאה בהתחברות: ' + (err?.message || err?.code || 'Unknown error'));
      }
      return false;
    } finally {
      if (typeof onSignInLoadingChange === 'function') {
        onSignInLoadingChange(false);
      }
    }
  }

  async function signOut() {
    if (!auth || !sdk) return false;
    try {
      unbindSession();
      await sdk.signOut(auth);
      toast?.showToast('התנתקת מחשבון הענן. הנתונים ממשיכים להישמר מקומית בדפדפן.');
      return true;
    } catch (err) {
      console.error('Firebase Sign-out error:', err);
      return false;
    }
  }

  function getAuthUser() {
    return auth ? auth.currentUser : null;
  }

  return {
    init,
    signIn,
    signOut,
    unbindSession,
    getAuthUser,
    schedulePush,
    pushNow,
    syncPush: pushNow,
    resetCloudData,
    applyRemotePayload,
  };
}
