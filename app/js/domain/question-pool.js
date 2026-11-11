/**
 * Question Pool & Quarantine Domain (`app/js/domain/question-pool.js`)
 * Pure filtering, source discovery, and saved-exam quarantine isolation (POOL-03..POOL-05).
 */

import { LIMITS } from '../config.js';

/**
 * Returns a Set of all question IDs currently quarantined inside `savedExams`.
 * @param {Array<{ questionIds?: string[] }>} [savedExams=[]]
 * @returns {Set<string>}
 */
export function getQuarantinedQuestionIdSet(savedExams = []) {
  const set = new Set();
  if (!Array.isArray(savedExams)) return set;
  for (const slot of savedExams) {
    if (slot && Array.isArray(slot.questionIds)) {
      for (const id of slot.questionIds) {
        set.add(id);
      }
    }
  }
  return set;
}

/**
 * Returns the active question pool excluding any quarantined questions from `savedExams`.
 * @param {Array<Object>} allQuestions
 * @param {Array<Object>} [savedExams=[]]
 * @returns {Array<Object>}
 */
export function getActiveQuestionPool(allQuestions = [], savedExams = []) {
  if (!Array.isArray(allQuestions)) return [];
  const quarantined = getQuarantinedQuestionIdSet(savedExams);
  if (quarantined.size === 0) return [...allQuestions];
  return allQuestions.filter((q) => !quarantined.has(q.id));
}

/**
 * Extracts unique non-empty source names from a question list in order of appearance.
 * @param {Array<{ source?: string }>} allQuestions
 * @returns {string[]}
 */
export function extractUniqueSources(allQuestions = []) {
  if (!Array.isArray(allQuestions)) return [];
  const set = new Set();
  for (const q of allQuestions) {
    if (q && q.source) {
      set.add(q.source);
    }
  }
  return Array.from(set);
}

/**
 * Returns full exams (`>= minQuestions`) sorted descending by question count,
 * optionally excluding sources already present in `savedExams`.
 * @param {Array<Object>} allQuestions
 * @param {Array<{ sourceName: string }>} [savedExams=[]]
 * @param {number} [minQuestions=LIMITS.MIN_FULL_EXAM_QUESTIONS]
 * @returns {Array<{ sourceName: string, questionCount: number }>}
 */
export function getAvailableFullExams(
  allQuestions = [],
  savedExams = [],
  minQuestions = LIMITS.MIN_FULL_EXAM_QUESTIONS
) {
  const countsBySource = {};
  if (Array.isArray(allQuestions)) {
    for (const q of allQuestions) {
      if (q && q.source) {
        countsBySource[q.source] = (countsBySource[q.source] || 0) + 1;
      }
    }
  }

  const alreadySaved = new Set(
    Array.isArray(savedExams) ? savedExams.map((s) => s.sourceName) : []
  );

  return Object.entries(countsBySource)
    .filter(([src, count]) => count >= minQuestions && !alreadySaved.has(src))
    .sort((a, b) => b[1] - a[1])
    .map(([sourceName, questionCount]) => ({ sourceName, questionCount }));
}

/**
 * Filters the active (non-quarantined) question pool by source, category, and mistakesOnly.
 * @param {Object} options
 * @param {Array<Object>} options.allQuestions
 * @param {Array<Object>} [options.savedExams=[]]
 * @param {string} [options.source='ALL']
 * @param {string} [options.category='ALL']
 * @param {boolean} [options.mistakesOnly=false]
 * @param {Set<string>} [options.mistakes=new Set()]
 * @returns {Array<Object>}
 */
export function filterQuestionsPool({
  allQuestions = [],
  savedExams = [],
  source = 'ALL',
  category = 'ALL',
  mistakesOnly = false,
  mistakes = new Set(),
} = {}) {
  let pool = getActiveQuestionPool(allQuestions, savedExams);

  if (source && source !== 'ALL') {
    pool = pool.filter((q) => q.source === source);
  }

  if (category && category !== 'ALL') {
    pool = pool.filter((q) => q.category === category);
  }

  if (mistakesOnly) {
    const mistakeSet = mistakes instanceof Set ? mistakes : new Set(mistakes);
    pool = pool.filter((q) => mistakeSet.has(q.id));
  }

  return pool;
}
