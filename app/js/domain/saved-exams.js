/**
 * Saved Exams & Quarantine Zone Domain (`app/js/domain/saved-exams.js`)
 * Pure operations for reserving up to 3 complete exam reconstructions, launching a
 * saved exam run, and releasing quarantined questions back to the active pool (SAVED-01..SAVED-05).
 */

import { LIMITS } from '../config.js';
import { shuffleArray } from './shuffle.js';

/**
 * Reserves a full exam by `sourceName` into `savedExams` (up to `MAX_SAVED_EXAMS = 3`).
 */
export function reserveExamSlot({
  allQuestions = [],
  savedExams = [],
  sourceName,
  now = Date.now(),
  idGenerator = () => `saved_${now}`,
} = {}) {
  const currentList = Array.isArray(savedExams) ? savedExams : [];
  if (currentList.length >= LIMITS.MAX_SAVED_EXAMS) {
    return {
      ok: false,
      reason: 'LIMIT_REACHED',
      message: 'הגעת למכסה המרבית של 3 מבחנים שמורים. שחרר תחילה מבחן קיים כדי לשמור מבחן חדש.',
    };
  }

  if (!sourceName || typeof sourceName !== 'string') {
    return {
      ok: false,
      reason: 'MISSING_SOURCE',
      message: 'אנא בחר מבחן לשמירה.',
    };
  }

  if (currentList.some((s) => s.sourceName === sourceName)) {
    return {
      ok: false,
      reason: 'DUPLICATE_SOURCE',
      message: 'מבחן זה כבר שמור ברשימת המבחנים השמורים.',
    };
  }

  const sourceQuestions = allQuestions.filter((q) => q.source === sourceName);
  if (sourceQuestions.length === 0) {
    return {
      ok: false,
      reason: 'EMPTY_SOURCE',
      message: 'לא נמצאו שאלות עבור מבחן זה.',
    };
  }

  const newSlot = {
    id: idGenerator(),
    sourceName,
    title: sourceName,
    questionCount: sourceQuestions.length,
    questionIds: sourceQuestions.map((q) => q.id),
    savedAt: new Date(now).toISOString(),
    status: 'READY',
    score: null,
    completedAt: null,
  };

  return {
    ok: true,
    slot: newSlot,
    savedExams: [...currentList, newSlot],
  };
}

/**
 * Creates an active exam session from a saved exam slot (`SAVED-03`).
 */
export function createSavedExamRun({
  allQuestions = [],
  savedExams = [],
  savedExamId,
  rng = Math.random,
} = {}) {
  const savedItem = (savedExams || []).find((s) => s.id === savedExamId);
  if (!savedItem) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      message: 'מבחן שמור לא נמצא.',
    };
  }

  const qMap = new Map(allQuestions.map((q) => [q.id, q]));
  const examQuestions = (savedItem.questionIds || []).map((id) => qMap.get(id)).filter(Boolean);

  if (examQuestions.length === 0) {
    return {
      ok: false,
      reason: 'EMPTY_QUESTIONS',
      message: 'שגיאה בטעינת שאלות המבחן השמור.',
    };
  }

  return {
    ok: true,
    exam: {
      isSavedExam: true,
      savedExamId: savedItem.id,
      savedExamTitle: savedItem.title,
      questions: shuffleArray(examQuestions, rng),
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      eliminated: {},
      shuffledOptionsCache: {},
    },
  };
}

/**
 * Releases a saved exam slot by ID and restores its questions to the active pool (`SAVED-05`).
 */
export function releaseSavedExamSlot(savedExams = [], savedExamId) {
  const currentList = Array.isArray(savedExams) ? savedExams : [];
  const removedSlot = currentList.find((s) => s.id === savedExamId) || null;
  const nextSavedExams = currentList.filter((s) => s.id !== savedExamId);
  return {
    removedSlot,
    savedExams: nextSavedExams,
  };
}
