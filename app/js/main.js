/**
 * Application Entrypoint (`app/js/main.js`)
 * Wires Store, Storage (`v2` keys), Router, Toast, Dialog, Question Repository,
 * Event Delegation, Invite-Only Access Control, Demo Mode, and Feature Controllers.
 */

import { ACCESS_STATUSES, CATEGORIES, TOTAL_CATALOG_QUESTIONS } from './config.js';
import { createStore, createInitialState } from './core/store.js';
import { createStorageAdapter } from './core/storage.js';
import { createRouter } from './core/router.js';
import { delegate, onAction } from './core/events.js';
import { createToastController } from './ui/toast.js';
import { createDialogController } from './ui/dialog.js';
import {
  clearQuestionsCatalogCache,
  loadEncryptedQuestionsCatalog,
  loadQuestionsCatalog,
} from './services/question-repository.js';
import { getQuarantinedQuestionIdSet, extractUniqueSources } from './domain/question-pool.js';
import { populateExamSetupSelectors } from './features/exam/exam-view.js';
import { createExamController } from './features/exam/exam-controller.js';
import { populateStudyCategorySelector } from './features/study/study-view.js';
import { createStudyController } from './features/study/study-controller.js';
import { createSavedExamsController } from './features/saved-exams/saved-exams-controller.js';
import { createStatsController } from './features/stats/stats-controller.js';
import { createAuthController } from './features/auth/auth-controller.js';
import { createDemoBannerView } from './features/auth/demo-banner-view.js';
import { createReportService } from './services/report-service.js';
import { createAccessControlService } from './services/access-control-service.js';
import { createReportController } from './features/report-issue/report-controller.js';
import { createPwaService } from './services/pwa.js';

