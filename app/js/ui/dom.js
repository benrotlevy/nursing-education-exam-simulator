/**
 * Safe DOM & HTML Rendering Utilities (`app/js/ui/dom.js`)
 * Implements `escapeHTML`, `rawHTML`, and the auto-escaping `html` tagged template literal (SEC-01).
 */

const RAW_HTML_SYMBOL = Symbol.for('nursing.rawHTML');

/**
 * Escapes HTML special characters in untrusted strings to prevent XSS.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Marks a pre-escaped HTML string as safe for interpolation inside an `html` template literal.
 * @param {string} trustedMarkup
 */
export function rawHTML(trustedMarkup) {
  return {
    [RAW_HTML_SYMBOL]: true,
    value: String(trustedMarkup ?? ''),
    toString() {
      return this.value;
    },
  };
}

export function isRawHTML(val) {
  return Boolean(val && typeof val === 'object' && val[RAW_HTML_SYMBOL] === true);
}

function serializeInterpolatedValue(val) {
  if (val === null || val === undefined || val === false) {
    return '';
  }
  if (Array.isArray(val)) {
    return val.map((item) => serializeInterpolatedValue(item)).join('');
  }
  if (isRawHTML(val)) {
    return val.value;
  }
  return escapeHTML(val);
}

/**
 * Tagged template literal that automatically escapes all interpolated values
 * unless wrapped in `rawHTML(...)` (returns a `rawHTML` fragment so nested `html` calls compose safely).
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 */
export function html(strings, ...values) {
  let result = strings[0] || '';
  for (let i = 0; i < values.length; i++) {
    result += serializeInterpolatedValue(values[i]) + (strings[i + 1] || '');
  }
  return rawHTML(result);
}
