/**
 * Access Control & User Approval Domain Logic (`app/js/domain/access-control.js`)
 * Pure normalization, validation, filtering, and payload helpers.
 * Strictly zero DOM, storage, or network dependencies (`01-ARCHITECTURE.md`).
 */

import {
  ACCESS_LIMITS,
  ACCESS_STATUSES,
  DEFAULT_TELEGRAM_ADMIN_URL,
  REPORT_LIMITS,
  SCHEMA_VERSION,
} from '../config.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_USER_STATUSES = new Set(['APPROVED', 'PENDING', 'REVOKED']);

/**
 * Normalizes an email address to lowercase and trimmed form.
 * @param {string | null | undefined} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Checks whether an email address is syntactically valid and within Firestore bounds.
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function isValidEmailAddress(email) {
  const normalized = normalizeEmail(email);
  if (normalized.length < 3 || normalized.length > ACCESS_LIMITS.MAX_EMAIL_LENGTH) {
    return false;
  }
  return EMAIL_REGEX.test(normalized);
}

/**
 * Normalizes a Telegram chat link or `@username` into a safe `https://t.me/<handle>` URL.
 * Returns `''` if empty or invalid (prevents `javascript:` or non-Telegram URLs).
 * @param {string | null | undefined} rawUrl
 * @returns {string}
 */
export function normalizeTelegramChatUrl(rawUrl) {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!trimmed) return '';

  if (trimmed.startsWith('@')) {
    const handle = trimmed.slice(1).trim();
    if (/^[A-Za-z0-9_]{3,64}$/.test(handle)) {
      return `https://t.me/${handle}`;
    }
    return '';
  }

  let candidate = trimmed;
  if (/^(t\.me|telegram\.me)\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 't.me' || parsed.hostname === 'telegram.me') &&
      parsed.pathname.length > 1
    ) {
      return parsed.href.slice(0, 300);
    }
  } catch {
    return '';
  }

  return '';
}

/**
 * Validates and builds an `/allowed_users/{email}` Firestore document payload for Admin writes.
 * @param {Object} params
 * @returns {Object}
 */
export function buildAllowedUserPayload({
  email,
  active = true,
  status = active ? 'APPROVED' : 'REVOKED',
  note = '',
  displayName = '',
  uid = '',
  addedBy = '',
  existingAddedAt = '',
  now = new Date(),
} = {}) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmailAddress(cleanEmail)) {
    throw new Error('כתובת האימייל אינה תקינה.');
  }

  const normalizedStatus = VALID_USER_STATUSES.has(status)
    ? status
    : active
      ? 'APPROVED'
      : 'REVOKED';
  const isoNow = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  return {
    schemaVersion: SCHEMA_VERSION,
    email: cleanEmail,
    active: Boolean(active && normalizedStatus === 'APPROVED'),
    status: normalizedStatus,
    note: String(note || '')
      .trim()
      .slice(0, ACCESS_LIMITS.MAX_NOTE_LENGTH),
    displayName: String(displayName || '')
      .trim()
      .slice(0, 200),
    uid: String(uid || '')
      .trim()
      .slice(0, 128),
    addedBy: normalizeEmail(addedBy).slice(0, ACCESS_LIMITS.MAX_EMAIL_LENGTH),
    addedAt: existingAddedAt ? String(existingAddedAt) : isoNow,
    updatedAt: isoNow,
  };
}

/**
 * Builds a strict self-service PENDING request payload (`active: false`, `status: 'PENDING'`)
 * allowed by Firestore rules for newly signed-in users awaiting approval.
 * @param {Object} params
 * @returns {Object}
 */
export function buildPendingAccessRequestPayload({
  user,
  note = '',
  existingAddedAt = '',
  now = new Date(),
} = {}) {
  const email = normalizeEmail(user?.email);
  if (!isValidEmailAddress(email)) {
    throw new Error('לא נמצאה כתובת אימייל תקינה בחשבון המשתמש.');
  }

  return buildAllowedUserPayload({
    email,
    active: false,
    status: 'PENDING',
    note,
    displayName: user?.displayName || '',
    uid: user?.uid || '',
    addedBy: email,
    existingAddedAt,
    now,
  });
}

