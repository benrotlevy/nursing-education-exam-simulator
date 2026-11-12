/**
 * Auth & Cloud Sync Status View (`app/js/features/auth/auth-view.js`)
 * Renders user pill, avatar (with strict HTTPS URL validation), and cloud sync status badge (`SEC-01`, `SEC-02`).
 */

import { DEFAULT_AVATAR_URL } from '../../config.js';
import { escapeHTML } from '../../ui/dom.js';

/**
 * Validates that an avatar URL is a well-formed `https:` URL (`SEC-02`).
 * Falls back to `DEFAULT_AVATAR_URL` if missing, malformed, or non-HTTPS (e.g. `javascript:` or `http:`).
 * @param {string | null | undefined} url
 * @returns {string}
 */
export function sanitizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') {
    return DEFAULT_AVATAR_URL;
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // Ignore malformed URLs and fall back
  }
  return DEFAULT_AVATAR_URL;
}

/**
 * Updates the header user pill, Google sign-in button, and statistics cloud sync banner.
 */
export function renderAuthUI({ document = globalThis.document, user = null } = {}) {
  if (!document) return;

  const btn = document.getElementById('btnGoogleSignIn');
  const pill = document.getElementById('userPill');
  const nameEl = document.getElementById('userName');
  const avatarEl = document.getElementById('userAvatar');
  const statsCloudBadge = document.getElementById('statsCloudSyncInfo');

  if (user) {
    const displayLabel = user.displayName || user.email || 'משתמש';
    if (btn) btn.style.display = 'none';
    if (pill) pill.style.display = 'inline-flex';
    if (nameEl) nameEl.textContent = displayLabel;
    if (avatarEl) {
      avatarEl.src = sanitizeAvatarUrl(user.photoURL);
    }
    if (statsCloudBadge) {
      statsCloudBadge.innerHTML = `<span class="cloud-sync-active-title">☁️ מחובר לחשבון <bdi>Google</bdi>:</span> <bdi class="user-display-name">${escapeHTML(displayLabel)}</bdi> &bull; <span class="cloud-sync-active-sub">סנכרון ענן פעיל</span>`;
    }
  } else {
    if (btn) btn.style.display = 'inline-flex';
    if (pill) pill.style.display = 'none';
    if (statsCloudBadge) {
      statsCloudBadge.innerHTML = `<span class="u-text-muted">💾 הנתונים נשמרים מקומית בדפדפן. לחץ למעלה על 'סנכרון ענן' כדי לסנכרן בין מכשירים.</span>`;
    }
  }
}

/**
 * Toggles the loading state on the Google Sign-In button.
 */
export function setSignInButtonLoading({ document = globalThis.document, isLoading = false } = {}) {
  const btn = document?.getElementById('btnGoogleSignIn');
  if (!btn) return;
  btn.classList.toggle('loading', Boolean(isLoading));
}

/**
 * Flashes the header sync status indicator when cloud data is pushed or received.
 */
export function flashSyncIndicator({
  document = globalThis.document,
  setTimeoutFn = globalThis.setTimeout,
  durationMs = 2000,
} = {}) {
  const indicator = document?.getElementById('syncStatusIndicator');
  if (!indicator) return null;

  indicator.textContent = '☁️ סונכרן הרגע';
  indicator.classList.add('sync-indicator-flashing');

  return setTimeoutFn(() => {
    indicator.textContent = '☁️ סנכרון ענן פעיל';
    indicator.classList.remove('sync-indicator-flashing');
  }, durationMs);
}
