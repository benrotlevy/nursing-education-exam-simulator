/**
 * Demo Mode & Invite-Only Access Banner View (`app/js/features/auth/demo-banner-view.js`)
 * Renders the responsive RTL status banner for Guest Demo Mode, Pending Admin Approval,
 * Admin Key Setup prompt, and direct Telegram contact / 1-click re-check actions.
 */

import { ACCESS_STATUSES, TOTAL_CATALOG_QUESTIONS } from '../../config.js';
import { html, rawHTML } from '../../ui/dom.js';

export function createDemoBannerView({ document = globalThis.document } = {}) {
  let handlers = {
    onSubmitRequest: null,
    onRecheckAccess: null,
    onOpenAdminSetup: null,
  };
  let isSubmitting = false;
  let isChecking = false;

  function getBannerEl() {
    return document?.getElementById('demoModeBanner') || null;
  }

  function render({
    status = ACCESS_STATUSES.GUEST,
    approved = false,
    isAdmin = false,
    hasFullCatalog = false,
    user = null,
    note = '',
    telegramUrl = '',
    loadedCount = 10,
  } = {}) {
    const el = getBannerEl();
    if (!el) return;

    // Fully unlocked: hide demo banner completely
    if (approved && hasFullCatalog) {
      el.hidden = true;
      el.innerHTML = '';
      el.className = 'demo-mode-banner';
      return;
    }

    el.hidden = false;

    // Admin signed in before cloud decryption key has been uploaded to Firestore
    if (isAdmin && !hasFullCatalog) {
      el.className = 'demo-mode-banner is-admin-setup';
      el.innerHTML = html`
        <div class="demo-banner-content">
          <div class="demo-banner-title">⚙️ מצב מנהל — מפתח הפענוח טרם הוגדר בענן</div>
          <p class="demo-banner-text">
            מוצגות כעת ${String(loadedCount)} שאלות הדגמה מתוך ${String(TOTAL_CATALOG_QUESTIONS)}.
            העתק את <code>keyBase64</code> מהקובץ <code>.secrets/catalog-key.json</code> ושמור אותו
            בלחיצה אחת בהגדרות לוח הניהול.
          </p>
        </div>
        <div class="demo-banner-actions">
          <button type="button" class="btn btn-primary btn-sm" id="btnBannerSetupKey">
            🔑 הגדר מפתח פענוח כעת
          </button>
        </div>
      `;
      bindEvents(el);
      return;
    }

    // Revoked user
    if (user && status === ACCESS_STATUSES.REVOKED) {
      el.className = 'demo-mode-banner is-revoked';
      el.innerHTML = html`
        <div class="demo-banner-content">
          <div class="demo-banner-title">
            🚫 הגישה למאגר המלא עבור חשבון זה מושהית
            <bdi class="demo-user-email" dir="ltr">${user.email || ''}</bdi>
          </div>
          <p class="demo-banner-text">
            באפשרותך להמשיך לתרגל במצב הדגמה (${String(loadedCount)} מתוך
            ${String(TOTAL_CATALOG_QUESTIONS)} שאלות) או לפנות למנהל המערכת לחידוש הגישה.
          </p>
        </div>
        <div class="demo-banner-actions">
          ${rawHTML(
            telegramUrl
              ? html`<a
                  id="btnTelegramAdminChat"
                  class="btn btn-outline btn-sm demo-telegram-link"
                  href="${telegramUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 פנה למנהל ב-Telegram
                </a>`
              : ''
          )}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            id="btnRecheckAccess"
            ${rawHTML(isChecking ? 'disabled' : '')}
          >
            ${isChecking ? 'בודק...' : '🔄 בדוק הרשאה מחדש'}
          </button>
        </div>
      `;
      bindEvents(el);
      return;
    }

    // Signed in user waiting for admin approval (PENDING)
    if (user && !approved) {
      el.className = 'demo-mode-banner is-pending';
      el.innerHTML = html`
        <div class="demo-banner-content">
          <div class="demo-banner-title">
            ⏳ החשבון ממתין לאישור מנהל המערכת
            <bdi class="demo-user-email" dir="ltr">${user.email || ''}</bdi>
          </div>
          <p class="demo-banner-text">
            התראה נשלחה למנהל המערכת לאישור הגישה שלך. בינתיים באפשרותך לתרגל במצב הדגמה
            (${String(loadedCount)} מתוך ${String(TOTAL_CATALOG_QUESTIONS)} שאלות — כולל מיני-מבחן
            ולמידה).
          </p>
          <div class="demo-request-controls">
            <input
              type="text"
              id="accessRequestNoteInput"
              class="form-input demo-note-input"
              maxlength="300"
              value="${note || ''}"
              placeholder="הוסף שם מלא / קבוצת לימוד (אופציונלי)"
              aria-label="הערה לבקשת אישור גישה"
            />
            <button
              type="button"
              class="btn btn-primary btn-sm"
              id="btnSendAccessRequest"
              ${rawHTML(isSubmitting ? 'disabled' : '')}
            >
              ${isSubmitting ? 'שולח בקשה...' : '📩 שלח בקשת אישור גישה'}
            </button>
            ${rawHTML(
              telegramUrl
                ? html`<a
                    id="btnTelegramAdminChat"
                    class="btn btn-outline btn-sm demo-telegram-link"
                    href="${telegramUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    💬 פנה למנהל ב-Telegram
                  </a>`
                : ''
            )}
            <button
              type="button"
              class="btn btn-outline btn-sm"
              id="btnRecheckAccess"
              ${rawHTML(isChecking ? 'disabled' : '')}
            >
              ${isChecking ? 'בודק...' : '🔄 בדוק הרשאה מחדש'}
            </button>
          </div>
        </div>
      `;
      bindEvents(el);
      return;
    }

    // Default Guest state (not signed in)
    el.className = 'demo-mode-banner is-guest';
    el.innerHTML = html`
      <div class="demo-banner-content">
        <div class="demo-banner-title">
          🔒 מצב הדגמה (${String(loadedCount)} מתוך ${String(TOTAL_CATALOG_QUESTIONS)} שאלות פתוחות)
        </div>
        <p class="demo-banner-text">
          ניתן להתנסות בשאלות לדוגמה במצב למידה או לבצע מיני-מבחן של 10 שאלות. התחבר עם חשבון Google
          מאושר כדי לפתוח את המאגר המלא (${String(TOTAL_CATALOG_QUESTIONS)} שאלות) ולסנכרן התקדמות
          בענן.
        </p>
      </div>
      <div class="demo-banner-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="google-sign-in">
          התחבר עם Google לפתיחת המאגר
        </button>
      </div>
    `;
    bindEvents(el);
  }

  function bindEvents(el) {
    const sendBtn = el.querySelector('#btnSendAccessRequest');
    const recheckBtn = el.querySelector('#btnRecheckAccess');
    const setupKeyBtn = el.querySelector('#btnBannerSetupKey');
    const noteInput = el.querySelector('#accessRequestNoteInput');

    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        if (typeof handlers.onSubmitRequest !== 'function') return;
        const note = noteInput ? noteInput.value : '';
        await handlers.onSubmitRequest({ note });
      });
    }

    if (recheckBtn) {
      recheckBtn.addEventListener('click', async () => {
        if (typeof handlers.onRecheckAccess === 'function') {
          await handlers.onRecheckAccess();
        }
      });
    }

    if (setupKeyBtn) {
      setupKeyBtn.addEventListener('click', () => {
        if (typeof handlers.onOpenAdminSetup === 'function') {
          handlers.onOpenAdminSetup();
        }
      });
    }
  }

  function setHandlers(nextHandlers = {}) {
    handlers = { ...handlers, ...nextHandlers };
  }

  function setSubmitting(submitting) {
    isSubmitting = Boolean(submitting);
    const btn = document?.getElementById('btnSendAccessRequest');
    if (btn) {
      btn.disabled = isSubmitting;
      btn.textContent = isSubmitting ? 'שולח בקשה...' : '📩 שלח בקשת אישור גישה';
    }
  }

  function setChecking(checking) {
    isChecking = Boolean(checking);
    const btn = document?.getElementById('btnRecheckAccess');
    if (btn) {
      btn.disabled = isChecking;
      btn.textContent = isChecking ? 'בודק...' : '🔄 בדוק הרשאה מחדש';
    }
  }

  return {
    render,
    setHandlers,
    setSubmitting,
    setChecking,
  };
}
