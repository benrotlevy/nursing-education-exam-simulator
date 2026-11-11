/**
 * Statistics & Readiness Analytics Domain (`app/js/domain/stats.js`)
 * Pure calculations for overall accuracy, per-category mastery, weakest category
 * detection, readiness insights, and stats reset (STATS-01..STATS-04).
 */

import { CATEGORIES } from '../config.js';

/**
 * Computes overall summary metrics and readiness insight message (`STATS-01`, `STATS-02`).
 */
export function computeDashboardStats({
  allQuestions = [],
  categories = CATEGORIES,
  userStats = {},
  mistakes = new Set(),
} = {}) {
  const totalAnswered = Number(userStats?.totalAnswered) || 0;
  const totalCorrect = Number(userStats?.totalCorrect) || 0;
  const examsCompleted = Number(userStats?.examsCompleted) || 0;
  const mistakesCount =
    mistakes instanceof Set ? mistakes.size : Array.isArray(mistakes) ? mistakes.length : 0;
  const accuracyPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  let weakestCategoryForBanner = null;
  let minPctForBanner = 101;

  const categoryBreakdown = categories.map((catName) => {
    const catData = userStats?.categoryStats?.[catName] || { correct: 0, total: 0 };
    const correct = Number(catData.correct) || 0;
    const total = Number(catData.total) || 0;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const totalInDb = allQuestions.filter((q) => q.category === catName).length;

    if (total >= 3 && pct < minPctForBanner) {
      minPctForBanner = pct;
      weakestCategoryForBanner = catName;
    }

    let barColor = 'var(--primary)';
    if (total > 0) {
      if (pct >= 80) barColor = 'var(--success)';
      else if (pct >= 65) barColor = 'var(--warning)';
      else barColor = 'var(--danger)';
    }

    return {
      category: catName,
      correct,
      total,
      pct,
      totalInDb,
      barColor,
    };
  });

  let insightTitle;
  let insightDesc;

  if (totalAnswered < 10) {
    insightTitle = 'התחלת תרגול טרייה:';
    insightDesc = 'פתור לפחות 15-20 שאלות כדי שהמערכת תזהה את תחומי החוזק והחולשה במדויק.';
  } else if (weakestCategoryForBanner && minPctForBanner < 75) {
    insightTitle = '🚨 המלצה ממוקדת לחיזוק:';
    insightDesc = `זוהה אחוז הצלחה נמוך יחסית (${minPctForBanner}%) בנושא: "${weakestCategoryForBanner}". מומלץ לתרגל נושא זה במצב למידה.`;
  } else if (mistakesCount > 5) {
    insightTitle = '📌 מאגר טעויות ממתין לך:';
    insightDesc = `יש לך ${mistakesCount} שאלות במאגר הטעויות. חזרה עליהן כעת תקבע את הידע לקראת המבחן!`;
  } else {
    insightTitle = '🏆 שליטה גבוהה בחומר!';
    insightDesc = 'כל הכבוד! הישג מרשים בכל הנושאים. המשך לתרגל מבחנים שלמים לשמירה על חדות.';
  }

  return {
    accuracyPct,
    totalAnswered,
    totalCorrect,
    examsCompleted,
    mistakesCount,
    categoryBreakdown,
    insightTitle,
    insightDesc,
  };
}

/**
 * Finds the weakest category with at least 1 answered question, falling back to `categories[0]` (`STATS-02`, `STATS-03`).
 */
export function findWeakestCategory(categories = CATEGORIES, userStats = {}) {
  let weakestCat = null;
  let minPct = 101;

  for (const catName of categories) {
    const catData = userStats?.categoryStats?.[catName];
    if (catData && catData.total > 0) {
      const pct = Math.round((catData.correct / catData.total) * 100);
      if (pct < minPct) {
        minPct = pct;
        weakestCat = catName;
      }
    }
  }

  return weakestCat || categories[0] || '';
}

/**
 * Creates a clean reset payload for `userStats` and `mistakes` with `lastResetAt` timestamp (`STATS-04`, `SYNC-03`).
 */
export function createResetStatsPayload(now = Date.now()) {
  return {
    mistakes: new Set(),
    mistakeTimestamps: {},
    userStats: {
      totalAnswered: 0,
      totalCorrect: 0,
      examsCompleted: 0,
      lastResetAt: now,
      categoryStats: {},
    },
  };
}
