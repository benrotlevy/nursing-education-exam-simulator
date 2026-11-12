/**
 * Exam Feature View (`app/js/features/exam/exam-view.js`)
 * Pure DOM rendering functions for Exam Setup, Active Exam, Quick Grid, and Exam Results screens.
 */

import { OPTION_LETTERS } from '../../config.js';
import { getShuffledQuestionOptions } from '../../domain/shuffle.js';
import { escapeHTML } from '../../ui/dom.js';
import { renderExplanationHTML } from '../../ui/explanation-card.js';

export function populateExamSetupSelectors({
  document = globalThis.document,
  sources = [],
  categories = [],
} = {}) {
  const sourceSelect = document?.getElementById('examSourceSelect');
  if (sourceSelect) {
    sourceSelect.innerHTML = '<option value="ALL">כל המאגר מעורבב (מומלץ ביותר)</option>';
    for (const src of sources) {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = src;
      sourceSelect.appendChild(opt);
    }
  }

  const examCatSelect = document?.getElementById('examCategorySelect');
  if (examCatSelect) {
    examCatSelect.innerHTML = '<option value="ALL">כל הנושאים</option>';
    for (const cat of categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      examCatSelect.appendChild(opt);
    }
  }
}

export function renderActiveExamQuestion({ document = globalThis.document, exam } = {}) {
  if (!exam || !Array.isArray(exam.questions)) return;
  const q = exam.questions[exam.currentIndex];
  if (!q) return;

  const abandonBtn = document?.querySelector('.btn-abandon-exam');
  if (abandonBtn && !abandonBtn.id) {
    abandonBtn.id = 'btnAbandonExam';
  }

  const total = exam.questions.length;
  const curNum = exam.currentIndex + 1;
  const progressCountEl = document?.getElementById('examProgressCount');
  if (progressCountEl) {
    progressCountEl.textContent = `שאלה ${curNum} מתוך ${total}`;
  }

  const answeredCount = Object.keys(exam.userAnswers || {}).length;
  const answeredCountEl = document?.getElementById('examAnsweredCount');
  if (answeredCountEl) {
    answeredCountEl.textContent = `נענו: ${answeredCount} מתוך ${total}`;
  }

  const progressBarEl = document?.getElementById('examProgressBar');
  if (progressBarEl) {
    progressBarEl.style.width = `${(answeredCount / total) * 100}%`;
  }

  const catEl = document?.getElementById('examQCategory');
  if (catEl) catEl.textContent = q.category || 'כללי';

  const srcEl = document?.getElementById('examQSource');
  if (srcEl) srcEl.textContent = q.source || 'שחזור מבחן';

  const unverifiedEl = document?.getElementById('examQUnverified');
  if (unverifiedEl) {
    unverifiedEl.style.display = q.verified === false ? 'inline-flex' : 'none';
  }

  const flagBtn = document?.getElementById('examFlagBtn');
  if (flagBtn) {
    if (exam.flagged instanceof Set && exam.flagged.has(exam.currentIndex)) {
      flagBtn.classList.add('flagged');
      flagBtn.innerHTML = '<span>★</span> מסומן לעיון';
    } else {
      flagBtn.classList.remove('flagged');
      flagBtn.innerHTML = '<span>☆</span> סימון לעיון חוזר';
    }
  }

  const qTextEl = document?.getElementById('examQText');
  if (qTextEl) qTextEl.textContent = q.question;

  const shuffledData =
    exam.shuffledOptionsCache?.[exam.currentIndex] || getShuffledQuestionOptions(q);
  const container = document?.getElementById('examOptionsContainer');
  if (container) {
    container.innerHTML = '';
    const eliminatedSet =
      exam.eliminated && exam.eliminated[exam.currentIndex] instanceof Set
        ? exam.eliminated[exam.currentIndex]
        : new Set();

    shuffledData.options.forEach((optText, optIdx) => {
      const item = document.createElement('div');
      item.className = 'option-item';
      item.setAttribute('data-action', 'select-exam-option');
      item.setAttribute('data-index', String(optIdx));

      const isSelected = exam.userAnswers?.[exam.currentIndex] === optIdx;
      if (isSelected) {
        item.classList.add('selected');
      }
      const isEliminated = eliminatedSet.has(optIdx);
      if (isEliminated) {
        item.classList.add('eliminated');
      }

      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
      item.innerHTML = `
        <div class="option-letter">${escapeHTML(letter)}</div>
        <div class="option-content">${escapeHTML(optText)}</div>
        <button type="button" class="btn-eliminate-option" data-action="toggle-eliminate-option" data-index="${optIdx}" title="${isEliminated ? 'בטל פסילת מסיח' : 'פסול מסיח (סימון קו חוצה)'}" aria-label="פסילת מסיח">
          ✕
        </button>
      `;
      container.appendChild(item);
    });
  }

  const prevBtn = document?.getElementById('btnPrevExam');
  if (prevBtn) {
    prevBtn.style.visibility = exam.currentIndex === 0 ? 'hidden' : 'visible';
  }
  const isLast = exam.currentIndex === total - 1;
  const nextBtn = document?.getElementById('btnNextExam');
  if (nextBtn) {
    nextBtn.style.display = isLast ? 'none' : 'inline-flex';
  }
  const submitBtn = document?.getElementById('btnSubmitExam');
  if (submitBtn) {
    submitBtn.style.display = isLast ? 'inline-flex' : 'none';
  }

  updateQuickGridActive({ document, currentIndex: exam.currentIndex });
}

