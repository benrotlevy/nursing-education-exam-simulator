/**
 * Exam Feature Controller (`app/js/features/exam/exam-controller.js`)
 * Orchestrates Exam Setup, Active Exam interactions, Grading, and Results Review.
 */

import {
  createExamSession,
  ensureExamQuestionShuffle,
  selectExamAnswer,
  toggleEliminateOption,
  toggleFlagQuestion,
  navigateExamQuestion,
  countUnansweredQuestions,
  gradeExamSession,
  createRetryWrongExamSession,
} from '../../domain/exam-session.js';
import {
  renderActiveExamQuestion,
  renderExamQuickGrid,
  renderExamResultsView,
} from './exam-view.js';

export function createExamController({
  document = globalThis.document,
  store,
  storage,
  router,
  toast,
  confirmAction,
  onProgressChanged,
} = {}) {
  function syncActiveExamDOM() {
    const state = store.getState();
    const cachedExam = ensureExamQuestionShuffle(state.currentExam, state.currentExam.currentIndex);
    if (cachedExam !== state.currentExam) {
      store.setState({ currentExam: cachedExam }, 'exam/cache-options');
      storage.saveExamSession(state.activeExamScreen, cachedExam);
    }
    const latestState = store.getState();
    renderExamQuickGrid({ document, exam: latestState.currentExam });
    renderActiveExamQuestion({ document, exam: latestState.currentExam });
    router.updateMobileSectionIndicator('exam');
  }

  function startExam() {
    const state = store.getState();
    const sourceVal = document?.getElementById('examSourceSelect')?.value || 'ALL';
    const catVal = document?.getElementById('examCategorySelect')?.value || 'ALL';
    const checkedRadio = document?.querySelector('input[name="examCount"]:checked');
    const countVal = checkedRadio ? checkedRadio.value : '10';

    const result = createExamSession({
      allQuestions: state.allQuestions,
      savedExams: state.savedExams,
      mistakes: state.mistakes,
      source: sourceVal,
      category: catVal,
      countChoice: countVal,
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
      'exam/start'
    );
    storage.saveExamSession('ACTIVE', cachedExam);
    router.switchTab('exam');
    syncActiveExamDOM();
    return true;
  }

  function selectExamOption(shuffledOptIdx) {
    const state = store.getState();
    const nextExam = selectExamAnswer(state.currentExam, Number(shuffledOptIdx));
    store.setState({ currentExam: nextExam }, 'exam/select-option');
    storage.saveExamSession(state.activeExamScreen, nextExam);
    syncActiveExamDOM();
  }

  function toggleEliminateExamOption(optIdx) {
    const state = store.getState();
    const nextExam = toggleEliminateOption(state.currentExam, Number(optIdx));
    store.setState({ currentExam: nextExam }, 'exam/toggle-eliminate');
    storage.saveExamSession(state.activeExamScreen, nextExam);
    syncActiveExamDOM();
  }

  function toggleExamFlag() {
    const state = store.getState();
    const nextExam = toggleFlagQuestion(state.currentExam);
    store.setState({ currentExam: nextExam }, 'exam/toggle-flag');
    storage.saveExamSession(state.activeExamScreen, nextExam);
    syncActiveExamDOM();
  }

  function prevExamQuestion() {
    const state = store.getState();
    if (state.currentExam.currentIndex > 0) {
      jumpToExamQuestion(state.currentExam.currentIndex - 1);
    }
  }

  function nextExamQuestion() {
    const state = store.getState();
    if (state.currentExam.currentIndex < state.currentExam.questions.length - 1) {
      jumpToExamQuestion(state.currentExam.currentIndex + 1);
    }
  }

  function jumpToExamQuestion(index) {
    const state = store.getState();
    const nextExam = navigateExamQuestion(state.currentExam, Number(index));
    store.setState({ currentExam: nextExam }, 'exam/navigate');
    storage.saveExamSession(state.activeExamScreen, nextExam);
    syncActiveExamDOM();
  }

  function runWithConfirmation(dialogOptions, onConfirmed) {
    if (typeof confirmAction !== 'function') {
      onConfirmed();
      return true;
    }
    const result = confirmAction(dialogOptions);
    if (result && typeof result.then === 'function') {
      return result.then((confirmed) => {
        if (!confirmed) return false;
        onConfirmed();
        return true;
      });
    }
    if (!result) return false;
    onConfirmed();
    return true;
  }

  function confirmSubmitExam() {
    const state = store.getState();
    const total = state.currentExam.questions.length;
    const unanswered = countUnansweredQuestions(state.currentExam);
    const answered = total - unanswered;
    if (unanswered > 0) {
      return runWithConfirmation(
        {
          title: 'הגשת מבחן עם שאלות פתוחות',
          message: `שים לב: ענית על ${answered} מתוך ${total} שאלות בלבד.\nהאם ברצונך להגיש את המבחן כעת?`,
          confirmText: 'הגש מבחן',
          cancelText: 'המשך במבחן',
          danger: false,
        },
        () => submitExam()
      );
    }
    submitExam();
    return true;
  }

  function submitExam() {
    const state = store.getState();
    const graded = gradeExamSession({
      exam: state.currentExam,
      userStats: state.userStats,
      mistakes: state.mistakes,
      mistakeTimestamps: state.mistakeTimestamps,
      savedExams: state.savedExams,
    });

    store.setState(
      {
        activeExamScreen: 'RESULTS',
        currentExam: graded.exam,
        userStats: graded.userStats,
        mistakes: graded.mistakes,
        mistakeTimestamps: graded.mistakeTimestamps,
        savedExams: graded.savedExams,
      },
      'exam/submit'
    );

    storage.saveProgress({
      mistakes: graded.mistakes,
      mistakeTimestamps: graded.mistakeTimestamps,
      savedExams: graded.savedExams,
      userStats: graded.userStats,
    });
    storage.saveExamSession('RESULTS', graded.exam);

    renderExamResultsView({
      document,
      exam: graded.exam,
      scorePct: graded.scorePct,
      correctCount: graded.correctCount,
      total: graded.totalCount,
    });

    router.switchTab('exam');
    if (typeof onProgressChanged === 'function') {
      onProgressChanged();
    }
  }

  function confirmAbandonExam() {
    return runWithConfirmation(
      {
        title: 'יציאה מהמבחן הפעיל',
        message: 'האם ברצונך לצאת מהמבחן הנוכחי? התשובות של מבחן זה שטרם הוגש יאופסו.',
        confirmText: 'צא מהמבחן',
        cancelText: 'חזור למבחן',
        danger: true,
      },
      () => resetExamToSetup()
    );
  }

  function resetExamToSetup() {
    const emptyExam = {
      isSavedExam: false,
      savedExamId: null,
      savedExamTitle: null,
      questions: [],
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      eliminated: {},
      shuffledOptionsCache: {},
    };
    store.setState(
      {
        activeExamScreen: 'SETUP',
        currentExam: emptyExam,
      },
      'exam/reset-to-setup'
    );
    storage.clearExamSession();
    router.switchTab('exam');
  }

  function retryWrongExamQuestions() {
    const state = store.getState();
    const result = createRetryWrongExamSession(state.currentExam);
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
      'exam/retry-wrong'
    );
    storage.saveExamSession('ACTIVE', cachedExam);
    router.switchTab('exam');
    syncActiveExamDOM();
    return true;
  }

  function renderRestoredResultsIfAny() {
    const state = store.getState();
    if (state.activeExamScreen === 'RESULTS' && state.currentExam?.questions?.length > 0) {
      const total = state.currentExam.questions.length;
      let correctCount = 0;
      state.currentExam.questions.forEach((q, idx) => {
        const userChoice = state.currentExam.userAnswers?.[idx];
        const shuffled = state.currentExam.shuffledOptionsCache?.[idx];
        if (shuffled && userChoice === shuffled.correctIndex) {
          correctCount++;
        }
      });
      const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      renderExamResultsView({
        document,
        exam: state.currentExam,
        scorePct,
        correctCount,
        total,
      });
    }
  }

  return {
    startExam,
    selectExamOption,
    toggleEliminateExamOption,
    toggleExamFlag,
    prevExamQuestion,
    nextExamQuestion,
    jumpToExamQuestion,
    confirmSubmitExam,
    submitExam,
    confirmAbandonExam,
    resetExamToSetup,
    retryWrongExamQuestions,
    syncActiveExamDOM,
    renderRestoredResultsIfAny,
  };
}
