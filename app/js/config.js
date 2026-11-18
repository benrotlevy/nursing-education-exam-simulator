/**
 * Application Configuration & Constants (`app/js/config.js`)
 */

export const SCHEMA_VERSION = 2;

export const CATEGORIES = Object.freeze([
  'תיאוריות למידה ולמידת מבוגרים',
  'מיומנויות פסיכומוטוריות וסימולציה',
  'משוב, הערכה ורפלקציה',
  'תפקיד המדריך ויחסי מדריך-סטודנט',
  'הסטודנט המתקשה ותוכניות התערבות',
  'אתיקה, חוק ובטיחות המטופל',
]);

export const TABS = Object.freeze(['exam', 'study', 'saved-exams', 'stats']);

export const STORAGE_KEYS = Object.freeze({
  PROGRESS: 'nursing_progress_v2',
  EXAM_SESSION: 'nursing_exam_session_v2',
  STUDY_SESSION: 'nursing_study_session_v2',
  ACTIVE_TAB: 'nursing_active_tab_v2',
  ACCESS_APPROVAL: 'nursing_access_approval_v1',
  SIGNIN_NOTIFIED: 'nursing_signin_notified_v1',
});

export const TOTAL_CATALOG_QUESTIONS = 1079;

export const ACCESS_STATUSES = Object.freeze({
  GUEST: 'GUEST',
  CHECKING: 'CHECKING',
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  REVOKED: 'REVOKED',
});

export const ACCESS_LIMITS = Object.freeze({
  MAX_NOTE_LENGTH: 300,
  MAX_EMAIL_LENGTH: 320,
  REQUEST_COOLDOWN_MS: 10 * 60 * 1000,
});

export const DEFAULT_TELEGRAM_ADMIN_URL = '';

export const LIMITS = Object.freeze({
  MAX_SAVED_EXAMS: 3,
  MIN_FULL_EXAM_QUESTIONS: 20,
  DEFAULT_EXAM_COUNTS: Object.freeze([10, 25, 50, 100]),
  PASSING_SCORE_PERCENT: 60,
});

export const OPTION_LETTERS = Object.freeze(['א', 'ב', 'ג', 'ד']);

export const DEFAULT_AVATAR_URL = 'https://www.gravatar.com/avatar/?d=mp';

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyAoy9RhCjtYn0xQ7tmmdqVdecsg8NWCtbM',
  authDomain: 'nursing-exam-simulator.firebaseapp.com',
  projectId: 'nursing-exam-simulator',
  storageBucket: 'nursing-exam-simulator.firebasestorage.app',
  messagingSenderId: '756220661476',
  appId: '1:756220661476:web:2598724629ebb0dbea26f1',
});

export const ADMIN_EMAILS = Object.freeze(['benjaminrotlevy@gmail.com', 'benjamin@rotlevy.com']);
export const DEFAULT_ADMIN_DISPLAY_NAME = 'Benjamin Rotlevy';

export const REPORT_ISSUE_TYPES = Object.freeze({
  KEY_ERROR: Object.freeze({
    id: 'KEY_ERROR',
    icon: '🎯',
    label: 'תשובה נכונה שגויה במפתח התשובות',
  }),
  EXPLANATION_ERROR: Object.freeze({
    id: 'EXPLANATION_ERROR',
    icon: '📖',
    label: 'טעות בהסבר הפדגוגי או בניתוח המסיחים',
  }),
  TYPO_TEXT: Object.freeze({
    id: 'TYPO_TEXT',
    icon: '✍️',
    label: 'שגיאת כתיב, ניסוח מקוטע או טקסט חסר',
  }),
  OUTDATED: Object.freeze({
    id: 'OUTDATED',
    icon: '❓',
    label: 'חומר / נוהל לא מעודכן',
  }),
  OTHER: Object.freeze({
    id: 'OTHER',
    icon: '💬',
    label: 'סיבה אחרת',
  }),
});

export const REPORT_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
});

export const REPORT_LIMITS = Object.freeze({
  MIN_COMMENT_LENGTH: 3,
  MAX_COMMENT_LENGTH: 1000,
  MAX_PREVIEW_LENGTH: 200,
  MAX_ADMIN_NOTE_LENGTH: 500,
});

export const TELEGRAM_WEBHOOK_URL =
  'https://nursing-exam-telegram-relay.benjaminrotlevy.workers.dev';
