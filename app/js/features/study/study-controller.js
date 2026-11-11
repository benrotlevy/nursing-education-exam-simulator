/**
 * Study Mode Feature Controller (`app/js/features/study/study-controller.js`)
 * Orchestrates Study deck filtering, immediate feedback grading, wrap-around navigation, and AI consultation copy.
 */

import {
  createStudyDeck,
  ensureStudyQuestionShuffle,
  answerStudyQuestion as answerStudyDomain,
  advanceStudyQuestion,
} from '../../domain/study-session.js';
import { getShuffledQuestionOptions } from '../../domain/shuffle.js';
import { formatQuestionForAI } from '../../domain/ai-prompt.js';
import { copyTextToClipboard } from '../../services/clipboard.js';
import { renderStudyQuestionView, syncStudyFilterControls } from './study-view.js';

export function createStudyController({
  document = globalThis.document,
  navigator = globalThis.navigator,
  store,
  storage,
  toast,
  onProgressChanged,
} = {}) {
  function syncStudyDOM() {
    const state = store.getState();
    const cachedStudy = ensureStudyQuestionShuffle(
      state.currentStudy,
      state.currentStudy.currentIndex
    );
    if (cachedStudy !== state.currentStudy) {
      store.setState({ currentStudy: cachedStudy }, 'study/cache-options');
      storage.saveStudySession(cachedStudy);
    }
    const latestState = store.getState();
    syncStudyFilterControls({ document, study: latestState.currentStudy });
    renderStudyQuestionView({ document, study: latestState.currentStudy });
  }

  function initStudyMode({
    selectedCategory = store.getState().currentStudy?.selectedCategory || 'ALL',
    mistakesOnly = Boolean(store.getState().currentStudy?.mistakesOnly),
  } = {}) {
    const state = store.getState();
    const nextStudy = createStudyDeck({
      allQuestions: state.allQuestions,
      savedExams: state.savedExams,
      mistakes: state.mistakes,
      selectedCategory,
      mistakesOnly,
    });
    const cachedStudy = ensureStudyQuestionShuffle(nextStudy, 0);
    store.setState({ currentStudy: cachedStudy }, 'study/init');
    storage.saveStudySession(cachedStudy);
    syncStudyFilterControls({ document, study: cachedStudy });
  }

  function onStudyFilterChange() {
    const catSelect = document?.getElementById('studyCategoryFilter');
    const selectedCategory = catSelect ? catSelect.value : 'ALL';
    initStudyMode({ selectedCategory, mistakesOnly: false });
    syncStudyDOM();
  }

  function toggleStudyMistakesOnly() {
    const state = store.getState();
    const nextMistakesOnly = !state.currentStudy.mistakesOnly;
    initStudyMode({
      selectedCategory: state.currentStudy.selectedCategory,
      mistakesOnly: nextMistakesOnly,
    });
    syncStudyDOM();
  }

  function answerStudyQuestion(selectedOptIdx) {
    const state = store.getState();
    const result = answerStudyDomain({
      study: state.currentStudy,
      selectedOptionIndex: Number(selectedOptIdx),
      userStats: state.userStats,
      mistakes: state.mistakes,
      mistakeTimestamps: state.mistakeTimestamps,
    });

    store.setState(
      {
        currentStudy: result.study,
        userStats: result.userStats,
        mistakes: result.mistakes,
        mistakeTimestamps: result.mistakeTimestamps,
      },
      'study/answer'
    );

    storage.saveProgress({
      mistakes: result.mistakes,
      mistakeTimestamps: result.mistakeTimestamps,
      savedExams: state.savedExams,
      userStats: result.userStats,
    });
    storage.saveStudySession(result.study);

    syncStudyDOM();
    if (typeof onProgressChanged === 'function') {
      onProgressChanged();
    }
  }

  function prevStudyQuestion() {
    const state = store.getState();
    if (state.currentStudy.currentIndex > 0) {
      const nextStudy = {
        ...state.currentStudy,
        currentIndex: state.currentStudy.currentIndex - 1,
      };
      store.setState({ currentStudy: nextStudy }, 'study/prev');
      storage.saveStudySession(nextStudy);
      syncStudyDOM();
    }
  }

  function nextStudyQuestion() {
    const state = store.getState();
    const nextStudy = advanceStudyQuestion(state.currentStudy);
    store.setState({ currentStudy: nextStudy }, 'study/next');
    storage.saveStudySession(nextStudy);
    syncStudyDOM();
  }

  async function copyCurrentStudyQuestionForAI() {
    const state = store.getState();
    const study = state.currentStudy;
    if (!study || !Array.isArray(study.questions) || study.questions.length === 0) return false;
    const q = study.questions[study.currentIndex];
    if (!q) return false;

    const shuffledData =
      study.shuffledOptionsCache?.[study.currentIndex] || getShuffledQuestionOptions(q);
    const textToCopy = formatQuestionForAI(q, shuffledData.options);

    const copied = await copyTextToClipboard(textToCopy, { navigator, document });

    if (copied) {
      toast.showToast('השאלה והפרומפט ל-AI הועתקו בהצלחה! ניתן להדביק ב-ChatGPT/Claude/Gemini');
      const btn = document?.getElementById('btnCopyStudyAI');
      if (btn) {
        const origHtml = btn.innerHTML;
        btn.innerHTML =
          '<span class="copy-ai-icon">✔</span> <span class="copy-ai-label">הועתק ללוח!</span>';
        btn.classList.add('btn-copied');
        setTimeout(() => {
          btn.innerHTML = origHtml;
          btn.classList.remove('btn-copied');
        }, 2000);
      }
    } else {
      toast.showToast('לא ניתן לגשת ללוח באופן אוטומטי בדפדפן זה');
    }

    return copied;
  }

  function practiceCategory(categoryName) {
    initStudyMode({
      selectedCategory: categoryName,
      mistakesOnly: false,
    });
    syncStudyDOM();
  }

  return {
    initStudyMode,
    onStudyFilterChange,
    toggleStudyMistakesOnly,
    answerStudyQuestion,
    prevStudyQuestion,
    nextStudyQuestion,
    copyCurrentStudyQuestionForAI,
    practiceCategory,
    syncStudyDOM,
  };
}
