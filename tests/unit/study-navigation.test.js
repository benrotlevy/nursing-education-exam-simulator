import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {
  createStudyDeck,
  ensureStudyQuestionShuffle,
  answerStudyQuestion,
  advanceStudyQuestion,
} from '../../app/js/domain/study-session.js';
import { createStore, createInitialState } from '../../app/js/core/store.js';
import { createStudyController } from '../../app/js/features/study/study-controller.js';

const mockQuestions = [
  {
    id: 'q_mock_1',
    category: 'אתיקה, חוק ובטיחות המטופל',
    source: 'מבחן ממשלתי 2023',
    question: 'מהו עקרון האוטונומיה של המטופל?',
    options: ['זכות להחליט', 'החלטת הרופא בלבד', 'החלטת המשפחה', 'חובת ציות מלאה'],
    correctIndex: 0,
    detailedExplanation: 'האוטונומיה היא זכות היסוד של המטופל לקבל החלטות מדעת.',
  },
  {
    id: 'q_mock_2',
    category: 'אתיקה, חוק ובטיחות המטופל',
    source: 'מבחן ממשלתי 2023',
    question: 'מהי הסכמה מדעת?',
    options: ['חתימה ללא הסבר', 'הסבר מקיף ובחירה חופשית', 'הסכמה בעל פה בלבד', 'ויתור על זכויות'],
    correctIndex: 1,
    detailedExplanation: 'הסכמה מדעת דורשת מסירת כל המידע הרלוונטי למטופל.',
  },
  {
    id: 'q_mock_3',
    category: 'אתיקה, חוק ובטיחות המטופל',
    source: 'מבחן ממשלתי 2023',
    question: 'מהי רשלנות רפואית?',
    options: [
      'הפרת חובת זהירות שגרמה נזק',
      'טעות שאינה גורמת נזק',
      'ביצוע פעולה לפי פרוטוקול',
      'תופעת לוואי צפויה',
    ],
    correctIndex: 0,
    detailedExplanation: 'יסודות עוולת הרשלנות דורשים חובת זהירות, הפרתה וקשר סיבתי לנזק.',
  },
];

