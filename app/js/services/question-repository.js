/**
 * Question Repository Service (`app/js/services/question-repository.js`)
 * Asynchronously fetches, validates, and caches the question catalog from `./data/questions.json`.
 */

let cachedCatalog = null;

/**
 * Loads the question bank from the given JSON URL (or returns cached copy).
 * @param {string} [url='./data/questions.json']
 * @param {typeof fetch} [fetchImpl=globalThis.fetch]
 * @returns {Promise<Array<Object>>}
 */
export async function loadQuestionsCatalog(
  url = './data/questions.json',
  fetchImpl = globalThis.fetch
) {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  if (Array.isArray(globalThis.EXAM_QUESTIONS) && globalThis.EXAM_QUESTIONS.length > 0) {
    cachedCatalog = globalThis.EXAM_QUESTIONS;
    return cachedCatalog;
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch question bank (${response.status} ${response.statusText})`);
  }

  const payload = await response.json();
  const questions = Array.isArray(payload) ? payload : payload.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Invalid question bank payload: expected non-empty questions array');
  }

  cachedCatalog = questions;
  return cachedCatalog;
}

export function clearQuestionsCatalogCache() {
  cachedCatalog = null;
}
