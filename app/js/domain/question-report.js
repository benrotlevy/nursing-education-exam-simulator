/**
 * Question Issue Report Domain Logic (`app/js/domain/question-report.js`)
 * Pure validation, payload construction, admin authorization helpers, and report filtering.
 * Strictly zero DOM, storage, or network dependencies (`01-ARCHITECTURE.md`).
 */

import {
  ADMIN_EMAILS,
  OPTION_LETTERS,
  REPORT_ISSUE_TYPES,
  REPORT_LIMITS,
  REPORT_STATUSES,
  SCHEMA_VERSION,
} from '../config.js';

const VALID_ISSUE_TYPE_IDS = new Set(Object.keys(REPORT_ISSUE_TYPES));
const VALID_STATUS_VALUES = new Set(Object.values(REPORT_STATUSES));

/**
 * Checks whether a signed-in user belongs to the authorized administrator email list.
 * @param {Object | null | undefined} user
 * @param {readonly string[]} [adminEmails=ADMIN_EMAILS]
 * @returns {boolean}
 */
export function isAdminUser(user, adminEmails = ADMIN_EMAILS) {
  if (!user || typeof user.email !== 'string') return false;
  const normalizedEmail = user.email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  return adminEmails.some((allowed) => String(allowed).trim().toLowerCase() === normalizedEmail);
}

/**
 * Returns metadata `{ id, icon, label }` for an issue type key, falling back to `OTHER`.
 * @param {string} issueType
 */
export function getIssueTypeMeta(issueType) {
  return REPORT_ISSUE_TYPES[issueType] || REPORT_ISSUE_TYPES.OTHER;
}

/**
 * Validates a student's issue report draft before Firestore submission.
 * Users must be signed in (`uid` present) per repository security rules.
 * @param {Object} input
 * @returns {{ ok: true, normalized: Object } | { ok: false, field: string, message: string }}
 */
export function validateReportDraft({ questionId, issueType, comment, user } = {}) {
  if (!user || typeof user.uid !== 'string' || !user.uid.trim()) {
    return {
      ok: false,
      field: 'auth',
      message: 'יש להתחבר לחשבון Google כדי לשלוח דיווח על שאלה.',
    };
  }

  const cleanQuestionId = typeof questionId === 'string' ? questionId.trim() : '';
  if (!cleanQuestionId || cleanQuestionId.length > 64) {
    return {
      ok: false,
      field: 'questionId',
      message: 'לא ניתן לזהות את מזהה השאלה לדיווח.',
    };
  }

  if (typeof issueType !== 'string' || !VALID_ISSUE_TYPE_IDS.has(issueType)) {
    return {
      ok: false,
      field: 'issueType',
      message: 'יש לבחור את סוג השגיאה המדווחת.',
    };
  }

  const cleanComment = typeof comment === 'string' ? comment.trim() : '';
  if (cleanComment.length < REPORT_LIMITS.MIN_COMMENT_LENGTH) {
    return {
      ok: false,
      field: 'comment',
      message: `אנא פרט/י את השגיאה (לפחות ${REPORT_LIMITS.MIN_COMMENT_LENGTH} תווים).`,
    };
  }

  if (cleanComment.length > REPORT_LIMITS.MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      field: 'comment',
      message: `הפירוט ארוך מדי (עד ${REPORT_LIMITS.MAX_COMMENT_LENGTH} תווים).`,
    };
  }

  return {
    ok: true,
    normalized: {
      questionId: cleanQuestionId,
      issueType,
      comment: cleanComment,
    },
  };
}

/**
 * Builds a Firestore-compliant `/question_reports` document payload from validated input.
 * @param {Object} params
 * @returns {Object}
 */
