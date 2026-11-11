/**
 * Cloud & Local State Merge Domain (`app/js/domain/sync-merge.js`)
 * Implements deterministic, timestamp-aware conflict resolution for mistakes (`SYNC-02`)
 * and `lastResetAt`-aware statistics merging (`SYNC-03`).
 */

/**
 * Records a mistake addition with a monotonic timestamp so cloud sync can resolve additions vs removals.
 * @param {Set<string>} mistakes
 * @param {Record<string, { updatedAt: number, removed?: boolean }>} mistakeTimestamps
 * @param {string} questionId
 * @param {number} [now=Date.now()]
 */
export function recordMistakeAddition(
  mistakes,
  mistakeTimestamps = {},
  questionId,
  now = Date.now()
) {
  const nextMistakes = new Set(mistakes);
  nextMistakes.add(questionId);
  const nextTimestamps = {
    ...mistakeTimestamps,
    [questionId]: { updatedAt: now, removed: false },
  };
  return { mistakes: nextMistakes, mistakeTimestamps: nextTimestamps };
}

/**
 * Records a mistake removal with a monotonic tombstone timestamp (`removed: true`)
 * so that an answered mistake is never resurrected by a stale cloud document (SYNC-02).
 * @param {Set<string>} mistakes
 * @param {Record<string, { updatedAt: number, removed?: boolean }>} mistakeTimestamps
 * @param {string} questionId
 * @param {number} [now=Date.now()]
 */
export function recordMistakeRemoval(
  mistakes,
  mistakeTimestamps = {},
  questionId,
  now = Date.now()
) {
  const nextMistakes = new Set(mistakes);
  nextMistakes.delete(questionId);
  const nextTimestamps = {
    ...mistakeTimestamps,
    [questionId]: { updatedAt: now, removed: true },
  };
  return { mistakes: nextMistakes, mistakeTimestamps: nextTimestamps };
}

/**
 * Normalizes a Mistakes representation (Set/Array + optional timestamps map) into a
 * unified map `{ [qId]: { updatedAt: number, removed: boolean } }`.
 */
function normalizeMistakeMeta(mistakes, mistakeTimestamps = {}, defaultTimestamp = 1) {
  const map = {};
  if (mistakeTimestamps && typeof mistakeTimestamps === 'object') {
    for (const [qId, entry] of Object.entries(mistakeTimestamps)) {
      if (entry && typeof entry === 'object') {
        map[qId] = {
          updatedAt: Number(entry.updatedAt ?? entry.addedAt) || defaultTimestamp,
          removed: Boolean(entry.removed),
        };
      }
    }
  }

  const activeSet =
    mistakes instanceof Set ? mistakes : new Set(Array.isArray(mistakes) ? mistakes : []);
  for (const qId of activeSet) {
    if (!map[qId]) {
      map[qId] = { updatedAt: defaultTimestamp, removed: false };
    }
  }

  return map;
}

/**
 * Merges local and remote progress deterministically:
 * 1. If one side has a newer `userStats.lastResetAt` than the other side's `updatedAt` / `lastResetAt`,
 *    earlier pre-reset counters and pre-reset mistakes from the stale side are discarded (SYNC-03).
 * 2. Per-question mistake additions/removals are resolved by highest `updatedAt` timestamp (SYNC-02).
 */
export function mergeCloudAndLocalProgress(local = {}, remote = {}) {
  const localStats = local.userStats || {};
  const remoteStats = remote.userStats || {};

  const localResetAt = Number(localStats.lastResetAt) || 0;
  const remoteResetAt = Number(remoteStats.lastResetAt) || 0;
  const effectiveResetAt = Math.max(localResetAt, remoteResetAt);

  // Merge mistake metadata per question ID by latest updatedAt
  const localMeta = normalizeMistakeMeta(local.mistakes, local.mistakeTimestamps, 1);
  const remoteMeta = normalizeMistakeMeta(remote.mistakes, remote.mistakeTimestamps, 1);

  const allQuestionIds = new Set([...Object.keys(localMeta), ...Object.keys(remoteMeta)]);
  const mergedTimestamps = {};
  const mergedMistakes = new Set();

  for (const qId of allQuestionIds) {
    const lEntry = localMeta[qId];
    const rEntry = remoteMeta[qId];

    let winner;
    if (lEntry && rEntry) {
      winner = rEntry.updatedAt > lEntry.updatedAt ? rEntry : lEntry;
    } else {
      winner = lEntry || rEntry;
    }

    // If a global reset happened after this mistake was last touched, mark it removed
    if (effectiveResetAt > 0 && winner.updatedAt < effectiveResetAt) {
      mergedTimestamps[qId] = { updatedAt: effectiveResetAt, removed: true };
      continue;
    }

    mergedTimestamps[qId] = { ...winner };
    if (!winner.removed) {
      mergedMistakes.add(qId);
    }
  }

  // Merge userStats respecting lastResetAt
  let mergedStats;
  if (localResetAt > remoteResetAt) {
    mergedStats = {
      totalAnswered: Number(localStats.totalAnswered) || 0,
      totalCorrect: Number(localStats.totalCorrect) || 0,
      examsCompleted: Number(localStats.examsCompleted) || 0,
      lastResetAt: localResetAt,
      categoryStats: { ...(localStats.categoryStats || {}) },
    };
  } else if (remoteResetAt > localResetAt) {
    mergedStats = {
      totalAnswered: Number(remoteStats.totalAnswered) || 0,
      totalCorrect: Number(remoteStats.totalCorrect) || 0,
      examsCompleted: Number(remoteStats.examsCompleted) || 0,
      lastResetAt: remoteResetAt,
      categoryStats: { ...(remoteStats.categoryStats || {}) },
    };
  } else {
    const mergedCategoryStats = {};
    const allCats = new Set([
      ...Object.keys(localStats.categoryStats || {}),
      ...Object.keys(remoteStats.categoryStats || {}),
    ]);
    for (const cat of allCats) {
      const lCat = localStats.categoryStats?.[cat] || { correct: 0, total: 0 };
      const rCat = remoteStats.categoryStats?.[cat] || { correct: 0, total: 0 };
      mergedCategoryStats[cat] = {
        total: Math.max(Number(lCat.total) || 0, Number(rCat.total) || 0),
        correct: Math.max(Number(lCat.correct) || 0, Number(rCat.correct) || 0),
      };
    }

    mergedStats = {
      totalAnswered: Math.max(
        Number(localStats.totalAnswered) || 0,
        Number(remoteStats.totalAnswered) || 0
      ),
      totalCorrect: Math.max(
        Number(localStats.totalCorrect) || 0,
        Number(remoteStats.totalCorrect) || 0
      ),
      examsCompleted: Math.max(
        Number(localStats.examsCompleted) || 0,
        Number(remoteStats.examsCompleted) || 0
      ),
      lastResetAt: effectiveResetAt,
      categoryStats: mergedCategoryStats,
    };
  }

  const savedExams = Array.isArray(remote.savedExams)
    ? remote.savedExams.slice(0, 3)
    : Array.isArray(local.savedExams)
      ? local.savedExams.slice(0, 3)
      : [];

  return {
    mistakes: mergedMistakes,
    mistakeTimestamps: mergedTimestamps,
    userStats: mergedStats,
    savedExams,
  };
}
