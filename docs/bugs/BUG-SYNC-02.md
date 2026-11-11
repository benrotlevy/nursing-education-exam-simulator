# BUG-SYNC-02: Cloud Sync Service Does Not Expose `syncPush()` Method Alias

- **Defect ID**: `BUG-SYNC-02`
- **Requirement**: `SYNC-04` (Offline Network Disconnect & Push Error Resilience)
- **Severity**: Low / API Conformance
- **Status**: Open / Discovered in v3.0 Test Expansion
- **Detected By**: Worker 1 (`test/v3-cloud-sync`)
- **Failing Suite**: `tests/integration/cloud-sync-resilience.test.js` -> `exposes cloudSync.syncPush method per SYNC-04 specification [SYNC-04]`

---

## 1. Description & Impact

The STPR requirement specification `SYNC-04` states:

> "Mock setDoc in createFakeFirebaseSdk to reject with a NetworkError or Timeout. Verify cloudSync.syncPush() catches error gracefully without throwing unhandled promise rejections..."

However, `createCloudSyncService` in `app/js/services/cloud-sync.js` returns an object exposing only `pushNow` and `schedulePush`:

```javascript
return {
  init,
  signIn,
  signOut,
  getAuthUser,
  schedulePush,
  pushNow,
  resetCloudData,
  applyRemotePayload,
};
```

Any caller or integration test invoking `cloudSync.syncPush()` encounters `TypeError: cloudSync.syncPush is not a function`.

---

## 2. Root Cause Analysis

In `app/js/services/cloud-sync.js` line 326, the push method was named `pushNow` during initial extraction in Step 10, without exposing `syncPush` as an alias to satisfy the public domain specification.

---

## 3. Reproduction Steps

1. Instantiate cloud sync service: `const cloudSync = createCloudSyncService({ ... });`
2. Assert `typeof cloudSync.syncPush === 'function'`.
   - **Expected**: `'function'`.
   - **Actual**: `'undefined'`.

---

## 4. Recommended Fix (for Remediation Phase)

Expose `syncPush` as an alias pointing to `pushNow` in the return object of `createCloudSyncService` in `app/js/services/cloud-sync.js`:

```javascript
return {
  init,
  signIn,
  signOut,
  getAuthUser,
  schedulePush,
  pushNow,
  syncPush: pushNow,
  resetCloudData,
  applyRemotePayload,
};
```