/**
 * Evaluates a signed-in user's access status from admin list, Firestore doc, or offline cache.
 * @param {Object} params
 * @returns {{ status: string, approved: boolean, fromCache: boolean, keyBase64: string, telegramUrl: string }}
 */
export function evaluateUserAccessState({
  user,
  isAdmin = false,
  allowedDoc = null,
  keyBase64 = '',
  telegramUrl = DEFAULT_TELEGRAM_ADMIN_URL,
  cachedApproval = null,
  isOffline = false,
  lookupFailed = false,
} = {}) {
  const cleanEmail = normalizeEmail(user?.email);
  const safeTelegramUrl = normalizeTelegramChatUrl(telegramUrl);

  if (!user || !cleanEmail) {
    return {
      status: ACCESS_STATUSES.GUEST,
      approved: false,
      fromCache: false,
      keyBase64: '',
      telegramUrl: safeTelegramUrl,
    };
  }

  if (isAdmin) {
    const fallbackKey =
      keyBase64 ||
      (cachedApproval && normalizeEmail(cachedApproval.email) === cleanEmail
        ? cachedApproval.keyBase64 || ''
        : '');
    return {
      status: ACCESS_STATUSES.APPROVED,
      approved: true,
      fromCache: !keyBase64 && Boolean(fallbackKey),
      keyBase64: String(fallbackKey || ''),
      telegramUrl: safeTelegramUrl,
    };
  }

  if (allowedDoc && typeof allowedDoc === 'object') {
    if (allowedDoc.active === true) {
      const effectiveKey =
        keyBase64 ||
        (cachedApproval && normalizeEmail(cachedApproval.email) === cleanEmail
          ? cachedApproval.keyBase64 || ''
          : '');
      return {
        status: ACCESS_STATUSES.APPROVED,
        approved: true,
        fromCache: false,
        keyBase64: String(effectiveKey || ''),
        telegramUrl: safeTelegramUrl,
      };
    }

    return {
      status: allowedDoc.status === 'REVOKED' ? ACCESS_STATUSES.REVOKED : ACCESS_STATUSES.PENDING,
      approved: false,
      fromCache: false,
      keyBase64: '',
      telegramUrl: safeTelegramUrl,
    };
  }

  if ((isOffline || lookupFailed) && cachedApproval && typeof cachedApproval === 'object') {
    const matchesUser =
      normalizeEmail(cachedApproval.email) === cleanEmail &&
      (!cachedApproval.uid || !user.uid || cachedApproval.uid === user.uid);
    if (matchesUser && cachedApproval.approved === true && cachedApproval.keyBase64) {
      return {
        status: ACCESS_STATUSES.APPROVED,
        approved: true,
        fromCache: true,
        keyBase64: String(cachedApproval.keyBase64),
        telegramUrl: normalizeTelegramChatUrl(cachedApproval.telegramUrl || safeTelegramUrl),
      };
    }
  }

  return {
    status: ACCESS_STATUSES.PENDING,
    approved: false,
    fromCache: false,
    keyBase64: '',
    telegramUrl: safeTelegramUrl,
  };
}

/**
 * Formats a notification payload for the Cloudflare Telegram Worker.
 * Includes both the `NEW_USER_SIGN_IN` fields and compatible fallback fields for legacy Workers.
 * @param {Object} params
 * @returns {{ modernPayload: Object, compatiblePayload: Object }}
 */
