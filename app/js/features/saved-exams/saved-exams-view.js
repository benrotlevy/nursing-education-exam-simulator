/**
 * Saved Exams & Quarantine Zone View (`app/js/features/saved-exams/saved-exams-view.js`)
 * Pure DOM rendering for Saved Exams slots, metrics banner, and available full exams selector.
 */

import { getQuarantinedQuestionIdSet, getAvailableFullExams } from '../../domain/question-pool.js';
import { escapeHTML } from '../../ui/dom.js';

export function renderSavedExamsView({
  document = globalThis.document,
  allQuestions = [],
  savedExams = [],
} = {}) {
  const listEl = document?.getElementById('savedExamsList');
  const slotsCountEl = document?.getElementById('savedSlotsCount');
  const quarantinedCountEl = document?.getElementById('savedQuarantinedCount');
  const activePoolCountEl = document?.getElementById('savedActivePoolCount');
  const addSectionEl = document?.getElementById('savedAddSection');
  const limitNoticeEl = document?.getElementById('savedLimitReachedNotice');
  const selectEl = document?.getElementById('savedExamSourceSelect');

  const savedCount = Array.isArray(savedExams) ? savedExams.length : 0;
  const quarantinedSet = getQuarantinedQuestionIdSet(savedExams);
  const quarantinedCount = quarantinedSet.size;
  const totalCount = Array.isArray(allQuestions) ? allQuestions.length : 0;
  const activeCount = Math.max(0, totalCount - quarantinedCount);

  if (slotsCountEl) slotsCountEl.textContent = `${savedCount} / 3`;
  if (quarantinedCountEl) quarantinedCountEl.textContent = String(quarantinedCount);
  if (activePoolCountEl) activePoolCountEl.textContent = String(activeCount);

  if (savedCount >= 3) {
    if (addSectionEl) addSectionEl.style.display = 'none';
    if (limitNoticeEl) limitNoticeEl.style.display = 'block';
  } else {
    if (addSectionEl) addSectionEl.style.display = 'block';
    if (limitNoticeEl) limitNoticeEl.style.display = 'none';

    if (selectEl) {
      selectEl.innerHTML = '';
      const availableExams = getAvailableFullExams(allQuestions, savedExams);
      if (availableExams.length === 0) {
        selectEl.innerHTML = '<option value="">אין מבחנים נוספים זמינים לשמירה</option>';
      } else {
        availableExams.forEach((e) => {
          const opt = document.createElement('option');
          opt.value = e.sourceName;
          opt.textContent = `${e.sourceName} (${e.questionCount} שאלות)`;
          selectEl.appendChild(opt);
        });
      }
    }
  }

  if (!listEl) return;
  listEl.innerHTML = '';

  if (savedCount === 0) {
    listEl.innerHTML = `
      <div class="saved-empty-state">
        <div class="saved-empty-icon">📦</div>
        <div class="saved-empty-title">עדיין לא שמרת מבחנים בצד</div>
        <div class="saved-empty-desc">בחר מבחן מהתפריט למעלה ולחץ על "שמור ונעל מבחן זה" כדי לבודד אותו למועד מאוחר יותר.</div>
      </div>
    `;
    return;
  }

  savedExams.forEach((slot) => {
    const card = document.createElement('div');
    card.className = 'saved-slot-card';

    const statusBadge =
      slot.status === 'COMPLETED'
        ? `<span class="badge badge-saved-completed">✔ הושלם (ציון: ${escapeHTML(slot.score)}%)</span>`
        : '<span class="badge badge-saved-ready">🔒 שמור ומבודד • טרם נפתר</span>';

    const dateStr = slot.savedAt ? new Date(slot.savedAt).toLocaleDateString('he-IL') : '';

    card.innerHTML = `
      <div class="saved-slot-info">
        <div class="saved-slot-title">
          <span>📋 ${escapeHTML(slot.title)}</span>
          ${statusBadge}
        </div>
        <div class="saved-slot-meta">
          <span>🔢 ${escapeHTML(slot.questionCount)} שאלות מבודדות</span>
          <span>📅 נשמר בתאריך: ${escapeHTML(dateStr)}</span>
        </div>
      </div>
      <div class="saved-slot-actions">
        <button type="button" class="btn btn-primary" data-action="start-saved-exam" data-id="${escapeHTML(slot.id)}">
          🚀 ${slot.status === 'COMPLETED' ? 'תרגל שוב מבחן מלא זה' : 'התחל מבחן מלא עכשיו'}
        </button>
        <button type="button" class="btn btn-outline btn-outline-danger" data-action="release-saved-exam" data-id="${escapeHTML(slot.id)}" title="שחרור שאלות מבחן זה חזרה למאגר הכללי">
          🔓 שחרר שאלות חזרה למאגר
        </button>
      </div>
    `;
    listEl.appendChild(card);
  });
}
