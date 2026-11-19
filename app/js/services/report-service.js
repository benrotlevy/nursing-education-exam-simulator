/**
 * Question Issue Report Service (`app/js/services/report-service.js`)
 * Handles Firestore CRUD for `/question_reports` and secret-safe Telegram webhook dispatch.
 */

import { REPORT_LIMITS, REPORT_STATUSES, TELEGRAM_WEBHOOK_URL } from '../config.js';
import {
  buildQuestionReportPayload,
  formatTelegramAlertPayload,
  isAdminUser,
  validateReportDraft,
} from '../domain/question-report.js';

const COLLECTION_NAME = 'question_reports';

function createOfflineReportError(code = 'REPORT_OFFLINE') {
  const err = new Error('Offline or report submission timed out');
  err.code = code;
  return err;
}

function withTimeout(promise, timeoutMs, errorFactory) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(errorFactory());
    }, timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        globalThis.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function createReportService({
  cloudSync,
  webhookUrl = TELEGRAM_WEBHOOK_URL,
  fetchFn = globalThis.fetch,
  navigator = globalThis.navigator,
  writeTimeoutMs = 10000,
} = {}) {
  let unsubscribeCountListener = null;

  function isBrowserOffline() {
    return Boolean(navigator && navigator.onLine === false);
  }

  async function ensureFirebaseReady() {
    if (!cloudSync) {
      return { ready: false };
    }
    let ctx = cloudSync.getFirebaseContext?.();
    if (!ctx?.initialized && typeof cloudSync.init === 'function') {
      await cloudSync.init();
      ctx = cloudSync.getFirebaseContext?.();
    }
    return {
      ready: Boolean(ctx?.sdk && ctx?.db && ctx?.auth),
      sdk: ctx?.sdk || null,
      auth: ctx?.auth || null,
      db: ctx?.db || null,
    };
  }

  async function dispatchTelegramWebhook(payload, reportId) {
    const cleanUrl = typeof webhookUrl === 'string' ? webhookUrl.trim() : '';
    if (!cleanUrl || typeof fetchFn !== 'function' || isBrowserOffline()) {
      return false;
    }

    try {
      const alertBody = formatTelegramAlertPayload(payload, reportId);
      const res = await withTimeout(
        fetchFn(cleanUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertBody),
        }),
        writeTimeoutMs,
        () => createOfflineReportError('REPORT_WEBHOOK_TIMEOUT')
      );
      if (!res || !res.ok) {
        console.warn('Telegram notification dispatch returned non-OK status:', res?.status);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Telegram notification dispatch warning:', err);
      return false;
    }
  }

  /**
   * Validates and submits a question issue report to Firestore, then triggers webhook if configured.
   */
  async function submitReport({ question, issueType, comment } = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready) {
      return {
        ok: false,
        message: 'שירות הענן אינו זמין כעת. אנא בדוק את החיבור לאינטרנט ונסה שוב.',
      };
    }

    const user = fb.auth.currentUser;
    const validation = validateReportDraft({
      questionId: question?.id,
      issueType,
      comment,
      user,
    });
    if (!validation.ok) {
      return {
        ok: false,
        requiresAuth: validation.field === 'auth',
        field: validation.field,
        message: validation.message,
      };
    }

    const payload = buildQuestionReportPayload({
      question,
      issueType: validation.normalized.issueType,
      comment: validation.normalized.comment,
      user,
    });

    if (isBrowserOffline()) {
      return {
        ok: false,
        offline: true,
        message: 'אין חיבור לאינטרנט. לא ניתן לשלוח דיווח במצב לא מקוון.',
      };
    }

    try {
      let reportId = '';
      if (typeof fb.sdk.collection === 'function' && typeof fb.sdk.addDoc === 'function') {
        const colRef = fb.sdk.collection(fb.db, COLLECTION_NAME);
        const docRef = await withTimeout(fb.sdk.addDoc(colRef, payload), writeTimeoutMs, () =>
          createOfflineReportError('REPORT_WRITE_TIMEOUT')
        );
        reportId = docRef?.id || '';
      } else {
        reportId = `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const docRef = fb.sdk.doc(fb.db, COLLECTION_NAME, reportId);
        await withTimeout(fb.sdk.setDoc(docRef, payload), writeTimeoutMs, () =>
          createOfflineReportError('REPORT_WRITE_TIMEOUT')
        );
      }

      const webhookSent = await dispatchTelegramWebhook(payload, reportId);
      return {
        ok: true,
        reportId,
        webhookSent,
      };
    } catch (err) {
      console.error('Failed to submit question report:', err);
      const isDenied = err?.code === 'permission-denied';
      const isOfflineErr =
        isBrowserOffline() ||
        err?.code === 'REPORT_WRITE_TIMEOUT' ||
        err?.code === 'REPORT_OFFLINE' ||
        err?.code === 'unavailable';
      return {
        ok: false,
        ...(isOfflineErr ? { offline: true } : {}),
        message: isDenied
          ? 'אין הרשאה לשלוח דיווח. ודא שהתחברת לחשבון ושהנתונים תקינים.'
          : isOfflineErr
            ? 'אין חיבור לאינטרנט או שהשרת אינו זמין כרגע. הדיווח לא נשלח — נסה שוב כשתחזור לרשת.'
            : 'אירעה שגיאה בשליחת הדיווח. אנא נסה שנית.',
      };
    }
  }

  /**
   * Fetches all question reports for the authenticated administrator (newest first).
   */
  async function fetchReports({ maxResults = 100, throwOnError = false } = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready) return [];

    const user = fb.auth.currentUser;
    if (!isAdminUser(user)) {
      return [];
    }

    if (typeof fb.sdk.collection !== 'function' || typeof fb.sdk.getDocs !== 'function') {
      return [];
    }

    try {
      const colRef = fb.sdk.collection(fb.db, COLLECTION_NAME);
      let qRef = colRef;
      if (
        typeof fb.sdk.query === 'function' &&
        typeof fb.sdk.orderBy === 'function' &&
        typeof fb.sdk.limit === 'function'
      ) {
        qRef = fb.sdk.query(colRef, fb.sdk.orderBy('createdAt', 'desc'), fb.sdk.limit(maxResults));
      }

      const snapshot = await withTimeout(fb.sdk.getDocs(qRef), writeTimeoutMs, () =>
        createOfflineReportError('REPORT_FETCH_TIMEOUT')
      );
      const results = [];
      if (snapshot && Array.isArray(snapshot.docs)) {
        for (const docSnap of snapshot.docs) {
          results.push({ id: docSnap.id, ...(docSnap.data() || {}) });
        }
      } else if (snapshot && typeof snapshot.forEach === 'function') {
        snapshot.forEach((docSnap) => {
          results.push({ id: docSnap.id, ...(docSnap.data() || {}) });
        });
      }
      return results;
    } catch (err) {
      console.error('Failed to fetch question reports:', err);
      if (throwOnError) {
        throw err;
      }
      return [];
    }
  }

  /**
   * Attaches a real-time Firestore listener counting OPEN reports for verified admin users.
   * Returns an unsubscribe function.
   */
  async function subscribeOpenReportsCount(onCountChange) {
    unsubscribeOpenReports();
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      if (typeof onCountChange === 'function') onCountChange(0);
      return () => {};
    }

    if (
      typeof fb.sdk.collection !== 'function' ||
      typeof fb.sdk.query !== 'function' ||
      typeof fb.sdk.where !== 'function' ||
      typeof fb.sdk.onSnapshot !== 'function'
    ) {
      return () => {};
    }

    try {
      const colRef = fb.sdk.collection(fb.db, COLLECTION_NAME);
      const qRef = fb.sdk.query(colRef, fb.sdk.where('status', '==', REPORT_STATUSES.OPEN));
      unsubscribeCountListener = fb.sdk.onSnapshot(
        qRef,
        (snapshot) => {
          const count =
            typeof snapshot?.size === 'number'
              ? snapshot.size
              : Array.isArray(snapshot?.docs)
                ? snapshot.docs.length
                : 0;
          if (typeof onCountChange === 'function') {
            onCountChange(count);
          }
        },
        (err) => {
          console.warn('Admin open reports listener warning:', err);
        }
      );
      return unsubscribeOpenReports;
    } catch (err) {
      console.warn('Could not attach open reports listener:', err);
      return () => {};
    }
  }

  function unsubscribeOpenReports() {
    if (typeof unsubscribeCountListener === 'function') {
      unsubscribeCountListener();
      unsubscribeCountListener = null;
    }
  }

  /**
   * Updates the status (`OPEN`, `RESOLVED`, `DISMISSED`) and optional admin note on a report.
   */
  async function updateReportStatus({ reportId, status, adminNote = '' } = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser) || !reportId) {
      return { ok: false, message: 'פעולה מורשית למנהל מערכת בלבד.' };
    }

    const nowIso = new Date().toISOString();
    const cleanNote = String(adminNote || '')
      .trim()
      .slice(0, REPORT_LIMITS.MAX_ADMIN_NOTE_LENGTH);

    const updateData = {
      status,
      updatedAt: nowIso,
      resolvedAt: status === REPORT_STATUSES.OPEN ? null : nowIso,
      ...(cleanNote ? { adminNote: cleanNote } : {}),
    };

    try {
      const docRef = fb.sdk.doc(fb.db, COLLECTION_NAME, reportId);
      if (typeof fb.sdk.updateDoc === 'function') {
        await fb.sdk.updateDoc(docRef, updateData);
      } else {
        await fb.sdk.setDoc(docRef, updateData, { merge: true });
      }
      return { ok: true, updateData };
    } catch (err) {
      console.error('Failed to update report status:', err);
      return { ok: false, message: 'עדכון הסטטוס נכשל.' };
    }
  }

  /**
   * Permanently deletes a report document (admin only).
   */
  async function deleteReport(reportId) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser) || !reportId) {
      return { ok: false, message: 'פעולה מורשית למנהל מערכת בלבד.' };
    }

    if (typeof fb.sdk.deleteDoc !== 'function') {
      return { ok: false, message: 'מחיקה אינה נתמכת בסביבה זו.' };
    }

    try {
      const docRef = fb.sdk.doc(fb.db, COLLECTION_NAME, reportId);
      await fb.sdk.deleteDoc(docRef);
      return { ok: true };
    } catch (err) {
      console.error('Failed to delete report:', err);
      return { ok: false, message: 'מחיקת הדיווח נכשלה.' };
    }
  }

  return {
    submitReport,
    fetchReports,
    subscribeOpenReportsCount,
    unsubscribeOpenReports,
    updateReportStatus,
    deleteReport,
  };
}