export function buildNewUserTelegramPayloads({
  user,
  note = '',
  isExplicitRequest = false,
  status = 'PENDING',
  now = new Date(),
} = {}) {
  const email = normalizeEmail(user?.email);
  const displayName = String(user?.displayName || 'משתמש ללא שם')
    .trim()
    .slice(0, 200);
  const cleanNote = String(note || '')
    .trim()
    .slice(0, ACCESS_LIMITS.MAX_NOTE_LENGTH);
  const createdAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  const statusText =
    status === 'APPROVED'
      ? '✅ משתמש מאושר (התחברות ראשונה)'
      : isExplicitRequest
        ? '📩 בקשת אישור גישה חדשה'
        : '⏳ משתמש חדש ממתין לאישור';

  const modernPayload = {
    type: 'NEW_USER_SIGN_IN',
    email,
    displayName,
    uid: String(user?.uid || '').slice(0, 128),
    note: cleanNote,
    status,
    isExplicitRequest: Boolean(isExplicitRequest),
    createdAt,
  };

  const commentParts = [statusText, `שם: ${displayName}`, `אימייל: ${email}`];
  if (cleanNote) {
    commentParts.push(`הערה: ${cleanNote}`);
  }
  commentParts.push('לחיצה ארוכה/קצרה על האימייל בדפדפן הניהול תאפשר אישור בלחיצה אחת.');

  const compatiblePayload = {
    type: 'QUESTION_ISSUE_REPORT',
    reportId: '',
    questionId: isExplicitRequest ? 'ACCESS_REQUEST' : 'NEW_USER_SIGN_IN',
    source: 'מערכת בקרת גישה (Invite-Only)',
    category: status === 'APPROVED' ? 'משתמש מאושר' : 'ממתין לאישור מנהל',
    questionPreview: `${displayName} — ${email}`,
    questionText: `${displayName} — ${email}`,
    issueType: 'OTHER',
    issueLabel: isExplicitRequest ? '📩 בקשת אישור גישה למאגר' : '👤 התחברות משתמש חדש למערכת',
    comment: commentParts.join('\n').slice(0, REPORT_LIMITS.MAX_COMMENT_LENGTH),
    reporterName: displayName,
    reporterEmail: email,
    createdAt,
  };

  return { modernPayload, compatiblePayload };
}

/**
 * Counts allowed/pending/revoked user records for Admin Dashboard filter chips.
 * @param {Array<Object>} users
 * @returns {{ total: number, PENDING: number, APPROVED: number, REVOKED: number }}
 */
export function countAllowedUsersByStatus(users = []) {
  const counts = {
    total: 0,
    PENDING: 0,
    APPROVED: 0,
    REVOKED: 0,
  };
  if (!Array.isArray(users)) return counts;

  for (const item of users) {
    if (!item || typeof item !== 'object') continue;
    counts.total += 1;
    if (item.active === true || item.status === 'APPROVED') {
      counts.APPROVED += 1;
    } else if (item.status === 'REVOKED') {
      counts.REVOKED += 1;
    } else {
      counts.PENDING += 1;
    }
  }
  return counts;
}

/**
 * Filters and sorts `/allowed_users` records (`PENDING` first, then newest `updatedAt`).
 * @param {Array<Object>} users
 * @param {string} [statusFilter='ALL']
 * @param {string} [searchQuery='']
 * @returns {Array<Object>}
 */
export function filterAllowedUsers(users = [], statusFilter = 'ALL', searchQuery = '') {
  if (!Array.isArray(users)) return [];
  const normalizedQuery = typeof searchQuery === 'string' ? searchQuery.trim().toLowerCase() : '';

  const normalizedList = users
    .filter((u) => u && typeof u === 'object')
    .filter((u) => {
      const effectiveStatus =
        u.active === true || u.status === 'APPROVED'
          ? 'APPROVED'
          : u.status === 'REVOKED'
            ? 'REVOKED'
            : 'PENDING';
      if (statusFilter !== 'ALL' && VALID_USER_STATUSES.has(statusFilter)) {
        if (effectiveStatus !== statusFilter) return false;
      }
      if (!normalizedQuery) return true;
      const haystack = `${u.email || ''} ${u.displayName || ''} ${u.note || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

  const priority = { PENDING: 0, APPROVED: 1, REVOKED: 2 };
  normalizedList.sort((a, b) => {
    const aStatus =
      a.active === true || a.status === 'APPROVED'
        ? 'APPROVED'
        : a.status === 'REVOKED'
          ? 'REVOKED'
          : 'PENDING';
    const bStatus =
      b.active === true || b.status === 'APPROVED'
        ? 'APPROVED'
        : b.status === 'REVOKED'
          ? 'REVOKED'
          : 'PENDING';
    const pDiff = (priority[aStatus] ?? 9) - (priority[bStatus] ?? 9);
    if (pDiff !== 0) return pDiff;
    return String(b.updatedAt || b.addedAt || '').localeCompare(
      String(a.updatedAt || a.addedAt || '')
    );
  });

  return normalizedList;
}
