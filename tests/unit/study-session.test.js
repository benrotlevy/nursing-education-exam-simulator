import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createStudyDeck,
  ensureStudyQuestionShuffle,
  answerStudyQuestion,
  advanceStudyQuestion,
} from '../../app/js/domain/study-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.resolve(__dirname, '../../app/data/questions.json');
const { questions: allQuestions } = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

describe('app/js/domain/study-session.js — Study Deck, Immediate Feedback & Wrap-Around (STUDY-01..STUDY-03)', () => {
  it('filters study deck by category or mistakesOnly [STUDY-01]', () => {
    const cat = 'אתיקה, חוק ובטיחות המטופל';
    const deck = createStudyDeck({
      allQuestions,
      selectedCategory: cat,
      mistakesOnly: false,
    });
    assert.ok(deck.questions.length > 0);
    assert.equal(
      deck.questions.every((q) => q.category === cat),
      true
    );

    const mistakes = new Set([allQuestions[0].id, allQuestions[5].id]);
    const mistakeDeck = createStudyDeck({
      allQuestions,
      mistakes,
      mistakesOnly: true,
    });
    assert.equal(mistakeDeck.questions.length, 2);
  });

  it('records immediate feedback, updates stats/mistakes, and wraps around at end of deck [STUDY-02, STUDY-03]', () => {
    let study = createStudyDeck({
      allQuestions: allQuestions.slice(0, 2),
    });
    study = ensureStudyQuestionShuffle(study, 0);

    const q0 = study.questions[0];
    const wrongOpt = (study.shuffledOptionsCache[0].correctIndex + 1) % 4;

    const answeredWrong = answerStudyQuestion({
      study,
      userStats: { totalAnswered: 0, totalCorrect: 0, examsCompleted: 0, categoryStats: {} },
      mistakes: new Set(),
      mistakeTimestamps: {},
      selectedOptionIndex: wrongOpt,
      now: 1000,
    });

    assert.equal(answeredWrong.isCorrect, false);
    assert.equal(answeredWrong.mistakes.has(q0.id), true);
    assert.equal(answeredWrong.userStats.totalAnswered, 1);
    assert.equal(answeredWrong.userStats.totalCorrect, 0);

    // Advance to index 1
    let nextStudy = advanceStudyQuestion(answeredWrong.study, 1);
    assert.equal(nextStudy.currentIndex, 1);

    // Advance past end of 2-card deck -> wraps around to index 0 with fresh cache
    nextStudy = advanceStudyQuestion(nextStudy, 1);
    assert.equal(nextStudy.currentIndex, 0);
    assert.deepStrictEqual(nextStudy.userAnswers, {});
  });
});
