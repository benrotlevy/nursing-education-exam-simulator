/**
 * Tab & Screen Router (`app/js/core/router.js`)
 * Synchronizes desktop segmented tabs, mobile bottom navigation bar,
 * mobile section indicator pill, and active `.screen` visibility.
 */

import { STORAGE_KEYS, TABS } from '../config.js';

const TAB_CONFIG = Object.freeze({
  exam: {
    topBtnId: 'tabExam',
    bNavBtnId: 'bNavExam',
    tagClass: 'tag-exam',
  },
  study: {
    topBtnId: 'tabStudy',
    bNavBtnId: 'bNavStudy',
    tagClass: 'tag-study',
    screenId: 'screenStudyMode',
  },
  'saved-exams': {
    topBtnId: 'tabSavedExams',
    bNavBtnId: 'bNavSaved',
    tagClass: 'tag-saved',
    screenId: 'screenSavedExams',
  },
  stats: {
    topBtnId: 'tabStats',
    bNavBtnId: 'bNavStats',
    tagClass: 'tag-stats',
    screenId: 'screenStats',
  },
});

export function createRouter({
  document = globalThis.document,
  sessionStorage = globalThis.sessionStorage,
  getState,
  onTabActivated,
} = {}) {
  function updateMobileSectionIndicator(explicitTabId) {
    const tagEl = document?.getElementById('mobileSectionTag');
    const textEl = document?.getElementById('mobileSectionText');
    if (!tagEl || !textEl) return;

    const state = typeof getState === 'function' ? getState() : {};
    const activeTab = explicitTabId || state.activeTab || 'exam';

    tagEl.className = 'mobile-section-tag';

    if (activeTab === 'exam') {
      tagEl.classList.add('tag-exam');
      if (state.activeExamScreen === 'ACTIVE' && state.currentExam?.questions?.length > 0) {
        const cur = (state.currentExam.currentIndex || 0) + 1;
        const tot = state.currentExam.questions.length;
        textEl.textContent = `📝 מבחן פעיל (${cur}/${tot})`;
      } else if (state.activeExamScreen === 'RESULTS') {
        textEl.textContent = '📝 מצב מבחן: תוצאות וסיכום';
      } else {
        textEl.textContent = '📝 מצב מבחן: הגדרת תרגול';
      }
    } else if (activeTab === 'study') {
      tagEl.classList.add('tag-study');
      if (state.currentStudy?.mistakesOnly) {
        textEl.textContent = `💡 מצב למידה: תרגול טעויות (${state.mistakes?.size || 0})`;
      } else {
        textEl.textContent = '💡 מצב למידה: משוב מיידי והסברים';
      }
    } else if (activeTab === 'saved-exams') {
      tagEl.classList.add('tag-saved');
      const count = state.savedExams ? state.savedExams.length : 0;
      textEl.textContent = `📦 מבחנים שמורים (${count}/3 בבידוד)`;
    } else if (activeTab === 'stats') {
      tagEl.classList.add('tag-stats');
      textEl.textContent = '📊 דשבורד סטטיסטיקה והתקדמות';
    }
  }

  function resolveExamScreenId(state) {
    const hasQuestions =
      state?.currentExam &&
      Array.isArray(state.currentExam.questions) &&
      state.currentExam.questions.length > 0;
    if (state?.activeExamScreen === 'ACTIVE' && hasQuestions) {
      return 'screenActiveExam';
    }
    if (state?.activeExamScreen === 'RESULTS' && hasQuestions) {
      return 'screenExamResults';
    }
    return 'screenExamSetup';
  }

  function switchTab(tabId) {
    const targetTab = TABS.includes(tabId) ? tabId : 'exam';
    const config = TAB_CONFIG[targetTab];

    document?.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    document?.querySelectorAll('.bnav-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    document?.querySelectorAll('.screen').forEach((screen) => {
      screen.classList.remove('active');
    });

    const topBtn = document?.getElementById(config.topBtnId);
    if (topBtn) {
      topBtn.classList.add('active');
      topBtn.setAttribute('aria-selected', 'true');
    }

    const bNavBtn = document?.getElementById(config.bNavBtnId);
    if (bNavBtn) {
      bNavBtn.classList.add('active');
    }

    const state = typeof getState === 'function' ? getState() : {};
    const targetScreenId = targetTab === 'exam' ? resolveExamScreenId(state) : config.screenId;
    const screenEl = document?.getElementById(targetScreenId);
    if (screenEl) {
      screenEl.classList.add('active');
    }

    try {
      sessionStorage?.setItem(STORAGE_KEYS.ACTIVE_TAB, targetTab);
    } catch {
      // Ignore storage errors
    }

    updateMobileSectionIndicator(targetTab);

    if (typeof onTabActivated === 'function') {
      onTabActivated(targetTab, targetScreenId);
    }

    return { tabId: targetTab, screenId: targetScreenId };
  }

  return {
    switchTab,
    updateMobileSectionIndicator,
    resolveExamScreenId,
  };
}