describe('tests/unit/study-navigation.test.js — Study Mode Lower-Bound Navigation & Shuffle Retention (STUDY-06)', () => {
  it('safely clamps backward navigation at index 0 without underflow in domain logic [STUDY-06]', () => {
    let study = createStudyDeck({
      allQuestions: mockQuestions,
      selectedCategory: 'ALL',
      mistakesOnly: false,
    });

    assert.equal(study.currentIndex, 0);

    // Attempt navigating backward from index 0 multiple times
    study = advanceStudyQuestion(study, -1);
    assert.equal(study.currentIndex, 0, 'Index must not underflow below 0');

    study = advanceStudyQuestion(study, -1);
    assert.equal(
      study.currentIndex,
      0,
      'Index must remain clamped at 0 on repeated backward requests'
    );
  });

  it('preserves exact option shuffle order and answered state when navigating forward and backward [STUDY-06]', () => {
    let study = createStudyDeck({
      allQuestions: mockQuestions,
      selectedCategory: 'ALL',
      mistakesOnly: false,
    });

    // Hydrate options for question 0
    study = ensureStudyQuestionShuffle(study, 0);
    const q0ShuffledOptions = [...study.shuffledOptionsCache[0].options];
    const q0CorrectIndex = study.shuffledOptionsCache[0].correctIndex;

    // Answer question 0
    const answerResult0 = answerStudyQuestion({
      study,
      userStats: { totalAnswered: 0, totalCorrect: 0, examsCompleted: 0, categoryStats: {} },
      mistakes: new Set(),
      mistakeTimestamps: {},
      selectedOptionIndex: q0CorrectIndex,
      now: 1000,
    });
    study = answerResult0.study;
    assert.equal(study.userAnswers[0], q0CorrectIndex);

    // Advance to question 1
    study = advanceStudyQuestion(study, 1);
    assert.equal(study.currentIndex, 1);
    study = ensureStudyQuestionShuffle(study, 1);
    const q1ShuffledOptions = [...study.shuffledOptionsCache[1].options];
    const q1ChosenIndex = (study.shuffledOptionsCache[1].correctIndex + 1) % 4; // incorrect

    const answerResult1 = answerStudyQuestion({
      study,
      userStats: answerResult0.userStats,
      mistakes: answerResult0.mistakes,
      mistakeTimestamps: answerResult0.mistakeTimestamps,
      selectedOptionIndex: q1ChosenIndex,
      now: 2000,
    });
    study = answerResult1.study;
    assert.equal(study.userAnswers[1], q1ChosenIndex);

    // Advance to question 2
    study = advanceStudyQuestion(study, 1);
    assert.equal(study.currentIndex, 2);

    // Navigate backwards: 2 -> 1
    study = advanceStudyQuestion(study, -1);
    assert.equal(study.currentIndex, 1);
    assert.deepStrictEqual(
      study.shuffledOptionsCache[1].options,
      q1ShuffledOptions,
      'Question 1 options order must be identical when returning'
    );
    assert.equal(study.userAnswers[1], q1ChosenIndex, 'Question 1 chosen answer must be retained');

    // Navigate backwards: 1 -> 0
    study = advanceStudyQuestion(study, -1);
    assert.equal(study.currentIndex, 0);
    assert.deepStrictEqual(
      study.shuffledOptionsCache[0].options,
      q0ShuffledOptions,
      'Question 0 options order must be identical when returning'
    );
    assert.equal(study.userAnswers[0], q0CorrectIndex, 'Question 0 chosen answer must be retained');

    // Clamping: backward at 0 stops at 0
    study = advanceStudyQuestion(study, -1);
    assert.equal(study.currentIndex, 0);

    // Navigate forward again: 0 -> 1
    study = advanceStudyQuestion(study, 1);
    assert.equal(study.currentIndex, 1);
    assert.deepStrictEqual(study.shuffledOptionsCache[1].options, q1ShuffledOptions);
    assert.equal(study.userAnswers[1], q1ChosenIndex);
  });

  it('studyController clamps prevStudyQuestion at index 0 and maintains DOM feedback state upon return [STUDY-06]', () => {
    const win = new Window();
    const document = win.document;
    document.body.innerHTML = `
      <div id="studyCategoryFilter"></div>
      <button id="btnStudyMistakesOnly"></button>
      <span id="studyCurrentIndex"></span>
      <span id="studyTotalCount"></span>
      <span id="studyQCategory"></span>
      <span id="studyQSource"></span>
      <span id="studyQUnverified"></span>
      <div id="studyQText"></div>
      <div id="studyOptionsContainer"></div>
      <div id="studyExplanationBox" class="explanation-box">
        <div id="studyExplanationHeader"></div>
        <div id="studyExplanationText"></div>
      </div>
      <button class="btn btn-secondary" id="btnPrevStudy" data-action="prev-study-question">קודם</button>
      <button class="btn btn-primary" id="btnNextStudy" data-action="next-study-question">הבא</button>
    `;

    const store = createStore({
      ...createInitialState(),
      allQuestions: mockQuestions,
    });

    const savedStudySessions = [];
    const mockStorage = {
      saveStudySession: (s) => savedStudySessions.push(s),
      saveProgress: () => true,
    };

    const studyController = createStudyController({
      document,
      store,
      storage: mockStorage,
      toast: { showToast: () => {} },
    });

    studyController.initStudyMode();
    studyController.syncStudyDOM();

    assert.equal(store.getState().currentStudy.currentIndex, 0);

    // Call prevStudyQuestion at index 0: should not underflow
    studyController.prevStudyQuestion();
    assert.equal(store.getState().currentStudy.currentIndex, 0, 'Index must remain 0');

    // Answer question 0
    const study0 = store.getState().currentStudy;
    const correct0 = study0.shuffledOptionsCache[0].correctIndex;
    studyController.answerStudyQuestion(correct0);

    // Verify DOM feedback for question 0
    let opt0 = document.getElementById(`studyOpt_${correct0}`);
    assert.ok(opt0.classList.contains('correct'));
    assert.ok(opt0.classList.contains('disabled'));
    assert.ok(document.getElementById('studyExplanationBox').classList.contains('visible'));

    // Next question: index 1
    studyController.nextStudyQuestion();
    assert.equal(store.getState().currentStudy.currentIndex, 1);

    // Answer question 1 with wrong answer
    const study1 = store.getState().currentStudy;
    const wrong1 = (study1.shuffledOptionsCache[1].correctIndex + 1) % 4;
    studyController.answerStudyQuestion(wrong1);

    let opt1Wrong = document.getElementById(`studyOpt_${wrong1}`);
    assert.ok(opt1Wrong.classList.contains('wrong'));
    assert.ok(opt1Wrong.classList.contains('disabled'));

    // Move to question 2
    studyController.nextStudyQuestion();
    assert.equal(store.getState().currentStudy.currentIndex, 2);

    // Move back twice to question 0
    studyController.prevStudyQuestion();
    assert.equal(store.getState().currentStudy.currentIndex, 1);
    studyController.prevStudyQuestion();
    assert.equal(store.getState().currentStudy.currentIndex, 0);

    // Move back again: clamps at 0
    studyController.prevStudyQuestion();
    assert.equal(store.getState().currentStudy.currentIndex, 0);

    // Verify DOM feedback for question 0 is restored exactly
    opt0 = document.getElementById(`studyOpt_${correct0}`);
    assert.ok(
      opt0.classList.contains('correct'),
      'Question 0 correct badge retained after navigating back'
    );
    assert.ok(opt0.classList.contains('disabled'), 'Question 0 disabled state retained');
    assert.ok(
      document.getElementById('studyExplanationBox').classList.contains('visible'),
      'Question 0 explanation box visible upon return'
    );

    // Move forward to question 1
    studyController.nextStudyQuestion();
    assert.equal(store.getState().currentStudy.currentIndex, 1);
    opt1Wrong = document.getElementById(`studyOpt_${wrong1}`);
    assert.ok(
      opt1Wrong.classList.contains('wrong'),
      'Question 1 wrong badge retained upon forward navigation'
    );
    assert.ok(opt1Wrong.classList.contains('disabled'), 'Question 1 disabled state retained');
  });
});
