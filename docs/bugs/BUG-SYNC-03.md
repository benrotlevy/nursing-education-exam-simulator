# BUG-SYNC-03: Auth Sign-Out Fails to Clear Pending Push Debounce Timer via `clearTimeout`

- **Defect ID**: `BUG-SYNC-03`
- **Requirement**: `SYNC-06` (Auth Sign-Out Listener Teardown & Timer Cleanup)
- **Severity**: Medium / Memory Leak & Lifecycle
- **Status**: Open / Discovered in v3.0 Test Expansion
- **Detected By**: Worker 1 (`test/v3-cloud-sync`)
- **Failing Suite**: `tests/integration/cloud-sync-resilience.test.js` -> `cancels pending push debounce timer via clearTimeout on auth signOut [SYNC-06]`

---

## 1. Description & Impact

When an authenticated user signs out via `cloudSync.signOut()`, any pending debounce timer created by `schedulePush()` remains active in the timer queue.

Although `pushNow()` performs a null-check on `auth.currentUser` when the timer callback executes and returns `false`, failing to call `clearTimeout(pushDebounceTimer)` leaves orphaned timers active in the runtime event loop.

Impact:

- In Node.js or browser environments, orphaned timers prevent clean teardown and cause test timeouts or memory leaks.
- Violates the strict requirement in STPR `SYNC-06`: _"pending push timer was cancelled via clearTimeout"_.

---

## 2. Root Cause Analysis

In `app/js/services/cloud-sync.js` (lines 306–320):

```javascript
async function signOut() {
  if (!auth || !sdk) return false;
  try {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    await sdk.signOut(auth);
    toast?.showToast('התנתקת מחשבון הענן. הנתונים ממשיכים להישמר מקומית בדפדפן.');
    return true;
  } catch (err) {
    console.error('Firebase Sign-out error:', err);
    return false;
  }
}
```

Notice `pushDebounceTimer` is never cancelled with `clearTimeoutFn(pushDebounceTimer)` and reset to `null`.

Additionally, in `handleAuthUserChange(user)` (lines 237–240), when `user` transitions to `null`:

```javascript
} else if (unsubscribeSnapshot) {
  unsubscribeSnapshot();
  unsubscribeSnapshot = null;
}
```

Here too, `clearTimeoutFn` is omitted.

---

## 3. Reproduction Steps

1. Authenticate user: `await cloudSync.signIn();`.
2. Schedule a push via `cloudSync.schedulePush();`.
3. Verify 1 debounce timer is actively pending in the clock/runtime.
4. Call `await cloudSync.signOut();`.
5. Check if `clearTimeout` was called for the pending timer.
   - **Expected**: `clearTimeout` called, active timer count is 0.
   - **Actual**: `clearTimeout` NOT called, active timer count is 1.

---

## 4. Recommended Fix (for Remediation Phase)

In `app/js/services/cloud-sync.js`, clear `pushDebounceTimer` during `signOut()` and `handleAuthUserChange(null)`:

```javascript
async function signOut() {
  if (!auth || !sdk) return false;
  try {
    if (pushDebounceTimer) {
      clearTimeoutFn(pushDebounceTimer);
      pushDebounceTimer = null;
    }
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    await sdk.signOut(auth);
    toast?.showToast('התנתקת מחשבון הענן. הנתונים ממשיכים להישמר מקומית בדפדפן.');
    return true;
  } catch (err) {
    console.error('Firebase Sign-out error:', err);
    return false;
  }
}
```
