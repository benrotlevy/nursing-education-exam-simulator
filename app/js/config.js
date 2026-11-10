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
});

export const LIMITS = Object.freeze({
  MAX_SAVED_EXAMS: 3,
  MIN_FULL_EXAM_QUESTIONS: 20,
  DEFAULT_EXAM_COUNTS: Object.freeze([10, 25, 50, 100]),
  PASSING_SCORE_PERCENT: 60,
});

export const OPTION_LETTERS = Object.freeze(['א', 'ב', 'ג', 'ד']);
