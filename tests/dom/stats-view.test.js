import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { renderStatsView } from '../../app/js/features/stats/stats-view.js';

describe('app/js/features/stats/stats-view.js — Statistics Dashboard DOM Rendering (STATS-01, STATS-02)', () => {
  it('renders accuracy metrics, 6 category progress bars, and readiness insight banner [STATS-01, STATS-02]', () => {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = `
      <div id="statAccuracyVal"></div>
      <div id="statTotalAnswered"></div>
      <div id="statMistakesActive"></div>
      <div id="statExamsCompleted"></div>
      <div id="categoryStatsBars"></div>
      <h4 id="statsInsightTitle"></h4>
      <p id="statsInsightDesc"></p>
    `;

    const vm = renderStatsView({
      document,
      userStats: {
        totalAnswered: 20,
        totalCorrect: 15,
        examsCompleted: 2,
        categoryStats: {
          'משוב, הערכה ורפלקציה': { correct: 2, total: 5 },
          'אתיקה, חוק ובטיחות המטופל': { correct: 13, total: 15 },
        },
      },
      mistakes: new Set(['q_001', 'q_002', 'q_003']),
      allQuestions: [],
    });

    assert.equal(document.getElementById('statAccuracyVal').textContent, '75%');
    assert.equal(document.getElementById('statTotalAnswered').textContent, '20');
    assert.equal(document.getElementById('statMistakesActive').textContent, '3');
    assert.equal(document.getElementById('statExamsCompleted').textContent, '2');

    const bars = document.querySelectorAll('#categoryStatsBars .cat-bar-item');
    assert.equal(bars.length, 6);
    assert.equal(vm.accuracyPct, 75);
    assert.ok(document.getElementById('statsInsightDesc').textContent.includes('40%'));
  });
});
