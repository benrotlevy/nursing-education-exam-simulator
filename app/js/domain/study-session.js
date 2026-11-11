/**
 * Study Mode Domain (`app/js/domain/study-session.js`)
 * Pure deck filtering, immediate answer feedback, stats/mistakes updates,
 * and wrap-around deck reshuffling (STUDY-01..STUDY-03).
 */

import { shuffleArray, getShuffledQuestionOptions } from './shuffle.js';
import { getActiveQuestionPool } from './question-pool.js';
import { recordMistakeAddition, recordMistakeRemoval } from './sync-merge.js';

/**
 * Builds a freshly shuffled study deck filtered by category or `mistakesOnly` (STUDY-01).
 */
export function createStudyDeck({
  allQuestions = [],
  savedExams = [],
  mistakes = new Set(),
  selectedCategory = 'ALL',
  mistakesOnly = false,
  rng = Math.random,
} = {}) {
  let pool = getActiveQuestionPool(allQuestions, savedExams);

  if (mistakesOnly) {
    const mistakeSet = mistakes instanceof Set ? mistakes : new Set(mistakes);
    pool = pool.filter((q) => mistakeSet.has(q.id));
  } else if (selectedCategory && selectedCategory !== 'ALL') {
    pool = pool.filter((q) => q.category === selectedCategory);
  }

  return {
    questions: shuffleArray(pool, rng),
    currentIndex: 0,
    mistakesOnly: Boolean(mistakesOnly),
    selectedCategory: selectedCategory || 'ALL',
    shuffledOptionsCache: {},
    userAnswers: {},
  };
}

/**
 * Ensures the study question at `questionIndex` has cached shuffled options.
 */
export function ensureStudyQuestionShuffle(
  study,
  questionIndex = study.currentIndex,
  rng = Math.random
) {
  const q = study?.questions?.[questionIndex];
  if (!q) return study;
  if (study.shuffledOptionsCache && study.shuffledOptionsCache[questionIndex]) {
    return study;
  }
  return {
    ...study,
    shuffledOptionsCache: {
      ...(study.shuffledOptionsCache || {}),
      [questionIndex]: getShuffledQuestionOptions(q, rng),
    },
  };
}

/**
 * Records an immediate study-mode answer, updating `userStats` and `mistakes` (STUDY-02).
 */
export function answerStudyQuestion({
  study,
  userStats,
  mistakes = new Set(),
  mistakeTimestamps = {},
  selectedOptionIndex,
  now = Date.now(),
  rng = Math.random,
}) {
  const hydratedStudy = ensureStudyQuestionShuffle(study, study.currentIndex, rng);
  const idx = hydratedStudy.currentIndex;
  const q = hydratedStudy.questions[idx];
  if (!q) {
    return { study: hydratedStudy, userStats, mistakes, mistakeTimestamps, isCorrect: false };
  }

  const shuffledData = hydratedStudy.shuffledOptionsCache[idx];
  const isCorrect = selectedOptionIndex === shuffledData.correctIndex;

  const nextCategoryStats = {};
  for (const [cat, stats] of Object.entries(userStats?.categoryStats || {})) {
    nextCategoryStats[cat] = { ...stats };
  }

  const cat = q.category || 'כללי';
  if (!nextCategoryStats[cat]) {
    nextCategoryStats[cat] = { correct: 0, total: 0 };
  }
  nextCategoryStats[cat].total++;

  const totalAnswered = (Number(userStats?.totalAnswered) || 0) + 1;
  let totalCorrect = Number(userStats?.totalCorrect) || 0;
  let nextMistakes = new Set(mistakes);
  let nextMistakeTimestamps = { ...mistakeTimestamps };

  if (isCorrect) {
    totalCorrect++;
    nextCategoryStats[cat].correct++;
    if (nextMistakes.has(q.id)) {
      const res = recordMistakeRemoval(nextMistakes, nextMistakeTimestamps, q.id, now);
      nextMistakes = res.mistakes;
      nextMistakeTimestamps = res.mistakeTimestamps;
    }
  } else {
    const res = recordMistakeAddition(nextMistakes, nextMistakeTimestamps, q.id, now);
    nextMistakes = res.mistakes;
    nextMistakeTimestamps = res.mistakeTimestamps;
  }

  return {
    isCorrect,
    study: {
      ...hydratedStudy,
      userAnswers: {
        ...(hydratedStudy.userAnswers || {}),
        [idx]: selectedOptionIndex,
      },
    },
    mistakes: nextMistakes,
    mistakeTimestamps: nextMistakeTimestamps,
    userStats: {
      totalAnswered,
      totalCorrect,
      examsCompleted: Number(userStats?.examsCompleted) || 0,
      lastResetAt: Number(userStats?.lastResetAt) || 0,
      categoryStats: nextCategoryStats,
    },
  };
}

/**
 * Advances to the next or previous question in the study deck.
 * Advancing past the last question wraps around to index 0 with a fresh shuffle (STUDY-03).
 */
export function advanceStudyQuestion(study, direction = 1, rng = Math.random) {
  const total = Array.isArray(study?.questions) ? study.questions.length : 0;
  if (total === 0) return study;

  if (direction < 0) {
    if (study.currentIndex > 0) {
      return {
        ...study,
        currentIndex: study.currentIndex - 1,
      };
    }
    return study;
  }

  if (study.currentIndex < total - 1) {
    return {
      ...study,
      currentIndex: study.currentIndex + 1,
    };
  }

  // Wrap around with fresh shuffle and clean answer/option cache (STUDY-03)
  return {
    ...study,
    questions: shuffleArray(study.questions, rng),
    currentIndex: 0,
    shuffledOptionsCache: {},
    userAnswers: {},
  };
}
