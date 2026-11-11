import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardStats,
  findWeakestCategory,
  createResetStatsPayload,
} from '../../app/js/domain/stats.js';
import { CATEGORIES } from '../../app/js/config.js';

describe('app/js/domain/stats.js — Accuracy, Category Breakdown & Weakest Category (STATS-01..STATS-04)', () => {
  it('computes overall accuracy, category breakdown, and identifies weakest category [STATS-01, STATS-02]', () => {
    const userStats = {
      totalAnswered: 20,
      totalCorrect: 15,
      examsCompleted: 2,
      categoryStats: {
        [CATEGORIES[0]]: { correct: 9, total: 10 }, // 90%
        [CATEGORIES[1]]: { correct: 6, total: 10 }, // 60% (weakest!)
      },
    };
    const mistakes = new Set(['q_001', 'q_002']);

    const dashboard = computeDashboardStats({
      allQuestions: [],
      categories: CATEGORIES,
      userStats,
      mistakes,
    });

    assert.equal(dashboard.accuracyPct, 75);
    assert.equal(dashboard.totalAnswered, 20);
    assert.equal(dashboard.examsCompleted, 2);
    assert.equal(dashboard.mistakesCount, 2);
    assert.match(dashboard.insightDesc, new RegExp(CATEGORIES[1]));

    const weakest = findWeakestCategory(CATEGORIES, userStats);
    assert.equal(weakest, CATEGORIES[1]);
  });

  it('creates clean reset stats payload with lastResetAt timestamp [STATS-04]', () => {
    const reset = createResetStatsPayload(1700000099000);
    assert.equal(reset.mistakes.size, 0);
    assert.equal(reset.userStats.totalAnswered, 0);
    assert.equal(reset.userStats.lastResetAt, 1700000099000);
  });
});
