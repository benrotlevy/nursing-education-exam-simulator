/**
 * Progressive Web App (PWA) Registration & Install Prompt Service (`app/js/services/pwa.js`)
 * Registers the Service Worker (`./sw.js`) for full offline resilience and manages the
 * browser's `beforeinstallprompt` / `appinstalled` lifecycle for `#btnInstallPwa`.
 */

export function createPwaService({
  window = globalThis.window,
  document = globalThis.document,
  navigator = globalThis.navigator,
  toast = null,
  swUrl = './sw.js',
} = {}) {
  let deferredPrompt = null;
  let initialized = false;

  function isStandalone() {
    const matchesDisplayMode =
      typeof window?.matchMedia === 'function' &&
      Boolean(window.matchMedia('(display-mode: standalone)')?.matches);
    const iosStandalone = navigator?.standalone === true;
    return matchesDisplayMode || iosStandalone;
  }

  function updateInstallButtonVisibility() {
    const installBtn = document?.getElementById('btnInstallPwa');
    if (!installBtn) return;
    const shouldShow = Boolean(deferredPrompt) && !isStandalone();
    installBtn.hidden = !shouldShow;
  }

  async function registerServiceWorker() {
    if (!navigator?.serviceWorker || typeof navigator.serviceWorker.register !== 'function') {
      return null;
    }
    if (window?.__DISABLE_SW__) {
      return null;
    }
    try {
      return await navigator.serviceWorker.register(swUrl, { scope: './' });
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
      return null;
    }
  }

  function handleBeforeInstallPrompt(event) {
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    deferredPrompt = event;
    updateInstallButtonVisibility();
  }

  function handleAppInstalled() {
    deferredPrompt = null;
    updateInstallButtonVisibility();
    toast?.showToast('האפליקציה הותקנה בהצלחה! 📲');
  }

  function init() {
    if (!initialized && typeof window?.addEventListener === 'function') {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
      initialized = true;
    }
    updateInstallButtonVisibility();
    return registerServiceWorker();
  }

  async function promptInstall() {
    if (!deferredPrompt) return false;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    updateInstallButtonVisibility();

    try {
      if (typeof promptEvent.prompt === 'function') {
        await promptEvent.prompt();
      }
      const choice = await promptEvent.userChoice;
      return choice?.outcome === 'accepted';
    } catch (err) {
      console.warn('PWA install prompt failed:', err);
      return false;
    }
  }

  return {
    init,
    registerServiceWorker,
    promptInstall,
    isStandalone,
    hasInstallPrompt: () => Boolean(deferredPrompt),
  };
}
