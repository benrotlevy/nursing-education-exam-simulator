/**
 * Progressive Web App (PWA) Registration & Install Prompt Service (`app/js/services/pwa.js`)
 * Registers the Service Worker (`./sw.js`) for full offline resilience and manages the
 * browser's `beforeinstallprompt` / `appinstalled` lifecycle and dismissible `#pwaInstallBanner` UX.
 */

export const PWA_INSTALL_DISMISSED_KEY = 'nursing_pwa_install_dismissed_v1';

export function createPwaService({
  window = globalThis.window,
  document = globalThis.document,
  navigator = globalThis.navigator,
  storage = window?.localStorage,
  dismissStorageKey = PWA_INSTALL_DISMISSED_KEY,
  toast = null,
  swUrl = './sw.js',
} = {}) {
  let deferredPrompt = null;
  let dismissed = false;
  let initialized = false;

  function isStandalone() {
    const matchesDisplayMode =
      typeof window?.matchMedia === 'function' &&
      Boolean(window.matchMedia('(display-mode: standalone)')?.matches);
    const iosStandalone = navigator?.standalone === true;
    return matchesDisplayMode || iosStandalone;
  }

  function isInstallDismissed() {
    if (dismissed) return true;
    try {
      return storage?.getItem?.(dismissStorageKey) === '1';
    } catch {
      return false;
    }
  }

  function updateInstallButtonVisibility() {
    const shouldShow = Boolean(deferredPrompt) && !isStandalone() && !isInstallDismissed();
    const installBtn = document?.getElementById('btnInstallPwa');
    if (installBtn) {
      installBtn.hidden = !shouldShow;
    }
    const installBanner = document?.getElementById('pwaInstallBanner');
    if (installBanner) {
      installBanner.hidden = !shouldShow;
    }
  }

  function dismissInstall() {
    dismissed = true;
    try {
      storage?.setItem?.(dismissStorageKey, '1');
    } catch {
      // Ignore storage failures in restricted browsing modes
    }
    updateInstallButtonVisibility();
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
    dismissInstall,
    isInstallDismissed,
    isStandalone,
    hasInstallPrompt: () => Boolean(deferredPrompt),
  };
}
