/**
 * Pure Randomization & Option Shuffling Domain (`app/js/domain/shuffle.js`)
 * Implements Fisher-Yates shuffle with injectable RNG for deterministic unit tests (POOL-01, POOL-02).
 */

/**
 * Returns a new shuffled copy of `arr` using Fisher-Yates without mutating `arr`.
 * @template T
 * @param {ReadonlyArray<T>} arr
 * @param {() => number} [rng=Math.random]
 * @returns {T[]}
 */
export function shuffleArray(arr, rng = Math.random) {
  if (!Array.isArray(arr)) return [];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles a question's options while tracking the new `correctIndex`.
 * @param {{ options: string[], correctIndex: number }} question
 * @param {() => number} [rng=Math.random]
 * @returns {{ options: string[], correctIndex: number }}
 */
export function getShuffledQuestionOptions(question, rng = Math.random) {
  const indexedOptions = question.options.map((optText, origIndex) => ({
    text: optText,
    isCorrect: origIndex === question.correctIndex,
  }));

  const shuffled = shuffleArray(indexedOptions, rng);
  const newCorrectIndex = shuffled.findIndex((item) => item.isCorrect);

  return {
    options: shuffled.map((item) => item.text),
    correctIndex: newCorrectIndex,
  };
}
