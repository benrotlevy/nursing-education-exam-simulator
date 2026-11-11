import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {
  renderActiveExamQuestion,
  renderExamQuickGrid,
  renderExamResultsView,
} from '../../app/js/features/exam/exam-view.js';

describe('app/js/features/exam/exam-view.js — Exam DOM Rendering (EXAM-03..EXAM-09)', () => {
  it('renders active exam question, option elimination state, flag button, and quick grid cells [EXAM-03..EXAM-06]', () => {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = `
      <span id="examProgressCount"></span>
      <span id="examAnsweredCount"></span>
      <div id="examProgressBar"></div>
      <span id="examQCategory"></span>
      <span id="examQSource"></span>
      <span id="examQUnverified"></span>
      <button id="examFlagBtn"></button>
      <div id="examQText"></div>
      <div id="examOptionsContainer"></div>
      <button id="btnPrevExam"></button>
      <button id="btnNextExam"></button>
      <button id="btnSubmitExam"></button>
      <div id="examQuickGrid"></div>
    `;

    const exam = {
      currentIndex: 0,
      questions: [
        {
          id: 'q_001',
          category: 'משוב, הערכה ורפלקציה',
          source: 'מבחן 2023',
          verified: false,
          question: 'מהי מטרת המשוב המעצב?',
          options: ['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד'],
          correctIndex: 0,
        },
      ],
      userAnswers: { 0: 1 },
      flagged: new Set([0]),
      eliminated: { 0: new Set([2]) },
      shuffledOptionsCache: {
        0: {
          options: ['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד'],
          correctIndex: 0,
        },
      },
    };

    renderExamQuickGrid({ document, exam });
    renderActiveExamQuestion({ document, exam });

    assert.equal(document.getElementById('examProgressCount').textContent, 'שאלה 1 מתוך 1');
    assert.equal(document.getElementById('examAnsweredCount').textContent, 'נענו: 1 מתוך 1');
    assert.equal(document.getElementById('examFlagBtn').classList.contains('flagged'), true);

    const optItems = document.querySelectorAll('#examOptionsContainer .option-item');
    assert.equal(optItems.length, 4);
    assert.equal(optItems[1].classList.contains('selected'), true);
    assert.equal(optItems[2].classList.contains('eliminated'), true);

    const gridCells = document.querySelectorAll('#examQuickGrid .grid-cell');
    assert.equal(gridCells.length, 1);
    assert.equal(gridCells[0].classList.contains('answered'), true);
    assert.equal(gridCells[0].classList.contains('flagged'), true);
    assert.equal(gridCells[0].classList.contains('active'), true);
  });

  it('renders exam results summary and review cards with structured explanations [EXAM-09]', () => {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = `
      <span id="resScoreVal"></span>
      <span id="resCorrectCount"></span>
      <span id="resWrongCount"></span>
      <span id="resTotalCount"></span>
      <h2 id="resTitleMsg"></h2>
      <div id="savedExamResultsBanner"></div>
      <div id="examReviewList"></div>
    `;

    const exam = {
      isSavedExam: true,
      savedExamId: 'saved_1',
      questions: [
        {
          id: 'q_001',
          category: 'משוב, הערכה ורפלקציה',
          question: 'שאלה לדוגמה',
          options: ['נכון', 'שגוי 1', 'שגוי 2', 'שגוי 3'],
          correctIndex: 0,
          shortExplanation: 'הסבר קצר',
          detailedExplanation: '• הרציונל: הסבר מפורט.\n• ניתוח המסיחים:\n- שגוי 1: הסבר.',
        },
      ],
      userAnswers: { 0: 1 },
      shuffledOptionsCache: {
        0: {
          options: ['נכון', 'שגוי 1', 'שגוי 2', 'שגוי 3'],
          correctIndex: 0,
        },
      },
    };

    renderExamResultsView({
      document,
      exam,
      scorePct: 0,
      correctCount: 0,
      total: 1,
    });

    assert.equal(document.getElementById('resScoreVal').textContent, '0%');
    assert.equal(document.getElementById('savedExamResultsBanner').style.display, 'flex');

    const reviewCards = document.querySelectorAll('#examReviewList .review-item');
    assert.equal(reviewCards.length, 1);
    assert.equal(reviewCards[0].classList.contains('was-wrong'), true);
    assert.ok(reviewCards[0].innerHTML.includes('expl-rationale-block'));
  });
});
