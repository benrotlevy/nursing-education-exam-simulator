import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { mountApplication } from '../../app/js/main.js';
import { releaseSavedExamSlot } from '../../app/js/domain/saved-exams.js';
import { STORAGE_KEYS } from '../../app/js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const rawHtml = fs
  .readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const sampleQuestions = [
  {
    id: 'q_valid_1',
    category: 'אתיקה, חוק ובטיחות המטופל',
    source: 'מבחן ממשלתי 2023 (שחזור חליל)',
    question: 'שאלת בדיקה 1',
    options: ['א', 'ב', 'ג', 'ד'],
    correctIndex: 0,
  },
  {
    id: 'q_valid_2',
    category: 'אתיקה, חוק ובטיחות המטופל',
    source: 'מבחן ממשלתי 2023 (שחזור חליל)',
    question: 'שאלת בדיקה 2',
    options: ['א', 'ב', 'ג', 'ד'],
    correctIndex: 1,
  },
];

function createSavedExamsAppEnv({ initialProgress = null } = {}) {
  const win = new Window({ url: 'http://127.0.0.1:4173/' });
  win.document.write(rawHtml);

  if (initialProgress !== null) {
    win.localStorage.setItem(
      STORAGE_KEYS.PROGRESS,
      typeof initialProgress === 'string' ? initialProgress : JSON.stringify(initialProgress)
    );
  }

  const app = mountApplication({
    window: win,
    document: win.document,
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    navigator: win.navigator,
    preloadedQuestions: sampleQuestions,
  });

  return {
    win,
    document: win.document,
    app,
  };
}

describe('tests/integration/saved-exams-defense.test.js — Saved Exams Corrupted Payload & Missing ID Defense (SAVED-06)', () => {
  it('recovers gracefully from malformed JSON in progress storage without bricking Saved Exams tab [SAVED-06]', () => {
    const { document, app } = createSavedExamsAppEnv({
      initialProgress: '<<<CORRUPT_NOT_JSON>>>',
    });

    app.router.switchTab('saved-exams');

    const state = app.store.getState();
    assert.ok(Array.isArray(state.savedExams), 'savedExams must default to an array');
    assert.equal(state.savedExams.length, 0);

    const listEl = document.getElementById('savedExamsList');
    assert.ok(listEl, 'savedExamsList element must exist');
    assert.match(
      listEl.innerHTML,
      /saved-empty-state/,
      'Saved Exams tab must cleanly render the empty state rather than bricking'
    );
    assert.equal(document.getElementById('savedSlotsCount').textContent, '0 / 3');
  });

  it('rejects reserving an exam with missing or empty source name and displays toast feedback [SAVED-06]', () => {
    const { document, app } = createSavedExamsAppEnv();

    app.router.switchTab('saved-exams');

    const select = document.getElementById('savedExamSourceSelect');
    select.innerHTML = '<option value="">בחר מבחן...</option>';
    select.value = '';

    const addBtn = document.querySelector('[data-action="add-saved-exam"]');
    assert.ok(addBtn);
    addBtn.click();

    const toastEl = document.getElementById('appGlobalToast');
    assert.ok(toastEl.classList.contains('visible'), 'Toast must be shown for missing source');
    assert.equal(toastEl.textContent, 'אנא בחר מבחן לשמירה.');
    assert.equal(app.store.getState().savedExams.length, 0);
  });

  it('fails gracefully with error toast when attempting to launch unknown savedExamId [SAVED-06]', () => {
    const { document, app } = createSavedExamsAppEnv();

    app.router.switchTab('saved-exams');

    const result = app.savedExamsController.startSavedExam('nonexistent_saved_id_999');
    assert.equal(result, false, 'startSavedExam must return false for unknown ID');

    const toastEl = document.getElementById('appGlobalToast');
    assert.ok(toastEl.classList.contains('visible'), 'Error toast must be displayed');
    assert.equal(toastEl.textContent, 'מבחן שמור לא נמצא.');
    assert.notEqual(
      app.store.getState().activeExamScreen,
      'ACTIVE',
      'Should not transition to active exam'
    );
  });

  it('handles corrupted saved exam payload with missing question source / unresolvable question IDs [SAVED-06]', () => {
    const corruptedPayload = {
      schemaVersion: 2,
      mistakes: [],
      mistakeTimestamps: {},
      savedExams: [
        {
          id: 'corrupted_slot_1',
          sourceName: 'מבחן שנמחק מהשרת',
          title: 'מבחן שנמחק מהשרת',
          questionCount: 2,
          questionIds: ['ghost_id_101', 'ghost_id_102'],
          savedAt: new Date().toISOString(),
          status: 'READY',
          score: null,
          completedAt: null,
        },
      ],
      userStats: {
        totalAnswered: 0,
        totalCorrect: 0,
        examsCompleted: 0,
        lastResetAt: 0,
        categoryStats: {},
      },
    };

    const { document, app } = createSavedExamsAppEnv({
      initialProgress: corruptedPayload,
    });

    app.router.switchTab('saved-exams');

    // Verify Saved Exams view rendered corrupted item card without crashing
    const listEl = document.getElementById('savedExamsList');
    assert.ok(listEl.querySelector('.saved-slot-card'), 'Slot card rendered defensively');
    assert.match(listEl.textContent, /מבחן שנמחק מהשרת/);

    // Attempt to launch the corrupted exam
    const launchBtn = listEl.querySelector('[data-action="start-saved-exam"]');
    assert.ok(launchBtn);
    launchBtn.click();

    // Verify failure handled with toast and app stability
    const toastEl = document.getElementById('appGlobalToast');
    assert.ok(toastEl.classList.contains('visible'));
    assert.equal(toastEl.textContent, 'שגיאה בטעינת שאלות המבחן השמור.');
    assert.notEqual(app.store.getState().activeExamScreen, 'ACTIVE');
  });

  it('defensively handles release of unknown exam ID and invalid releaseFromResults [SAVED-06]', () => {
    const { app } = createSavedExamsAppEnv();

    // Releasing an ID not in savedExams should not throw or crash
    const releasedNonexistent = app.savedExamsController.releaseSavedExam('unknown_id_404');
    assert.equal(releasedNonexistent, false);

    // Releasing from results when no saved exam is running
    const releasedFromResults = app.savedExamsController.releaseSavedExamFromResults();
    assert.equal(releasedFromResults, false);

    // Domain level release slot defensive test
    const domainRelease = releaseSavedExamSlot(null, 'any_id');
    assert.deepStrictEqual(domainRelease.savedExams, []);
    assert.equal(domainRelease.removedSlot, null);
  });
});
