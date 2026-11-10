import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadQuestionsCatalog,
  clearQuestionsCatalogCache,
} from '../../app/js/services/question-repository.js';
import { compileQuestionsDataset } from '../../tools/build-questions.js';

describe('app/js/services/question-repository.js & tools/build-questions.js', () => {
  beforeEach(() => {
    clearQuestionsCatalogCache();
    delete globalThis.EXAM_QUESTIONS;
  });

  it('fetches, validates, and caches the question catalog from JSON payload', async () => {
    let fetchCalls = 0;
    const mockQuestions = [{ id: 'q_001', question: 'Test?' }];
    const mockFetch = async () => {
      fetchCalls++;
      return {
        ok: true,
        json: async () => ({ schemaVersion: 2, totalQuestions: 1, questions: mockQuestions }),
      };
    };

    const first = await loadQuestionsCatalog('./data/questions.json', mockFetch);
    const second = await loadQuestionsCatalog('./data/questions.json', mockFetch);

    assert.deepStrictEqual(first, mockQuestions);
    assert.strictEqual(first, second);
    assert.equal(fetchCalls, 1);
  });

  it('rejects when fetch returns non-OK HTTP status', async () => {
    const failingFetch = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await assert.rejects(
      () => loadQuestionsCatalog('./data/questions.json', failingFetch),
      /Failed to fetch question bank \(404 Not Found\)/
    );
  });

  it('compileQuestionsDataset rejects duplicate IDs or invalid categories', () => {
    const validItem = {
      id: 'q_001',
      source: 'test',
      category: 'תיאוריות למידה ולמידת מבוגרים',
      question: 'שאלה?',
      options: ['א', 'ב', 'ג', 'ד'],
      correctIndex: 0,
      verified: true,
      shortExplanation: 'קצר',
      detailedExplanation: '• הרציונל הפדגוגי/קליני: א\n• ניתוח המסיחים השגויים: ב',
    };

    assert.throws(
      () => compileQuestionsDataset([validItem, validItem]),
      /Duplicate question id: q_001/
    );
    assert.throws(
      () => compileQuestionsDataset([{ ...validItem, category: 'קטגוריה לא קיימת' }]),
      /Invalid category on q_001/
    );
  });
});
