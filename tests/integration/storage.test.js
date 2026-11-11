import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStorageAdapter } from '../../app/js/core/storage.js';
import { STORAGE_KEYS } from '../../app/js/config.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

const sampleQuestions = [
  { id: 'q_001', question: 'שאלה 1', options: ['א', 'ב', 'ג', 'ד'], correctIndex: 0 },
  { id: 'q_002', question: 'שאלה 2', options: ['א', 'ב', 'ג', 'ד'], correctIndex: 1 },
];

describe('app/js/core/storage.js — Persistence & Corrupt-JSON Resilience (SYNC-01, EXAM-10)', () => {
  it('saves and restores progress under nursing_progress_v2 including mistakes Set and userStats [SYNC-01]', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const storage = createStorageAdapter({ localStorage, sessionStorage });

    storage.saveProgress({
      mistakes: new Set(['q_001', 'q_002']),
      mistakeTimestamps: { q_001: { addedAt: 1700000000000 } },
      savedExams: [{ id: 'saved_1', sourceName: 'שחזור 2023', questionCount: 100 }],
      userStats: {
        totalAnswered: 20,
        totalCorrect: 16,
        examsCompleted: 2,
        lastResetAt: 1700000005000,
        categoryStats: { 'משוב, הערכה ורפלקציה': { correct: 8, total: 10 } },
      },
    });

    const loaded = storage.loadProgress();
    assert.equal(loaded.schemaVersion, 2);
    assert.deepStrictEqual(Array.from(loaded.mistakes), ['q_001', 'q_002']);
    assert.equal(loaded.mistakeTimestamps.q_001.addedAt, 1700000000000);
    assert.equal(loaded.savedExams.length, 1);
    assert.equal(loaded.userStats.totalAnswered, 20);
    assert.equal(loaded.userStats.lastResetAt, 1700000005000);
  });

  it('survives corrupt JSON in localStorage and sessionStorage without throwing [SYNC-01]', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    localStorage.setItem(STORAGE_KEYS.PROGRESS, '{corrupt_json:::');
    sessionStorage.setItem(STORAGE_KEYS.EXAM_SESSION, '{not_valid_json');
    sessionStorage.setItem(STORAGE_KEYS.STUDY_SESSION, '<<<invalid>>>');

    const storage = createStorageAdapter({ localStorage, sessionStorage });
    const progress = storage.loadProgress();
    assert.equal(progress.schemaVersion, 2);
    assert.equal(progress.mistakes.size, 0);
    assert.equal(storage.loadExamSession(sampleQuestions), null);
    assert.equal(storage.loadStudySession(sampleQuestions), null);
  });

  it('serializes and restores active exam session including flagged Set and eliminated Sets [EXAM-10]', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const storage = createStorageAdapter({ localStorage, sessionStorage });

    storage.saveExamSession('ACTIVE', {
      isSavedExam: false,
      questions: sampleQuestions,
      currentIndex: 1,
      userAnswers: { 0: 2 },
      flagged: new Set([1]),
      eliminated: { 0: new Set([1, 3]) },
      shuffledOptionsCache: {
        0: { options: ['א', 'ב', 'ג', 'ד'], correctIndex: 0 },
      },
    });

    const restored = storage.loadExamSession(sampleQuestions);
    assert.ok(restored);
    assert.equal(restored.activeExamScreen, 'ACTIVE');
    assert.equal(restored.currentExam.currentIndex, 1);
    assert.equal(restored.currentExam.userAnswers[0], 2);
    assert.equal(restored.currentExam.flagged.has(1), true);
    assert.equal(restored.currentExam.eliminated[0].has(1), true);
    assert.equal(restored.currentExam.eliminated[0].has(3), true);
  });

  it('persists and restores study session and active tab', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const storage = createStorageAdapter({ localStorage, sessionStorage });

    storage.saveStudySession({
      questions: sampleQuestions,
      currentIndex: 1,
      mistakesOnly: true,
      selectedCategory: 'משוב, הערכה ורפלקציה',
      userAnswers: { 0: 1 },
      shuffledOptionsCache: {},
    });

    const restoredStudy = storage.loadStudySession(sampleQuestions);
    assert.ok(restoredStudy);
    assert.equal(restoredStudy.currentIndex, 1);
    assert.equal(restoredStudy.mistakesOnly, true);
    assert.equal(restoredStudy.selectedCategory, 'משוב, הערכה ורפלקציה');

    storage.saveActiveTab('saved-exams');
    assert.equal(storage.loadActiveTab(), 'saved-exams');
  });
});
