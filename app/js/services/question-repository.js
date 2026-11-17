/**
 * Question Repository Service (`app/js/services/question-repository.js`)
 * Fetches and caches either the public 10-question Demo Catalog (`./data/questions-demo.json`)
 * or the encrypted full 1,079-question catalog (`./data/questions.enc.json`) for approved users.
 */

import { decryptCatalogPayload } from './catalog-crypto.js';

let cachedCatalog = null;
let cachedEncryptedCatalog = null;

/**
 * Loads a plaintext JSON catalog from the given URL (defaults to demo catalog).
 * @param {string} [url='./data/questions-demo.json']
 * @param {typeof fetch} [fetchImpl=globalThis.fetch]
 * @returns {Promise<Array<Object>>}
 */
export async function loadQuestionsCatalog(
  url = './data/questions-demo.json',
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

/**
 * Fetches `./data/questions.enc.json` and decrypts all 1,079 questions using the
 * AES-256-GCM Base64 key retrieved from Firestore `/app_config/catalog_key`.
 * @param {Object} params
 * @param {string} params.keyBase64
 * @param {string} [params.url='./data/questions.enc.json']
 * @param {typeof fetch} [params.fetchImpl=globalThis.fetch]
 * @param {Crypto} [params.cryptoImpl=globalThis.crypto]
 * @returns {Promise<Array<Object>>}
 */
export async function loadEncryptedQuestionsCatalog({
  keyBase64,
  url = './data/questions.enc.json',
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (cachedEncryptedCatalog) {
    return cachedEncryptedCatalog;
  }

  const cleanKey = typeof keyBase64 === 'string' ? keyBase64.trim() : '';
  if (!cleanKey) {
    throw new Error('Missing AES-256 decryption key for encrypted catalog');
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch encrypted catalog (${response.status} ${response.statusText})`
    );
  }

  const envelope = await response.json();
  const decrypted = await decryptCatalogPayload(envelope, cleanKey, cryptoImpl);
  cachedEncryptedCatalog = decrypted.questions;
  return cachedEncryptedCatalog;
}

export function clearQuestionsCatalogCache() {
  cachedCatalog = null;
  cachedEncryptedCatalog = null;
}
