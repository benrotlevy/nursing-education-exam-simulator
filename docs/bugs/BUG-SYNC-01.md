# BUG-SYNC-01: Cloud Push Failure Does Not Transition Store `auth.syncStatus` Indicator

- **Defect ID**: `BUG-SYNC-01`
- **Requirement**: `SYNC-04` (Offline Network Disconnect & Push Error Resilience)
- **Severity**: Medium
- **Status**: Open / Discovered in v3.0 Test Expansion
- **Detected By**: Worker 1 (`test/v3-cloud-sync`)
- **Failing Suite**: `tests/integration/cloud-sync-resilience.test.js` -> `transitions auth.syncStatus indicator to "offline" or "error" when cloud push fails [SYNC-04]`

---

## 1. Description & Impact

When an authenticated user experiences a network disconnect or Firestore timeout during cloud synchronization, `cloudSync.pushNow()` catches the error and logs a warning with `console.warn`, but fails to update `store.getState().auth.syncStatus`.

As a result:

- `auth.syncStatus` remains set to `'synced'` despite the failure to persist changes to Cloud Firestore.
- The UI indicator (`#syncStatusIndicator`) continues displaying active cloud sync (`☁️ סנכרון ענן פעיל`), misleading the user into believing their data was safely synced to the cloud.
- Violates `docs/standards/06-STATE-AND-PERSISTENCE.md` which defines the canonical lifecycle states: `'offline' | 'idle' | 'syncing' | 'synced' | 'error'`.

---

## 2. Root Cause Analysis

In `app/js/services/cloud-sync.js` (lines 116–140):

```javascript
async function pushNow() {
  if (!sdk || !auth || !auth.currentUser || !db || !store) return false;
  try {
    const state = store.getState();
    const userDocRef = sdk.doc(db, 'users', auth.currentUser.uid);
    const dataToPush = {/* payload */};
    await sdk.setDoc(userDocRef, dataToPush, { merge: true });
    if (typeof onSyncFlash === 'function') {
      onSyncFlash();
    }
    return true;
  } catch (err) {
    console.warn('Cloud push warning:', err);
    return false;
  }
}
```

The `catch` block catches the error and returns `false`, but does not invoke `store.setState()` to transition `auth.syncStatus` to `'offline'` or `'error'`.

---

## 3. Reproduction Steps

1. Authenticate user via `await cloudSync.signIn()`.
2. Observe `store.getState().auth.syncStatus === 'synced'`.
3. Configure fake Firebase SDK `setDoc` to throw a `NetworkError` (`err.code = 'unavailable'`).
4. Invoke `await cloudSync.pushNow()`.
5. Check `store.getState().auth.syncStatus`.
   - **Expected**: `'offline'` or `'error'`.
   - **Actual**: `'synced'`.

---

## 4. Recommended Fix (for Remediation Phase)

In `app/js/services/cloud-sync.js`, update `pushNow()` to update `auth.syncStatus` on catch:

```javascript
} catch (err) {
  console.warn('Cloud push warning:', err);
  if (store) {
    const currentAuth = store.getState().auth || {};
    const isOffline = err?.code === 'unavailable' || err?.name === 'NetworkError';
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
```
