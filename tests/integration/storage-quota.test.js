import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorageAdapter } from '../../app/js/core/storage.js';
import { mountApplication } from '../../app/js/main.js';
import { STORAGE_KEYS } from '../../app/js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const rawHtml = fs
  .readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

describe('tests/integration/storage-quota.test.js — LocalStorage Quota Limit Fallback (STORE-01)', () => {
  it('catches DOMException QuotaExceededError on saveProgress without crashing [STORE-01]', () => {
    const mockLocalStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
      removeItem: () => {},
    };

    const storage = createStorageAdapter({ localStorage: mockLocalStorage });

    let threw = false;
    let result = null;
    try {
      result = storage.saveProgress({
        mistakes: new Set(['q_001']),
        mistakeTimestamps: {},
        savedExams: [],
        userStats: { totalAnswered: 1, totalCorrect: 1 },
      });
    } catch {
      threw = true;
    }

    assert.equal(threw, false, 'saveProgress must not throw an unhandled QuotaExceededError');
    assert.equal(typeof result === 'boolean', true);
  });

  it('falls back to in-memory cache when localStorage quota is exceeded so subsequent loads preserve session data [STORE-01]', () => {
    const memoryStore = null;
    const mockLocalStorage = {
      getItem: (key) => {
        if (key === STORAGE_KEYS.PROGRESS) return memoryStore;
        return null;
      },
      setItem: () => {
        // Quota exceeded: browser refuses writes to disk
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
      removeItem: () => {},
    };

    const storage = createStorageAdapter({ localStorage: mockLocalStorage });

    const newMistakes = new Set(['q_quota_1', 'q_quota_2']);
    const newUserStats = {
      totalAnswered: 5,
      totalCorrect: 3,
      examsCompleted: 1,
      lastResetAt: 1700000000000,
      categoryStats: {},
    };

    // Attempt saving when disk quota is exceeded
    storage.saveProgress({
      mistakes: newMistakes,
      mistakeTimestamps: { q_quota_1: { addedAt: 1700000000000 } },
      savedExams: [],
      userStats: newUserStats,
    });

    // Storage adapter must fall back to in-memory cache so subsequent reads within session reflect saved data
    const loaded = storage.loadProgress();
    assert.ok(loaded, 'loadProgress must return valid data from in-memory fallback');
    assert.deepStrictEqual(
      Array.from(loaded.mistakes),
      ['q_quota_1', 'q_quota_2'],
      'In-memory fallback cache must retain mistakes set across quota error'
    );
    assert.equal(
      loaded.userStats.totalAnswered,
      5,
      'In-memory fallback cache must retain userStats across quota error'
    );
  });

  it('displays user warning feedback when storage quota is exceeded during interactive usage [STORE-01]', () => {
    const win = new Window({ url: 'http://127.0.0.1:4173/' });
    win.document.write(rawHtml);

    // Mock localStorage to throw QuotaExceededError on any write
    win.localStorage.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };

    const sampleQuestions = [
      {
        id: 'q_test_1',
        category: 'אתיקה, חוק ובטיחות המטופל',
        source: 'מבחן 2023',
        question: 'שאלת בדיקה',
        options: ['א', 'ב', 'ג', 'ד'],
        correctIndex: 0,
      },
    ];

    const app = mountApplication({
      window: win,
      document: win.document,
      localStorage: win.localStorage,
      sessionStorage: win.sessionStorage,
      navigator: win.navigator,
      preloadedQuestions: sampleQuestions,
    });

    app.router.switchTab('study');

    // Answer question in study mode which triggers storage.saveProgress
    app.studyController.answerStudyQuestion(0);

    const toastEl = win.document.getElementById('appGlobalToast');
    const hasWarning =
      toastEl?.classList.contains('visible') &&
      (toastEl.textContent.includes('מקום') ||
        toastEl.textContent.includes('זיכרון') ||
        toastEl.textContent.includes('שמירה') ||
        toastEl.textContent.includes('אחסון') ||
        toastEl.textContent.includes('quota') ||
        toastEl.textContent.includes('אזהרה'));

    assert.equal(
      hasWarning,
      true,
      'User must be notified with a warning toast or message when storage quota prevents saving to disk'
    );
  });
});
