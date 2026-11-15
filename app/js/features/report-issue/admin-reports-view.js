/**
 * Admin Reports Dashboard View (`app/js/features/report-issue/admin-reports-view.js`)
 * Renders the administrator moderation dashboard (<dialog>) and header badge count.
 */

import { OPTION_LETTERS, REPORT_STATUSES } from '../../config.js';
import {
  countReportsByStatus,
  filterReportsByStatus,
  getIssueTypeMeta,
  isAdminUser,
} from '../../domain/question-report.js';
import { html, rawHTML } from '../../ui/dom.js';

const STATUS_LABELS = Object.freeze({
  OPEN: 'פתוח',
  RESOLVED: 'תוקן',
  DISMISSED: 'נדחה',
});

function formatReportDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    return d.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Shows/hides the admin dashboard button and updates its open-reports counter badge.
 */
export function updateAdminHeaderBadge({
  document = globalThis.document,
  user,
  openCount = 0,
} = {}) {
  if (!document) return;
  const btn = document.getElementById('btnAdminReports');
  const badge = document.getElementById('adminReportsBadge');
  const authorized = isAdminUser(user);

  if (btn) {
    btn.style.display = authorized ? 'inline-flex' : 'none';
  }
  if (badge) {
    const cleanCount = Number.isFinite(Number(openCount)) ? Math.max(0, Number(openCount)) : 0;
    badge.textContent = String(cleanCount);
    badge.style.display = cleanCount > 0 ? 'inline-flex' : 'none';
  }
}

/**
 * Creates the Admin Reports Dashboard View controller.
 * @param {Object} deps
 * @param {Document} deps.document
 */
