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
 * Dispatches a declarative action on an element from the action map.
 * @param {Event} event
 * @param {Element} actionEl
 * @param {Record<string, (event: Event, actionTarget: Element) => void>} actionMap
 */
export function dispatchAction(event, actionEl, actionMap) {
  const actionName = actionEl.getAttribute('data-action');
  if (actionName && typeof actionMap[actionName] === 'function') {
    actionMap[actionName](event, actionEl);
  }
}

/**
 * Binds a map of `data-action` handlers to `root` for `click` and `keydown` events (`Enter`, `Space`).
 * @param {Element|Document} root
 * @param {Record<string, (event: Event, actionTarget: Element) => void>} actionMap
 * @returns {() => void} cleanup function
 */
export function onAction(root, actionMap) {
  const clickCleanup = delegate(root, 'click', '[data-action]', (event, actionEl) => {
    dispatchAction(event, actionEl, actionMap);
  });

  const keydownCleanup = delegate(root, 'keydown', '[data-action]', (event, actionEl) => {
    const key = event.key;
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      const tagName = actionEl.tagName?.toLowerCase();
      const role = actionEl.getAttribute('role');
      const isActivatable =
        tagName === 'button' ||
        role === 'button' ||
        actionEl.classList?.contains('option-item') ||
        actionEl.classList?.contains('grid-q-btn');

      if (isActivatable) {
        event.preventDefault();
        dispatchAction(event, actionEl, actionMap);
      }
    }
  });

  // Ensure dynamic option-item and quick-grid elements have tabindex="0" and role="button" for assistive technologies
  if (typeof MutationObserver !== 'undefined' && root && typeof root.nodeType === 'number') {
    const isTarget = (node) => node.matches?.('.option-item') || node.matches?.('.grid-q-btn');

    const enhance = (el) => {
      if (el && el.nodeType === 1) {
        if (isTarget(el) && !el.hasAttribute('tabindex')) {
          el.tabIndex = 0;
          if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        }
        const items = el.querySelectorAll?.(
          '.option-item:not([tabindex]), .grid-q-btn:not([tabindex])'
        );
        if (items) {
          items.forEach((item) => {
            item.tabIndex = 0;
            if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
          });
        }
      }
    };
    enhance(root);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          enhance(node);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  return () => {
    clickCleanup();
    keydownCleanup();
  };
}
