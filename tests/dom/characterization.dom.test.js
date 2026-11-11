import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { mountApplication } from '../../app/js/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function resolveIndexHtmlPath() {
  const appIndex = path.join(repoRoot, 'app', 'index.html');
  if (fs.existsSync(appIndex)) {
    return appIndex;
  }
  return path.join(repoRoot, 'index.html');
}

// Cache questions once across tests for fast execution
let cachedQuestions = null;
function getSampleQuestions() {
  if (cachedQuestions) return cachedQuestions;
  const appJson = path.join(repoRoot, 'app', 'data', 'questions.json');
  if (fs.existsSync(appJson)) {
    const parsed = JSON.parse(fs.readFileSync(appJson, 'utf8'));
    cachedQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
    return cachedQuestions;
  }
  const pipelineJson = path.join(repoRoot, 'data-pipeline', 'source', 'clean_questions.json');
  const cleanJson = fs.existsSync(pipelineJson)
    ? pipelineJson
    : path.join(repoRoot, 'data', 'clean_questions.json');
  cachedQuestions = JSON.parse(fs.readFileSync(cleanJson, 'utf8'));
  return cachedQuestions;
}

/**
 * Boots the application inside a fresh happy-dom Window instance using `mountApplication`.
 */
function createAppTestEnv() {
  const htmlPath = resolveIndexHtmlPath();
  const rawHtml = fs.readFileSync(htmlPath, 'utf8');

  // Strip external <script> tags before document.write
  const htmlWithoutScripts = rawHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const window = new Window({
    url: 'http://127.0.0.1:4173/',
    width: 1440,
    height: 900,
    settings: {
      enableJavaScriptEvaluation: true,
      suppressCodeGenerationFromStringsWarning: true,
    },
  });

  const document = window.document;
  document.write(htmlWithoutScripts);

  // Stub confirm / alert so flows can be tested without blocking
  const dialogs = { alerts: [], confirms: [] };
  window.alert = (msg) => {
    dialogs.alerts.push(msg);
  };
  window.confirm = (msg) => {
    dialogs.confirms.push(msg);
    return true;
  };
  globalThis.confirm = window.confirm;

  // Stub clipboard
  let clipboardText = '';
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text) => {
        clipboardText = text;
      },
      readText: async () => clipboardText,
    },
  });

  const questions = getSampleQuestions();
  window.EXAM_QUESTIONS = questions;

  mountApplication({
    window,
    document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    navigator: window.navigator,
    preloadedQuestions: questions,
    confirmAction: (opts) => {
      dialogs.confirms.push(typeof opts === 'string' ? opts : opts?.message || '');
      return true;
    },
  });

  return {
    window,
    document,
    dialogs,
    getClipboardText: () => clipboardText,
  };
}

