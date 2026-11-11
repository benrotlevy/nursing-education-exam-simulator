/**
 * Accessible Modal Dialog Controller (`app/js/ui/dialog.js`)
 * Replaces blocking native `window.confirm()` / `window.alert()` with an accessible `<dialog>` modal.
 */

export function createDialogController({ document = globalThis.document } = {}) {
  function ensureDialogElement() {
    if (!document?.body) return null;
    let dialogEl = document.getElementById('appModalDialog');
    if (dialogEl) return dialogEl;

    dialogEl = document.createElement('dialog');
    dialogEl.id = 'appModalDialog';
    dialogEl.className = 'app-dialog';
    dialogEl.setAttribute('dir', 'rtl');
    dialogEl.innerHTML = `
      <h3 class="app-dialog-title" id="appModalDialogTitle"></h3>
      <p class="app-dialog-body" id="appModalDialogBody"></p>
      <div class="app-dialog-actions">
        <button type="button" class="btn btn-outline" id="appModalCancelBtn">ביטול</button>
        <button type="button" class="btn btn-primary" id="appModalConfirmBtn">אישור</button>
      </div>
    `;
    document.body.appendChild(dialogEl);
    return dialogEl;
  }

  /**
   * Opens a non-blocking confirmation modal and resolves to `true` (confirmed) or `false` (cancelled).
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.confirmText='אישור']
   * @param {string} [options.cancelText='ביטול']
   * @param {boolean} [options.danger=false]
   * @returns {Promise<boolean>}
   */
  function confirmDialog({
    title = 'אישור פעולה',
    message = '',
    confirmText = 'אישור',
    cancelText = 'ביטול',
    danger = false,
  } = {}) {
    const dialogEl = ensureDialogElement();
    if (!dialogEl) {
      return Promise.resolve(false);
    }

    const titleEl = dialogEl.querySelector('#appModalDialogTitle');
    const bodyEl = dialogEl.querySelector('#appModalDialogBody');
    const cancelBtn = dialogEl.querySelector('#appModalCancelBtn');
    const confirmBtn = dialogEl.querySelector('#appModalConfirmBtn');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = message;
    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
      cancelBtn.classList.remove('u-hidden');
    }
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          if (typeof dialogEl.close === 'function' && dialogEl.open) {
            dialogEl.close();
          } else {
            dialogEl.removeAttribute('open');
          }
        } catch {
          dialogEl.removeAttribute('open');
        }
        resolve(result);
      };

      const onConfirm = () => finish(true);
      const onCancel = () => finish(false);

      function cleanup() {
        confirmBtn?.removeEventListener('click', onConfirm);
        cancelBtn?.removeEventListener('click', onCancel);
        dialogEl.removeEventListener('cancel', onCancel);
      }

      confirmBtn?.addEventListener('click', onConfirm);
      cancelBtn?.addEventListener('click', onCancel);
      dialogEl.addEventListener('cancel', onCancel);

      if (typeof dialogEl.showModal === 'function') {
        try {
          dialogEl.showModal();
        } catch {
          dialogEl.setAttribute('open', '');
        }
      } else {
        dialogEl.setAttribute('open', '');
      }
    });
  }

  /**
   * Opens a single-button informational dialog and resolves when dismissed.
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.okText='הבנתי']
   * @returns {Promise<void>}
   */
  async function alertDialog({ title = 'הודעה', message = '', okText = 'הבנתי' } = {}) {
    const dialogEl = ensureDialogElement();
    if (!dialogEl) return;

    const promise = confirmDialog({
      title,
      message,
      confirmText: okText,
      cancelText: '',
      danger: false,
    });
    const cancelBtn = dialogEl.querySelector('#appModalCancelBtn');
    if (cancelBtn) {
      cancelBtn.classList.add('u-hidden');
    }
    await promise;
  }

  return {
    confirmDialog,
    alertDialog,
  };
}
