/**
 * Test Catalog Loader (`tests/helpers/load-test-questions.js`)
 *
 * Loads the real 1,079-question catalog when available locally (`app/data/questions.json`
 * or decrypted from `app/data/questions.enc.json` via `.secrets/catalog-key.json` /
 * `CATALOG_KEY_BASE64`), and falls back to a deterministic 1,079-question fixture
 * matching exact schema, category, and source distributions when running in CI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from '../../app/js/config.js';
import { decryptCatalogPayload } from '../../app/js/services/catalog-crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const SOURCE_DISTRIBUTION = [
  ['שחזור מבחן ממשלתי 4.6.18', 268],
  ['שחזור מבחן בהדרכה קלינית2019', 89],
  ['שחזור מבחן מתכונת בית חולים מאיר 18.11.2020', 188],
  ['שחזור מבחן מתכונת עמק יזרעאל נובמבר 2020', 72],
  ['שיחזור מבחן ממשלתי 2017', 1],
  ['שחזור מבחן הדרכה קלינית- 09.2018', 23],
  ['עמק יזרעאל 2019 שחזור מבחן פנימי הדרכה קלינית', 2],
  ['שחזור הדרכה קלינית 23/12/25', 23],
  ['שחזור מבחן אמצע 06.05.2025', 6],
  ['שחזור מבחן אמצע ומאי 2025', 3],
  ['שחזור מבחן מאי 2025', 5],
  ['שחזור ממשלתי 2024 - מסמך ערעור', 17],
  ['שחזור ממשלתי 2024 (מסומן במרקר צהוב)', 65],
  ['מבחן מסכם בהדרכה קלינית 2023 (הדסה/העברית)', 98],
  ['תרגילים להכנה למבחן ממשלתי בהדרכה קלינית', 25],
  ['מבחן תרגול בהדרכה קלינית', 31],
  ['מבחן בית קורס הדרכה קלינית (27.10.2024)', 50],
  ['שחזור מבחן ממשלתי 2023 (שחזור חליל)', 100],
  ['שחזור מבחן ממשלתי הדרכה קלינית 2021', 13],
];

let cachedQuestions = null;

function buildDeterministicFixtureQuestions() {
  const result = [];
  let idx = 0;

  for (const [source, count] of SOURCE_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      const id = `q_${String(idx + 1).padStart(3, '0')}`;
      const category = CATEGORIES[idx % CATEGORIES.length];
      result.push({
        id,
        source,
        category,
        question: `שאלה לדוגמה מספר ${idx + 1} בנושא ${category} (${source})`,
        options: [
          `אפשרות א עבור שאלה ${idx + 1}`,
          `אפשרות ב עבור שאלה ${idx + 1}`,
          `אפשרות ג עבור שאלה ${idx + 1}`,
          `אפשרות ד עבור שאלה ${idx + 1}`,
        ],
        correctIndex: idx % 4,
        verified: true,
        shortExplanation: `עיקרון פדגוגי מרכזי עבור שאלה ${idx + 1}.`,
        detailedExplanation:
          `• הרציונל הפדגוגי: עיקרון מרכזי עבור ${category} בשאלה ${idx + 1}.\n` +
          `• ניתוח המסיחים:\n` +
          `- מסיח 1 שגוי בהקשר הקליני.\n` +
          `- מסיח 2 חלקי בלבד.\n` +
          `- מסיח 3 אינו תואם את ההנחיות.`,
        originalExplanation: null,
      });
      idx += 1;
    }
  }

  return result;
}

export async function loadTestQuestions() {
  if (cachedQuestions) {
    return cachedQuestions;
  }

  const runtimePath = path.join(REPO_ROOT, 'app', 'data', 'questions.json');
  if (fs.existsSync(runtimePath)) {
    const parsed = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    cachedQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
    return cachedQuestions;
  }

  const encPath = path.join(REPO_ROOT, 'app', 'data', 'questions.enc.json');
  const keyPath = path.join(REPO_ROOT, '.secrets', 'catalog-key.json');
  let keyBase64 = process.env.CATALOG_KEY_BASE64 ? process.env.CATALOG_KEY_BASE64.trim() : '';
  if (!keyBase64 && fs.existsSync(keyPath)) {
    const keyDoc = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    keyBase64 = String(keyDoc?.keyBase64 || '').trim();
  }

  if (keyBase64 && fs.existsSync(encPath)) {
    const envelope = JSON.parse(fs.readFileSync(encPath, 'utf8'));
    const decrypted = await decryptCatalogPayload(envelope, keyBase64);
    cachedQuestions = decrypted.questions;
    return cachedQuestions;
  }

  cachedQuestions = buildDeterministicFixtureQuestions();
  return cachedQuestions;
}

export function loadTestCatalogKey() {
  const keyPath = path.join(REPO_ROOT, '.secrets', 'catalog-key.json');
  if (process.env.CATALOG_KEY_BASE64) {
    return process.env.CATALOG_KEY_BASE64.trim();
  }
  if (fs.existsSync(keyPath)) {
    const keyDoc = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return String(keyDoc?.keyBase64 || '').trim();
  }
  return '';
}
