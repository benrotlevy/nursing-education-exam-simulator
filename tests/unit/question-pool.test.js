import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getQuarantinedQuestionIdSet,
  getActiveQuestionPool,
  extractUniqueSources,
  getAvailableFullExams,
  filterQuestionsPool,
} from '../../app/js/domain/question-pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.resolve(__dirname, '../../app/data/questions.json');
const { questions: allQuestions } = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

describe('app/js/domain/question-pool.js — Quarantine Isolation & Pool Filtering (POOL-03..POOL-05)', () => {
  it('excludes quarantined saved-exam question IDs from active pool with zero leaks [POOL-03]', () => {
    const exam1Src = 'שחזור מבחן ממשלתי 2023 (שחזור חליל)';
    const exam1Qs = allQuestions.filter((q) => q.source === exam1Src);
    assert.equal(exam1Qs.length, 100);

    const savedExams = [
      { id: 'saved_1', sourceName: exam1Src, questionIds: exam1Qs.map((q) => q.id) },
    ];

    const qSet = getQuarantinedQuestionIdSet(savedExams);
    assert.equal(qSet.size, 100);

    const activePool = getActiveQuestionPool(allQuestions, savedExams);
    assert.equal(activePool.length, 979);
    assert.equal(
      activePool.some((q) => q.source === exam1Src),
      false
    );
  });

  it('filters active pool by source, category, and mistakesOnly accurately [POOL-04]', () => {
    const targetCategory = 'משוב, הערכה ורפלקציה';
    const catPool = filterQuestionsPool({
      allQuestions,
      category: targetCategory,
    });
    assert.ok(catPool.length > 0);
    assert.equal(
      catPool.every((q) => q.category === targetCategory),
      true
    );

    const mistakes = new Set([catPool[0].id, catPool[1].id]);
    const mistakePool = filterQuestionsPool({
      allQuestions,
      category: targetCategory,
      mistakesOnly: true,
      mistakes,
    });
    assert.equal(mistakePool.length, 2);
  });

  it('discovers unique sources and returns available full exams (>=20 questions) excluding already saved [POOL-05]', () => {
    const sources = extractUniqueSources(allQuestions);
    assert.ok(sources.length > 5);

    const availableAll = getAvailableFullExams(allQuestions, []);
    assert.ok(availableAll.length > 0);
    assert.equal(
      availableAll.every((e) => e.questionCount >= 20),
      true
    );

    const firstSource = availableAll[0].sourceName;
    const availableAfterSave = getAvailableFullExams(allQuestions, [{ sourceName: firstSource }]);
    assert.equal(
      availableAfterSave.some((e) => e.sourceName === firstSource),
      false
    );
  });
});
