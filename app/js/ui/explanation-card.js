/**
 * Explanation Card Component (`app/js/ui/explanation-card.js`)
 * Renders the pedagogical "בשורה אחת" summary, collapsible rationale + distractor accordion,
 * and optional original recovery note while stripping internal literature lines (STUDY-04, SEC-01).
 */

import { extractExplanationViewModel } from '../domain/explanation-parser.js';
import { escapeHTML } from './dom.js';

/**
 * Renders structured explanation HTML for a question object.
 * @param {Object} q - Question object from `questions.json`
 * @returns {string} HTML string
 */
export function renderExplanationHTML(q) {
  const vm = extractExplanationViewModel(q);
  const { shortText, detailedText, hasDetails, rationale, distractors, origText } = vm;

  let html = '<div class="expl-sections-container">';

  html += `
        <div class="expl-short-card">
          <div class="expl-short-badge">💡 בשורה אחת:</div>
          <div class="expl-short-text">${escapeHTML(shortText)}</div>
        </div>
      `;

  if (hasDetails) {
    let contentHtml = '';
    if (rationale) {
      contentHtml += `
            <div class="expl-rationale-block">
              <div class="expl-block-header">🎯 הרציונל הקליני / פדגוגי:</div>
              <div class="expl-block-text">${escapeHTML(rationale).replace(/\n/g, '<br>')}</div>
            </div>
          `;
    }

    if (distractors && distractors.length > 0) {
      const itemsHtml = distractors
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

    if (!contentHtml && detailedText) {
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
