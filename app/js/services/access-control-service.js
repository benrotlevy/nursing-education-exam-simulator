/**
 * Access Control & Encrypted Key Service (`app/js/services/access-control-service.js`)
 * Manages invite-only user verification (`/allowed_users/{email}`), offline PWA approval
 * caching, `/app_config/catalog_key` & `/app_config/contact`, instant Telegram push
 * notifications on new sign-ins/requests, and Admin 1-tap user management.
 */

import {
  ACCESS_LIMITS,
  ACCESS_STATUSES,
  ADMIN_EMAILS,
  DEFAULT_ADMIN_DISPLAY_NAME,
  DEFAULT_TELEGRAM_ADMIN_URL,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  TELEGRAM_WEBHOOK_URL,
} from '../config.js';
import {
  buildAllowedUserPayload,
  buildNewUserTelegramPayloads,
  buildPendingAccessRequestPayload,
  evaluateAccessRequestCooldown,
  evaluateUserAccessState,
  isValidEmailAddress,
  normalizeEmail,
  normalizeTelegramChatUrl,
} from '../domain/access-control.js';
import { isAdminUser } from '../domain/question-report.js';

const ALLOWED_USERS_COLLECTION = 'allowed_users';
const APP_CONFIG_COLLECTION = 'app_config';
const CATALOG_KEY_DOC_ID = 'catalog_key';
const CONTACT_CONFIG_DOC_ID = 'contact';

function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      const err = new Error('Firestore access check timed out');
      err.code = 'ACCESS_TIMEOUT';
      reject(err);
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

