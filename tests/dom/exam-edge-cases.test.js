import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { mountApplication } from '../../app/js/main.js';
import { renderExamResultsView } from '../../app/js/features/exam/exam-view.js';
import { STORAGE_KEYS } from '../../app/js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const rawHtml = fs
  .readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const catalogData = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'app/data/questions.json'), 'utf8')
);
const allQuestions = Array.isArray(catalogData) ? catalogData : catalogData.questions;

function createTestDOM(initialSessionStorage = {}) {
  const win = new Window({
    url: 'http://127.0.0.1:4173/',
    width: 1440,
    height: 900,
  });
  win.document.write(rawHtml);

  for (const [k, v] of Object.entries(initialSessionStorage)) {
    win.sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  const app = mountApplication({
    window: win,
    document: win.document,
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    navigator: win.navigator,
    preloadedQuestions: allQuestions,
  });

  return {
    win,
    document: win.document,
    sessionStorage: win.sessionStorage,
    app,
  };
}

describe('Exam Flow Edge Cases & Lifecycle Verification (EXAM-11..13, PERF-01)', () => {
  describe('EXAM-11: Active Exam Abandonment Lifecycle & Storage Purge', () => {
    it('provides #btnAbandonExam button in the active exam screen header [EXAM-11 element existence]', () => {
      const { document, app } = createTestDOM();
      app.examController.startExam();
      assert.equal(app.store.getState().activeExamScreen, 'ACTIVE');

      const abandonBtn = document.querySelector('#btnAbandonExam');
      assert.ok(
        abandonBtn,
        'Expected #btnAbandonExam element with id="btnAbandonExam" to exist in app/index.html'
      );
    });

    it('mounts app, starts exam, answers 3 questions, confirms abandon, purges storage, and resets view to SETUP [EXAM-11 lifecycle]', async () => {
      const { document, sessionStorage, app } = createTestDOM();

      // 1. Start a 10-question exam
      const count10Radio = document.querySelector('input[name="examCount"][value="10"]');
      if (count10Radio) count10Radio.checked = true;
      app.examController.startExam();
      assert.equal(app.store.getState().activeExamScreen, 'ACTIVE');

      // 2. Answer 3 questions
      // Question 0
      app.examController.selectExamOption(0);
      app.examController.nextExamQuestion();
      // Question 1
      app.examController.selectExamOption(1);
      app.examController.nextExamQuestion();
      // Question 2
      app.examController.selectExamOption(2);

      // Verify 3 answered and session persisted in sessionStorage
      const activeState = app.store.getState();
      assert.equal(Object.keys(activeState.currentExam.userAnswers).length, 3);
      assert.ok(
        sessionStorage.getItem(STORAGE_KEYS.EXAM_SESSION),
        'Expected active exam session to be persisted in sessionStorage'
      );

      // 3. Trigger abandon exam
      const abandonBtn =
        document.querySelector('#btnAbandonExam') ||
        document.querySelector('.btn-abandon-exam') ||
        document.querySelector('[data-action="confirm-abandon-exam"]');
      assert.ok(abandonBtn, 'Expected abandon button element to exist');
      abandonBtn.click();

      // 4. Assert #appModalDialog opens with confirmation message
      const modalDialog = document.getElementById('appModalDialog');
      assert.ok(modalDialog, 'Expected #appModalDialog to exist');
      assert.ok(
        modalDialog.hasAttribute('open'),
        'Expected #appModalDialog to have [open] attribute'
      );
      const dialogBody = document.getElementById('appModalDialogBody');
      assert.ok(
        dialogBody.textContent.includes('האם ברצונך לצאת מהמבחן הנוכחי'),
        'Expected confirmation message about abandoning active exam'
      );

      // Cancel first -> verify user remains in active exam
      const cancelBtn = document.getElementById('appModalCancelBtn');
      assert.ok(cancelBtn, 'Expected cancel button in dialog');
      cancelBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(app.store.getState().activeExamScreen, 'ACTIVE');
      assert.equal(Object.keys(app.store.getState().currentExam.userAnswers).length, 3);

      // Trigger abandon again and click Confirm
      abandonBtn.click();
      assert.ok(modalDialog.hasAttribute('open'));
      const confirmBtn = document.getElementById('appModalConfirmBtn');
      assert.ok(confirmBtn, 'Expected confirm button in dialog');
      confirmBtn.click();
      await new Promise((r) => setTimeout(r, 10));

      // 5. Assert sessionStorage item is deleted (both STPR spec name and config key)
      assert.equal(
        sessionStorage.getItem('nursing_active_exam_v2'),
        null,
        'Expected sessionStorage item nursing_active_exam_v2 to be deleted/null'
      );
      assert.equal(
        sessionStorage.getItem(STORAGE_KEYS.EXAM_SESSION),
        null,
        `Expected sessionStorage item ${STORAGE_KEYS.EXAM_SESSION} to be deleted`
      );

      // 6. Assert view returns to SETUP
      assert.equal(app.store.getState().activeExamScreen, 'SETUP');
      const setupScreen = document.getElementById('screenExamSetup');
      assert.ok(setupScreen.classList.contains('active'), 'Expected #screenExamSetup to be active');
      const activeScreen = document.getElementById('screenActiveExam');
      assert.equal(
        activeScreen.classList.contains('active'),
        false,
        'Expected #screenActiveExam to be inactive'
      );

      // 7. Assert question counter resets to default
      const checkedRadio = document.querySelector('input[name="examCount"]:checked');
      assert.equal(checkedRadio?.value, '10', 'Expected examCount radio to default to 10');
      assert.match(
        document.getElementById('mobileSectionText').textContent,
        /הגדרת תרגול/,
        'Expected mobile section text to reflect exam setup'
      );
      assert.equal(app.store.getState().currentExam.questions.length, 0);
      assert.equal(app.store.getState().currentExam.currentIndex, 0);
    });
  });

  describe('EXAM-12: "Retry Wrong Questions Only" Sub-Exam Generation & 100% Toast Guard', () => {
    it('completes exam with 3 correct and 2 wrong, clicks #btnRetryWrong, and starts new sub-exam with exactly the 2 wrong question IDs [Scenario A]', () => {
      const { document, app } = createTestDOM();
      const sample = allQuestions.slice(0, 5);

      app.store.setState({
        activeExamScreen: 'ACTIVE',
        currentExam: {
          isSavedExam: false,
          savedExamId: null,
          savedExamTitle: null,
          questions: sample,
          currentIndex: 0,
          userAnswers: {},
          flagged: new Set(),
          eliminated: {},
          shuffledOptionsCache: {
            0: { options: sample[0].options, correctIndex: 0 },
            1: { options: sample[1].options, correctIndex: 1 },
            2: { options: sample[2].options, correctIndex: 2 },
            3: { options: sample[3].options, correctIndex: 3 },
            4: { options: sample[4].options, correctIndex: 0 },
          },
        },
      });

      // Answer 3 correct (indices 0, 1, 2) and 2 wrong (indices 3, 4)
      app.examController.jumpToExamQuestion(0);
      app.examController.selectExamOption(0); // correct

      app.examController.jumpToExamQuestion(1);
      app.examController.selectExamOption(1); // correct

      app.examController.jumpToExamQuestion(2);
      app.examController.selectExamOption(2); // correct

      app.examController.jumpToExamQuestion(3);
      app.examController.selectExamOption(0); // wrong (correct is 3)

      app.examController.jumpToExamQuestion(4);
      app.examController.selectExamOption(1); // wrong (correct is 0)

      // Submit exam -> transitions to RESULTS
      app.examController.submitExam();
      assert.equal(app.store.getState().activeExamScreen, 'RESULTS');
      assert.ok(
        document.getElementById('screenExamResults').classList.contains('active'),
        'Expected Results screen to be active'
      );
      assert.equal(document.getElementById('resScoreVal').textContent, '60%');
      assert.equal(document.getElementById('resCorrectCount').textContent, '3');
      assert.equal(document.getElementById('resWrongCount').textContent, '2');

      // Click #btnRetryWrong
      const retryBtn = document.getElementById('btnRetryWrong');
      assert.ok(retryBtn, 'Expected #btnRetryWrong button to exist on results screen');
      retryBtn.click();

      // Assert new sub-exam session started in ACTIVE screen
      const retryState = app.store.getState();
      assert.equal(retryState.activeExamScreen, 'ACTIVE');
      assert.ok(
        document.getElementById('screenActiveExam').classList.contains('active'),
        'Expected screenActiveExam to become active'
      );

      // Assert new exam session starts with exactly the 2 wrong question IDs
      assert.equal(retryState.currentExam.questions.length, 2);
      const retryQuestionIds = new Set(retryState.currentExam.questions.map((q) => q.id));
      assert.equal(
        retryQuestionIds.has(sample[3].id),
        true,
        `Expected wrong question ${sample[3].id} in sub-exam`
      );
      assert.equal(
        retryQuestionIds.has(sample[4].id),
        true,
        `Expected wrong question ${sample[4].id} in sub-exam`
      );
      assert.equal(retryQuestionIds.has(sample[0].id), false);
      assert.equal(retryQuestionIds.has(sample[1].id), false);
      assert.equal(retryQuestionIds.has(sample[2].id), false);
    });

    it('completes exam with 5/5 correct (100%), clicks #btnRetryWrong, asserts toast shows "אין שאלות שגויות לתרגול חוזר!" and no active exam starts [Scenario B]', () => {
      const { document, app } = createTestDOM();
      const sample = allQuestions.slice(0, 5);

      app.store.setState({
        activeExamScreen: 'ACTIVE',
        currentExam: {
          isSavedExam: false,
          savedExamId: null,
          savedExamTitle: null,
          questions: sample,
          currentIndex: 0,
          userAnswers: {},
          flagged: new Set(),
          eliminated: {},
          shuffledOptionsCache: {
            0: { options: sample[0].options, correctIndex: 0 },
            1: { options: sample[1].options, correctIndex: 1 },
            2: { options: sample[2].options, correctIndex: 2 },
            3: { options: sample[3].options, correctIndex: 3 },
            4: { options: sample[4].options, correctIndex: 0 },
          },
        },
      });

      // Answer all 5 correctly (5/5 = 100%)
      for (let i = 0; i < 5; i++) {
        app.examController.jumpToExamQuestion(i);
        const correctIdx = app.store.getState().currentExam.shuffledOptionsCache[i].correctIndex;
        app.examController.selectExamOption(correctIdx);
      }

      // Submit exam
      app.examController.submitExam();
      assert.equal(app.store.getState().activeExamScreen, 'RESULTS');
      assert.equal(document.getElementById('resScoreVal').textContent, '100%');
      assert.equal(document.getElementById('resWrongCount').textContent, '0');

      // Click #btnRetryWrong
      const retryBtn = document.getElementById('btnRetryWrong');
      assert.ok(retryBtn, 'Expected #btnRetryWrong button on results screen');
      retryBtn.click();

      // Assert no active exam session is initiated (remains in RESULTS)
      assert.equal(
        app.store.getState().activeExamScreen,
        'RESULTS',
        'Should not start active exam when 0 wrong questions'
      );
      assert.ok(
        document.getElementById('screenExamResults').classList.contains('active'),
        'Results screen should remain active'
      );

      // Assert toast shows "אין שאלות שגויות לתרגול חוזר!"
      const toastEl = document.getElementById('appGlobalToast');
      assert.ok(toastEl, 'Expected toast container to exist');
      assert.equal(
        toastEl.textContent.trim(),
        'אין שאלות שגויות לתרגול חוזר!',
        'Expected toast notification text: "אין שאלות שגויות לתרגול חוזר!"'
      );
    });
  });

  describe('EXAM-13: Exam Results Screen State Hydration on Page Reload', () => {
    it('hydrates results cards, scores, and summary when page reloads on RESULTS screen without null pointer exceptions', () => {
      // Step 1: Simulate completing an exam and writing RESULTS session to sessionStorage
      const sample = allQuestions.slice(0, 10);
      const userAnswers = { 0: 0, 1: 1, 2: 2, 3: 0, 4: 0, 5: 1, 6: 2, 7: 3, 8: 0, 9: 1 };
      const shuffledCache = {};
      sample.forEach((q, idx) => {
        shuffledCache[idx] = { options: q.options, correctIndex: 0 };
      });

      const initialPayload = {
        schemaVersion: 2,
        activeExamScreen: 'RESULTS',
        isSavedExam: false,
        savedExamId: null,
        savedExamTitle: null,
        currentIndex: 9,
        userAnswers,
        flagged: [1, 5],
        eliminated: { 0: [1, 2] },
        questionIds: sample.map((q) => q.id),
        shuffledOptionsCache: shuffledCache,
      };

      // Step 2: Mount app with this saved session in sessionStorage (simulating reload)
      const { document, app } = createTestDOM({
        [STORAGE_KEYS.EXAM_SESSION]: initialPayload,
        [STORAGE_KEYS.ACTIVE_TAB]: 'exam',
      });

      // Step 3: Assert application hydrated to RESULTS screen without throwing TypeError
      assert.equal(
        app.store.getState().activeExamScreen,
        'RESULTS',
        'Expected activeExamScreen to hydrate to RESULTS'
      );
      const resultsScreen = document.getElementById('screenExamResults');
      assert.ok(
        resultsScreen.classList.contains('active'),
        'Expected #screenExamResults to have active class on page load'
      );

      // Step 4: Assert score summary elements are rendered properly
      const scoreVal = document.getElementById('resScoreVal');
      assert.ok(
        scoreVal && scoreVal.textContent.includes('%'),
        'Score percentage should be rendered'
      );
      const totalCount = document.getElementById('resTotalCount');
      assert.equal(totalCount?.textContent, '10', 'Total questions count should be 10');
      const titleMsg = document.getElementById('resTitleMsg');
      assert.ok(
        titleMsg && titleMsg.textContent.trim().length > 0,
        'Title message should not be empty'
      );

      // Step 5: Assert all 10 review cards are rendered with structured explanations and badges
      const reviewCards = document.querySelectorAll('#examReviewList .review-item');
      assert.equal(reviewCards.length, 10, 'Expected exactly 10 review cards to be hydrated');

      reviewCards.forEach((card, idx) => {
        assert.ok(card.innerHTML.includes('review-item-meta'), `Card ${idx} missing meta header`);
        assert.ok(
          card.innerHTML.includes('expl-rationale-block'),
          `Card ${idx} missing pedagogical rationale block`
        );
        assert.ok(
          card.classList.contains('was-correct') || card.classList.contains('was-wrong'),
          `Card ${idx} missing correctness styling class`
        );
      });
    });
  });

  describe('PERF-01: 100-Question Exam Results Batch Card Rendering Benchmark', () => {
    it('renders 100 exam review cards in under 300ms without crashing or jank', () => {
      const win = new Window({
        url: 'http://127.0.0.1:4173/',
        width: 1440,
        height: 900,
      });
      win.document.body.innerHTML = `
        <span id="resScoreVal"></span>
        <span id="resCorrectCount"></span>
        <span id="resWrongCount"></span>
        <span id="resTotalCount"></span>
        <h2 id="resTitleMsg"></h2>
        <div id="savedExamResultsBanner"></div>
        <div id="examReviewList"></div>
      `;

      const sample100 = allQuestions.slice(0, 100);
      assert.equal(sample100.length, 100, 'Need 100 questions for benchmark');

      const mock100Exam = {
        isSavedExam: false,
        savedExamId: null,
        savedExamTitle: null,
        questions: sample100,
        currentIndex: 99,
        userAnswers: Object.fromEntries(sample100.map((_, i) => [i, i % 4])),
        flagged: new Set([5, 15, 25, 50, 75]),
        eliminated: { 0: new Set([1]), 10: new Set([2, 3]) },
        shuffledOptionsCache: Object.fromEntries(
          sample100.map((q, i) => [i, { options: q.options, correctIndex: q.correctIndex }])
        ),
      };

      const startTime = performance.now();
      renderExamResultsView({
        document: win.document,
        exam: mock100Exam,
        scorePct: 70,
        correctCount: 70,
        total: 100,
      });
      const renderDurationMs = performance.now() - startTime;

      const reviewCards = win.document.querySelectorAll('#examReviewList .review-item');
      assert.equal(reviewCards.length, 100, 'Expected exactly 100 review cards to be generated');

      // Verify first and last card integrity
      assert.ok(
        reviewCards[0].innerHTML.includes('expl-rationale-block'),
        'Card 0 must contain pedagogical rationale'
      );
      assert.ok(
        reviewCards[99].innerHTML.includes('expl-rationale-block'),
        'Card 99 must contain pedagogical rationale'
      );

      // Verify benchmark: < 300ms
      assert.ok(
        renderDurationMs < 300,
        `Benchmark failed: 100 review cards rendered in ${renderDurationMs.toFixed(2)}ms (target: < 300ms)`
      );
    });
  });
});