export function renderExamQuickGrid({ document = globalThis.document, exam } = {}) {
  const grid = document?.getElementById('examQuickGrid');
  if (!grid || !exam || !Array.isArray(exam.questions)) return;
  grid.innerHTML = '';

  exam.questions.forEach((_, idx) => {
    const cell = document.createElement('div');
    cell.className = 'grid-cell grid-q-btn';
    cell.setAttribute('data-action', 'jump-exam-question');
    cell.setAttribute('data-index', String(idx));
    cell.textContent = String(idx + 1);

    if (Object.prototype.hasOwnProperty.call(exam.userAnswers || {}, idx)) {
      cell.classList.add('answered');
    }
    if (exam.flagged instanceof Set && exam.flagged.has(idx)) {
      cell.classList.add('flagged');
    }
    if (idx === exam.currentIndex) {
      cell.classList.add('active');
    }

    grid.appendChild(cell);
  });
}

export function updateQuickGridActive({ document = globalThis.document, currentIndex = 0 } = {}) {
  const cells = document?.querySelectorAll('#examQuickGrid .grid-cell');
  if (!cells) return;
  cells.forEach((cell, idx) => {
    if (idx === currentIndex) {
      cell.classList.add('active');
    } else {
      cell.classList.remove('active');
    }
  });
}

export function renderExamResultsView({
  document = globalThis.document,
  exam,
  scorePct = 0,
  correctCount = 0,
  total = 0,
} = {}) {
  const scoreValEl = document?.getElementById('resScoreVal');
  if (scoreValEl) scoreValEl.textContent = `${scorePct}%`;

  const correctCountEl = document?.getElementById('resCorrectCount');
  if (correctCountEl) correctCountEl.textContent = String(correctCount);

  const wrongCountEl = document?.getElementById('resWrongCount');
  if (wrongCountEl) wrongCountEl.textContent = String(total - correctCount);

  const totalCountEl = document?.getElementById('resTotalCount');
  if (totalCountEl) totalCountEl.textContent = String(total);

  const titleMsgEl = document?.getElementById('resTitleMsg');
  if (titleMsgEl) {
    if (scorePct >= 85) {
      titleMsgEl.textContent = '🌟 תוצאה מעולה! מוכנות גבוהה למבחן!';
    } else if (scorePct >= 70) {
      titleMsgEl.textContent = '👍 עבודה טובה! עם עוד קצת תרגול זה יהיה מושלם.';
    } else {
      titleMsgEl.textContent = '💪 התחלה טובה! כדאי לחזור על השאלות שטעית בהן.';
    }
  }

  const banner = document?.getElementById('savedExamResultsBanner');
  if (banner) {
    banner.style.display = exam?.isSavedExam && exam?.savedExamId ? 'flex' : 'none';
  }

  renderExamReviewList({ document, exam });
}

export function renderExamReviewList({ document = globalThis.document, exam } = {}) {
  const list = document?.getElementById('examReviewList');
  if (!list || !exam || !Array.isArray(exam.questions)) return;

  const cardsHtml = exam.questions
    .map((q, idx) => {
      const userChoice = exam.userAnswers?.[idx];
      const shuffledData = exam.shuffledOptionsCache?.[idx] || getShuffledQuestionOptions(q);
      const isCorrect = userChoice !== undefined && userChoice === shuffledData.correctIndex;

      const statusText = isCorrect
        ? '<span class="u-text-success u-fw-800">✔ תשובה נכונה</span>'
        : '<span class="u-text-danger u-fw-800">✖ שגיאה</span>';

      const optionsHtml = shuffledData.options
        .map((opt, oIdx) => {
          let itemClass = 'review-opt-item';
          let badgeHtml;
          if (oIdx === shuffledData.correctIndex) {
            itemClass += ' opt-correct';
            badgeHtml = '<span class="option-status-badge badge-correct">✓ תשובה נכונה</span>';
          } else if (oIdx === userChoice && !isCorrect) {
            itemClass += ' opt-wrong';
            badgeHtml = '<span class="option-status-badge badge-wrong">✕ הבחירה שלך</span>';
          } else {
            badgeHtml = '<span class="option-status-badge badge-distractor">✕ מסיח שגוי</span>';
          }
          const letter = OPTION_LETTERS[oIdx] || String(oIdx + 1);
          return `
            <div class="${itemClass}">
              <div class="option-letter">${escapeHTML(letter)}</div>
              <div class="option-content">${escapeHTML(opt)}</div>
              ${badgeHtml}
            </div>
          `;
        })
        .join('');

      return `
        <div class="review-item ${isCorrect ? 'was-correct' : 'was-wrong'}">
          <div class="review-item-header">
            <span class="review-item-meta">שאלה ${idx + 1} &bull; ${escapeHTML(q.category)}</span>
            ${statusText}
          </div>
          <div class="review-item-question">${escapeHTML(q.question)}</div>
          <div class="review-item-options">
            ${optionsHtml}
          </div>
          ${renderExplanationHTML(q)}
        </div>
      `;
    })
    .join('');

  list.innerHTML = cardsHtml;
}
