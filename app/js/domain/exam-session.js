/**
 * Exam Session Domain (`app/js/domain/exam-session.js`)
 * Pure state transitions for starting, answering, eliminating distractors, flagging,
 * navigating, grading, and retrying wrong questions in Exam Mode (EXAM-01..EXAM-09).
 */

import { shuffleArray, getShuffledQuestionOptions } from './shuffle.js';
import { filterQuestionsPool } from './question-pool.js';
import { recordMistakeAddition, recordMistakeRemoval } from './sync-merge.js';

/**
 * Creates a new exam session from the given filter criteria.
 */
export function createExamSession({
  allQuestions = [],
  savedExams = [],
  mistakes = new Set(),
  source = 'ALL',
  category = 'ALL',
  countChoice = '10',
  rng = Math.random,
} = {}) {
  const isMistakesOnly = countChoice === 'MISTAKES_ONLY';
  const pool = filterQuestionsPool({
    allQuestions,
    savedExams,
    source,
    category,
    mistakesOnly: isMistakesOnly,
    mistakes,
  });

  if (isMistakesOnly && pool.length === 0) {
    return {
      ok: false,
      reason: 'EMPTY_MISTAKES',
      message: 'מאגר הטעויות שלך ריק כרגע! כל הכבוד, נסה מבחן רגיל.',
    };
  }

  if (pool.length === 0) {
    return {
      ok: false,
      reason: 'EMPTY_POOL',
      message: 'לא נמצאו שאלות התואמות לסינון זה. אנא בחר סינון רחב יותר.',
    };
  }

  let shuffledQuestions = shuffleArray(pool, rng);
  const requestedCount = isMistakesOnly
    ? shuffledQuestions.length
    : Number.parseInt(String(countChoice), 10) || 10;

  if (shuffledQuestions.length > requestedCount) {
    shuffledQuestions = shuffledQuestions.slice(0, requestedCount);
  }

  return {
    ok: true,
    exam: {
      isSavedExam: false,
      savedExamId: null,
      savedExamTitle: null,
      questions: shuffledQuestions,
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      eliminated: {},
      shuffledOptionsCache: {},
    },
  };
}

/**
 * Ensures the question at `questionIndex` has cached shuffled options.
 */
export function ensureExamQuestionShuffle(
  exam,
  questionIndex = exam.currentIndex,
  rng = Math.random
) {
  const q = exam.questions[questionIndex];
  if (!q) return exam;
  if (exam.shuffledOptionsCache && exam.shuffledOptionsCache[questionIndex]) {
    return exam;
  }
  return {
    ...exam,
    shuffledOptionsCache: {
      ...(exam.shuffledOptionsCache || {}),
      [questionIndex]: getShuffledQuestionOptions(q, rng),
    },
  };
}

/**
 * Records the user's answer for the current question and clears any elimination on that option (EXAM-03).
 */
export function selectExamAnswer(exam, shuffledOptionIndex, questionIndex = exam.currentIndex) {
  const prevEliminatedForQ = exam.eliminated?.[questionIndex];
  const nextEliminated = { ...(exam.eliminated || {}) };

  if (prevEliminatedForQ instanceof Set && prevEliminatedForQ.has(shuffledOptionIndex)) {
    const nextSet = new Set(prevEliminatedForQ);
    nextSet.delete(shuffledOptionIndex);
    nextEliminated[questionIndex] = nextSet;
  }

  return {
    ...exam,
    eliminated: nextEliminated,
    userAnswers: {
      ...(exam.userAnswers || {}),
      [questionIndex]: shuffledOptionIndex,
    },
  };
}

/**
 * Toggles distractor elimination (strikethrough) on an option and clears selection if it was selected (EXAM-04).
 */
export function toggleEliminateOption(exam, optionIndex, questionIndex = exam.currentIndex) {
  const prevSet = exam.eliminated?.[questionIndex];
  const nextSet = new Set(prevSet instanceof Set ? prevSet : []);
  const nextAnswers = { ...(exam.userAnswers || {}) };

  if (nextSet.has(optionIndex)) {
    nextSet.delete(optionIndex);
  } else {
    nextSet.add(optionIndex);
    if (nextAnswers[questionIndex] === optionIndex) {
      delete nextAnswers[questionIndex];
    }
  }

  return {
    ...exam,
    userAnswers: nextAnswers,
    eliminated: {
      ...(exam.eliminated || {}),
      [questionIndex]: nextSet,
    },
  };
}

/**
 * Toggles the flagged status of a question (EXAM-05).
 */
export function toggleFlagQuestion(exam, questionIndex = exam.currentIndex) {
  const nextFlagged = new Set(exam.flagged instanceof Set ? exam.flagged : []);
  if (nextFlagged.has(questionIndex)) {
    nextFlagged.delete(questionIndex);
  } else {
    nextFlagged.add(questionIndex);
  }
  return {
    ...exam,
    flagged: nextFlagged,
  };
}

/**
 * Navigates to a bounded question index in the active exam (EXAM-06).
 */
export function navigateExamQuestion(exam, targetIndex) {
  const total = Array.isArray(exam.questions) ? exam.questions.length : 0;
  if (total === 0) return exam;
  const bounded = Math.max(0, Math.min(total - 1, Number(targetIndex) || 0));
  return {
    ...exam,
    currentIndex: bounded,
  };
}

