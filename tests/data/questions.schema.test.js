import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALID_CATEGORIES,
  normalizeOrigExplanation,
  stripLiteratureLine,
} from '../../tools/build-questions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const sourcePath = path.join(repoRoot, 'data-pipeline', 'source', 'clean_questions.json');
const runtimePath = path.join(repoRoot, 'app', 'data', 'questions.json');

const sourceQuestions = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const runtimePayload = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
const runtimeQuestions = runtimePayload.questions;

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseExplanationComponents(detailedText) {
  if (!detailedText) return { rationale: '', distractors: [] };
  let rationale = '';
  let distractorRaw = '';
  const ratMatch = detailedText.match(
    /•?\s*הרציונל[^\n:]*:\s*([\s\S]*?)(?=•?\s*ניתוח המסיחים|•?\s*(מקור|עיגון) בספרות|$)/
  );
  if (ratMatch) rationale = ratMatch[1].trim();
  const distMatch = detailedText.match(
    /•?\s*ניתוח המסיחים[^\n:]*:\s*([\s\S]*?)(?=•?\s*(מקור|עיגון) בספרות|$)/
  );
  if (distMatch) distractorRaw = distMatch[1].trim();

  if (!rationale && !distractorRaw) {
    const clean = detailedText
      .replace(/•?\s*(מקור בספרות|עיגון בספרות|סילבוס)[^\n]*/gi, '')
      .trim();
    return { rationale: clean, distractors: [] };
  }

  let distractors = [];
  if (distractorRaw) {
    if (distractorRaw.includes('\n-') || distractorRaw.startsWith('-')) {
      distractors = distractorRaw
        .split(/\n?-\s+/)
        .map((d) => d.trim())
        .filter((d) => d.length > 1);
    } else if (distractorRaw.includes(';')) {
      distractors = distractorRaw
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.length > 1);
    } else if (distractorRaw.includes('. ') || distractorRaw.includes('.\n')) {
      distractors = distractorRaw
        .split(/(?<=\.)\s+/)
        .map((d) => d.trim())
        .filter((d) => d.length > 1);
    } else {
      distractors = [distractorRaw];
    }
  }
  return { rationale, distractors };
}

function renderExplanationHTML(q) {
  const shortText =
    q.shortExplanation ||
    (q.aiExplanation ? q.aiExplanation.split('\n')[0] : q.explanation) ||
    'התשובה המסומנת היא התשובה הנכונה.';
  const detailedText = q.detailedExplanation || q.aiExplanation || q.explanation || '';
  const origText =
    q.originalExplanation &&
    q.originalExplanation.trim() &&
    !q.originalExplanation.startsWith('התשובה הנכונה היא:')
      ? q.originalExplanation.trim()
      : null;

  let html = '<div class="expl-sections-container">';

  html += `
        <div class="expl-short-card">
          <div class="expl-short-badge">💡 בשורה אחת:</div>
          <div class="expl-short-text">${escapeHTML(shortText)}</div>
        </div>
      `;

  if (detailedText && detailedText.trim() !== shortText.trim()) {
    const parsed = parseExplanationComponents(detailedText);

    let contentHtml = '';
    if (parsed.rationale) {
      contentHtml += `
            <div class="expl-rationale-block">
              <div class="expl-block-header">🎯 הרציונל הקליני / פדגוגי:</div>
              <div class="expl-block-text">${escapeHTML(parsed.rationale).replace(/\n/g, '<br>')}</div>
            </div>
          `;
    }

    if (parsed.distractors && parsed.distractors.length > 0) {
      const itemsHtml = parsed.distractors
        .map(
          (d) => `
            <div class="expl-distractor-item">
              <span class="expl-distractor-icon">✕</span>
              <span class="expl-distractor-text">${escapeHTML(d)}</span>
            </div>
          `
        )
        .join('');

      contentHtml += `
            <div class="expl-distractors-block">
              <div class="expl-distractors-header">🔍 ניתוח המסיחים השגויים (מדוע שאר האפשרויות שגויות):</div>
              <div class="expl-distractor-list">
                ${itemsHtml}
              </div>
            </div>
          `;
    }

    if (!contentHtml) {
      const fallbackClean = escapeHTML(detailedText)
        .replace(/•?\s*(מקור בספרות|עיגון בספרות)[^\n]*/gi, '')
        .replace(/\n/g, '<br>');
      contentHtml = `<div class="expl-block-text">${fallbackClean}</div>`;
    }

    html += `
          <details class="expl-details-accordion">
            <summary class="expl-accordion-summary">
              <span class="summary-left">
                <span>📖</span>
                <span>הסבר פדגוגי מפורט וניתוח מסיחים</span>
              </span>
              <span class="summary-arrow">▼</span>
            </summary>
            <div class="expl-details-content">
              ${contentHtml}
            </div>
          </details>
        `;
  }

  if (origText) {
    html += `
          <div class="expl-original-tag">
            <span class="expl-pill pill-orig">🏷️ הערת שחזור מקורית:</span>
            <span>${escapeHTML(origText)}</span>
          </div>
        `;
  }

  html += '</div>';
  return html;
}

