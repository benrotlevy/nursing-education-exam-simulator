import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reserveExamSlot,
  createSavedExamRun,
  releaseSavedExamSlot,
} from '../../app/js/domain/saved-exams.js';
import { getActiveQuestionPool } from '../../app/js/domain/question-pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.resolve(__dirname, '../../app/data/questions.json');
const { questions: allQuestions } = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

describe('app/js/domain/saved-exams.js — Saved Exams Quarantine Lifecycle (SAVED-01..SAVED-05)', () => {
  it('reserves up to 3 full exams, quarantines their questions, launches saved runs, and releases slots [SAVED-01..SAVED-05]', () => {
    const src1 = 'שחזור מבחן ממשלתי 2023 (שחזור חליל)'; // 100 questions
    const src2 = 'מבחן מסכם בהדרכה קלינית 2023 (הדסה/העברית)'; // 98 questions
    const src3 = 'שחזור מבחן בהדרכה קלינית2019'; // 89 questions
    const src4 = 'שחזור מבחן מתכונת עמק יזרעאל נובמבר 2020'; // 72 questions

    let savedExams = [];

    const r1 = reserveExamSlot({
      allQuestions,
      savedExams,
      sourceName: src1,
      idGenerator: () => 'saved_1',
    });
    assert.equal(r1.ok, true);
    savedExams = r1.savedExams;
    assert.equal(getActiveQuestionPool(allQuestions, savedExams).length, 979);

    // Duplicate source rejected (SAVED-02)
    const dup = reserveExamSlot({ allQuestions, savedExams, sourceName: src1 });
    assert.equal(dup.ok, false);
    assert.equal(dup.reason, 'DUPLICATE_SOURCE');

    const r2 = reserveExamSlot({
      allQuestions,
      savedExams,
      sourceName: src2,
      idGenerator: () => 'saved_2',
    });
    savedExams = r2.savedExams;
    assert.equal(getActiveQuestionPool(allQuestions, savedExams).length, 881);

    const r3 = reserveExamSlot({
      allQuestions,
      savedExams,
      sourceName: src3,
      idGenerator: () => 'saved_3',
    });
    savedExams = r3.savedExams;
    assert.equal(getActiveQuestionPool(allQuestions, savedExams).length, 792);

    // 4th exam rejected when 3/3 full (SAVED-02)
    const r4 = reserveExamSlot({ allQuestions, savedExams, sourceName: src4 });
    assert.equal(r4.ok, false);
    assert.equal(r4.reason, 'LIMIT_REACHED');

    // Start saved exam 1 (SAVED-03)
    const run = createSavedExamRun({
      allQuestions,
      savedExams,
      savedExamId: 'saved_1',
    });
    assert.equal(run.ok, true);
    assert.equal(run.exam.isSavedExam, true);
    assert.equal(run.exam.questions.length, 100);

    // Release saved_1 -> 100 questions return to active pool (SAVED-05)
    const rel1 = releaseSavedExamSlot(savedExams, 'saved_1');
    assert.equal(rel1.removedSlot.questionCount, 100);
    savedExams = rel1.savedExams;
    assert.equal(getActiveQuestionPool(allQuestions, savedExams).length, 892);
  });
});
