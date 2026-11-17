/**
 * Question Catalog Symmetric Encryption Helper (`app/js/services/catalog-crypto.js`)
 * Isomorphic AES-256-GCM encryption & decryption using Web Crypto (`crypto.subtle`)
 * so both modern browsers and Node.js (>= 20) can run with zero third-party dependencies.
 */

const AES_ALGORITHM = 'AES-GCM';
const IV_BYTE_LENGTH = 12;
const KEY_BYTE_LENGTH = 32;

/**
 * Converts a Uint8Array into a Base64 string without relying on Node `Buffer`.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  if (typeof globalThis.Buffer === 'function') {
    return globalThis.Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into a Uint8Array without relying on Node `Buffer`.
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64) {
  const clean = typeof base64 === 'string' ? base64.trim() : '';
  if (!clean) {
    throw new Error('Base64 string cannot be empty');
  }
  if (typeof globalThis.Buffer === 'function') {
    return new Uint8Array(globalThis.Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a cryptographically random 256-bit AES key encoded as Base64.
 * @param {Crypto} [cryptoImpl=globalThis.crypto]
 * @returns {string}
 */
export function generateCatalogKeyBase64(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl || typeof cryptoImpl.getRandomValues !== 'function') {
    throw new Error('Web Crypto getRandomValues is unavailable in this environment');
  }
  const keyBytes = new Uint8Array(KEY_BYTE_LENGTH);
  cryptoImpl.getRandomValues(keyBytes);
  return bytesToBase64(keyBytes);
}

/**
 * Imports a raw Base64-encoded 256-bit key into SubtleCrypto.
 * @param {string} keyBase64
 * @param {KeyUsage[]} usages
 * @param {Crypto} [cryptoImpl=globalThis.crypto]
 * @returns {Promise<CryptoKey>}
 */
async function importAesKey(keyBase64, usages, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) {
    throw new Error('Web Crypto subtle API is unavailable in this environment');
  }
  const keyBytes = base64ToBytes(keyBase64);
  if (keyBytes.length !== KEY_BYTE_LENGTH) {
    throw new Error(
      `Invalid AES-256 key length: expected ${KEY_BYTE_LENGTH} bytes, got ${keyBytes.length}`
    );
  }
  return cryptoImpl.subtle.importKey('raw', keyBytes, { name: AES_ALGORITHM }, false, usages);
}

/**
 * Encrypts a plain catalog object (`{ version, totalQuestions, questions }`) with AES-256-GCM.
 * @param {Object | Array} plainPayload
 * @param {string} keyBase64
 * @param {Crypto} [cryptoImpl=globalThis.crypto]
 * @returns {Promise<{ version: number, alg: string, totalQuestions: number, iv: string, ciphertext: string }>}
 */
export async function encryptCatalogPayload(
  plainPayload,
  keyBase64,
  cryptoImpl = globalThis.crypto
) {
  const questions = Array.isArray(plainPayload) ? plainPayload : plainPayload?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Cannot encrypt empty question catalog payload');
  }

  const normalizedPayload = Array.isArray(plainPayload)
    ? { version: 2, totalQuestions: questions.length, questions }
    : { ...plainPayload, totalQuestions: questions.length };

  const cryptoKey = await importAesKey(keyBase64, ['encrypt'], cryptoImpl);
  const iv = new Uint8Array(IV_BYTE_LENGTH);
  cryptoImpl.getRandomValues(iv);

  const encoded = new TextEncoder().encode(JSON.stringify(normalizedPayload));
  const encryptedBuf = await cryptoImpl.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    cryptoKey,
    encoded
  );

  return {
    version: 1,
    alg: 'AES-256-GCM',
    totalQuestions: questions.length,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuf)),
  };
}

/**
 * Decrypts an `AES-256-GCM` catalog envelope (`questions.enc.json`) and validates the question list.
 * @param {Object} encryptedEnvelope
 * @param {string} keyBase64
 * @param {Crypto} [cryptoImpl=globalThis.crypto]
 * @returns {Promise<{ version?: number, totalQuestions?: number, questions: Array<Object> }>}
 */
export async function decryptCatalogPayload(
  encryptedEnvelope,
  keyBase64,
  cryptoImpl = globalThis.crypto
) {
  if (!encryptedEnvelope || typeof encryptedEnvelope !== 'object') {
    throw new Error('Invalid encrypted catalog envelope');
  }
  if (encryptedEnvelope.alg && encryptedEnvelope.alg !== 'AES-256-GCM') {
    throw new Error(`Unsupported encryption algorithm: ${encryptedEnvelope.alg}`);
  }

  const ivBytes = base64ToBytes(encryptedEnvelope.iv);
  const cipherBytes = base64ToBytes(encryptedEnvelope.ciphertext);
  if (ivBytes.length !== IV_BYTE_LENGTH) {
    throw new Error(`Invalid AES-GCM IV length: expected ${IV_BYTE_LENGTH} bytes`);
  }

  const cryptoKey = await importAesKey(keyBase64, ['decrypt'], cryptoImpl);
  const decryptedBuf = await cryptoImpl.subtle.decrypt(
    { name: AES_ALGORITHM, iv: ivBytes },
    cryptoKey,
    cipherBytes
  );

  const jsonText = new TextDecoder().decode(decryptedBuf);
  const parsed = JSON.parse(jsonText);
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Decrypted catalog payload did not contain a valid questions array');
  }

  return Array.isArray(parsed)
    ? { version: 2, totalQuestions: questions.length, questions }
    : parsed;
}
