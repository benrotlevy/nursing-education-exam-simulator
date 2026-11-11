/**
 * Non-Blocking Toast Controller (`app/js/ui/toast.js`)
 * Manages `#appGlobalToast` with aria-live announcements and automatic timeout dismissal.
 */

export function createToastController({
  document = globalThis.document,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  defaultDurationMs = 3000,
} = {}) {
  let activeTimer = null;

  function showToast(message, durationMs = defaultDurationMs) {
    const toastEl = document?.getElementById('appGlobalToast');
    if (!toastEl) return false;

    toastEl.textContent = String(message ?? '');
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
    const toastEl = document?.getElementById('appGlobalToast');
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
