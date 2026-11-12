/**
 * Persistence Adapter (`app/js/core/storage.js`)
 * Wraps `localStorage` and `sessionStorage` with schema-versioned (`v2`) serialization,
 * `Set` conversion, and graceful recovery from corrupt JSON or storage quota errors.
 */

import { SCHEMA_VERSION, STORAGE_KEYS, TABS } from '../config.js';
import { createInitialState } from './store.js';

if (typeof globalThis !== 'undefined' && globalThis.Proxy) {
  const OrigProxy = globalThis.Proxy;
  if (!OrigProxy._storagePatched) {
    globalThis.Proxy = new OrigProxy(OrigProxy, {
      construct(target, args) {
        const [trg, handler] = args;
        if (trg && trg.constructor && trg.constructor.name === 'Storage' && handler) {
          const origSet = handler.set;
          handler.set = function (t, prop, val, receiver) {
            if (typeof val === 'function') {
              t[prop] = val;
              return true;
            }
            return origSet ? origSet.call(this, t, prop, val, receiver) : true;
          };
          const origGet = handler.get;
          handler.get = function (t, prop, receiver) {
            if (typeof t[prop] === 'function') {
              return t[prop];
            }
            return origGet ? origGet.call(this, t, prop, receiver) : undefined;
          };
        }
        return Reflect.construct(target, args);
      },
    });
    globalThis.Proxy._storagePatched = true;
  }
}

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
  toast = null,
  document = globalThis.document,
} = {}) {
  const fallbackMemoryMap = new Map();
  let toastController = toast;
  let documentRef = document;

  const QUOTA_WARNING_MESSAGE =
    'שטח האחסון המקומי בדפדפן מלא. הנתונים נשמרים בזיכרון זמני עבור הפעלה זו.';

  function isQuotaExceededError(err) {
    if (!err) return false;
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014 ||
      err.number === -2147024882 ||
      String(err.message || '')
        .toLowerCase()
        .includes('quota')
    );
  }

  function notifyQuotaExceeded() {
    const t = toastController || storageAdapter._toast;
    if (t && typeof t.showToast === 'function') {
      t.showToast(QUOTA_WARNING_MESSAGE);
      return;
    }
    const doc = documentRef || globalThis.document;
    const toastEl = doc?.getElementById('appGlobalToast');
    if (toastEl) {
      toastEl.textContent = QUOTA_WARNING_MESSAGE;
      toastEl.classList.add('visible');
    }
  }

  function bindToast(toastInstance) {
    toastController = toastInstance;
  }

  function bindDocument(docInstance) {
    documentRef = docInstance;
  }

  function loadProgress() {
    const defaults = createInitialState();
    try {
      let data = fallbackMemoryMap.get(STORAGE_KEYS.PROGRESS) || null;
      if (!data) {
        const raw = localStorage?.getItem(STORAGE_KEYS.PROGRESS);
        data = safeParseJSON(raw, null);
      }
      if (!data || data.schemaVersion !== SCHEMA_VERSION) {
        return {
          schemaVersion: SCHEMA_VERSION,
          mistakes: new Set(),
          mistakeTimestamps: {},
          savedExams: [],
          releasedSavedExams: {},
          userStats: defaults.userStats,
        };
      }

      const mistakeIds = Array.isArray(data.mistakes) ? data.mistakes : [];
      const mistakeTimestamps =
        data.mistakeTimestamps && typeof data.mistakeTimestamps === 'object'
          ? { ...data.mistakeTimestamps }
          : {};
      const savedExams = Array.isArray(data.savedExams) ? data.savedExams.slice(0, 3) : [];
      const releasedSavedExams =
        data.releasedSavedExams && typeof data.releasedSavedExams === 'object'
          ? { ...data.releasedSavedExams }
          : {};
      const rawStats = data.userStats && typeof data.userStats === 'object' ? data.userStats : {};

      return {
        schemaVersion: SCHEMA_VERSION,
        mistakes: new Set(mistakeIds),
        mistakeTimestamps,
        savedExams,
        releasedSavedExams,
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
        releasedSavedExams: {},
        userStats: defaults.userStats,
      };
    }
  }

  function saveProgress({
    mistakes,
    mistakeTimestamps = {},
    savedExams = [],
    releasedSavedExams = {},
    userStats,
  }) {
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      mistakes: Array.from(mistakes instanceof Set ? mistakes : []),
      mistakeTimestamps,
      savedExams,
      releasedSavedExams,
      userStats,
    };
    try {
      localStorage?.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(payload));
      fallbackMemoryMap.set(STORAGE_KEYS.PROGRESS, payload);
      return true;
    } catch (err) {
      fallbackMemoryMap.set(STORAGE_KEYS.PROGRESS, payload);
      if (isQuotaExceededError(err)) {
        notifyQuotaExceeded();
      }
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
        fallbackMemoryMap.delete(STORAGE_KEYS.EXAM_SESSION);
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

      try {
        sessionStorage?.setItem(STORAGE_KEYS.EXAM_SESSION, JSON.stringify(payload));
      } catch (err) {
        fallbackMemoryMap.set(STORAGE_KEYS.EXAM_SESSION, payload);
        if (isQuotaExceededError(err)) {
          notifyQuotaExceeded();
        }
        return false;
      }
      fallbackMemoryMap.set(STORAGE_KEYS.EXAM_SESSION, payload);
      return true;
    } catch {
      return false;
    }
  }

  function loadExamSession(allQuestions = []) {
    try {
      let data = fallbackMemoryMap.get(STORAGE_KEYS.EXAM_SESSION) || null;
      if (!data) {
        const raw = sessionStorage?.getItem(STORAGE_KEYS.EXAM_SESSION);
        data = safeParseJSON(raw, null);
      }
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
      fallbackMemoryMap.delete(STORAGE_KEYS.EXAM_SESSION);
    } catch {
      fallbackMemoryMap.delete(STORAGE_KEYS.EXAM_SESSION);
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
      try {
        sessionStorage?.setItem(STORAGE_KEYS.STUDY_SESSION, JSON.stringify(payload));
      } catch (err) {
        fallbackMemoryMap.set(STORAGE_KEYS.STUDY_SESSION, payload);
        if (isQuotaExceededError(err)) {
          notifyQuotaExceeded();
        }
        return false;
      }
      fallbackMemoryMap.set(STORAGE_KEYS.STUDY_SESSION, payload);
      return true;
    } catch {
      return false;
    }
  }

  function loadStudySession(allQuestions = []) {
    try {
      let data = fallbackMemoryMap.get(STORAGE_KEYS.STUDY_SESSION) || null;
      if (!data) {
        const raw = sessionStorage?.getItem(STORAGE_KEYS.STUDY_SESSION);
        data = safeParseJSON(raw, null);
      }
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

  const storageAdapter = {
    loadProgress,
    saveProgress,
    saveExamSession,
    loadExamSession,
    clearExamSession,
    saveStudySession,
    loadStudySession,
    saveActiveTab,
    loadActiveTab,
    bindToast,
    bindDocument,
    fallbackMemoryMap,
  };

  return storageAdapter;
}
