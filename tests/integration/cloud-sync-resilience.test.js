import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createInitialState } from '../../app/js/core/store.js';
import { createStorageAdapter } from '../../app/js/core/storage.js';
import { createCloudSyncService } from '../../app/js/services/cloud-sync.js';
import { STORAGE_KEYS } from '../../app/js/config.js';

/**
 * In-memory Storage fixture for testing localStorage persistence.
 */
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

/**
 * Deterministic fake timer clock to verify debounce scheduling and timer cleanup without real delays.
 */
function createFakeClock() {
  let currentTime = 0;
  let nextTimerId = 1;
  const activeTimers = new Map();
  const clearedTimerIds = [];

  const setTimeoutFn = (fn, delay = 0) => {
    const id = nextTimerId++;
    activeTimers.set(id, { fn, triggerAt: currentTime + delay });
    return id;
  };

  const clearTimeoutFn = (id) => {
    clearedTimerIds.push(id);
    activeTimers.delete(id);
  };

  const advanceTimers = async (ms) => {
    currentTime += ms;
    const ready = [];
    for (const [id, timer] of activeTimers.entries()) {
      if (timer.triggerAt <= currentTime) {
        ready.push({ id, fn: timer.fn, triggerAt: timer.triggerAt });
        activeTimers.delete(id);
      }
    }
    ready.sort((a, b) => a.triggerAt - b.triggerAt);
    for (const timer of ready) {
      await timer.fn();
    }
  };

  return {
    setTimeoutFn,
    clearTimeoutFn,
    advanceTimers,
    getActiveTimers: () => new Map(activeTimers),
    getActiveTimerCount: () => activeTimers.size,
    getClearedTimerIds: () => [...clearedTimerIds],
    getCurrentTime: () => currentTime,
  };
}

/**
 * Configurable mock Firebase SDK supporting network error simulation and listener tracking.
 */
function createFakeFirebaseSdk({ initialDocData = null, setDocError = null } = {}) {
  let authCallback = null;
  let snapshotCallback = null;
  let storedDoc = initialDocData;
  let currentSetDocError = setDocError;
  const setDocCalls = [];
  let snapshotUnsubscribeCalled = false;

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
        uid: 'nurse-resilience-123',
        email: 'nurse-resilience@hospital.org',
        displayName: 'אחות מוסמכת בדיקות',
        photoURL: 'https://lh3.googleusercontent.com/a/resilience.png',
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
      if (currentSetDocError) {
        throw currentSetDocError;
      }
      storedDoc = { ...(storedDoc || {}), ...data };
      setDocCalls.push({ ref, data, options });
    },
    onSnapshot: (_ref, cb) => {
      snapshotCallback = cb;
      return () => {
        snapshotUnsubscribeCalled = true;
        snapshotCallback = null;
      };
    },
    setSetDocError: (err) => {
      currentSetDocError = err;
    },
    isSnapshotActive: () => Boolean(snapshotCallback),
    isSnapshotUnsubscribed: () => snapshotUnsubscribeCalled,
    getSetDocCalls: () => setDocCalls,
  };

  return sdk;
}