function readJsonStorage(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(storage, key, value) {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function createAccessControlService({
  cloudSync,
  localStorage = globalThis.localStorage,
  webhookUrl = TELEGRAM_WEBHOOK_URL,
  fetchFn = globalThis.fetch,
  navigator = globalThis.navigator,
  requestTimeoutMs = 10000,
  nowFn = () => Date.now(),
} = {}) {
  let unsubscribePendingListener = null;
  let unsubscribeUserAccessListener = null;

  function isBrowserOffline() {
    return Boolean(navigator && navigator.onLine === false);
  }

  async function ensureFirebaseReady() {
    if (!cloudSync) return { ready: false };
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

  function loadCachedApproval() {
    return readJsonStorage(localStorage, STORAGE_KEYS.ACCESS_APPROVAL);
  }

  function saveCachedApproval(data) {
    writeJsonStorage(localStorage, STORAGE_KEYS.ACCESS_APPROVAL, data);
  }

  function clearCachedApproval() {
    if (!localStorage || typeof localStorage.removeItem !== 'function') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_APPROVAL);
    } catch {
      // Ignore
    }
  }

  function readSignInNotificationEntry(email) {
    const clean = normalizeEmail(email);
    const map = readJsonStorage(localStorage, STORAGE_KEYS.SIGNIN_NOTIFIED);
    const entry = clean && map ? map[clean] : null;
    if (!entry) return null;
    if (typeof entry === 'string') {
      return { signInNotifiedAt: entry, lastRequestAt: '' };
    }
    return typeof entry === 'object' ? entry : null;
  }

  function wasSignInNotified(email) {
    return Boolean(readSignInNotificationEntry(email));
  }

  function getLastLocalRequestAt(email) {
    const entry = readSignInNotificationEntry(email);
    if (!entry?.lastRequestAt) return 0;
    const ms = Date.parse(String(entry.lastRequestAt));
    return Number.isFinite(ms) ? ms : 0;
  }

  function markSignInNotified(email) {
    const clean = normalizeEmail(email);
    if (!clean) return;
    const map = readJsonStorage(localStorage, STORAGE_KEYS.SIGNIN_NOTIFIED) || {};
    const prev = readSignInNotificationEntry(clean);
    map[clean] = {
      signInNotifiedAt: prev?.signInNotifiedAt || new Date(nowFn()).toISOString(),
      lastRequestAt: prev?.lastRequestAt || '',
    };
    writeJsonStorage(localStorage, STORAGE_KEYS.SIGNIN_NOTIFIED, map);
  }

  function markExplicitRequestSent(email, timestampMs = nowFn()) {
    const clean = normalizeEmail(email);
    if (!clean) return;
    const map = readJsonStorage(localStorage, STORAGE_KEYS.SIGNIN_NOTIFIED) || {};
    const prev = readSignInNotificationEntry(clean);
    const iso = new Date(timestampMs).toISOString();
    map[clean] = {
      signInNotifiedAt: prev?.signInNotifiedAt || iso,
      lastRequestAt: iso,
    };
    writeJsonStorage(localStorage, STORAGE_KEYS.SIGNIN_NOTIFIED, map);
  }

  /**
   * Sends a Telegram alert for a new user sign-in or access request.
   * Uses the modern `NEW_USER_SIGN_IN` payload and automatically falls back
   * to the compatible `QUESTION_ISSUE_REPORT` schema if the Cloudflare Worker returns 400.
   */
  async function dispatchNewUserTelegramAlert({
    user,
    note = '',
    isExplicitRequest = false,
    status = 'PENDING',
  } = {}) {
    const cleanUrl = typeof webhookUrl === 'string' ? webhookUrl.trim() : '';
    if (!cleanUrl || typeof fetchFn !== 'function' || isBrowserOffline()) {
      return false;
    }

    const { modernPayload, compatiblePayload } = buildNewUserTelegramPayloads({
      user,
      note,
      isExplicitRequest,
      status,
    });

    try {
      const res = await withTimeout(
        fetchFn(cleanUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modernPayload),
        }),
        requestTimeoutMs
      );

      if (res?.ok) {
        return true;
      }

      // Backward compatibility: older deployed Cloudflare Workers validate `type === 'QUESTION_ISSUE_REPORT'`
      if (res && (res.status === 400 || res.status === 422)) {
        const fallbackRes = await withTimeout(
          fetchFn(cleanUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(compatiblePayload),
          }),
          requestTimeoutMs
        );
        return Boolean(fallbackRes?.ok);
      }

      return false;
    } catch (err) {
      console.warn('Telegram access alert warning:', err);
      return false;
    }
  }

  async function fetchContactConfigInternal(fb) {
    if (!fb?.ready || typeof fb.sdk.getDoc !== 'function') {
      return { telegramUrl: DEFAULT_TELEGRAM_ADMIN_URL };
    }
    try {
      const ref = fb.sdk.doc(fb.db, APP_CONFIG_COLLECTION, CONTACT_CONFIG_DOC_ID);
      const snap = await withTimeout(fb.sdk.getDoc(ref), requestTimeoutMs);
      if (snap && typeof snap.exists === 'function' && snap.exists()) {
        const data = snap.data() || {};
        return {
          telegramUrl: normalizeTelegramChatUrl(data.telegramUrl || DEFAULT_TELEGRAM_ADMIN_URL),
        };
      }
    } catch {
      // Optional config doc may not exist yet
    }
    return { telegramUrl: normalizeTelegramChatUrl(DEFAULT_TELEGRAM_ADMIN_URL) };
  }

  /**
   * Resolves the signed-in user's approval state, auto-registers first-time pending users,
   * triggers a Telegram alert for new unapproved sign-ins, and retrieves/caches the catalog key.
   */
  async function checkUserAccess(user) {
    const cleanEmail = normalizeEmail(user?.email);
    const cached = loadCachedApproval();

    if (!user || !cleanEmail) {
      clearCachedApproval();
      return {
        status: ACCESS_STATUSES.GUEST,
        approved: false,
        isAdmin: false,
        fromCache: false,
        keyBase64: '',
        telegramUrl: normalizeTelegramChatUrl(DEFAULT_TELEGRAM_ADMIN_URL),
      };
    }

    const adminFlag = isAdminUser(user);
    const fb = await ensureFirebaseReady();
    const offline = isBrowserOffline();

    let allowedDoc = null;
    let keyBase64 = '';
    let telegramUrl = normalizeTelegramChatUrl(DEFAULT_TELEGRAM_ADMIN_URL);
    let lookupFailed = false;
    let firstTimePendingCreated = false;
    let docExistedOnServer = false;

    if (fb.ready && !offline && typeof fb.sdk.getDoc === 'function') {
      const contactInfo = await fetchContactConfigInternal(fb);
      telegramUrl = contactInfo.telegramUrl || telegramUrl;

      if (!adminFlag) {
        try {
          const allowRef = fb.sdk.doc(fb.db, ALLOWED_USERS_COLLECTION, cleanEmail);
          const allowSnap = await withTimeout(fb.sdk.getDoc(allowRef), requestTimeoutMs);

          if (allowSnap && typeof allowSnap.exists === 'function' && allowSnap.exists()) {
            allowedDoc = allowSnap.data() || null;
            docExistedOnServer = true;
          } else {
            // First time this signed-in user hits the app -> create a PENDING entry & alert admin once
            const pendingPayload = buildPendingAccessRequestPayload({ user });
            try {
              await withTimeout(fb.sdk.setDoc(allowRef, pendingPayload), requestTimeoutMs);
              allowedDoc = pendingPayload;
              firstTimePendingCreated = true;
            } catch (createErr) {
              console.warn('Could not register initial pending access record:', createErr);
              allowedDoc = { ...pendingPayload };
            }
          }
        } catch (err) {
          console.warn('Access lookup warning:', err);
          lookupFailed = true;
        }
      }

      if (adminFlag || allowedDoc?.active === true) {
        try {
          const keyRef = fb.sdk.doc(fb.db, APP_CONFIG_COLLECTION, CATALOG_KEY_DOC_ID);
          const keySnap = await withTimeout(fb.sdk.getDoc(keyRef), requestTimeoutMs);
          if (keySnap && typeof keySnap.exists === 'function' && keySnap.exists()) {
            keyBase64 = String(keySnap.data()?.keyBase64 || '').trim();
          }
        } catch (keyErr) {
          console.warn('Catalog key fetch warning:', keyErr);
          lookupFailed = true;
        }
      }
    } else if (offline) {
      lookupFailed = true;
      if (cached && normalizeEmail(cached.email) === cleanEmail) {
        telegramUrl = normalizeTelegramChatUrl(cached.telegramUrl || telegramUrl);
      }
    }

    const decision = evaluateUserAccessState({
      user,
      isAdmin: adminFlag,
      allowedDoc,
      keyBase64,
      telegramUrl,
      cachedApproval: cached,
      isOffline: offline,
      lookupFailed,
    });

    if (decision.approved && decision.keyBase64) {
      saveCachedApproval({
        uid: user.uid || '',
        email: cleanEmail,
        approved: true,
        keyBase64: decision.keyBase64,
        telegramUrl: decision.telegramUrl,
        cachedAt: new Date().toISOString(),
      });
    } else if (!decision.approved && allowedDoc && allowedDoc.active === false) {
      // Explicitly revoked or pending on server: invalidate any stale local approval
      clearCachedApproval();
    }

    // Send 1-time Telegram push alert only when a user signs in for the very first time (not if doc already existed on server)
    if (!decision.approved && !adminFlag && !offline) {
      if (docExistedOnServer) {
        markSignInNotified(cleanEmail);
      } else {
        const shouldNotify =
          firstTimePendingCreated ||
          (decision.status === ACCESS_STATUSES.PENDING && !wasSignInNotified(cleanEmail));
        if (shouldNotify) {
          const sent = await dispatchNewUserTelegramAlert({
            user,
            note: allowedDoc?.note || '',
            isExplicitRequest: false,
            status: 'PENDING',
          });
          if (sent) {
            markSignInNotified(cleanEmail);
          }
        }
      }
    }

    const requestCooldown = evaluateAccessRequestCooldown({
      allowedDoc,
      lastLocalRequestAt: getLastLocalRequestAt(cleanEmail),
      nowMs: nowFn(),
    });

    return {
      ...decision,
      isAdmin: adminFlag,
      note: allowedDoc?.note || '',
      lookupFailed: Boolean(lookupFailed),
      requestCooldownUntil: requestCooldown.cooldownUntil,
    };
  }

  /**
   * Explicit access request submitted by a signed-in PENDING student with an optional note.
   */
  async function submitAccessRequest({ note = '' } = {}) {
    if (isBrowserOffline()) {
      return {
        ok: false,
        offline: true,
        message: 'אין חיבור לאינטרנט. לא ניתן לשלוח בקשת גישה במצב לא מקוון.',
      };
    }

    const fb = await ensureFirebaseReady();
    const user = fb?.auth?.currentUser;
    const cleanEmail = normalizeEmail(user?.email);
    if (!fb.ready || !user || !cleanEmail) {
      return { ok: false, message: 'יש להתחבר תחילה לחשבון Google.' };
    }

    const cleanNote = String(note || '')
      .trim()
      .slice(0, ACCESS_LIMITS.MAX_NOTE_LENGTH);

    try {
      const allowRef = fb.sdk.doc(fb.db, ALLOWED_USERS_COLLECTION, cleanEmail);
      const snap = await withTimeout(fb.sdk.getDoc(allowRef), requestTimeoutMs);
      const existingData = snap?.exists?.() ? snap.data() : null;

      if (existingData?.active === true) {
        return {
          ok: true,
          alreadyApproved: true,
          message: 'חשבונך כבר מאושר! טוען את המאגר המלא...',
        };
      }

      if (existingData?.status === 'REVOKED') {
        return {
          ok: false,
          message: 'הגישה לחשבון זה הושהתה על ידי המנהל. ניתן לפנות למנהל ב-Telegram.',
        };
      }

      const cooldown = evaluateAccessRequestCooldown({
        allowedDoc: existingData,
        lastLocalRequestAt: getLastLocalRequestAt(cleanEmail),
        nowMs: nowFn(),
      });
      if (cooldown.inCooldown) {
        return {
          ok: false,
          cooldown: true,
          remainingMinutes: cooldown.remainingMinutes,
          requestCooldownUntil: cooldown.cooldownUntil,
          message: `בקשת גישה כבר נשלחה לאחרונה. ניתן לשלוח בקשה נוספת בעוד ${cooldown.remainingMinutes} דקות.`,
        };
      }

      const existingAddedMs = existingData?.addedAt ? Date.parse(String(existingData.addedAt)) : 0;
      const safeAddedMs = Number.isFinite(existingAddedMs) ? existingAddedMs : 0;
      const reqNowMs = Math.max(nowFn(), safeAddedMs + 1);

      const payload = buildPendingAccessRequestPayload({
        user,
        note: cleanNote,
        existingAddedAt: existingData?.addedAt || '',
        now: new Date(reqNowMs),
      });

      await withTimeout(fb.sdk.setDoc(allowRef, payload), requestTimeoutMs);
      await dispatchNewUserTelegramAlert({
        user,
        note: cleanNote,
        isExplicitRequest: true,
        status: 'PENDING',
        now: new Date(reqNowMs),
      });
      markExplicitRequestSent(cleanEmail, reqNowMs);

      return {
        ok: true,
        requestCooldownUntil: reqNowMs + ACCESS_LIMITS.REQUEST_COOLDOWN_MS,
        message: 'בקשת הגישה נשלחה למנהל המערכת! תקבל אישור בקרוב.',
      };
    } catch (err) {
      console.error('Failed to submit access request:', err);
      return { ok: false, message: 'שליחת הבקשה נכשלה. אנא נסה שוב.' };
    }
  }

  /**
   * Fetches all `/allowed_users` documents for the Admin Dashboard.
   */
  async function fetchAllowedUsers({ throwOnError = false } = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      return [];
    }
    if (typeof fb.sdk.collection !== 'function' || typeof fb.sdk.getDocs !== 'function') {
      return [];
    }

    try {
      const colRef = fb.sdk.collection(fb.db, ALLOWED_USERS_COLLECTION);
      // Fetch full collection without server-side orderBy so docs missing `updatedAt` are never excluded
      const snap = await withTimeout(fb.sdk.getDocs(colRef), requestTimeoutMs);
      const items = [];
      const seenEmails = new Set();
      if (snap && Array.isArray(snap.docs)) {
        for (const d of snap.docs) {
          const item = { id: d.id, ...(d.data() || {}) };
          items.push(item);
          seenEmails.add(normalizeEmail(item.email || d.id));
        }
      } else if (snap && typeof snap.forEach === 'function') {
        snap.forEach((d) => {
          const item = { id: d.id, ...(d.data() || {}) };
          items.push(item);
          seenEmails.add(normalizeEmail(item.email || d.id));
        });
      }

      const adminDisplayName = fb.auth.currentUser?.displayName || DEFAULT_ADMIN_DISPLAY_NAME;
      for (const rawAdminEmail of ADMIN_EMAILS) {
        const cleanAdminEmail = normalizeEmail(rawAdminEmail);
        if (!cleanAdminEmail) continue;
        if (seenEmails.has(cleanAdminEmail)) {
          const existing = items.find(
            (entry) => normalizeEmail(entry.email || entry.id) === cleanAdminEmail
          );
          if (existing) {
            existing.isAdminAccount = true;
            existing.active = true;
            existing.status = 'APPROVED';
            if (!existing.displayName || existing.displayName === 'מנהל מערכת') {
              existing.displayName = adminDisplayName;
            }
          }
          continue;
        }
        items.push({
          id: cleanAdminEmail,
          email: cleanAdminEmail,
          displayName: adminDisplayName,
          active: true,
          status: 'APPROVED',
          note: 'מנהל מערכת (Admin קבוע)',
          isAdminAccount: true,
          addedAt: '',
          updatedAt: '',
        });
        seenEmails.add(cleanAdminEmail);
      }

      return items;
    } catch (err) {
      console.error('Failed to fetch allowed users:', err);
      if (throwOnError) {
        throw err;
      }
      return [];
    }
  }

  /**
   * Approves (or creates & approves) a user email in `/allowed_users/{email}`.
   */
  async function approveUser({
    email,
    note = '',
    displayName = '',
    uid = '',
    existingAddedAt = '',
  } = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      return { ok: false, message: 'פעולה מורשית למנהל מערכת בלבד.' };
    }
    const cleanEmail = normalizeEmail(email);
    if (!isValidEmailAddress(cleanEmail)) {
      return { ok: false, message: 'אנא הזן כתובת אימייל תקינה.' };
    }

    try {
      const docRef = fb.sdk.doc(fb.db, ALLOWED_USERS_COLLECTION, cleanEmail);
      let addedAt = existingAddedAt;
      let resolvedNote = note;
      let resolvedName = displayName;
      let resolvedUid = uid;

      if (!addedAt && typeof fb.sdk.getDoc === 'function') {
        try {
          const existingSnap = await fb.sdk.getDoc(docRef);
          if (existingSnap?.exists?.()) {
            const prev = existingSnap.data() || {};
            addedAt = prev.addedAt || '';
            if (!resolvedNote && prev.note) resolvedNote = prev.note;
            if (!resolvedName && prev.displayName) resolvedName = prev.displayName;
            if (!resolvedUid && prev.uid) resolvedUid = prev.uid;
          }
        } catch {
          // Proceed with fresh timestamp
        }
      }

      const payload = buildAllowedUserPayload({
        email: cleanEmail,
        active: true,
        status: 'APPROVED',
        note: resolvedNote,
        displayName: resolvedName,
        uid: resolvedUid,
        addedBy: fb.auth.currentUser.email || '',
        existingAddedAt: addedAt,
      });

      await withTimeout(fb.sdk.setDoc(docRef, payload), requestTimeoutMs);
      return { ok: true, userDoc: { id: cleanEmail, ...payload } };
    } catch (err) {
      console.error('Failed to approve user:', err);
      return { ok: false, message: 'אישור המשתמש נכשל.' };
    }
  }

  /**
   * Suspends (`active: false, status: 'REVOKED'`) an existing user without deleting history.
   */
  async function revokeUser({ email, existingDoc = null } = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      return { ok: false, message: 'פעולה מורשית למנהל מערכת בלבד.' };
    }
    const cleanEmail = normalizeEmail(email || existingDoc?.email);
    if (!isValidEmailAddress(cleanEmail)) {
      return { ok: false, message: 'כתובת אימייל אינה תקינה.' };
    }

    try {
      const payload = buildAllowedUserPayload({
        email: cleanEmail,
        active: false,
        status: 'REVOKED',
        note: existingDoc?.note || '',
        displayName: existingDoc?.displayName || '',
        uid: existingDoc?.uid || '',
        addedBy: fb.auth.currentUser.email || '',
        existingAddedAt: existingDoc?.addedAt || '',
      });
      const docRef = fb.sdk.doc(fb.db, ALLOWED_USERS_COLLECTION, cleanEmail);
      await withTimeout(fb.sdk.setDoc(docRef, payload), requestTimeoutMs);
      return { ok: true, userDoc: { id: cleanEmail, ...payload } };
    } catch (err) {
      console.error('Failed to revoke user:', err);
      return { ok: false, message: 'השהיית הגישה נכשלה.' };
    }
  }

  /**
   * Deletes an `/allowed_users/{email}` record permanently (Admin only).
   */
  async function deleteAllowedUser(email) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      return { ok: false, message: 'פעולה מורשית למנהל מערכת בלבד.' };
    }
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || typeof fb.sdk.deleteDoc !== 'function') {
      return { ok: false, message: 'מחיקה אינה נתמכת.' };
    }

    try {
      const docRef = fb.sdk.doc(fb.db, ALLOWED_USERS_COLLECTION, cleanEmail);
      await withTimeout(fb.sdk.deleteDoc(docRef), requestTimeoutMs);
      return { ok: true };
    } catch (err) {
      console.error('Failed to delete allowed user:', err);
      return { ok: false, message: 'מחיקת המשתמש נכשלה.' };
    }
  }

  /**
   * Reads Admin cloud settings (`/app_config/catalog_key` presence + `/app_config/contact`).
   */
  async function fetchAdminConfigStatus() {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      return {
        hasCatalogKey: false,
        telegramUrl: normalizeTelegramChatUrl(DEFAULT_TELEGRAM_ADMIN_URL),
      };
    }

    let hasCatalogKey;
    try {
      const keyRef = fb.sdk.doc(fb.db, APP_CONFIG_COLLECTION, CATALOG_KEY_DOC_ID);
      const keySnap = await withTimeout(fb.sdk.getDoc(keyRef), requestTimeoutMs);
      hasCatalogKey = Boolean(keySnap?.exists?.() && keySnap.data()?.keyBase64);
    } catch {
      hasCatalogKey = false;
    }

    const contactInfo = await fetchContactConfigInternal(fb);
    return {
      hasCatalogKey,
      telegramUrl: contactInfo.telegramUrl,
    };
  }

  /**
   * Saves the AES-256-GCM Base64 decryption key into Firestore `/app_config/catalog_key`.
   */
  async function saveCatalogKey(keyBase64) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      return { ok: false, message: 'פעולה מורשית למנהל מערכת בלבד.' };
    }
    const cleanKey = typeof keyBase64 === 'string' ? keyBase64.trim() : '';
    if (cleanKey.length < 32 || cleanKey.length > 128) {
      return { ok: false, message: 'מפתח הפענוח חייב להכיל מחרוזת Base64 תקינה (256-bit).' };
    }

    try {
      const keyRef = fb.sdk.doc(fb.db, APP_CONFIG_COLLECTION, CATALOG_KEY_DOC_ID);
      await withTimeout(
        fb.sdk.setDoc(keyRef, {
          schemaVersion: SCHEMA_VERSION,
          keyBase64: cleanKey,
          updatedBy: normalizeEmail(fb.auth.currentUser.email || ''),
          updatedAt: new Date().toISOString(),
        }),
        requestTimeoutMs
      );
      return { ok: true };
    } catch (err) {
      console.error('Failed to save catalog key:', err);
      return { ok: false, message: 'שמירת המפתח בענן נכשלה.' };
    }
  }

  /**
   * Saves the Admin's Telegram chat link (`https://t.me/...`) to Firestore `/app_config/contact`.
   */
  async function saveContactConfig({ telegramUrl } = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb.ready || !isAdminUser(fb.auth.currentUser)) {
      return { ok: false, message: 'פעולה מורשית למנהל מערכת בלבד.' };
    }
    const normalizedUrl = normalizeTelegramChatUrl(telegramUrl);
    if (telegramUrl && String(telegramUrl).trim() && !normalizedUrl) {
      return { ok: false, message: 'אנא הזן קישור Telegram תקין (לדוגמה https://t.me/username).' };
    }

    try {
      const contactRef = fb.sdk.doc(fb.db, APP_CONFIG_COLLECTION, CONTACT_CONFIG_DOC_ID);
      await withTimeout(
        fb.sdk.setDoc(contactRef, {
          schemaVersion: SCHEMA_VERSION,
          telegramUrl: normalizedUrl,
          updatedBy: normalizeEmail(fb.auth.currentUser.email || ''),
          updatedAt: new Date().toISOString(),
        }),
        requestTimeoutMs
      );
      return { ok: true, telegramUrl: normalizedUrl };
    } catch (err) {
      console.error('Failed to save contact config:', err);
      return { ok: false, message: 'שמירת קישור ה-Telegram נכשלה.' };
    }
  }

  /**
   * Listens in real time for PENDING user requests so Admin badge updates automatically.
   */
  async function subscribePendingRequestsCount(onCountChange) {
    unsubscribePendingRequests();
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
      const colRef = fb.sdk.collection(fb.db, ALLOWED_USERS_COLLECTION);
      const qRef = fb.sdk.query(colRef, fb.sdk.where('status', '==', 'PENDING'));
      unsubscribePendingListener = fb.sdk.onSnapshot(
        qRef,
        (snapshot) => {
          const count =
            typeof snapshot?.size === 'number'
              ? snapshot.size
              : Array.isArray(snapshot?.docs)
                ? snapshot.docs.length
                : 0;
          if (typeof onCountChange === 'function') onCountChange(count);
        },
        (err) => {
          console.warn('Pending requests listener warning:', err);
        }
      );
      return unsubscribePendingRequests;
    } catch (err) {
      console.warn('Could not attach pending requests listener:', err);
      return () => {};
    }
  }

  function unsubscribePendingRequests() {
    if (typeof unsubscribePendingListener === 'function') {
      unsubscribePendingListener();
      unsubscribePendingListener = null;
    }
  }

  function unsubscribeUserAccess() {
    if (typeof unsubscribeUserAccessListener === 'function') {
      unsubscribeUserAccessListener();
      unsubscribeUserAccessListener = null;
    }
  }

  /**
   * Listens in real time to `/allowed_users/{email}` for the signed-in non-admin user
   * so Admin approval or revocation unlocks/locks the app automatically without manual recheck.
   */
  async function subscribeUserAccess(user, onAccessDocChanged, initialState = {}) {
    unsubscribeUserAccess();
    const cleanEmail = normalizeEmail(user?.email);
    if (!cleanEmail || isAdminUser(user)) {
      return () => {};
    }

    const fb = await ensureFirebaseReady();
    if (
      !fb.ready ||
      !fb.auth?.currentUser ||
      normalizeEmail(fb.auth.currentUser.email) !== cleanEmail ||
      typeof fb.sdk.doc !== 'function' ||
      typeof fb.sdk.onSnapshot !== 'function'
    ) {
      return () => {};
    }

    const trackedState = {
      key: `${initialState.status || ''}:${Boolean(initialState.approved)}`,
    };

    try {
      const userAccessRef = fb.sdk.doc(fb.db, ALLOWED_USERS_COLLECTION, cleanEmail);
      unsubscribeUserAccessListener = fb.sdk.onSnapshot(
        userAccessRef,
        (docSnap) => {
          if (docSnap?.metadata?.fromCache && isBrowserOffline()) {
            return;
          }
          const exists = Boolean(
            docSnap && typeof docSnap.exists === 'function' && docSnap.exists()
          );
          const data = exists ? docSnap.data() || {} : null;
          const evaluated = evaluateUserAccessState({
            user: fb.auth?.currentUser || user,
            allowedDoc: data,
            isOnline: true,
          });
          const nextKey = `${evaluated.status}:${Boolean(evaluated.approved)}`;
          if (nextKey !== trackedState.key) {
            trackedState.key = nextKey;
            if (typeof onAccessDocChanged === 'function') {
              onAccessDocChanged(evaluated);
            }
          }
        },
        (err) => {
          console.warn('User access snapshot listener warning:', err);
        }
      );
      return unsubscribeUserAccess;
    } catch (err) {
      console.warn('Could not attach user access listener:', err);
      return () => {};
    }
  }

  return {
    checkUserAccess,
    submitAccessRequest,
    fetchAllowedUsers,
    approveUser,
    revokeUser,
    deleteAllowedUser,
    fetchAdminConfigStatus,
    saveCatalogKey,
    saveContactConfig,
    subscribePendingRequestsCount,
    unsubscribePendingRequests,
    subscribeUserAccess,
    unsubscribeUserAccess,
    clearCachedApproval,
    loadCachedApproval,
  };
}
