import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { mountApplication } from '../../app/js/main.js';
import {
  copyTextToClipboard,
  fallbackCopyTextToClipboard,
} from '../../app/js/services/clipboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const rawHtml = fs
  .readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const parsedCatalog = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'app/data/questions.json'), 'utf8')
);
const sampleQuestions = Array.isArray(parsedCatalog) ? parsedCatalog : parsedCatalog.questions;

function createFullAppEnv() {
  const win = new Window({ url: 'http://127.0.0.1:4173/', width: 1440, height: 900 });
  win.document.write(rawHtml);

  let nativeConfirmCalled = false;
  let nativeAlertCalled = false;
  win.confirm = () => {
    nativeConfirmCalled = true;
    return false;
  };
  win.alert = () => {
    nativeAlertCalled = true;
  };

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
    wasNativeDialogCalled: () => nativeConfirmCalled || nativeAlertCalled,
  };
}

describe('Step 11 Behavioral Fixes — Accessible <dialog>, Timestamped Sync & Clipboard (EXAM-08, SAVED-05, STATS-04, SYNC-02, SYNC-03)', () => {
  it('uses accessible <dialog> instead of native confirm() for unanswered exam submission and respects Cancel vs Confirm [EXAM-08]', async () => {
    const { document, app, wasNativeDialogCalled } = createFullAppEnv();

    app.examController.startExam();
    assert.equal(app.store.getState().activeExamScreen, 'ACTIVE');

    // Trigger confirmSubmitExam with 0/10 answered -> opens <dialog>
    const cancelPromise = app.examController.confirmSubmitExam();
    const dialogEl = document.getElementById('appModalDialog');
    assert.ok(dialogEl, 'Expected #appModalDialog to be mounted');
    assert.ok(dialogEl.hasAttribute('open'), 'Expected #appModalDialog to be open');
    assert.ok(
      document.getElementById('appModalDialogBody').textContent.includes('0 מתוך 10'),
      'Expected unanswered count in dialog message'
    );

    // Click Cancel -> remains in ACTIVE exam
    document.getElementById('appModalCancelBtn').click();
    const cancelResult = await cancelPromise;
    assert.equal(cancelResult, false);
    assert.equal(app.store.getState().activeExamScreen, 'ACTIVE');

    // Trigger confirmSubmitExam again and click Confirm -> transitions to RESULTS
    const confirmPromise = app.examController.confirmSubmitExam();
    document.getElementById('appModalConfirmBtn').click();
    const confirmResult = await confirmPromise;
    assert.equal(confirmResult, true);
    assert.equal(app.store.getState().activeExamScreen, 'RESULTS');
    assert.equal(wasNativeDialogCalled(), false, 'Must never invoke blocking window.confirm/alert');
  });

  it('uses accessible <dialog> for Stats Reset, records lastResetAt, and prevents stale Cloud Sync from resurrecting old stats or mistakes [STATS-04, SYNC-02, SYNC-03]', async () => {
    const { document, app, wasNativeDialogCalled } = createFullAppEnv();

    // Seed mistakes and stats
    const q1 = sampleQuestions[0].id;
    app.store.setState({
      mistakes: new Set([q1]),
      mistakeTimestamps: { [q1]: { updatedAt: 1000, removed: false } },
      userStats: {
        totalAnswered: 50,
        totalCorrect: 35,
        examsCompleted: 5,
        lastResetAt: 0,
        categoryStats: {},
      },
    });

    // Open Reset Stats confirmation dialog and click Confirm
    const resetPromise = app.statsController.confirmResetStats();
    const confirmBtn = document.getElementById('appModalConfirmBtn');
    assert.ok(
      confirmBtn.classList.contains('btn-danger'),
      'Expected danger styling on reset confirm button'
    );
    confirmBtn.click();
    const resetDone = await resetPromise;
    assert.equal(resetDone, true);

    const stateAfterReset = app.store.getState();
    assert.equal(stateAfterReset.mistakes.size, 0);
    assert.equal(stateAfterReset.userStats.totalAnswered, 0);
    assert.ok(stateAfterReset.userStats.lastResetAt > 1000);

    // Now simulate a stale remote cloud document arriving with pre-reset stats and mistakes
    app.cloudSync.applyRemotePayload({
      schemaVersion: 2,
      mistakes: [q1],
      mistakeTimestamps: { [q1]: { updatedAt: 1000, removed: false } },
      userStats: {
        totalAnswered: 50,
        totalCorrect: 35,
        examsCompleted: 5,
        lastResetAt: 0,
        categoryStats: {},
      },
      savedExams: [],
    });

    const stateAfterStaleSync = app.store.getState();
    assert.equal(
      stateAfterStaleSync.mistakes.size,
      0,
      'Pre-reset mistakes must not be resurrected by stale cloud payload'
    );
    assert.equal(
      stateAfterStaleSync.userStats.totalAnswered,
      0,
      'Pre-reset stats must not overwrite newer reset'
    );
    assert.equal(wasNativeDialogCalled(), false);
  });

  it('prevents zombie mistakes when a mistake is answered correctly in Study Mode and merged with a stale cloud snapshot [SYNC-02]', () => {
    const { app } = createFullAppEnv();

    const firstStudyQ = app.store.getState().currentStudy.questions[0];
    assert.ok(firstStudyQ);

    // Seed firstStudyQ.id as an older mistake at t=1000
    app.store.setState({
      mistakes: new Set([firstStudyQ.id]),
      mistakeTimestamps: { [firstStudyQ.id]: { updatedAt: 1000, removed: false } },
    });

    // Answer the question correctly in Study Mode
    const shuffled = app.store.getState().currentStudy.shuffledOptionsCache[0];
    app.studyController.answerStudyQuestion(shuffled.correctIndex);

    assert.equal(
      app.store.getState().mistakes.has(firstStudyQ.id),
      false,
      'Answering correctly in Study Mode should remove question from mistakes'
    );
    assert.equal(
      app.store.getState().mistakeTimestamps[firstStudyQ.id]?.removed,
      true,
      'Removal tombstone must be recorded'
    );

    // Simulate stale cloud snapshot where firstStudyQ.id was still a mistake at t=1000
    app.cloudSync.applyRemotePayload({
      schemaVersion: 2,
      mistakes: [firstStudyQ.id],
      mistakeTimestamps: { [firstStudyQ.id]: { updatedAt: 1000, removed: false } },
      userStats: app.store.getState().userStats,
      savedExams: [],
    });

    assert.equal(
      app.store.getState().mistakes.has(firstStudyQ.id),
      false,
      'Resolved mistake must NOT be resurrected by stale cloud snapshot'
    );
  });

  it('copies text via async clipboard API and falls back cleanly to off-screen textarea when clipboard API rejects [STUDY-05]', async () => {
    const win = new Window();
    win.document.write('<!DOCTYPE html><html><body></body></html>');

    let written = '';
    const okPrimary = await copyTextToClipboard('טקסט בדיקה 1', {
      navigator: {
        clipboard: {
          writeText: async (t) => {
            written = t;
          },
        },
      },
      document: win.document,
    });
    assert.equal(okPrimary, true);
    assert.equal(written, 'טקסט בדיקה 1');

    // Test fallback when navigator.clipboard.writeText throws (e.g. mobile WebView permissions)
    const okFallback = await copyTextToClipboard('טקסט בדיקה 2', {
      navigator: {
        clipboard: {
          writeText: async () => {
            throw new Error('NotAllowedError');
          },
        },
      },
      document: win.document,
    });
    assert.equal(okFallback, true);
    assert.equal(fallbackCopyTextToClipboard('טקסט בדיקה 3', win.document), true);
  });
});
