/**
 * Observable State Store (`app/js/core/store.js`)
 * Unidirectional state container with synchronous subscriber notifications.
 */

import { CATEGORIES, SCHEMA_VERSION } from '../config.js';

export function createInitialState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    allQuestions: [],
    sources: [],
    categories: [...CATEGORIES],
    /**
     * Timestamped mistakes map: { [questionId]: { addedAt: number, removed?: boolean } }
     * Plus a convenience Set view via helper methods in domain modules.
     */
    mistakes: new Set(),
    mistakeTimestamps: {},
    savedExams: [],
    releasedSavedExams: {},
    userStats: {
      totalAnswered: 0,
      totalCorrect: 0,
      examsCompleted: 0,
      lastResetAt: 0,
      categoryStats: {},
    },
    activeTab: 'exam',
    activeExamScreen: 'SETUP', // 'SETUP' | 'ACTIVE' | 'RESULTS'
    currentExam: {
      isSavedExam: false,
      savedExamId: null,
      savedExamTitle: null,
      questions: [],
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      eliminated: {},
      shuffledOptionsCache: {},
    },
    currentStudy: {
      questions: [],
      currentIndex: 0,
      mistakesOnly: false,
      selectedCategory: 'ALL',
      shuffledOptionsCache: {},
      userAnswers: {},
    },
  };
}

/**
 * Creates a lightweight observable store.
 * @param {Object} [initialState]
 */
export function createStore(initialState = createInitialState()) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  /**
   * Updates the store state via an updater function or partial object.
   * @param {((prevState: Object) => Object) | Object} updater
   * @param {string} [actionName='anonymous']
   */
  function setState(updater, actionName = 'anonymous') {
    const prevState = state;
    const nextPartial = typeof updater === 'function' ? updater(prevState) : updater;

    if (!nextPartial || typeof nextPartial !== 'object') {
      return state;
    }

    state = nextPartial === prevState ? prevState : { ...prevState, ...nextPartial };

    for (const listener of listeners) {
      listener(state, prevState, actionName);
    }

    return state;
  }

  /**
   * Subscribes a listener to state changes.
   * @param {(state: Object, prevState: Object, actionName: string) => void} listener
   * @returns {() => void} unsubscribe function
   */
  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    getState,
    setState,
    subscribe,
  };
}
