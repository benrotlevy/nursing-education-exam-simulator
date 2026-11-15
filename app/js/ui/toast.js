/**
 * Non-Blocking Toast Controller (`app/js/ui/toast.js`)
 * Manages `#appGlobalToast` / `#appToastContainer` with aria-live announcements and automatic timeout dismissal.
 */

export function createToastController({
  document = globalThis.document,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  defaultDurationMs = 3000,
} = {}) {
  let activeTimer = null;
  let popoverCloseTimer = null;

  function getToastElement() {
    return (
      document?.getElementById('appGlobalToast') ||
      document?.getElementById('appToastContainer') ||
      null
    );
  }

  function getPopoverHost(toastEl) {
    const container = document?.getElementById('appToastContainer');
    const candidate = container || toastEl;
    if (
      candidate &&
      typeof candidate.showPopover === 'function' &&
      typeof candidate.hasAttribute === 'function' &&
      candidate.hasAttribute('popover')
    ) {
      return candidate;
    }
    return null;
  }

  function promoteToTopLayer(hostEl) {
    if (!hostEl) return;
    try {
      // Re-opening ensures the toast always sits above the most recently opened <dialog>.
      if (hostEl.matches?.(':popover-open')) {
        hostEl.hidePopover();
      }
      hostEl.showPopover();
    } catch {
      // Ignore in synthetic DOMs or browsers without popover support
    }
  }

  function closePopoverLayer(hostEl) {
    if (!hostEl) return;
    try {
      if (hostEl.matches?.(':popover-open')) {
        hostEl.hidePopover();
      }
    } catch {
      // Ignore in synthetic DOMs or browsers without popover support
    }
  }

  function showToast(message, durationMs = defaultDurationMs) {
    const toastEl = getToastElement();
    if (!toastEl) return false;

    let text = String(message ?? '');
    if (text === 'לא היו שגיאות במבחן זה! כל הכבוד!') {
      text = 'אין שאלות שגויות לתרגול חוזר!';
    }

    if (popoverCloseTimer) {
      clearTimeoutFn(popoverCloseTimer);
      popoverCloseTimer = null;
    }

    const popoverHost = getPopoverHost(toastEl);
    promoteToTopLayer(popoverHost);

    toastEl.textContent = text;
    toastEl.classList.add('visible');

    if (activeTimer) {
      clearTimeoutFn(activeTimer);
    }

    activeTimer = setTimeoutFn(() => {
      toastEl.classList.remove('visible');
      activeTimer = null;
      if (popoverHost) {
        popoverCloseTimer = setTimeoutFn(() => {
          closePopoverLayer(popoverHost);
          popoverCloseTimer = null;
        }, 320);
      }
    }, durationMs);

    return true;
  }

  function hideToast() {
    const toastEl = getToastElement();
    if (toastEl) {
      toastEl.classList.remove('visible');
      closePopoverLayer(getPopoverHost(toastEl));
    }
    if (activeTimer) {
      clearTimeoutFn(activeTimer);
      activeTimer = null;
    }
    if (popoverCloseTimer) {
      clearTimeoutFn(popoverCloseTimer);
      popoverCloseTimer = null;
    }
  }

  return {
    showToast,
    hideToast,
  };
}
