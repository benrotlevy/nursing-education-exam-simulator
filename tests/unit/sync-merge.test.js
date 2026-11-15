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

  it('removes a locally saved exam when remote brings a newer releasedSavedExams tombstone', () => {
    const slot = {
      id: 'saved_1000',
      sourceName: 'שחזור מבחן 2024',
      title: 'שחזור מבחן 2024',
      questionCount: 100,
      questionIds: ['q1'],
      savedAt: new Date(1000).toISOString(),
      status: 'READY',
    };

    const laptopLocal = {
      mistakes: new Set(),
      mistakeTimestamps: {},
      userStats: { totalAnswered: 0, totalCorrect: 0, examsCompleted: 0, categoryStats: {} },
      savedExams: [slot],
      releasedSavedExams: {},
    };

    const smartphoneRemote = {
      mistakes: [],
      mistakeTimestamps: {},
      userStats: { totalAnswered: 0, totalCorrect: 0, examsCompleted: 0, categoryStats: {} },
      savedExams: [],
      releasedSavedExams: {
        saved_1000: 2000,
        'שחזור מבחן 2024': 2000,
      },
    };

    const merged = mergeCloudAndLocalProgress(laptopLocal, smartphoneRemote);
    assert.equal(merged.savedExams.length, 0);
    assert.equal(merged.releasedSavedExams.saved_1000, 2000);
    assert.equal(merged.releasedSavedExams['שחזור מבחן 2024'], 2000);
  });

  it('keeps a re-saved exam when its savedAt timestamp is newer than a prior tombstone and prefers COMPLETED slots', () => {
    const olderReady = {
      id: 'saved_3000',
      sourceName: 'שחזור מבחן 2024',
      title: 'שחזור מבחן 2024',
      questionCount: 100,
      questionIds: ['q1'],
      savedAt: new Date(3000).toISOString(),
      status: 'READY',
    };
    const completedRemote = {
      ...olderReady,
      status: 'COMPLETED',
      score: 92,
      completedAt: new Date(4000).toISOString(),
    };

    const merged = mergeCloudAndLocalProgress(
      {
        savedExams: [olderReady],
        releasedSavedExams: { 'שחזור מבחן 2024': 2000 },
      },
      {
        savedExams: [completedRemote],
        releasedSavedExams: { 'שחזור מבחן 2024': 1500 },
      }
    );

    assert.equal(merged.savedExams.length, 1);
    assert.equal(merged.savedExams[0].status, 'COMPLETED');
    assert.equal(merged.savedExams[0].score, 92);
    assert.equal(merged.releasedSavedExams['שחזור מבחן 2024'], 2000);
  });
});