describe('Characterization Safety Net (DOM User Flows)', () => {
  let env;

  beforeEach(() => {
    env = createAppTestEnv();
  });

  it('initializes with 1,079 questions in active pool and renders Exam Setup screen [DATA-01, NAV-01]', () => {
    const { document } = env;
    const headerCount = document.getElementById('totalQuestionsHeader').textContent;
    assert.ok(headerCount.includes('1079'), `Expected 1079 in header, got: ${headerCount}`);

    const setupScreen = document.getElementById('screenExamSetup');
    assert.equal(setupScreen.classList.contains('active'), true);
  });

  it('switches cleanly across all 4 tabs and synchronizes desktop + mobile navigation [NAV-01, NAV-02, NAV-03, NAV-04]', () => {
    const { window, document } = env;

    const tabs = [
      { id: 'study', screen: 'screenStudyMode', topBtn: 'tabStudy', bNav: 'bNavStudy' },
      {
        id: 'saved-exams',
        screen: 'screenSavedExams',
        topBtn: 'tabSavedExams',
        bNav: 'bNavSaved',
      },
      { id: 'stats', screen: 'screenStats', topBtn: 'tabStats', bNav: 'bNavStats' },
      { id: 'exam', screen: 'screenExamSetup', topBtn: 'tabExam', bNav: 'bNavExam' },
    ];

    for (const t of tabs) {
      window.switchTab(t.id);
      assert.equal(document.getElementById(t.screen).classList.contains('active'), true);
      assert.equal(document.getElementById(t.topBtn).classList.contains('active'), true);
      assert.equal(document.getElementById(t.bNav).classList.contains('active'), true);
      assert.ok(document.getElementById('mobileSectionText').textContent.trim().length > 0);
    }
  });

  it('runs complete Exam Mode lifecycle: start -> select -> eliminate -> flag -> quick-grid -> submit -> results [EXAM-01..09]', () => {
    const { window, document } = env;

    // 1. Start a 10-question exam
    const count10Radio = document.querySelector('input[name="examCount"][value="10"]');
    count10Radio.checked = true;
    window.startExam();

    assert.equal(document.getElementById('screenActiveExam').classList.contains('active'), true);
    assert.match(document.getElementById('examProgressCount').textContent, /1 מתוך 10/);

    // 2. Select option 0, then eliminate option 0 (should clear selection)
    window.selectExamOption(0);
    assert.match(document.getElementById('examAnsweredCount').textContent, /נענו: 1/);

    window.toggleEliminateExamOption(0);
    assert.match(document.getElementById('examAnsweredCount').textContent, /נענו: 0/);

    // 3. Select option 1 and flag question
    window.selectExamOption(1);
    window.toggleExamFlag();
    assert.equal(document.getElementById('examFlagBtn').classList.contains('flagged'), true);

    // 4. Jump to question index 9 (last question) via Quick Grid
    window.jumpToExamQuestion(9);
    assert.match(document.getElementById('examProgressCount').textContent, /10 מתוך 10/);

    // 5. Submit exam and verify Results screen
    window.confirmSubmitExam();
    assert.equal(document.getElementById('screenExamResults').classList.contains('active'), true);
    assert.equal(document.getElementById('resTotalCount').textContent, '10');

    const reviewHtml = document.getElementById('examReviewList').innerHTML;
    assert.ok(reviewHtml.includes('expl-rationale-block'));
    assert.ok(reviewHtml.includes('expl-distractors-block'));
    assert.ok(!reviewHtml.includes('• מקור בספרות'));
  });

  it('runs Study Mode lifecycle: filter -> immediate feedback -> explanation -> Copy for AI without alerts [STUDY-01..05]', async () => {
    const { window, document, dialogs, getClipboardText } = env;

    window.switchTab('study');
    assert.equal(document.getElementById('screenStudyMode').classList.contains('active'), true);

    // Answer option 0
    window.answerStudyQuestion(0);
    const explBox = document.getElementById('studyExplanationBox');
    assert.equal(explBox.classList.contains('visible'), true);
    assert.ok(!explBox.innerHTML.includes('• מקור בספרות'));

    // Copy question for AI
    await window.copyCurrentStudyQuestionForAI();
    assert.equal(dialogs.alerts.length, 0, 'Must never trigger native alert()');
    assert.ok(getClipboardText().includes('מנהל הסיעוד'));
    assert.ok(document.getElementById('appGlobalToast').textContent.includes('הועתקו בהצלחה'));
  });

  it('manages Saved Exams quarantine lifecycle: reserve -> pool decreases -> start -> submit -> release [SAVED-01..05]', () => {
    const { window, document } = env;

    window.switchTab('saved-exams');
    const select = document.getElementById('savedExamSourceSelect');
    assert.ok(select.options.length > 0, 'Should have full exams available to save');

    // Reserve first available full exam
    window.addSelectedExamToSavedZone();
    assert.equal(document.getElementById('savedSlotsCount').textContent, '1 / 3');
    const quarantined = Number(document.getElementById('savedQuarantinedCount').textContent);
    assert.ok(quarantined >= 50, `Expected >= 50 quarantined questions, got ${quarantined}`);

    const expectedActive = 1079 - quarantined;
    assert.ok(
      document.getElementById('totalQuestionsHeader').textContent.includes(String(expectedActive))
    );

    // Start the saved exam via its DOM button, submit it, and release it back to the pool from results
    const startBtn = document.querySelector('#savedExamsList .saved-slot-card .btn-primary');
    assert.ok(startBtn, 'Saved slot card should have a start exam button');
    startBtn.click();
    assert.equal(document.getElementById('screenActiveExam').classList.contains('active'), true);

    window.submitExam();
    assert.equal(document.getElementById('screenExamResults').classList.contains('active'), true);
    window.releaseSavedExamFromResults();

    assert.equal(document.getElementById('savedSlotsCount').textContent, '0 / 3');
    assert.ok(document.getElementById('totalQuestionsHeader').textContent.includes('1079'));
  });
});