export function createAdminReportsView({ document } = {}) {
  let dialogEl = null;
  let allReports = [];
  let questionsById = new Map();
  let activeFilter = REPORT_STATUSES.OPEN;
  let isLoading = false;
  let busyReportId = null;

  let handlers = {
    onRefresh: null,
    onCopy: null,
    onUpdateStatus: null,
    onDelete: null,
  };

  function ensureDialogElement() {
    if (dialogEl) return dialogEl;
    const existing = document.getElementById('adminReportsDialog');
    if (existing) {
      dialogEl = existing;
      return dialogEl;
    }

    dialogEl = document.createElement('dialog');
    dialogEl.id = 'adminReportsDialog';
    dialogEl.className = 'app-dialog admin-dialog';
    dialogEl.setAttribute('aria-labelledby', 'adminDialogTitle');
    dialogEl.addEventListener('cancel', () => close());
    dialogEl.addEventListener('click', (e) => {
      if (e.target === dialogEl) close();
    });
    document.body.appendChild(dialogEl);
    return dialogEl;
  }

  function showModalDialog(el) {
    if (typeof el.showModal === 'function') {
      try {
        if (!el.open) el.showModal();
        return;
      } catch {
        // Fallback for jsdom
      }
    }
    el.setAttribute('open', 'open');
  }

  function closeModalDialog(el) {
    if (!el) return;
    if (typeof el.close === 'function') {
      try {
        if (el.open) el.close();
      } catch {
        // Fallback for jsdom
      }
    }
    el.removeAttribute('open');
  }

  function renderQuestionDetails(report) {
    const fullQ = questionsById.get(report.questionId) || null;
    if (!fullQ) {
      return html`
        <details class="admin-question-details">
          <summary>הצג תצוגה מקדימה של השאלה</summary>
          <div class="admin-question-full">${report.questionText || 'אין טקסט שמור לשאלה זו.'}</div>
        </details>
      `;
    }

    const optionsHtml = Array.isArray(fullQ.options)
      ? fullQ.options
          .map((opt, idx) => {
            const letter = OPTION_LETTERS[idx] || String(idx + 1);
            const isCorrect = idx === fullQ.correctIndex;
            return html`
              <li class="${isCorrect ? 'is-correct' : ''}">
                <strong>${letter}.</strong> ${opt} ${isCorrect ? '✓' : ''}
              </li>
            `;
          })
          .join('')
      : '';

    return html`
      <details class="admin-question-details">
        <summary>הצג נוסח שאלה ואפשרויות (${fullQ.id})</summary>
        <div class="admin-question-full">
          <div>${fullQ.question || ''}</div>
          <ul class="admin-options-preview">
            ${rawHTML(optionsHtml)}
          </ul>
        </div>
      </details>
    `;
  }

  function renderReportCard(report) {
    const status = STATUS_LABELS[report.status] ? report.status : REPORT_STATUSES.OPEN;
    const issueMeta = getIssueTypeMeta(report.issueType);
    const isBusy = busyReportId === report.id;
    const disabledAttr = isBusy ? 'disabled' : '';

    return html`
      <article class="admin-report-card status-${status}" data-report-id="${report.id}">
        <div class="admin-report-card-header">
          <div class="admin-report-badges">
            <span class="admin-status-pill status-${status}">${STATUS_LABELS[status]}</span>
            <span class="report-q-id-pill">${report.questionId}</span>
            <span class="badge badge-category">${issueMeta.icon} ${issueMeta.label}</span>
            ${rawHTML(
              report.category
                ? html`<span class="badge badge-source">${report.category}</span>`
                : ''
            )}
          </div>
          <span class="admin-report-date">${formatReportDate(report.createdAt)}</span>
        </div>

        <div class="admin-report-comment">${report.comment || ''}</div>

        <div class="admin-report-reporter">
          מדווח/ת: <strong>${report.reporterName || 'לא צוין'}</strong>
          ${rawHTML(report.reporterEmail ? html` (${report.reporterEmail})` : '')}
          ${rawHTML(report.source ? html` &bull; מקור: ${report.source}` : '')}
        </div>

        ${rawHTML(renderQuestionDetails(report))}

        <div class="admin-report-actions">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            data-admin-action="copy"
            data-report-id="${report.id}"
            ${rawHTML(disabledAttr)}
          >
            📋 העתק לצורך תיקון
          </button>
          ${rawHTML(
            status !== REPORT_STATUSES.RESOLVED
              ? html`
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    data-admin-action="resolve"
                    data-report-id="${report.id}"
                    ${rawHTML(disabledAttr)}
                  >
                    ✅ סמן כתוקן
                  </button>
                `
              : ''
          )}
          ${rawHTML(
            status !== REPORT_STATUSES.DISMISSED
              ? html`
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    data-admin-action="dismiss"
                    data-report-id="${report.id}"
                    ${rawHTML(disabledAttr)}
                  >
                    🚫 דחה
                  </button>
                `
              : ''
          )}
          ${rawHTML(
            status !== REPORT_STATUSES.OPEN
              ? html`
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    data-admin-action="reopen"
                    data-report-id="${report.id}"
                    ${rawHTML(disabledAttr)}
                  >
                    ↩️ פתח מחדש
                  </button>
                `
              : ''
          )}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            data-admin-action="delete"
            data-report-id="${report.id}"
            ${rawHTML(disabledAttr)}
          >
            🗑️ מחק
          </button>
        </div>
      </article>
    `;
  }

  function render() {
    const el = ensureDialogElement();
    const counts = countReportsByStatus(allReports);
    const filtered = filterReportsByStatus(allReports, activeFilter);

    const filterChips = [
      { id: REPORT_STATUSES.OPEN, label: 'פתוחים', count: counts.OPEN },
      { id: REPORT_STATUSES.RESOLVED, label: 'תוקנו', count: counts.RESOLVED },
      { id: REPORT_STATUSES.DISMISSED, label: 'נדחו', count: counts.DISMISSED },
      { id: 'ALL', label: 'הכל', count: counts.total },
    ];

    const chipsHtml = filterChips
      .map((chip) => {
        const isActive = activeFilter === chip.id;
        return html`
          <button
            type="button"
            class="admin-filter-chip ${isActive ? 'active' : ''}"
            data-admin-filter="${chip.id}"
            aria-pressed="${isActive ? 'true' : 'false'}"
          >
            <span>${chip.label}</span>
            <span>(${String(chip.count)})</span>
          </button>
        `;
      })
      .join('');

    let bodyHtml;
    if (isLoading) {
      bodyHtml = '<div class="admin-empty-state">טוען דיווחים...</div>';
    } else if (filtered.length === 0) {
      bodyHtml = '<div class="admin-empty-state">אין דיווחים בקטגוריה זו כרגע 🎉</div>';
    } else {
      bodyHtml = `<div class="admin-reports-list">${filtered.map(renderReportCard).join('')}</div>`;
    }

    el.innerHTML = html`
      <div class="report-dialog-header">
        <h2 class="app-dialog-title" id="adminDialogTitle">🛡️ ניהול דיווחי שגיאות</h2>
        <div class="q-header-actions">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            id="adminRefreshBtn"
            ${rawHTML(isLoading ? 'disabled' : '')}
          >
            🔄 רענן
          </button>
          <button
            type="button"
            class="dialog-close-btn"
            id="adminDialogCloseBtn"
            aria-label="סגור לוח דיווחים"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="admin-filter-bar" id="adminFilterBar">${rawHTML(chipsHtml)}</div>

      ${rawHTML(bodyHtml)}
    `;

    bindEvents(el);
  }

  function bindEvents(el) {
    const closeBtn = el.querySelector('#adminDialogCloseBtn');
    const refreshBtn = el.querySelector('#adminRefreshBtn');
    const filterBar = el.querySelector('#adminFilterBar');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => close());
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (typeof handlers.onRefresh === 'function') handlers.onRefresh();
      });
    }
    if (filterBar) {
      filterBar.addEventListener('click', (e) => {
        const chip = e.target.closest('button[data-admin-filter]');
        if (!chip) return;
        activeFilter = chip.dataset.adminFilter || 'ALL';
        render();
      });
    }

    el.querySelectorAll('button[data-admin-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.adminAction;
        const reportId = btn.dataset.reportId;
        const report = allReports.find((r) => r.id === reportId);
        if (!report) return;

        if (action === 'copy' && typeof handlers.onCopy === 'function') {
          await handlers.onCopy(report, questionsById.get(report.questionId) || null);
        } else if (action === 'resolve' && typeof handlers.onUpdateStatus === 'function') {
          await handlers.onUpdateStatus(report, REPORT_STATUSES.RESOLVED);
        } else if (action === 'dismiss' && typeof handlers.onUpdateStatus === 'function') {
          await handlers.onUpdateStatus(report, REPORT_STATUSES.DISMISSED);
        } else if (action === 'reopen' && typeof handlers.onUpdateStatus === 'function') {
          await handlers.onUpdateStatus(report, REPORT_STATUSES.OPEN);
        } else if (action === 'delete' && typeof handlers.onDelete === 'function') {
          await handlers.onDelete(report);
        }
      });
    });
  }

  function open({ reports = [], allQuestions = [], loading = false, callbacks = {} } = {}) {
    allReports = Array.isArray(reports) ? reports : [];
    questionsById = new Map(
      (Array.isArray(allQuestions) ? allQuestions : []).filter((q) => q?.id).map((q) => [q.id, q])
    );
    isLoading = Boolean(loading);
    busyReportId = null;
    handlers = { ...handlers, ...callbacks };

    const el = ensureDialogElement();
    render();
    showModalDialog(el);
  }

  function setLoading(loading, reports = null) {
    isLoading = Boolean(loading);
    if (Array.isArray(reports)) {
      allReports = reports;
    }
    if (isOpen()) render();
  }

  function setReports(reports, allQuestions = null) {
    allReports = Array.isArray(reports) ? reports : [];
    if (Array.isArray(allQuestions)) {
      questionsById = new Map(allQuestions.filter((q) => q?.id).map((q) => [q.id, q]));
    }
    isLoading = false;
    busyReportId = null;
    if (isOpen()) render();
  }

  function setBusyReport(reportId) {
    busyReportId = reportId || null;
    if (isOpen()) render();
  }

  function close() {
    closeModalDialog(dialogEl);
  }

  function isOpen() {
    return Boolean(dialogEl && (dialogEl.open || dialogEl.hasAttribute('open')));
  }

  return {
    open,
    close,
    setLoading,
    setReports,
    setBusyReport,
    isOpen,
  };
}
