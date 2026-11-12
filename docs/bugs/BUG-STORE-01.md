# BUG-STORE-01: Missing In-Memory Fallback Cache and User Warning on `QuotaExceededError`

- **Requirement**: `STORE-01` (LocalStorage Quota Limit Fallback)
- **Severity**: High (Data Loss & UX Degradation on Storage-Constrained / Private Browsing Devices)
- **Status**: Resolved in v3.0
- **Component**: `app/js/core/storage.js`
- **Failing Suite**: `tests/integration/storage-quota.test.js`

---

## 1. Description & Defect Analysis

On storage-constrained devices or in mobile private browsing mode (e.g. iOS Safari / Safari Private Mode), invoking `localStorage.setItem` throws `DOMException: QuotaExceededError`.

According to requirement `STORE-01`:

> Mock `localStorage.setItem` to throw `DOMException('QuotaExceededError')`. Verify storage adapter catches it, falls back to in-memory cache, and displays user warning without crashing the app.

### Observed Behavior

1. In `app/js/core/storage.js`, `saveProgress` wraps `localStorage.setItem` in a `try...catch` block and returns `false`:
   ```javascript
   function saveProgress({ mistakes, mistakeTimestamps = {}, savedExams = [], userStats }) {
     try {
       const payload = { ... };
       localStorage?.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(payload));
       return true;
     } catch {
       return false;
     }
   }
   ```
2. **Missing In-Memory Cache**: `storage.js` maintains no in-memory fallback cache. When `saveProgress` fails, the updated data is discarded. Subsequent invocations of `storage.loadProgress()` query `localStorage.getItem`, which returns `null` or outdated disk data. All mistakes and user statistics recorded during the active session are lost.
3. **Missing User Notification**: Neither `storage.js` nor the calling controllers (`study-controller.js`, `exam-controller.js`, `saved-exams-controller.js`) check the boolean return value of `saveProgress` or display any warning toast/banner to the user. The application fails silently, leaving the user under the false impression that their progress is safely stored.

---

## 2. Steps to Reproduce

1. Execute the dedicated integration test suite:
   ```bash
   node --test tests/integration/storage-quota.test.js
   ```
2. Observe test failures on subtests:
   - `falls back to in-memory cache when localStorage quota is exceeded so subsequent loads preserve session data [STORE-01]`
   - `displays user warning feedback when storage quota is exceeded during interactive usage [STORE-01]`

---

## 3. Recommended Remediation Plan (For Fix Phase)

1. **Implement In-Memory Fallback Store in `app/js/core/storage.js`**:
   - Introduce module- or adapter-level memory fallback objects (e.g., `inMemoryProgressStore`, `inMemoryExamSessionStore`, `inMemoryStudySessionStore`).
   - In `saveProgress()`, update `inMemoryProgressStore` upon catching `QuotaExceededError` or general storage write failures.
   - In `loadProgress()`, if `inMemoryProgressStore` has been set, return its contents if disk read yields nothing newer.
2. **Expose Warning Event or Callback**:
   - Provide a `onQuotaExceeded` callback in `createStorageAdapter` options or dispatch a storage warning event.
   - When quota limit is encountered, display a non-blocking toast to the user:
     `"שטח האחסון המקומי בדפדפן מלא. הנתונים נשמרים בזיכרון זמני עבור הפעלה זו."`
