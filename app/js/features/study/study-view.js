/**
 * Study Mode Feature View (`app/js/features/study/study-view.js`)
 * Pure DOM rendering for Study Mode deck, immediate feedback options, and pedagogical explanation box.
 */

import { OPTION_LETTERS } from '../../config.js';
import { getShuffledQuestionOptions } from '../../domain/shuffle.js';
import { escapeHTML } from '../../ui/dom.js';
import { renderExplanationHTML } from '../../ui/explanation-card.js';

export function populateStudyCategorySelector({
  document = globalThis.document,
  categories = [],
} = {}) {
  const studyCatSelect = document?.getElementById('studyCategoryFilter');
  if (studyCatSelect) {
    studyCatSelect.innerHTML = '<option value="ALL">כל הנושאים</option>';
    for (const cat of categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      studyCatSelect.appendChild(opt);
    }
  }
}

export function syncStudyFilterControls({ document = globalThis.document, study } = {}) {
  if (!study) return;
  const catSelect = document?.getElementById('studyCategoryFilter');
  if (catSelect) {
    catSelect.value = study.selectedCategory || 'ALL';
  }
  const btnMistakes = document?.getElementById('btnStudyMistakesOnly');
  if (btnMistakes) {
    if (study.mistakesOnly) {
      btnMistakes.classList.add('btn-primary');
      btnMistakes.classList.remove('btn-outline');
    } else {
      btnMistakes.classList.remove('btn-primary');
      btnMistakes.classList.add('btn-outline');
    }
  }
}

export function renderStudyQuestionView({ document = globalThis.document, study } = {}) {
  if (!study) return;
  const total = Array.isArray(study.questions) ? study.questions.length : 0;

  const totalCountEl = document?.getElementById('studyTotalCount');
  if (totalCountEl) totalCountEl.textContent = String(total);

  const box = document?.getElementById('studyExplanationBox');

  if (total === 0) {
    box?.classList.remove('visible');
    const curIdxEl = document?.getElementById('studyCurrentIndex');
    if (curIdxEl) curIdxEl.textContent = '0';
    const qTextEl = document?.getElementById('studyQText');
    if (qTextEl) {
      qTextEl.textContent = study.mistakesOnly
        ? 'מאגר הטעויות שלך ריק כרגע! כל הכבוד 🎉'
        : 'אין שאלות בקטגוריה זו.';
    }
    const container = document?.getElementById('studyOptionsContainer');
    if (container) container.innerHTML = '';
    return;
  }

  const q = study.questions[study.currentIndex];
  if (!q) return;

  const curIdxEl = document?.getElementById('studyCurrentIndex');
  if (curIdxEl) curIdxEl.textContent = String(study.currentIndex + 1);

  const catEl = document?.getElementById('studyQCategory');
  if (catEl) catEl.textContent = q.category || 'כללי';

  const srcEl = document?.getElementById('studyQSource');
  if (srcEl) srcEl.textContent = q.source || 'שחזור';

  const unverifiedEl = document?.getElementById('studyQUnverified');
  if (unverifiedEl) {
    unverifiedEl.style.display = q.verified === false ? 'inline-flex' : 'none';
  }

  const qTextEl = document?.getElementById('studyQText');
  if (qTextEl) qTextEl.textContent = q.question;

  const shuffledData =
    study.shuffledOptionsCache?.[study.currentIndex] || getShuffledQuestionOptions(q);
  const container = document?.getElementById('studyOptionsContainer');
  const prevAnswer = study.userAnswers ? study.userAnswers[study.currentIndex] : undefined;
  const isAnswered = prevAnswer !== undefined;

  if (container) {
    container.innerHTML = '';

    shuffledData.options.forEach((optText, optIdx) => {
      const item = document.createElement('div');
      item.className = 'option-item';
      item.id = `studyOpt_${optIdx}`;

      let badgeHtml = '';
      if (isAnswered) {
        item.classList.add('disabled');
        if (optIdx === shuffledData.correctIndex) {
          item.classList.add('correct');
          badgeHtml = '<span class="option-status-badge badge-correct">✓ תשובה נכונה</span>';
        } else if (optIdx === prevAnswer) {
          item.classList.add('wrong');
          badgeHtml = '<span class="option-status-badge badge-wrong">✕ הבחירה שלך</span>';
        } else {
          badgeHtml = '<span class="option-status-badge badge-distractor">✕ מסיח שגוי</span>';
        }
      } else {
        item.setAttribute('data-action', 'answer-study-option');
        item.setAttribute('data-index', String(optIdx));
      }

      const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
      item.innerHTML = `
        <div class="option-letter">${escapeHTML(letter)}</div>
        <div class="option-content">${escapeHTML(optText)}</div>
        ${badgeHtml}
      `;
      container.appendChild(item);
    });
  }

  if (isAnswered && box) {
    const isCorrect = prevAnswer === shuffledData.correctIndex;
    const explHeader = document?.getElementById('studyExplanationHeader');
    const explText = document?.getElementById('studyExplanationText');

    if (explHeader) {
      if (isCorrect) {
        explHeader.innerHTML = '✅ נכון מאוד! כל הכבוד:';
        explHeader.style.color = '#166534';
      } else {
        explHeader.innerHTML = '❌ לא מדויק. להלן ההסבר המלא:';
        explHeader.style.color = '#991b1b';
      }
    }

    if (explText) {
      explText.innerHTML = renderExplanationHTML(q);
    }
    box.classList.add('visible');
  } else if (box) {
    box.classList.remove('visible');
  }
}
