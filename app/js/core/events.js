/**
 * Event Delegation Helpers (`app/js/core/events.js`)
 * Enables declarative `data-action` event handling without inline `on*` HTML attributes.
 */

/**
 * Attaches a delegated event listener on `root` matching `selector`.
 * @param {Element|Document} root
 * @param {string} eventType
 * @param {string} selector
 * @param {(event: Event, matchedTarget: Element) => void} handler
 * @returns {() => void} cleanup function
 */
export function delegate(root, eventType, selector, handler) {
  if (!root || typeof root.addEventListener !== 'function') {
    return () => {};
  }

  const listener = (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const matched = target.closest(selector);
    if (matched && root.contains(matched)) {
      handler(event, matched);
    }
  };

  root.addEventListener(eventType, listener);
  return () => {
    root.removeEventListener(eventType, listener);
  };
}

/**
 * Binds a map of `data-action` handlers to `root` for `click` events.
 * @param {Element|Document} root
 * @param {Record<string, (event: Event, actionTarget: Element) => void>} actionMap
 * @returns {() => void} cleanup function
 */
export function onAction(root, actionMap) {
  return delegate(root, 'click', '[data-action]', (event, actionEl) => {
    const actionName = actionEl.getAttribute('data-action');
    if (actionName && typeof actionMap[actionName] === 'function') {
      actionMap[actionName](event, actionEl);
    }
  });
}
