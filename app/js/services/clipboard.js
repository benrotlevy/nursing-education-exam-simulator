/**
 * Resilient Clipboard Service (`app/js/services/clipboard.js`)
 * Supports modern `navigator.clipboard.writeText` with an off-screen `<textarea>` fallback for mobile browsers (`STUDY-05`).
 */

/**
 * Fallback copy implementation using a temporary off-screen readonly `<textarea>`.
 * @param {string} text
 * @param {Document} [document=globalThis.document]
 * @returns {boolean}
 */
export function fallbackCopyTextToClipboard(text, document = globalThis.document) {
  if (!document?.body) return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  if (typeof textarea.setSelectionRange === 'function') {
    textarea.setSelectionRange(0, 999999);
  }
  let success;
  try {
    success = typeof document.execCommand === 'function' ? document.execCommand('copy') : true;
  } catch {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

/**
 * Copies text to the system clipboard using the Async Clipboard API with fallback.
 * Never invokes blocking `window.alert()`.
 * @param {string} text
 * @param {Object} [env]
 * @param {Navigator} [env.navigator=globalThis.navigator]
 * @param {Document} [env.document=globalThis.document]
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(
  text,
  { navigator = globalThis.navigator, document = globalThis.document } = {}
) {
  if (!text || typeof text !== 'string') return false;

  if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  return fallbackCopyTextToClipboard(text, document);
}
