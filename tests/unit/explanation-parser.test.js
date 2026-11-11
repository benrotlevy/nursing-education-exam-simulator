import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseExplanationComponents,
  extractExplanationViewModel,
} from '../../app/js/domain/explanation-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.resolve(__dirname, '../../app/data/questions.json');
const { questions: allQuestions } = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

describe('app/js/domain/explanation-parser.js — Pedagogical Rationale & Distractor Parsing (STUDY-04)', () => {
  it('parses rationale and distractors across all 1,079 questions with zero literature leaks [STUDY-04]', () => {
    for (const q of allQuestions) {
      const vm = extractExplanationViewModel(q);
      assert.ok(vm.shortText.length > 0, `Empty shortText on ${q.id}`);
      assert.equal(vm.hasDetails, true, `Expected detailed explanation on ${q.id}`);
      assert.ok(vm.rationale.length > 0, `Empty rationale on ${q.id}`);
      assert.ok(vm.distractors.length > 0, `Empty distractors on ${q.id}`);
      assert.equal(vm.rationale.includes('• מקור בספרות'), false);
    }
  });

  it('handles bulleted, semicolon-separated, and fallback explanation text gracefully', () => {
    const bulleted = parseExplanationComponents(
      '• הרציונל הפדגוגי: עיקרון א.\n• ניתוח המסיחים:\n- מסיח 1 שגוי\n- מסיח 2 שגוי'
    );
    assert.equal(bulleted.rationale, 'עיקרון א.');
    assert.deepStrictEqual(bulleted.distractors, ['מסיח 1 שגוי', 'מסיח 2 שגוי']);

    const fallback = parseExplanationComponents('הסבר חופשי ללא כותרות • מקור בספרות: אבירם');
    assert.equal(fallback.rationale, 'הסבר חופשי ללא כותרות');
    assert.deepStrictEqual(fallback.distractors, []);
  });
});
