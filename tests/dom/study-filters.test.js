import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { mountApplication } from '../../app/js/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const rawHtml = fs
  .readFileSync(path.join(ROOT_DIR, 'app/index.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

function createTestQuestions() {
  const questions = [];
  // 10 questions in Ethics category
  for (let i = 1; i <= 10; i++) {
    questions.push({
      id: `q_ethics_${i}`,
      category: 'אתיקה, חוק ובטיחות המטופל',
      source: 'מבחן 2023',
      question: `שאלת אתיקה מספר ${i}`,
      options: ['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד'],
      correctIndex: 0,
      detailedExplanation: `נימוק אתיקה ${i}`,
    });
  }
  // 5 questions in Feedback category
  for (let i = 1; i <= 5; i++) {
    questions.push({
      id: `q_feedback_${i}`,
      category: 'משוב, הערכה ורפלקציה',
      source: 'מבחן 2022',
      question: `שאלת משוב מספר ${i}`,
      options: ['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד'],
      correctIndex: 1,
      detailedExplanation: `נימוק משוב ${i}`,
    });
  }
  return questions;
}

function setupStudyDOMEnv(initialQuestions = createTestQuestions()) {
  const win = new Window({ url: 'http://127.0.0.1:4173/' });
  win.document.write(rawHtml);

  const app = mountApplication({
    window: win,
    document: win.document,
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    navigator: win.navigator,
    preloadedQuestions: initialQuestions,
  });

  app.router.switchTab('study');

  return {
    win,
    document: win.document,
    app,
  };
}

describe('tests/dom/study-filters.test.js — Study Filter Dynamic Re-indexing & DOM Reactive State (STUDY-07)', () => {
  it('dynamically changing studyCategoryFilter rebuilds active deck and resets counter to 1 [STUDY-07]', () => {
    const { win, document, app } = setupStudyDOMEnv();

    const catSelect = document.getElementById('studyCategoryFilter');
    const curIdxEl = document.getElementById('studyCurrentIndex');
    const totalCountEl = document.getElementById('studyTotalCount');
    const counterPill = document.querySelector('.study-progress-counter');

    // Initially ALL categories (15 questions)
    assert.equal(totalCountEl.textContent, '15');
    assert.equal(curIdxEl.textContent, '1');

    // Advance to question 3
    app.studyController.nextStudyQuestion();
    app.studyController.nextStudyQuestion();
    assert.equal(app.store.getState().currentStudy.currentIndex, 2);
    assert.equal(curIdxEl.textContent, '3');

    // Switch filter to Ethics category (10 questions)
    catSelect.value = 'אתיקה, חוק ובטיחות המטופל';
    catSelect.dispatchEvent(new win.Event('change', { bubbles: true }));

    const currentStudy = app.store.getState().currentStudy;
    assert.equal(currentStudy.selectedCategory, 'אתיקה, חוק ובטיחות המטופל');
    assert.equal(currentStudy.currentIndex, 0, 'Index must reset to 0 after filter change');
    assert.equal(currentStudy.questions.length, 10);
    assert.ok(
      currentStudy.questions.every((q) => q.category === 'אתיקה, חוק ובטיחות המטופל'),
      'All deck questions must match selected category'
    );

    // Counter pill DOM assertion
    assert.equal(curIdxEl.textContent, '1');
    assert.equal(totalCountEl.textContent, '10');
    const cleanCounterText = counterPill.textContent.trim().replace(/\s+/g, ' ');
    assert.match(cleanCounterText, /שאלה\s+1\s+מתוך\s+10/);
  });

  it('toggling mistakes-only with 0 mistakes displays informative empty state and reloads on uncheck [STUDY-07]', () => {
    const { win, document, app } = setupStudyDOMEnv();

    const toggleBtn =
      document.getElementById('studyMistakesOnlyToggle') ||
      document.getElementById('btnStudyMistakesOnly');
    assert.ok(toggleBtn, 'Mistakes toggle button must exist in DOM');

    const catSelect = document.getElementById('studyCategoryFilter');
    catSelect.value = 'אתיקה, חוק ובטיחות המטופל';
    catSelect.dispatchEvent(new win.Event('change', { bubbles: true }));

    const curIdxEl = document.getElementById('studyCurrentIndex');
    const totalCountEl = document.getElementById('studyTotalCount');
    const qTextEl = document.getElementById('studyQText');
    const optionsContainer = document.getElementById('studyOptionsContainer');
    const explanationBox = document.getElementById('studyExplanationBox');

    // Ensure 0 mistakes exist
    assert.equal(app.store.getState().mistakes.size, 0);

    // Click mistakes only toggle
    toggleBtn.click();

    // Verify empty state
    const studyEmpty = app.store.getState().currentStudy;
    assert.equal(studyEmpty.mistakesOnly, true);
    assert.equal(studyEmpty.questions.length, 0);

    assert.equal(curIdxEl.textContent, '0');
    assert.equal(totalCountEl.textContent, '0');
    assert.match(qTextEl.textContent, /מאגר הטעויות שלך ריק כרגע! כל הכבוד/);
    assert.equal(optionsContainer.children.length, 0, 'Options container must be empty');
    assert.equal(
      explanationBox.classList.contains('visible'),
      false,
      'Explanation box must be hidden in empty state'
    );
    assert.ok(
      toggleBtn.classList.contains('btn-primary'),
      'Toggle button should reflect active filter state'
    );

    // Uncheck toggle by clicking again
    toggleBtn.click();

    // Verify deck reloaded
    const studyRestored = app.store.getState().currentStudy;
    assert.equal(studyRestored.mistakesOnly, false);
    assert.equal(studyRestored.currentIndex, 0);
    assert.equal(studyRestored.questions.length, 10);

    assert.equal(curIdxEl.textContent, '1');
    assert.equal(totalCountEl.textContent, '10');
    const cleanCounterText = document
      .querySelector('.study-progress-counter')
      .textContent.trim()
      .replace(/\s+/g, ' ');
    assert.match(cleanCounterText, /שאלה\s+1\s+מתוך\s+10/);
    assert.ok(
      optionsContainer.children.length > 0,
      'Options container must repopulate upon restoring questions'
    );
  });

  it('renders informative empty state when category filter has 0 matching questions [STUDY-07]', () => {
    const { win, document, app } = setupStudyDOMEnv();

    const catSelect = document.getElementById('studyCategoryFilter');
    const emptyCat = 'הדרכה קלינית ומתודיקה'; // Category with 0 questions in mock
    const opt = document.createElement('option');
    opt.value = emptyCat;
    opt.textContent = emptyCat;
    catSelect.appendChild(opt);

    catSelect.value = emptyCat;
    catSelect.dispatchEvent(new win.Event('change', { bubbles: true }));

    const study = app.store.getState().currentStudy;
    assert.equal(study.questions.length, 0);

    assert.equal(document.getElementById('studyCurrentIndex').textContent, '0');
    assert.equal(document.getElementById('studyTotalCount').textContent, '0');
    assert.match(document.getElementById('studyQText').textContent, /אין שאלות בקטגוריה זו/);
    assert.equal(document.getElementById('studyOptionsContainer').children.length, 0);
  });

  it('re-indexes deck properly when toggling mistakes-only with populated mistakes [STUDY-07]', () => {
    const { document, app } = setupStudyDOMEnv();

    // Seed 2 mistakes
    app.store.setState({
      mistakes: new Set(['q_ethics_1', 'q_ethics_2']),
    });

    const toggleBtn =
      document.getElementById('studyMistakesOnlyToggle') ||
      document.getElementById('btnStudyMistakesOnly');

    toggleBtn.click();

    const study = app.store.getState().currentStudy;
    assert.equal(study.mistakesOnly, true);
    assert.equal(study.currentIndex, 0);
    assert.equal(study.questions.length, 2);

    assert.equal(document.getElementById('studyCurrentIndex').textContent, '1');
    assert.equal(document.getElementById('studyTotalCount').textContent, '2');
    const cleanCounterText = document
      .querySelector('.study-progress-counter')
      .textContent.trim()
      .replace(/\s+/g, ' ');
    assert.match(cleanCounterText, /שאלה\s+1\s+מתוך\s+2/);
  });
});
