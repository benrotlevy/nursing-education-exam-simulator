/**
 * Persistence Adapter (`app/js/core/storage.js`)
 * Wraps `localStorage` and `sessionStorage` with schema-versioned (`v2`) serialization,
 * `Set` conversion, and graceful recovery from corrupt JSON or storage quota errors.
 */

import { SCHEMA_VERSION, STORAGE_KEYS, TABS } from '../config.js';
import { createInitialState } from './store.js';

function safeParseJSON(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function createStorageAdapter({
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
} = {}) {
  function loadProgress() {
    const defaults = createInitialState();
    try {
      const raw = localStorage?.getItem(STORAGE_KEYS.PROGRESS);
      const data = safeParseJSON(raw, null);
      if (!data || data.schemaVersion !== SCHEMA_VERSION) {
        return {
          schemaVersion: SCHEMA_VERSION,
          mistakes: new Set(),
          mistakeTimestamps: {},
          savedExams: [],
          userStats: defaults.userStats,
        };
      }

      const mistakeIds = Array.isArray(data.mistakes) ? data.mistakes : [];
      const mistakeTimestamps =
        data.mistakeTimestamps && typeof data.mistakeTimestamps === 'object'
          ? { ...data.mistakeTimestamps }
          : {};
      const savedExams = Array.isArray(data.savedExams) ? data.savedExams.slice(0, 3) : [];
      const rawStats = data.userStats && typeof data.userStats === 'object' ? data.userStats : {};

      return {
        schemaVersion: SCHEMA_VERSION,
        mistakes: new Set(mistakeIds),
        mistakeTimestamps,
        savedExams,
        userStats: {
          totalAnswered: Number(rawStats.totalAnswered) || 0,
          totalCorrect: Number(rawStats.totalCorrect) || 0,
          examsCompleted: Number(rawStats.examsCompleted) || 0,
          lastResetAt: Number(rawStats.lastResetAt) || 0,
          categoryStats:
            rawStats.categoryStats && typeof rawStats.categoryStats === 'object'
              ? { ...rawStats.categoryStats }
              : {},
        },
      };
    } catch {
      return {
        schemaVersion: SCHEMA_VERSION,
        mistakes: new Set(),
        mistakeTimestamps: {},
        savedExams: [],
        userStats: defaults.userStats,
      };
    }
  }

  function saveProgress({ mistakes, mistakeTimestamps = {}, savedExams = [], userStats }) {
    try {
      const payload = {
        schemaVersion: SCHEMA_VERSION,
        mistakes: Array.from(mistakes instanceof Set ? mistakes : []),
        mistakeTimestamps,
        savedExams,
        userStats,
      };
      localStorage?.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function saveExamSession(activeExamScreen, currentExam) {
    try {
      if (
        !currentExam ||
        !Array.isArray(currentExam.questions) ||
        currentExam.questions.length === 0 ||
        activeExamScreen === 'SETUP'
      ) {
        sessionStorage?.removeItem(STORAGE_KEYS.EXAM_SESSION);
        return true;
      }

      const serializedEliminated = {};
      if (currentExam.eliminated && typeof currentExam.eliminated === 'object') {
        for (const [qIdx, setObj] of Object.entries(currentExam.eliminated)) {
          if (setObj instanceof Set && setObj.size > 0) {
            serializedEliminated[qIdx] = Array.from(setObj);
          } else if (Array.isArray(setObj) && setObj.length > 0) {
            serializedEliminated[qIdx] = [...setObj];
          }
        }
      }

      const payload = {
        schemaVersion: SCHEMA_VERSION,
        activeExamScreen,
        isSavedExam: Boolean(currentExam.isSavedExam),
        savedExamId: currentExam.savedExamId || null,
        savedExamTitle: currentExam.savedExamTitle || null,
        currentIndex: Number(currentExam.currentIndex) || 0,
        userAnswers: currentExam.userAnswers || {},
        flagged: Array.from(
          currentExam.flagged instanceof Set ? currentExam.flagged : currentExam.flagged || []
        ),
        eliminated: serializedEliminated,
        questionIds: currentExam.questions.map((q) => q.id),
        shuffledOptionsCache: currentExam.shuffledOptionsCache || {},
      };

      sessionStorage?.setItem(STORAGE_KEYS.EXAM_SESSION, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function loadExamSession(allQuestions = []) {
    try {
      const raw = sessionStorage?.getItem(STORAGE_KEYS.EXAM_SESSION);
      const data = safeParseJSON(raw, null);
      if (
        !data ||
        !Array.isArray(data.questionIds) ||
        data.questionIds.length === 0 ||
        (data.activeExamScreen !== 'ACTIVE' && data.activeExamScreen !== 'RESULTS')
      ) {
        return null;
      }

      const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
      const restoredQuestions = data.questionIds.map((id) => questionMap.get(id)).filter(Boolean);
      if (restoredQuestions.length === 0) {
        return null;
      }

      const restoredEliminated = {};
      if (data.eliminated && typeof data.eliminated === 'object') {
        for (const [qIdx, arr] of Object.entries(data.eliminated)) {
          if (Array.isArray(arr)) {
            restoredEliminated[qIdx] = new Set(arr);
          }
        }
      }

      return {
        activeExamScreen: data.activeExamScreen,
        currentExam: {
          isSavedExam: Boolean(data.isSavedExam),
          savedExamId: data.savedExamId || null,
          savedExamTitle: data.savedExamTitle || null,
          questions: restoredQuestions,
          currentIndex: Math.min(Number(data.currentIndex) || 0, restoredQuestions.length - 1),
          userAnswers: data.userAnswers || {},
          flagged: new Set(Array.isArray(data.flagged) ? data.flagged : []),
          eliminated: restoredEliminated,
          shuffledOptionsCache: data.shuffledOptionsCache || {},
        },
      };
    } catch {
      return null;
    }
  }

  function clearExamSession() {
    try {
      sessionStorage?.removeItem(STORAGE_KEYS.EXAM_SESSION);
    } catch {
      // Ignore storage errors
    }
  }

  function saveStudySession(currentStudy) {
    try {
      if (!currentStudy || !Array.isArray(currentStudy.questions)) {
        return false;
      }
      const payload = {
        schemaVersion: SCHEMA_VERSION,
        currentIndex: Number(currentStudy.currentIndex) || 0,
        mistakesOnly: Boolean(currentStudy.mistakesOnly),
        selectedCategory: currentStudy.selectedCategory || 'ALL',
        userAnswers: currentStudy.userAnswers || {},
        questionIds: currentStudy.questions.map((q) => q.id),
        shuffledOptionsCache: currentStudy.shuffledOptionsCache || {},
      };
      sessionStorage?.setItem(STORAGE_KEYS.STUDY_SESSION, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function loadStudySession(allQuestions = []) {
    try {
      const raw = sessionStorage?.getItem(STORAGE_KEYS.STUDY_SESSION);
      const data = safeParseJSON(raw, null);
      if (!data || !Array.isArray(data.questionIds) || data.questionIds.length === 0) {
        return null;
      }

      const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
      const restoredQuestions = data.questionIds.map((id) => questionMap.get(id)).filter(Boolean);
      if (restoredQuestions.length === 0) {
        return null;
      }

      return {
        questions: restoredQuestions,
        currentIndex: Math.min(Number(data.currentIndex) || 0, restoredQuestions.length - 1),
        mistakesOnly: Boolean(data.mistakesOnly),
        selectedCategory: data.selectedCategory || 'ALL',
        shuffledOptionsCache: data.shuffledOptionsCache || {},
        userAnswers: data.userAnswers || {},
      };
    } catch {
      return null;
    }
  }

  function saveActiveTab(tabId) {
    try {
      if (TABS.includes(tabId)) {
        sessionStorage?.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId);
      }
    } catch {
      // Ignore storage errors
    }
  }

  function loadActiveTab(fallback = 'exam') {
    try {
      const saved = sessionStorage?.getItem(STORAGE_KEYS.ACTIVE_TAB);
      return TABS.includes(saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  }

  return {
    loadProgress,
    saveProgress,
    saveExamSession,
    loadExamSession,
    clearExamSession,
    saveStudySession,
    loadStudySession,
    saveActiveTab,
    loadActiveTab,
  };
}
