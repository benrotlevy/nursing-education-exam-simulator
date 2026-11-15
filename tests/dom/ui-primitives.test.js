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

  it('promotes [popover] toast container into Top Layer above open modal dialogs', () => {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = `<div id="appToastContainer" popover="manual"><div id="appGlobalToast" class="app-toast"></div></div>`;

    const container = document.getElementById('appToastContainer');
    let popoverOpen = false;
    let showCalls = 0;
    let hideCalls = 0;
    container.showPopover = () => {
      popoverOpen = true;
      showCalls += 1;
    };
    container.hidePopover = () => {
      popoverOpen = false;
      hideCalls += 1;
    };
    const origMatches = container.matches.bind(container);
    container.matches = (sel) => (sel === ':popover-open' ? popoverOpen : origMatches(sel));

    const timers = new Map();
    let nextTimerId = 1;
    const toast = createToastController({
      document,
      setTimeoutFn: (fn) => {
        const id = nextTimerId++;
        timers.set(id, fn);
        return id;
      },
      clearTimeoutFn: (id) => {
        timers.delete(id);
      },
    });

    toast.showToast('פרטי הדיווח הועתקו');
    assert.equal(showCalls, 1);
    assert.equal(popoverOpen, true);

    toast.showToast('הדיווח נדחה');
    assert.equal(hideCalls, 1);
    assert.equal(showCalls, 2);
    assert.equal(timers.size, 1);

    // Trigger active duration timer, then its follow-up 320ms popover-close timer
    Array.from(timers.values())[0]();
    Array.from(timers.values()).at(-1)();
    assert.equal(popoverOpen, false);
  });
});
