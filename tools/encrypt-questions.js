/**
 * Catalog Encryption & Demo Extractor CLI (`tools/encrypt-questions.js`)
 *
 * Reads plaintext `app/data/questions.json`, generates (or reuses) a 256-bit key in
 * `.secrets/catalog-key.json` (git-ignored), extracts 10 representative sample questions
 * to `app/data/questions-demo.json`, and encrypts the full catalog into `app/data/questions.enc.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from '../app/js/config.js';
import {
  decryptCatalogPayload,
  encryptCatalogPayload,
  generateCatalogKeyBase64,
} from '../app/js/services/catalog-crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SOURCE_QUESTIONS_PATH = path.join(ROOT_DIR, 'app', 'data', 'questions.json');
const DEMO_QUESTIONS_PATH = path.join(ROOT_DIR, 'app', 'data', 'questions-demo.json');
const ENCRYPTED_QUESTIONS_PATH = path.join(ROOT_DIR, 'app', 'data', 'questions.enc.json');
const SECRETS_DIR = path.join(ROOT_DIR, '.secrets');
const KEY_FILE_PATH = path.join(SECRETS_DIR, 'catalog-key.json');

/**
 * Picks 10 representative sample questions balanced across all nursing categories.
 * @param {Array<Object>} questions
 * @returns {Array<Object>}
 */
export function selectDemoQuestions(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const selected = [];
  const seenIds = new Set();

  // First pass: pick up to 1 strong question from each official category
  for (const cat of CATEGORIES) {
    const candidate = questions.find(
      (q) =>
        q &&
        !seenIds.has(q.id) &&
        q.category === cat &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.detailedExplanation === 'string' &&
        q.detailedExplanation.includes('הרציונל')
    );
    if (candidate) {
      selected.push(candidate);
      seenIds.add(candidate.id);
    }
  }

  // Second pass: add another question per category from varied sources until reaching 10
  const usedSources = new Set(selected.map((q) => q.source));
  for (const cat of CATEGORIES) {
    if (selected.length >= 10) break;
    const candidate =
      questions.find(
        (q) =>
          q &&
          !seenIds.has(q.id) &&
          q.category === cat &&
          !usedSources.has(q.source) &&
          Array.isArray(q.options) &&
          q.options.length === 4
      ) || questions.find((q) => q && !seenIds.has(q.id) && q.category === cat);

    if (candidate) {
      selected.push(candidate);
      seenIds.add(candidate.id);
      usedSources.add(candidate.source);
    }
  }

  // Fallback fill if fewer than 10 categories matched
  for (const q of questions) {
    if (selected.length >= 10) break;
    if (q && !seenIds.has(q.id)) {
      selected.push(q);
      seenIds.add(q.id);
    }
  }

  return selected.slice(0, 10);
}

async function main() {
  if (!fs.existsSync(SOURCE_QUESTIONS_PATH)) {
    throw new Error(`Plaintext catalog not found at ${SOURCE_QUESTIONS_PATH}`);
  }

  const rawText = fs.readFileSync(SOURCE_QUESTIONS_PATH, 'utf8');
  const parsed = JSON.parse(rawText);
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Source questions.json contains no questions');
  }

  // Load existing key or generate a fresh 256-bit key in git-ignored `.secrets/catalog-key.json`
  let keyBase64 = process.env.CATALOG_KEY_BASE64 ? process.env.CATALOG_KEY_BASE64.trim() : '';
  if (!keyBase64 && fs.existsSync(KEY_FILE_PATH)) {
    const existingKeyFile = JSON.parse(fs.readFileSync(KEY_FILE_PATH, 'utf8'));
    keyBase64 = String(existingKeyFile?.keyBase64 || '').trim();
  }
  if (!keyBase64) {
    keyBase64 = generateCatalogKeyBase64();
    fs.mkdirSync(SECRETS_DIR, { recursive: true });
    fs.writeFileSync(
      KEY_FILE_PATH,
      JSON.stringify(
        {
          schemaVersion: 2,
          alg: 'AES-256-GCM',
          keyBase64,
          totalQuestions: questions.length,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    console.log(`Generated new AES-256-GCM key at ${path.relative(ROOT_DIR, KEY_FILE_PATH)}`);
  }

  // Write 10-question Demo Catalog
  const demoQuestions = selectDemoQuestions(questions);
  const demoPayload = {
    version: 2,
    demo: true,
    totalCatalogQuestions: questions.length,
    totalQuestions: demoQuestions.length,
    questions: demoQuestions,
  };
  fs.writeFileSync(DEMO_QUESTIONS_PATH, JSON.stringify(demoPayload, null, 2) + '\n', 'utf8');

  // Encrypt full catalog and self-verify decryption round-trip
  const fullPayload = Array.isArray(parsed)
    ? { version: 2, totalQuestions: questions.length, questions }
    : { ...parsed, totalQuestions: questions.length };

  const encryptedEnvelope = await encryptCatalogPayload(fullPayload, keyBase64);
  const verified = await decryptCatalogPayload(encryptedEnvelope, keyBase64);
  if (verified.questions.length !== questions.length) {
    throw new Error(
      `Verification mismatch: expected ${questions.length} questions, got ${verified.questions.length}`
    );
  }

  fs.writeFileSync(ENCRYPTED_QUESTIONS_PATH, JSON.stringify(encryptedEnvelope) + '\n', 'utf8');

  console.log(
    `Encrypted ${questions.length} questions -> ${path.relative(ROOT_DIR, ENCRYPTED_QUESTIONS_PATH)}`
  );
  console.log(
    `Generated ${demoQuestions.length} demo questions -> ${path.relative(ROOT_DIR, DEMO_QUESTIONS_PATH)}`
  );
  console.log('AES-256-GCM round-trip verification: PASSED');
}

const isExecutedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isExecutedDirectly) {
  main().catch((err) => {
    console.error('Failed to encrypt question catalog:', err);
    process.exit(1);
  });
}
