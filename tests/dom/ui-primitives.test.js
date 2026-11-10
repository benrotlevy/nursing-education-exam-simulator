import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createToastController } from '../../app/js/ui/toast.js';
import { createDialogController } from '../../app/js/ui/dialog.js';

describe('app/js/ui/toast.js & app/js/ui/dialog.js — Non-Blocking UI Primitives', () => {
  it('shows toast notification and auto-hides after timeout', () => {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = `<div id="appGlobalToast" class="app-toast"></div>`;

    let scheduledCallback = null;
    const toast = createToastController({
      document,
      setTimeoutFn: (fn) => {
        scheduledCallback = fn;
        return 1;
      },
      clearTimeoutFn: () => {},
    });

    toast.showToast('השאלה הועתקה בהצלחה!');
    const toastEl = document.getElementById('appGlobalToast');
    assert.equal(toastEl.textContent, 'השאלה הועתקה בהצלחה!');
    assert.equal(toastEl.classList.contains('visible'), true);

    scheduledCallback();
    assert.equal(toastEl.classList.contains('visible'), false);
  });

  it('opens accessible <dialog> confirmation and resolves true on confirm / false on cancel', async () => {
    const window = new Window();
    const document = window.document;
    const dialog = createDialogController({ document });

    const confirmPromise = dialog.confirmDialog({
      title: 'יציאה מהמבחן',
      message: 'האם לצאת מהמבחן?',
      confirmText: 'צא מהמבחן',
      cancelText: 'המשך במבחן',
      danger: true,
    });

    const confirmBtn = document.getElementById('appModalConfirmBtn');
    assert.ok(confirmBtn);
    assert.equal(confirmBtn.textContent, 'צא מהמבחן');
    confirmBtn.click();

    const confirmed = await confirmPromise;
    assert.equal(confirmed, true);

    const cancelPromise = dialog.confirmDialog({
      title: 'איפוס סטטיסטיקה',
      message: 'האם לאפס?',
    });
    document.getElementById('appModalCancelBtn').click();
    const cancelled = await cancelPromise;
    assert.equal(cancelled, false);
  });
});
