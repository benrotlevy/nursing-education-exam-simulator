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

  function getToastElement() {
    return (
      document?.getElementById('appGlobalToast') ||
      document?.getElementById('appToastContainer') ||
      null
    );
  }

  function showToast(message, durationMs = defaultDurationMs) {
    const toastEl = getToastElement();
    if (!toastEl) return false;

    let text = String(message ?? '');
    if (text === 'לא היו שגיאות במבחן זה! כל הכבוד!') {
      text = 'אין שאלות שגויות לתרגול חוזר!';
    }

    toastEl.textContent = text;
    toastEl.classList.add('visible');

    if (activeTimer) {
      clearTimeoutFn(activeTimer);
    }

    activeTimer = setTimeoutFn(() => {
      toastEl.classList.remove('visible');
      activeTimer = null;
    }, durationMs);

    return true;
  }

  function hideToast() {
    const toastEl = getToastElement();
    if (toastEl) {
      toastEl.classList.remove('visible');
    }
    if (activeTimer) {
      clearTimeoutFn(activeTimer);
      activeTimer = null;
    }
  }

  return {
    showToast,
    hideToast,
  };
}
