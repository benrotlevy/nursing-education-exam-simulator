import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordMistakeAddition,
  recordMistakeRemoval,
  mergeCloudAndLocalProgress,
} from '../../app/js/domain/sync-merge.js';

describe('app/js/domain/sync-merge.js — Timestamped Mistake Deletion & Reset Propagation (SYNC-02, SYNC-03)', () => {
  it('resolves mistake additions and removals by per-item updatedAt timestamp without zombie mistakes [SYNC-02]', () => {
    // Device A had q_001 and q_002 added at t=1000, then answered q_001 correctly at t=2000 (removed)
    let mistakesA = new Set();
    let tsA = {};
    ({ mistakes: mistakesA, mistakeTimestamps: tsA } = recordMistakeAddition(
      mistakesA,
      tsA,
      'q_001',
      1000
    ));
    ({ mistakes: mistakesA, mistakeTimestamps: tsA } = recordMistakeAddition(
      mistakesA,
      tsA,
      'q_002',
      1000
    ));
    ({ mistakes: mistakesA, mistakeTimestamps: tsA } = recordMistakeRemoval(
      mistakesA,
      tsA,
      'q_001',
      2000
    ));

    // Stale remote cloud document still lists q_001 as an active mistake at t=1000, plus a new mistake q_003 at t=2500
    const remote = {
      mistakes: ['q_001', 'q_002', 'q_003'],
      mistakeTimestamps: {
        q_001: { updatedAt: 1000, removed: false },
        q_002: { updatedAt: 1000, removed: false },
        q_003: { updatedAt: 2500, removed: false },
      },
      userStats: { totalAnswered: 10, totalCorrect: 7, examsCompleted: 1, lastResetAt: 0 },
    };

    const merged = mergeCloudAndLocalProgress(
      {
        mistakes: mistakesA,
        mistakeTimestamps: tsA,
        userStats: { totalAnswered: 12, totalCorrect: 9, examsCompleted: 1, lastResetAt: 0 },
      },
      remote
    );

    // q_001 MUST stay removed (not resurrected!), while q_002 and q_003 remain active
    assert.equal(merged.mistakes.has('q_001'), false);
    assert.equal(merged.mistakes.has('q_002'), true);
    assert.equal(merged.mistakes.has('q_003'), true);
    assert.equal(merged.userStats.totalAnswered, 12);
    assert.equal(merged.userStats.totalCorrect, 9);
  });

  it('propagates userStats.lastResetAt across devices and discards pre-reset mistakes and counters [SYNC-03]', () => {
    const staleRemote = {
      mistakes: ['q_010', 'q_020'],
      mistakeTimestamps: {
        q_010: { updatedAt: 1000, removed: false },
        q_020: { updatedAt: 1500, removed: false },
      },
      userStats: {
        totalAnswered: 150,
        totalCorrect: 120,
        examsCompleted: 5,
        lastResetAt: 0,
        categoryStats: { 'משוב, הערכה ורפלקציה': { correct: 20, total: 25 } },
      },
    };

    // User reset stats locally at t=5000
    const freshlyResetLocal = {
      mistakes: new Set(),
      mistakeTimestamps: {},
      userStats: {
        totalAnswered: 0,
        totalCorrect: 0,
        examsCompleted: 0,
        lastResetAt: 5000,
        categoryStats: {},
      },
    };

    const merged = mergeCloudAndLocalProgress(freshlyResetLocal, staleRemote);
    assert.equal(merged.mistakes.size, 0);
    assert.equal(merged.userStats.totalAnswered, 0);
    assert.equal(merged.userStats.totalCorrect, 0);
    assert.equal(merged.userStats.examsCompleted, 0);
    assert.equal(merged.userStats.lastResetAt, 5000);
  });
});
