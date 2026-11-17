import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderExplanationHTML } from '../../app/js/ui/explanation-card.js';
import { loadTestQuestions } from '../helpers/load-test-questions.js';

const allQuestions = await loadTestQuestions();

describe('app/js/ui/explanation-card.js — Explanation Card DOM Rendering (STUDY-04, SEC-01)', () => {
  it('renders "בשורה אחת" summary, rationale block, and distractor cards across all 1,079 questions with zero literature leaks [STUDY-04]', () => {
    for (const q of allQuestions) {
      const html = renderExplanationHTML(q);
      assert.ok(html.includes('expl-short-card'), `Missing expl-short-card on ${q.id}`);
      assert.ok(html.includes('expl-rationale-block'), `Missing expl-rationale-block on ${q.id}`);
      assert.ok(
        html.includes('expl-distractors-block'),
        `Missing expl-distractors-block on ${q.id}`
      );
      assert.equal(html.includes('• מקור בספרות'), false, `Literature leaked on ${q.id}`);
    }
  });

  it('escapes untrusted HTML inside shortExplanation, rationale, distractors, and originalExplanation [SEC-01]', () => {
    const html = renderExplanationHTML({
      shortExplanation: '<script>alert("xss")</script>',
      detailedExplanation:
        '• הרציונל: <img src=x onerror=alert(1)>\n• ניתוח המסיחים:\n- מסיח א: <b>זדוני</b>\n- מסיח ב: תקין',
      originalExplanation: 'הערה עם "מרכאות" ו-<tag>',
    });

    assert.equal(html.includes('<script>'), false);
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
    assert.equal(html.includes('<img src=x'), false);
    assert.ok(html.includes('&lt;b&gt;זדוני&lt;/b&gt;'));
    assert.ok(html.includes('&lt;tag&gt;'));
  });
});