/**
 * Returns the number of unanswered questions in the exam (EXAM-08).
 */
export function countUnansweredQuestions(exam) {
  const total = Array.isArray(exam?.questions) ? exam.questions.length : 0;
  const answered = exam?.userAnswers ? Object.keys(exam.userAnswers).length : 0;
  return Math.max(0, total - answered);
}

/**
 * Grades an active exam session, updates userStats, mistakes, mistakeTimestamps, and savedExams (EXAM-07).
 */
export function gradeExamSession({
  exam,
  userStats,
  mistakes = new Set(),
  mistakeTimestamps = {},
  savedExams = [],
  now = Date.now(),
  rng = Math.random,
}) {
  const total = exam.questions.length;
  let correctCount = 0;
  const wrongQuestions = [];
  const nextShuffledCache = { ...(exam.shuffledOptionsCache || {}) };

  let nextMistakes = new Set(mistakes);
  let nextMistakeTimestamps = { ...mistakeTimestamps };

  const nextCategoryStats = {};
  for (const [cat, stats] of Object.entries(userStats?.categoryStats || {})) {
    nextCategoryStats[cat] = { ...stats };
  }

  let totalAnswered = Number(userStats?.totalAnswered) || 0;
  let totalCorrect = Number(userStats?.totalCorrect) || 0;
  const examsCompleted = (Number(userStats?.examsCompleted) || 0) + 1;

  exam.questions.forEach((q, idx) => {
    const userChoice = exam.userAnswers?.[idx];
    if (!nextShuffledCache[idx]) {
      nextShuffledCache[idx] = getShuffledQuestionOptions(q, rng);
    }
    const shuffledData = nextShuffledCache[idx];
    const isCorrect = userChoice !== undefined && userChoice === shuffledData.correctIndex;

    totalAnswered++;
    const cat = q.category || 'כללי';
    if (!nextCategoryStats[cat]) {
      nextCategoryStats[cat] = { correct: 0, total: 0 };
    }
    nextCategoryStats[cat].total++;

    if (isCorrect) {
      correctCount++;
      totalCorrect++;
      nextCategoryStats[cat].correct++;
      if (nextMistakes.has(q.id)) {
        const res = recordMistakeRemoval(nextMistakes, nextMistakeTimestamps, q.id, now);
        nextMistakes = res.mistakes;
        nextMistakeTimestamps = res.mistakeTimestamps;
      }
    } else {
      wrongQuestions.push({ question: q, userChoice, shuffledData });
      const res = recordMistakeAddition(nextMistakes, nextMistakeTimestamps, q.id, now);
      nextMistakes = res.mistakes;
      nextMistakeTimestamps = res.mistakeTimestamps;
    }
  });

  const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  let titleMessage = '💪 התחלה טובה! כדאי לחזור על השאלות שטעית בהן.';
  if (scorePct >= 85) {
    titleMessage = '🌟 תוצאה מעולה! מוכנות גבוהה למבחן!';
  } else if (scorePct >= 70) {
    titleMessage = '👍 עבודה טובה! עם עוד קצת תרגול זה יהיה מושלם.';
  }

  let nextSavedExams = Array.isArray(savedExams) ? [...savedExams] : [];
  if (exam.isSavedExam && exam.savedExamId) {
    nextSavedExams = nextSavedExams.map((slot) =>
      slot.id === exam.savedExamId
        ? {
            ...slot,
            status: 'COMPLETED',
            score: scorePct,
            completedAt: new Date(now).toISOString(),
          }
        : slot
    );
  }

  return {
    exam: {
      ...exam,
      shuffledOptionsCache: nextShuffledCache,
    },
    scorePct,
    correctCount,
    wrongCount: total - correctCount,
    totalCount: total,
    titleMessage,
    wrongQuestions,
    mistakes: nextMistakes,
    mistakeTimestamps: nextMistakeTimestamps,
    savedExams: nextSavedExams,
    userStats: {
      totalAnswered,
      totalCorrect,
      examsCompleted,
      lastResetAt: Number(userStats?.lastResetAt) || 0,
      categoryStats: nextCategoryStats,
    },
  };
}

/**
 * Creates a new exam session containing only the questions answered wrongly or left unanswered (EXAM-09).
 */
export function createRetryWrongExamSession(exam, rng = Math.random) {
  const wrongList = (exam?.questions || []).filter((_q, idx) => {
    const userChoice = exam.userAnswers?.[idx];
    const shuffled = exam.shuffledOptionsCache?.[idx];
    return !shuffled || userChoice === undefined || userChoice !== shuffled.correctIndex;
  });

  if (wrongList.length === 0) {
    return {
      ok: false,
      message: 'אין שאלות שגויות לתרגול חוזר!',
    };
  }

  return {
    ok: true,
    exam: {
      isSavedExam: false,
      savedExamId: null,
      savedExamTitle: null,
      questions: shuffleArray(wrongList, rng),
      currentIndex: 0,
      userAnswers: {},
      flagged: new Set(),
      eliminated: {},
      shuffledOptionsCache: {},
    },
  };
}
