import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createInitialState } from '../../app/js/core/store.js';
import { createStorageAdapter } from '../../app/js/core/storage.js';
import { createCloudSyncService } from '../../app/js/services/cloud-sync.js';
import { STORAGE_KEYS } from '../../app/js/config.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function createFakeFirebaseSdk(initialDocData = null) {
  let authCallback = null;
  let snapshotCallback = null;
  let storedDoc = initialDocData;
  const setDocCalls = [];

  const authInstance = {
    currentUser: null,
  };

  const sdk = {
    initializeApp: () => ({ name: 'test-app' }),
    getAuth: () => authInstance,
    getFirestore: () => ({ name: 'test-db' }),
    GoogleAuthProvider: class {
      setCustomParameters() {}
    },
    onAuthStateChanged: (_auth, cb) => {
      authCallback = cb;
      return () => {
        authCallback = null;
      };
    },
    signInWithPopup: async () => {
      const user = {
        uid: 'nurse-uid-123',
        email: 'nurse@hospital.org',
        displayName: 'אחות מוסמכת',
        photoURL: 'https://lh3.googleusercontent.com/a/avatar.png',
      };
      authInstance.currentUser = user;
      if (authCallback) {
        await authCallback(user);
      }
      return { user };
    },
    signOut: async () => {
      authInstance.currentUser = null;
      if (authCallback) {
        await authCallback(null);
      }
    },
    doc: (_db, collection, id) => ({ path: `${collection}/${id}` }),
    getDoc: async () => ({
      exists: () => Boolean(storedDoc),
      data: () => storedDoc,
    }),
    setDoc: async (ref, data, options) => {
      storedDoc = { ...(storedDoc || {}), ...data };
      setDocCalls.push({ ref, data, options });
    },
    onSnapshot: (_ref, cb) => {
      snapshotCallback = cb;
      return () => {
        snapshotCallback = null;
      };
    },
    emitRemoteSnapshot: (newData) => {
      storedDoc = newData;
      if (snapshotCallback) {
        snapshotCallback({
          exists: () => true,
          data: () => newData,
        });
      }
    },
    getSetDocCalls: () => setDocCalls,
  };

  return sdk;
}

describe('app/js/services/cloud-sync.js — Firebase Auth & Cloud Sync Service (SYNC-01..SYNC-03)', () => {
  it('signs in, merges remote cloud document into store + v2 localStorage, and pushes v2 schema payload', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const store = createStore(createInitialState());
    const storage = createStorageAdapter({ localStorage, sessionStorage });

    // Seed local progress with 1 mistake
    store.setState({
      mistakes: new Set(['q_local_1']),
      mistakeTimestamps: { q_local_1: { updatedAt: 1000, removed: false } },
      userStats: {
        totalAnswered: 10,
        totalCorrect: 8,
        examsCompleted: 1,
        lastResetAt: 0,
        categoryStats: {},
      },
      savedExams: [],
    });

    const fakeSdk = createFakeFirebaseSdk({
      schemaVersion: 2,
      mistakes: ['q_remote_2'],
      mistakeTimestamps: { q_remote_2: { updatedAt: 2000, removed: false } },
      userStats: {
        totalAnswered: 15,
        totalCorrect: 12,
        examsCompleted: 2,
        lastResetAt: 0,
        categoryStats: {},
      },
      savedExams: [{ id: 'saved_1', title: 'מבחן שמור 1', questionIds: ['q1'] }],
    });

    const cloudSync = createCloudSyncService({
      firebaseSdk: fakeSdk,
      store,
      storage,
      debounceMs: 5,
    });

    await cloudSync.init();
    const signedIn = await cloudSync.signIn();
    assert.equal(signedIn, true);
    assert.equal(cloudSync.getAuthUser()?.uid, 'nurse-uid-123');

    const stateAfterSignIn = store.getState();
    assert.equal(stateAfterSignIn.mistakes.has('q_local_1'), true);
    assert.equal(stateAfterSignIn.mistakes.has('q_remote_2'), true);
    assert.equal(stateAfterSignIn.userStats.totalAnswered, 15);
    assert.equal(stateAfterSignIn.savedExams.length, 1);

    // Verify persisted to v2 localStorage key (`nursing_progress_v2`)
    const persistedRaw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    assert.ok(persistedRaw, 'Expected nursing_progress_v2 to be written to localStorage');
    const persisted = JSON.parse(persistedRaw);
    assert.equal(persisted.schemaVersion, 2);
    assert.ok(persisted.mistakes.includes('q_local_1'));
    assert.ok(persisted.mistakes.includes('q_remote_2'));

    // Explicitly push to cloud and verify Firestore payload conforms to firestore.rules schema
    const pushed = await cloudSync.pushNow();
    assert.equal(pushed, true);
    const calls = fakeSdk.getSetDocCalls();
    assert.ok(calls.length >= 1);
    const lastWrite = calls[calls.length - 1];
    assert.equal(lastWrite.ref.path, 'users/nurse-uid-123');
    assert.equal(lastWrite.data.schemaVersion, 2);
    assert.equal(lastWrite.data.email, 'nurse@hospital.org');
    assert.deepEqual(new Set(lastWrite.data.mistakes), new Set(['q_local_1', 'q_remote_2']));

    // Sign out
    const signedOut = await cloudSync.signOut();
    assert.equal(signedOut, true);
    assert.equal(cloudSync.getAuthUser(), null);
  });

  it('propagates real-time snapshot updates and resetCloudData with lastResetAt', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const store = createStore(createInitialState());
    const storage = createStorageAdapter({ localStorage, sessionStorage });
    const fakeSdk = createFakeFirebaseSdk(null);

    const cloudSync = createCloudSyncService({
      firebaseSdk: fakeSdk,
      store,
      storage,
      debounceMs: 5,
    });

    await cloudSync.init();
    await cloudSync.signIn();

    // Simulate incoming real-time snapshot from another device where stats were reset at t=9000
    fakeSdk.emitRemoteSnapshot({
      schemaVersion: 2,
      mistakes: [],
      mistakeTimestamps: {},
      userStats: {
        totalAnswered: 0,
        totalCorrect: 0,
        examsCompleted: 0,
        lastResetAt: 9000,
        categoryStats: {},
      },
      savedExams: [],
    });

    assert.equal(store.getState().userStats.lastResetAt, 9000);
    assert.equal(store.getState().mistakes.size, 0);

    // Trigger resetCloudData and verify Firestore document update
    const resetOk = await cloudSync.resetCloudData();
    assert.equal(resetOk, true);
    const calls = fakeSdk.getSetDocCalls();
    const resetWrite = calls[calls.length - 1];
    assert.deepEqual(resetWrite.data.mistakes, []);
    assert.equal(resetWrite.data.schemaVersion, 2);
  });

  it('falls back to signInWithRedirect when signInWithPopup throws auth/popup-blocked', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const store = createStore(createInitialState());
    const storage = createStorageAdapter({ localStorage, sessionStorage });

    let redirectCalled = false;
    const fakeSdk = createFakeFirebaseSdk(null);
    fakeSdk.signInWithPopup = async () => {
      const err = new Error('Popup blocked');
      err.code = 'auth/popup-blocked';
      throw err;
    };
    fakeSdk.signInWithRedirect = async () => {
      redirectCalled = true;
    };

    const cloudSync = createCloudSyncService({
      firebaseSdk: fakeSdk,
      store,
      storage,
      debounceMs: 5,
    });

    await cloudSync.init();
    const signedIn = await cloudSync.signIn();
    assert.equal(signedIn, true);
    assert.equal(redirectCalled, true);
  });
});
