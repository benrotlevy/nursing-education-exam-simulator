import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatQuestionForAI } from '../../app/js/domain/ai-prompt.js';

describe('app/js/domain/ai-prompt.js — Study Mode AI Consultation Prompt (STUDY-05)', () => {
  it('formats question stem, category, source, shuffled options, and syllabus literature instructions [STUDY-05]', () => {
    const question = {
      id: 'q_001',
      category: 'משוב, הערכה ורפלקציה',
      source: 'שחזור מבחן ממשלתי 2023',
      question: 'מהי מטרתו המרכזית של משוב מעצב (Formative Evaluation)?',
    };
    const displayedOptions = [
      'שיפור הלמידה תוך כדי התהליך',
      'מתן ציון מסכם',
      'הדחת הסטודנט',
      'דירוג כיתתי',
    ];

    const prompt = formatQuestionForAI(question, displayedOptions);

    assert.ok(prompt.includes('מנהל הסיעוד בישראל'));
    assert.ok(prompt.includes('• תחום / קטגוריה: משוב, הערכה ורפלקציה'));
    assert.ok(prompt.includes('• מקור: שחזור מבחן ממשלתי 2023'));
    assert.ok(prompt.includes('מהי מטרתו המרכזית של משוב מעצב'));
    assert.ok(prompt.includes('  א. שיפור הלמידה תוך כדי התהליך'));
    assert.ok(prompt.includes('  ד. דירוג כיתתי'));
    assert.ok(prompt.includes('רמי אבירם, Bastable, Billings & Halstead'));
  });
});