export function mountApplication({
  window = globalThis.window,
  document = globalThis.document,
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
  navigator = globalThis.navigator,
  fetchFn = (...args) => globalThis.fetch(...args),
  preloadedQuestions = null,
  firebaseSdk = null,
  autoInitCloudSync = false,
  confirmAction: customConfirmAction = null,
} = {}) {
  const store = createStore(createInitialState());
  const storage = createStorageAdapter({ localStorage, sessionStorage });
  const toast = createToastController({ document });
  const dialog = createDialogController({ document });
  const demoBannerView = createDemoBannerView({ document });

  const confirmAction =
    customConfirmAction ||
    ((optionsOrMsg) => {
      const opts =
        typeof optionsOrMsg === 'string' ? { message: optionsOrMsg } : optionsOrMsg || {};
      return dialog.confirmDialog(opts);
    });

  const controllers = {};
  let hasFullCatalog = false;
  let latestAccessDecision = {
    status: ACCESS_STATUSES.GUEST,
    approved: false,
    isAdmin: false,
    keyBase64: '',
    telegramUrl: '',
    note: '',
  };

  const router = createRouter({
    document,
    sessionStorage,
    getState: () => store.getState(),
    onTabActivated: (tabId) => {
      store.setState({ activeTab: tabId }, 'router/switch-tab');
      if (tabId === 'exam' && controllers.exam) {
        const state = store.getState();
        if (state.activeExamScreen === 'ACTIVE' && state.currentExam?.questions?.length > 0) {
          controllers.exam.syncActiveExamDOM();
        }
      } else if (tabId === 'study' && controllers.study) {
        controllers.study.syncStudyDOM();
      } else if (tabId === 'saved-exams' && controllers.savedExams) {
        controllers.savedExams.renderSavedExamsUI();
      } else if (tabId === 'stats' && controllers.stats) {
        controllers.stats.renderStats();
      }
    },
  });

  function updateHeaderCounter() {
    const state = store.getState();
    const quarantinedSet = getQuarantinedQuestionIdSet(state.savedExams);
    const quarantinedCount = quarantinedSet.size;
    const totalCount = state.allQuestions ? state.allQuestions.length : 0;
    const activeCount = Math.max(0, totalCount - quarantinedCount);
    const savedCount = state.savedExams ? state.savedExams.length : 0;

    const headerEl = document?.getElementById('totalQuestionsHeader');
    if (headerEl) {
      if (
        !hasFullCatalog &&
        !preloadedQuestions &&
        totalCount > 0 &&
        totalCount < TOTAL_CATALOG_QUESTIONS
      ) {
        headerEl.textContent = `מצב הדגמה: ${totalCount} שאלות פתוחות מתוך ${TOTAL_CATALOG_QUESTIONS} שאלות במאגר`;
      } else if (quarantinedCount === 0) {
        headerEl.textContent = `מאגר פעיל: ${totalCount} שאלות מאומתות`;
      } else {
        headerEl.textContent = `מאגר פעיל: ${activeCount} שאלות (${quarantinedCount} שמורות ב-${savedCount} מבחנים) • ${totalCount} סה"כ`;
      }
    }

    const navSavedBadge = document?.getElementById('navSavedBadge');
    if (navSavedBadge) {
      navSavedBadge.textContent = `${savedCount}/3`;
    }

    const bNavSavedBadge = document?.getElementById('bNavSavedBadge');
    if (bNavSavedBadge) {
      bNavSavedBadge.textContent = `${savedCount}/3`;
      bNavSavedBadge.style.display = savedCount > 0 ? 'inline-block' : 'none';
    }

    router.updateMobileSectionIndicator();
  }

  function renderDemoBanner() {
    if (preloadedQuestions) return;
    const state = store.getState();
    const loadedCount = Array.isArray(state.allQuestions) ? state.allQuestions.length : 0;
    const currentUser = state.auth?.user || null;

    demoBannerView.render({
      status: latestAccessDecision.status,
      approved: latestAccessDecision.approved,
      isAdmin: latestAccessDecision.isAdmin,
      hasFullCatalog,
      user: currentUser,
      note: latestAccessDecision.note || '',
      telegramUrl: latestAccessDecision.telegramUrl || '',
      loadedCount: loadedCount || 10,
    });
  }

  function updateMistakesUI() {
    const state = store.getState();
    const count = state.mistakes ? state.mistakes.size : 0;
    const navBadge = document?.getElementById('navMistakesBadge');
    const bNavMistakesBadge = document?.getElementById('bNavMistakesBadge');
    const pillCount = document?.getElementById('examMistakesPill');
    const studyCount = document?.getElementById('studyMistakesCount');

    if (navBadge) {
      navBadge.textContent = `${count} טעויות לחיזוק`;
      navBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (bNavMistakesBadge) {
      bNavMistakesBadge.textContent = String(count);
      bNavMistakesBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (pillCount) {
      pillCount.textContent = `מאגר טעויות בלבד (${count})`;
    }
    if (studyCount) {
      studyCount.textContent = String(count);
    }

    router.updateMobileSectionIndicator();
  }

  function notifyCloudSyncPush() {
    if (controllers.auth) {
      controllers.auth.schedulePush();
    } else if (window?.cloudSync && typeof window.cloudSync.schedulePush === 'function') {
      window.cloudSync.schedulePush();
    }
  }

  const examController = createExamController({
    document,
    store,
    storage,
    router,
    toast,
    confirmAction,
    onProgressChanged: () => {
      updateMistakesUI();
      updateHeaderCounter();
      statsController.renderStats();
      savedExamsController.renderSavedExamsUI();
      notifyCloudSyncPush();
    },
  });

  const studyController = createStudyController({
    document,
    navigator,
    store,
    storage,
    toast,
    onProgressChanged: () => {
      updateMistakesUI();
      statsController.renderStats();
      notifyCloudSyncPush();
    },
  });

  const savedExamsController = createSavedExamsController({
    document,
    store,
    storage,
    router,
    toast,
    confirmAction,
    onPoolChanged: () => {
      updateHeaderCounter();
      studyController.initStudyMode();
      notifyCloudSyncPush();
    },
    onExamStarted: () => {
      examController.syncActiveExamDOM();
    },
  });

  const statsController = createStatsController({
    document,
    store,
    storage,
    router,
    toast,
    confirmAction,
    onPracticeWeakestCategory: (categoryName) => {
      studyController.practiceCategory(categoryName);
    },
    onStatsReset: () => {
      updateMistakesUI();
      if (controllers.auth) {
        controllers.auth.resetCloudData();
      } else if (window?.cloudSync && typeof window.cloudSync.resetCloudData === 'function') {
        window.cloudSync.resetCloudData();
      }
    },
  });

  let accessControlService = null;

  async function unlockFullCatalogWithKey(keyBase64) {
    if (!keyBase64 || hasFullCatalog || preloadedQuestions) {
      return hasFullCatalog;
    }
    const cryptoImpl = window?.crypto || globalThis.crypto;
    const fullQuestions = await loadEncryptedQuestionsCatalog({
      keyBase64,
      url: './data/questions.enc.json',
      fetchImpl: fetchFn,
      cryptoImpl,
    });
    hasFullCatalog = true;
    if (window) window.EXAM_QUESTIONS = fullQuestions;
    bootstrapWithQuestions(fullQuestions, { preserveActiveTab: true });
    renderDemoBanner();
    return true;
  }

  async function revertToDemoCatalogIfNeeded() {
    if (preloadedQuestions || !hasFullCatalog) {
      return;
    }
    hasFullCatalog = false;
    if (window) window.EXAM_QUESTIONS = null;
    clearQuestionsCatalogCache();
    store.setState(
      {
        activeExamScreen: 'SETUP',
        currentExam: null,
        currentStudy: null,
      },
      'app/revert-demo'
    );
    try {
      const demoQuestions = await loadQuestionsCatalog('./data/questions-demo.json', fetchFn);
      if (window) window.EXAM_QUESTIONS = demoQuestions;
      bootstrapWithQuestions(demoQuestions, { preserveActiveTab: true });
    } catch (err) {
      console.warn('Could not reload demo catalog on sign-out:', err);
    }
  }

  const authController = createAuthController({
    document,
    store,
    storage,
    toast,
    notifyError: (message) => dialog.alertDialog({ title: 'שגיאת התחברות לענן', message }),
    firebaseSdk,
    resolveCloudAuthorization: async (user) => {
      if (!accessControlService) {
        return { allowed: true };
      }
      const decision = await accessControlService.checkUserAccess(user);
      latestAccessDecision = { ...decision };

      if (decision.approved) {
        if (decision.keyBase64 && !hasFullCatalog && !preloadedQuestions) {
          try {
            await unlockFullCatalogWithKey(decision.keyBase64);
          } catch (decryptErr) {
            console.warn('Failed to decrypt full catalog:', decryptErr);
          }
        }
      } else {
        await revertToDemoCatalogIfNeeded();
      }

      renderDemoBanner();
      return {
        allowed: Boolean(decision.approved),
        status: decision.status,
      };
    },
    onRemoteMerged: () => {
      updateMistakesUI();
      updateHeaderCounter();
      statsController.renderStats();
      savedExamsController.renderSavedExamsUI();
    },
    onAuthChanged: (user) => {
      if (!user) {
        accessControlService?.clearCachedApproval?.();
        latestAccessDecision = {
          status: ACCESS_STATUSES.GUEST,
          approved: false,
          isAdmin: false,
          keyBase64: '',
          telegramUrl: latestAccessDecision.telegramUrl || '',
          note: '',
        };
        revertToDemoCatalogIfNeeded().then(() => {
          renderDemoBanner();
        });
      }
      reportController.onAuthChanged(user);
    },
  });

  accessControlService = createAccessControlService({
    cloudSync: authController.cloudSync,
    localStorage,
    fetchFn,
    navigator: window?.navigator ?? navigator,
  });

  const reportService = createReportService({
    cloudSync: authController.cloudSync,
    fetchFn,
    navigator: window?.navigator ?? navigator,
  });

  const pwaService = createPwaService({
    window,
    document,
    navigator,
    storage: localStorage,
    toast,
  });

  const reportController = createReportController({
    document,
    navigator: window?.navigator,
    store,
    cloudSync: authController.cloudSync,
    reportService,
    accessControlService,
    toast,
    dialog,
    authController,
    onCatalogKeyUpdated: async (keyBase64) => {
      if (keyBase64 && !hasFullCatalog && !preloadedQuestions) {
        await unlockFullCatalogWithKey(keyBase64);
      }
    },
    onContactConfigUpdated: (telegramUrl) => {
      latestAccessDecision = { ...latestAccessDecision, telegramUrl };
      renderDemoBanner();
    },
  });

  demoBannerView.setHandlers({
    onSubmitRequest: async ({ note }) => {
      demoBannerView.setSubmitting(true);
      const res = await accessControlService.submitAccessRequest({ note });
      demoBannerView.setSubmitting(false);

      if (res.alreadyApproved) {
        toast?.showToast(res.message);
        await authController.refreshAuthorization();
        return;
      }

      if (res.ok) {
        latestAccessDecision = { ...latestAccessDecision, note };
      }
      toast?.showToast(res.message || 'שליחת הבקשה הושלמה.');
    },
    onRecheckAccess: async () => {
      demoBannerView.setChecking(true);
      try {
        const ok = await authController.refreshAuthorization();
        if (ok && hasFullCatalog) {
          toast?.showToast(`אושרת! המאגר המלא (${TOTAL_CATALOG_QUESTIONS} שאלות) נפתח בהצלחה 🎉`);
        } else if (ok) {
          toast?.showToast('חשבונך מאושר! (ממתין להגדרת מפתח המאגר בענן)');
        } else {
          toast?.showToast('הגישה עדיין ממתינה לאישור מנהל המערכת.');
        }
      } finally {
        demoBannerView.setChecking(false);
      }
    },
    onOpenAdminSetup: () => {
      reportController.openAdminDashboard({ initialTab: 'users' });
    },
  });

  controllers.exam = examController;
  controllers.study = studyController;
  controllers.savedExams = savedExamsController;
  controllers.stats = statsController;
  controllers.auth = authController;

  function bootstrapWithQuestions(rawQuestions = [], { preserveActiveTab = false } = {}) {
    const questions = Array.isArray(rawQuestions)
      ? rawQuestions
      : Array.isArray(rawQuestions?.questions)
        ? rawQuestions.questions
        : [];
    const progress = storage.loadProgress();
    const sources = extractUniqueSources(questions);

    store.setState(
      {
        allQuestions: questions,
        sources,
        categories: [...CATEGORIES],
        mistakes: progress.mistakes,
        mistakeTimestamps: progress.mistakeTimestamps,
        savedExams: progress.savedExams,
        releasedSavedExams: progress.releasedSavedExams || {},
        userStats: progress.userStats,
      },
      'app/bootstrap-progress'
    );

    populateExamSetupSelectors({
      document,
      sources,
      categories: CATEGORIES,
    });
    populateStudyCategorySelector({
      document,
      categories: CATEGORIES,
    });

    updateMistakesUI();
    updateHeaderCounter();

    const restoredStudy = storage.loadStudySession(questions);
    if (restoredStudy) {
      store.setState({ currentStudy: restoredStudy }, 'app/restore-study');
    } else {
      studyController.initStudyMode();
    }

    const restoredExam = storage.loadExamSession(questions);
    if (restoredExam) {
      store.setState(
        {
          activeExamScreen: restoredExam.activeExamScreen,
          currentExam: restoredExam.currentExam,
        },
        'app/restore-exam'
      );
      examController.renderRestoredResultsIfAny();
    }

    statsController.renderStats();
    savedExamsController.renderSavedExamsUI();

    if (preserveActiveTab) {
      const currentTab = store.getState().activeTab || 'exam';
      router.switchTab(currentTab);
    } else {
      const initialTab = storage.loadActiveTab('exam');
      router.switchTab(initialTab);
    }
  }

  // Declarative event delegation (`data-action`)
  onAction(document, {
    'switch-tab': (_event, el) => {
      const tab = el.getAttribute('data-tab');
      if (tab) router.switchTab(tab);
    },
    'start-exam': () => examController.startExam(),
    'select-exam-option': (event, el) => {
      if (event.target?.closest?.('[data-action="toggle-eliminate-option"]')) return;
      examController.selectExamOption(Number(el.getAttribute('data-index')));
    },
    'toggle-eliminate-option': (event, el) => {
      event.stopPropagation();
      examController.toggleEliminateExamOption(Number(el.getAttribute('data-index')));
    },
    'toggle-exam-flag': () => examController.toggleExamFlag(),
    'prev-exam-question': () => examController.prevExamQuestion(),
    'next-exam-question': () => examController.nextExamQuestion(),
    'jump-exam-question': (_event, el) => {
      examController.jumpToExamQuestion(Number(el.getAttribute('data-index')));
    },
    'confirm-submit-exam': () => examController.confirmSubmitExam(),
    'confirm-abandon-exam': () => examController.confirmAbandonExam(),
    'reset-exam-to-setup': () => examController.resetExamToSetup(),
    'retry-wrong-questions': () => examController.retryWrongExamQuestions(),
    'release-saved-from-results': () => savedExamsController.releaseSavedExamFromResults(),
    'add-saved-exam': () => savedExamsController.addSelectedExamToSavedZone(),
    'start-saved-exam': (_event, el) => {
      savedExamsController.startSavedExam(el.getAttribute('data-id'));
    },
    'release-saved-exam': (_event, el) => {
      savedExamsController.releaseSavedExam(el.getAttribute('data-id'));
    },
    'toggle-study-mistakes': () => studyController.toggleStudyMistakesOnly(),
    'answer-study-option': (_event, el) => {
      studyController.answerStudyQuestion(Number(el.getAttribute('data-index')));
    },
    'prev-study-question': () => studyController.prevStudyQuestion(),
    'next-study-question': () => studyController.nextStudyQuestion(),
    'copy-study-ai': () => studyController.copyCurrentStudyQuestionForAI(),
    'confirm-reset-stats': () => statsController.confirmResetStats(),
    'practice-weakest-category': () => statsController.practiceWeakestCategory(),
    'google-sign-in': () => {
      authController.signIn();
    },
    'google-sign-out': () => {
      authController.signOut();
    },
    'open-report-dialog': (_event, actionEl) => {
      reportController.openReportDialog({
        source: actionEl?.dataset?.reportSource || 'study',
        questionId: actionEl?.dataset?.questionId || '',
      });
    },
    'open-admin-reports': () => {
      reportController.openAdminDashboard();
    },
    'open-admin-users': () => {
      reportController.openAdminDashboard({ initialTab: 'users' });
    },
    'install-pwa': () => {
      pwaService.promptInstall();
    },
    'dismiss-install-pwa': () => {
      pwaService.dismissInstall();
    },
  });

  delegate(document, 'change', '[data-change-action="study-category-filter"]', () => {
    studyController.onStudyFilterChange();
  });

  // Expose programmatic API on window for tests and Cloud Sync integration
  if (window) {
    window.cloudSync = authController.cloudSync;
    window.triggerGoogleSignIn = () => authController.signIn();
    window.triggerGoogleSignOut = () => authController.signOut();

    window.app = {
      store,
      storage,
      router,
      toast,
      dialog,
      examController,
      studyController,
      savedExamsController,
      statsController,
      authController,
      accessControlService,
      demoBannerView,
      reportService,
      reportController,
      pwaService,
      cloudSync: authController.cloudSync,
      updateHeaderCounter,
      updateMistakesUI,
    };

    window.showToast = (msg) => toast.showToast(msg);
    window.switchTab = (tabId) => router.switchTab(tabId);
    window.startExam = () => examController.startExam();
    window.selectExamOption = (idx) => examController.selectExamOption(idx);
    window.toggleEliminateExamOption = (idx) => examController.toggleEliminateExamOption(idx);
    window.toggleExamFlag = () => examController.toggleExamFlag();
    window.prevExamQuestion = () => examController.prevExamQuestion();
    window.nextExamQuestion = () => examController.nextExamQuestion();
    window.jumpToExamQuestion = (idx) => examController.jumpToExamQuestion(idx);
    window.confirmSubmitExam = () => examController.confirmSubmitExam();
    window.submitExam = () => examController.submitExam();
    window.confirmAbandonExam = () => examController.confirmAbandonExam();
    window.resetExamToSetup = () => examController.resetExamToSetup();
    window.retryWrongExamQuestions = () => examController.retryWrongExamQuestions();
    window.addSelectedExamToSavedZone = () => savedExamsController.addSelectedExamToSavedZone();
    window.releaseSavedExam = (id) => savedExamsController.releaseSavedExam(id);
    window.startSavedExam = (id) => savedExamsController.startSavedExam(id);
    window.releaseSavedExamFromResults = () => savedExamsController.releaseSavedExamFromResults();
    window.onStudyFilterChange = () => studyController.onStudyFilterChange();
    window.toggleStudyMistakesOnly = () => studyController.toggleStudyMistakesOnly();
    window.answerStudyQuestion = (idx) => studyController.answerStudyQuestion(idx);
    window.prevStudyQuestion = () => studyController.prevStudyQuestion();
    window.nextStudyQuestion = () => studyController.nextStudyQuestion();
    window.copyCurrentStudyQuestionForAI = () => studyController.copyCurrentStudyQuestionForAI();
    window.practiceWeakestCategory = () => statsController.practiceWeakestCategory();
    window.confirmResetStats = () => statsController.confirmResetStats();
    window.updateHeaderCounter = updateHeaderCounter;
    window.updateMistakesUI = updateMistakesUI;
    window.renderSavedExamsUI = () => savedExamsController.renderSavedExamsUI();
    window.renderStats = () => statsController.renderStats();
  }

  const resolvedPreloaded =
    preloadedQuestions ||
    (Array.isArray(window?.EXAM_QUESTIONS) && window.EXAM_QUESTIONS.length > 0
      ? window.EXAM_QUESTIONS
      : null);

  if (resolvedPreloaded) {
    hasFullCatalog = resolvedPreloaded.length >= TOTAL_CATALOG_QUESTIONS;
    bootstrapWithQuestions(resolvedPreloaded);
  } else {
    // Try optimistic offline unlock if user has cached approval + key on this device;
    // otherwise boot immediately with the 10-question Demo Catalog.
    const cachedApproval = accessControlService.loadCachedApproval();
    if (cachedApproval?.approved === true && cachedApproval?.keyBase64) {
      latestAccessDecision = {
        status: ACCESS_STATUSES.APPROVED,
        approved: true,
        isAdmin: false,
        keyBase64: cachedApproval.keyBase64,
        telegramUrl: cachedApproval.telegramUrl || '',
        note: '',
      };
      unlockFullCatalogWithKey(cachedApproval.keyBase64).catch(async () => {
        try {
          const demoQuestions = await loadQuestionsCatalog('./data/questions-demo.json', fetchFn);
          if (window) window.EXAM_QUESTIONS = demoQuestions;
          bootstrapWithQuestions(demoQuestions);
          renderDemoBanner();
        } catch (demoErr) {
          console.error('Failed to load demo catalog:', demoErr);
          bootstrapWithQuestions([]);
        }
      });
    } else {
      loadQuestionsCatalog('./data/questions-demo.json', fetchFn)
        .then((questions) => {
          if (window) window.EXAM_QUESTIONS = questions;
          bootstrapWithQuestions(questions);
          renderDemoBanner();
        })
        .catch((err) => {
          console.error('Failed to load ./data/questions-demo.json:', err);
          bootstrapWithQuestions([]);
        });
    }
  }

  if (autoInitCloudSync || firebaseSdk) {
    authController.init();
  }
  if (autoInitCloudSync) {
    pwaService.init();
  }

  return window?.app;
}

// Auto-mount in browser context
if (
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  !window.__DISABLE_AUTO_MOUNT__
) {
  const firebaseSdk = window.__E2E_FIREBASE_SDK__ || null;
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () =>
      mountApplication({ autoInitCloudSync: true, firebaseSdk })
    );
  } else {
    mountApplication({ autoInitCloudSync: true, firebaseSdk });
  }
}
