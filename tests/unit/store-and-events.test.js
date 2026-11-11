import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createStore, createInitialState } from '../../app/js/core/store.js';
import { delegate, onAction } from '../../app/js/core/events.js';

describe('app/js/core/store.js & app/js/core/events.js', () => {
  it('initializes with schemaVersion 2 and notifies subscribers on setState', () => {
    const store = createStore(createInitialState());
    assert.equal(store.getState().schemaVersion, 2);
    assert.equal(store.getState().categories.length, 6);

    const actions = [];
    const unsubscribe = store.subscribe((next, prev, actionName) => {
      actions.push({ actionName, prevTab: prev.activeTab, nextTab: next.activeTab });
    });

    store.setState({ activeTab: 'study' }, 'switchToStudy');
    store.setState((s) => ({ activeTab: s.activeTab === 'study' ? 'stats' : 'exam' }), 'toggleTab');

    unsubscribe();
    store.setState({ activeTab: 'exam' }, 'ignoredAfterUnsubscribe');

    assert.equal(actions.length, 2);
    assert.deepStrictEqual(actions[0], {
      actionName: 'switchToStudy',
      prevTab: 'exam',
      nextTab: 'study',
    });
    assert.deepStrictEqual(actions[1], {
      actionName: 'toggleTab',
      prevTab: 'study',
      nextTab: 'stats',
    });
  });

  it('delegates click events and dispatches data-action handlers accurately', () => {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = `
      <div id="container">
        <button data-action="start-exam" data-count="25"><span id="innerSpan">התחל</span></button>
      </div>
    `;

    let triggeredCount = null;
    const cleanup = onAction(document.body, {
      'start-exam': (_event, actionEl) => {
        triggeredCount = actionEl.getAttribute('data-count');
      },
    });

    // Clicking the nested <span> bubbles up and matches the [data-action="start-exam"] button
    document.getElementById('innerSpan').click();
    assert.equal(triggeredCount, '25');

    // Cleanup removes the listener
    triggeredCount = null;
    cleanup();
    document.getElementById('innerSpan').click();
    assert.equal(triggeredCount, null);

    // Direct delegate() check
    let delegatedHit = false;
    const off = delegate(document.body, 'click', 'button', () => {
      delegatedHit = true;
    });
    document.getElementById('innerSpan').click();
    assert.equal(delegatedHit, true);
    off();
  });
});
