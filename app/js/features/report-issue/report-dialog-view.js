/**
 * Report Issue Modal View (`app/js/features/report-issue/report-dialog-view.js`)
 * Accessible <dialog> modal for signed-in students to report errors on a specific question.
 */

import { REPORT_ISSUE_TYPES, REPORT_LIMITS } from '../../config.js';
import { html, rawHTML } from '../../ui/dom.js';

function getIssueTypesList() {
  return Object.values(REPORT_ISSUE_TYPES);
}

/**
 * Creates the Question Report Modal View controller.
 * @param {Object} deps
 * @param {Document} deps.document
 */
export function createReportDialogView({ document } = {}) {
  let dialogEl = null;
  let currentQuestion = null;
  let currentUser = null;
  let selectedIssueType = 'KEY_ERROR';
  let draftComment = '';
  let errorMessage = '';
  let isSubmitting = false;

  let handlers = {
    onSubmit: null,
    onSignInRequested: null,
  };

  function ensureDialogElement() {
    if (dialogEl) return dialogEl;
    const existing = document.getElementById('reportIssueDialog');
    if (existing) {
      dialogEl = existing;
      return dialogEl;
    }

    dialogEl = document.createElement('dialog');
    dialogEl.id = 'reportIssueDialog';
    dialogEl.className = 'app-dialog report-dialog';
    dialogEl.setAttribute('aria-labelledby', 'reportDialogTitle');
    dialogEl.addEventListener('cancel', (e) => {
      if (isSubmitting) {
        e.preventDefault();
        return;
      }
      close();
    });
    dialogEl.addEventListener('click', (e) => {
      if (e.target === dialogEl && !isSubmitting) {
        close();
      }
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
        // Fallback for synthetic DOM environments (e.g. jsdom)
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
        // Ignore close error in synthetic DOM environments
      }
    }
    el.removeAttribute('open');
  }

  function render() {
    const el = ensureDialogElement();
    if (!currentQuestion) {
      el.innerHTML = '';
      return;
    }

    const q = currentQuestion;
    const isSignedIn = Boolean(currentUser && currentUser.uid);
    const issueTypes = getIssueTypesList();
    const issuePillsHtml = issueTypes
      .map((item) => {
        const isActive = item.id === selectedIssueType;
        return html`
          <button
            type="button"
            class="pill-badge ${isActive ? 'active' : ''}"
            data-issue-type="${item.id}"
            aria-pressed="${isActive ? 'true' : 'false'}"
          >
            <span>${item.icon}</span>
            <span>${item.label}</span>
          </button>
        `;
      })
      .join('');

    const reporterDisplay = isSignedIn
      ? currentUser.displayName || currentUser.email || 'משתמש מחובר'
      : '';

    el.innerHTML = html`
      <div class="report-dialog-header">
        <h2 class="app-dialog-title" id="reportDialogTitle">🚩 דיווח על שגיאה בשאלה</h2>
        <button
          type="button"
          class="dialog-close-btn"
          id="reportDialogCloseBtn"
          aria-label="סגור חלון דיווח"
          ${rawHTML(isSubmitting ? 'disabled' : '')}
        >
          ✕
        </button>
      </div>

      <div class="report-question-preview">
        <div class="report-q-meta">
          <span class="report-q-id-pill">${q.id}</span>
          ${rawHTML(q.category ? html`<span class="badge badge-category">${q.category}</span>` : '')}
          ${rawHTML(q.source ? html`<span class="badge badge-source">${q.source}</span>` : '')}
        </div>
        <div class="report-q-stem">${q.question || ''}</div>
      </div>

      ${rawHTML(
        !isSignedIn
          ? html`
              <div class="report-auth-notice" id="reportAuthNotice">
                <div class="report-auth-notice-title">נדרשת התחברות לשליחת דיווח</div>
                <div>
                  כדי לשמור על אמינות הדיווחים ולמנוע ספאם, יש להתחבר לחשבון Google לפני שליחת דיווח
                  על שאלה.
                </div>
              </div>
              <div class="app-dialog-actions">
                <button type="button" class="btn btn-outline" id="reportCancelBtn">סגור</button>
                <button type="button" class="btn btn-primary" id="reportSignInBtn">
                  התחבר עם Google
                </button>
              </div>
            `
          : html`
              <form id="reportIssueForm" novalidate>
                <fieldset class="report-fieldset">
                  <legend class="form-label">מה הבעיה בשאלה?</legend>
                  <div class="report-issue-pills" id="reportIssuePills">
                    ${rawHTML(issuePillsHtml)}
                  </div>
                </fieldset>

                <div class="report-fieldset">
                  <label class="form-label" for="reportCommentInput">פירוט קצר</label>
                  <textarea
                    id="reportCommentInput"
                    class="report-textarea"
                    maxlength="${String(REPORT_LIMITS.MAX_COMMENT_LENGTH)}"
                    placeholder="הסבר בקצרה מה שגוי (למשל: התשובה הנכונה היא ב׳ לפי הנחיות משרד הבריאות...)"
                    ${rawHTML(isSubmitting ? 'disabled' : '')}
                  >
${draftComment}</textarea>
                  <div class="report-textarea-footer">
                    <span class="report-char-counter" id="reportCharCounter">
                      ${String(draftComment.length)} / ${String(REPORT_LIMITS.MAX_COMMENT_LENGTH)}
                    </span>
                  </div>
                </div>

                <div class="report-reporter-info">
                  מדווח/ת בתור: <strong>${reporterDisplay}</strong>
                  ${rawHTML(currentUser.email ? html` (${currentUser.email})` : '')}
                </div>

                ${rawHTML(
                  errorMessage
                    ? html`<div class="report-alert-error" role="alert" id="reportErrorBox">
                        ${errorMessage}
                      </div>`
                    : ''
                )}

                <div class="app-dialog-actions">
                  <button type="button" class="btn btn-outline" id="reportCancelBtn">ביטול</button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    id="reportSubmitBtn"
                    ${rawHTML(isSubmitting ? 'disabled' : '')}
                  >
                    ${isSubmitting ? 'שולח דיווח...' : 'שלח דיווח'}
                  </button>
                </div>
              </form>
            `
      )}
    `;

    bindEvents(el);
  }

  function bindEvents(el) {
    const closeBtn = el.querySelector('#reportDialogCloseBtn');
    const cancelBtn = el.querySelector('#reportCancelBtn');
    const signInBtn = el.querySelector('#reportSignInBtn');
    const pillsContainer = el.querySelector('#reportIssuePills');
    const textarea = el.querySelector('#reportCommentInput');
    const counter = el.querySelector('#reportCharCounter');
    const form = el.querySelector('#reportIssueForm');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        close();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        close();
      });
    }
    if (signInBtn) {
      signInBtn.addEventListener('click', () => {
        if (typeof handlers.onSignInRequested === 'function') {
          handlers.onSignInRequested();
        }
      });
    }
    if (pillsContainer) {
      pillsContainer.addEventListener('click', (e) => {
        if (isSubmitting) return;
        const btn = e.target.closest('button[data-issue-type]');
        if (!btn) return;
        selectedIssueType = btn.dataset.issueType || 'OTHER';
        errorMessage = '';
        pillsContainer.querySelectorAll('button[data-issue-type]').forEach((pill) => {
          const active = pill.dataset.issueType === selectedIssueType;
          pill.classList.toggle('active', active);
          pill.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      });
    }
    if (textarea) {
      textarea.addEventListener('input', () => {
        draftComment = textarea.value;
        if (counter) {
          counter.textContent = `${draftComment.length} / ${REPORT_LIMITS.MAX_COMMENT_LENGTH}`;
        }
        if (errorMessage) {
          errorMessage = '';
          const errBox = el.querySelector('#reportErrorBox');
          if (errBox) errBox.remove();
        }
      });
    }
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting || typeof handlers.onSubmit !== 'function') return;
        await handlers.onSubmit({
          question: currentQuestion,
          issueType: selectedIssueType,
          comment: textarea ? textarea.value : draftComment,
        });
      });
    }
  }

  function open({ question, user, onSubmit, onSignInRequested } = {}) {
    currentQuestion = question || null;
    currentUser = user || null;
    selectedIssueType = 'KEY_ERROR';
    draftComment = '';
    errorMessage = '';
    isSubmitting = false;
    handlers = { onSubmit, onSignInRequested };

    const el = ensureDialogElement();
    render();
    showModalDialog(el);

    const textarea = el.querySelector('#reportCommentInput');
    if (textarea) {
      textarea.focus();
    } else {
      const signInBtn = el.querySelector('#reportSignInBtn');
      if (signInBtn) signInBtn.focus();
    }
  }

  function updateUser(user) {
    currentUser = user || null;
    if (dialogEl && (dialogEl.open || dialogEl.hasAttribute('open'))) {
      render();
    }
  }

  function setSubmitting(submitting) {
    isSubmitting = Boolean(submitting);
    if (dialogEl && (dialogEl.open || dialogEl.hasAttribute('open'))) {
      render();
    }
  }

  function setError(message) {
    errorMessage = message || '';
    if (dialogEl && (dialogEl.open || dialogEl.hasAttribute('open'))) {
      render();
      const textarea = dialogEl.querySelector('#reportCommentInput');
      if (textarea) textarea.focus();
    }
  }

  function close() {
    isSubmitting = false;
    closeModalDialog(dialogEl);
  }

  function isOpen() {
    return Boolean(dialogEl && (dialogEl.open || dialogEl.hasAttribute('open')));
  }

  return {
    open,
    close,
    updateUser,
    setSubmitting,
    setError,
    isOpen,
  };
}