export function buildQuestionReportPayload({
  question,
  issueType,
  comment,
  user,
  now = new Date(),
} = {}) {
  const validation = validateReportDraft({
    questionId: question?.id,
    issueType,
    comment,
    user,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const isoNow = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const rawQuestionText = typeof question?.question === 'string' ? question.question.trim() : '';
  const questionText = rawQuestionText.slice(0, REPORT_LIMITS.MAX_PREVIEW_LENGTH);

  return {
    schemaVersion: SCHEMA_VERSION,
    questionId: validation.normalized.questionId,
    questionText,
    source: String(question?.source || '')
      .trim()
      .slice(0, 200),
    category: String(question?.category || '')
      .trim()
      .slice(0, 200),
    correctIndex: Number.isInteger(question?.correctIndex) ? question.correctIndex : 0,
    issueType: validation.normalized.issueType,
    comment: validation.normalized.comment,
    reporterUid: user.uid.trim(),
    reporterEmail: String(user.email || '')
      .trim()
      .slice(0, 320),
    reporterName: String(user.displayName || '')
      .trim()
      .slice(0, 200),
    status: REPORT_STATUSES.OPEN,
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

/**
 * Formats a concise payload for the secret-safe Cloudflare Worker Telegram webhook.
 * @param {Object} report
 * @param {string} [reportId]
 * @returns {Object}
 */
export function formatTelegramAlertPayload(report, reportId = '') {
  const meta = getIssueTypeMeta(report?.issueType);
  const questionPreview = String(report?.questionText || '').slice(
    0,
    REPORT_LIMITS.MAX_PREVIEW_LENGTH
  );
  return {
    type: 'QUESTION_ISSUE_REPORT',
    reportId: String(reportId || '').slice(0, 100),
    questionId: String(report?.questionId || '').slice(0, 64),
    source: String(report?.source || '').slice(0, 200),
    category: String(report?.category || '').slice(0, 200),
    questionPreview,
    questionText: questionPreview,
    issueType: String(report?.issueType || 'OTHER'),
    issueLabel: `${meta.icon} ${meta.label}`,
    comment: String(report?.comment || '').slice(0, REPORT_LIMITS.MAX_COMMENT_LENGTH),
    reporterName: String(report?.reporterName || '').slice(0, 200),
    reporterEmail: String(report?.reporterEmail || '').slice(0, 320),
    createdAt: String(report?.createdAt || new Date().toISOString()),
  };
}

/**
 * Counts reports by status for admin filter badges.
 * @param {Array<Object>} reports
 * @returns {{ total: number, OPEN: number, RESOLVED: number, DISMISSED: number }}
 */
export function countReportsByStatus(reports = []) {
  const counts = {
    total: 0,
    OPEN: 0,
    RESOLVED: 0,
    DISMISSED: 0,
  };
  if (!Array.isArray(reports)) return counts;

  for (const r of reports) {
    if (!r || typeof r !== 'object') continue;
    counts.total += 1;
    const st = VALID_STATUS_VALUES.has(r.status) ? r.status : REPORT_STATUSES.OPEN;
    counts[st] += 1;
  }
  return counts;
}

/**
 * Filters and sorts reports (newest first by `createdAt`).
 * @param {Array<Object>} reports
 * @param {string} [statusFilter='ALL']
 * @returns {Array<Object>}
 */
export function filterReportsByStatus(reports = [], statusFilter = 'ALL') {
  if (!Array.isArray(reports)) return [];
  const filtered =
    statusFilter === 'ALL' || !VALID_STATUS_VALUES.has(statusFilter)
      ? [...reports]
      : reports.filter((r) => r && r.status === statusFilter);

  filtered.sort((a, b) => {
    const aTime = String(a?.createdAt || '');
    const bTime = String(b?.createdAt || '');
    return bTime.localeCompare(aTime);
  });
  return filtered;
}

/**
 * Formats a question report and optional full question bank entry into clipboard text for rapid editing.
 * @param {Object} report
 * @param {Object | null} [fullQuestion=null]
 * @returns {string}
 */
export function formatReportForAdminClipboard(report, fullQuestion = null) {
  const meta = getIssueTypeMeta(report?.issueType);
  const lines = [
    `=== דיווח על שאלה: ${report?.questionId || ''} ===`,
    `סוג שגיאה: ${meta.label}`,
    `מקור: ${report?.source || fullQuestion?.source || 'לא צוין'}`,
    `קטגוריה: ${report?.category || fullQuestion?.category || 'לא צוין'}`,
    `מדווח: ${report?.reporterName || 'לא צוין'} (${report?.reporterEmail || ''})`,
    `הערת הסטודנט: ${report?.comment || ''}`,
  ];

  if (fullQuestion) {
    lines.push('', `נוסח השאלה: ${fullQuestion.question}`);
    if (Array.isArray(fullQuestion.options)) {
      fullQuestion.options.forEach((opt, idx) => {
        const letter = OPTION_LETTERS[idx] || String(idx + 1);
        const marker = idx === fullQuestion.correctIndex ? ' [✓ נכונה נוכחית]' : '';
        lines.push(`${letter}. ${opt}${marker}`);
      });
    }
  } else if (report?.questionText) {
    lines.push('', `תצוגה מקדימה: ${report.questionText}`);
  }

  return lines.join('\n');
}