describe('app/js/services/cloud-sync.js — Cloud Sync Resilience, Debouncing & Teardown (SYNC-04..06)', () => {
  describe('SYNC-04: Offline Network Disconnect & Push Error Resilience', () => {
    it('catches network timeout/rejection gracefully without unhandled rejection and preserves local store & localStorage progress [SYNC-04]', async () => {
      const localStorage = createMemoryStorage();
      const sessionStorage = createMemoryStorage();
      const store = createStore(createInitialState());
      const storage = createStorageAdapter({ localStorage, sessionStorage });

      // Seed local store and localStorage with active user progress
      const initialMistakes = new Set(['q_local_1']);
      const initialTimestamps = { q_local_1: { updatedAt: 1000, removed: false } };
      const initialStats = {
        totalAnswered: 10,
        totalCorrect: 8,
        examsCompleted: 1,
        lastResetAt: 0,
        categoryStats: {},
      };

      store.setState({
        mistakes: initialMistakes,
        mistakeTimestamps: initialTimestamps,
        userStats: initialStats,
        savedExams: [],
      });

      storage.saveProgress({
        mistakes: initialMistakes,
        mistakeTimestamps: initialTimestamps,
        userStats: initialStats,
        savedExams: [],
      });

      // Configure fake Firebase SDK whose setDoc rejects with a simulated NetworkError / Timeout
      const simulatedError = new Error('NetworkError: Connection timed out after 10000ms');
      simulatedError.code = 'unavailable';
      const fakeSdk = createFakeFirebaseSdk({ setDocError: simulatedError });

      const cloudSync = createCloudSyncService({
        firebaseSdk: fakeSdk,
        store,
        storage,
        debounceMs: 5,
      });

      await cloudSync.init();
      await cloudSync.signIn();

      // Invoke cloud push
      const pushFn =
        typeof cloudSync.syncPush === 'function' ? cloudSync.syncPush : cloudSync.pushNow;
      let pushResult;
      let unhandledException = null;

      try {
        pushResult = await pushFn();
      } catch (err) {
        unhandledException = err;
      }

      // Assert error is handled gracefully without unhandled rejections
      assert.equal(
        unhandledException,
        null,
        'Push error must be handled gracefully without throwing unhandled exceptions'
      );
      assert.equal(pushResult, false, 'Push operation must resolve to false on network failure');

      // Assert local store state remains uncorrupted and intact
      const currentState = store.getState();
      assert.equal(
        currentState.mistakes.has('q_local_1'),
        true,
        'Local mistakes must remain in store'
      );
      assert.equal(
        currentState.userStats.totalAnswered,
        10,
        'Local userStats.totalAnswered must remain intact'
      );
      assert.equal(
        currentState.userStats.totalCorrect,
        8,
        'Local userStats.totalCorrect must remain intact'
      );

      // Assert localStorage progress remains uncorrupted and parseable
      const persistedRaw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      assert.ok(persistedRaw, 'Progress key must still exist in localStorage');
      const persisted = JSON.parse(persistedRaw);
      assert.equal(persisted.schemaVersion, 2);
      assert.ok(persisted.mistakes.includes('q_local_1'));
      assert.equal(persisted.userStats.totalAnswered, 10);
      assert.equal(persisted.userStats.totalCorrect, 8);
    });

    it('transitions auth.syncStatus indicator to "offline" or "error" when cloud push fails [SYNC-04]', async () => {
      const localStorage = createMemoryStorage();
      const sessionStorage = createMemoryStorage();
      const store = createStore(createInitialState());
      const storage = createStorageAdapter({ localStorage, sessionStorage });

      const simulatedError = new Error('NetworkError: Offline disconnect');
      simulatedError.code = 'unavailable';
      const fakeSdk = createFakeFirebaseSdk({ setDocError: simulatedError });

      const cloudSync = createCloudSyncService({
        firebaseSdk: fakeSdk,
        store,
        storage,
        debounceMs: 5,
      });

      await cloudSync.init();
      await cloudSync.signIn();

      // Upon sign-in, initial status is expected to be 'synced'
      assert.equal(
        store.getState().auth?.syncStatus,
        'synced',
        'Initial auth.syncStatus must be synced after sign-in'
      );

      // Attempt push while network is offline
      const pushFn =
        typeof cloudSync.syncPush === 'function' ? cloudSync.syncPush : cloudSync.pushNow;
      await pushFn();

      // Per 06-STATE-AND-PERSISTENCE.md & STPR SYNC-04, syncStatus should transition away from 'synced' to 'offline' or 'error'
      const finalStatus = store.getState().auth?.syncStatus;
      assert.ok(
        finalStatus === 'offline' || finalStatus === 'error',
        `Expected auth.syncStatus to transition to 'offline' or 'error' on push failure, but was '${finalStatus}'`
      );
    });

    it('exposes cloudSync.syncPush method per SYNC-04 specification [SYNC-04]', async () => {
      const localStorage = createMemoryStorage();
      const sessionStorage = createMemoryStorage();
      const store = createStore(createInitialState());
      const storage = createStorageAdapter({ localStorage, sessionStorage });
      const fakeSdk = createFakeFirebaseSdk();

      const cloudSync = createCloudSyncService({
        firebaseSdk: fakeSdk,
        store,
        storage,
      });

      assert.equal(
        typeof cloudSync.syncPush,
        'function',
        'Expected cloudSync to expose syncPush method matching SYNC-04 specification contract'
      );
    });
  });

  describe('SYNC-05: Rapid State Change Debounce & Coalescing', () => {
    it('coalesces 10 consecutive mutations in under 200ms into a single setDoc call with the latest payload after 1000ms [SYNC-05]', async () => {
      const localStorage = createMemoryStorage();
      const sessionStorage = createMemoryStorage();
      const store = createStore(createInitialState());
      const storage = createStorageAdapter({ localStorage, sessionStorage });
      const fakeSdk = createFakeFirebaseSdk();
      const fakeClock = createFakeClock();

      const cloudSync = createCloudSyncService({
        firebaseSdk: fakeSdk,
        store,
        storage,
        debounceMs: 600,
        setTimeoutFn: fakeClock.setTimeoutFn,
        clearTimeoutFn: fakeClock.clearTimeoutFn,
      });

      await cloudSync.init();
      await cloudSync.signIn();

      // Clear any initial writes from sign-in
      fakeSdk.getSetDocCalls().length = 0;

      // Trigger 10 consecutive store mutations in under 200ms (10 mutations * 15ms = 150ms < 200ms)
      for (let i = 1; i <= 10; i++) {
        store.setState({
          mistakes: new Set([`q_${i}`]),
          mistakeTimestamps: { [`q_${i}`]: { updatedAt: 1000 + i, removed: false } },
          userStats: {
            totalAnswered: i,
            totalCorrect: i,
            examsCompleted: 0,
            lastResetAt: 0,
            categoryStats: {},
          },
        });
        cloudSync.schedulePush();
        await fakeClock.advanceTimers(15);
      }

      // Assert setDoc was NOT called during the rapid sequence (< 600ms debounce)
      assert.equal(
        fakeSdk.getSetDocCalls().length,
        0,
        'setDoc must not be called before debounce interval expires'
      );

      // Advance fake timers past 1000ms
      await fakeClock.advanceTimers(1000);

      // Assert setDoc was called exactly once
      const calls = fakeSdk.getSetDocCalls();
      assert.equal(
        calls.length,
        1,
        'setDoc must be called exactly once for 10 coalesced rapid updates'
      );

      // Assert the write payload contains the coalesced latest (10th) state
      const pushedPayload = calls[0].data;
      assert.deepEqual(
        new Set(pushedPayload.mistakes),
        new Set(['q_10']),
        'Pushed payload must contain the latest coalesced mistakes set'
      );
      assert.equal(
        pushedPayload.userStats.totalAnswered,
        10,
        'Pushed payload must reflect the latest coalesced userStats.totalAnswered'
      );
      assert.equal(
        pushedPayload.userStats.totalCorrect,
        10,
        'Pushed payload must reflect the latest coalesced userStats.totalCorrect'
      );
    });

    it('does not execute remote network writes before debounce interval elapses [SYNC-05]', async () => {
      const localStorage = createMemoryStorage();
      const sessionStorage = createMemoryStorage();
      const store = createStore(createInitialState());
      const storage = createStorageAdapter({ localStorage, sessionStorage });
      const fakeSdk = createFakeFirebaseSdk();
      const fakeClock = createFakeClock();

      const cloudSync = createCloudSyncService({
        firebaseSdk: fakeSdk,
        store,
        storage,
        debounceMs: 600,
        setTimeoutFn: fakeClock.setTimeoutFn,
        clearTimeoutFn: fakeClock.clearTimeoutFn,
      });

      await cloudSync.init();
      await cloudSync.signIn();
      fakeSdk.getSetDocCalls().length = 0;

      // Mutation 1 at t=0
      store.setState({ mistakes: new Set(['q_a']) });
      cloudSync.schedulePush();

      // Advance 300ms (< 600ms)
      await fakeClock.advanceTimers(300);
      assert.equal(fakeSdk.getSetDocCalls().length, 0);

      // Mutation 2 at t=300 (resets debounce timer)
      store.setState({ mistakes: new Set(['q_b']) });
      cloudSync.schedulePush();

      // Advance another 400ms (t=700, but only 400ms since Mutation 2, so < 600ms from Mutation 2)
      await fakeClock.advanceTimers(400);
      assert.equal(fakeSdk.getSetDocCalls().length, 0);

      // Advance 250ms more (650ms since Mutation 2 > 600ms debounce)
      await fakeClock.advanceTimers(250);
      assert.equal(fakeSdk.getSetDocCalls().length, 1);
      assert.deepEqual(fakeSdk.getSetDocCalls()[0].data.mistakes, ['q_b']);
    });
  });

  describe('SYNC-06: Auth Sign-Out Listener Teardown & Timer Cleanup', () => {
    it('unsubscribes onSnapshot real-time listener on auth signOut and blocks subsequent remote pushes [SYNC-06]', async () => {
      const localStorage = createMemoryStorage();
      const sessionStorage = createMemoryStorage();
      const store = createStore(createInitialState());
      const storage = createStorageAdapter({ localStorage, sessionStorage });
      const fakeSdk = createFakeFirebaseSdk();
      const fakeClock = createFakeClock();

      const cloudSync = createCloudSyncService({
        firebaseSdk: fakeSdk,
        store,
        storage,
        debounceMs: 600,
        setTimeoutFn: fakeClock.setTimeoutFn,
        clearTimeoutFn: fakeClock.clearTimeoutFn,
      });

      await cloudSync.init();
      await cloudSync.signIn();

      // Assert onSnapshot listener is active while authenticated
      assert.equal(
        fakeSdk.isSnapshotActive(),
        true,
        'Firestore onSnapshot listener must be active after sign-in'
      );

      // Trigger auth sign-out
      const signedOut = await cloudSync.signOut();
      assert.equal(signedOut, true, 'signOut must resolve to true');

      // Assert onSnapshot listener unsubscribe function was invoked
      assert.equal(
        fakeSdk.isSnapshotUnsubscribed(),
        true,
        'Snapshot listener unsubscribe function must be invoked on signOut'
      );
      assert.equal(
        fakeSdk.isSnapshotActive(),
        false,
        'Snapshot listener must be deactivated after signOut'
      );
      assert.equal(cloudSync.getAuthUser(), null, 'Current auth user must be null after signOut');

      // Subsequent store mutation and push schedule must NOT trigger remote writes
      fakeSdk.getSetDocCalls().length = 0;
      store.setState({
        mistakes: new Set(['q_after_signout']),
        mistakeTimestamps: { q_after_signout: { updatedAt: 9999, removed: false } },
      });
      cloudSync.schedulePush();

      await fakeClock.advanceTimers(2000);
      assert.equal(
        fakeSdk.getSetDocCalls().length,
        0,
        'Subsequent store mutations after sign-out must not trigger remote pushes'
      );

      // Local progress must remain preserved in store
      assert.equal(store.getState().mistakes.has('q_after_signout'), true);
    });

    it('cancels pending push debounce timer via clearTimeout on auth signOut [SYNC-06]', async () => {
      const localStorage = createMemoryStorage();
      const sessionStorage = createMemoryStorage();
      const store = createStore(createInitialState());
      const storage = createStorageAdapter({ localStorage, sessionStorage });
      const fakeSdk = createFakeFirebaseSdk();
      const fakeClock = createFakeClock();

      const cloudSync = createCloudSyncService({
        firebaseSdk: fakeSdk,
        store,
        storage,
        debounceMs: 600,
        setTimeoutFn: fakeClock.setTimeoutFn,
        clearTimeoutFn: fakeClock.clearTimeoutFn,
      });

      await cloudSync.init();
      await cloudSync.signIn();

      // Trigger a state change and schedule push (creates a pending timer)
      store.setState({ mistakes: new Set(['q_pending_push']) });
      cloudSync.schedulePush();

      // Assert timer is currently pending
      assert.equal(
        fakeClock.getActiveTimerCount(),
        1,
        'A push debounce timer should be pending before signOut'
      );
      const pendingTimerId = Array.from(fakeClock.getActiveTimers().keys())[0];

      // Trigger auth signOut()
      await cloudSync.signOut();

      // Assert the pending push timer was cancelled via clearTimeout
      const clearedIds = fakeClock.getClearedTimerIds();
      assert.ok(
        clearedIds.includes(pendingTimerId),
        `Pending push timer ID (${pendingTimerId}) must be cancelled via clearTimeout on signOut, but was not in [${clearedIds}]`
      );
      assert.equal(
        fakeClock.getActiveTimerCount(),
        0,
        'No orphaned debounce timers should remain active after signOut'
      );
    });
  });
});
