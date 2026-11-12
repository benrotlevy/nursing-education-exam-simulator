import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRetryWrongExamSession } from '../../app/js/domain/exam-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.resolve(__dirname, '../../app/data/questions.json');
const { questions: allQuestions } = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

describe('app/js/domain/exam-session.js — Retry Wrong Questions Generation (EXAM-12)', () => {
  it('creates retry-wrong exam with exactly the incorrect and unanswered question IDs [EXAM-12 Scenario A]', () => {
    const sample = allQuestions.slice(0, 5);
    const mockExam = {
      isSavedExam: true,
      savedExamId: 'saved_source_1',
      savedExamTitle: 'מבחן 2023',
      questions: sample,
      currentIndex: 4,
      userAnswers: {
        0: 1, // correct
        1: 2, // correct
        2: 0, // correct
        3: 1, // WRONG (correct is 3)
        // index 4 left UNANSWERED
      },
      flagged: new Set([0, 3]),
      eliminated: { 0: new Set([2]), 3: new Set([0]) },
      shuffledOptionsCache: {
        0: { options: sample[0].options, correctIndex: 1 },
        1: { options: sample[1].options, correctIndex: 2 },
        2: { options: sample[2].options, correctIndex: 0 },
        3: { options: sample[3].options, correctIndex: 3 },
        4: { options: sample[4].options, correctIndex: 2 },
      },
    };

    const deterministicRng = () => 0.42;
    const result = createRetryWrongExamSession(mockExam, deterministicRng);

    assert.equal(result.ok, true, 'Expected result.ok to be true');
    assert.ok(result.exam, 'Expected result.exam to be defined');

    // Exactly 2 questions: index 3 (wrong) and index 4 (unanswered)
    assert.equal(result.exam.questions.length, 2);
    const retryIds = new Set(result.exam.questions.map((q) => q.id));
    assert.equal(
      retryIds.has(sample[3].id),
      true,
      `Expected wrong question ${sample[3].id} in retry`
    );
    assert.equal(
      retryIds.has(sample[4].id),
      true,
      `Expected unanswered question ${sample[4].id} in retry`
    );
    assert.equal(retryIds.has(sample[0].id), false);
    assert.equal(retryIds.has(sample[1].id), false);
    assert.equal(retryIds.has(sample[2].id), false);

    // Verify session metadata is cleanly reset
    assert.equal(result.exam.isSavedExam, false);
    assert.equal(result.exam.savedExamId, null);
    assert.equal(result.exam.savedExamTitle, null);
    assert.equal(result.exam.currentIndex, 0);
    assert.deepStrictEqual(result.exam.userAnswers, {});
    assert.equal(result.exam.flagged.size, 0);
    assert.deepStrictEqual(result.exam.eliminated, {});
    assert.deepStrictEqual(result.exam.shuffledOptionsCache, {});
  });

  it('rejects sub-exam generation and returns guard message when exam score is 100% [EXAM-12 Scenario B]', () => {
    const sample = allQuestions.slice(0, 5);
    const mockPerfectExam = {
      isSavedExam: false,
      questions: sample,
      currentIndex: 4,
      userAnswers: {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        4: 0,
      },
      flagged: new Set(),
      eliminated: {},
      shuffledOptionsCache: {
        0: { options: sample[0].options, correctIndex: 0 },
        1: { options: sample[1].options, correctIndex: 1 },
        2: { options: sample[2].options, correctIndex: 2 },
        3: { options: sample[3].options, correctIndex: 3 },
        4: { options: sample[4].options, correctIndex: 0 },
      },
    };

    const result = createRetryWrongExamSession(mockPerfectExam);

    assert.equal(result.ok, false, 'Expected ok: false when score is 100%');
    assert.equal(result.exam, undefined, 'No exam session should be created on 100%');
    // STPR EXAM-12 specification requires: "אין שאלות שגויות לתרגול חוזר!"
    assert.equal(
      result.message,
      'אין שאלות שגויות לתרגול חוזר!',
      'Expected guard toast message: "אין שאלות שגויות לתרגול חוזר!"'
    );
  });

  it('handles empty questions or undefined exam defensively', () => {
    const emptyResult = createRetryWrongExamSession({ questions: [] });
    assert.equal(emptyResult.ok, false);

    const nullResult = createRetryWrongExamSession(null);
    assert.equal(nullResult.ok, false);
  });
});
