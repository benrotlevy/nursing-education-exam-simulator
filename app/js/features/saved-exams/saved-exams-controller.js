/**
 * Saved Exams & Quarantine Zone Controller (`app/js/features/saved-exams/saved-exams-controller.js`)
 * Orchestrates reserving up to 3 full exam reconstructions, launching saved exam runs, and releasing slots.
 */

import {
  reserveExamSlot,
  createSavedExamRun,
  releaseSavedExamSlot,
} from '../../domain/saved-exams.js';
import { ensureExamQuestionShuffle } from '../../domain/exam-session.js';
import { renderSavedExamsView } from './saved-exams-view.js';

export function createSavedExamsController({
  document = globalThis.document,
  store,
  storage,
  router,
  toast,
  confirmAction,
  onPoolChanged,
  onExamStarted,
} = {}) {
  function renderSavedExamsUI() {
    const state = store.getState();
    renderSavedExamsView({
      document,
      allQuestions: state.allQuestions,
      savedExams: state.savedExams,
    });
  }

  function addSelectedExamToSavedZone() {
    const state = store.getState();
    const select = document?.getElementById('savedExamSourceSelect');
    const selectedSource = select ? select.value : '';

    const result = reserveExamSlot({
      allQuestions: state.allQuestions,
      savedExams: state.savedExams,
      sourceName: selectedSource,
    });

    if (!result.ok) {
      toast.showToast(result.message);
      return false;
    }

    const nextReleased = { ...(state.releasedSavedExams || {}) };
    if (selectedSource) {
      delete nextReleased[selectedSource];
    }
    if (result.slot?.id) {
      delete nextReleased[result.slot.id];
    }

    store.setState(
      { savedExams: result.savedExams, releasedSavedExams: nextReleased },
      'saved-exams/reserve'
    );
    storage.saveProgress({
      mistakes: state.mistakes,
      mistakeTimestamps: state.mistakeTimestamps,
      savedExams: result.savedExams,
      releasedSavedExams: nextReleased,
      userStats: state.userStats,
    });

    renderSavedExamsUI();
    if (typeof onPoolChanged === 'function') {
      onPoolChanged();
    }

    toast.showToast(
      `המבחן '${result.slot.sourceName}' נשמר בהצלחה! ${result.slot.questionCount} שאלות בודדו מחוץ למאגר.`
    );
    return true;
  }

  function executeReleaseSavedExam(savedId, item) {
    const state = store.getState();
    const rel = releaseSavedExamSlot(state.savedExams, savedId);
    const now = Date.now();
    const nextReleased = {
      ...(state.releasedSavedExams || {}),
      [savedId]: now,
      ...(item?.sourceName ? { [item.sourceName]: now } : {}),
    };

    store.setState(
      { savedExams: rel.savedExams, releasedSavedExams: nextReleased },
      'saved-exams/release'
    );
    storage.saveProgress({
      mistakes: state.mistakes,
      mistakeTimestamps: state.mistakeTimestamps,
      savedExams: rel.savedExams,
      releasedSavedExams: nextReleased,
      userStats: state.userStats,
    });

    renderSavedExamsUI();
    if (typeof onPoolChanged === 'function') {
      onPoolChanged();
    }

    toast.showToast(`המבחן שוחרר! ${item.questionCount} שאלות הוחזרו בהצלחה למאגר התרגול והלמידה.`);
    return true;
  }

  function releaseSavedExam(savedId) {
    const state = store.getState();
    const item = state.savedExams.find((s) => s.id === savedId);
    if (!item) return false;

    if (typeof confirmAction === 'function') {
      const proceed = confirmAction({
        title: 'שחרור מבחן שמור למאגר',
        message: `האם ברצונך לשחרר את שאלות המבחן '${item.title}' (${item.questionCount} שאלות) חזרה למאגר הכללי?\nהשאלות יחזרו מיד להופיע בערבוב של מבחני התרגול ובמצב למידה.`,
        confirmText: 'שחרר למאגר',
        cancelText: 'ביטול',
        danger: true,
      });
      if (proceed && typeof proceed.then === 'function') {
        return proceed.then((confirmed) => {
          if (!confirmed) return false;
          return executeReleaseSavedExam(savedId, item);
        });
      }
      if (!proceed) return false;
    }

    return executeReleaseSavedExam(savedId, item);
  }

  function startSavedExam(savedId) {
    const state = store.getState();
    const result = createSavedExamRun({
      allQuestions: state.allQuestions,
      savedExams: state.savedExams,
      savedExamId: savedId,
    });

    if (!result.ok) {
      toast.showToast(result.message);
      return false;
    }

    const cachedExam = ensureExamQuestionShuffle(result.exam, 0);
    store.setState(
      {
        activeExamScreen: 'ACTIVE',
        currentExam: cachedExam,
      },
      'saved-exams/start-run'
    );
    storage.saveExamSession('ACTIVE', cachedExam);
    router.switchTab('exam');

    if (typeof onExamStarted === 'function') {
      onExamStarted();
    }
    return true;
  }

  function releaseSavedExamFromResults() {
    const state = store.getState();
    if (!state.currentExam || !state.currentExam.savedExamId) return false;
    const savedId = state.currentExam.savedExamId;
    const item = state.savedExams.find((s) => s.id === savedId);
    const rel = releaseSavedExamSlot(state.savedExams, savedId);
    const qCount = rel.removedSlot ? rel.removedSlot.questionCount : 0;
    const now = Date.now();
    const nextReleased = {
      ...(state.releasedSavedExams || {}),
      [savedId]: now,
      ...(item?.sourceName ? { [item.sourceName]: now } : {}),
    };

    store.setState(
      { savedExams: rel.savedExams, releasedSavedExams: nextReleased },
      'saved-exams/release-from-results'
    );
    storage.saveProgress({
      mistakes: state.mistakes,
      mistakeTimestamps: state.mistakeTimestamps,
      savedExams: rel.savedExams,
      releasedSavedExams: nextReleased,
      userStats: state.userStats,
    });

    renderSavedExamsUI();
    if (typeof onPoolChanged === 'function') {
      onPoolChanged();
    }

    const banner = document?.getElementById('savedExamResultsBanner');
    if (banner) banner.style.display = 'none';

    toast.showToast(`המבחן שוחרר! ${qCount} שאלות חזרו למאגר התרגול והלמידה.`);
    return true;
  }

  return {
    renderSavedExamsUI,
    addSelectedExamToSavedZone,
    releaseSavedExam,
    startSavedExam,
    releaseSavedExamFromResults,
  };
}