describe('Step 5 Data Integrity & Schema Verification (DATA-01..DATA-05)', () => {
  it('Check 1: 1-to-1 field equivalence across all 1,079 questions between source and runtime JSON', () => {
    assert.equal(runtimePayload.schemaVersion, 2);
    assert.equal(runtimePayload.totalQuestions, 1079);
    assert.equal(sourceQuestions.length, 1079);
    assert.equal(runtimeQuestions.length, 1079);

    for (let i = 0; i < sourceQuestions.length; i++) {
      const src = sourceQuestions[i];
      const dst = runtimeQuestions[i];

      assert.strictEqual(dst.id, src.id, `ID mismatch at index ${i}`);
      assert.strictEqual(dst.source, src.source.trim(), `Source mismatch on ${src.id}`);
      assert.strictEqual(dst.category, src.category, `Category mismatch on ${src.id}`);
      assert.strictEqual(dst.question, src.question.trim(), `Question stem mismatch on ${src.id}`);
      assert.deepStrictEqual(
        dst.options,
        src.options.map((o) => o.trim()),
        `Options mismatch on ${src.id}`
      );
      assert.strictEqual(dst.correctIndex, src.correctIndex, `correctIndex mismatch on ${src.id}`);
      assert.strictEqual(
        dst.options[dst.correctIndex],
        src.options[src.correctIndex].trim(),
        `Correct answer text mismatch on ${src.id}`
      );
      assert.strictEqual(dst.verified, Boolean(src.verified), `verified mismatch on ${src.id}`);
      assert.strictEqual(
        dst.shortExplanation,
        src.shortExplanation.trim(),
        `shortExplanation mismatch on ${src.id}`
      );
      assert.strictEqual(
        dst.detailedExplanation,
        stripLiteratureLine(src.detailedExplanation),
        `detailedExplanation mismatch on ${src.id}`
      );
      assert.strictEqual(
        dst.originalExplanation,
        normalizeOrigExplanation(src.originalExplanation),
        `originalExplanation mismatch on ${src.id}`
      );
    }
  });

  it('Check 2: Proof that only 100% duplicate fields were removed from runtime JSON', () => {
    for (const src of sourceQuestions) {
      assert.ok(
        typeof src.shortExplanation === 'string' && src.shortExplanation.trim().length > 0,
        `Missing shortExplanation on ${src.id}`
      );
      assert.ok(
        typeof src.detailedExplanation === 'string' && src.detailedExplanation.trim().length > 0,
        `Missing detailedExplanation on ${src.id}`
      );
      assert.strictEqual(
        src.aiExplanation,
        src.detailedExplanation,
        `aiExplanation is not identical to detailedExplanation on ${src.id}`
      );
    }

    for (const dst of runtimeQuestions) {
      assert.strictEqual('aiExplanation' in dst, false, `aiExplanation leaked on ${dst.id}`);
      assert.strictEqual('explanation' in dst, false, `explanation leaked on ${dst.id}`);
    }
  });

  it('Check 3: Byte-for-byte UI rendered output equivalence (renderExplanationHTML) across all 1,079 questions', () => {
    for (let i = 0; i < sourceQuestions.length; i++) {
      const srcHtml = renderExplanationHTML(sourceQuestions[i]);
      const dstHtml = renderExplanationHTML(runtimeQuestions[i]);
      assert.strictEqual(
        dstHtml,
        srcHtml,
        `Rendered explanation HTML differs on question ${sourceQuestions[i].id}`
      );
    }
  });

  it('Check 4: Schema & pedagogical invariants (DATA-01..DATA-05)', () => {
    const validCategories = new Set(VALID_CATEGORIES);
    const seenIds = new Set();

    runtimeQuestions.forEach((q, idx) => {
      const expectedId = `q_${String(idx + 1).padStart(3, '0')}`;
      assert.strictEqual(q.id, expectedId, `Non-sequential ID at index ${idx}: ${q.id}`);
      assert.strictEqual(seenIds.has(q.id), false, `Duplicate ID: ${q.id}`);
      seenIds.add(q.id);

      assert.ok(validCategories.has(q.category), `Invalid category on ${q.id}: ${q.category}`);
      assert.ok(
        Array.isArray(q.options) && q.options.length >= 3 && q.options.length <= 4,
        `Options count out of range on ${q.id}`
      );
      const uniqueOptions = new Set(q.options);
      assert.strictEqual(
        uniqueOptions.size,
        q.options.length,
        `Duplicate option text inside ${q.id}`
      );

      assert.ok(
        Number.isInteger(q.correctIndex) &&
          q.correctIndex >= 0 &&
          q.correctIndex < q.options.length,
        `Invalid correctIndex on ${q.id}`
      );

      assert.ok(
        q.detailedExplanation.includes('הרציונל'),
        `Missing pedagogical rationale header on ${q.id}`
      );
      assert.ok(
        q.detailedExplanation.includes('ניתוח המסיחים'),
        `Missing distractor breakdown header on ${q.id}`
      );
      assert.strictEqual(
        /•\s*(מקור בספרות|עיגון בספרות)/.test(q.detailedExplanation),
        false,
        `Unstripped literature source line on ${q.id}`
      );
    });
  });
});
