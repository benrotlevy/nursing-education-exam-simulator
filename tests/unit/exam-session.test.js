import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createExamSession,
  ensureExamQuestionShuffle,
  selectExamAnswer,
  toggleEliminateOption,
  toggleFlagQuestion,
  navigateExamQuestion,
  countUnansweredQuestions,
  gradeExamSession,
  createRetryWrongExamSession,
} from '../../app/js/domain/exam-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.resolve(__dirname, '../../app/data/questions.json');
const { questions: allQuestions } = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

describe('app/js/domain/exam-session.js — Exam Lifecycle & Grading (EXAM-01..EXAM-09)', () => {
  it('samples the requested count (10/25/50/100/MISTAKES_ONLY) and rejects empty mistakes pool [EXAM-01, EXAM-02]', () => {
    const emptyMistakesResult = createExamSession({
      allQuestions,
      mistakes: new Set(),
      countChoice: 'MISTAKES_ONLY',
    });
    assert.equal(emptyMistakesResult.ok, false);
    assert.equal(emptyMistakesResult.reason, 'EMPTY_MISTAKES');

    const res25 = createExamSession({
      allQuestions,
      countChoice: '25',
    });
    assert.equal(res25.ok, true);
    assert.equal(res25.exam.questions.length, 25);
  });

  it('handles option selection, distractor elimination, flagging, and bounded navigation [EXAM-03..EXAM-06]', () => {
    const { exam: initial } = createExamSession({ allQuestions, countChoice: '10' });
    let exam = ensureExamQuestionShuffle(initial, 0);

    // Eliminate option 1, then select option 1 -> clears elimination
    exam = toggleEliminateOption(exam, 1);
    assert.equal(exam.eliminated[0].has(1), true);

    exam = selectExamAnswer(exam, 1);
    assert.equal(exam.eliminated[0].has(1), false);
    assert.equal(exam.userAnswers[0], 1);

    // Eliminate option 1 while selected -> clears selection
    exam = toggleEliminateOption(exam, 1);
    assert.equal(exam.eliminated[0].has(1), true);
    assert.equal(exam.userAnswers[0], undefined);

    // Flag question 0
    exam = toggleFlagQuestion(exam, 0);
    assert.equal(exam.flagged.has(0), true);
    exam = toggleFlagQuestion(exam, 0);
    assert.equal(exam.flagged.has(0), false);

    // Navigate
    exam = navigateExamQuestion(exam, 5);
    assert.equal(exam.currentIndex, 5);
    exam = navigateExamQuestion(exam, 999);
    assert.equal(exam.currentIndex, 9);
    assert.equal(countUnansweredQuestions(exam), 10);
  });

  it('grades exam session, updates userStats & mistakes with timestamps, and creates retry-wrong exam [EXAM-07, EXAM-09]', () => {
    const sample = allQuestions.slice(0, 4);
    let exam = {
      isSavedExam: true,
      savedExamId: 'saved_1',
      questions: sample,
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      eliminated: {},
      shuffledOptionsCache: {},
    };

    exam = ensureExamQuestionShuffle(exam, 0);
    exam = ensureExamQuestionShuffle(exam, 1);
    // Answer Q0 correctly, Q1 wrongly, leave Q2 and Q3 unanswered (unvisited!)
    const q0Correct = exam.shuffledOptionsCache[0].correctIndex;
    const q1Wrong = (exam.shuffledOptionsCache[1].correctIndex + 1) % 4;
    exam = selectExamAnswer(exam, q0Correct, 0);
    exam = selectExamAnswer(exam, q1Wrong, 1);

    const initialMistakes = new Set([sample[0].id]);
    const savedExams = [{ id: 'saved_1', status: 'READY', score: null }];

    const graded = gradeExamSession({
      exam,
      userStats: { totalAnswered: 0, totalCorrect: 0, examsCompleted: 0, categoryStats: {} },
      mistakes: initialMistakes,
      mistakeTimestamps: {},
      savedExams,
      now: 1700000000000,
    });

    assert.equal(graded.correctCount, 1);
    assert.equal(graded.wrongCount, 3);
    assert.equal(graded.scorePct, 25);
    assert.equal(graded.userStats.totalAnswered, 4);
    assert.equal(graded.userStats.totalCorrect, 1);
    assert.equal(graded.userStats.examsCompleted, 1);

    // Q0 was answered right -> removed from mistakes! Q1, Q2, Q3 added to mistakes!
    assert.equal(graded.mistakes.has(sample[0].id), false);
    assert.equal(graded.mistakeTimestamps[sample[0].id].removed, true);
    assert.equal(graded.mistakes.has(sample[1].id), true);
    assert.equal(graded.mistakes.has(sample[2].id), true);
    assert.equal(graded.savedExams[0].status, 'COMPLETED');
    assert.equal(graded.savedExams[0].score, 25);

    const retry = createRetryWrongExamSession(graded.exam);
    assert.equal(retry.ok, true);
    assert.equal(retry.exam.questions.length, 3);
  });
});
