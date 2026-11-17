/**
 * Admin Dashboard View (`app/js/features/report-issue/admin-reports-view.js`)
 * Renders the tabbed administrator modal (<dialog>) for Question Issue Reports
 * and Invite-Only Access Control Management, plus the header badge counter.
 */

import { OPTION_LETTERS, REPORT_STATUSES } from '../../config.js';
import { countAllowedUsersByStatus, filterAllowedUsers } from '../../domain/access-control.js';
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

const USER_STATUS_LABELS = Object.freeze({
  PENDING: 'ממתין לאישור',
  APPROVED: 'מורשה פעיל',
  REVOKED: 'גישה מושהית',
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
 * Shows/hides the admin dashboard button and updates its total actionable counter badge
 * (open reports + pending access requests).
 */
export function updateAdminHeaderBadge({
  document = globalThis.document,
  user,
  openCount = 0,
  pendingUsersCount = 0,
} = {}) {
  if (!document) return;
  const btn = document.getElementById('btnAdminReports');
  const badge = document.getElementById('adminReportsBadge');
  const authorized = isAdminUser(user);

  if (btn) {
    btn.style.display = authorized ? 'inline-flex' : 'none';
  }
  if (badge) {
    const cleanOpen = Number.isFinite(Number(openCount)) ? Math.max(0, Number(openCount)) : 0;
    const cleanPending = Number.isFinite(Number(pendingUsersCount))
      ? Math.max(0, Number(pendingUsersCount))
      : 0;
    const totalCount = cleanOpen + cleanPending;
    badge.textContent = String(totalCount);
    badge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
  }
}

/**
 * Creates the Admin Dashboard View controller.
 * @param {Object} deps
 * @param {Document} deps.document
 */
export function createAdminReportsView({ document } = {}) {
  let dialogEl = null;
  let allReports = [];
  let allUsers = [];
  let questionsById = new Map();
  let activeTab = 'reports'; // 'reports' | 'users'
  let activeFilter = REPORT_STATUSES.OPEN;
  let activeUserFilter = 'ALL';
  let userSearchQuery = '';
  let configStatus = { hasCatalogKey: false, telegramUrl: '' };
  let configDetailsOpen = false;
  let isLoading = false;
  let isUsersLoading = false;
  let busyReportId = null;
  let busyUserEmail = null;

  let handlers = {
    onRefresh: null,
    onCopy: null,
    onUpdateStatus: null,
    onDelete: null,
    onRefreshUsers: null,
    onAddUser: null,
    onApproveUser: null,
    onRevokeUser: null,
    onDeleteUser: null,
    onSaveCatalogKey: null,
    onSaveTelegramUrl: null,
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
        // Fallback for jsdom/happy-dom
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
        // Fallback for jsdom/happy-dom
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

  function renderReportsSection() {
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

    return html`
      <div class="admin-filter-bar" id="adminFilterBar">${rawHTML(chipsHtml)}</div>
      ${rawHTML(bodyHtml)}
    `;
  }

  function renderUserCard(userItem) {
    const email = userItem.email || userItem.id || '';
    const isApproved = userItem.active === true || userItem.status === 'APPROVED';
    const effectiveStatus = isApproved
      ? 'APPROVED'
      : userItem.status === 'REVOKED'
        ? 'REVOKED'
        : 'PENDING';
    const statusLabel = USER_STATUS_LABELS[effectiveStatus] || USER_STATUS_LABELS.PENDING;
    const isBusy = busyUserEmail === email;
    const disabledAttr = isBusy ? 'disabled' : '';

    return html`
      <article
        class="admin-report-card admin-user-card user-status-${effectiveStatus}"
        data-user-email="${email}"
      >
        <div class="admin-report-card-header">
          <div class="admin-report-badges">
            <span class="admin-status-pill user-pill-${effectiveStatus}">${statusLabel}</span>
            <bdi class="admin-user-email-pill" dir="ltr">${email}</bdi>
            ${rawHTML(
              userItem.displayName
                ? html`<span class="badge badge-source">${userItem.displayName}</span>`
                : ''
            )}
          </div>
          <span class="admin-report-date">
            ${formatReportDate(userItem.updatedAt || userItem.addedAt)}
          </span>
        </div>

        ${rawHTML(
          userItem.note ? html`<div class="admin-user-note">הערה: ${userItem.note}</div>` : ''
        )}

        <div class="admin-report-actions">
          ${rawHTML(
            !isApproved
              ? html`
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    data-user-action="approve"
                    data-user-email="${email}"
                    ${rawHTML(disabledAttr)}
                  >
                    ✅ אשר גישה
                  </button>
                `
              : html`
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    data-user-action="revoke"
                    data-user-email="${email}"
                    ${rawHTML(disabledAttr)}
                  >
                    🚫 השהה גישה
                  </button>
                `
          )}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            data-user-action="delete"
            data-user-email="${email}"
            ${rawHTML(disabledAttr)}
          >
            🗑️ הסר
          </button>
        </div>
      </article>
    `;
  }

  function renderUsersSection() {
    const counts = countAllowedUsersByStatus(allUsers);
    const filtered = filterAllowedUsers(allUsers, activeUserFilter, userSearchQuery);

    const filterChips = [
      { id: 'ALL', label: 'הכל', count: counts.total },
      { id: 'PENDING', label: 'ממתינים לאישור', count: counts.PENDING },
      { id: 'APPROVED', label: 'מורשים פעילים', count: counts.APPROVED },
      { id: 'REVOKED', label: 'מושהים', count: counts.REVOKED },
    ];

    const chipsHtml = filterChips
      .map((chip) => {
        const isActive = activeUserFilter === chip.id;
        return html`
          <button
            type="button"
            class="admin-filter-chip ${isActive ? 'active' : ''}"
            data-user-filter="${chip.id}"
            aria-pressed="${isActive ? 'true' : 'false'}"
          >
            <span>${chip.label}</span>
            <span>(${String(chip.count)})</span>
          </button>
        `;
      })
      .join('');

    let usersListHtml;
    if (isUsersLoading) {
      usersListHtml = '<div class="admin-empty-state">טוען רשימת משתמשים...</div>';
    } else if (filtered.length === 0) {
      usersListHtml = '<div class="admin-empty-state">אין משתמשים התואמים לסינון הנוכחי.</div>';
    } else {
      usersListHtml = `<div class="admin-reports-list">${filtered.map(renderUserCard).join('')}</div>`;
    }

    const keyBadgeText = configStatus.hasCatalogKey
      ? 'מפתח פענוח מוגדר בענן ✅'
      : 'מפתח פענוח טרם הוגדר בענן ⚠️';

    return html`
      <form class="admin-add-user-form" id="adminAddUserForm">
        <div class="admin-add-user-fields">
          <input
            type="email"
            id="adminUserEmailInput"
            class="form-input"
            dir="ltr"
            required
            maxlength="320"
            placeholder="student@gmail.com"
            aria-label="אימייל של משתמש חדש להוספה"
          />
          <input
            type="text"
            id="adminUserNoteInput"
            class="form-input"
            maxlength="300"
            placeholder="שם הסטודנט/ית או קבוצת לימוד (אופציונלי)"
            aria-label="הערה אופציונלית על המשתמש"
          />
        </div>
        <button type="submit" class="btn btn-primary btn-sm" id="adminAddUserBtn">
          ➕ הוסף ואשר משתמש
        </button>
      </form>

      <div class="admin-users-toolbar">
        <div class="admin-filter-bar" id="adminUserFilterBar">${rawHTML(chipsHtml)}</div>
        <input
          type="search"
          id="adminUserSearchInput"
          class="form-input admin-user-search"
          value="${userSearchQuery}"
          placeholder="חיפוש לפי אימייל, שם או הערה..."
          aria-label="חיפוש ברשימת המשתמשים"
        />
      </div>

      ${rawHTML(usersListHtml)}

      <details
        class="admin-question-details admin-config-details"
        id="adminConfigDetails"
        ${rawHTML(configDetailsOpen || !configStatus.hasCatalogKey ? 'open' : '')}
      >
        <summary>🔑 הגדרות מפתח פענוח וקישור Telegram (${keyBadgeText})</summary>
        <div class="admin-config-body">
          <form class="admin-config-form" id="adminCatalogKeyForm">
            <label class="form-label" for="adminCatalogKeyInput">
              מפתח פענוח מאגר מלא (מתוך <code>.secrets/catalog-key.json</code>):
            </label>
            <div class="admin-config-row">
              <input
                type="password"
                id="adminCatalogKeyInput"
                class="form-input"
                dir="ltr"
                autocomplete="off"
                placeholder="הדבק מחרוזת keyBase64 של 256-bit"
              />
              <button type="submit" class="btn btn-primary btn-sm" id="adminSaveCatalogKeyBtn">
                💾 שמור מפתח בענן
              </button>
            </div>
          </form>

          <form class="admin-config-form" id="adminTelegramUrlForm">
            <label class="form-label" for="adminTelegramUrlInput">
              קישור לצ׳אט המנהל ב-Telegram (מוצג למשתמשים הממתינים לאישור, ללא חשיפת מספר טלפון):
            </label>
            <div class="admin-config-row">
              <input
                type="text"
                id="adminTelegramUrlInput"
                class="form-input"
                dir="ltr"
                value="${configStatus.telegramUrl || ''}"
                placeholder="https://t.me/your_username"
              />
              <button type="submit" class="btn btn-outline btn-sm" id="adminSaveTelegramUrlBtn">
                💾 שמור קישור Telegram
              </button>
            </div>
          </form>
        </div>
      </details>
    `;
  }

  function render() {
    const el = ensureDialogElement();
    const reportCounts = countReportsByStatus(allReports);
    const userCounts = countAllowedUsersByStatus(allUsers);
    const activeRefreshLoading = activeTab === 'users' ? isUsersLoading : isLoading;

    const sectionHtml = activeTab === 'users' ? renderUsersSection() : renderReportsSection();

    el.innerHTML = html`
      <div class="report-dialog-header">
        <h2 class="app-dialog-title" id="adminDialogTitle">🛡️ לוח בקרה וניהול מערכת</h2>
        <div class="q-header-actions">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            id="adminRefreshBtn"
            ${rawHTML(activeRefreshLoading ? 'disabled' : '')}
          >
            🔄 רענן
          </button>
          <button
            type="button"
            class="dialog-close-btn"
            id="adminDialogCloseBtn"
            aria-label="סגור לוח ניהול"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="admin-tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          class="admin-tab-btn ${activeTab === 'reports' ? 'active' : ''}"
          data-admin-tab="reports"
          aria-selected="${activeTab === 'reports' ? 'true' : 'false'}"
        >
          🚩 דיווחי שאלות (${String(reportCounts.OPEN)})
        </button>
        <button
          type="button"
          role="tab"
          class="admin-tab-btn ${activeTab === 'users' ? 'active' : ''}"
          data-admin-tab="users"
          aria-selected="${activeTab === 'users' ? 'true' : 'false'}"
        >
          👥 משתמשים מורשים (${String(userCounts.PENDING)})
        </button>
      </div>

      ${rawHTML(sectionHtml)}
    `;

    bindEvents(el);
  }

  function bindEvents(el) {
    const closeBtn = el.querySelector('#adminDialogCloseBtn');
    const refreshBtn = el.querySelector('#adminRefreshBtn');
    const filterBar = el.querySelector('#adminFilterBar');
    const userFilterBar = el.querySelector('#adminUserFilterBar');
    const searchInput = el.querySelector('#adminUserSearchInput');
    const addUserForm = el.querySelector('#adminAddUserForm');
    const keyForm = el.querySelector('#adminCatalogKeyForm');
    const telegramForm = el.querySelector('#adminTelegramUrlForm');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => close());
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (activeTab === 'users') {
          if (typeof handlers.onRefreshUsers === 'function') handlers.onRefreshUsers();
        } else if (typeof handlers.onRefresh === 'function') {
          handlers.onRefresh();
        }
      });
    }

    el.querySelectorAll('button[data-admin-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const nextTab = tabBtn.dataset.adminTab || 'reports';
        if (nextTab !== activeTab) {
          activeTab = nextTab;
          if (activeTab === 'users' && typeof handlers.onRefreshUsers === 'function') {
            handlers.onRefreshUsers();
          }
          render();
        }
      });
    });

    if (filterBar) {
      filterBar.addEventListener('click', (e) => {
        const chip = e.target.closest('button[data-admin-filter]');
        if (!chip) return;
        activeFilter = chip.dataset.adminFilter || 'ALL';
        render();
      });
    }

    if (userFilterBar) {
      userFilterBar.addEventListener('click', (e) => {
        const chip = e.target.closest('button[data-user-filter]');
        if (!chip) return;
        activeUserFilter = chip.dataset.userFilter || 'ALL';
        render();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        userSearchQuery = e.target.value || '';
        render();
        const nextInput = el.querySelector('#adminUserSearchInput');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(userSearchQuery.length, userSearchQuery.length);
        }
      });
    }

    if (addUserForm) {
      addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailVal = el.querySelector('#adminUserEmailInput')?.value || '';
        const noteVal = el.querySelector('#adminUserNoteInput')?.value || '';
        if (typeof handlers.onAddUser === 'function') {
          await handlers.onAddUser({ email: emailVal, note: noteVal });
        }
      });
    }

    const configDetails = el.querySelector('#adminConfigDetails');
    if (configDetails) {
      configDetails.addEventListener('toggle', () => {
        configDetailsOpen = configDetails.open;
      });
    }

    if (keyForm) {
      keyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        configDetailsOpen = true;
        const keyVal = el.querySelector('#adminCatalogKeyInput')?.value || '';
        if (typeof handlers.onSaveCatalogKey === 'function') {
          await handlers.onSaveCatalogKey(keyVal);
        }
      });
    }

    if (telegramForm) {
      telegramForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        configDetailsOpen = true;
        const urlVal = el.querySelector('#adminTelegramUrlInput')?.value || '';
        if (typeof handlers.onSaveTelegramUrl === 'function') {
          await handlers.onSaveTelegramUrl(urlVal);
        }
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

    el.querySelectorAll('button[data-user-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.userAction;
        const email = btn.dataset.userEmail;
        const userItem = allUsers.find((u) => (u.email || u.id) === email);
        if (!email) return;

        if (action === 'approve' && typeof handlers.onApproveUser === 'function') {
          await handlers.onApproveUser(userItem || { email });
        } else if (action === 'revoke' && typeof handlers.onRevokeUser === 'function') {
          await handlers.onRevokeUser(userItem || { email });
        } else if (action === 'delete' && typeof handlers.onDeleteUser === 'function') {
          await handlers.onDeleteUser(userItem || { email });
        }
      });
    });
  }

  function open({
    reports = [],
    users = null,
    allQuestions = [],
    initialTab = 'reports',
    loading = false,
    usersLoading = false,
    adminConfigStatus = null,
    callbacks = {},
  } = {}) {
    allReports = Array.isArray(reports) ? reports : [];
    if (Array.isArray(users)) allUsers = users;
    questionsById = new Map(
      (Array.isArray(allQuestions) ? allQuestions : []).filter((q) => q?.id).map((q) => [q.id, q])
    );
    activeTab = initialTab === 'users' ? 'users' : 'reports';
    isLoading = Boolean(loading);
    isUsersLoading = Boolean(usersLoading);
    if (adminConfigStatus) configStatus = { ...configStatus, ...adminConfigStatus };
    busyReportId = null;
    busyUserEmail = null;
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

  function setUsersLoading(loading) {
    isUsersLoading = Boolean(loading);
    if (isOpen()) render();
  }

  function setUsers(users, adminConfigStatus = null) {
    allUsers = Array.isArray(users) ? users : [];
    if (adminConfigStatus) {
      configStatus = { ...configStatus, ...adminConfigStatus };
    }
    isUsersLoading = false;
    busyUserEmail = null;
    if (isOpen()) render();
  }

  function setBusyUser(email) {
    busyUserEmail = email || null;
    if (isOpen()) render();
  }

  function setConfigStatus(nextStatus = {}) {
    configStatus = { ...configStatus, ...nextStatus };
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
    setUsersLoading,
    setUsers,
    setBusyUser,
    setConfigStatus,
    isOpen,
  };
}
