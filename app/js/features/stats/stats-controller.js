/**
 * Statistics & Analytics Controller (`app/js/features/stats/stats-controller.js`)
 * Orchestrates rendering the stats dashboard, practicing the weakest category, and resetting progress.
 */

import { findWeakestCategory, createResetStatsPayload } from '../../domain/stats.js';
import { renderStatsView } from './stats-view.js';

export function createStatsController({
  document = globalThis.document,
  store,
  storage,
  router,
  toast,
  confirmAction,
  onPracticeWeakestCategory,
  onStatsReset,
} = {}) {
  function renderStats() {
    const state = store.getState();
    return renderStatsView({
      document,
      userStats: state.userStats,
      mistakes: state.mistakes,
      allQuestions: state.allQuestions,
      categories: state.categories,
    });
  }

  function practiceWeakestCategory() {
    const state = store.getState();
    const weakestCat = findWeakestCategory(state.categories, state.userStats);

    if (typeof onPracticeWeakestCategory === 'function') {
      onPracticeWeakestCategory(weakestCat);
    }
    router.switchTab('study');
  }

  function confirmResetStats() {
    if (typeof confirmAction === 'function') {
      const proceed = confirmAction(
        'האם אתה בטוח שברצונך לאפס את כל נתוני הסטטיסטיקה ומאגר הטעויות?'
      );
      if (!proceed) return false;
    }

    const state = store.getState();
    const resetPayload = createResetStatsPayload();

    store.setState(
      {
        mistakes: resetPayload.mistakes,
        mistakeTimestamps: resetPayload.mistakeTimestamps,
        userStats: resetPayload.userStats,
      },
      'stats/reset'
    );

    storage.saveProgress({
      mistakes: resetPayload.mistakes,
      mistakeTimestamps: resetPayload.mistakeTimestamps,
      savedExams: state.savedExams,
      userStats: resetPayload.userStats,
    });

    renderStats();
    if (typeof onStatsReset === 'function') {
      onStatsReset();
    }
    toast.showToast('הנתונים אופסו בהצלחה.');
    return true;
  }

  return {
    renderStats,
    practiceWeakestCategory,
    confirmResetStats,
  };
}
